import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type {
  FrameResult,
  ProofingMode,
  ProviderStatus,
  ScanProgress,
  ScanResult,
  SpellingError,
  TranscriptResult,
  VideoError,
  VisualTextSegment,
} from '../src/types/index.ts';
import {
  attachErrorsToFrames,
  buildVideoErrorSummary,
  detectAlignmentIssues,
  groupVisualTextSegments,
  normalizeProofText,
  shouldSpellCheckVisualSegment,
} from '../src/lib/proofing-utils.ts';
import { createImageCrop, extractMedia } from './ffmpeg.ts';
import { judgeCandidateIssues } from './judge.ts';
import { recognizeFrame, terminateOcrWorker } from './ocr.ts';
import { checkServerWords, initServerSpellChecker } from './spell-checker.ts';
import {
  buildTranscriptionConsensus,
  getOpenRouterSkippedTranscriptionStatuses,
} from './transcription.ts';

export interface ProofingJobInput {
  scanId: string;
  rootDir: string;
  jobDir: string;
  inputPath: string;
  fileName: string;
  mode: ProofingMode;
  openRouterApiKey: string;
  updateProgress: (progress: ScanProgress) => void;
}

function artifactUrl(scanId: string, relativePath: string): string {
  return `/api/scans/${scanId}/artifacts/${relativePath.split(path.sep).join('/')}`;
}

function makeEmptyTranscript(): TranscriptResult {
  return { text: '', segments: [], words: [] };
}

function getTranscriptionFailureNote(providers: ProviderStatus[]): string {
  const errors = providers
    .map((provider) => provider.error ?? '')
    .filter(Boolean);

  if (errors.some((error) => error.includes('audio credits'))) {
    return 'Transcript checks were skipped because the OpenRouter key needs audio credits. Visible text was still checked.';
  }

  if (errors.some((error) => error.includes('invalid or unauthorized'))) {
    return 'Transcript checks were skipped because the OpenRouter key was rejected. Visible text was still checked.';
  }

  if (errors.some((error) => error.includes('rate limit'))) {
    return 'Transcript checks were skipped because OpenRouter is rate limited. Visible text was still checked.';
  }

  return 'Transcript checks were skipped because OpenRouter transcription did not return enough usable results. Visible text was still checked.';
}

function makeSkippedJudge(reason: string) {
  return {
    status: 'skipped' as const,
    model: 'google/gemini-2.5-flash',
    error: reason,
  };
}

async function addSegmentCrops(
  scanId: string,
  jobDir: string,
  visualSegments: VisualTextSegment[],
  framePathByIndex: Map<number, string>,
): Promise<VisualTextSegment[]> {
  const cropsDir = path.join(jobDir, 'crops');
  await mkdir(cropsDir, { recursive: true });

  const updated: VisualTextSegment[] = [];
  for (const segment of visualSegments) {
    const frameIndex = segment.representativeFrameIndex ?? segment.frameIndices[0];
    const framePath = framePathByIndex.get(frameIndex);
    if (!framePath || !segment.bbox) {
      updated.push(segment);
      continue;
    }

    const cropFileName = `${segment.id}.jpg`;
    const cropPath = path.join(cropsDir, cropFileName);

    try {
      await createImageCrop(framePath, cropPath, segment.bbox);
      updated.push({
        ...segment,
        cropUrl: artifactUrl(scanId, path.join('crops', cropFileName)),
      });
    } catch {
      updated.push(segment);
    }
  }

  return updated;
}

function buildSpellingErrorsBySegment(
  visualSegments: VisualTextSegment[],
): Map<string, SpellingError[]> {
  const errorsBySegmentId = new Map<string, SpellingError[]>();

  for (const segment of visualSegments) {
    if (!shouldSpellCheckVisualSegment(segment)) {
      errorsBySegmentId.set(segment.id, []);
      continue;
    }

    const errors = checkServerWords(
      segment.ocrWords,
      segment.representativeFrameIndex,
    );
    errorsBySegmentId.set(segment.id, errors);
  }

  return errorsBySegmentId;
}

function buildUnreadableIssues(
  visualSegments: VisualTextSegment[],
  framesByIndex: Map<number, FrameResult>,
): VideoError[] {
  return visualSegments.flatMap((segment) => {
    const confidence = segment.confidence ?? 100;
    const normalizedText = normalizeProofText(segment.text);
    const normalizedWords = normalizedText.split(' ').filter(Boolean);
    const bbox = segment.bbox;

    if (confidence >= 38) return [];
    if (segment.frameIndices.length < 4) return [];
    if (normalizedText.length < 14 || normalizedWords.length < 3) return [];
    if (!bbox) return [];

    const boxWidth = Math.max(0, bbox.x1 - bbox.x0);
    const boxHeight = Math.max(0, bbox.y1 - bbox.y0);
    if (boxWidth < 180 || boxHeight < 28 || boxWidth * boxHeight < 6000) {
      return [];
    }

    const frame = framesByIndex.get(
      segment.representativeFrameIndex ?? segment.frameIndices[0],
    );
    if (!frame) return [];

    return {
      type: 'unreadable_text' as const,
      severity: 'warning' as const,
      message: 'Visible text is low-confidence across multiple frames.',
      frameIndex: frame.frameIndex,
      timestamp: frame.timestamp,
      onScreenText: segment.text,
      textTime: { start: segment.startTime, end: segment.endTime },
      bbox,
      confidence: confidence / 100,
      evidenceNote: 'OCR repeatedly saw text here, but confidence stayed low.',
      artifactUrl: segment.cropUrl ?? segment.representativeFrameUrl,
    };
  });
}

export async function runProofingJob({
  scanId,
  rootDir,
  jobDir,
  inputPath,
  fileName,
  mode,
  openRouterApiKey,
  updateProgress,
}: ProofingJobInput): Promise<ScanResult> {
  const notes: string[] = [];

  await mkdir(path.join(jobDir, 'frames'), { recursive: true });
  await mkdir(path.join(jobDir, 'crops'), { recursive: true });
  await initServerSpellChecker(rootDir);

  updateProgress({
    stage: 'extracting',
    currentFrame: 0,
    totalFrames: 0,
    message: 'Extracting audio and timestamped frames...',
  });

  const media = await extractMedia(inputPath, jobDir, (currentFrame, totalFrames) => {
    updateProgress({
      stage: 'extracting',
      currentFrame,
      totalFrames,
      message: `Extracting frame ${currentFrame} of ${totalFrames}...`,
    });
  });

  let transcript = makeEmptyTranscript();
  let transcriptionProviders =
    getOpenRouterSkippedTranscriptionStatuses('Visual-only scan selected');
  let consensusConfidence = 0;
  let degraded = mode === 'audio_aware';

  if (mode === 'audio_aware') {
    if (!openRouterApiKey) {
      transcriptionProviders = getOpenRouterSkippedTranscriptionStatuses(
        'OpenRouter API key missing',
      );
      notes.push(
        'Transcript checks were skipped because no OpenRouter API key was provided. Visible text was still checked.',
      );
      degraded = true;
    } else if (media.audioPath) {
      updateProgress({
        stage: 'transcribing',
        currentFrame: 0,
        totalFrames: 0,
        message: 'Running three OpenRouter transcription models...',
      });

      const consensus = await buildTranscriptionConsensus(
        media.audioPath,
        openRouterApiKey,
        media.duration,
      );
      transcriptionProviders = consensus.providers;
      const successfulProviders = consensus.providers.filter(
        (provider) => provider.status === 'success' && (provider.wordCount ?? 0) > 0,
      );

      if (successfulProviders.length >= 2) {
        transcript = consensus.transcript;
        consensusConfidence = consensus.confidence;
        degraded = false;
      } else {
        notes.push(getTranscriptionFailureNote(consensus.providers));
        degraded = true;
      }
    } else {
      transcriptionProviders = getOpenRouterSkippedTranscriptionStatuses(
        'No usable audio track extracted',
      );
      notes.push('Transcript checks were skipped because no usable audio track was found. Visible text was still checked.');
      degraded = true;
    }
  } else {
    degraded = false;
  }

  updateProgress({
    stage: 'scanning',
    currentFrame: 0,
    totalFrames: media.frames.length,
    message: 'Running OCR on extracted frames...',
  });

  const frames: FrameResult[] = [];
  const framePathByIndex = new Map<number, string>();

  try {
    for (let index = 0; index < media.frames.length; index++) {
      const frame = media.frames[index];
      updateProgress({
        stage: 'scanning',
        currentFrame: index + 1,
        totalFrames: media.frames.length,
        message: `Reading text in frame ${index + 1} of ${media.frames.length}...`,
      });

      const ocrResult = await recognizeFrame(frame.path);
      framePathByIndex.set(index, frame.path);

      if (!ocrResult.text.trim()) continue;

      frames.push({
        frameIndex: index,
        timestamp: frame.timestamp,
        thumbnailUrl: artifactUrl(scanId, path.join('frames', frame.fileName)),
        ocrResult,
        errors: [],
      });
    }
  } finally {
    await terminateOcrWorker();
  }

  updateProgress({
    stage: 'analyzing',
    currentFrame: 0,
    totalFrames: 0,
    message: 'Grouping text over time and checking against transcript...',
  });

  const framesByIndex = new Map(frames.map((frame) => [frame.frameIndex, frame]));
  const rawVisualSegments = groupVisualTextSegments(frames);
  const visualSegments = await addSegmentCrops(
    scanId,
    jobDir,
    rawVisualSegments,
    framePathByIndex,
  );
  const spellingErrorsBySegmentId = buildSpellingErrorsBySegment(visualSegments);
  const deterministicErrors = [
    ...detectAlignmentIssues({
      visualSegments,
      transcript,
      spellingErrorsBySegmentId,
      framesByIndex,
    }),
    ...buildUnreadableIssues(visualSegments, framesByIndex),
  ];

  const canRunEvidenceJudge =
    Boolean(openRouterApiKey) && !degraded && transcript.words.length > 0;
  const judged = canRunEvidenceJudge
    ? await judgeCandidateIssues(
        deterministicErrors,
        transcript,
        visualSegments,
        openRouterApiKey,
      )
    : {
        errors: deterministicErrors,
        aiJudge: makeSkippedJudge(
          transcript.words.length === 0
            ? 'Transcript unavailable'
            : 'Transcript checks unavailable',
        ),
      };

  const finalFrames = attachErrorsToFrames(frames, judged.errors);
  const summary = buildVideoErrorSummary(judged.errors);

  return {
    type: 'video',
    fileName,
    scanDate: new Date().toLocaleString(),
    analysisSource: mode === 'audio_aware' && !degraded ? 'server_audio' : 'server_visual',
    analysisNote: notes.join(' '),
    scanCompleteness: {
      mode,
      degraded,
      notes,
      transcriptionProviders,
      consensusConfidence,
      aiJudge: judged.aiJudge,
    },
    totalErrors: judged.errors.length,
    frames: finalFrames,
    transcript,
    videoErrorSummary: summary,
  };
}

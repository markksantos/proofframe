import type {
  FrameResult,
  TranscriptResult,
  TranscriptSegment,
  TextSegment,
  VideoError,
  VideoErrorSummary,
} from '../types/index.ts';
import { levenshteinSimilarity } from './frame-dedup.ts';
import { checkWords } from './spell-checker.ts';

/**
 * Normalizes text for comparison: lowercase, collapse whitespace,
 * strip leading/trailing punctuation.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks whether two time ranges overlap, with a tolerance buffer.
 */
function timeOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
  tolerance = 2,
): number {
  const overlapStart = Math.max(aStart - tolerance, bStart);
  const overlapEnd = Math.min(aEnd + tolerance, bEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Builds text segments by grouping consecutive frames with similar OCR text.
 * Uses Levenshtein similarity >= 0.7 to merge frames into segments.
 */
function buildTextSegments(frames: FrameResult[]): TextSegment[] {
  if (frames.length === 0) return [];

  const segments: TextSegment[] = [];
  let currentText = frames[0].ocrResult.text;
  let startTime = frames[0].timestamp;
  let frameIndices = [frames[0].frameIndex];
  let ocrWords = [...frames[0].ocrResult.words];

  for (let i = 1; i < frames.length; i++) {
    const frame = frames[i];
    const similarity = levenshteinSimilarity(
      normalize(currentText),
      normalize(frame.ocrResult.text),
    );

    if (similarity >= 0.7) {
      // Same text segment — extend it
      frameIndices.push(frame.frameIndex);
      // Keep the longest version of the text
      if (frame.ocrResult.text.length > currentText.length) {
        currentText = frame.ocrResult.text;
        ocrWords = [...frame.ocrResult.words];
      }
    } else {
      // New text segment — flush current
      segments.push({
        text: currentText,
        startTime,
        endTime: frames[i - 1].timestamp + 1, // +1 since frames are 1fps snapshots
        frameIndices,
        ocrWords,
      });
      currentText = frame.ocrResult.text;
      startTime = frame.timestamp;
      frameIndices = [frame.frameIndex];
      ocrWords = [...frame.ocrResult.words];
    }
  }

  // Flush remaining
  segments.push({
    text: currentText,
    startTime,
    endTime: frames[frames.length - 1].timestamp + 1,
    frameIndices,
    ocrWords,
  });

  return segments;
}

/**
 * Finds the best-matching transcript segment for a given text segment.
 * Score = 0.7 * text similarity + 0.3 * temporal overlap ratio.
 */
function findBestMatch(
  textSeg: TextSegment,
  transcriptSegments: TranscriptSegment[],
): { segment: TranscriptSegment; score: number; offset: number } | null {
  let bestMatch: TranscriptSegment | null = null;
  let bestScore = 0;
  let bestOffset = 0;

  const normalizedOcr = normalize(textSeg.text);
  const textDuration = textSeg.endTime - textSeg.startTime;

  for (const tSeg of transcriptSegments) {
    const normalizedTranscript = normalize(tSeg.text);
    const textSim = levenshteinSimilarity(normalizedOcr, normalizedTranscript);

    const overlap = timeOverlap(
      textSeg.startTime,
      textSeg.endTime,
      tSeg.startTime,
      tSeg.endTime,
    );
    const maxDuration = Math.max(textDuration, tSeg.endTime - tSeg.startTime, 1);
    const overlapRatio = overlap / maxDuration;

    const score = 0.7 * textSim + 0.3 * overlapRatio;

    if (score > bestScore) {
      bestScore = score;
      bestMatch = tSeg;
      const textMid = (textSeg.startTime + textSeg.endTime) / 2;
      const speechMid = (tSeg.startTime + tSeg.endTime) / 2;
      bestOffset = textMid - speechMid;
    }
  }

  if (!bestMatch || bestScore < 0.2) return null;
  return { segment: bestMatch, score: bestScore, offset: bestOffset };
}

/**
 * Analyzes video frames against a transcript to detect errors.
 *
 * Error types:
 * - mismatch: on-screen text differs from spoken words
 * - timing: text appears too early or late vs speech
 * - missing_caption: speech with no on-screen text
 * - spelling: dictionary errors in text
 *
 * @returns Frames with `videoErrors` populated, plus a summary
 */
export function analyzeVideoErrors(
  frames: FrameResult[],
  transcript: TranscriptResult,
): { frames: FrameResult[]; summary: VideoErrorSummary } {
  const summary: VideoErrorSummary = {
    mismatches: 0,
    spelling: 0,
    missingCaptions: 0,
    timing: 0,
  };

  // Initialize videoErrors on all frames
  const updatedFrames = frames.map((f) => ({ ...f, videoErrors: [] as VideoError[] }));
  const frameMap = new Map(updatedFrames.map((f) => [f.frameIndex, f]));

  const textSegments = buildTextSegments(frames);
  const hasTranscript = transcript.words.length > 0;

  if (hasTranscript) {
    // --- 1. Align text segments with transcript and detect mismatches/timing ---
    const matchedTranscriptSegments = new Set<TranscriptSegment>();

    for (const textSeg of textSegments) {
      const match = findBestMatch(textSeg, transcript.segments);

      if (match) {
        matchedTranscriptSegments.add(match.segment);
        const normalizedOcr = normalize(textSeg.text);
        const normalizedSpeech = normalize(match.segment.text);
        const similarity = levenshteinSimilarity(normalizedOcr, normalizedSpeech);

        // Mismatch detection
        if (similarity < 0.65) {
          for (const fi of textSeg.frameIndices) {
            const frame = frameMap.get(fi);
            if (frame) {
              const error: VideoError = {
                type: 'mismatch',
                severity: 'error',
                message: `On-screen text doesn't match spoken words (${Math.round(similarity * 100)}% similar)`,
                frameIndex: fi,
                timestamp: frame.timestamp,
                onScreenText: textSeg.text,
                spokenText: match.segment.text,
                similarity,
              };
              frame.videoErrors!.push(error);
              summary.mismatches++;
            }
          }
        }

        // Timing detection
        if (Math.abs(match.offset) > 2) {
          for (const fi of textSeg.frameIndices) {
            const frame = frameMap.get(fi);
            if (frame) {
              const direction = match.offset > 0 ? 'late' : 'early';
              const error: VideoError = {
                type: 'timing',
                severity: 'warning',
                message: `Text appears ${Math.abs(match.offset).toFixed(1)}s ${direction} compared to speech`,
                frameIndex: fi,
                timestamp: frame.timestamp,
                onScreenText: textSeg.text,
                spokenText: match.segment.text,
                textTime: { start: textSeg.startTime, end: textSeg.endTime },
                speechTime: { start: match.segment.startTime, end: match.segment.endTime },
                offsetSeconds: match.offset,
              };
              frame.videoErrors!.push(error);
              summary.timing++;
            }
          }
        }
      }
    }

    // --- 2. Detect missing captions ---
    for (const tSeg of transcript.segments) {
      if (matchedTranscriptSegments.has(tSeg)) continue;
      if (tSeg.words.length < 3) continue; // Skip very short speech

      // Find which frame is closest to this speech
      const speechMid = (tSeg.startTime + tSeg.endTime) / 2;
      let closestFrame = updatedFrames[0];
      let closestDist = Infinity;
      for (const frame of updatedFrames) {
        const dist = Math.abs(frame.timestamp - speechMid);
        if (dist < closestDist) {
          closestDist = dist;
          closestFrame = frame;
        }
      }

      const error: VideoError = {
        type: 'missing_caption',
        severity: 'warning',
        message: `Speech detected with no matching on-screen text`,
        frameIndex: closestFrame.frameIndex,
        timestamp: closestFrame.timestamp,
        spokenText: tSeg.text,
        speechTime: { start: tSeg.startTime, end: tSeg.endTime },
      };
      closestFrame.videoErrors!.push(error);
      summary.missingCaptions++;
    }
  }

  // --- 3. Spell check all on-screen text ---
  // Assign spelling errors only to the first frame of each segment to avoid inflation
  for (const textSeg of textSegments) {
    const spellingErrors = checkWords(textSeg.ocrWords);
    const firstFrameIndex = textSeg.frameIndices[0];
    const frame = frameMap.get(firstFrameIndex);
    if (!frame) continue;
    for (const se of spellingErrors) {
      const error: VideoError = {
        type: 'spelling',
        severity: 'error',
        message: `"${se.word}" may be misspelled`,
        frameIndex: firstFrameIndex,
        timestamp: frame.timestamp,
        onScreenText: se.word,
        spellingError: se,
        bbox: se.bbox,
      };
      frame.videoErrors!.push(error);
      summary.spelling++;
    }
  }

  return { frames: updatedFrames, summary };
}

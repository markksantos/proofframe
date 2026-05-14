import type {
  BoundingBox,
  FrameResult,
  OCRWord,
  ProviderStatus,
  SpellingError,
  TranscriptResult,
  TranscriptSegment,
  TranscriptWord,
  VideoError,
  VideoErrorSummary,
  VisualTextSegment,
} from '../types/index.ts';
import { levenshteinSimilarity } from './frame-dedup.ts';

export interface ProviderTranscript {
  provider: string;
  text: string;
  words: TranscriptWord[];
  segments?: TranscriptSegment[];
  confidence?: number;
}

export interface ConsensusTranscriptResult {
  transcript: TranscriptResult;
  confidence: number;
  providers: ProviderStatus[];
  disagreements: TranscriptSegment[];
}

export interface AlignmentIssueInput {
  visualSegments: VisualTextSegment[];
  transcript: TranscriptResult;
  spellingErrorsBySegmentId: Map<string, SpellingError[]>;
  framesByIndex: Map<number, FrameResult>;
}

const TEXT_MATCH_THRESHOLD = 0.66;
const MISMATCH_THRESHOLD = 0.42;
const TIMING_THRESHOLD_SECONDS = 1.25;
const VISUAL_SEGMENT_GAP_SECONDS = 1.25;

export function normalizeProofText(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getNormalizedWords(text: string): string[] {
  return normalizeProofText(text).split(' ').filter(Boolean);
}

function isMeaningfulAlphaWord(word: string): boolean {
  return /^[a-z]+$/.test(word) && word.length >= 3;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function wordHeight(word: OCRWord): number {
  return Math.max(0, word.bbox.y1 - word.bbox.y0);
}

function wordCenterY(word: OCRWord): number {
  return (word.bbox.y0 + word.bbox.y1) / 2;
}

function estimateFrameBounds(words: OCRWord[]): { width: number; height: number } {
  return {
    width: Math.max(1, ...words.map((word) => word.bbox.x1)),
    height: Math.max(1, ...words.map((word) => word.bbox.y1)),
  };
}

function segmentFrameBounds(segment: VisualTextSegment): {
  width: number;
  height: number;
} {
  const estimated = estimateFrameBounds(segment.ocrWords);
  return {
    width: segment.frameWidth ?? segment.bbox?.x1 ?? estimated.width,
    height: segment.frameHeight ?? segment.bbox?.y1 ?? estimated.height,
  };
}

export function shouldSpellCheckVisualSegment(
  segment: VisualTextSegment,
): boolean {
  const normalizedWords = getNormalizedWords(segment.text);
  const meaningfulWords = normalizedWords.filter(isMeaningfulAlphaWord);
  const bbox = segment.bbox ?? unionBoundingBox(segment.ocrWords);

  if (meaningfulWords.length === 0) return false;
  if (!bbox) return false;

  const { width: frameWidth } = segmentFrameBounds(segment);
  const boxWidth = Math.max(0, bbox.x1 - bbox.x0);
  const boxHeight = Math.max(0, bbox.y1 - bbox.y0);
  const centerYRatio = getSegmentCenterYRatio(segment);
  const medianWordHeight = median(segment.ocrWords.map(wordHeight));
  const sourceFrameWordCount =
    segment.sourceFrameWordCount ?? segment.ocrWords.length;
  const sourceFrameMedianWordHeight =
    segment.sourceFrameMedianWordHeight ?? medianWordHeight;
  const sourceLineWordCount =
    segment.sourceLineWordCount ?? normalizedWords.length;
  const nearbyWordCount = segment.nearbyWordCount ?? 0;
  const relativeFontScale =
    sourceFrameMedianWordHeight > 0
      ? medianWordHeight / sourceFrameMedianWordHeight
      : 1;
  const meaningfulRatio = meaningfulWords.length / normalizedWords.length;
  const alphaCharacters = segment.text.match(/[A-Za-z]/g) ?? [];
  const uppercaseCharacters = segment.text.match(/[A-Z]/g) ?? [];
  const uppercaseRatio =
    alphaCharacters.length > 0
      ? uppercaseCharacters.length / alphaCharacters.length
      : 0;

  if (normalizedWords.length > 12) return false;
  if (boxHeight < 20 || medianWordHeight < 18) return false;
  if (boxWidth < Math.max(80, frameWidth * 0.08)) return false;

  const cleanPhrase =
    (segment.confidence ?? 0) >= 85 &&
    meaningfulWords.length >= 2 &&
    meaningfulRatio >= 0.65;
  const stablePhrase =
    segment.frameIndices.length >= 2 &&
    meaningfulWords.length >= 2 &&
    meaningfulRatio >= 0.6;
  const uppercaseCaption =
    alphaCharacters.length >= 4 &&
    uppercaseRatio >= 0.55 &&
    meaningfulWords.length >= 2 &&
    meaningfulWords.length <= 8;

  const hasProofableText = cleanPhrase || stablePhrase || uppercaseCaption;
  if (!hasProofableText) return false;

  const wideOverlay = boxWidth >= frameWidth * 0.18;
  const dominantOverlay =
    boxWidth >= frameWidth * 0.28 ||
    (boxWidth >= frameWidth * 0.18 &&
      medianWordHeight >= Math.max(32, sourceFrameMedianWordHeight * 2.2)) ||
    (boxWidth >= frameWidth * 0.22 && uppercaseRatio >= 0.7);
  const strongOverlayFont =
    medianWordHeight >= 24 &&
    relativeFontScale >= 1.45 &&
    boxWidth >= frameWidth * 0.14;
  const isolatedPhrase =
    nearbyWordCount <= 5 && sourceLineWordCount <= normalizedWords.length + 3;

  if (sourceFrameWordCount >= 80) {
    if (centerYRatio < 0.12 && boxHeight < 48) return false;
    if (segment.frameIndices.length < 2 && nearbyWordCount >= 3) return false;

    const smallEmbeddedPhrase =
      boxWidth < frameWidth * 0.16 &&
      uppercaseRatio < 0.55;
    const denseLine =
      sourceLineWordCount >= normalizedWords.length + 4 &&
      nearbyWordCount >= 8;

    if (!dominantOverlay) return false;
    if (smallEmbeddedPhrase) return false;
    if (denseLine && !wideOverlay && !strongOverlayFont && !isolatedPhrase) {
      return false;
    }
  }

  return true;
}

export function formatTimeRange(startTime: number, endTime: number): string {
  return `${startTime.toFixed(1)}s-${endTime.toFixed(1)}s`;
}

export function groupTranscriptWords(
  words: TranscriptWord[],
  maxGapSeconds = 0.65,
): TranscriptSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let current: TranscriptWord[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const previous = words[i - 1];
    const word = words[i];
    if (word.startTime - previous.endTime > maxGapSeconds) {
      segments.push(wordsToSegment(current));
      current = [];
    }
    current.push(word);
  }

  if (current.length > 0) {
    segments.push(wordsToSegment(current));
  }

  return segments;
}

function wordsToSegment(words: TranscriptWord[]): TranscriptSegment {
  return {
    text: words.map((word) => word.text).join(' '),
    startTime: words[0].startTime,
    endTime: words[words.length - 1].endTime,
    words,
  };
}

function getAverageWordConfidence(words: TranscriptWord[]): number {
  const confidenceValues = words
    .map((word) => word.confidence)
    .filter((confidence): confidence is number => typeof confidence === 'number');

  if (confidenceValues.length === 0) return 0.7;

  return (
    confidenceValues.reduce((sum, confidence) => sum + confidence, 0) /
    confidenceValues.length
  );
}

function tokenSimilarity(a: string, b: string): number {
  const normalizedA = normalizeProofText(a);
  const normalizedB = normalizeProofText(b);
  if (!normalizedA || !normalizedB) return 0;
  if (normalizedA === normalizedB) return 1;
  return levenshteinSimilarity(normalizedA, normalizedB);
}

function findAlignedWord(
  target: TranscriptWord,
  candidateWords: TranscriptWord[],
): TranscriptWord | null {
  let bestWord: TranscriptWord | null = null;
  let bestScore = 0;

  for (const candidate of candidateWords) {
    const timeDistance = Math.abs(candidate.startTime - target.startTime);
    if (timeDistance > 1.25) continue;

    const textScore = tokenSimilarity(target.text, candidate.text);
    const timeScore = Math.max(0, 1 - timeDistance / 1.25);
    const score = textScore * 0.75 + timeScore * 0.25;

    if (score > bestScore) {
      bestScore = score;
      bestWord = candidate;
    }
  }

  return bestScore >= 0.62 ? bestWord : null;
}

function chooseBaseTranscript(transcripts: ProviderTranscript[]): ProviderTranscript {
  return [...transcripts].sort((a, b) => {
    const aScore = a.words.length * 2 + (a.confidence ?? 0.7);
    const bScore = b.words.length * 2 + (b.confidence ?? 0.7);
    return bScore - aScore;
  })[0];
}

export function buildConsensusTranscript(
  transcripts: ProviderTranscript[],
): ConsensusTranscriptResult {
  const providers: ProviderStatus[] = transcripts.map((transcript) => ({
    name: transcript.provider,
    status: 'success',
    confidence: transcript.confidence,
    wordCount: transcript.words.length,
  }));

  if (transcripts.length === 0) {
    return {
      transcript: { text: '', segments: [], words: [] },
      confidence: 0,
      providers,
      disagreements: [],
    };
  }

  const base = chooseBaseTranscript(transcripts);
  const otherTranscripts = transcripts.filter((transcript) => transcript !== base);
  const consensusWords: TranscriptWord[] = [];
  const disagreementWords: TranscriptWord[] = [];
  let confidenceSum = 0;

  for (const baseWord of base.words) {
    const votes = [baseWord];

    for (const transcript of otherTranscripts) {
      const aligned = findAlignedWord(baseWord, transcript.words);
      if (aligned) votes.push(aligned);
    }

    const voteGroups = new Map<string, TranscriptWord[]>();
    for (const vote of votes) {
      const key = normalizeProofText(vote.text);
      if (!key) continue;
      voteGroups.set(key, [...(voteGroups.get(key) ?? []), vote]);
    }

    const sortedGroups = [...voteGroups.entries()].sort((a, b) => {
      if (b[1].length !== a[1].length) return b[1].length - a[1].length;
      return getAverageWordConfidence(b[1]) - getAverageWordConfidence(a[1]);
    });

    const [, winningVotes] = sortedGroups[0] ?? [normalizeProofText(baseWord.text), [baseWord]];
    const agreementRatio = winningVotes.length / transcripts.length;
    const averageConfidence = getAverageWordConfidence(winningVotes);
    const confidence = Math.min(1, agreementRatio * 0.75 + averageConfidence * 0.25);
    const representative = winningVotes[0];

    consensusWords.push({
      text: representative.text.trim(),
      startTime:
        winningVotes.reduce((sum, word) => sum + word.startTime, 0) /
        winningVotes.length,
      endTime:
        winningVotes.reduce((sum, word) => sum + word.endTime, 0) /
        winningVotes.length,
      confidence,
    });

    confidenceSum += confidence;

    if (agreementRatio < 0.67) {
      disagreementWords.push(baseWord);
    }
  }

  const segments = groupTranscriptWords(consensusWords);
  const text = consensusWords.map((word) => word.text).join(' ');
  const disagreements = groupTranscriptWords(disagreementWords);
  const confidence =
    consensusWords.length > 0 ? confidenceSum / consensusWords.length : 0;

  return {
    transcript: { text, segments, words: consensusWords },
    confidence,
    providers,
    disagreements,
  };
}

function wordArea(word: OCRWord): number {
  return Math.max(0, word.bbox.x1 - word.bbox.x0) * Math.max(0, word.bbox.y1 - word.bbox.y0);
}

function isEvidenceWord(word: OCRWord): boolean {
  return word.confidence >= 50 && wordArea(word) >= 80 && normalizeProofText(word.text).length > 0;
}

function unionBoundingBox(words: OCRWord[]): BoundingBox | undefined {
  if (words.length === 0) return undefined;

  return {
    x0: Math.min(...words.map((word) => word.bbox.x0)),
    y0: Math.min(...words.map((word) => word.bbox.y0)),
    x1: Math.max(...words.map((word) => word.bbox.x1)),
    y1: Math.max(...words.map((word) => word.bbox.y1)),
  };
}

function getWordsConfidence(words: OCRWord[]): number {
  if (words.length === 0) return 0;

  return (
    words.reduce((sum, word) => sum + word.confidence, 0) /
    words.length
  );
}

function getWordsText(words: OCRWord[]): string {
  return words.map((word) => word.text).join(' ').trim();
}

function getSegmentCenterYRatio(segment: VisualTextSegment): number {
  const bbox = segment.bbox ?? unionBoundingBox(segment.ocrWords);
  if (!bbox) return 0;
  const { height } = segmentFrameBounds(segment);
  return ((bbox.y0 + bbox.y1) / 2) / height;
}

interface LinePhraseCandidate {
  words: OCRWord[];
  sourceFrameWordCount: number;
  sourceFrameMedianWordHeight: number;
  sourceLineWordCount: number;
  nearbyWordCount: number;
}

function boxesIntersect(a: BoundingBox, b: BoundingBox): boolean {
  return a.x0 <= b.x1 && a.x1 >= b.x0 && a.y0 <= b.y1 && a.y1 >= b.y0;
}

function expandBoundingBox(bbox: BoundingBox, paddingX: number, paddingY: number): BoundingBox {
  return {
    x0: bbox.x0 - paddingX,
    y0: bbox.y0 - paddingY,
    x1: bbox.x1 + paddingX,
    y1: bbox.y1 + paddingY,
  };
}

function countNearbyWords(
  allWords: OCRWord[],
  phraseWords: OCRWord[],
  phraseBbox: BoundingBox,
): number {
  const phraseWordSet = new Set(phraseWords);
  const phraseHeight = Math.max(1, phraseBbox.y1 - phraseBbox.y0);
  const expanded = expandBoundingBox(
    phraseBbox,
    Math.max(60, phraseHeight * 2),
    Math.max(20, phraseHeight * 1.5),
  );

  return allWords.filter(
    (word) => !phraseWordSet.has(word) && boxesIntersect(word.bbox, expanded),
  ).length;
}

function groupWordsIntoLinePhrases(words: OCRWord[]): LinePhraseCandidate[] {
  const evidenceWords = words.filter(isEvidenceWord);
  if (evidenceWords.length === 0) return [];

  const sourceFrameMedianWordHeight = median(evidenceWords.map(wordHeight));
  const sortedByY = [...evidenceWords].sort((a, b) => {
    const yDiff = wordCenterY(a) - wordCenterY(b);
    return Math.abs(yDiff) > 1 ? yDiff : a.bbox.x0 - b.bbox.x0;
  });
  const lines: OCRWord[][] = [];

  for (const word of sortedByY) {
    const matchingLine = lines.find((line) => {
      const lineCenter = median(line.map(wordCenterY));
      const lineHeight = median(line.map(wordHeight));
      const tolerance = Math.max(12, Math.max(lineHeight, wordHeight(word)) * 0.72);
      return Math.abs(wordCenterY(word) - lineCenter) <= tolerance;
    });

    if (matchingLine) {
      matchingLine.push(word);
    } else {
      lines.push([word]);
    }
  }

  const phrases: LinePhraseCandidate[] = [];

  for (const line of lines) {
    const sortedLine = [...line].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    const lineHeight = Math.max(1, median(sortedLine.map(wordHeight)));
    const maxGap = Math.max(70, lineHeight * 4);
    let phrase: OCRWord[] = [];
    let previous: OCRWord | null = null;

    for (const word of sortedLine) {
      const gap = previous ? word.bbox.x0 - previous.bbox.x1 : 0;
      if (previous && gap > maxGap && phrase.length > 0) {
        const phraseBbox = unionBoundingBox(phrase);
        if (phraseBbox) {
          phrases.push({
            words: phrase,
            sourceFrameWordCount: evidenceWords.length,
            sourceFrameMedianWordHeight,
            sourceLineWordCount: sortedLine.length,
            nearbyWordCount: countNearbyWords(evidenceWords, phrase, phraseBbox),
          });
        }
        phrase = [];
      }

      phrase.push(word);
      previous = word;
    }

    if (phrase.length > 0) {
      const phraseBbox = unionBoundingBox(phrase);
      if (phraseBbox) {
        phrases.push({
          words: phrase,
          sourceFrameWordCount: evidenceWords.length,
          sourceFrameMedianWordHeight,
          sourceLineWordCount: sortedLine.length,
          nearbyWordCount: countNearbyWords(evidenceWords, phrase, phraseBbox),
        });
      }
    }
  }

  return phrases.filter((phrase) => {
    const normalizedWords = getNormalizedWords(getWordsText(phrase.words));
    return normalizedWords.some(isMeaningfulAlphaWord);
  });
}

function wordsToVisualSegment(
  phrase: LinePhraseCandidate,
  frame: FrameResult,
  segmentId: string,
  frameBounds: { width: number; height: number },
): VisualTextSegment {
  return {
    id: segmentId,
    text: getWordsText(phrase.words),
    startTime: frame.timestamp,
    endTime: frame.timestamp,
    frameIndices: [frame.frameIndex],
    ocrWords: phrase.words,
    representativeFrameIndex: frame.frameIndex,
    representativeFrameUrl: frame.thumbnailUrl,
    bbox: unionBoundingBox(phrase.words),
    confidence: getWordsConfidence(phrase.words),
    frameWidth: frameBounds.width,
    frameHeight: frameBounds.height,
    sourceFrameWordCount: phrase.sourceFrameWordCount,
    sourceFrameMedianWordHeight: phrase.sourceFrameMedianWordHeight,
    sourceLineWordCount: phrase.sourceLineWordCount,
    nearbyWordCount: phrase.nearbyWordCount,
  };
}

function shouldMergeIntoSegment(
  active: VisualTextSegment,
  candidate: VisualTextSegment,
  activeLastTimestamp: number,
): boolean {
  if (!active.text || !candidate.text) return false;
  if (candidate.startTime - activeLastTimestamp > VISUAL_SEGMENT_GAP_SECONDS) {
    return false;
  }

  const yDistance = Math.abs(
    getSegmentCenterYRatio(active) - getSegmentCenterYRatio(candidate),
  );
  if (yDistance > 0.08) return false;

  return (
    levenshteinSimilarity(
      normalizeProofText(active.text),
      normalizeProofText(candidate.text),
    ) >= 0.72
  );
}

export function groupVisualTextSegments(frames: FrameResult[]): VisualTextSegment[] {
  const segments: VisualTextSegment[] = [];
  const activeSegments: Array<{
    segment: VisualTextSegment;
    lastTimestamp: number;
  }> = [];
  let segmentCounter = 0;

  for (const frame of frames) {
    for (let i = activeSegments.length - 1; i >= 0; i--) {
      if (
        frame.timestamp - activeSegments[i].lastTimestamp >
        VISUAL_SEGMENT_GAP_SECONDS
      ) {
        segments.push(activeSegments[i].segment);
        activeSegments.splice(i, 1);
      }
    }

    const frameBounds = estimateFrameBounds(frame.ocrResult.words);
    const candidates = groupWordsIntoLinePhrases(frame.ocrResult.words).map(
      (phrase) =>
        wordsToVisualSegment(
          phrase,
          frame,
          `text-${segmentCounter++}`,
          frameBounds,
        ),
    );

    const matchedActiveIndexes = new Set<number>();

    for (const candidate of candidates) {
      let bestIndex = -1;
      let bestSimilarity = 0;

      for (let i = 0; i < activeSegments.length; i++) {
        if (matchedActiveIndexes.has(i)) continue;
        const active = activeSegments[i];
        if (!shouldMergeIntoSegment(active.segment, candidate, active.lastTimestamp)) {
          continue;
        }

        const similarity = levenshteinSimilarity(
          normalizeProofText(active.segment.text),
          normalizeProofText(candidate.text),
        );
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        const active = activeSegments[bestIndex];
        active.segment.endTime = frame.timestamp;
        active.segment.frameIndices.push(frame.frameIndex);
        active.lastTimestamp = frame.timestamp;
        matchedActiveIndexes.add(bestIndex);

        if (
          (active.segment.confidence ?? 0) < (candidate.confidence ?? 0) ||
          candidate.text.length > active.segment.text.length
        ) {
          active.segment.text = candidate.text;
          active.segment.ocrWords = candidate.ocrWords;
          active.segment.representativeFrameIndex = candidate.representativeFrameIndex;
          active.segment.representativeFrameUrl = candidate.representativeFrameUrl;
          active.segment.bbox = candidate.bbox;
          active.segment.confidence = candidate.confidence;
          active.segment.frameWidth = candidate.frameWidth;
          active.segment.frameHeight = candidate.frameHeight;
          active.segment.sourceFrameWordCount = candidate.sourceFrameWordCount;
          active.segment.sourceFrameMedianWordHeight =
            candidate.sourceFrameMedianWordHeight;
          active.segment.sourceLineWordCount = candidate.sourceLineWordCount;
          active.segment.nearbyWordCount = candidate.nearbyWordCount;
        }
      } else {
        activeSegments.push({
          segment: candidate,
          lastTimestamp: frame.timestamp,
        });
      }
    }
  }

  segments.push(...activeSegments.map((active) => active.segment));

  return segments.map((segment) => ({
    ...segment,
    endTime:
      segment.endTime <= segment.startTime
        ? segment.startTime + 0.25
        : segment.endTime,
  }));
}

function wordsInWindow(
  transcript: TranscriptResult,
  startTime: number,
  endTime: number,
  paddingSeconds: number,
): TranscriptWord[] {
  return transcript.words.filter(
    (word) =>
      word.endTime >= startTime - paddingSeconds &&
      word.startTime <= endTime + paddingSeconds,
  );
}

function findBestTranscriptSegment(
  visualSegment: VisualTextSegment,
  transcript: TranscriptResult,
): { segment: TranscriptSegment; similarity: number; offsetSeconds: number } | null {
  let best:
    | { segment: TranscriptSegment; similarity: number; offsetSeconds: number }
    | null = null;

  const visualText = normalizeProofText(visualSegment.text);
  const visualMid = (visualSegment.startTime + visualSegment.endTime) / 2;

  for (const segment of transcript.segments) {
    if (segment.endTime < visualSegment.startTime - 4) continue;
    if (segment.startTime > visualSegment.endTime + 4) continue;

    const similarity = levenshteinSimilarity(
      visualText,
      normalizeProofText(segment.text),
    );
    const speechMid = (segment.startTime + segment.endTime) / 2;
    const offsetSeconds = visualMid - speechMid;

    if (!best || similarity > best.similarity) {
      best = { segment, similarity, offsetSeconds };
    }
  }

  return best;
}

function containsSignificantPhrase(haystack: string, needle: string): boolean {
  const normalizedHaystack = normalizeProofText(haystack);
  const normalizedNeedle = normalizeProofText(needle);
  const needleWords = normalizedNeedle.split(' ').filter(Boolean);

  return (
    needleWords.length >= 2 &&
    normalizedNeedle.length >= 6 &&
    normalizedHaystack.includes(normalizedNeedle)
  );
}

function shouldCompareVisualSegmentToTranscript(segment: VisualTextSegment): boolean {
  if (!shouldSpellCheckVisualSegment(segment)) return false;

  const bbox = segment.bbox ?? unionBoundingBox(segment.ocrWords);
  if (!bbox) return false;

  const { width: frameWidth } = segmentFrameBounds(segment);
  const centerYRatio = getSegmentCenterYRatio(segment);
  const widthRatio = Math.max(0, bbox.x1 - bbox.x0) / frameWidth;
  const wordCount = getNormalizedWords(segment.text).length;

  if (wordCount < 2 || wordCount > 12) return false;

  return centerYRatio >= 0.42 && centerYRatio <= 0.94 && widthRatio >= 0.14;
}

function getRepresentativeFrame(
  framesByIndex: Map<number, FrameResult>,
  visualSegment: VisualTextSegment,
): FrameResult | undefined {
  return framesByIndex.get(
    visualSegment.representativeFrameIndex ?? visualSegment.frameIndices[0],
  );
}

export function buildVideoErrorSummary(errors: VideoError[]): VideoErrorSummary {
  return {
    mismatches: errors.filter((error) => error.type === 'mismatch').length,
    spelling: errors.filter((error) => error.type === 'spelling').length,
    missingCaptions: errors.filter((error) => error.type === 'missing_caption').length,
    timing: errors.filter((error) => error.type === 'timing').length,
    unreadableText: errors.filter((error) => error.type === 'unreadable_text').length,
  };
}

export function detectAlignmentIssues({
  visualSegments,
  transcript,
  spellingErrorsBySegmentId,
  framesByIndex,
}: AlignmentIssueInput): VideoError[] {
  const errors: VideoError[] = [];
  const matchedTranscriptSegments = new Set<TranscriptSegment>();

  for (const visualSegment of visualSegments) {
    if (!shouldSpellCheckVisualSegment(visualSegment)) continue;

    const frame = getRepresentativeFrame(framesByIndex, visualSegment);
    if (!frame) continue;

    for (const spellingError of spellingErrorsBySegmentId.get(visualSegment.id) ?? []) {
      errors.push({
        type: 'spelling',
        severity: 'error',
        message: `"${spellingError.word}" may be misspelled`,
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        onScreenText: spellingError.word,
        textTime: {
          start: visualSegment.startTime,
          end: visualSegment.endTime,
        },
        spellingError,
        bbox: spellingError.bbox,
        confidence: spellingError.confidence / 100,
        evidenceNote: `Visible from ${formatTimeRange(visualSegment.startTime, visualSegment.endTime)}.`,
        artifactUrl: visualSegment.cropUrl ?? visualSegment.representativeFrameUrl,
      });
    }

    if (transcript.words.length === 0) continue;
    if (!shouldCompareVisualSegmentToTranscript(visualSegment)) continue;

    const bestMatch = findBestTranscriptSegment(visualSegment, transcript);
    const transcriptWindowWords = wordsInWindow(
      transcript,
      visualSegment.startTime,
      visualSegment.endTime,
      1.5,
    );
    const transcriptWindowText = transcriptWindowWords.map((word) => word.text).join(' ');
    const windowSimilarity = levenshteinSimilarity(
      normalizeProofText(visualSegment.text),
      normalizeProofText(transcriptWindowText),
    );

    const strongTranscriptMatch =
      bestMatch && bestMatch.similarity >= TEXT_MATCH_THRESHOLD;
    const phraseAppearsNearSpeech = containsSignificantPhrase(
      transcriptWindowText,
      visualSegment.text,
    );

    if (strongTranscriptMatch || phraseAppearsNearSpeech) {
      if (!bestMatch) continue;
      matchedTranscriptSegments.add(bestMatch.segment);

      if (
        strongTranscriptMatch &&
        Math.abs(bestMatch.offsetSeconds) > TIMING_THRESHOLD_SECONDS
      ) {
        errors.push({
          type: 'timing',
          severity: 'warning',
          message: `On-screen text appears ${Math.abs(bestMatch.offsetSeconds).toFixed(1)}s ${bestMatch.offsetSeconds > 0 ? 'late' : 'early'}.`,
          frameIndex: frame.frameIndex,
          timestamp: frame.timestamp,
          onScreenText: visualSegment.text,
          spokenText: bestMatch.segment.text,
          textTime: { start: visualSegment.startTime, end: visualSegment.endTime },
          speechTime: {
            start: bestMatch.segment.startTime,
            end: bestMatch.segment.endTime,
          },
          offsetSeconds: bestMatch.offsetSeconds,
          bbox: visualSegment.bbox,
          confidence: bestMatch.similarity,
          evidenceNote: `Best matching speech is ${formatTimeRange(bestMatch.segment.startTime, bestMatch.segment.endTime)}.`,
          artifactUrl: visualSegment.cropUrl ?? visualSegment.representativeFrameUrl,
        });
      }

      continue;
    }

    if (
      bestMatch &&
      bestMatch.similarity < MISMATCH_THRESHOLD &&
      windowSimilarity < MISMATCH_THRESHOLD &&
      Math.max(bestMatch.similarity, windowSimilarity) >= 0.18 &&
      normalizeProofText(visualSegment.text).split(' ').length >= 2
    ) {
      errors.push({
        type: 'mismatch',
        severity: 'error',
        message: 'On-screen text does not match nearby spoken words.',
        frameIndex: frame.frameIndex,
        timestamp: frame.timestamp,
        onScreenText: visualSegment.text,
        spokenText: transcriptWindowText || bestMatch.segment.text,
        similarity: Math.max(bestMatch.similarity, windowSimilarity),
        textTime: { start: visualSegment.startTime, end: visualSegment.endTime },
        speechTime: {
          start: bestMatch.segment.startTime,
          end: bestMatch.segment.endTime,
        },
        bbox: visualSegment.bbox,
        confidence: 1 - Math.max(bestMatch.similarity, windowSimilarity),
        evidenceNote: `Compared against speech near ${formatTimeRange(visualSegment.startTime, visualSegment.endTime)}.`,
        artifactUrl: visualSegment.cropUrl ?? visualSegment.representativeFrameUrl,
      });
    }
  }

  const captionLikeSegments = visualSegments.filter(
    (segment) =>
      shouldSpellCheckVisualSegment(segment) &&
      normalizeProofText(segment.text).split(' ').length >= 2,
  );
  const hasCaptionPattern = captionLikeSegments.length >= 2;

  if (hasCaptionPattern && transcript.segments.length > 0) {
    for (const segment of transcript.segments) {
      if (matchedTranscriptSegments.has(segment)) continue;
      if (segment.words.length < 3) continue;

      const overlapsVisibleText = captionLikeSegments.some(
        (visualSegment) =>
          visualSegment.startTime <= segment.endTime + 0.5 &&
          visualSegment.endTime >= segment.startTime - 0.5,
      );

      if (overlapsVisibleText) continue;

      const nearestFrame = [...framesByIndex.values()].sort(
        (a, b) =>
          Math.abs(a.timestamp - segment.startTime) -
          Math.abs(b.timestamp - segment.startTime),
      )[0];

      if (!nearestFrame) continue;

      errors.push({
        type: 'missing_caption',
        severity: 'warning',
        message: 'Speech has no matching visible caption in this time range.',
        frameIndex: nearestFrame.frameIndex,
        timestamp: nearestFrame.timestamp,
        spokenText: segment.text,
        speechTime: { start: segment.startTime, end: segment.endTime },
        confidence: 0.7,
        evidenceNote: `Speech detected from ${formatTimeRange(segment.startTime, segment.endTime)}.`,
        artifactUrl: nearestFrame.thumbnailUrl,
      });
    }
  }

  return errors;
}

export function attachErrorsToFrames(
  frames: FrameResult[],
  errors: VideoError[],
): FrameResult[] {
  const errorsByFrame = new Map<number, VideoError[]>();

  for (const error of errors) {
    errorsByFrame.set(error.frameIndex, [
      ...(errorsByFrame.get(error.frameIndex) ?? []),
      error,
    ]);
  }

  return frames.map((frame) => ({
    ...frame,
    videoErrors: errorsByFrame.get(frame.frameIndex) ?? [],
    errors: (errorsByFrame.get(frame.frameIndex) ?? [])
      .filter((error) => error.spellingError)
      .map((error) => error.spellingError!),
  }));
}

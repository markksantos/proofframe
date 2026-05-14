import { describe, expect, it } from 'vitest';
import type {
  FrameResult,
  OCRWord,
  SpellingError,
  TranscriptResult,
  VisualTextSegment,
} from '../src/types/index.ts';
import {
  buildConsensusTranscript,
  detectAlignmentIssues,
  groupVisualTextSegments,
  shouldSpellCheckVisualSegment,
  type ProviderTranscript,
} from '../src/lib/proofing-utils.ts';

function transcript(
  provider: string,
  tokens: Array<[text: string, start: number, end: number, confidence?: number]>,
): ProviderTranscript {
  const words = tokens.map(([text, startTime, endTime, confidence]) => ({
    text,
    startTime,
    endTime,
    confidence,
  }));

  return {
    provider,
    text: words.map((word) => word.text).join(' '),
    words,
    confidence:
      words.reduce((sum, word) => sum + (word.confidence ?? 0.7), 0) /
      words.length,
  };
}

function ocrWord(text: string, x: number, y: number): OCRWord {
  return {
    text,
    confidence: 91,
    bbox: { x0: x, y0: y, x1: x + text.length * 16, y1: y + 30 },
  };
}

function ocrWordAt(
  text: string,
  bbox: OCRWord['bbox'],
  confidence = 91,
): OCRWord {
  return {
    text,
    confidence,
    bbox,
  };
}

function frame(index: number, timestamp: number, words: OCRWord[]): FrameResult {
  return {
    frameIndex: index,
    timestamp,
    thumbnailUrl: `/frame-${index}.jpg`,
    ocrResult: {
      text: words.map((word) => word.text).join(' '),
      confidence: 91,
      words,
    },
    errors: [],
  };
}

function visualSegment(text: string): VisualTextSegment {
  const words = text.split(' ').map((token, index) => ocrWord(token, index * 80, 100));
  return {
    id: 'seg-1',
    text,
    startTime: 0,
    endTime: 1,
    frameIndices: [0, 1],
    representativeFrameIndex: 0,
    representativeFrameUrl: '/frame-0.jpg',
    ocrWords: words,
    bbox: { x0: 0, y0: 100, x1: 220, y1: 130 },
    confidence: 91,
    frameWidth: 260,
    frameHeight: 150,
    sourceFrameWordCount: words.length,
    sourceFrameMedianWordHeight: 30,
    sourceLineWordCount: words.length,
    nearbyWordCount: 0,
  };
}

describe('buildConsensusTranscript', () => {
  it('uses provider agreement to repair a single-provider transcription error', () => {
    const consensus = buildConsensusTranscript([
      transcript('openai', [['hello', 0, 0.4, 0.8], ['wurld', 0.5, 1, 0.6]]),
      transcript('deepgram', [['hello', 0, 0.4, 0.95], ['world', 0.5, 1, 0.95]]),
      transcript('assemblyai', [['hello', 0, 0.4, 0.9], ['world', 0.5, 1, 0.9]]),
    ]);

    expect(consensus.transcript.text).toBe('hello world');
    expect(consensus.confidence).toBeGreaterThan(0.7);
    expect(consensus.providers).toHaveLength(3);
  });
});

describe('groupVisualTextSegments', () => {
  it('groups repeated frame text into one time-ranged segment', () => {
    const segments = groupVisualTextSegments([
      frame(0, 0, [ocrWord('HELLO', 10, 120), ocrWord('WORLD', 100, 120)]),
      frame(1, 0.25, [ocrWord('HELLO', 10, 120), ocrWord('WORLD', 100, 120)]),
      frame(2, 0.5, [ocrWord('HELLO', 10, 120), ocrWord('WORLD', 100, 120)]),
      frame(3, 0.75, [ocrWord('NEXT', 10, 120), ocrWord('TITLE', 100, 120)]),
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0].text).toBe('HELLO WORLD');
    expect(segments[0].frameIndices).toEqual([0, 1, 2]);
  });

  it('keeps caption-like overlay text separate from dense screen-recording UI text', () => {
    const boundary = ocrWordAt('.', { x0: 1078, y0: 1918, x1: 1080, y1: 1920 }, 0);
    const denseUiWords = Array.from({ length: 90 }, (_, index) =>
      ocrWordAt(
        `Row${index}`,
        {
          x0: 40 + (index % 9) * 110,
          y0: 180 + Math.floor(index / 9) * 36,
          x1: 90 + (index % 9) * 110,
          y1: 194 + Math.floor(index / 9) * 36,
        },
        90,
      ),
    );
    const words = [
      boundary,
      ...denseUiWords,
      ocrWordAt('Manchego', { x0: 496, y0: 774, x1: 557, y1: 807 }),
      ocrWordAt('6', { x0: 562, y0: 789, x1: 565, y1: 798 }),
      ocrWordAt('Month', { x0: 573, y0: 774, x1: 609, y1: 807 }),
      ocrWordAt('Dairy', { x0: 823, y0: 773, x1: 874, y1: 807 }),
      ocrWordAt('Cheese', { x0: 999, y0: 788, x1: 1040, y1: 797 }),
      ocrWordAt('FRONT', { x0: 359, y0: 926, x1: 517, y1: 964 }),
      ocrWordAt('END', { x0: 530, y0: 926, x1: 650, y1: 964 }),
      ocrWordAt('ON', { x0: 670, y0: 926, x1: 760, y1: 964 }),
    ];

    const segments = groupVisualTextSegments([frame(24, 5.75, words)]);
    const uiSegment = segments.find((segment) => segment.text.includes('Manchego'));
    const overlaySegment = segments.find((segment) =>
      segment.text.includes('FRONT'),
    );

    expect(uiSegment).toBeDefined();
    expect(overlaySegment).toBeDefined();
    expect(shouldSpellCheckVisualSegment(uiSegment!)).toBe(false);
    expect(shouldSpellCheckVisualSegment(overlaySegment!)).toBe(true);
  });
});

describe('shouldSpellCheckVisualSegment', () => {
  it('skips one-frame partial caption fragments from noisy OCR', () => {
    expect(
      shouldSpellCheckVisualSegment({
        id: 'seg-partial',
        text: 'al ad y f A y 3 Ame 3',
        startTime: 0.75,
        endTime: 1,
        frameIndices: [3],
        representativeFrameIndex: 3,
        ocrWords: [],
        confidence: 72,
      }),
    ).toBe(false);
  });

  it('keeps stable repeated typo text eligible for spell checking', () => {
    expect(shouldSpellCheckVisualSegment(visualSegment('SALEE TODAY'))).toBe(true);
  });

  it('keeps a clean high-confidence one-frame phrase eligible', () => {
    expect(
      shouldSpellCheckVisualSegment({
        ...visualSegment('SALEE TODAY'),
        frameIndices: [0],
        confidence: 92,
      }),
    ).toBe(true);
  });

  it('keeps intentionally edited title text eligible even away from caption position', () => {
    expect(
      shouldSpellCheckVisualSegment({
        ...visualSegment('THREE TIPS'),
        bbox: { x0: 120, y0: 80, x1: 420, y1: 126 },
        frameWidth: 1080,
        frameHeight: 1920,
        sourceFrameWordCount: 8,
        sourceFrameMedianWordHeight: 22,
        sourceLineWordCount: 2,
        nearbyWordCount: 0,
      }),
    ).toBe(true);
  });
});

describe('detectAlignmentIssues', () => {
  it('flags mismatched on-screen captions against nearby speech', () => {
    const framesByIndex = new Map([
      [0, frame(0, 0, [ocrWord('BUILD', 10, 100), ocrWord('TOOL', 100, 100)])],
    ]);
    const transcriptResult: TranscriptResult = {
      text: 'hello world',
      words: [
        { text: 'hello', startTime: 0, endTime: 0.4, confidence: 0.9 },
        { text: 'world', startTime: 0.5, endTime: 1, confidence: 0.9 },
      ],
      segments: [
        {
          text: 'hello world',
          startTime: 0,
          endTime: 1,
          words: [
            { text: 'hello', startTime: 0, endTime: 0.4, confidence: 0.9 },
            { text: 'world', startTime: 0.5, endTime: 1, confidence: 0.9 },
          ],
        },
      ],
    };

    const issues = detectAlignmentIssues({
      visualSegments: [visualSegment('BUILD TOOL')],
      transcript: transcriptResult,
      spellingErrorsBySegmentId: new Map(),
      framesByIndex,
    });

    expect(issues.some((issue) => issue.type === 'mismatch')).toBe(true);
  });

  it('does not compare edited title text to speech just because it is on screen', () => {
    const segment = {
      ...visualSegment('THREE TIPS'),
      bbox: { x0: 120, y0: 80, x1: 420, y1: 126 },
      frameWidth: 1080,
      frameHeight: 1920,
      sourceFrameWordCount: 8,
      sourceFrameMedianWordHeight: 22,
      sourceLineWordCount: 2,
      nearbyWordCount: 0,
    };
    const transcriptResult: TranscriptResult = {
      text: 'hello world',
      words: [
        { text: 'hello', startTime: 0, endTime: 0.4, confidence: 0.9 },
        { text: 'world', startTime: 0.5, endTime: 1, confidence: 0.9 },
      ],
      segments: [
        {
          text: 'hello world',
          startTime: 0,
          endTime: 1,
          words: [
            { text: 'hello', startTime: 0, endTime: 0.4, confidence: 0.9 },
            { text: 'world', startTime: 0.5, endTime: 1, confidence: 0.9 },
          ],
        },
      ],
    };

    const issues = detectAlignmentIssues({
      visualSegments: [segment],
      transcript: transcriptResult,
      spellingErrorsBySegmentId: new Map(),
      framesByIndex: new Map([[0, frame(0, 0, segment.ocrWords)]]),
    });

    expect(issues.some((issue) => issue.type === 'mismatch')).toBe(false);
  });

  it('dedupes spelling to the visual segment instead of every frame', () => {
    const segment = visualSegment('SALEE TODAY');
    const spellingError: SpellingError = {
      word: 'SALEE',
      suggestions: ['SALE'],
      confidence: 91,
      bbox: segment.ocrWords[0].bbox,
      frameIndex: 0,
    };

    const issues = detectAlignmentIssues({
      visualSegments: [segment],
      transcript: { text: '', segments: [], words: [] },
      spellingErrorsBySegmentId: new Map([[segment.id, [spellingError]]]),
      framesByIndex: new Map([
        [0, frame(0, 0, segment.ocrWords)],
        [1, frame(1, 0.25, segment.ocrWords)],
      ]),
    });

    expect(issues.filter((issue) => issue.type === 'spelling')).toHaveLength(1);
  });
});

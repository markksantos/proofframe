import type {
  TranscriptResult,
  TranscriptWord,
  TranscriptSegment,
} from '../types/index.ts';

type WhisperPipeline = (
  audio: Float32Array,
  options: Record<string, unknown>,
) => Promise<{
  text: string;
  chunks?: Array<{
    text: string;
    timestamp?: [number | null, number | null];
  }>;
}>;

interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter: () => Promise<unknown>;
  };
}

let transcriber: WhisperPipeline | null = null;

/**
 * Lazily initializes the Whisper transcription pipeline.
 *
 * Downloads the quantized ONNX model (~74MB) on first use.
 * Tries WebGPU first, falls back to WASM.
 *
 * @param onProgress - Optional callback for model download progress (0-100)
 */
export async function initTranscriber(
  onProgress?: (percent: number) => void,
): Promise<void> {
  if (transcriber) return;

  const { pipeline } = await import('@huggingface/transformers');

  const progressCallback = onProgress
    ? (data: unknown) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'progress' in data &&
          typeof data.progress === 'number'
        ) {
          onProgress(Math.round(data.progress));
        }
      }
    : undefined;

  // Try WebGPU first, fall back to WASM
  let device: 'webgpu' | 'wasm' = 'wasm';
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpu = (navigator as NavigatorWithGPU).gpu;
      const adapter = await gpu?.requestAdapter();
      if (adapter) device = 'webgpu';
    } catch {
      // WebGPU not available
    }
  }

  transcriber = (await pipeline(
    'automatic-speech-recognition',
    'onnx-community/whisper-base',
    {
      dtype: 'q8' as never,
      device,
      progress_callback: progressCallback,
    },
  )) as unknown as WhisperPipeline;
}

/**
 * Groups word-level timestamps into segments based on pauses.
 * A new segment starts when the gap between consecutive words exceeds 0.5s.
 */
function groupWordsIntoSegments(words: TranscriptWord[]): TranscriptSegment[] {
  if (words.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentWords: TranscriptWord[] = [words[0]];

  for (let i = 1; i < words.length; i++) {
    const gap = words[i].startTime - words[i - 1].endTime;
    if (gap > 0.5) {
      // Flush current segment
      segments.push({
        text: currentWords.map((w) => w.text).join(' '),
        startTime: currentWords[0].startTime,
        endTime: currentWords[currentWords.length - 1].endTime,
        words: currentWords,
      });
      currentWords = [];
    }
    currentWords.push(words[i]);
  }

  // Flush remaining
  if (currentWords.length > 0) {
    segments.push({
      text: currentWords.map((w) => w.text).join(' '),
      startTime: currentWords[0].startTime,
      endTime: currentWords[currentWords.length - 1].endTime,
      words: currentWords,
    });
  }

  return segments;
}

function buildApproximateWords(
  text: string,
  startTime: number,
  endTime: number,
): TranscriptWord[] {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  const duration = Math.max(0.1, endTime - startTime);
  const step = duration / tokens.length;

  return tokens.map((token, index) => ({
    text: token,
    startTime: startTime + step * index,
    endTime: startTime + step * (index + 1),
  }));
}

function chunksToSegments(
  chunks: Array<{ text: string; timestamp?: [number | null, number | null] }>,
): TranscriptSegment[] {
  return chunks.flatMap((chunk, index) => {
    const [rawStart, rawEnd] = chunk.timestamp ?? [null, null];
    const startTime = typeof rawStart === 'number' ? rawStart : index;
    const endTime =
      typeof rawEnd === 'number' && rawEnd > startTime
        ? rawEnd
        : startTime + 1;
    const words = buildApproximateWords(chunk.text, startTime, endTime);

    if (words.length === 0) return [];

    return {
      text: chunk.text.trim(),
      startTime,
      endTime,
      words,
    };
  });
}

function createTextOnlyTranscript(text: string): TranscriptResult {
  return {
    text: text.trim(),
    segments: [],
    words: [],
  };
}

/**
 * Transcribes audio data using Whisper.
 *
 * Word-level timestamps are ideal, but some browser Whisper exports do not
 * include the cross-attention tensors required for them. In that case, fall
 * back to segment timestamps, then to text-only transcription.
 *
 * @param audioData - 16kHz mono Float32Array audio samples
 * @returns Transcript with the best timestamp detail available
 */
export async function transcribeAudio(
  audioData: Float32Array,
): Promise<TranscriptResult> {
  if (!transcriber) {
    throw new Error(
      'Transcriber not initialized. Call initTranscriber() first.',
    );
  }

  try {
    const result = await transcriber(audioData, {
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    const words: TranscriptWord[] = (result.chunks ?? [])
      .filter(
        (chunk) =>
          typeof chunk.timestamp?.[0] === 'number' &&
          typeof chunk.timestamp?.[1] === 'number',
      )
      .map((chunk) => ({
        text: chunk.text.trim(),
        startTime: chunk.timestamp![0]!,
        endTime: chunk.timestamp![1]!,
      }));

    const segments = groupWordsIntoSegments(words);

    return {
      text: result.text.trim(),
      segments,
      words,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const canFallbackToSegmentTimestamps =
      message.includes('cross attentions') ||
      message.includes('output_attentions') ||
      message.includes('token-level timestamps');

    if (!canFallbackToSegmentTimestamps) {
      throw error;
    }
  }

  try {
    const result = await transcriber(audioData, {
      return_timestamps: true,
      chunk_length_s: 30,
      stride_length_s: 5,
      force_full_sequences: false,
    });
    const segments = chunksToSegments(result.chunks ?? []);
    const words = segments.flatMap((segment) => segment.words);

    return {
      text: result.text.trim(),
      segments,
      words,
    };
  } catch {
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    return createTextOnlyTranscript(result.text);
  }
}

/**
 * Dereferences the Whisper pipeline for garbage collection.
 */
export function terminateTranscriber(): void {
  transcriber = null;
}

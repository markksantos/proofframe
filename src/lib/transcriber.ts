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
  chunks?: Array<{ text: string; timestamp: [number, number] }>;
}>;

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const progressCallback = onProgress
    ? (data: any) => {
        if (typeof data?.progress === 'number') {
          onProgress(Math.round(data.progress));
        }
      }
    : undefined;

  // Try WebGPU first, fall back to WASM
  let device: 'webgpu' | 'wasm' = 'wasm';
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gpu = (navigator as any).gpu;
      const adapter = await gpu.requestAdapter();
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

/**
 * Transcribes audio data using Whisper, returning word-level timestamps.
 *
 * @param audioData - 16kHz mono Float32Array audio samples
 * @returns Transcript with word-level timestamps grouped into segments
 */
export async function transcribeAudio(
  audioData: Float32Array,
): Promise<TranscriptResult> {
  if (!transcriber) {
    throw new Error(
      'Transcriber not initialized. Call initTranscriber() first.',
    );
  }

  const result = await transcriber(audioData, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
  });

  const words: TranscriptWord[] = (result.chunks ?? []).map((chunk) => ({
    text: chunk.text.trim(),
    startTime: chunk.timestamp[0],
    endTime: chunk.timestamp[1],
  }));

  const segments = groupWordsIntoSegments(words);

  return {
    text: result.text.trim(),
    segments,
    words,
  };
}

/**
 * Dereferences the Whisper pipeline for garbage collection.
 */
export function terminateTranscriber(): void {
  transcriber = null;
}

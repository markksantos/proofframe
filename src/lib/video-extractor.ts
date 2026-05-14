import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
const DEFAULT_MAX_FRAMES = 180;
const DEFAULT_MAX_FPS = 2;

interface FrameExtractionPlan {
  fps: number;
  maxFrames: number;
  expectedFrames: number;
}

interface FrameExtractionOptions {
  maxFrames?: number;
  maxFps?: number;
}

async function ensureLoaded(): Promise<void> {
  if (ffmpeg.loaded) return;
  await ffmpeg.load({
    coreURL: await toBlobURL(
      `${FFMPEG_BASE_URL}/ffmpeg-core.js`,
      'text/javascript',
    ),
    wasmURL: await toBlobURL(
      `${FFMPEG_BASE_URL}/ffmpeg-core.wasm`,
      'application/wasm',
    ),
  });
}

function createRunId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

async function getVideoDuration(file: File): Promise<number> {
  if (typeof document === 'undefined') return 0;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };

    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      cleanup();
      resolve(duration);
    };
    video.onerror = () => {
      cleanup();
      resolve(0);
    };
    video.src = url;
  });
}

function loadVideo(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load video metadata.'));
    };

    video.src = url;
  });
}

function seekVideo(video: HTMLVideoElement, timestamp: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - timestamp) < 0.01 && video.readyState >= 2) {
      requestAnimationFrame(() => resolve());
      return;
    }

    const cleanup = () => {
      video.onseeked = null;
      video.onloadeddata = null;
      video.onerror = null;
    };

    video.onseeked = () => {
      cleanup();
      resolve();
    };
    video.onerror = () => {
      cleanup();
      reject(new Error('Failed to seek video frame.'));
    };
    video.onloadeddata = () => {
      if (Math.abs(video.currentTime - timestamp) < 0.01) {
        cleanup();
        resolve();
      }
    };

    video.currentTime = timestamp;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture video frame.'));
        }
      },
      'image/jpeg',
      0.92,
    );
  });
}

export function getFrameExtractionPlan(
  durationSeconds: number,
  options: FrameExtractionOptions = {},
): FrameExtractionPlan {
  const maxFrames = Math.max(1, options.maxFrames ?? DEFAULT_MAX_FRAMES);
  const maxFps = Math.max(0.1, options.maxFps ?? DEFAULT_MAX_FPS);
  const duration = Math.max(0, durationSeconds);

  if (duration === 0) {
    return {
      fps: 1,
      maxFrames,
      expectedFrames: maxFrames,
    };
  }

  let targetFrames: number;
  if (duration <= 30) {
    targetFrames = Math.ceil(duration * 2);
  } else if (duration <= 120) {
    targetFrames = Math.ceil(duration * 1.5);
  } else if (duration <= 300) {
    targetFrames = Math.ceil(duration);
  } else {
    targetFrames = maxFrames;
  }

  const expectedFrames = Math.max(1, Math.min(maxFrames, targetFrames));
  const fps = Math.min(maxFps, expectedFrames / duration);

  return {
    fps,
    maxFrames: expectedFrames,
    expectedFrames,
  };
}

/**
 * Extracts timestamped frames from a video file using the browser decoder.
 *
 * Uses denser sampling for short clips and a hard frame budget for longer
 * videos, so brief title/lower-third mistakes are less likely to be skipped.
 * Native video/canvas extraction avoids ffmpeg.wasm crashes on audio tracks.
 *
 * @param file - The video File to extract frames from
 * @param onProgress - Callback invoked with (currentFrame, totalFrames)
 * @returns An object containing an array of frame Blobs and their timestamps
 */
export async function extractFrames(
  file: File,
  onProgress: (current: number, total: number) => void,
  options: FrameExtractionOptions = {},
): Promise<{ blobs: Blob[]; timestamps: number[] }> {
  if (typeof document === 'undefined') {
    throw new Error('Video scanning requires a browser environment.');
  }

  const { video, url } = await loadVideo(file);
  const duration = Number.isFinite(video.duration) ? video.duration : 0;
  const plan = getFrameExtractionPlan(duration, options);
  const blobs: Blob[] = [];
  const timestamps: number[] = [];
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(url);
    throw new Error('Failed to initialize video frame capture.');
  }

  try {
    for (let i = 0; i < plan.maxFrames; i++) {
      const timestamp =
        duration > 0 ? Math.min(i / plan.fps, Math.max(0, duration - 0.05)) : 0;
      await seekVideo(video, timestamp);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      blobs.push(await canvasToJpegBlob(canvas));
      timestamps.push(timestamp);
      onProgress(i + 1, plan.expectedFrames);
    }

    return { blobs, timestamps };
  } finally {
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

/**
 * Converts raw WAV bytes (16-bit PCM, 16kHz mono) to a Float32Array
 * normalized to [-1, 1]. Skips the standard 44-byte WAV header.
 */
function wavToFloat32(wavBytes: Uint8Array): Float32Array {
  // WAV header is 44 bytes; payload is 16-bit signed PCM
  const dataView = new DataView(wavBytes.buffer, wavBytes.byteOffset + 44);
  const numSamples = (wavBytes.length - 44) / 2;
  const float32 = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    float32[i] = dataView.getInt16(i * 2, true) / 32768;
  }
  return float32;
}

/**
 * Extracts frames AND audio from a video file using FFmpeg (WASM).
 *
 * Runs both frame extraction (1fps JPEG) and audio extraction
 * (16kHz mono WAV) in a single session to avoid writing the file twice.
 *
 * @param file - The video File to process
 * @param onFrameProgress - Callback invoked with (currentFrame, totalFrames)
 * @returns Frames, timestamps, audio as Float32Array, and video duration
 */
export async function extractFramesAndAudio(
  file: File,
  onFrameProgress: (current: number, total: number) => void,
  options: FrameExtractionOptions = {},
): Promise<{
  blobs: Blob[];
  timestamps: number[];
  audioData: Float32Array | null;
  duration: number;
}> {
  await ensureLoaded();

  const duration = await getVideoDuration(file);
  const plan = getFrameExtractionPlan(duration, options);
  const blobs: Blob[] = [];
  const timestamps: number[] = [];
  const runId = createRunId();
  const inputName = `input_${runId}`;
  const audioName = `audio_${runId}.wav`;
  const framePrefix = `frame_${runId}_`;

  try {
    // Write input once
    const inputData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile(inputName, inputData);

    // Extract audio: 16kHz mono PCM WAV
    let audioExtractionSucceeded = true;
    try {
      await ffmpeg.exec([
        '-i', inputName,
        '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav',
        audioName,
      ]);
    } catch {
      audioExtractionSucceeded = false;
    }

    // Extract frames using a bounded, duration-aware sampling plan
    await ffmpeg.exec([
      '-i', inputName,
      '-map', '0:v:0',
      '-an',
      '-vf', `fps=${plan.fps.toFixed(3)}`,
      '-frames:v', String(plan.maxFrames),
      '-q:v', '2',
      `${framePrefix}%04d.jpg`,
    ]);

    // Read audio (may not exist if video has no audio track)
    let audioData: Float32Array | null = null;
    if (audioExtractionSucceeded) {
      try {
        const wavData = await ffmpeg.readFile(audioName);
        const wavBytes = new Uint8Array(wavData as Uint8Array);
        if (wavBytes.length > 44) {
          audioData = wavToFloat32(wavBytes);
        }
      } catch {
        // No audio track — audioData stays null
      }
    }

    // Read frames
    for (let i = 1; i <= plan.maxFrames; i++) {
      const fileName = `${framePrefix}${String(i).padStart(4, '0')}.jpg`;
      try {
        const frameData = await ffmpeg.readFile(fileName);
        const blob = new Blob([new Uint8Array(frameData as Uint8Array)], {
          type: 'image/jpeg',
        });
        blobs.push(blob);
        timestamps.push((i - 1) / plan.fps);
        onFrameProgress(i, plan.expectedFrames);
      } catch {
        break;
      }
    }

    return { blobs, timestamps, audioData, duration };
  } finally {
    // Clean up virtual FS (best-effort)
    try { await ffmpeg.deleteFile(inputName); } catch { /* may not exist */ }
    try { await ffmpeg.deleteFile(audioName); } catch { /* may not exist */ }
    for (let i = 1; i <= blobs.length; i++) {
      const fileName = `${framePrefix}${String(i).padStart(4, '0')}.jpg`;
      try { await ffmpeg.deleteFile(fileName); } catch { /* already cleaned */ }
    }
  }
}

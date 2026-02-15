import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

const FFMPEG_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

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

/**
 * Extracts frames from a video file at 1 fps using FFmpeg (WASM).
 *
 * Loads the FFmpeg core from CDN, writes the video into the virtual FS,
 * runs frame extraction, then reads each output frame as a Blob.
 *
 * @param file - The video File to extract frames from
 * @param onProgress - Callback invoked with (currentFrame, totalFrames)
 * @returns An object containing an array of frame Blobs and their timestamps
 */
export async function extractFrames(
  file: File,
  onProgress: (current: number, total: number) => void,
): Promise<{ blobs: Blob[]; timestamps: number[] }> {
  // Load FFmpeg WASM core from CDN
  await ensureLoaded();

  // Parse video duration from ffmpeg log output
  let duration = 0;
  const logHandler = ({ message }: { message: string }) => {
    const match = message.match(
      /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
    );
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
  };
  ffmpeg.on('log', logHandler);

  const blobs: Blob[] = [];

  try {
    // Write the input video file to the virtual filesystem
    const inputData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile('input', inputData);

    // Extract frames at 1 fps
    await ffmpeg.exec([
      '-i',
      'input',
      '-vf',
      'fps=1',
      '-q:v',
      '2',
      'frame_%04d.jpg',
    ]);

    // Estimate total frame count from duration (1 fps)
    const estimatedTotal = Math.max(1, Math.floor(duration));

    // Read extracted frames from the virtual FS
    const timestamps: number[] = [];

    for (let i = 1; i <= estimatedTotal; i++) {
      const fileName = `frame_${String(i).padStart(4, '0')}.jpg`;
      try {
        const frameData = await ffmpeg.readFile(fileName);
        const blob = new Blob([new Uint8Array(frameData as Uint8Array)], { type: 'image/jpeg' });
        blobs.push(blob);
        timestamps.push(i - 1); // Timestamp in seconds (0-indexed)
        onProgress(i, estimatedTotal);
      } catch {
        // No more frames to read -- we've reached the end
        break;
      }
    }

    return { blobs, timestamps };
  } finally {
    ffmpeg.off('log', logHandler);

    // Clean up virtual FS (best-effort)
    try { await ffmpeg.deleteFile('input'); } catch { /* may not exist */ }
    for (let i = 1; i <= blobs.length; i++) {
      const fileName = `frame_${String(i).padStart(4, '0')}.jpg`;
      try { await ffmpeg.deleteFile(fileName); } catch { /* already cleaned */ }
    }
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
): Promise<{
  blobs: Blob[];
  timestamps: number[];
  audioData: Float32Array | null;
  duration: number;
}> {
  await ensureLoaded();

  let duration = 0;
  const logHandler = ({ message }: { message: string }) => {
    const match = message.match(
      /Duration:\s*(\d{2}):(\d{2}):(\d{2})\.(\d{2})/,
    );
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = parseInt(match[3], 10);
      const centiseconds = parseInt(match[4], 10);
      duration = hours * 3600 + minutes * 60 + seconds + centiseconds / 100;
    }
  };
  ffmpeg.on('log', logHandler);

  const blobs: Blob[] = [];

  try {
    // Write input once
    const inputData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile('input', inputData);

    // Extract audio: 16kHz mono PCM WAV
    await ffmpeg.exec([
      '-i', 'input',
      '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', '-f', 'wav',
      'audio.wav',
    ]);

    // Extract frames at 1 fps
    await ffmpeg.exec([
      '-i', 'input',
      '-vf', 'fps=1',
      '-q:v', '2',
      'frame_%04d.jpg',
    ]);

    // Read audio (may not exist if video has no audio track)
    let audioData: Float32Array | null = null;
    try {
      const wavData = await ffmpeg.readFile('audio.wav');
      const wavBytes = new Uint8Array(wavData as Uint8Array);
      if (wavBytes.length > 44) {
        audioData = wavToFloat32(wavBytes);
      }
    } catch {
      // No audio track — audioData stays null
    }

    // Read frames
    const estimatedTotal = Math.max(1, Math.floor(duration));
    const timestamps: number[] = [];

    for (let i = 1; i <= estimatedTotal; i++) {
      const fileName = `frame_${String(i).padStart(4, '0')}.jpg`;
      try {
        const frameData = await ffmpeg.readFile(fileName);
        const blob = new Blob([new Uint8Array(frameData as Uint8Array)], {
          type: 'image/jpeg',
        });
        blobs.push(blob);
        timestamps.push(i - 1);
        onFrameProgress(i, estimatedTotal);
      } catch {
        break;
      }
    }

    return { blobs, timestamps, audioData, duration };
  } finally {
    ffmpeg.off('log', logHandler);

    // Clean up virtual FS (best-effort)
    try { await ffmpeg.deleteFile('input'); } catch { /* may not exist */ }
    try { await ffmpeg.deleteFile('audio.wav'); } catch { /* may not exist */ }
    for (let i = 1; i <= blobs.length; i++) {
      const fileName = `frame_${String(i).padStart(4, '0')}.jpg`;
      try { await ffmpeg.deleteFile(fileName); } catch { /* already cleaned */ }
    }
  }
}

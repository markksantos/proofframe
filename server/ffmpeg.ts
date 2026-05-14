import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { BoundingBox } from '../src/types/index.ts';

const execFileAsync = promisify(execFile);

export interface ExtractedFrame {
  path: string;
  fileName: string;
  timestamp: number;
}

export interface MediaExtractionResult {
  audioPath: string | null;
  duration: number;
  fps: number;
  frames: ExtractedFrame[];
}

export async function assertNativeFfmpegAvailable(): Promise<void> {
  try {
    await Promise.all([
      execFileAsync('ffmpeg', ['-version']),
      execFileAsync('ffprobe', ['-version']),
    ]);
  } catch {
    throw new Error(
      'Native ffmpeg/ffprobe is required for video proofing. Install ffmpeg and restart the app.',
    );
  }
}

export async function probeDuration(inputPath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    inputPath,
  ]);

  const duration = Number.parseFloat(stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

export function getServerFramePlan(durationSeconds: number): { fps: number; maxDuration: number } {
  if (durationSeconds > 600) {
    throw new Error(
      'This local proofing engine supports videos up to 10 minutes for now. Trim the video or scan a focused section.',
    );
  }

  return {
    fps: durationSeconds <= 180 ? 4 : 2,
    maxDuration: 600,
  };
}

export async function extractMedia(
  inputPath: string,
  jobDir: string,
  onFrameProgress: (current: number, total: number) => void,
): Promise<MediaExtractionResult> {
  await assertNativeFfmpegAvailable();

  const duration = await probeDuration(inputPath);
  const plan = getServerFramePlan(duration);
  const audioPath = path.join(jobDir, 'audio.wav');
  const framesDir = path.join(jobDir, 'frames');
  const framePattern = path.join(framesDir, 'frame_%06d.jpg');
  const expectedFrames = Math.max(1, Math.ceil(duration * plan.fps));

  let extractedAudioPath: string | null = audioPath;
  try {
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-vn',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      '-f',
      'wav',
      audioPath,
    ]);
  } catch {
    extractedAudioPath = null;
  }

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    inputPath,
    '-map',
    '0:v:0',
    '-an',
    '-vf',
    `fps=${plan.fps},scale='min(1280,iw)':-2`,
    '-q:v',
    '3',
    framePattern,
  ]);

  const frameFiles = (await readdir(framesDir))
    .filter((fileName) => fileName.endsWith('.jpg'))
    .sort();

  const frames = frameFiles.map((fileName, index) => {
    onFrameProgress(index + 1, expectedFrames);
    return {
      path: path.join(framesDir, fileName),
      fileName,
      timestamp: index / plan.fps,
    };
  });

  return {
    audioPath: extractedAudioPath,
    duration,
    fps: plan.fps,
    frames,
  };
}

export async function createImageCrop(
  sourcePath: string,
  outputPath: string,
  bbox: BoundingBox,
  padding = 12,
): Promise<void> {
  const x = Math.max(0, Math.floor(bbox.x0 - padding));
  const y = Math.max(0, Math.floor(bbox.y0 - padding));
  const width = Math.max(1, Math.ceil(bbox.x1 - bbox.x0 + padding * 2));
  const height = Math.max(1, Math.ceil(bbox.y1 - bbox.y0 + padding * 2));

  await execFileAsync('ffmpeg', [
    '-y',
    '-i',
    sourcePath,
    '-vf',
    `crop=min(iw-${x}\\,${width}):min(ih-${y}\\,${height}):${x}:${y}`,
    outputPath,
  ]);
}

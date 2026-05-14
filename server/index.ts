import cors from 'cors';
import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProofingMode, ScanProgress, ScanResult } from '../src/types/index.ts';
import { assertNativeFfmpegAvailable } from './ffmpeg.ts';
import { runProofingJob } from './proofing.ts';

type JobStatus = 'queued' | 'processing' | 'complete' | 'error';

interface JobState {
  id: string;
  status: JobStatus;
  progress: ScanProgress;
  result?: ScanResult;
  error?: string;
}

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SERVER_DIR, '..');
const JOBS_ROOT = path.join(ROOT_DIR, '.proofframe/jobs');
const UPLOADS_ROOT = path.join(ROOT_DIR, '.proofframe/uploads');

const PORT = Number.parseInt(process.env.PROOFFRAME_API_PORT ?? '8787', 10);

const jobs = new Map<string, JobState>();
const app = express();
const upload = multer({
  dest: UPLOADS_ROOT,
  limits: {
    fileSize: 1024 * 1024 * 1024,
  },
});

const initialProgress: ScanProgress = {
  stage: 'loading',
  currentFrame: 0,
  totalFrames: 0,
  message: 'Queued for local proofing...',
};

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function parseProofingMode(value: unknown): ProofingMode {
  return value === 'audio_aware' || value === 'audio'
    ? 'audio_aware'
    : 'visual_only';
}

function parseOpenRouterApiKey(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function getJobFromDisk(scanId: string): Promise<JobState | null> {
  const resultPath = path.join(JOBS_ROOT, scanId, 'result.json');
  if (!existsSync(resultPath)) return null;

  const result = JSON.parse(await readFile(resultPath, 'utf8')) as ScanResult;
  return {
    id: scanId,
    status: 'complete',
    progress: {
      stage: 'complete',
      currentFrame: result.frames.length,
      totalFrames: result.frames.length,
      message: 'Scan complete!',
    },
    result,
  };
}

async function runJob(
  scanId: string,
  jobDir: string,
  inputPath: string,
  fileName: string,
  mode: ProofingMode,
  openRouterApiKey: string,
): Promise<void> {
  const job = jobs.get(scanId);
  if (!job) return;

  job.status = 'processing';

  try {
    const result = await runProofingJob({
      scanId,
      rootDir: ROOT_DIR,
      jobDir,
      inputPath,
      fileName,
      mode,
      openRouterApiKey,
      updateProgress: (progress) => {
        const activeJob = jobs.get(scanId);
        if (activeJob) activeJob.progress = progress;
      },
    });

    job.status = 'complete';
    job.result = result;
    job.progress = {
      stage: 'complete',
      currentFrame: result.frames.length,
      totalFrames: result.frames.length,
      message: 'Scan complete!',
    };

    await writeFile(
      path.join(jobDir, 'result.json'),
      JSON.stringify(result, null, 2),
      'utf8',
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    job.status = 'error';
    job.error = message;
    job.progress = {
      stage: 'error',
      currentFrame: 0,
      totalFrames: 0,
      message,
    };
  }
}

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res) => {
  let ffmpegAvailable = true;
  try {
    await assertNativeFfmpegAvailable();
  } catch {
    ffmpegAvailable = false;
  }

  res.json({
    ok: true,
    ffmpegAvailable,
    providers: {
      openrouterByok: true,
    },
  });
});

app.post('/api/scans', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: 'No video file uploaded.' });
    return;
  }

  const scanId = randomUUID();
  const jobDir = path.join(JOBS_ROOT, scanId);
  const mode = parseProofingMode(req.body.mode);
  const openRouterApiKey = parseOpenRouterApiKey(req.body.openRouterApiKey);
  const safeName = sanitizeFileName(file.originalname || 'video');
  const inputPath = path.join(jobDir, safeName);

  await mkdir(jobDir, { recursive: true });
  await mkdir(path.join(jobDir, 'frames'), { recursive: true });
  await mkdir(path.join(jobDir, 'crops'), { recursive: true });
  await rename(file.path, inputPath);

  jobs.set(scanId, {
    id: scanId,
    status: 'queued',
    progress: initialProgress,
  });

  void runJob(
    scanId,
    jobDir,
    inputPath,
    file.originalname || safeName,
    mode,
    openRouterApiKey,
  );

  res.status(202).json({
    scanId,
    status: 'queued',
    progress: initialProgress,
  });
});

app.get('/api/scans/:id', async (req, res) => {
  const scanId = req.params.id;
  const job = jobs.get(scanId) ?? (await getJobFromDisk(scanId));

  if (!job) {
    res.status(404).json({ error: 'Scan job not found.' });
    return;
  }

  res.json(job);
});

app.use('/api/scans/:id/artifacts', (req, res, next) => {
  if (req.method !== 'GET') {
    next();
    return;
  }

  const url = new URL(req.originalUrl, 'http://127.0.0.1');
  const match = url.pathname.match(/^\/api\/scans\/([^/]+)\/artifacts\/(.+)$/);
  if (!match) {
    res.status(400).json({ error: 'Invalid artifact path.' });
    return;
  }

  let artifactPath = '';
  let scanId = '';

  try {
    scanId = decodeURIComponent(match[1]);
    artifactPath = decodeURIComponent(match[2]);
  } catch {
    res.status(400).json({ error: 'Invalid artifact path.' });
    return;
  }

  if (!artifactPath) {
    res.status(400).json({ error: 'Missing artifact path.' });
    return;
  }

  const jobDir = path.resolve(JOBS_ROOT, scanId);
  const targetPath = path.resolve(jobDir, artifactPath);

  if (!targetPath.startsWith(`${jobDir}${path.sep}`)) {
    res.status(400).json({ error: 'Invalid artifact path.' });
    return;
  }

  res.sendFile(targetPath, { dotfiles: 'allow' }, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({ error: 'Artifact not found.' });
    }
  });
});

app.delete('/api/scans/:id', async (req, res) => {
  const scanId = req.params.id;
  jobs.delete(scanId);
  await rm(path.join(JOBS_ROOT, scanId), { recursive: true, force: true });
  res.status(204).send();
});

await mkdir(JOBS_ROOT, { recursive: true });
await mkdir(UPLOADS_ROOT, { recursive: true });

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ProofFrame local analysis API running at http://127.0.0.1:${PORT}`);
});

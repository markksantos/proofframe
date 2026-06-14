import type { ScanProgress, ScanResult } from '../types/index.ts';
import { apiUrl } from './api-base.ts';

interface ScanJobResponse {
  scanId?: string;
  id?: string;
  status: 'queued' | 'processing' | 'complete' | 'error';
  progress: ScanProgress;
  result?: ScanResult;
  error?: string;
}

const POLL_INTERVAL_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Server returned ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

// Server artifact URLs (frame thumbnails, crop previews) are returned as
// server-relative paths like `/api/scans/<id>/artifacts/...`. When the frontend
// is served from a different origin than the backend (deployed split mode),
// these must be resolved against the configured API base so the <img> tags
// load. In local/dev mode apiUrl is a no-op, so this stays a relative path.
function resolveArtifactUrls(result: ScanResult): ScanResult {
  const resolve = (url: string | undefined): string | undefined =>
    url && url.startsWith('/api/') ? apiUrl(url) : url;

  return {
    ...result,
    frames: result.frames.map((frame) => ({
      ...frame,
      thumbnailUrl: resolve(frame.thumbnailUrl) ?? frame.thumbnailUrl,
      videoErrors: frame.videoErrors?.map((error) => ({
        ...error,
        artifactUrl: resolve(error.artifactUrl),
      })),
    })),
  };
}

// Delete a server-side video job and all its on-disk artifacts (uploaded
// video, extracted frames, crops, audio, result.json). Called when the user
// resets or starts a new scan so user footage doesn't linger on the backend.
export async function deleteServerScan(scanId: string): Promise<void> {
  await fetch(apiUrl(`/api/scans/${scanId}`), { method: 'DELETE' }).catch(
    () => undefined,
  );
}

export async function runServerVideoScan(
  file: File,
  openRouterApiKey: string,
  onProgress: (progress: ScanProgress) => void,
  isCancelled: () => boolean,
  onScanId?: (scanId: string) => void,
): Promise<ScanResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', 'audio_aware');
  formData.append('openRouterApiKey', openRouterApiKey);

  const created = await parseResponse<ScanJobResponse>(
    await fetch(apiUrl('/api/scans'), {
      method: 'POST',
      body: formData,
    }),
  );

  const scanId = created.scanId ?? created.id;
  if (!scanId) throw new Error('Local proofing server did not return a scan id.');

  onScanId?.(scanId);
  onProgress(created.progress);

  while (!isCancelled()) {
    await delay(POLL_INTERVAL_MS);

    const job = await parseResponse<ScanJobResponse>(
      await fetch(apiUrl(`/api/scans/${scanId}`)),
    );
    onProgress(job.progress);

    if (job.status === 'complete') {
      if (!job.result) {
        throw new Error('Local proofing server completed without a result.');
      }
      return resolveArtifactUrls(job.result);
    }

    if (job.status === 'error') {
      throw new Error(job.error ?? job.progress.message);
    }
  }

  await deleteServerScan(scanId);
  return null;
}

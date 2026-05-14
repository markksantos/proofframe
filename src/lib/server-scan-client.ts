import type { ScanProgress, ScanResult } from '../types/index.ts';

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

export async function runServerVideoScan(
  file: File,
  openRouterApiKey: string,
  onProgress: (progress: ScanProgress) => void,
  isCancelled: () => boolean,
): Promise<ScanResult | null> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('mode', 'audio_aware');
  formData.append('openRouterApiKey', openRouterApiKey);

  const created = await parseResponse<ScanJobResponse>(
    await fetch('/api/scans', {
      method: 'POST',
      body: formData,
    }),
  );

  const scanId = created.scanId ?? created.id;
  if (!scanId) throw new Error('Local proofing server did not return a scan id.');

  onProgress(created.progress);

  while (!isCancelled()) {
    await delay(POLL_INTERVAL_MS);

    const job = await parseResponse<ScanJobResponse>(
      await fetch(`/api/scans/${scanId}`),
    );
    onProgress(job.progress);

    if (job.status === 'complete') {
      if (!job.result) {
        throw new Error('Local proofing server completed without a result.');
      }
      return job.result;
    }

    if (job.status === 'error') {
      throw new Error(job.error ?? job.progress.message);
    }
  }

  await fetch(`/api/scans/${scanId}`, { method: 'DELETE' }).catch(() => undefined);
  return null;
}

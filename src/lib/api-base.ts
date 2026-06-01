// Resolves the base URL for the ProofFrame local analysis API.
//
// In local development the Vite dev server proxies `/api` to the Express
// backend (see vite.config.ts), so the default empty base + relative `/api`
// paths work without configuration.
//
// In a deployed static frontend the backend usually lives on a separate
// origin (a long-running Node host such as Render/Railway/Fly/VPS — it cannot
// run on static/serverless hosting because it needs native ffmpeg, persistent
// disk, and long-lived polling jobs). Point the frontend at it by setting
// `VITE_PROOFFRAME_API_BASE` at build time, e.g.
// `VITE_PROOFFRAME_API_BASE=https://proofframe-api.example.com`.
const RAW_BASE = import.meta.env.VITE_PROOFFRAME_API_BASE ?? '';

// Strip a single trailing slash so callers can build paths as `${base}/api/...`.
const API_BASE = RAW_BASE.replace(/\/$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalizedPath}`;
}

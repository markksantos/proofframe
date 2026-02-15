const STORAGE_KEY = 'proofframe_scan_history';
const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Retrieves and prunes scan timestamps from localStorage.
 * Removes entries older than 1 hour.
 */
function getRecentScans(): number[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  let timestamps: number[];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    timestamps = parsed as number[];
  } catch {
    return [];
  }

  // Prune entries older than 1 hour
  const cutoff = Date.now() - ONE_HOUR_MS;
  const recent = timestamps.filter((t) => t > cutoff);

  // Persist pruned list
  if (recent.length !== timestamps.length) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
  }

  return recent;
}

/**
 * Checks whether the user can perform another scan within the rate limit.
 *
 * @param limit - Maximum scans per hour. Default: 10
 * @returns true if another scan is allowed
 */
export function canScan(limit = 10): boolean {
  const recent = getRecentScans();
  return recent.length < limit;
}

/**
 * Records a scan timestamp in localStorage.
 */
export function recordScan(): void {
  const recent = getRecentScans();
  recent.push(Date.now());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
}

/**
 * Returns the number of scans remaining within the current rate limit window.
 *
 * @param limit - Maximum scans per hour. Default: 10
 * @returns Number of scans remaining
 */
export function getRemaining(limit = 10): number {
  const recent = getRecentScans();
  return Math.max(0, limit - recent.length);
}

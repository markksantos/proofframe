/**
 * Computes the Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;

  // Early exits
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  // Use a single-row DP approach for space efficiency
  const row = Array.from({ length: bLen + 1 }, (_, i) => i);

  for (let i = 1; i <= aLen; i++) {
    let prev = i;
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const current = Math.min(
        row[j] + 1, // deletion
        prev + 1, // insertion
        row[j - 1] + cost, // substitution
      );
      row[j - 1] = prev;
      prev = current;
    }
    row[bLen] = prev;
  }

  return row[bLen];
}

/**
 * Returns the Levenshtein similarity between two strings as a value
 * between 0 (completely different) and 1 (identical).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Determines whether two frames contain duplicate text content
 * based on Levenshtein similarity.
 *
 * @param text1 - OCR text from the first frame
 * @param text2 - OCR text from the second frame
 * @param threshold - Similarity threshold (0-1). Default 0.85 (85%).
 * @returns true if the texts are similar enough to be considered duplicates
 */
export function isDuplicateFrame(
  text1: string,
  text2: string,
  threshold = 0.85,
): boolean {
  const similarity = levenshteinSimilarity(text1, text2);
  return similarity >= threshold;
}

const STORAGE_KEY = 'proofframe_custom_dictionary';

/**
 * Retrieves the list of custom words from localStorage.
 */
export function getCustomWords(): string[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (Array.isArray(parsed)) return parsed as string[];
    return [];
  } catch {
    return [];
  }
}

/**
 * Adds a word to the custom dictionary. Duplicates are ignored.
 */
export function addCustomWord(word: string): void {
  const words = getCustomWords();
  const lower = word.toLowerCase().trim();
  if (lower && !words.includes(lower)) {
    words.push(lower);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  }
}

/**
 * Removes a word from the custom dictionary.
 */
export function removeCustomWord(word: string): void {
  const words = getCustomWords();
  const lower = word.toLowerCase().trim();
  const filtered = words.filter((w) => w !== lower);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

/**
 * Checks whether a word exists in the custom dictionary.
 */
export function isCustomWord(word: string): boolean {
  const words = getCustomWords();
  return words.includes(word.toLowerCase().trim());
}

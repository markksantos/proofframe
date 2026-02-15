import nspell from 'nspell';
import type { OCRWord, SpellingError } from '../types/index.ts';
import { isCustomWord } from './custom-dictionary.ts';

let checker: ReturnType<typeof nspell> | null = null;

/**
 * Initializes the nspell spell checker by fetching en_US dictionary files.
 *
 * Dictionary files (.aff and .dic) must be placed in public/dictionaries/:
 *   - public/dictionaries/en_US.aff
 *   - public/dictionaries/en_US.dic
 *
 * These can be obtained from the hunspell dictionaries project or
 * from the nspell dictionary packages (dictionary-en).
 */
export async function initSpellChecker(): Promise<void> {
  if (checker) return;

  const [affResponse, dicResponse] = await Promise.all([
    fetch('/dictionaries/en_US.aff'),
    fetch('/dictionaries/en_US.dic'),
  ]);

  if (!affResponse.ok || !dicResponse.ok) {
    throw new Error(
      'Failed to load dictionary files. Ensure en_US.aff and en_US.dic ' +
        'are in the public/dictionaries/ directory.',
    );
  }

  const aff = await affResponse.text();
  const dic = await dicResponse.text();

  checker = nspell(aff, dic);
}

/**
 * Determines whether a word should be skipped during spell checking.
 *
 * Skip rules:
 * - Less than 2 characters
 * - Single letters
 * - ALL CAPS (likely acronym or brand name)
 * - Contains numbers
 * - Looks like a URL (contains . / or :)
 */
function shouldSkip(word: string): boolean {
  // Skip very short words and single letters
  if (word.length < 2) return true;

  // Skip ALL CAPS (acronyms, brand names, abbreviations)
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) return true;

  // Skip words containing digits
  if (/\d/.test(word)) return true;

  // Skip URL-like tokens
  if (/[./:@]/.test(word)) return true;

  return false;
}

/**
 * Checks an array of OCR words for spelling errors.
 *
 * @param words - Array of OCRWord objects from OCR results
 * @param frameIndex - Optional frame index for video scans
 * @returns Array of SpellingError objects for misspelled words
 */
export function checkWords(
  words: OCRWord[],
  frameIndex?: number,
): SpellingError[] {
  if (!checker) {
    throw new Error(
      'Spell checker not initialized. Call initSpellChecker() first.',
    );
  }

  const errors: SpellingError[] = [];

  for (const word of words) {
    // Strip punctuation from the edges for checking
    const cleaned = word.text.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');

    if (!cleaned) continue;
    if (shouldSkip(cleaned)) continue;
    if (isCustomWord(cleaned)) continue;

    const correct = checker.correct(cleaned);

    if (!correct) {
      const suggestions = checker.suggest(cleaned).slice(0, 5);

      errors.push({
        word: word.text,
        suggestions,
        confidence: word.confidence,
        bbox: word.bbox,
        ...(frameIndex !== undefined ? { frameIndex } : {}),
      });
    }
  }

  return errors;
}

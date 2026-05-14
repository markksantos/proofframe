import nspell from 'nspell';
import type { OCRWord, SpellingError } from '../types/index.ts';
import { isCustomWord } from './custom-dictionary.ts';

let checker: ReturnType<typeof nspell> | null = null;

const MIN_WORD_CONFIDENCE = 60;
const MIN_WORD_HEIGHT_PX = 12;
const MIN_WORD_WIDTH_PX = 8;

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
 * - 2 characters or less
 * - Short ALL CAPS tokens (likely acronyms)
 * - Pure numbers or mostly numeric tokens
 * - Looks like a URL (contains . / or :)
 */
function shouldSkip(word: string): boolean {
  // Skip very short OCR fragments. Two-letter "errors" are usually visual noise.
  if (word.length <= 2) return true;

  // Skip short ALL CAPS acronyms, but still check longer title-card words.
  if (word.length <= 3 && word === word.toUpperCase() && /[A-Z]/.test(word)) {
    return true;
  }

  // Skip pure numbers and mostly numeric OCR fragments.
  if (/^\d+$/.test(word)) return true;
  if (/\d/.test(word) && !/[a-zA-Z]{3,}/.test(word)) return true;

  // Skip URL-like tokens
  if (/[./:@]/.test(word)) return true;

  return false;
}

function isLowQualityOcrWord(word: OCRWord): boolean {
  const width = word.bbox.x1 - word.bbox.x0;
  const height = word.bbox.y1 - word.bbox.y0;

  return (
    word.confidence < MIN_WORD_CONFIDENCE ||
    width < MIN_WORD_WIDTH_PX ||
    height < MIN_WORD_HEIGHT_PX
  );
}

function extractCheckTokens(text: string): string[] {
  const tokens = text.match(/[a-zA-Z][a-zA-Z']*/g) ?? [];
  return tokens
    .map((token) => token.replace(/'s$/i, ''))
    .filter((token) => token.length > 0);
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
    if (isLowQualityOcrWord(word)) continue;

    const tokens = extractCheckTokens(word.text);

    for (const token of tokens) {
      if (shouldSkip(token)) continue;
      if (isCustomWord(token)) continue;

      const correct = checker.correct(token);

      if (!correct) {
        const suggestions = checker.suggest(token).slice(0, 5);

        errors.push({
          word: token,
          suggestions,
          confidence: word.confidence,
          bbox: word.bbox,
          ...(frameIndex !== undefined ? { frameIndex } : {}),
        });
      }
    }
  }

  return errors;
}

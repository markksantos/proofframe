import { readFile } from 'node:fs/promises';
import path from 'node:path';
import nspell from 'nspell';
import type { OCRWord, SpellingError } from '../src/types/index.ts';

let checker: ReturnType<typeof nspell> | null = null;

const MIN_WORD_CONFIDENCE = 60;
const MIN_WORD_HEIGHT_PX = 12;
const MIN_WORD_WIDTH_PX = 8;

export async function initServerSpellChecker(rootDir: string): Promise<void> {
  if (checker) return;

  const [aff, dic] = await Promise.all([
    readFile(path.join(rootDir, 'public/dictionaries/en_US.aff'), 'utf8'),
    readFile(path.join(rootDir, 'public/dictionaries/en_US.dic'), 'utf8'),
  ]);

  checker = nspell(aff, dic);
}

function shouldSkip(word: string): boolean {
  if (word.length <= 2) return true;
  if (word.length <= 3 && word === word.toUpperCase() && /[A-Z]/.test(word)) return true;
  if (/^\d+$/.test(word)) return true;
  if (/\d/.test(word) && !/[a-zA-Z]{3,}/.test(word)) return true;
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

export function checkServerWords(
  words: OCRWord[],
  frameIndex?: number,
): SpellingError[] {
  if (!checker) {
    throw new Error('Server spell checker not initialized.');
  }

  const errors: SpellingError[] = [];

  for (const word of words) {
    if (isLowQualityOcrWord(word)) continue;

    for (const token of extractCheckTokens(word.text)) {
      if (shouldSkip(token)) continue;

      if (!checker.correct(token)) {
        errors.push({
          word: token,
          suggestions: checker.suggest(token).slice(0, 5),
          confidence: word.confidence,
          bbox: word.bbox,
          ...(frameIndex !== undefined ? { frameIndex } : {}),
        });
      }
    }
  }

  return errors;
}

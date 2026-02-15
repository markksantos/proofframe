import { createWorker } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import type { OCRResult, OCRWord } from '../types/index.ts';

let worker: Worker | null = null;

export async function initWorker(): Promise<Worker> {
  if (worker) return worker;
  worker = await createWorker('eng');
  return worker;
}

export async function recognizeImage(
  imageSource: string | Blob,
): Promise<OCRResult> {
  const w = await initWorker();
  const { data } = await w.recognize(imageSource);

  // Extract words from the nested block -> paragraph -> line -> word structure
  const words: OCRWord[] = [];
  if (data.blocks) {
    for (const block of data.blocks) {
      for (const paragraph of block.paragraphs) {
        for (const line of paragraph.lines) {
          for (const word of line.words) {
            words.push({
              text: word.text,
              confidence: word.confidence,
              bbox: {
                x0: word.bbox.x0,
                y0: word.bbox.y0,
                x1: word.bbox.x1,
                y1: word.bbox.y1,
              },
            });
          }
        }
      }
    }
  }

  return {
    words,
    text: data.text,
    confidence: data.confidence,
  };
}

export async function terminateWorker(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}

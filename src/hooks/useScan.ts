import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ScanProgress,
  ScanResult,
  FrameResult,
} from '../types/index.ts';
import { initWorker, recognizeImage, terminateWorker } from '../lib/ocr.ts';
import { initSpellChecker, checkWords } from '../lib/spell-checker.ts';
import { canScan, recordScan } from '../lib/rate-limiter.ts';
import { runServerVideoScan, deleteServerScan } from '../lib/server-scan-client.ts';
import { getOpenRouterApiKey } from '../lib/scan-settings.ts';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'tiff', 'webp'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];
const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS];

const IMAGE_MAX_SIZE = 50 * 1024 * 1024; // 50MB
const VIDEO_MAX_SIZE = 500 * 1024 * 1024; // 500MB

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() ?? '';
}

function getFileType(name: string): 'image' | 'video' | null {
  const ext = getFileExtension(name);
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return null;
}

const initialProgress: ScanProgress = {
  stage: 'idle',
  currentFrame: 0,
  totalFrames: 0,
  message: '',
};

export default function useScan() {
  const [progress, setProgress] = useState<ScanProgress>(initialProgress);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const objectUrlsRef = useRef<string[]>([]);
  const serverScanIdRef = useRef<string | null>(null);

  const cleanupObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  // Tell the backend to delete the previous video job's artifacts (uploaded
  // video, frames, crops, audio) so user footage doesn't linger server-side.
  const cleanupServerScan = useCallback(() => {
    const scanId = serverScanIdRef.current;
    if (scanId) {
      serverScanIdRef.current = null;
      void deleteServerScan(scanId);
    }
  }, []);

  // On unmount (e.g. navigating away from the Scan page with a finished video
  // result still on screen), delete any lingering server-side job so footage
  // doesn't outlive the session, and free the in-browser OCR worker.
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      const scanId = serverScanIdRef.current;
      if (scanId) {
        serverScanIdRef.current = null;
        void deleteServerScan(scanId);
      }
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
      void terminateWorker();
    };
  }, []);

  const startScan = useCallback(async function runScan(
    file: File,
  ) {
    // Reset state
    cancelRef.current = false;
    setResult(null);
    setError(null);
    cleanupObjectUrls();
    cleanupServerScan();

    try {
      // Validate file type
      const fileType = getFileType(file.name);
      if (!fileType) {
        const ext = getFileExtension(file.name);
        throw new Error(
          `Unsupported file type "${ext}". Accepted formats: ${ALL_EXTENSIONS.join(', ').toUpperCase()}.`
        );
      }

      // Validate file size
      const maxSize = fileType === 'image' ? IMAGE_MAX_SIZE : VIDEO_MAX_SIZE;
      if (file.size > maxSize) {
        const maxMB = maxSize / (1024 * 1024);
        throw new Error(
          `File is too large. Maximum size for ${fileType} files is ${maxMB}MB.`
        );
      }

      // Check rate limit
      if (!canScan()) {
        throw new Error(
          'Rate limit reached. You can perform up to 10 scans per hour. Please try again later.'
        );
      }

      if (fileType === 'image') {
        // --- Image scan ---
        // Loading stage: initialize OCR + spell checker
        setProgress({
          stage: 'loading',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Initializing OCR engine...',
        });

        await Promise.all([initWorker(), initSpellChecker()]);

        if (cancelRef.current) return;
        const imageUrl = URL.createObjectURL(file);
        objectUrlsRef.current.push(imageUrl);

        setProgress({
          stage: 'scanning',
          currentFrame: 1,
          totalFrames: 1,
          message: 'Running OCR on image...',
        });

        const ocrResult = await recognizeImage(imageUrl);

        if (cancelRef.current) return;

        setProgress({
          stage: 'spellchecking',
          currentFrame: 1,
          totalFrames: 1,
          message: 'Checking spelling...',
        });

        const errors = checkWords(ocrResult.words);

        // Get image dimensions
        const dimensions = await new Promise<{ width: number; height: number }>(
          (resolve, reject) => {
            const img = new Image();
            img.onload = () =>
              resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = () =>
              reject(new Error('Failed to load image for dimension measurement.'));
            img.src = imageUrl;
          }
        );

        const frameResult: FrameResult = {
          frameIndex: 0,
          timestamp: 0,
          thumbnailUrl: imageUrl,
          ocrResult,
          errors,
        };

        const scanResult: ScanResult = {
          type: 'image',
          fileName: file.name,
          scanDate: new Date().toLocaleString(),
          analysisSource: 'local',
          totalErrors: errors.length,
          frames: [frameResult],
          imageUrl,
          imageWidth: dimensions.width,
          imageHeight: dimensions.height,
        };

        recordScan();
        terminateWorker(); // Free OCR memory
        setResult(scanResult);
        setProgress({
          stage: 'complete',
          currentFrame: 1,
          totalFrames: 1,
          message: 'Scan complete!',
        });
      } else {
        setProgress({
          stage: 'loading',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Sending video to local proofing engine...',
        });

        const scanResult = await runServerVideoScan(
          file,
          getOpenRouterApiKey(),
          setProgress,
          () => cancelRef.current,
          (scanId) => {
            serverScanIdRef.current = scanId;
          },
        );

        if (cancelRef.current || !scanResult) {
          // runServerVideoScan already deleted the job on cancel; drop the ref.
          serverScanIdRef.current = null;
          return;
        }

        recordScan();
        setResult(scanResult);
        setProgress({
          stage: 'complete',
          currentFrame: scanResult.frames.length,
          totalFrames: scanResult.frames.length,
          message: 'Scan complete!',
        });
      }
    } catch (err) {
      if (cancelRef.current) return;

      cleanupObjectUrls();
      cleanupServerScan();

      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : JSON.stringify(err) || String(err);

      setError(message);
      setProgress({
        stage: 'error',
        currentFrame: 0,
        totalFrames: 0,
        message,
      });
    }
  }, [cleanupObjectUrls, cleanupServerScan]);

  const resetScan = useCallback(() => {
    cancelRef.current = true;
    cleanupObjectUrls();
    cleanupServerScan();
    setProgress(initialProgress);
    setResult(null);
    setError(null);
  }, [cleanupObjectUrls, cleanupServerScan]);

  const cancelScan = useCallback(() => {
    cancelRef.current = true;
    cleanupServerScan();
    setProgress(initialProgress);
    setError(null);
  }, [cleanupServerScan]);

  return { progress, result, error, startScan, resetScan, cancelScan };
}

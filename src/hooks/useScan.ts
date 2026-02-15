import { useState, useRef, useCallback } from 'react';
import type { ScanProgress, ScanResult, FrameResult } from '../types/index.ts';
import type { AnalysisMode } from '../lib/scan-settings.ts';
import { initWorker, recognizeImage, terminateWorker } from '../lib/ocr.ts';
import { extractFrames } from '../lib/video-extractor.ts';
import { extractFramesAndAudio } from '../lib/video-extractor.ts';
import { initSpellChecker, checkWords } from '../lib/spell-checker.ts';
import { isDuplicateFrame } from '../lib/frame-dedup.ts';
import { canScan, recordScan } from '../lib/rate-limiter.ts';
import { initTranscriber, transcribeAudio, terminateTranscriber } from '../lib/transcriber.ts';
import { analyzeVideoErrors } from '../lib/text-comparator.ts';
import { analyzeWithGemini, buildGeminiScanResult } from '../lib/gemini-analyzer.ts';
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

  const cleanupObjectUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
  }, []);

  const startScan = useCallback(async (file: File, analysisMode: AnalysisMode = 'local') => {
    // Reset state
    cancelRef.current = false;
    setResult(null);
    setError(null);
    cleanupObjectUrls();

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
      } else if (analysisMode === 'gemini') {
        // --- Video scan (Gemini) ---
        // Gemini still uses FFmpeg for frame extraction, which needs SharedArrayBuffer
        if (typeof SharedArrayBuffer === 'undefined') {
          throw new Error(
            'Video scanning requires a browser that supports SharedArrayBuffer (Chrome, Firefox, Edge). Please try a different browser or scan an image instead.'
          );
        }

        const apiKey = getOpenRouterApiKey();
        if (!apiKey) {
          throw new Error(
            'Gemini API key is required. Please enter your API key in the settings above.'
          );
        }

        // 1. Uploading + analyzing via Gemini
        setProgress({
          stage: 'loading',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Uploading video to Gemini...',
        });

        const geminiResult = await analyzeWithGemini(file, apiKey, (message) => {
          setProgress({
            stage: 'analyzing',
            currentFrame: 0,
            totalFrames: 0,
            message,
          });
        });

        if (cancelRef.current) return;

        // 2. Extract frames for thumbnails (still need FFmpeg for this)
        setProgress({
          stage: 'extracting',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Extracting video frames for preview...',
        });

        const { blobs, timestamps } = await extractFrames(
          file,
          (current, total) => {
            setProgress({
              stage: 'extracting',
              currentFrame: current,
              totalFrames: total,
              message: `Extracting frame ${current} of ${total}...`,
            });
          },
        );

        if (cancelRef.current) return;

        // Create object URLs for frame thumbnails
        const frameUrls: string[] = [];
        for (const blob of blobs) {
          const url = URL.createObjectURL(blob);
          objectUrlsRef.current.push(url);
          frameUrls.push(url);
        }

        // 3. Build the scan result
        const scanResult = buildGeminiScanResult(
          file.name,
          geminiResult.errors,
          geminiResult.summary,
          geminiResult.transcript,
          blobs,
          timestamps,
          frameUrls,
        );

        recordScan();
        setResult(scanResult);
        setProgress({
          stage: 'complete',
          currentFrame: blobs.length,
          totalFrames: blobs.length,
          message: 'Scan complete!',
        });
      } else {
        // --- Video scan (Local) ---
        if (typeof SharedArrayBuffer === 'undefined') {
          throw new Error(
            'Video scanning requires a browser that supports SharedArrayBuffer (Chrome, Firefox, Edge). Please try a different browser or scan an image instead.'
          );
        }

        // 1. Loading: initialize OCR, spell checker, and Whisper in parallel
        setProgress({
          stage: 'loading',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Initializing engines...',
        });

        await Promise.all([
          initWorker(),
          initSpellChecker(),
          initTranscriber((percent) => {
            setProgress({
              stage: 'loading',
              currentFrame: 0,
              totalFrames: 0,
              message: `Downloading speech model... ${percent}%`,
            });
          }),
        ]);

        if (cancelRef.current) return;

        // 2. Extracting: frames + audio
        setProgress({
          stage: 'extracting',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Loading video processor...',
        });

        const { blobs, timestamps, audioData, duration } =
          await extractFramesAndAudio(file, (current, total) => {
            setProgress({
              stage: 'extracting',
              currentFrame: current,
              totalFrames: total,
              message: `Extracting frame ${current} of ${total}...`,
            });
          });

        if (cancelRef.current) return;

        // 3. Transcribing: run Whisper on audio (skip if no audio)
        setProgress({
          stage: 'transcribing',
          currentFrame: 0,
          totalFrames: 0,
          message: audioData
            ? `Transcribing ${Math.round(duration)}s of audio...`
            : 'No audio track detected, skipping transcription...',
        });

        const transcript = audioData
          ? await transcribeAudio(audioData)
          : { text: '', segments: [], words: [] };

        terminateTranscriber(); // Free memory

        if (cancelRef.current) return;

        // 4. Scanning: OCR each frame
        setProgress({
          stage: 'scanning',
          currentFrame: 0,
          totalFrames: blobs.length,
          message: 'Scanning frames for text...',
        });

        const frames: FrameResult[] = [];
        let previousText = '';

        for (let i = 0; i < blobs.length; i++) {
          if (cancelRef.current) return;

          setProgress({
            stage: 'scanning',
            currentFrame: i + 1,
            totalFrames: blobs.length,
            message: `Scanning frame ${i + 1} of ${blobs.length}...`,
          });

          const ocrResult = await recognizeImage(blobs[i]);

          // Skip duplicate frames
          if (previousText && isDuplicateFrame(previousText, ocrResult.text)) {
            continue;
          }
          previousText = ocrResult.text;

          // Skip frames with no meaningful text
          if (!ocrResult.text.trim()) {
            continue;
          }

          const thumbnailUrl = URL.createObjectURL(blobs[i]);
          objectUrlsRef.current.push(thumbnailUrl);

          frames.push({
            frameIndex: i,
            timestamp: timestamps[i] ?? i,
            thumbnailUrl,
            ocrResult,
            errors: [], // Will be populated by analyzeVideoErrors
          });
        }

        if (cancelRef.current) return;

        // 5. Analyzing: compare OCR text against transcript
        setProgress({
          stage: 'analyzing',
          currentFrame: 0,
          totalFrames: 0,
          message: 'Analyzing text against transcript...',
        });

        const { frames: analyzedFrames, summary } = analyzeVideoErrors(
          frames,
          transcript,
        );

        // Also populate the legacy `errors` field from spelling videoErrors
        for (const frame of analyzedFrames) {
          frame.errors = (frame.videoErrors ?? [])
            .filter((ve) => ve.spellingError)
            .map((ve) => ve.spellingError!);
        }

        const totalErrors = analyzedFrames.reduce(
          (sum, f) =>
            sum +
            (f.videoErrors ?? []).filter((e) => e.severity === 'error').length,
          0,
        );

        const scanResult: ScanResult = {
          type: 'video',
          fileName: file.name,
          scanDate: new Date().toLocaleString(),
          totalErrors,
          frames: analyzedFrames,
          transcript,
          videoErrorSummary: summary,
        };

        recordScan();
        terminateWorker(); // Free OCR memory
        setResult(scanResult);
        setProgress({
          stage: 'complete',
          currentFrame: blobs.length,
          totalFrames: blobs.length,
          message: 'Scan complete!',
        });
      }
    } catch (err) {
      if (cancelRef.current) return;

      cleanupObjectUrls();

      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';

      setError(message);
      setProgress({
        stage: 'error',
        currentFrame: 0,
        totalFrames: 0,
        message,
      });
    }
  }, [cleanupObjectUrls]);

  const resetScan = useCallback(() => {
    cancelRef.current = true;
    cleanupObjectUrls();
    setProgress(initialProgress);
    setResult(null);
    setError(null);
  }, [cleanupObjectUrls]);

  const cancelScan = useCallback(() => {
    cancelRef.current = true;
    setProgress(initialProgress);
    setError(null);
  }, []);

  return { progress, result, error, startScan, resetScan, cancelScan };
}

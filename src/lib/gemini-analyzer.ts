import type {
  ScanResult,
  FrameResult,
  VideoError,
  VideoErrorSummary,
  TranscriptResult,
  OCRResult,
} from '../types/index.ts';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'google/gemini-2.5-flash';

interface GeminiError {
  timestamp: number;
  errorType: string;
  severity: string;
  message: string;
  onScreenText?: string;
  spokenText?: string;
  suggestedCorrection?: string;
}

interface GeminiResponse {
  transcript: string;
  errors: GeminiError[];
}

const JSON_SCHEMA = {
  name: 'video_analysis',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      transcript: {
        type: 'string',
        description: 'Full transcript of all spoken audio in the video',
      },
      errors: {
        type: 'array',
        description: 'All detected errors in burned-in text',
        items: {
          type: 'object',
          properties: {
            timestamp: {
              type: 'number',
              description: 'Timestamp in seconds where the error appears',
            },
            errorType: {
              type: 'string',
              description: 'Type of error detected',
              enum: ['mismatch', 'spelling', 'missing_caption', 'timing'],
            },
            severity: {
              type: 'string',
              description: 'Error severity',
              enum: ['error', 'warning'],
            },
            message: {
              type: 'string',
              description: 'Human-readable description of the error',
            },
            onScreenText: {
              type: 'string',
              description:
                'The burned-in text visible on screen (if applicable)',
            },
            spokenText: {
              type: 'string',
              description: 'The spoken words from audio (if applicable)',
            },
            suggestedCorrection: {
              type: 'string',
              description: 'Suggested fix for the error',
            },
          },
          required: [
            'timestamp',
            'errorType',
            'severity',
            'message',
            'onScreenText',
            'spokenText',
            'suggestedCorrection',
          ],
          additionalProperties: false,
        },
      },
    },
    required: ['transcript', 'errors'],
    additionalProperties: false,
  },
};

const ANALYSIS_PROMPT = `You are a professional QA tool for video editors. Analyze this video for errors in burned-in text (captions, subtitles, lower thirds, titles).

Detect these error types:
1. **mismatch** (severity: error) — On-screen text doesn't match what is being spoken. Compare burned-in text against the audio.
2. **spelling** (severity: error) — Misspelled words in any burned-in text, whether or not it corresponds to speech.
3. **missing_caption** (severity: warning) — Segments where someone is clearly speaking but no burned-in text/caption is visible on screen.
4. **timing** (severity: warning) — Burned-in text appears too early or too late relative to when the words are spoken (offset > 2 seconds).

Also transcribe all spoken audio in the video.

Be thorough but avoid false positives. Only flag clear errors.`;

/**
 * Converts a File to a base64 data URL string.
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read video file.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Analyzes a video file using Gemini Flash via OpenRouter.
 *
 * Converts the video to base64, sends it inline to OpenRouter's
 * chat completions endpoint, and parses the structured JSON response.
 *
 * @param file - The video File to analyze
 * @param apiKey - OpenRouter API key
 * @param onProgress - Progress callback for UI updates
 * @returns Errors, summary, and transcript compatible with the existing UI
 */
export async function analyzeWithGemini(
  file: File,
  apiKey: string,
  onProgress?: (message: string) => void,
): Promise<{
  errors: VideoError[];
  summary: VideoErrorSummary;
  transcript: TranscriptResult;
}> {
  // 1. Convert video to base64
  onProgress?.('Preparing video...');
  const dataUrl = await fileToBase64(file);

  // 2. Send to OpenRouter
  onProgress?.('Analyzing video for text errors...');
  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'ProofFrame',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'video_url',
              video_url: { url: dataUrl },
            },
            {
              type: 'text',
              text: ANALYSIS_PROMPT,
            },
          ],
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: JSON_SCHEMA,
      },
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `OpenRouter API error (${response.status}): ${errorBody || response.statusText}`,
    );
  }

  const data = await response.json();

  // 3. Parse response
  const content = data.choices?.[0]?.message?.content ?? '{}';
  let parsed: GeminiResponse;
  try {
    parsed = JSON.parse(content) as GeminiResponse;
  } catch {
    throw new Error(
      'Gemini returned an invalid response. Please try again.',
    );
  }

  // 4. Convert to our types
  const videoErrors: VideoError[] = (parsed.errors ?? []).map((e) => ({
    type: e.errorType as VideoError['type'],
    severity: e.severity as VideoError['severity'],
    message: e.message,
    frameIndex: Math.floor(e.timestamp),
    timestamp: e.timestamp,
    onScreenText: e.onScreenText,
    spokenText: e.spokenText,
  }));

  const summary: VideoErrorSummary = {
    mismatches: videoErrors.filter((e) => e.type === 'mismatch').length,
    spelling: videoErrors.filter((e) => e.type === 'spelling').length,
    missingCaptions: videoErrors.filter((e) => e.type === 'missing_caption')
      .length,
    timing: videoErrors.filter((e) => e.type === 'timing').length,
  };

  const transcript: TranscriptResult = {
    text: parsed.transcript ?? '',
    segments: [],
    words: [],
  };

  return { errors: videoErrors, summary, transcript };
}

/**
 * Builds a minimal ScanResult from Gemini analysis.
 *
 * Since Gemini doesn't return frame images, we create placeholder frames
 * grouped by timestamp so the UI can still show errors organized by time.
 */
export function buildGeminiScanResult(
  fileName: string,
  errors: VideoError[],
  summary: VideoErrorSummary,
  transcript: TranscriptResult,
  frameBlobs: Blob[],
  frameTimestamps: number[],
  frameUrls: string[],
): ScanResult {
  // Build frames from extracted video frames
  const frames: FrameResult[] = frameBlobs.map((_, i) => {
    const timestamp = frameTimestamps[i] ?? i;
    const frameErrors = errors.filter(
      (e) => Math.floor(e.timestamp) === timestamp,
    );
    // Update frameIndex to match our frame indices
    for (const err of frameErrors) {
      err.frameIndex = i;
    }

    const emptyOcr: OCRResult = { words: [], text: '', confidence: 0 };

    return {
      frameIndex: i,
      timestamp,
      thumbnailUrl: frameUrls[i],
      ocrResult: emptyOcr,
      errors: [],
      videoErrors: frameErrors.length > 0 ? frameErrors : undefined,
    };
  });

  // Assign any errors that didn't match a frame timestamp to the closest frame
  const assignedTimestamps = new Set(
    frames.flatMap((f) => (f.videoErrors ?? []).map((e) => e.timestamp)),
  );
  const unassigned = errors.filter((e) => !assignedTimestamps.has(e.timestamp));
  for (const err of unassigned) {
    let closestIdx = 0;
    let closestDist = Infinity;
    for (let i = 0; i < frames.length; i++) {
      const dist = Math.abs(frames[i].timestamp - err.timestamp);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    }
    err.frameIndex = closestIdx;
    if (!frames[closestIdx].videoErrors) {
      frames[closestIdx].videoErrors = [];
    }
    frames[closestIdx].videoErrors!.push(err);
  }

  const totalErrors = errors.filter((e) => e.severity === 'error').length;

  return {
    type: 'video',
    fileName,
    scanDate: new Date().toLocaleString(),
    totalErrors,
    frames,
    transcript,
    videoErrorSummary: summary,
  };
}

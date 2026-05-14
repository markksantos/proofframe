export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BoundingBox;
}

export interface OCRResult {
  words: OCRWord[];
  text: string;
  confidence: number;
}

export type ProofingMode = 'visual_only' | 'audio_aware';

export interface ProviderStatus {
  name: string;
  status: 'success' | 'failed' | 'skipped';
  confidence?: number;
  wordCount?: number;
  error?: string;
}

export interface ScanCompleteness {
  mode: ProofingMode;
  degraded: boolean;
  notes: string[];
  transcriptionProviders: ProviderStatus[];
  consensusConfidence?: number;
  aiJudge: {
    status: 'ran' | 'skipped' | 'failed';
    model?: string;
    error?: string;
  };
}

export type ScanStage =
  | 'idle'
  | 'loading'
  | 'extracting'
  | 'transcribing'
  | 'scanning'
  | 'spellchecking'
  | 'analyzing'
  | 'complete'
  | 'error';

export interface ScanProgress {
  stage: ScanStage;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

export interface SpellingError {
  word: string;
  suggestions: string[];
  confidence: number;
  bbox: BoundingBox;
  frameIndex?: number;
}

export interface FrameResult {
  frameIndex: number;
  timestamp: number;
  thumbnailUrl: string;
  ocrResult: OCRResult;
  errors: SpellingError[];
  videoErrors?: VideoError[];
}

export interface VideoErrorSummary {
  mismatches: number;
  spelling: number;
  missingCaptions: number;
  timing: number;
  unreadableText?: number;
}

export interface ScanResult {
  type: 'image' | 'video';
  fileName: string;
  scanDate: string;
  analysisSource?: 'local' | 'gemini' | 'local_fallback' | 'server_visual' | 'server_audio';
  analysisNote?: string;
  scanCompleteness?: ScanCompleteness;
  totalErrors: number;
  frames: FrameResult[];
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  transcript?: TranscriptResult;
  videoErrorSummary?: VideoErrorSummary;
}

// --- Transcript types ---

export interface TranscriptWord {
  text: string;
  startTime: number;
  endTime: number;
  confidence?: number;
}

export interface TranscriptSegment {
  text: string;
  startTime: number;
  endTime: number;
  words: TranscriptWord[];
}

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  language?: string;
}

// --- Video error types ---

export interface TextSegment {
  text: string;
  startTime: number;
  endTime: number;
  frameIndices: number[];
  ocrWords: OCRWord[];
  representativeFrameIndex?: number;
  bbox?: BoundingBox;
  confidence?: number;
}

export interface VisualTextSegment extends TextSegment {
  id: string;
  representativeFrameUrl?: string;
  cropUrl?: string;
  frameWidth?: number;
  frameHeight?: number;
  sourceFrameWordCount?: number;
  sourceFrameMedianWordHeight?: number;
  sourceLineWordCount?: number;
  nearbyWordCount?: number;
}

export type VideoErrorType =
  | 'mismatch'
  | 'spelling'
  | 'missing_caption'
  | 'timing'
  | 'unreadable_text';

export interface VideoError {
  type: VideoErrorType;
  severity: 'error' | 'warning';
  message: string;
  frameIndex: number;
  timestamp: number;
  onScreenText?: string;
  spokenText?: string;
  suggestedCorrection?: string;
  similarity?: number;
  textTime?: { start: number; end: number };
  speechTime?: { start: number; end: number };
  offsetSeconds?: number;
  spellingError?: SpellingError;
  bbox?: BoundingBox;
  confidence?: number;
  evidenceNote?: string;
  judgeDecision?: 'confirm' | 'reject' | 'needs_review';
  artifactUrl?: string;
}

export interface PricingTier {
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export interface Testimonial {
  name: string;
  role: string;
  quote: string;
  avatar: string;
}

export interface Feature {
  icon: string;
  title: string;
  description: string;
}

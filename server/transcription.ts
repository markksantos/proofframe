import { readFile } from 'node:fs/promises';
import type { ProviderStatus, TranscriptWord } from '../src/types/index.ts';
import {
  buildConsensusTranscript,
  groupTranscriptWords,
  type ConsensusTranscriptResult,
  type ProviderTranscript,
} from '../src/lib/proofing-utils.ts';

interface OpenRouterSttModel {
  name: string;
  model: string;
  confidence: number;
}

interface TranscriptionProviderResult {
  status: ProviderStatus;
  transcript?: ProviderTranscript;
}

const OPENROUTER_TRANSCRIPTIONS_URL =
  'https://openrouter.ai/api/v1/audio/transcriptions';

const OPENROUTER_STT_MODELS: OpenRouterSttModel[] = [
  {
    name: 'OpenRouter Chirp 3',
    model: 'google/chirp-3',
    confidence: 0.78,
  },
  {
    name: 'OpenRouter GPT-4o Mini Transcribe',
    model: 'openai/gpt-4o-mini-transcribe',
    confidence: 0.76,
  },
  {
    name: 'OpenRouter Whisper Large v3',
    model: 'openai/whisper-large-v3',
    confidence: 0.74,
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function getOpenRouterErrorMessage(body: string): string {
  try {
    const parsed: unknown = JSON.parse(body);
    if (isRecord(parsed) && isRecord(parsed.error)) {
      return asString(parsed.error.message) ?? body;
    }
  } catch {
    // Fall through to the plain response body.
  }

  return body;
}

function normalizeOpenRouterError(status: number, body: string): string {
  const message = getOpenRouterErrorMessage(body);
  const lowerMessage = message.toLowerCase();

  if (status === 401 || status === 403) {
    return 'OpenRouter key is invalid or unauthorized.';
  }

  if (
    status === 402 ||
    lowerMessage.includes('balance') ||
    lowerMessage.includes('credits')
  ) {
    return 'OpenRouter key needs audio credits.';
  }

  if (status === 429) {
    return 'OpenRouter rate limit reached.';
  }

  return `OpenRouter transcription failed (${status}).`;
}

function buildApproximateWords(
  text: string,
  durationSeconds: number,
  confidence: number,
): TranscriptWord[] {
  const tokens = text.match(/[\p{L}\p{N}'-]+/gu) ?? [];
  if (tokens.length === 0) return [];

  const duration = Math.max(0.5, durationSeconds);
  const step = duration / tokens.length;

  return tokens.map((token, index) => ({
    text: token,
    startTime: step * index,
    endTime: step * (index + 1),
    confidence,
  }));
}

function createProviderTranscript(
  model: OpenRouterSttModel,
  text: string,
  durationSeconds: number,
): ProviderTranscript {
  const words = buildApproximateWords(text, durationSeconds, model.confidence);

  return {
    provider: model.name,
    text,
    words,
    segments: groupTranscriptWords(words),
    confidence: model.confidence,
  };
}

async function transcribeWithOpenRouter(
  audioPath: string,
  apiKey: string,
  durationSeconds: number,
  model: OpenRouterSttModel,
): Promise<TranscriptionProviderResult> {
  if (!apiKey) {
    return {
      status: {
        name: model.name,
        status: 'skipped',
        error: 'OpenRouter API key missing',
      },
    };
  }

  try {
    const audio = await readFile(audioPath);
    const response = await fetch(OPENROUTER_TRANSCRIPTIONS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model.model,
        language: 'en',
        input_audio: {
          data: audio.toString('base64'),
          format: 'wav',
        },
      }),
    });

    if (!response.ok) {
      throw new Error(
        normalizeOpenRouterError(response.status, await response.text()),
      );
    }

    const data: unknown = await response.json();
    const record = isRecord(data) ? data : {};
    const text = asString(record.text)?.trim() ?? '';
    const transcript = createProviderTranscript(model, text, durationSeconds);

    return {
      status: {
        name: model.name,
        status: 'success',
        confidence: transcript.confidence,
        wordCount: transcript.words.length,
      },
      transcript,
    };
  } catch (error) {
    return {
      status: {
        name: model.name,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

export function getOpenRouterSkippedTranscriptionStatuses(
  reason: string,
): ProviderStatus[] {
  return OPENROUTER_STT_MODELS.map((model) => ({
    name: model.name,
    status: 'skipped',
    error: reason,
  }));
}

export async function buildTranscriptionConsensus(
  audioPath: string,
  openRouterApiKey: string,
  durationSeconds: number,
): Promise<ConsensusTranscriptResult> {
  const results = await Promise.all(
    OPENROUTER_STT_MODELS.map((model) =>
      transcribeWithOpenRouter(
        audioPath,
        openRouterApiKey,
        durationSeconds,
        model,
      ),
    ),
  );

  const transcripts = results
    .map((result) => result.transcript)
    .filter((transcript): transcript is ProviderTranscript => Boolean(transcript));
  const consensus = buildConsensusTranscript(transcripts);

  return {
    ...consensus,
    providers: results.map((result) => result.status),
  };
}

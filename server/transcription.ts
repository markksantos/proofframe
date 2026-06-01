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

// OpenRouter does not expose a dedicated speech-to-text REST endpoint. Audio is
// transcribed through the standard chat completions endpoint by sending an
// `input_audio` content part to a multimodal model that accepts audio input.
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Three real, audio-capable OpenRouter models. Running the same clip through
// independent models gives the consensus layer something meaningful to vote on.
// These can be overridden with PROOFFRAME_STT_MODELS (comma-separated ids).
const DEFAULT_STT_MODELS: OpenRouterSttModel[] = [
  {
    name: 'OpenRouter Gemini 2.5 Flash',
    model: 'google/gemini-2.5-flash',
    confidence: 0.8,
  },
  {
    name: 'OpenRouter Gemini 2.0 Flash',
    model: 'google/gemini-2.0-flash-001',
    confidence: 0.76,
  },
  {
    name: 'OpenRouter GPT-4o Audio',
    model: 'openai/gpt-audio',
    confidence: 0.78,
  },
];

function resolveSttModels(): OpenRouterSttModel[] {
  const override = process.env.PROOFFRAME_STT_MODELS?.trim();
  if (!override) return DEFAULT_STT_MODELS;

  const models = override
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .map((model, index) => ({
      name: `OpenRouter ${model}`,
      model,
      confidence: 0.78 - index * 0.02,
    }));

  return models.length > 0 ? models : DEFAULT_STT_MODELS;
}

const TRANSCRIPTION_PROMPT =
  'Transcribe the spoken words in this audio verbatim. Return only the transcript text with no commentary, labels, timestamps, or quotation marks. If there is no intelligible speech, return an empty string.';

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

  if (status === 404 || lowerMessage.includes('not a valid model')) {
    return 'OpenRouter audio model is unavailable.';
  }

  return `OpenRouter transcription failed (${status}).`;
}

function extractChatText(data: unknown): string {
  if (!isRecord(data)) return '';
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(first.message) ? first.message : {};
  const content = message.content;

  if (typeof content === 'string') return content.trim();

  // Some providers return content as an array of parts.
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        isRecord(part) && typeof part.text === 'string' ? part.text : '',
      )
      .join(' ')
      .trim();
  }

  return '';
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
  audioBase64: string,
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
    const response = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-Title': 'ProofFrame Local Engine',
      },
      body: JSON.stringify({
        model: model.model,
        temperature: 0,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: TRANSCRIPTION_PROMPT },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  format: 'wav',
                },
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(
        normalizeOpenRouterError(response.status, await response.text()),
      );
    }

    const text = extractChatText(await response.json());

    if (!text) {
      return {
        status: {
          name: model.name,
          status: 'success',
          confidence: model.confidence,
          wordCount: 0,
        },
      };
    }

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
  return resolveSttModels().map((model) => ({
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
  const models = resolveSttModels();
  const audioBase64 = (await readFile(audioPath)).toString('base64');

  const results = await Promise.all(
    models.map((model) =>
      transcribeWithOpenRouter(
        audioBase64,
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

import type { ScanCompleteness, TranscriptResult, VideoError, VisualTextSegment } from '../src/types/index.ts';

interface JudgeDecision {
  index: number;
  decision: 'confirm' | 'reject' | 'needs_review';
  reason: string;
}

interface JudgeResult {
  errors: VideoError[];
  aiJudge: ScanCompleteness['aiJudge'];
}

const DEFAULT_JUDGE_MODEL = 'google/gemini-2.5-flash';

function getEvidencePayload(
  errors: VideoError[],
  transcript: TranscriptResult,
  visualSegments: VisualTextSegment[],
): unknown {
  return {
    transcript: transcript.text.slice(0, 8000),
    visualSegments: visualSegments.map((segment) => ({
      id: segment.id,
      text: segment.text,
      time: { start: segment.startTime, end: segment.endTime },
      confidence: segment.confidence,
      cropUrl: segment.cropUrl,
    })),
    candidateIssues: errors.map((error, index) => ({
      index,
      type: error.type,
      severity: error.severity,
      message: error.message,
      onScreenText: error.onScreenText,
      spokenText: error.spokenText,
      textTime: error.textTime,
      speechTime: error.speechTime,
      offsetSeconds: error.offsetSeconds,
      confidence: error.confidence,
      evidenceNote: error.evidenceNote,
      artifactUrl: error.artifactUrl,
    })),
  };
}

function parseJudgeDecisions(value: unknown): JudgeDecision[] {
  const root =
    typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const decisions = Array.isArray(root.decisions) ? root.decisions : [];

  return decisions.flatMap((decision) => {
    if (typeof decision !== 'object' || decision === null) return [];
    const record = decision as Record<string, unknown>;
    const index = record.index;
    const rawDecision = record.decision;
    const reason = record.reason;

    if (typeof index !== 'number') return [];
    if (
      rawDecision !== 'confirm' &&
      rawDecision !== 'reject' &&
      rawDecision !== 'needs_review'
    ) {
      return [];
    }

    return {
      index,
      decision: rawDecision,
      reason: typeof reason === 'string' ? reason : '',
    };
  });
}

export async function judgeCandidateIssues(
  errors: VideoError[],
  transcript: TranscriptResult,
  visualSegments: VisualTextSegment[],
  openRouterApiKey: string,
): Promise<JudgeResult> {
  const model = process.env.PROOFFRAME_JUDGE_MODEL ?? DEFAULT_JUDGE_MODEL;

  if (!openRouterApiKey || errors.length === 0) {
    return {
      errors,
      aiJudge: {
        status: 'skipped',
        model,
        error: openRouterApiKey ? undefined : 'OpenRouter API key missing',
      },
    };
  }

  try {
    const payload = getEvidencePayload(errors.slice(0, 40), transcript, visualSegments);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openRouterApiKey}`,
        'X-Title': 'ProofFrame Local Engine',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'You are a video editor QA judge. Review candidate ProofFrame issues and return JSON only. Confirm clear real issues, reject false positives, and mark uncertain cases needs_review. Keep issue indexes unchanged.\n\n' +
                  JSON.stringify(payload),
              },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'proofing_judge',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                decisions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      index: { type: 'number' },
                      decision: {
                        type: 'string',
                        enum: ['confirm', 'reject', 'needs_review'],
                      },
                      reason: { type: 'string' },
                    },
                    required: ['index', 'decision', 'reason'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['decisions'],
              additionalProperties: false,
            },
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter judge returned ${response.status}: ${await response.text()}`);
    }

    const data: unknown = await response.json();
    const root =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const choices = Array.isArray(root.choices) ? root.choices : [];
    const firstChoice =
      typeof choices[0] === 'object' && choices[0] !== null
        ? (choices[0] as Record<string, unknown>)
        : {};
    const message =
      typeof firstChoice.message === 'object' && firstChoice.message !== null
        ? (firstChoice.message as Record<string, unknown>)
        : {};
    const content = typeof message.content === 'string' ? message.content : '{}';
    const decisions = parseJudgeDecisions(JSON.parse(content) as unknown);
    const decisionsByIndex = new Map(decisions.map((decision) => [decision.index, decision]));
    const judgedErrors: VideoError[] = [];

    errors.forEach((error, index) => {
      const decision = decisionsByIndex.get(index);
      if (!decision) {
        judgedErrors.push({ ...error, judgeDecision: 'needs_review' });
        return;
      }

      if (decision.decision === 'reject') return;

      judgedErrors.push({
        ...error,
        severity: decision.decision === 'needs_review' ? 'warning' : error.severity,
        judgeDecision: decision.decision,
        evidenceNote: decision.reason || error.evidenceNote,
      });
    });

    return {
      errors: judgedErrors,
      aiJudge: { status: 'ran', model },
    };
  } catch (error) {
    return {
      errors,
      aiJudge: {
        status: 'failed',
        model,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

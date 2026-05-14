import {
  FileText,
  AlertTriangle,
  BarChart3,
  Calendar,
  MessageSquareOff,
  Clock,
  Type,
  EyeOff,
} from 'lucide-react';
import type { ProviderStatus, ScanCompleteness, ScanResult } from '../../types/index.ts';

interface ResultsSummaryProps {
  result: ScanResult;
}

function getCompletenessLabel(scanCompleteness: ScanCompleteness): string {
  if (scanCompleteness.mode === 'audio_aware' && !scanCompleteness.degraded) {
    return 'Transcript-aware proofing';
  }

  return 'Visible text checked';
}

function getProviderSummary(providers: ProviderStatus[]): string {
  const successful = providers.filter((provider) => provider.status === 'success');

  if (successful.length > 0) {
    return `${successful.length} transcript model${successful.length === 1 ? '' : 's'} ran`;
  }

  if (providers.some((provider) => provider.status === 'failed')) {
    return 'Transcript models unavailable';
  }

  return 'Transcript models skipped';
}

function getJudgeSummary(scanCompleteness: ScanCompleteness): string | null {
  if (scanCompleteness.aiJudge.status === 'ran') return 'AI judge ran';
  if (scanCompleteness.aiJudge.status === 'failed') return 'AI judge unavailable';
  return null;
}

export default function ResultsSummary({ result }: ResultsSummaryProps) {
  const totalFrames = result.frames.length;
  const totalErrors = result.totalErrors;
  const hasErrors = totalErrors > 0;
  const summary = result.videoErrorSummary;
  const sourceLabel = (() => {
    switch (result.analysisSource) {
      case 'server_audio':
        return 'Transcript-aware proofing';
      case 'server_visual':
        return 'Visible text checked';
      case 'gemini':
        return 'Gemini analyzed';
      case 'local_fallback':
        return 'Local OCR fallback';
      default:
        return result.type === 'video' ? 'Local OCR' : 'Image OCR';
    }
  })();

  // Average OCR confidence across all frames (Gemini results have no OCR data)
  const hasOcrData = result.frames.some((f) => f.ocrResult.confidence > 0);
  const avgConfidence =
    hasOcrData && totalFrames > 0
      ? result.frames.reduce((sum, f) => sum + f.ocrResult.confidence, 0) /
        totalFrames
      : 0;

  return (
    <div className="bg-bg-secondary border border-border rounded-2xl p-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* File name */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-bg-tertiary shrink-0">
            <FileText className="w-4 h-4 text-text-muted" />
          </div>
          <div className="min-w-0">
            <p className="text-text-muted text-xs uppercase tracking-wider">
              File
            </p>
            <p className="text-text-primary text-sm font-medium truncate">
              {result.fileName}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              {result.type === 'video' ? 'Video' : 'Image'}
            </p>
          </div>
        </div>

        {/* Total frames */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-bg-tertiary shrink-0">
            <BarChart3 className="w-4 h-4 text-text-muted" />
          </div>
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wider">
              Frames
            </p>
            <p className="text-text-primary text-sm font-medium">
              {totalFrames}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              {hasOcrData
                ? `${avgConfidence.toFixed(1)}% avg. confidence`
                : sourceLabel}
            </p>
          </div>
        </div>

        {/* Total errors */}
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg shrink-0 ${
              hasErrors ? 'bg-error-muted' : 'bg-accent-muted'
            }`}
          >
            <AlertTriangle
              className={`w-4 h-4 ${hasErrors ? 'text-error' : 'text-accent'}`}
            />
          </div>
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wider">
              Errors
            </p>
            <p
              className={`text-sm font-bold ${
                hasErrors ? 'text-error' : 'text-accent'
              }`}
            >
              {totalErrors}
            </p>
            <p className="text-text-muted text-xs mt-0.5">
              {hasErrors ? 'issues detected' : 'all clear'}
            </p>
          </div>
        </div>

        {/* Scan date */}
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-bg-tertiary shrink-0">
            <Calendar className="w-4 h-4 text-text-muted" />
          </div>
          <div>
            <p className="text-text-muted text-xs uppercase tracking-wider">
              Scanned
            </p>
            <p className="text-text-primary text-sm font-medium">
              {result.scanDate}
            </p>
          </div>
        </div>
      </div>

      {result.analysisNote && !result.scanCompleteness && (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3">
          <p className="text-warning text-xs font-medium">
            {result.analysisNote}
          </p>
        </div>
      )}

      {result.scanCompleteness && (
        <div className="mt-4 rounded-lg border border-border bg-bg-tertiary px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-text-primary text-xs font-semibold uppercase tracking-wider">
              {getCompletenessLabel(result.scanCompleteness)}
            </span>
            {result.scanCompleteness.degraded && (
              <span className="rounded bg-warning/15 px-2 py-0.5 text-warning text-xs font-medium">
                degraded
              </span>
            )}
            {result.scanCompleteness.consensusConfidence !== undefined &&
              result.scanCompleteness.consensusConfidence > 0 && (
                <span className="text-text-muted text-xs">
                  Consensus{' '}
                  {(result.scanCompleteness.consensusConfidence * 100).toFixed(0)}
                  %
                </span>
              )}
            <span className="text-text-muted text-xs">
              {getProviderSummary(result.scanCompleteness.transcriptionProviders)}
            </span>
            {getJudgeSummary(result.scanCompleteness) && (
              <span className="text-text-muted text-xs">
                {getJudgeSummary(result.scanCompleteness)}
              </span>
            )}
          </div>
          {result.scanCompleteness.notes.length > 0 && (
            <p className="text-text-muted text-xs">
              {result.scanCompleteness.notes.join(' ')}
            </p>
          )}
        </div>
      )}

      {/* Video error breakdown */}
      {summary && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-text-muted text-xs uppercase tracking-wider mb-3">
            Error Breakdown
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-error" />
              <span className="text-text-secondary text-xs">
                {summary.mismatches} mismatch{summary.mismatches !== 1 ? 'es' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Type className="w-3.5 h-3.5 text-error" />
              <span className="text-text-secondary text-xs">
                {summary.spelling} spelling
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquareOff className="w-3.5 h-3.5 text-warning" />
              <span className="text-text-secondary text-xs">
                {summary.missingCaptions} missing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-yellow-400" />
              <span className="text-text-secondary text-xs">
                {summary.timing} timing
              </span>
            </div>
            <div className="flex items-center gap-2">
              <EyeOff className="w-3.5 h-3.5 text-warning" />
              <span className="text-text-secondary text-xs">
                {summary.unreadableText ?? 0} unreadable
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

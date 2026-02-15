import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, BookPlus, AlertTriangle, Clock, MessageSquareOff, Type } from 'lucide-react';
import type { VideoError, VideoErrorType } from '../../types/index.ts';
import Button from '../ui/Button.tsx';

interface VideoErrorSidebarProps {
  errors: VideoError[];
  onAddToDictionary: (word: string) => void;
  selectedErrorIndex?: number;
}

const TYPE_CONFIG: Record<
  VideoErrorType,
  { label: string; color: string; bg: string; icon: typeof AlertTriangle }
> = {
  mismatch: {
    label: 'Mismatch',
    color: 'text-error',
    bg: 'bg-error-muted border-error/30',
    icon: AlertTriangle,
  },
  spelling: {
    label: 'Spelling',
    color: 'text-error',
    bg: 'bg-error-muted border-error/30',
    icon: Type,
  },
  missing_caption: {
    label: 'Missing',
    color: 'text-warning',
    bg: 'bg-warning/10 border-warning/30',
    icon: MessageSquareOff,
  },
  timing: {
    label: 'Timing',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
    icon: Clock,
  },
};

const FILTER_OPTIONS: Array<{ value: VideoErrorType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'mismatch', label: 'Mismatches' },
  { value: 'spelling', label: 'Spelling' },
  { value: 'missing_caption', label: 'Missing' },
  { value: 'timing', label: 'Timing' },
];

export default function VideoErrorSidebar({
  errors,
  onAddToDictionary,
  selectedErrorIndex,
}: VideoErrorSidebarProps) {
  const [filter, setFilter] = useState<VideoErrorType | 'all'>('all');
  const selectedRef = useRef<HTMLDivElement>(null);

  const filtered =
    filter === 'all' ? errors : errors.filter((e) => e.type === filter);

  // Scroll to selected error
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedErrorIndex]);

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-12 h-12 text-accent mb-4" />
        <p className="text-text-primary font-semibold">No issues found!</p>
        <p className="text-text-secondary text-sm mt-1">
          All text in this frame looks correct.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {FILTER_OPTIONS.map((opt) => {
          const count =
            opt.value === 'all'
              ? errors.length
              : errors.filter((e) => e.type === opt.value).length;
          if (count === 0 && opt.value !== 'all') return null;
          return (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-accent text-bg-primary'
                  : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
              }`}
            >
              {opt.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Error list */}
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        <p className="text-text-secondary text-xs font-mono uppercase tracking-wider">
          {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
        </p>
        <AnimatePresence mode="popLayout">
          {filtered.map((error, index) => {
            const config = TYPE_CONFIG[error.type];
            const Icon = config.icon;
            const isSelected = selectedErrorIndex === index;

            return (
              <motion.div
                key={`${error.type}-${error.frameIndex}-${index}`}
                ref={isSelected ? selectedRef : undefined}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: index * 0.03 }}
                className={`rounded-xl border p-4 transition-colors ${
                  isSelected
                    ? 'border-accent bg-accent-muted'
                    : `${config.bg}`
                }`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${config.color}`} />
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${config.color}`}
                  >
                    {config.label}
                  </span>
                  <span className="ml-auto text-text-muted text-xs font-mono">
                    {error.severity}
                  </span>
                </div>

                {/* Message */}
                <p className="text-text-primary text-sm mb-2">
                  {error.message}
                </p>

                {/* Type-specific details */}
                {error.type === 'mismatch' && (
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-text-muted">On screen: </span>
                      <span className="text-text-primary font-mono">
                        {error.onScreenText}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted">Spoken: </span>
                      <span className="text-text-primary font-mono">
                        {error.spokenText}
                      </span>
                    </div>
                  </div>
                )}

                {error.type === 'spelling' && error.spellingError && (
                  <div className="space-y-2">
                    <span className="text-error font-bold text-base">
                      {error.spellingError.word}
                    </span>
                    {error.spellingError.suggestions.length > 0 && (
                      <div>
                        <p className="text-text-muted text-xs mb-1">
                          Suggestions:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {error.spellingError.suggestions.map((s) => (
                            <span
                              key={s}
                              className="px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary text-xs font-mono"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onAddToDictionary(error.spellingError!.word)
                      }
                      className="text-text-secondary hover:text-accent gap-1.5"
                    >
                      <BookPlus className="w-3.5 h-3.5" />
                      Add to Dictionary
                    </Button>
                  </div>
                )}

                {error.type === 'missing_caption' && error.spokenText && (
                  <div className="text-xs">
                    <span className="text-text-muted">Spoken: </span>
                    <span className="text-text-primary font-mono">
                      "{error.spokenText}"
                    </span>
                  </div>
                )}

                {error.type === 'timing' && error.offsetSeconds != null && (
                  <div className="text-xs text-text-muted">
                    Offset: {Math.abs(error.offsetSeconds).toFixed(1)}s{' '}
                    {error.offsetSeconds > 0 ? 'late' : 'early'}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

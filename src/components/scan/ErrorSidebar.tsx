import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, BookPlus } from 'lucide-react';
import type { SpellingError } from '../../types/index.ts';
import Button from '../ui/Button.tsx';

interface ErrorSidebarProps {
  errors: SpellingError[];
  onAddToDictionary: (word: string) => void;
  selectedError?: SpellingError;
}

export default function ErrorSidebar({
  errors,
  onAddToDictionary,
  selectedError,
}: ErrorSidebarProps) {
  const selectedRef = useRef<HTMLDivElement>(null);

  // Scroll to selected error when it changes
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedError]);

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle className="w-12 h-12 text-accent mb-4" />
        <p className="text-text-primary font-semibold">
          No spelling errors found!
        </p>
        <p className="text-text-secondary text-sm mt-1">
          All text in this frame looks correct.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <p className="text-text-secondary text-xs font-mono uppercase tracking-wider mb-2">
        {errors.length} error{errors.length !== 1 ? 's' : ''} found
      </p>
      <AnimatePresence mode="popLayout">
        {errors.map((error, index) => {
          const isSelected =
            selectedError &&
            selectedError.word === error.word &&
            selectedError.bbox.x0 === error.bbox.x0 &&
            selectedError.bbox.y0 === error.bbox.y0;

          return (
            <motion.div
              key={`${error.word}-${error.bbox.x0}-${error.bbox.y0}-${index}`}
              ref={isSelected ? selectedRef : undefined}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-xl border p-4 transition-colors ${
                isSelected
                  ? 'border-accent bg-accent-muted'
                  : 'border-border bg-bg-secondary hover:border-border-hover'
              }`}
            >
              {/* Misspelled word */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-error font-bold text-base">
                  {error.word}
                </span>
                <span className="text-text-muted text-xs font-mono">
                  {error.confidence.toFixed(0)}%
                </span>
              </div>

              {/* Suggestions */}
              {error.suggestions.length > 0 ? (
                <div className="mb-3">
                  <p className="text-text-muted text-xs mb-1">Suggestions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {error.suggestions.map((suggestion) => (
                      <span
                        key={suggestion}
                        className="px-2 py-0.5 rounded bg-bg-tertiary text-text-secondary text-xs font-mono"
                      >
                        {suggestion}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-text-muted text-xs mb-3">
                  No suggestions available
                </p>
              )}

              {/* Add to dictionary button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddToDictionary(error.word)}
                className="text-text-secondary hover:text-accent gap-1.5"
              >
                <BookPlus className="w-3.5 h-3.5" />
                Add to Dictionary
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

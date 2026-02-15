import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Plus, X, BookOpen } from 'lucide-react';
import {
  getCustomWords,
  addCustomWord,
  removeCustomWord,
} from '../../lib/custom-dictionary.ts';
import Button from '../ui/Button.tsx';

interface CustomDictionaryPanelProps {
  onWordAdded?: () => void;
}

export default function CustomDictionaryPanel({
  onWordAdded,
}: CustomDictionaryPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [words, setWords] = useState<string[]>(() => getCustomWords());
  const [inputValue, setInputValue] = useState('');

  const refreshWords = useCallback(() => {
    setWords(getCustomWords());
  }, []);

  const handleAddWord = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    addCustomWord(trimmed);
    setInputValue('');
    refreshWords();
    onWordAdded?.();
  }, [inputValue, refreshWords, onWordAdded]);

  const handleRemoveWord = useCallback(
    (word: string) => {
      removeCustomWord(word);
      refreshWords();
      onWordAdded?.();
    },
    [refreshWords, onWordAdded]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddWord();
      }
    },
    [handleAddWord]
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-bg-secondary hover:bg-bg-tertiary transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-text-muted" />
          <span className="text-text-primary text-sm font-medium">
            Custom Dictionary
          </span>
          {words.length > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-bg-tertiary text-text-muted">
              {words.length}
            </span>
          )}
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-text-muted" />
        </motion.div>
      </button>

      {/* Collapsible content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-border space-y-3">
              {/* Add word input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a word..."
                  className="flex-1 bg-bg-tertiary border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleAddWord}
                  disabled={!inputValue.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Word list */}
              {words.length === 0 ? (
                <p className="text-text-muted text-xs text-center py-2">
                  No custom words added yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  <AnimatePresence mode="popLayout">
                    {words.map((word) => (
                      <motion.div
                        key={word}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        layout
                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-tertiary border border-border text-sm text-text-secondary"
                      >
                        <span className="font-mono text-xs">{word}</span>
                        <button
                          onClick={() => handleRemoveWord(word)}
                          className="p-0.5 rounded hover:bg-error-muted hover:text-error transition-colors"
                          aria-label={`Remove "${word}" from dictionary`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

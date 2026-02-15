import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cpu, Sparkles, Eye, EyeOff, Info } from 'lucide-react';
import type { AnalysisMode } from '../../lib/scan-settings.ts';
import {
  getOpenRouterApiKey,
  setOpenRouterApiKey,
  getAnalysisMode,
  setAnalysisMode,
} from '../../lib/scan-settings.ts';

interface ScanSettingsProps {
  onModeChange: (mode: AnalysisMode) => void;
}

export default function ScanSettings({ onModeChange }: ScanSettingsProps) {
  const [mode, setMode] = useState<AnalysisMode>(getAnalysisMode);
  const [apiKey, setApiKey] = useState(getOpenRouterApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleModeChange = useCallback(
    (newMode: AnalysisMode) => {
      setMode(newMode);
      setAnalysisMode(newMode);
      onModeChange(newMode);
    },
    [onModeChange],
  );

  const handleApiKeyChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setApiKey(value);
      setOpenRouterApiKey(value);
    },
    [],
  );

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        {/* Analysis mode toggle */}
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-text-muted text-xs uppercase tracking-wider font-medium">
            Analysis Mode
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Local option */}
          <button
            onClick={() => handleModeChange('local')}
            className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
              mode === 'local'
                ? 'border-accent bg-accent-muted'
                : 'border-border hover:border-border-hover bg-bg-tertiary'
            }`}
          >
            <Cpu
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                mode === 'local' ? 'text-accent' : 'text-text-muted'
              }`}
            />
            <div>
              <p
                className={`text-sm font-semibold ${
                  mode === 'local' ? 'text-accent' : 'text-text-primary'
                }`}
              >
                Local
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                Whisper + OCR in browser. Free, private, no API key needed.
              </p>
            </div>
            {mode === 'local' && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
              />
            )}
          </button>

          {/* Gemini option */}
          <button
            onClick={() => handleModeChange('gemini')}
            className={`relative flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-colors ${
              mode === 'gemini'
                ? 'border-accent bg-accent-muted'
                : 'border-border hover:border-border-hover bg-bg-tertiary'
            }`}
          >
            <Sparkles
              className={`w-5 h-5 shrink-0 mt-0.5 ${
                mode === 'gemini' ? 'text-accent' : 'text-text-muted'
              }`}
            />
            <div>
              <p
                className={`text-sm font-semibold ${
                  mode === 'gemini' ? 'text-accent' : 'text-text-primary'
                }`}
              >
                Gemini AI
              </p>
              <p className="text-text-muted text-xs mt-0.5">
                Gemini via OpenRouter. Faster, contextual analysis. Requires API key.
              </p>
            </div>
            {mode === 'gemini' && (
              <motion.div
                layoutId="mode-indicator"
                className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent"
              />
            )}
          </button>
        </div>

        {/* Gemini API key input (only shown when Gemini mode) */}
        {mode === 'gemini' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label className="block">
              <span className="text-text-secondary text-xs font-medium">
                OpenRouter API Key
              </span>
              <div className="relative mt-1.5">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="sk-or-..."
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-tertiary border border-border text-text-primary text-sm font-mono placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
              <p className="text-text-muted text-xs mt-1.5">
                Get your key at{' '}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  openrouter.ai/keys
                </a>
                . Stored locally in your browser.
              </p>
            </label>
          </motion.div>
        )}
      </div>
    </div>
  );
}

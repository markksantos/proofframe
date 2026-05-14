import { useState, useCallback } from 'react';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import {
  getOpenRouterApiKey,
  setOpenRouterApiKey,
} from '../../lib/scan-settings.ts';

export default function ScanSettings() {
  const [apiKey, setApiKey] = useState(getOpenRouterApiKey);
  const [showKey, setShowKey] = useState(false);

  const handleApiKeyChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setApiKey(value);
      setOpenRouterApiKey(value);
    },
    [],
  );

  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="bg-bg-secondary border border-border rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-bg-tertiary shrink-0">
            <KeyRound className="w-4 h-4 text-accent" />
          </div>
          <div className="min-w-0 flex-1">
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
                  onClick={() => setShowKey((visible) => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </label>
            <p className="text-text-muted text-xs mt-2">
              Optional. Add a key for transcript-aware proofing and AI evidence
              judging. Without it, ProofFrame still checks visible text.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

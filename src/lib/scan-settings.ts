const API_KEY_STORAGE_KEY = 'proofframe_openrouter_api_key';
const MODE_STORAGE_KEY = 'proofframe_analysis_mode';

export type AnalysisMode = 'local' | 'gemini';

export function getOpenRouterApiKey(): string {
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

export function setOpenRouterApiKey(key: string): void {
  if (key.trim()) {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  } else {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }
}

export function getAnalysisMode(): AnalysisMode {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  if (stored === 'gemini') return 'gemini';
  return 'local';
}

export function setAnalysisMode(mode: AnalysisMode): void {
  localStorage.setItem(MODE_STORAGE_KEY, mode);
}

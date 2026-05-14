const OPENROUTER_API_KEY_STORAGE_KEY = 'proofframe_openrouter_api_key';

export function getOpenRouterApiKey(): string {
  return localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY) ?? '';
}

export function setOpenRouterApiKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY);
  }
}

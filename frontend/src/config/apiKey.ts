/**
 * The viewer's own OpenRouter key.
 *
 * Stored under its own key rather than inside the document session state, so
 * it is never written into the same blob as resume content and never travels
 * with an exported or restored session. It is sent only to this app's
 * /analyze endpoint, which forwards it to OpenRouter and never persists it.
 */
const STORAGE_KEY = 'resumelilt.openrouter-key';

export function getApiKey(): string {
    try {
        return window.localStorage.getItem(STORAGE_KEY) ?? '';
    } catch {
        return '';
    }
}

export function setApiKey(key: string): void {
    try {
        const trimmed = key.trim();
        if (trimmed) {
            window.localStorage.setItem(STORAGE_KEY, trimmed);
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        console.warn('This browser would not save the API key.');
    }
}

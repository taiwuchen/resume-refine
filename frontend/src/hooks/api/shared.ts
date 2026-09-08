import { getApiKey } from '../../config/apiKey';

export async function readErrorDetail(response: Response, fallbackMessage: string): Promise<string> {
    try {
        const error = await response.json();
        if (typeof error.detail === 'string') return error.detail;
        // FastAPI reports validation failures as a list of issues.
        if (Array.isArray(error.detail) && error.detail[0]?.msg) return error.detail[0].msg;
        return fallbackMessage;
    } catch {
        return fallbackMessage;
    }
}

/** Proves ownership of a document. Issued once, at upload. */
export function documentHeaders(token: string | null): Record<string, string> {
    return token ? { 'X-Document-Token': token } : {};
}

/** The viewer's own OpenRouter key, read at call time so a freshly entered
 *  key takes effect without a reload. */
export function apiKeyHeaders(): Record<string, string> {
    const key = getApiKey();
    return key ? { 'X-OpenRouter-Key': key } : {};
}

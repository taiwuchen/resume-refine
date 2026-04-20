import { API_BASE } from '../../config/api';
import type { Suggestion } from '../../types';
import { readErrorDetail } from './shared';

export async function analyzeResume(
    docId: string,
    jobDescription: string,
): Promise<Suggestion[]> {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, job_description: jobDescription }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Analysis failed'));
    }

    const data = await response.json();
    return data.suggestions;
}

export async function getSuggestions(
    docId: string,
    paragraphId: string,
    start: number,
    end: number,
    selectedText: string,
    jobDescription: string,
    userPrompt?: string,
): Promise<Suggestion> {
    const response = await fetch(`${API_BASE}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            doc_id: docId,
            paragraph_id: paragraphId,
            start,
            end,
            selected_text: selectedText,
            job_description: jobDescription,
            user_prompt: userPrompt,
        }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Suggestion failed'));
    }

    const data = await response.json();
    return data.suggestion;
}

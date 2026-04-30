import { API_BASE } from '../../config/api';
import type { AnalyzeResult, Change, Suggestion } from '../../types';
import { readErrorDetail } from './shared';

export async function analyzeResume(
    docId: string,
    jobDescription: string,
    changes: Change[] = [],
    generateNewPass = false,
): Promise<AnalyzeResult> {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            doc_id: docId,
            job_description: jobDescription,
            changes,
            generate_new_pass: generateNewPass,
        }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Analysis failed'));
    }

    return response.json();
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

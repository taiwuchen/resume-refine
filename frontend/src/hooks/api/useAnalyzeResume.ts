import { API_BASE } from '../../config/api';
import type { AnalyzeResult, Change } from '../../types';
import { readErrorDetail } from './shared';

export async function analyzeResume(docId: string, jobDescription: string, changes: Change[]): Promise<AnalyzeResult> {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, job_description: jobDescription, changes }),
    });
    if (!response.ok) throw new Error(await readErrorDetail(response, 'Analysis failed'));
    return response.json();
}

import { API_BASE } from '../../config/api';
import type { Change } from '../../types';
import { readErrorDetail } from './shared';

export async function exportResume(docId: string, changes: Change[]): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, changes }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Export failed'));
    }

    return response.blob();
}

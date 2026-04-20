import { API_BASE } from '../../config/api';
import type { Change } from '../../types';
import { readErrorDetail } from './shared';

export async function fetchPreviewPdf(docId: string, changes: Change[]): Promise<Blob> {
    const response = await fetch(`${API_BASE}/document/${docId}/preview-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changes }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'PDF preview failed'));
    }

    return response.blob();
}

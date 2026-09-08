import { API_BASE } from '../../config/api';
import type { Change } from '../../types';
import { documentHeaders, readErrorDetail } from './shared';

export async function fetchPreviewPdf(
    docId: string,
    token: string | null,
    changes: Change[],
    signal?: AbortSignal,
): Promise<Blob> {
    const response = await fetch(`${API_BASE}/document/${docId}/preview-pdf`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', ...documentHeaders(token) },
        body: JSON.stringify({ changes }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'PDF preview failed'));
    }

    return response.blob();
}

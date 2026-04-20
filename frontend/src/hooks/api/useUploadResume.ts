import { API_BASE } from '../../config/api';
import type { ParsedDocument } from '../../types';
import { readErrorDetail } from './shared';

export async function uploadResume(file: File): Promise<ParsedDocument> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Upload failed'));
    }

    return response.json();
}

import { API_BASE } from '../../config/api';
import type { ChatEdit } from '../../types';
import { readErrorDetail } from './shared';

export interface ChatApiMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatApiResponse {
    message: string;
    edits: ChatEdit[];
}

export async function sendChatMessage(
    docId: string,
    jobDescription: string,
    messages: ChatApiMessage[],
): Promise<ChatApiResponse> {
    const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            doc_id: docId,
            job_description: jobDescription,
            messages,
        }),
    });

    if (!response.ok) {
        throw new Error(await readErrorDetail(response, 'Chat failed'));
    }

    return response.json();
}

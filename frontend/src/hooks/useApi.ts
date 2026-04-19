import type { ParsedDocument, Suggestion, Change, ChatEdit } from '../types';

const API_BASE = 'http://localhost:8000/api';

export async function uploadResume(file: File): Promise<ParsedDocument> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
}

export async function analyzeResume(
    docId: string,
    jobDescription: string
): Promise<Suggestion[]> {
    const response = await fetch(`${API_BASE}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, job_description: jobDescription }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
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
    userPrompt?: string
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
        const error = await response.json();
        throw new Error(error.detail || 'Suggestion failed');
    }

    const data = await response.json();
    return data.suggestion;
}

export async function exportResume(
    docId: string,
    changes: Change[]
): Promise<Blob> {
    const response = await fetch(`${API_BASE}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_id: docId, changes }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Export failed');
    }

    return response.blob();
}

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
    messages: ChatApiMessage[]
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
        const error = await response.json();
        throw new Error(error.detail || 'Chat failed');
    }

    return response.json();
}

export interface Suggestion {
    id: string;
    paragraph_id: string;
    start: number;
    end: number;
    original_text: string;
    alternatives: string[];
}

export interface ChatEdit {
    paragraph_id: string;
    start: number;
    end: number;
    original_text: string;
    new_text: string;
    explanation: string;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    edits?: ChatEdit[];
}

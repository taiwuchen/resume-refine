export interface PositionMapping {
    start: number;
    end: number;
    para_idx: number;
    run_idx: number;
}

export interface ParsedDocument {
    doc_id: string;
    full_text: string;
    position_map: PositionMapping[];
}

export interface Suggestion {
    id: string;
    start: number;
    end: number;
    original_text: string;
    alternatives: string[];
}

export interface Change {
    start: number;
    end: number;
    original: string;
    replacement: string;
}

export interface ChatEdit {
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

export interface Suggestion {
    id: string;
    paragraph_id: string;
    start: number;
    end: number;
    original_text: string;
    alternatives: string[];
    reason: string;
    state: 'open' | 'accepted';
    applied_text?: string;
}

export interface AnalyzeResult {
    suggestions: Omit<Suggestion, 'state' | 'applied_text'>[];
}

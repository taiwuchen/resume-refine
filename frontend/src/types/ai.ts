export interface Suggestion {
    id: string;
    paragraph_id: string;
    start: number;
    end: number;
    original_text: string;
    alternatives: string[];
    issue_key: string | null;
    category: string;
    severity: 'critical' | 'recommended' | 'optional';
    state: 'open' | 'accepted' | 'dismissed' | 'regenerated';
    reason: string;
    source: 'analysis' | 'chat' | 'manual';
    parent_suggestion_id: string | null;
    applied_text?: string | null;
}

export interface AnalyzeResult {
    analysis_id: string;
    resume_version_id: string;
    resume_hash: string;
    job_description_hash: string;
    readiness_score: number;
    status: string;
    cache_hit: boolean;
    suggestions: Suggestion[];
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

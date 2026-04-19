export interface PositionMapping {
    start: number;
    end: number;
    para_idx: number;
    run_idx: number;
}

export interface ParagraphRun {
    text: string;
    start: number;
    end: number;
    bold: boolean;
    italic: boolean;
    underline: boolean;
    href: string | null;
    is_hyperlink: boolean;
}

export interface Paragraph {
    paragraph_id: string;
    start: number;
    end: number;
    text: string;
    runs: ParagraphRun[];
    is_editable: boolean;
    is_list_item: boolean;
    list_level: number;
}

export interface ParsedDocument {
    doc_id: string;
    full_text: string;
    position_map: PositionMapping[];
    paragraphs: Paragraph[];
}

export interface Suggestion {
    id: string;
    paragraph_id: string;
    start: number;
    end: number;
    original_text: string;
    alternatives: string[];
}

export interface Change {
    paragraph_id: string;
    start: number;
    end: number;
    original: string;
    replacement: string;
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

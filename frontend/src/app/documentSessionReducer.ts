import type { AnalyzeResult, Change, ParsedDocument, Suggestion } from '../types';
import { upsertParagraphChange } from '../utils/changeState';

interface UndoEntry {
    changes: Change[];
    suggestions: Suggestion[];
    jobDescription: string;
}

export interface DocumentSessionState {
    document: ParsedDocument | null;
    jobDescription: string;
    suggestions: Suggestion[];
    changes: Change[];
    undoStack: UndoEntry[];
    activeParagraphId: string | null;
    hasAnalyzed: boolean;
    revision: number;
}

export type DocumentSessionAction =
    | { type: 'uploadSuccess'; document: ParsedDocument }
    | { type: 'setJobDescription'; jobDescription: string }
    | { type: 'analyzeSuccess'; result: AnalyzeResult; revision: number }
    | { type: 'acceptSuggestion'; suggestionId: string; replacement: string }
    | { type: 'dismissSuggestion'; suggestionId: string }
    | { type: 'undo' }
    | { type: 'setActiveParagraph'; paragraphId: string | null };

export const initialDocumentSessionState: DocumentSessionState = {
    document: null,
    jobDescription: '',
    suggestions: [],
    changes: [],
    undoStack: [],
    activeParagraphId: null,
    hasAnalyzed: false,
    revision: 0,
};

export function documentSessionReducer(state: DocumentSessionState, action: DocumentSessionAction): DocumentSessionState {
    switch (action.type) {
        case 'uploadSuccess':
            return { ...initialDocumentSessionState, document: action.document,
                jobDescription: state.jobDescription, revision: state.revision + 1 };
        case 'setJobDescription':
            return { ...state, jobDescription: action.jobDescription, suggestions: [],
                activeParagraphId: null, hasAnalyzed: false, revision: state.revision + 1 };
        case 'analyzeSuccess':
            if (action.revision !== state.revision) return state;
            return { ...state, suggestions: action.result.suggestions.map(suggestion => ({ ...suggestion, state: 'open' })),
                hasAnalyzed: true, activeParagraphId: action.result.suggestions[0]?.paragraph_id ?? null };
        case 'acceptSuggestion': {
            const suggestion = state.suggestions.find(candidate => candidate.id === action.suggestionId);
            const paragraph = state.document?.paragraphs.find(candidate => candidate.paragraph_id === suggestion?.paragraph_id);
            if (!suggestion || suggestion.state !== 'open' || !paragraph || !suggestion.alternatives.includes(action.replacement)) return state;
            const currentText = state.changes.find(change => change.paragraph_id === paragraph.paragraph_id)?.replacement ?? paragraph.text;
            if (currentText !== suggestion.original_text) return state;
            return { ...state,
                undoStack: [...state.undoStack, { changes: state.changes, suggestions: state.suggestions, jobDescription: state.jobDescription }],
                changes: upsertParagraphChange(state.changes, {
                    paragraph_id: paragraph.paragraph_id, start: paragraph.start, end: paragraph.end,
                    original: paragraph.text, replacement: action.replacement,
                }),
                suggestions: state.suggestions.map(candidate => candidate.id === suggestion.id
                    ? { ...candidate, state: 'accepted', applied_text: action.replacement } : candidate),
                activeParagraphId: paragraph.paragraph_id, revision: state.revision + 1,
            };
        }
        case 'dismissSuggestion':
            return { ...state, suggestions: state.suggestions.filter(suggestion => suggestion.id !== action.suggestionId),
                undoStack: state.undoStack.map(entry => ({ ...entry,
                    suggestions: entry.suggestions.filter(suggestion => suggestion.id !== action.suggestionId),
                })) };
        case 'undo': {
            const previous = state.undoStack.at(-1);
            if (!previous) return state;
            const sameJob = previous.jobDescription === state.jobDescription;
            return { ...state, changes: previous.changes, suggestions: sameJob ? previous.suggestions : [],
                undoStack: state.undoStack.slice(0, -1), hasAnalyzed: sameJob,
                activeParagraphId: null, revision: state.revision + 1 };
        }
        case 'setActiveParagraph':
            return { ...state, activeParagraphId: action.paragraphId };
    }
}

import type { Change, ChatEdit, ChatMessage, ParsedDocument, Suggestion } from '../types';
import { removeChangeByParagraphId, upsertParagraphChange } from '../utils/changeState';

export interface DocumentSessionState {
    document: ParsedDocument | null;
    jobDescription: string;
    suggestions: Suggestion[];
    changes: Change[];
    chatMessages: ChatMessage[];
    activeParagraphId: string | null;
    isAnalyzing: boolean;
    isExporting: boolean;
    isChatLoading: boolean;
}

export type DocumentSessionAction =
    | { type: 'uploadSuccess'; document: ParsedDocument }
    | { type: 'setJobDescription'; jobDescription: string }
    | { type: 'analyzeStart' }
    | { type: 'analyzeSuccess'; suggestions: Suggestion[] }
    | { type: 'analyzeFailure' }
    | { type: 'refreshSuggestionSuccess'; suggestionId: string; suggestion: Suggestion }
    | { type: 'acceptSuggestion'; suggestion: Suggestion; replacement: string }
    | { type: 'dismissSuggestion'; suggestionId: string }
    | { type: 'revertChange'; paragraphId: string }
    | { type: 'setActiveParagraph'; paragraphId: string | null }
    | { type: 'chatStart'; userMessage: ChatMessage }
    | { type: 'chatSuccess'; assistantMessage: ChatMessage }
    | { type: 'chatFailure'; errorMessage: ChatMessage }
    | { type: 'clearChat' }
    | { type: 'acceptChatEdit'; edit: ChatEdit }
    | { type: 'rejectChatEdit'; messageId: string; editIndex: number }
    | { type: 'exportStart' }
    | { type: 'exportSuccess' }
    | { type: 'exportFailure' };

export const initialDocumentSessionState: DocumentSessionState = {
    document: null,
    jobDescription: '',
    suggestions: [],
    changes: [],
    chatMessages: [],
    activeParagraphId: null,
    isAnalyzing: false,
    isExporting: false,
    isChatLoading: false,
};

export function documentSessionReducer(
    state: DocumentSessionState,
    action: DocumentSessionAction,
): DocumentSessionState {
    switch (action.type) {
        case 'uploadSuccess':
            return {
                ...state,
                document: action.document,
                suggestions: [],
                changes: [],
                chatMessages: [],
                activeParagraphId: null,
                isAnalyzing: false,
                isExporting: false,
                isChatLoading: false,
            };
        case 'setJobDescription':
            return {
                ...state,
                jobDescription: action.jobDescription,
            };
        case 'analyzeStart':
            return {
                ...state,
                isAnalyzing: true,
            };
        case 'analyzeSuccess':
            return {
                ...state,
                suggestions: action.suggestions,
                activeParagraphId: action.suggestions[0]?.paragraph_id ?? null,
                isAnalyzing: false,
            };
        case 'analyzeFailure':
            return {
                ...state,
                isAnalyzing: false,
            };
        case 'refreshSuggestionSuccess':
            return {
                ...state,
                suggestions: state.suggestions.map((currentSuggestion) => (
                    currentSuggestion.id === action.suggestionId ? action.suggestion : currentSuggestion
                )),
                activeParagraphId: action.suggestion.paragraph_id,
            };
        case 'acceptSuggestion': {
            const nextChange: Change = {
                paragraph_id: action.suggestion.paragraph_id,
                start: action.suggestion.start,
                end: action.suggestion.end,
                original: action.suggestion.original_text,
                replacement: action.replacement,
            };

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                activeParagraphId: action.suggestion.paragraph_id,
            };
        }
        case 'dismissSuggestion': {
            const nextSuggestions = state.suggestions.filter((suggestion) => suggestion.id !== action.suggestionId);
            const removedSuggestion = state.suggestions.find((suggestion) => suggestion.id === action.suggestionId);

            return {
                ...state,
                suggestions: nextSuggestions,
                activeParagraphId: removedSuggestion?.paragraph_id === state.activeParagraphId
                    ? nextSuggestions[0]?.paragraph_id ?? null
                    : state.activeParagraphId,
            };
        }
        case 'revertChange':
            return {
                ...state,
                changes: removeChangeByParagraphId(state.changes, action.paragraphId),
                activeParagraphId: action.paragraphId,
            };
        case 'setActiveParagraph':
            return {
                ...state,
                activeParagraphId: action.paragraphId,
            };
        case 'chatStart':
            return {
                ...state,
                chatMessages: [...state.chatMessages, action.userMessage],
                isChatLoading: true,
            };
        case 'chatSuccess':
            return {
                ...state,
                chatMessages: [...state.chatMessages, action.assistantMessage],
                isChatLoading: false,
            };
        case 'chatFailure':
            return {
                ...state,
                chatMessages: [...state.chatMessages, action.errorMessage],
                isChatLoading: false,
            };
        case 'clearChat':
            return {
                ...state,
                chatMessages: [],
            };
        case 'acceptChatEdit': {
            const nextChange: Change = {
                paragraph_id: action.edit.paragraph_id,
                start: action.edit.start,
                end: action.edit.end,
                original: action.edit.original_text,
                replacement: action.edit.new_text,
            };

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                activeParagraphId: action.edit.paragraph_id,
                chatMessages: state.chatMessages.map((message) => ({
                    ...message,
                    edits: message.edits?.filter((candidate) => !(
                        candidate.paragraph_id === action.edit.paragraph_id
                        && candidate.new_text === action.edit.new_text
                    )),
                })),
            };
        }
        case 'rejectChatEdit':
            return {
                ...state,
                chatMessages: state.chatMessages.map((message) => {
                    if (message.id !== action.messageId) {
                        return message;
                    }

                    return {
                        ...message,
                        edits: message.edits?.filter((_, editIndex) => editIndex !== action.editIndex),
                    };
                }),
            };
        case 'exportStart':
            return {
                ...state,
                isExporting: true,
            };
        case 'exportSuccess':
        case 'exportFailure':
            return {
                ...state,
                isExporting: false,
            };
        default:
            return state;
    }
}

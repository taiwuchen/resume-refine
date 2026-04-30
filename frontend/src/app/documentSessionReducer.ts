import type { Change, ChatEdit, ChatMessage, ParsedDocument, Suggestion } from '../types';
import { removeChangeByParagraphId, upsertParagraphChange } from '../utils/changeState';

export interface DocumentSessionState {
    document: ParsedDocument | null;
    jobDescription: string;
    suggestions: Suggestion[];
    changes: Change[];
    chatMessages: ChatMessage[];
    activeParagraphId: string | null;
    activeSuggestionId: string | null;
    activeAnalysisId: string | null;
    resumeVersionId: string | null;
    readinessScore: number | null;
    analysisCacheHit: boolean;
    isAnalysisStale: boolean;
    isAnalyzing: boolean;
    isExporting: boolean;
    isChatLoading: boolean;
}

export type DocumentSessionAction =
    | { type: 'uploadSuccess'; document: ParsedDocument }
    | { type: 'setJobDescription'; jobDescription: string }
    | { type: 'analyzeStart' }
    | {
        type: 'analyzeSuccess';
        suggestions: Suggestion[];
        analysisId: string;
        resumeVersionId: string;
        readinessScore: number;
        cacheHit: boolean;
    }
    | { type: 'analyzeFailure' }
    | { type: 'refreshSuggestionSuccess'; suggestionId: string; suggestion: Suggestion }
    | { type: 'acceptSuggestion'; suggestion: Suggestion; replacement: string }
    | { type: 'dismissSuggestion'; suggestionId: string }
    | { type: 'addChatSuggestion'; edit: ChatEdit; parentSuggestionId: string | null }
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
    activeSuggestionId: null,
    activeAnalysisId: null,
    resumeVersionId: null,
    readinessScore: null,
    analysisCacheHit: false,
    isAnalysisStale: false,
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
                activeSuggestionId: null,
                activeAnalysisId: null,
                resumeVersionId: null,
                readinessScore: null,
                analysisCacheHit: false,
                isAnalysisStale: false,
                isAnalyzing: false,
                isExporting: false,
                isChatLoading: false,
            };
        case 'setJobDescription':
            return {
                ...state,
                jobDescription: action.jobDescription,
                isAnalysisStale: state.suggestions.length > 0,
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
                activeAnalysisId: action.analysisId,
                resumeVersionId: action.resumeVersionId,
                readinessScore: action.readinessScore,
                analysisCacheHit: action.cacheHit,
                isAnalysisStale: false,
                activeParagraphId: action.suggestions[0]?.paragraph_id ?? null,
                activeSuggestionId: action.suggestions[0]?.id ?? null,
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
                    currentSuggestion.id === action.suggestionId
                        ? { ...action.suggestion, state: 'regenerated', parent_suggestion_id: action.suggestionId }
                        : currentSuggestion
                )),
                activeParagraphId: action.suggestion.paragraph_id,
                activeSuggestionId: action.suggestion.id,
            };
        case 'acceptSuggestion': {
            const existingChange = state.changes.find(
                (change) => change.paragraph_id === action.suggestion.paragraph_id
            );
            const nextChange: Change = {
                paragraph_id: action.suggestion.paragraph_id,
                start: action.suggestion.start,
                end: action.suggestion.end,
                original: existingChange?.original ?? action.suggestion.original_text,
                replacement: action.replacement,
            };

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                suggestions: state.suggestions.map((suggestion) => (
                    suggestion.id === action.suggestion.id
                        ? { ...suggestion, state: 'accepted' }
                        : suggestion
                )),
                activeParagraphId: action.suggestion.paragraph_id,
                activeSuggestionId: action.suggestion.id,
                isAnalysisStale: true,
            };
        }
        case 'dismissSuggestion': {
            const nextSuggestions: Suggestion[] = state.suggestions.map((suggestion) => (
                suggestion.id === action.suggestionId ? { ...suggestion, state: 'dismissed' as const } : suggestion
            ));
            const removedSuggestion = state.suggestions.find((suggestion) => suggestion.id === action.suggestionId);

            return {
                ...state,
                suggestions: nextSuggestions,
                activeParagraphId: removedSuggestion?.paragraph_id === state.activeParagraphId
                    ? nextSuggestions.find((suggestion) => suggestion.state === 'open')?.paragraph_id ?? null
                    : state.activeParagraphId,
                activeSuggestionId: removedSuggestion?.id === state.activeSuggestionId
                    ? nextSuggestions.find((suggestion) => suggestion.state === 'open')?.id ?? null
                    : state.activeSuggestionId,
            };
        }
        case 'addChatSuggestion': {
            const nextSuggestion: Suggestion = {
                id: `chat-${Date.now()}`,
                paragraph_id: action.edit.paragraph_id,
                start: action.edit.start,
                end: action.edit.end,
                original_text: action.edit.original_text,
                alternatives: [action.edit.new_text],
                issue_key: null,
                category: 'general',
                severity: 'recommended',
                state: 'open',
                reason: action.edit.explanation,
                source: 'chat',
                parent_suggestion_id: action.parentSuggestionId,
            };

            return {
                ...state,
                suggestions: [...state.suggestions, nextSuggestion],
                activeParagraphId: nextSuggestion.paragraph_id,
                activeSuggestionId: nextSuggestion.id,
            };
        }
        case 'revertChange':
            return {
                ...state,
                changes: removeChangeByParagraphId(state.changes, action.paragraphId),
                activeParagraphId: action.paragraphId,
                isAnalysisStale: true,
            };
        case 'setActiveParagraph':
            return {
                ...state,
                activeParagraphId: action.paragraphId,
                activeSuggestionId: state.suggestions.find(
                    (suggestion) => suggestion.paragraph_id === action.paragraphId
                )?.id ?? null,
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
            const existingChange = state.changes.find(
                (change) => change.paragraph_id === action.edit.paragraph_id
            );
            const nextChange: Change = {
                paragraph_id: action.edit.paragraph_id,
                start: action.edit.start,
                end: action.edit.end,
                original: existingChange?.original ?? action.edit.original_text,
                replacement: action.edit.new_text,
            };

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                activeParagraphId: action.edit.paragraph_id,
                activeSuggestionId: state.suggestions.find(
                    (suggestion) => suggestion.paragraph_id === action.edit.paragraph_id
                )?.id ?? state.activeSuggestionId,
                isAnalysisStale: true,
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

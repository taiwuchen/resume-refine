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
    isJobDescriptionLocked: boolean;
    chatDraft: string;
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
        preserveHistory: boolean;
    }
    | { type: 'analyzeFailure' }
    | { type: 'refreshSuggestionSuccess'; suggestionId: string; suggestion: Suggestion }
    | { type: 'acceptSuggestion'; suggestion: Suggestion; replacement: string }
    | { type: 'dismissSuggestion'; suggestionId: string }
    | { type: 'reopenSuggestion'; suggestionId: string }
    | { type: 'addChatSuggestion'; edit: ChatEdit; parentSuggestionId: string | null }
    | { type: 'revertChange'; paragraphId: string }
    | { type: 'setActiveParagraph'; paragraphId: string | null }
    | { type: 'setActiveSuggestion'; suggestionId: string | null }
    | { type: 'chatStart'; userMessage: ChatMessage }
    | { type: 'chatSuccess'; assistantMessage: ChatMessage }
    | { type: 'chatFailure'; errorMessage: ChatMessage }
    | { type: 'clearChat' }
    | { type: 'setChatDraft'; chatDraft: string }
    | { type: 'acceptChatEdit'; edit: ChatEdit }
    | { type: 'rejectChatEdit'; messageId: string; editIndex: number }
    | { type: 'resetSession' }
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
    isJobDescriptionLocked: false,
    chatDraft: '',
    isAnalyzing: false,
    isExporting: false,
    isChatLoading: false,
};

const severityPenalties: Record<Suggestion['severity'], number> = {
    critical: 10,
    recommended: 5,
    optional: 2,
};

function calculateReadinessScore(suggestions: Suggestion[]): number {
    const totalPenalty = suggestions.reduce((total, suggestion) => {
        if (suggestion.state === 'accepted' || suggestion.state === 'dismissed') {
            return total;
        }

        return total + severityPenalties[suggestion.severity];
    }, 0);

    return Math.max(0, Math.min(100, 100 - totalPenalty));
}

function getNextOpenSuggestion(suggestions: Suggestion[]): Suggestion | null {
    return suggestions.find((suggestion) => (
        suggestion.state === 'open' || suggestion.state === 'regenerated'
    )) ?? null;
}

function normalizeIncomingSuggestion(suggestion: Suggestion): Suggestion {
    return {
        ...suggestion,
        applied_text: suggestion.state === 'accepted' ? suggestion.applied_text ?? null : null,
    };
}

function sortSuggestionsByDocumentLocation(
    suggestions: Suggestion[],
    document: ParsedDocument | null,
): Suggestion[] {
    const paragraphOrder = new Map(
        document?.paragraphs.map((paragraph, index) => [
            paragraph.paragraph_id,
            { index, start: paragraph.start, end: paragraph.end },
        ]) ?? []
    );

    return suggestions
        .map((suggestion, originalIndex) => ({ suggestion, originalIndex }))
        .sort((a, b) => {
            const aLocation = paragraphOrder.get(a.suggestion.paragraph_id);
            const bLocation = paragraphOrder.get(b.suggestion.paragraph_id);

            if (!aLocation && !bLocation) {
                return a.originalIndex - b.originalIndex;
            }

            if (!aLocation) {
                return -1;
            }

            if (!bLocation) {
                return 1;
            }

            return (
                aLocation.index - bLocation.index
                || a.suggestion.start - b.suggestion.start
                || a.suggestion.end - b.suggestion.end
                || a.originalIndex - b.originalIndex
            );
        })
        .map(({ suggestion }) => suggestion);
}

export function documentSessionReducer(
    state: DocumentSessionState,
    action: DocumentSessionAction,
): DocumentSessionState {
    switch (action.type) {
        case 'uploadSuccess':
            return {
                ...initialDocumentSessionState,
                document: action.document,
            };
        case 'setJobDescription':
            if (state.isJobDescriptionLocked) {
                return state;
            }

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
        case 'analyzeSuccess': {
            const incomingSuggestions = action.suggestions.map(normalizeIncomingSuggestion);
            const history = action.preserveHistory
                ? state.suggestions.filter((suggestion) => (
                    suggestion.state === 'accepted' || suggestion.state === 'dismissed'
                ))
                : [];
            const nextSuggestions = sortSuggestionsByDocumentLocation(
                [...history, ...incomingSuggestions],
                state.document,
            );
            const activeSuggestion = getNextOpenSuggestion(nextSuggestions) ?? nextSuggestions[0] ?? null;

            return {
                ...state,
                suggestions: nextSuggestions,
                activeAnalysisId: action.analysisId,
                resumeVersionId: action.resumeVersionId,
                readinessScore: calculateReadinessScore(nextSuggestions),
                analysisCacheHit: action.cacheHit,
                isAnalysisStale: false,
                isJobDescriptionLocked: true,
                activeParagraphId: activeSuggestion?.paragraph_id ?? null,
                activeSuggestionId: activeSuggestion?.id ?? null,
                isAnalyzing: false,
            };
        }
        case 'analyzeFailure':
            return {
                ...state,
                isAnalyzing: false,
            };
        case 'refreshSuggestionSuccess': {
            const nextSuggestions = state.suggestions.map((currentSuggestion) => (
                currentSuggestion.id === action.suggestionId
                    ? {
                        ...action.suggestion,
                        state: 'regenerated' as const,
                        parent_suggestion_id: action.suggestionId,
                        applied_text: null,
                    }
                    : currentSuggestion
            ));

            return {
                ...state,
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: action.suggestion.paragraph_id,
                activeSuggestionId: action.suggestion.id,
            };
        }
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

            const nextSuggestions: Suggestion[] = state.suggestions.map((suggestion) => {
                if (suggestion.id === action.suggestion.id) {
                    return { ...suggestion, state: 'accepted' as const, applied_text: action.replacement };
                }

                if (suggestion.paragraph_id === action.suggestion.paragraph_id && suggestion.state === 'accepted') {
                    return { ...suggestion, state: 'open' as const, applied_text: null };
                }

                return suggestion;
            });

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: action.suggestion.paragraph_id,
                activeSuggestionId: action.suggestion.id,
            };
        }
        case 'dismissSuggestion': {
            const nextSuggestions: Suggestion[] = state.suggestions.map((suggestion) => (
                suggestion.id === action.suggestionId
                    ? { ...suggestion, state: 'dismissed' as const, applied_text: null }
                    : suggestion
            ));
            const removedSuggestion = state.suggestions.find((suggestion) => suggestion.id === action.suggestionId);
            const nextOpenSuggestion = getNextOpenSuggestion(nextSuggestions);

            return {
                ...state,
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: removedSuggestion?.paragraph_id === state.activeParagraphId
                    ? nextOpenSuggestion?.paragraph_id ?? null
                    : state.activeParagraphId,
                activeSuggestionId: removedSuggestion?.id === state.activeSuggestionId
                    ? nextOpenSuggestion?.id ?? null
                    : state.activeSuggestionId,
            };
        }
        case 'reopenSuggestion': {
            const reopenedSuggestion = state.suggestions.find((suggestion) => suggestion.id === action.suggestionId);
            const nextSuggestions: Suggestion[] = state.suggestions.map((suggestion) => (
                suggestion.id === action.suggestionId && suggestion.state === 'dismissed'
                    ? { ...suggestion, state: 'open' as const, applied_text: null }
                    : suggestion
            ));

            return {
                ...state,
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: reopenedSuggestion?.paragraph_id ?? state.activeParagraphId,
                activeSuggestionId: reopenedSuggestion?.id ?? state.activeSuggestionId,
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
                applied_text: null,
            };

            const nextSuggestions = sortSuggestionsByDocumentLocation(
                [...state.suggestions, nextSuggestion],
                state.document,
            );

            return {
                ...state,
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: nextSuggestion.paragraph_id,
                activeSuggestionId: nextSuggestion.id,
            };
        }
        case 'revertChange': {
            const nextSuggestions = state.suggestions.map((suggestion) => (
                suggestion.paragraph_id === action.paragraphId && suggestion.state === 'accepted'
                    ? { ...suggestion, state: 'open' as const, applied_text: null }
                    : suggestion
            ));

            return {
                ...state,
                changes: removeChangeByParagraphId(state.changes, action.paragraphId),
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: action.paragraphId,
                activeSuggestionId: nextSuggestions.find((suggestion) => (
                    suggestion.paragraph_id === action.paragraphId
                    && (suggestion.state === 'open' || suggestion.state === 'regenerated')
                ))?.id ?? state.activeSuggestionId,
            };
        }
        case 'setActiveParagraph':
            return {
                ...state,
                activeParagraphId: action.paragraphId,
                activeSuggestionId: state.suggestions.find(
                    (suggestion) => (
                        suggestion.paragraph_id === action.paragraphId
                        && (suggestion.state === 'open' || suggestion.state === 'regenerated')
                    )
                )?.id ?? state.suggestions.find(
                    (suggestion) => suggestion.paragraph_id === action.paragraphId
                )?.id ?? null,
            };
        case 'setActiveSuggestion': {
            const activeSuggestion = state.suggestions.find((suggestion) => suggestion.id === action.suggestionId);

            return {
                ...state,
                activeParagraphId: activeSuggestion?.paragraph_id ?? null,
                activeSuggestionId: activeSuggestion?.id ?? null,
            };
        }
        case 'chatStart':
            return {
                ...state,
                chatMessages: [...state.chatMessages, action.userMessage],
                chatDraft: '',
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
        case 'setChatDraft':
            return {
                ...state,
                chatDraft: action.chatDraft,
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
            const nextSuggestion: Suggestion = {
                id: `chat-applied-${Date.now()}`,
                paragraph_id: action.edit.paragraph_id,
                start: action.edit.start,
                end: action.edit.end,
                original_text: action.edit.original_text,
                alternatives: [action.edit.new_text],
                issue_key: `chat-${action.edit.paragraph_id}-${Date.now()}`,
                category: 'general',
                severity: 'recommended',
                state: 'accepted',
                reason: action.edit.explanation,
                source: 'chat',
                parent_suggestion_id: state.activeSuggestionId,
                applied_text: action.edit.new_text,
            };
            const nextSuggestions = sortSuggestionsByDocumentLocation(
                [
                    ...state.suggestions.map((suggestion) => (
                        suggestion.paragraph_id === action.edit.paragraph_id && suggestion.state === 'accepted'
                            ? { ...suggestion, state: 'open' as const, applied_text: null }
                            : suggestion
                    )),
                    nextSuggestion,
                ],
                state.document,
            );

            return {
                ...state,
                changes: upsertParagraphChange(state.changes, nextChange),
                suggestions: nextSuggestions,
                readinessScore: state.readinessScore === null ? null : calculateReadinessScore(nextSuggestions),
                activeParagraphId: action.edit.paragraph_id,
                activeSuggestionId: nextSuggestion.id,
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
        case 'resetSession':
            return initialDocumentSessionState;
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

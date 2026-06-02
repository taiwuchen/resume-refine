import { useState, useRef, useEffect, useMemo } from 'react';
import type { Suggestion, ChatMessage, ChatEdit } from '../types';
import './Sidebar.css';

function scrollChildIntoContainer(container: HTMLElement, child: HTMLElement) {
    const containerRect = container.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    let nextScrollTop = container.scrollTop;

    if (childRect.top < containerRect.top) {
        nextScrollTop += childRect.top - containerRect.top;
    } else if (childRect.bottom > containerRect.bottom) {
        nextScrollTop += childRect.bottom - containerRect.bottom;
    } else {
        return;
    }

    container.scrollTo({
        top: Math.max(0, Math.min(nextScrollTop, container.scrollHeight - container.clientHeight)),
        behavior: 'smooth',
    });
}

function formatSuggestionLabel(value: string) {
    return value === 'accepted' ? 'applied' : value.replace(/_/g, ' ');
}

function isOpenSuggestion(suggestion: Suggestion) {
    return suggestion.state === 'open' || suggestion.state === 'regenerated';
}

interface SidebarProps {
    activeTab: 'suggestions' | 'chat';
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    activeSuggestionId: string | null;
    activeSuggestion: Suggestion | null;
    readinessScore: number | null;
    analysisCacheHit: boolean;
    isAnalysisStale: boolean;
    chatDraft: string;
    onChatDraftChange: (value: string) => void;
    onActiveTabChange: (activeTab: 'suggestions' | 'chat') => void;
    onAcceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
    onDismissSuggestion: (suggestionId: string) => void;
    onRefreshSuggestion: (suggestion: Suggestion) => void;
    onGenerateAnotherPass: () => void;
    onSelectSuggestion: (suggestionId: string | null) => void;
    onAskSuggestion: (suggestion: Suggestion) => void;
    onRevertSuggestion: (suggestion: Suggestion) => void;
    isAnalyzing: boolean;
    chatMessages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    onUseEditAsSuggestion: (edit: ChatEdit) => void;
    onAcceptEdit: (edit: ChatEdit) => void;
    onRejectEdit: (messageId: string, editIndex: number) => void;
    isChatLoading: boolean;
    hasDocument: boolean;
}

export function Sidebar({
    activeTab,
    suggestions,
    activeParagraphId,
    activeSuggestionId,
    activeSuggestion,
    readinessScore,
    analysisCacheHit,
    isAnalysisStale,
    chatDraft,
    onChatDraftChange,
    onActiveTabChange,
    onAcceptSuggestion,
    onDismissSuggestion,
    onRefreshSuggestion,
    onGenerateAnotherPass,
    onSelectSuggestion,
    onAskSuggestion,
    onRevertSuggestion,
    isAnalyzing,
    chatMessages,
    onSendMessage,
    onClearChat,
    onUseEditAsSuggestion,
    onAcceptEdit,
    onRejectEdit,
    isChatLoading,
    hasDocument,
}: SidebarProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
    const chatMessagesRef = useRef<HTMLDivElement>(null);
    const suggestionsListRef = useRef<HTMLDivElement>(null);
    const suggestionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const visibleExpandedId = expandedId;
    const openSuggestions = useMemo(
        () => suggestions.filter(isOpenSuggestion),
        [suggestions]
    );
    const historicalSuggestions = useMemo(
        () => suggestions.filter((suggestion) => !isOpenSuggestion(suggestion)),
        [suggestions]
    );

    useEffect(() => {
        if (activeTab !== 'chat') return;
        const chatMessagesElement = chatMessagesRef.current;
        if (!chatMessagesElement) return;

        chatMessagesElement.scrollTo({
            top: chatMessagesElement.scrollHeight,
            behavior: 'smooth',
        });
    }, [activeTab, chatMessages.length, isChatLoading]);

    useEffect(() => {
        setExpandedId(activeSuggestionId);
    }, [activeSuggestionId]);

    useEffect(() => {
        if (!activeSuggestionId) return;

        const activeSuggestionIsHistorical = historicalSuggestions.some(
            (suggestion) => suggestion.id === activeSuggestionId
        );
        if (activeSuggestionIsHistorical) {
            setIsHistoryExpanded(true);
        }
    }, [activeSuggestionId, historicalSuggestions]);

    useEffect(() => {
        if (activeTab !== 'suggestions' || !visibleExpandedId) return;

        const suggestionsListElement = suggestionsListRef.current;
        const suggestionCardElement = suggestionCardRefs.current[visibleExpandedId];
        if (!suggestionsListElement || !suggestionCardElement) return;

        scrollChildIntoContainer(suggestionsListElement, suggestionCardElement);
    }, [activeTab, visibleExpandedId, isHistoryExpanded]);

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatDraft.trim() || isChatLoading || !hasDocument) return;
        onSendMessage(chatDraft);
    };

    const renderSuggestionCard = (suggestion: Suggestion) => {
        const isExpanded = visibleExpandedId === suggestion.id;
        const isApplied = suggestion.state === 'accepted';
        const isDismissed = suggestion.state === 'dismissed';
        const canRevert = isApplied || isDismissed;
        const appliedText = suggestion.applied_text ?? null;

        return (
            <div
                key={suggestion.id}
                ref={(node) => {
                    suggestionCardRefs.current[suggestion.id] = node;
                }}
                className={`suggestion-card ${isExpanded ? 'expanded' : ''} ${activeParagraphId === suggestion.paragraph_id ? 'active' : ''} ${suggestion.state}`}
            >
                <div
                    className="suggestion-header"
                    onClick={() => {
                        onActiveTabChange('suggestions');
                        onSelectSuggestion(suggestion.id);
                        setExpandedId(isExpanded ? null : suggestion.id);
                    }}
                >
                    <div className="suggestion-summary">
                        <div className="suggestion-badges">
                            <span className={`suggestion-status ${suggestion.state}`}>
                                {formatSuggestionLabel(suggestion.state)}
                            </span>
                            <span className={`suggestion-severity ${suggestion.severity}`}>
                                {formatSuggestionLabel(suggestion.severity)}
                            </span>
                        </div>
                        <p className="original-text">{suggestion.original_text}</p>
                        {suggestion.reason && (
                            <p className="suggestion-reason">{suggestion.reason}</p>
                        )}
                    </div>
                    <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                </div>

                {isExpanded && (
                    <div className="suggestion-options">
                        <div className="options-header">
                            <span>Alternatives</span>
                            <div className="option-actions">
                                <button
                                    className="action-btn refresh"
                                    onClick={() => onRefreshSuggestion(suggestion)}
                                    title="Refresh"
                                    disabled={suggestion.state === 'dismissed' || isApplied}
                                >
                                    ↻
                                </button>
                                <button
                                    className="ask-suggestion-btn"
                                    onClick={() => onAskSuggestion(suggestion)}
                                >
                                    {isApplied ? 'Review applied edit' : 'Ask about this'}
                                </button>
                                {isOpenSuggestion(suggestion) && (
                                    <button
                                        className="action-btn dismiss"
                                        onClick={() => onDismissSuggestion(suggestion.id)}
                                        title="Dismiss"
                                    >
                                        ×
                                    </button>
                                )}
                            </div>
                        </div>

                        {canRevert && (
                            <div className="applied-note">
                                <div>
                                    <span>{isApplied ? 'Applied edit' : 'Dismissed suggestion'}</span>
                                    {appliedText && <p>{appliedText}</p>}
                                </div>
                                <button
                                    type="button"
                                    className="applied-note-revert"
                                    onClick={() => onRevertSuggestion(suggestion)}
                                >
                                    Revert
                                </button>
                            </div>
                        )}

                        {suggestion.alternatives.map((alt, idx) => (
                            <button
                                key={idx}
                                className={`alternative-btn ${appliedText === alt ? 'selected' : ''}`}
                                onClick={() => onAcceptSuggestion(suggestion, alt)}
                                disabled={suggestion.state === 'dismissed'}
                            >
                                <span className="alt-number">{idx + 1}</span>
                                <span className="alt-text">{alt}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-tabs" role="tablist" aria-label="Right panel sections">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'suggestions'}
                    className={`sidebar-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
                    onClick={() => onActiveTabChange('suggestions')}
                >
                    <span className="section-title">
                        Suggestions {suggestions.length > 0 && `(${openSuggestions.length} open)`}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'chat'}
                    className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => onActiveTabChange('chat')}
                >
                    <span className="section-title">Chat</span>
                </button>
            </div>

            <div className="tab-panel">
                {activeTab === 'suggestions' && (
                    <div className="tab-view suggestions-tab" role="tabpanel">
                        <div className="tab-view-header">
                            <span className="section-title">
                                Suggestions {suggestions.length > 0 && `(${openSuggestions.length} open)`}
                            </span>
                            {suggestions.length > 0 && (
                                <button
                                    type="button"
                                    className="generate-pass-btn"
                                    onClick={onGenerateAnotherPass}
                                    disabled={isAnalyzing}
                                >
                                    Generate another pass
                                </button>
                            )}
                        </div>

                        {(readinessScore !== null || analysisCacheHit || isAnalysisStale) && (
                            <div className="analysis-status">
                                {readinessScore !== null && (
                                    <div>
                                        <span className="analysis-status-label">Readiness</span>
                                        <strong>{readinessScore}</strong>
                                    </div>
                                )}
                                {analysisCacheHit && <span>Already analyzed this version.</span>}
                                {isAnalysisStale && <span>Resume changed since last analysis.</span>}
                            </div>
                        )}

                        {isAnalyzing && (
                            <div className="loading-state">
                                <div className="spinner" />
                                <span>Analyzing resume...</span>
                            </div>
                        )}

                        {!isAnalyzing && suggestions.length === 0 && (
                            <div className="empty-state">
                                <p>Click "Analyze" to get suggestions</p>
                            </div>
                        )}

                        {!isAnalyzing && suggestions.length > 0 && (
                            <div className="suggestions-list" ref={suggestionsListRef}>
                                {openSuggestions.length === 0 && (
                                    <div className="empty-state compact">
                                        <p>No open suggestions</p>
                                    </div>
                                )}
                                {openSuggestions.map(renderSuggestionCard)}
                                {historicalSuggestions.length > 0 && (
                                    <div className="suggestion-history">
                                        <button
                                            type="button"
                                            className="history-toggle"
                                            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
                                        >
                                            Applied and dismissed history ({historicalSuggestions.length}) {isHistoryExpanded ? '▲' : '▼'}
                                        </button>
                                        {isHistoryExpanded && historicalSuggestions.map(renderSuggestionCard)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'chat' && (
                    <div className="tab-view chat-tab" role="tabpanel">
                        <div className="tab-view-header">
                            <span className="section-title">Chat</span>
                            {chatMessages.length > 0 && (
                                <button className="clear-chat-btn" onClick={onClearChat}>
                                    Clear
                                </button>
                            )}
                        </div>

                        {activeSuggestion && (
                            <div className="chat-suggestion-context">
                                <span className="analysis-status-label">
                                    {activeSuggestion.state === 'accepted' ? 'Applied suggestion' : 'Active suggestion'}
                                </span>
                                <p>{activeSuggestion.reason || activeSuggestion.original_text}</p>
                            </div>
                        )}

                        <div className="chat-messages" ref={chatMessagesRef}>
                            {chatMessages.length === 0 && !isChatLoading && (
                                <div className="chat-empty">
                                    <p>Ask anything about your resume</p>
                                    <p className="chat-hint">e.g., "What skills am I missing?" or "Make my summary more impactful"</p>
                                </div>
                            )}

                            {chatMessages.map((msg) => (
                                <div key={msg.id} className={`chat-message ${msg.role}`}>
                                    <div className="message-content">{msg.content}</div>

                                    {msg.edits && msg.edits.length > 0 && (
                                        <div className="message-edits">
                                            <div className="edits-label">Suggested edits:</div>
                                            {msg.edits.map((edit, idx) => (
                                                <div key={idx} className="edit-card">
                                                    <div className="edit-diff">
                                                        <div className="diff-old">
                                                            <span className="diff-label">Current:</span>
                                                            <span className="diff-text">{edit.original_text}</span>
                                                        </div>
                                                        <div className="diff-new">
                                                            <span className="diff-label">Suggested:</span>
                                                            <span className="diff-text">{edit.new_text}</span>
                                                        </div>
                                                        {edit.explanation && (
                                                            <div className="diff-explanation">{edit.explanation}</div>
                                                        )}
                                                    </div>
                                                    <div className="edit-actions">
                                                        <button
                                                            className="edit-use"
                                                            onClick={() => onUseEditAsSuggestion(edit)}
                                                        >
                                                            Use as suggestion
                                                        </button>
                                                        <button
                                                            className="edit-accept"
                                                            onClick={() => onAcceptEdit(edit)}
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            className="edit-reject"
                                                            onClick={() => onRejectEdit(msg.id, idx)}
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isChatLoading && (
                                <div className="chat-message assistant loading">
                                    <div className="typing-indicator">
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <form className="chat-input-form" onSubmit={handleChatSubmit}>
                            <input
                                type="text"
                                className="chat-input"
                                placeholder={hasDocument ? "Ask about your resume..." : "Upload a resume first"}
                                value={chatDraft}
                                onChange={(e) => onChatDraftChange(e.target.value)}
                                disabled={isChatLoading || !hasDocument}
                            />
                            <button
                                type="submit"
                                className="chat-submit"
                                disabled={!chatDraft.trim() || isChatLoading || !hasDocument}
                            >
                                {isChatLoading ? '...' : '→'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </aside>
    );
}

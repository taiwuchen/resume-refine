import { useState, useRef, useEffect, useMemo } from 'react';
import type { Suggestion, ChatMessage, ChatEdit, Change } from '../types';
import './Sidebar.css';

interface SidebarProps {
    suggestions: Suggestion[];
    changes: Change[];
    activeParagraphId: string | null;
    onAcceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
    onDismissSuggestion: (suggestionId: string) => void;
    onRefreshSuggestion: (suggestion: Suggestion) => void;
    onSelectSuggestion: (paragraphId: string | null) => void;
    onRevertSuggestion: (paragraphId: string) => void;
    isAnalyzing: boolean;
    chatMessages: ChatMessage[];
    onSendMessage: (message: string) => void;
    onClearChat: () => void;
    onAcceptEdit: (edit: ChatEdit) => void;
    onRejectEdit: (messageId: string, editIndex: number) => void;
    isChatLoading: boolean;
    hasDocument: boolean;
}

export function Sidebar({
    suggestions,
    changes,
    activeParagraphId,
    onAcceptSuggestion,
    onDismissSuggestion,
    onRefreshSuggestion,
    onSelectSuggestion,
    onRevertSuggestion,
    isAnalyzing,
    chatMessages,
    onSendMessage,
    onClearChat,
    onAcceptEdit,
    onRejectEdit,
    isChatLoading,
    hasDocument,
}: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'suggestions' | 'chat'>('suggestions');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const suggestionCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const changedParagraphIds = useMemo(
        () => new Set(changes.map((change) => change.paragraph_id)),
        [changes]
    );
    const pendingCount = useMemo(
        () => suggestions.filter((suggestion) => !changedParagraphIds.has(suggestion.paragraph_id)).length,
        [changedParagraphIds, suggestions]
    );

    useEffect(() => {
        if (activeTab !== 'chat') return;
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeTab, chatMessages]);

    useEffect(() => {
        if (!activeParagraphId) return;
        const activeSuggestion = suggestions.find((suggestion) => suggestion.paragraph_id === activeParagraphId);
        if (!activeSuggestion) return;

        setActiveTab('suggestions');
        setExpandedId(activeSuggestion.id);
        suggestionCardRefs.current[activeSuggestion.id]?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
        });
    }, [activeParagraphId, suggestions]);

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim() || isChatLoading || !hasDocument) return;
        onSendMessage(chatInput);
        setChatInput('');
    };

    return (
        <aside className="sidebar">
            <div className="sidebar-tabs" role="tablist" aria-label="Right panel sections">
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'suggestions'}
                    className={`sidebar-tab ${activeTab === 'suggestions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('suggestions')}
                >
                    <span className="section-title">
                        Suggestions {suggestions.length > 0 && `(${pendingCount} pending)`}
                    </span>
                </button>
                <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'chat'}
                    className={`sidebar-tab ${activeTab === 'chat' ? 'active' : ''}`}
                    onClick={() => setActiveTab('chat')}
                >
                    <span className="section-title">Chat</span>
                </button>
            </div>

            <div className="tab-panel">
                {activeTab === 'suggestions' && (
                    <div className="tab-view suggestions-tab" role="tabpanel">
                        <div className="tab-view-header">
                            <span className="section-title">
                                Suggestions {suggestions.length > 0 && `(${pendingCount} pending)`}
                            </span>
                        </div>

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
                            <div className="suggestions-list">
                                {suggestions.map((suggestion) => (
                                    <div
                                        key={suggestion.id}
                                        ref={(node) => {
                                            suggestionCardRefs.current[suggestion.id] = node;
                                        }}
                                        className={`suggestion-card ${expandedId === suggestion.id ? 'expanded' : ''} ${activeParagraphId === suggestion.paragraph_id ? 'active' : ''} ${changedParagraphIds.has(suggestion.paragraph_id) ? 'applied' : 'pending'}`}
                                    >
                                        <div
                                            className="suggestion-header"
                                            onClick={() => {
                                                setActiveTab('suggestions');
                                                onSelectSuggestion(suggestion.paragraph_id);
                                                setExpandedId(expandedId === suggestion.id ? null : suggestion.id);
                                            }}
                                        >
                                            <div className="suggestion-summary">
                                                <div className={`suggestion-status ${changedParagraphIds.has(suggestion.paragraph_id) ? 'applied' : 'pending'}`}>
                                                    {changedParagraphIds.has(suggestion.paragraph_id) ? 'Applied' : 'Pending'}
                                                </div>
                                                <p className="original-text">{suggestion.original_text}</p>
                                            </div>
                                            <span className="expand-icon">{expandedId === suggestion.id ? '▲' : '▼'}</span>
                                        </div>

                                        {expandedId === suggestion.id && (
                                            <div className="suggestion-options">
                                                <div className="options-header">
                                                    <span>Alternatives</span>
                                                    <div className="option-actions">
                                                        {changedParagraphIds.has(suggestion.paragraph_id) && (
                                                            <button
                                                                className="action-btn revert"
                                                                onClick={() => onRevertSuggestion(suggestion.paragraph_id)}
                                                                title="Revert"
                                                            >
                                                                ↺
                                                            </button>
                                                        )}
                                                        <button
                                                            className="action-btn refresh"
                                                            onClick={() => onRefreshSuggestion(suggestion)}
                                                            title="Refresh"
                                                        >
                                                            ↻
                                                        </button>
                                                        {!changedParagraphIds.has(suggestion.paragraph_id) && (
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

                                                {changedParagraphIds.has(suggestion.paragraph_id) && (
                                                    <div className="applied-note">
                                                        This suggestion is currently applied in the document.
                                                    </div>
                                                )}

                                                {suggestion.alternatives.map((alt, idx) => (
                                                    <button
                                                        key={idx}
                                                        className="alternative-btn"
                                                        onClick={() => onAcceptSuggestion(suggestion, alt)}
                                                    >
                                                        <span className="alt-number">{idx + 1}</span>
                                                        <span className="alt-text">{alt}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
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

                        <div className="chat-messages">
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

                            <div ref={messagesEndRef} />
                        </div>

                        <form className="chat-input-form" onSubmit={handleChatSubmit}>
                            <input
                                type="text"
                                className="chat-input"
                                placeholder={hasDocument ? "Ask about your resume..." : "Upload a resume first"}
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                disabled={isChatLoading || !hasDocument}
                            />
                            <button
                                type="submit"
                                className="chat-submit"
                                disabled={!chatInput.trim() || isChatLoading || !hasDocument}
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

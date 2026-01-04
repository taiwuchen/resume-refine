import { useState } from 'react';
import type { Suggestion } from '../types';
import './Sidebar.css';

interface SidebarProps {
    selectedText: string;
    suggestions: Suggestion[];
    onAcceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
    onDismissSuggestion: (suggestionId: string) => void;
    onRefreshSuggestion: (suggestion: Suggestion) => void;
    onSendPrompt: (prompt: string) => void;
    isAnalyzing: boolean;
    isChatLoading: boolean;
}

export function Sidebar({
    selectedText,
    suggestions,
    onAcceptSuggestion,
    onDismissSuggestion,
    onRefreshSuggestion,
    onSendPrompt,
    isAnalyzing,
    isChatLoading,
}: SidebarProps) {
    const [prompt, setPrompt] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim() || isChatLoading) return;
        onSendPrompt(prompt);
        setPrompt('');
    };

    return (
        <aside className="sidebar">
            {selectedText && (
                <div className="selected-section">
                    <div className="section-header">
                        <span className="section-title">Selected Text</span>
                    </div>
                    <p className="selected-text">{selectedText}</p>

                    <form className="prompt-form" onSubmit={handleSubmit}>
                        <input
                            type="text"
                            className="prompt-input"
                            placeholder="How to improve this?"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            disabled={isChatLoading}
                        />
                        <button
                            type="submit"
                            className="prompt-submit"
                            disabled={!prompt.trim() || isChatLoading}
                        >
                            {isChatLoading ? '...' : '→'}
                        </button>
                    </form>
                </div>
            )}

            <div className="suggestions-section">
                <div className="section-header">
                    <span className="section-title">
                        Suggestions {suggestions.length > 0 && `(${suggestions.length})`}
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
                        <p>Click "Analyze" to get suggestions based on the job description</p>
                    </div>
                )}

                <div className="suggestions-list">
                    {suggestions.map((suggestion) => (
                        <div
                            key={suggestion.id}
                            className={`suggestion-card ${expandedId === suggestion.id ? 'expanded' : ''}`}
                        >
                            <div
                                className="suggestion-header"
                                onClick={() => setExpandedId(expandedId === suggestion.id ? null : suggestion.id)}
                            >
                                <p className="original-text">{suggestion.original_text}</p>
                                <span className="expand-icon">{expandedId === suggestion.id ? '▲' : '▼'}</span>
                            </div>

                            {expandedId === suggestion.id && (
                                <div className="suggestion-options">
                                    <div className="options-header">
                                        <span>Alternatives</span>
                                        <div className="option-actions">
                                            <button
                                                className="action-btn refresh"
                                                onClick={() => onRefreshSuggestion(suggestion)}
                                                title="Refresh"
                                            >
                                                ↻
                                            </button>
                                            <button
                                                className="action-btn dismiss"
                                                onClick={() => onDismissSuggestion(suggestion.id)}
                                                title="Dismiss"
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>

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
            </div>
        </aside>
    );
}

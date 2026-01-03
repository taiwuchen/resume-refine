import { useEffect, useRef, useState } from 'react';
import type { Suggestion } from '../types';
import { SuggestionPopup } from './SuggestionPopup';
import './ResumePreview.css';

interface ResumePreviewProps {
    text: string;
    suggestions: Suggestion[];
    isLoading?: boolean;
    onTextSelect: (start: number, end: number, text: string) => void;
    onAcceptSuggestion: (suggestion: Suggestion, replacement: string) => void;
    onDismissSuggestion: (suggestionId: string) => void;
    onRefreshSuggestion: (suggestion: Suggestion) => void;
}

export function ResumePreview({
    text,
    suggestions,
    isLoading = false,
    onTextSelect,
    onAcceptSuggestion,
    onDismissSuggestion,
    onRefreshSuggestion,
}: ResumePreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeSuggestion, setActiveSuggestion] = useState<Suggestion | null>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });

    const handleMouseUp = () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const range = selection.getRangeAt(0);
        const container = containerRef.current;
        if (!container || !container.contains(range.commonAncestorContainer)) return;

        const preRange = document.createRange();
        preRange.setStart(container, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        const start = preRange.toString().length;
        const end = start + selection.toString().length;

        onTextSelect(start, end, selection.toString());
    };

    const handleSuggestionClick = (suggestion: Suggestion, event: React.MouseEvent) => {
        event.stopPropagation();
        const rect = (event.target as HTMLElement).getBoundingClientRect();
        setPopupPosition({ x: rect.left, y: rect.bottom + 8 });
        setActiveSuggestion(suggestion);
    };

    const renderTextWithHighlights = () => {
        if (!text) return null;
        if (suggestions.length === 0) return text;

        const sortedSuggestions = [...suggestions].sort((a, b) => a.start - b.start);
        const parts: React.ReactNode[] = [];
        let lastEnd = 0;

        sortedSuggestions.forEach((suggestion) => {
            if (suggestion.start > lastEnd) {
                parts.push(text.slice(lastEnd, suggestion.start));
            }

            parts.push(
                <span
                    key={suggestion.id}
                    className="suggestion-highlight"
                    onClick={(e) => handleSuggestionClick(suggestion, e)}
                >
                    {text.slice(suggestion.start, suggestion.end)}
                </span>
            );

            lastEnd = suggestion.end;
        });

        if (lastEnd < text.length) {
            parts.push(text.slice(lastEnd));
        }

        return parts;
    };

    useEffect(() => {
        const handleClickOutside = () => setActiveSuggestion(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <div className="resume-preview">
            {isLoading && (
                <div className="loading-overlay">
                    <div className="loading-spinner" />
                    <span className="loading-text">Analyzing resume...</span>
                </div>
            )}
            <div className="resume-content" ref={containerRef} onMouseUp={handleMouseUp}>
                {text ? (
                    <pre className="resume-text">{renderTextWithHighlights()}</pre>
                ) : (
                    <div className="empty-state">
                        <p>Upload a resume to get started</p>
                    </div>
                )}
            </div>

            {activeSuggestion && (
                <SuggestionPopup
                    suggestion={activeSuggestion}
                    position={popupPosition}
                    onAccept={(replacement) => {
                        onAcceptSuggestion(activeSuggestion, replacement);
                        setActiveSuggestion(null);
                    }}
                    onDismiss={() => {
                        onDismissSuggestion(activeSuggestion.id);
                        setActiveSuggestion(null);
                    }}
                    onRefresh={() => onRefreshSuggestion(activeSuggestion)}
                />
            )}
        </div>
    );
}

import { useEffect, useCallback, useMemo, useState } from 'react';
import mammoth from 'mammoth';
import type { Change, Suggestion } from '../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    docId: string | null;
    changes: Change[];
    suggestions: Suggestion[];
    onRevertChange: (index: number) => void;
}

function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function applyHighlights(
    html: string,
    changes: Change[],
    suggestions: Suggestion[]
): string {
    let result = html;

    const changedOriginals = new Set(changes.map(c => c.original));

    // Highlight pending suggestions (amber)
    const sortedSuggestions = [...suggestions].sort((a, b) => b.start - a.start);
    for (const suggestion of sortedSuggestions) {
        if (changedOriginals.has(suggestion.original_text)) continue;
        const escaped = escapeRegExp(suggestion.original_text);
        const highlight = `<mark class="suggestion-pending" data-suggestion-id="${suggestion.id}">${escapeHtml(suggestion.original_text)}</mark>`;
        result = result.replace(new RegExp(escaped), highlight);
    }

    // Highlight accepted changes (vermillion, clickable to revert)
    const sortedChanges = [...changes].sort((a, b) => b.start - a.start);
    for (let i = sortedChanges.length - 1; i >= 0; i--) {
        const change = sortedChanges[i];
        const originalIndex = changes.indexOf(change);
        const escaped = escapeRegExp(change.original);
        const highlight = `<mark class="change-applied" data-change-index="${originalIndex}" title="Click to revert">${escapeHtml(change.replacement)}</mark>`;
        result = result.replace(new RegExp(escaped), highlight);
    }

    return result;
}

export function DocumentPreview({
    docId,
    changes,
    suggestions,
    onRevertChange
}: DocumentPreviewProps) {
    const [baseHtml, setBaseHtml] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleClick = useCallback((e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('change-applied')) {
            const index = target.getAttribute('data-change-index');
            if (index !== null) {
                onRevertChange(parseInt(index, 10));
            }
        }
    }, [onRevertChange]);

    useEffect(() => {
        if (!docId) {
            setBaseHtml('');
            setError(null);
            return;
        }

        const fetchAndConvert = async () => {
            try {
                setError(null);
                const response = await fetch(`http://localhost:8000/api/document/${docId}`);
                if (!response.ok) throw new Error('Failed to fetch document');

                const arrayBuffer = await response.arrayBuffer();
                const result = await mammoth.convertToHtml({ arrayBuffer });
                setBaseHtml(result.value);
            } catch (err) {
                console.error('Document preview failed:', err);
                setError('Failed to load document preview');
            }
        };

        fetchAndConvert();
    }, [docId]);

    const displayHtml = useMemo(() => {
        return applyHighlights(baseHtml, changes, suggestions);
    }, [baseHtml, changes, suggestions]);

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">Click highlighted text to revert</span>
            </div>
            <div className="preview-container" onClick={handleClick}>
                {!docId && (
                    <div className="preview-empty">
                        <p>Upload a resume to see preview</p>
                    </div>
                )}
                {error && (
                    <p className="preview-error">{error}</p>
                )}
                {docId && !error && baseHtml && (
                    <div
                        className="mammoth-content"
                        dangerouslySetInnerHTML={{ __html: displayHtml }}
                    />
                )}
            </div>
        </div>
    );
}

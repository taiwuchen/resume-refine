import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import mammoth from 'mammoth';
import type { Change } from '../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    docId: string | null;
    changes: Change[];
    onTextSelect: (text: string) => void;
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

function applyChangesToHtml(html: string, changes: Change[]): string {
    if (changes.length === 0) return html;

    let result = html;
    const sorted = [...changes].sort((a, b) => b.start - a.start);

    for (const change of sorted) {
        const escaped = escapeRegExp(change.original);
        const replacement = `<mark class="change-applied">${escapeHtml(change.replacement)}</mark>`;
        result = result.replace(new RegExp(escaped), replacement);
    }

    return result;
}

export function DocumentPreview({ docId, changes, onTextSelect }: DocumentPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [baseHtml, setBaseHtml] = useState<string>('');
    const [error, setError] = useState<string | null>(null);

    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (text) {
            onTextSelect(text);
        }
    }, [onTextSelect]);

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
        return applyChangesToHtml(baseHtml, changes);
    }, [baseHtml, changes]);

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">Select text to improve</span>
            </div>
            <div
                className="preview-container"
                ref={containerRef}
                onMouseUp={handleMouseUp}
            >
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

import { useEffect, useRef, useCallback } from 'react';
import { renderAsync } from 'docx-preview';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    docId: string | null;
    onTextSelect: (text: string) => void;
}

export function DocumentPreview({ docId, onTextSelect }: DocumentPreviewProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseUp = useCallback(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const text = selection.toString().trim();
        if (text) {
            onTextSelect(text);
        }
    }, [onTextSelect]);

    useEffect(() => {
        if (!docId || !containerRef.current) return;

        const fetchAndRender = async () => {
            try {
                const response = await fetch(`http://localhost:8000/api/document/${docId}`);
                if (!response.ok) throw new Error('Failed to fetch document');

                const blob = await response.blob();

                if (containerRef.current) {
                    containerRef.current.innerHTML = '';
                    await renderAsync(blob, containerRef.current, undefined, {
                        className: 'docx-preview',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        useBase64URL: true,
                    });
                }
            } catch (error) {
                console.error('Document preview failed:', error);
                if (containerRef.current) {
                    containerRef.current.innerHTML = '<p class="preview-error">Failed to load document preview</p>';
                }
            }
        };

        fetchAndRender();
    }, [docId]);

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
            </div>
        </div>
    );
}

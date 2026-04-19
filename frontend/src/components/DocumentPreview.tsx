import { useEffect, useRef, useState } from 'react';
import { fetchPreviewPdf } from '../hooks/useApi';
import type { Change, ParsedDocument, Suggestion } from '../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    document: ParsedDocument | null;
    changes: Change[];
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    onSelectParagraph: (paragraphId: string | null) => void;
}

export function DocumentPreview({
    document: parsedDocument,
    changes,
}: DocumentPreviewProps) {
    const requestIdRef = useRef(0);
    const previewUrlRef = useRef<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isRendering, setIsRendering] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        setRenderError(null);

        if (!parsedDocument) {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = null;
            }
            setPreviewUrl(null);
            setIsRendering(false);
            return;
        }

        setIsRendering(true);

        const loadPreview = async () => {
            try {
                const blob = await fetchPreviewPdf(parsedDocument.doc_id, changes);

                if (cancelled || requestId !== requestIdRef.current) {
                    return;
                }

                const nextPreviewUrl = URL.createObjectURL(blob);

                if (previewUrlRef.current) {
                    URL.revokeObjectURL(previewUrlRef.current);
                }

                previewUrlRef.current = nextPreviewUrl;
                setPreviewUrl(nextPreviewUrl);
            } catch (error) {
                if (cancelled || requestId !== requestIdRef.current) {
                    return;
                }

                console.error('PDF preview failed:', error);
                setRenderError(error instanceof Error ? error.message : 'PDF preview failed');
            } finally {
                if (!cancelled && requestId === requestIdRef.current) {
                    setIsRendering(false);
                }
            }
        };

        loadPreview();

        return () => {
            cancelled = true;
        };
    }, [parsedDocument, changes]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">PDF layout preview updates after accepted edits</span>
            </div>
            <div className="preview-container">
                {!parsedDocument && (
                    <div className="preview-empty">
                        <p>Upload a resume to see preview</p>
                    </div>
                )}
                {parsedDocument && (
                    <div className="pdf-preview-stage">
                        <div className="pdf-preview-frame-wrap">
                            {previewUrl && (
                                <iframe
                                    key={previewUrl}
                                    className="pdf-preview-frame"
                                    src={previewUrl}
                                    title="Resume PDF preview"
                                />
                            )}
                            {isRendering && (
                                <div className="preview-status">
                                    <p>Rendering PDF preview...</p>
                                </div>
                            )}
                            {renderError && (
                                <div className="preview-error">
                                    <p>{renderError}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

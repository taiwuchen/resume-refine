import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchPreviewPdf } from '../../hooks/api/usePreviewPdf';
import { useParagraphMatching } from '../../hooks/preview/useParagraphMatching';
import { usePdfDocument } from '../../hooks/preview/usePdfDocument';
import { usePdfPages } from '../../hooks/preview/usePdfPages';
import { usePreviewOverlays } from '../../hooks/preview/usePreviewOverlays';
import type { Change, ParsedDocument, Suggestion } from '../../types';
import { PreviewCanvas } from './PreviewCanvas';
import { PreviewOverlays } from './PreviewOverlays';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    document: ParsedDocument | null;
    changes: Change[];
    undoneChanges: Change[];
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    onSelectParagraph: (paragraphId: string | null) => void;
    onEditParagraph: (paragraphId: string, replacement: string) => void;
    onUndoParagraphChange: (paragraphId: string) => void;
    onRedoParagraphChange: (paragraphId: string) => void;
}

export function DocumentPreview({
    document: parsedDocument,
    changes,
    undoneChanges,
    suggestions,
    activeParagraphId,
    onSelectParagraph,
    onEditParagraph,
    onUndoParagraphChange,
    onRedoParagraphChange,
}: DocumentPreviewProps) {
    const previewViewportRef = useRef<HTMLDivElement | null>(null);
    const pagesHostRef = useRef<HTMLDivElement | null>(null);
    const fetchRequestIdRef = useRef(0);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        const viewportElement = previewViewportRef.current;
        if (!viewportElement) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            setViewportWidth(Math.floor(entry.contentRect.width));
        });

        observer.observe(viewportElement);
        setViewportWidth(Math.floor(viewportElement.getBoundingClientRect().width));

        return () => {
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        const requestId = fetchRequestIdRef.current + 1;
        fetchRequestIdRef.current = requestId;
        setFetchError(null);

        if (!parsedDocument) {
            setPdfBlob(null);
            setIsFetching(false);
            return;
        }

        let cancelled = false;
        setIsFetching(true);

        const loadPreviewPdf = async () => {
            try {
                const blob = await fetchPreviewPdf(parsedDocument.doc_id, changes);
                if (cancelled || requestId !== fetchRequestIdRef.current) {
                    return;
                }

                setPdfBlob(blob);
            } catch (error) {
                if (cancelled || requestId !== fetchRequestIdRef.current) {
                    return;
                }

                console.error('PDF preview fetch failed:', error);
                setFetchError(error instanceof Error ? error.message : 'PDF preview failed');
                setPdfBlob(null);
            } finally {
                if (!cancelled && requestId === fetchRequestIdRef.current) {
                    setIsFetching(false);
                }
            }
        };

        loadPreviewPdf();

        return () => {
            cancelled = true;
        };
    }, [changes, parsedDocument]);

    const { pdfDocument, isLoadingDocument, loadError } = usePdfDocument(pdfBlob);
    const { pageStates, isRenderingPages, renderError } = usePdfPages({
        pdfDocument,
        viewportWidth,
        pagesHostRef,
    });
    const matches = useParagraphMatching(parsedDocument, changes, pageStates);
    const { overlaysByPage, registerOverlayRef } = usePreviewOverlays({
        matches,
        pageStates,
        suggestions,
        activeParagraphId,
        previewViewportRef,
    });

    const effectiveRenderError = fetchError ?? loadError ?? renderError;
    const isRendering = isLoadingDocument || isRenderingPages;
    const activeParagraph = useMemo(() => (
        parsedDocument?.paragraphs.find((paragraph) => paragraph.paragraph_id === activeParagraphId) ?? null
    ), [activeParagraphId, parsedDocument]);
    const activeParagraphText = activeParagraph
        ? changes.find((change) => change.paragraph_id === activeParagraph.paragraph_id)?.replacement
            ?? activeParagraph.text
        : '';
    const activeParagraphChange = activeParagraph
        ? changes.find((change) => change.paragraph_id === activeParagraph.paragraph_id) ?? null
        : null;
    const activeParagraphRedo = activeParagraph
        ? undoneChanges.find((change) => change.paragraph_id === activeParagraph.paragraph_id) ?? null
        : null;

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">PDF layout preview with paragraph highlights</span>
            </div>
            {activeParagraph?.is_editable && (
                <div className="paragraph-editor">
                    <div className="paragraph-editor-header">
                        <label className="paragraph-editor-label" htmlFor="active-paragraph-editor">
                            Edit selected paragraph
                        </label>
                        <div className="paragraph-editor-actions">
                            <button
                                type="button"
                                className="paragraph-editor-btn"
                                onClick={() => onUndoParagraphChange(activeParagraph.paragraph_id)}
                                disabled={!activeParagraphChange}
                            >
                                Undo
                            </button>
                            <button
                                type="button"
                                className="paragraph-editor-btn"
                                onClick={() => onRedoParagraphChange(activeParagraph.paragraph_id)}
                                disabled={!activeParagraphRedo}
                            >
                                Redo
                            </button>
                        </div>
                    </div>
                    <textarea
                        id="active-paragraph-editor"
                        className="paragraph-editor-input"
                        value={activeParagraphText}
                        onChange={(event) => onEditParagraph(activeParagraph.paragraph_id, event.target.value)}
                        rows={4}
                    />
                </div>
            )}
            <div className="preview-container" ref={previewViewportRef}>
                <PreviewCanvas
                    hasDocument={!!parsedDocument}
                    isFetching={isFetching}
                    isRendering={isRendering}
                    renderError={effectiveRenderError}
                    pagesHostRef={pagesHostRef}
                />
                <PreviewOverlays
                    pageStates={pageStates}
                    overlaysByPage={overlaysByPage}
                    onSelectParagraph={onSelectParagraph}
                    registerOverlayRef={registerOverlayRef}
                />
            </div>
        </div>
    );
}

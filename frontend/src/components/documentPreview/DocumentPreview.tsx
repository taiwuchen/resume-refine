import { useEffect, useRef, useState } from 'react';
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
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    onSelectParagraph: (paragraphId: string | null) => void;
}

export function DocumentPreview({
    document: parsedDocument,
    changes,
    suggestions,
    activeParagraphId,
    onSelectParagraph,
}: DocumentPreviewProps) {
    const previewRootRef = useRef<HTMLDivElement | null>(null);
    const pagesHostRef = useRef<HTMLDivElement | null>(null);
    const fetchRequestIdRef = useRef(0);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    useEffect(() => {
        const rootElement = previewRootRef.current;
        if (!rootElement) {
            return;
        }

        const observer = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) {
                return;
            }
            setViewportWidth(Math.floor(entry.contentRect.width));
        });

        observer.observe(rootElement);
        setViewportWidth(Math.floor(rootElement.getBoundingClientRect().width));

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
        const controller = new AbortController();
        setIsFetching(true);

        const loadPreviewPdf = async () => {
            try {
                const blob = await fetchPreviewPdf(parsedDocument.doc_id, changes, controller.signal);
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

        const timer = window.setTimeout(loadPreviewPdf, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller.abort();
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
    });

    const effectiveRenderError = fetchError ?? loadError ?? renderError;
    const isRendering = isLoadingDocument || isRenderingPages;
    return (
        <div className="document-preview" ref={previewRootRef}>
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">Select a highlight to review a suggestion</span>
            </div>
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
    );
}

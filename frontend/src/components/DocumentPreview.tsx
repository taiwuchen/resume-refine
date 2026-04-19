import { useEffect, useMemo, useRef, useState } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist';
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

interface TextToken {
    pageIndex: number;
    pageElement: HTMLDivElement;
    overlayElement: HTMLDivElement;
    textElement: HTMLSpanElement;
    rawText: string;
}

interface PageRenderState {
    pageIndex: number;
    pageElement: HTMLDivElement;
    overlayElement: HTMLDivElement;
    tokens: TextToken[];
}

interface MatchResult {
    endIndex: number;
    tokenIndexes: number[];
}

interface OverlayRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

let workerConfigured = false;

function ensurePdfWorker() {
    if (workerConfigured) {
        return;
    }

    GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.mjs',
        import.meta.url,
    ).toString();
    workerConfigured = true;
}

function normalizeComparableText(value: string): string {
    return value
        .replace(/\u00ad/g, '')
        .replace(/[\u00A0\u2002\u2003\u2009\u200A\u200B\u2060]/g, ' ')
        .replace(/[‐‑‒–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function isBulletToken(value: string): boolean {
    const cleaned = value.replace(/[•◦▪‣∙]/g, '').trim();
    return !cleaned.length;
}

function buildPreviewParagraphTexts(parsedDocument: ParsedDocument, changes: Change[]): Map<string, string> {
    const changeByParagraphId = new Map(changes.map((change) => [change.paragraph_id, change.replacement]));

    return new Map(
        parsedDocument.paragraphs.map((paragraph) => [
            paragraph.paragraph_id,
            changeByParagraphId.get(paragraph.paragraph_id) ?? paragraph.text,
        ]),
    );
}

function findParagraphMatch(tokens: TextToken[], target: string, startIndex: number): MatchResult | null {
    if (!target) {
        return null;
    }

    for (let candidateIndex = startIndex; candidateIndex < tokens.length; candidateIndex += 1) {
        let aggregate = '';
        const tokenIndexes: number[] = [];

        for (let tokenIndex = candidateIndex; tokenIndex < tokens.length; tokenIndex += 1) {
            aggregate += tokens[tokenIndex].rawText;
            tokenIndexes.push(tokenIndex);

            const normalizedAggregate = normalizeComparableText(aggregate);
            if (!normalizedAggregate) {
                continue;
            }

            if (normalizedAggregate === target) {
                return {
                    endIndex: tokenIndex,
                    tokenIndexes,
                };
            }

            if (!target.startsWith(normalizedAggregate)) {
                break;
            }
        }
    }

    return null;
}

function expandTokenIndexesForBullet(tokens: TextToken[], tokenIndexes: number[]): number[] {
    if (!tokenIndexes.length) {
        return tokenIndexes;
    }

    const firstIndex = tokenIndexes[0];
    if (firstIndex === 0) {
        return tokenIndexes;
    }

    const previousToken = tokens[firstIndex - 1];
    const firstToken = tokens[firstIndex];

    if (!isBulletToken(previousToken.rawText)) {
        return tokenIndexes;
    }

    if (previousToken.pageIndex !== firstToken.pageIndex) {
        return tokenIndexes;
    }

    const previousRect = previousToken.textElement.getBoundingClientRect();
    const firstRect = firstToken.textElement.getBoundingClientRect();
    if (Math.abs(previousRect.top - firstRect.top) > Math.max(6, firstRect.height * 0.75)) {
        return tokenIndexes;
    }

    return [firstIndex - 1, ...tokenIndexes];
}

function buildOverlayRects(tokenIndexes: number[], tokens: TextToken[]): Map<number, OverlayRect[]> {
    const rectsByPage = new Map<number, OverlayRect[]>();

    for (const tokenIndex of tokenIndexes) {
        const token = tokens[tokenIndex];
        const pageRect = token.pageElement.getBoundingClientRect();
        const textRect = token.textElement.getBoundingClientRect();

        if (!textRect.width || !textRect.height) {
            continue;
        }

        const overlayRect: OverlayRect = {
            left: Math.max(0, textRect.left - pageRect.left - 2),
            top: Math.max(0, textRect.top - pageRect.top - 1),
            width: textRect.width + 4,
            height: textRect.height + 2,
        };

        const pageRects = rectsByPage.get(token.pageIndex) ?? [];
        pageRects.push(overlayRect);
        rectsByPage.set(token.pageIndex, pageRects);
    }

    for (const [pageIndex, pageRects] of rectsByPage.entries()) {
        const mergedRects: OverlayRect[] = [];
        const sortedRects = [...pageRects].sort((left, right) => {
            if (Math.abs(left.top - right.top) > 4) {
                return left.top - right.top;
            }
            return left.left - right.left;
        });

        for (const rect of sortedRects) {
            const lastRect = mergedRects[mergedRects.length - 1];
            if (!lastRect) {
                mergedRects.push({ ...rect });
                continue;
            }

            const onSameLine = Math.abs(lastRect.top - rect.top) <= Math.max(6, rect.height * 0.75);
            if (!onSameLine) {
                mergedRects.push({ ...rect });
                continue;
            }

            lastRect.left = Math.min(lastRect.left, rect.left);
            lastRect.top = Math.min(lastRect.top, rect.top);
            lastRect.width = Math.max(lastRect.left + lastRect.width, rect.left + rect.width) - lastRect.left;
            lastRect.height = Math.max(lastRect.top + lastRect.height, rect.top + rect.height) - lastRect.top;
        }

        rectsByPage.set(pageIndex, mergedRects);
    }

    return rectsByPage;
}

export function DocumentPreview({
    document: parsedDocument,
    changes,
    suggestions,
    activeParagraphId,
    onSelectParagraph,
}: DocumentPreviewProps) {
    const previewViewportRef = useRef<HTMLDivElement | null>(null);
    const pagesHostRef = useRef<HTMLDivElement | null>(null);
    const pageStatesRef = useRef<PageRenderState[]>([]);
    const fetchRequestIdRef = useRef(0);
    const renderRequestIdRef = useRef(0);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
    const [isFetching, setIsFetching] = useState(false);
    const [isRendering, setIsRendering] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [pagesReadyToken, setPagesReadyToken] = useState(0);

    const previewParagraphTexts = useMemo(
        () => (parsedDocument ? buildPreviewParagraphTexts(parsedDocument, changes) : new Map<string, string>()),
        [changes, parsedDocument],
    );

    const changeByParagraphId = useMemo(
        () => new Map(changes.map((change) => [change.paragraph_id, change])),
        [changes],
    );

    const pendingParagraphIds = useMemo(
        () => new Set(
            suggestions
                .map((suggestion) => suggestion.paragraph_id)
                .filter((paragraphId) => !changeByParagraphId.has(paragraphId)),
        ),
        [changeByParagraphId, suggestions],
    );

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
        setRenderError(null);

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
                setRenderError(error instanceof Error ? error.message : 'PDF preview failed');
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

    useEffect(() => {
        const pagesHostElement = pagesHostRef.current;

        if (!pagesHostElement) {
            return;
        }

        pageStatesRef.current = [];
        pagesHostElement.innerHTML = '';
        setPagesReadyToken((current) => current + 1);

        if (!parsedDocument || !pdfBlob || !viewportWidth) {
            setIsRendering(false);
            return;
        }

        ensurePdfWorker();

        const requestId = renderRequestIdRef.current + 1;
        renderRequestIdRef.current = requestId;
        let cancelled = false;
        let loadingTask: PDFDocumentLoadingTask | null = null;
        let pdfDocument: PDFDocumentProxy | null = null;
        const pageRenderTasks: Array<{ cancel: () => void }> = [];
        setIsRendering(true);

        const renderPreview = async () => {
            try {
                const buffer = await pdfBlob.arrayBuffer();

                if (cancelled || requestId !== renderRequestIdRef.current) {
                    return;
                }

                loadingTask = getDocument({ data: new Uint8Array(buffer) });
                pdfDocument = await loadingTask.promise;

                if (cancelled || requestId !== renderRequestIdRef.current) {
                    return;
                }

                const nextPageStates: PageRenderState[] = [];
                pagesHostElement.innerHTML = '';
                const availableWidth = Math.max(viewportWidth - 32, 320);
                const outputScale = window.devicePixelRatio || 1;

                for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
                    const page = await pdfDocument.getPage(pageIndex + 1);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = availableWidth / baseViewport.width;
                    const viewport = page.getViewport({ scale });

                    if (cancelled || requestId !== renderRequestIdRef.current) {
                        return;
                    }

                    const pageElement = document.createElement('div');
                    pageElement.className = 'pdf-page';
                    pageElement.style.width = `${viewport.width}px`;
                    pageElement.style.height = `${viewport.height}px`;

                    const canvas = document.createElement('canvas');
                    canvas.className = 'pdf-page-canvas';
                    canvas.width = Math.floor(viewport.width * outputScale);
                    canvas.height = Math.floor(viewport.height * outputScale);
                    canvas.style.width = `${viewport.width}px`;
                    canvas.style.height = `${viewport.height}px`;

                    const textLayerElement = document.createElement('div');
                    textLayerElement.className = 'pdf-text-layer';
                    textLayerElement.style.width = `${viewport.width}px`;
                    textLayerElement.style.height = `${viewport.height}px`;
                    textLayerElement.style.setProperty('--total-scale-factor', `${scale}`);

                    const overlayElement = document.createElement('div');
                    overlayElement.className = 'pdf-overlay-layer';

                    pageElement.appendChild(canvas);
                    pageElement.appendChild(textLayerElement);
                    pageElement.appendChild(overlayElement);
                    pagesHostElement.appendChild(pageElement);

                    const renderTask = page.render({
                        canvas,
                        canvasContext: canvas.getContext('2d', { alpha: false })!,
                        viewport,
                        transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
                    });
                    pageRenderTasks.push(renderTask);

                    await renderTask.promise;

                    const textContent = await page.getTextContent();
                    const textLayer = new TextLayer({
                        textContentSource: textContent,
                        container: textLayerElement,
                        viewport,
                    });

                    await textLayer.render();

                    const tokenCount = Math.min(textLayer.textDivs.length, textLayer.textContentItemsStr.length);
                    const tokens: TextToken[] = [];

                    for (let tokenIndex = 0; tokenIndex < tokenCount; tokenIndex += 1) {
                        const textElement = textLayer.textDivs[tokenIndex] as HTMLSpanElement;
                        const rawText = textLayer.textContentItemsStr[tokenIndex] ?? textElement.textContent ?? '';

                        if (!textElement) {
                            continue;
                        }

                        tokens.push({
                            pageIndex,
                            pageElement,
                            overlayElement,
                            textElement,
                            rawText,
                        });
                    }

                    nextPageStates.push({
                        pageIndex,
                        pageElement,
                        overlayElement,
                        tokens,
                    });
                }

                if (cancelled || requestId !== renderRequestIdRef.current) {
                    return;
                }

                pageStatesRef.current = nextPageStates;
                setPagesReadyToken((current) => current + 1);
            } catch (error) {
                if (cancelled || requestId !== renderRequestIdRef.current) {
                    return;
                }

                console.error('PDF preview render failed:', error);
                setRenderError(error instanceof Error ? error.message : 'PDF preview render failed');
                pageStatesRef.current = [];
                pagesHostElement.innerHTML = '';
                setPagesReadyToken((current) => current + 1);
            } finally {
                if (!cancelled && requestId === renderRequestIdRef.current) {
                    setIsRendering(false);
                }
            }
        };

        renderPreview();

        return () => {
            cancelled = true;
            pageRenderTasks.forEach((task) => task.cancel());
            loadingTask?.destroy();
            pdfDocument?.destroy();
        };
    }, [parsedDocument, pdfBlob, viewportWidth]);

    useEffect(() => {
        const pageStates = pageStatesRef.current;

        for (const pageState of pageStates) {
            pageState.overlayElement.innerHTML = '';
        }

        if (!parsedDocument || !pageStates.length) {
            return;
        }

        const allTokens = pageStates.flatMap((pageState) => pageState.tokens);
        const firstOverlayByParagraphId = new Map<string, HTMLElement>();
        let nextTokenIndex = 0;

        for (const paragraph of parsedDocument.paragraphs) {
            const previewText = previewParagraphTexts.get(paragraph.paragraph_id) ?? paragraph.text;
            const normalizedTarget = normalizeComparableText(previewText);
            if (!normalizedTarget) {
                continue;
            }

            const match = findParagraphMatch(allTokens, normalizedTarget, nextTokenIndex);
            if (!match) {
                continue;
            }

            nextTokenIndex = match.endIndex + 1;

            const expandedTokenIndexes = expandTokenIndexesForBullet(allTokens, match.tokenIndexes);
            const rectsByPage = buildOverlayRects(expandedTokenIndexes, allTokens);
            const isAccepted = changeByParagraphId.has(paragraph.paragraph_id);
            const isPending = pendingParagraphIds.has(paragraph.paragraph_id);
            const isActive = paragraph.paragraph_id === activeParagraphId;

            for (const [pageIndex, rects] of rectsByPage.entries()) {
                const pageState = pageStates[pageIndex];
                if (!pageState) {
                    continue;
                }

                for (const rect of rects) {
                    const overlay = document.createElement('button');
                    overlay.type = 'button';
                    overlay.className = [
                        'pdf-highlight',
                        isPending ? 'pdf-highlight-pending' : '',
                        isAccepted ? 'pdf-highlight-accepted' : '',
                        isActive ? 'pdf-highlight-active' : '',
                    ].filter(Boolean).join(' ');
                    overlay.style.left = `${rect.left}px`;
                    overlay.style.top = `${rect.top}px`;
                    overlay.style.width = `${rect.width}px`;
                    overlay.style.height = `${rect.height}px`;
                    overlay.dataset.paragraphId = paragraph.paragraph_id;
                    overlay.title = 'Select paragraph';
                    overlay.addEventListener('click', () => onSelectParagraph(paragraph.paragraph_id));
                    pageState.overlayElement.appendChild(overlay);

                    if (!firstOverlayByParagraphId.has(paragraph.paragraph_id)) {
                        firstOverlayByParagraphId.set(paragraph.paragraph_id, overlay);
                    }
                }
            }
        }

        if (activeParagraphId) {
            firstOverlayByParagraphId.get(activeParagraphId)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [activeParagraphId, changeByParagraphId, onSelectParagraph, pagesReadyToken, parsedDocument, pendingParagraphIds, previewParagraphTexts]);

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">PDF layout preview with paragraph highlights</span>
            </div>
            <div className="preview-container" ref={previewViewportRef}>
                {!parsedDocument && (
                    <div className="preview-empty">
                        <p>Upload a resume to see preview</p>
                    </div>
                )}
                {parsedDocument && (
                    <div className="pdf-preview-stage">
                        <div className="pdf-preview-frame-wrap">
                            <div ref={pagesHostRef} className="pdf-pages-host" />
                            {(isFetching || isRendering) && (
                                <div className="preview-status">
                                    <p>{isFetching ? 'Generating PDF preview...' : 'Rendering PDF preview...'}</p>
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

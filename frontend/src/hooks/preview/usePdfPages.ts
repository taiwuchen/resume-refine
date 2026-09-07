import { useEffect, useState, type RefObject } from 'react';
import { TextLayer, type PDFDocumentProxy } from 'pdfjs-dist';
import type { PageRenderState, TextToken } from '../../types';

interface UsePdfPagesOptions {
    pdfDocument: PDFDocumentProxy | null;
    viewportWidth: number;
    pagesHostRef: RefObject<HTMLDivElement | null>;
}

interface UsePdfPagesResult {
    pageStates: PageRenderState[];
    isRenderingPages: boolean;
    renderError: string | null;
}

export function usePdfPages({
    pdfDocument,
    viewportWidth,
    pagesHostRef,
}: UsePdfPagesOptions): UsePdfPagesResult {
    const [pageStates, setPageStates] = useState<PageRenderState[]>([]);
    const [isRenderingPages, setIsRenderingPages] = useState(false);
    const [renderError, setRenderError] = useState<string | null>(null);

    useEffect(() => {
        const pagesHostElement = pagesHostRef.current;
        if (!pagesHostElement) {
            return;
        }

        let cancelled = false;
        const pageRenderTasks: Array<{ cancel: () => void }> = [];

        pagesHostElement.innerHTML = '';
        setPageStates([]);
        setRenderError(null);

        if (!pdfDocument || !viewportWidth) {
            setIsRenderingPages(false);
            return;
        }

        setIsRenderingPages(true);

        const renderPages = async () => {
            try {
                const nextPageStates: PageRenderState[] = [];
                const availableWidth = Math.max(viewportWidth - 32, 1);
                const outputScale = window.devicePixelRatio || 1;

                for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
                    const page = await pdfDocument.getPage(pageIndex + 1);
                    const baseViewport = page.getViewport({ scale: 1 });
                    const scale = availableWidth / baseViewport.width;
                    const viewport = page.getViewport({ scale });

                    if (cancelled) {
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
                        const rawText = textLayer.textContentItemsStr[tokenIndex] ?? textElement?.textContent ?? '';

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

                if (!cancelled) {
                    setPageStates(nextPageStates);
                }
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error('PDF page render failed:', error);
                setPageStates([]);
                pagesHostElement.innerHTML = '';
                setRenderError(error instanceof Error ? error.message : 'PDF preview render failed');
            } finally {
                if (!cancelled) {
                    setIsRenderingPages(false);
                }
            }
        };

        renderPages();

        return () => {
            cancelled = true;
            pageRenderTasks.forEach((task) => task.cancel());
        };
    }, [pagesHostRef, pdfDocument, viewportWidth]);

    return {
        pageStates,
        isRenderingPages,
        renderError,
    };
}

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import type {
    Change,
    PageRenderState,
    PreviewOverlay,
    PreviewParagraphMatch,
    Suggestion,
    OverlayRect,
} from '../../types';

function buildOverlayRects(tokenIndexes: number[], pageStates: PageRenderState[]): Map<number, OverlayRect[]> {
    const allTokens = pageStates.flatMap((pageState) => pageState.tokens);
    const rectsByPage = new Map<number, OverlayRect[]>();

    for (const tokenIndex of tokenIndexes) {
        const token = allTokens[tokenIndex];
        if (!token) {
            continue;
        }

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

function scrollOverlayIntoPreview(
    overlayElement: HTMLButtonElement,
    previewViewportElement: HTMLDivElement,
) {
    const overlayRect = overlayElement.getBoundingClientRect();
    const viewportRect = previewViewportElement.getBoundingClientRect();
    const nextScrollTop = previewViewportElement.scrollTop
        + overlayRect.top
        - viewportRect.top
        - ((previewViewportElement.clientHeight - overlayRect.height) / 2);
    const maxScrollTop = previewViewportElement.scrollHeight - previewViewportElement.clientHeight;

    previewViewportElement.scrollTo({
        top: Math.max(0, Math.min(nextScrollTop, maxScrollTop)),
        behavior: 'smooth',
    });
}

interface UsePreviewOverlaysOptions {
    matches: PreviewParagraphMatch[];
    pageStates: PageRenderState[];
    changes: Change[];
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    previewViewportRef: RefObject<HTMLDivElement | null>;
}

interface UsePreviewOverlaysResult {
    overlaysByPage: Map<number, PreviewOverlay[]>;
    registerOverlayRef: (overlayId: string, node: HTMLButtonElement | null) => void;
}

export function usePreviewOverlays({
    matches,
    pageStates,
    changes,
    suggestions,
    activeParagraphId,
    previewViewportRef,
}: UsePreviewOverlaysOptions): UsePreviewOverlaysResult {
    const overlayRefs = useRef(new Map<string, HTMLButtonElement>());

    const overlaysByPage = useMemo(() => {
        const nextOverlaysByPage = new Map<number, PreviewOverlay[]>();
        const changeByParagraphId = new Map(changes.map((change) => [change.paragraph_id, change]));
        const pendingParagraphIds = new Set(
            suggestions
                .map((suggestion) => suggestion.paragraph_id)
                .filter((paragraphId) => !changeByParagraphId.has(paragraphId)),
        );

        for (const match of matches) {
            const rectsByPage = buildOverlayRects(match.tokenIndexes, pageStates);
            const isAccepted = changeByParagraphId.has(match.paragraphId);
            const isPending = pendingParagraphIds.has(match.paragraphId);
            const isActive = match.paragraphId === activeParagraphId;

            for (const [pageIndex, rects] of rectsByPage.entries()) {
                const pageOverlays = nextOverlaysByPage.get(pageIndex) ?? [];

                rects.forEach((rect, rectIndex) => {
                    pageOverlays.push({
                        id: `${match.paragraphId}:${pageIndex}:${rectIndex}`,
                        paragraphId: match.paragraphId,
                        pageIndex,
                        rect,
                        isPending,
                        isAccepted,
                        isActive,
                    });
                });

                nextOverlaysByPage.set(pageIndex, pageOverlays);
            }
        }

        return nextOverlaysByPage;
    }, [activeParagraphId, changes, matches, pageStates, suggestions]);

    const registerOverlayRef = useCallback((overlayId: string, node: HTMLButtonElement | null) => {
        if (node) {
            overlayRefs.current.set(overlayId, node);
            return;
        }

        overlayRefs.current.delete(overlayId);
    }, []);

    useEffect(() => {
        if (!activeParagraphId) {
            return;
        }

        for (const overlays of overlaysByPage.values()) {
            const activeOverlay = overlays.find((overlay) => overlay.paragraphId === activeParagraphId);
            if (!activeOverlay) {
                continue;
            }

            const overlayElement = overlayRefs.current.get(activeOverlay.id);
            const previewViewportElement = previewViewportRef.current;
            if (overlayElement && previewViewportElement) {
                scrollOverlayIntoPreview(overlayElement, previewViewportElement);
            }
            return;
        }
    }, [activeParagraphId, overlaysByPage, previewViewportRef]);

    return {
        overlaysByPage,
        registerOverlayRef,
    };
}

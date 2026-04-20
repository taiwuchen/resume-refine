import { createPortal } from 'react-dom';
import type { PageRenderState, PreviewOverlay } from '../../types';

interface PreviewOverlaysProps {
    pageStates: PageRenderState[];
    overlaysByPage: Map<number, PreviewOverlay[]>;
    onSelectParagraph: (paragraphId: string | null) => void;
    registerOverlayRef: (overlayId: string, node: HTMLButtonElement | null) => void;
}

export function PreviewOverlays({
    pageStates,
    overlaysByPage,
    onSelectParagraph,
    registerOverlayRef,
}: PreviewOverlaysProps) {
    return (
        <>
            {pageStates.map((pageState) => {
                const overlays = overlaysByPage.get(pageState.pageIndex) ?? [];
                if (!overlays.length) {
                    return null;
                }

                return createPortal(
                    <>
                        {overlays.map((overlay) => (
                            <button
                                key={overlay.id}
                                ref={(node) => registerOverlayRef(overlay.id, node)}
                                type="button"
                                className={[
                                    'pdf-highlight',
                                    overlay.isPending ? 'pdf-highlight-pending' : '',
                                    overlay.isAccepted ? 'pdf-highlight-accepted' : '',
                                    overlay.isActive ? 'pdf-highlight-active' : '',
                                ].filter(Boolean).join(' ')}
                                style={{
                                    left: `${overlay.rect.left}px`,
                                    top: `${overlay.rect.top}px`,
                                    width: `${overlay.rect.width}px`,
                                    height: `${overlay.rect.height}px`,
                                }}
                                data-paragraph-id={overlay.paragraphId}
                                title="Select paragraph"
                                onClick={() => onSelectParagraph(overlay.paragraphId)}
                            />
                        ))}
                    </>,
                    pageState.overlayElement,
                );
            })}
        </>
    );
}

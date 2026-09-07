import type { RefObject } from 'react';

interface PreviewCanvasProps {
    hasDocument: boolean;
    isFetching: boolean;
    isRendering: boolean;
    renderError: string | null;
    pagesHostRef: RefObject<HTMLDivElement | null>;
}

export function PreviewCanvas({
    hasDocument,
    isFetching,
    isRendering,
    renderError,
    pagesHostRef,
}: PreviewCanvasProps) {
    if (!hasDocument) {
        return (
            <div className="preview-empty">
                <p>Upload a resume to see preview</p>
            </div>
        );
    }

    return (
        <div className="pdf-preview-stage">
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
    );
}

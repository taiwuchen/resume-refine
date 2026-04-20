import { useEffect, useState } from 'react';
import { getDocument, GlobalWorkerOptions, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist';

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

interface UsePdfDocumentResult {
    pdfDocument: PDFDocumentProxy | null;
    isLoadingDocument: boolean;
    loadError: string | null;
}

export function usePdfDocument(pdfBlob: Blob | null): UsePdfDocumentResult {
    const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
    const [isLoadingDocument, setIsLoadingDocument] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let loadingTask: PDFDocumentLoadingTask | null = null;
        let nextDocument: PDFDocumentProxy | null = null;

        if (!pdfBlob) {
            setPdfDocument((currentDocument) => {
                currentDocument?.destroy();
                return null;
            });
            setIsLoadingDocument(false);
            setLoadError(null);
            return;
        }

        ensurePdfWorker();
        setIsLoadingDocument(true);
        setLoadError(null);

        const loadPdf = async () => {
            try {
                const buffer = await pdfBlob.arrayBuffer();
                if (cancelled) {
                    return;
                }

                loadingTask = getDocument({ data: new Uint8Array(buffer) });
                nextDocument = await loadingTask.promise;

                if (cancelled) {
                    return;
                }

                setPdfDocument((currentDocument) => {
                    currentDocument?.destroy();
                    return nextDocument;
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error('PDF preview render failed:', error);
                setPdfDocument((currentDocument) => {
                    currentDocument?.destroy();
                    return null;
                });
                setLoadError(error instanceof Error ? error.message : 'PDF preview render failed');
            } finally {
                if (!cancelled) {
                    setIsLoadingDocument(false);
                }
            }
        };

        loadPdf();

        return () => {
            cancelled = true;
            loadingTask?.destroy();
            nextDocument?.destroy();
        };
    }, [pdfBlob]);

    return {
        pdfDocument,
        isLoadingDocument,
        loadError,
    };
}

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

/**
 * A document and the task that produced it.
 *
 * pdf.js 6 removed PDFDocumentProxy.destroy(); tearing down the loading task
 * is what releases the document and its worker, so the two are kept together.
 */
interface LoadedPdf {
    document: PDFDocumentProxy;
    task: PDFDocumentLoadingTask;
}

interface UsePdfDocumentResult {
    pdfDocument: PDFDocumentProxy | null;
    isLoadingDocument: boolean;
    loadError: string | null;
}

export function usePdfDocument(pdfBlob: Blob | null): UsePdfDocumentResult {
    const [loaded, setLoaded] = useState<LoadedPdf | null>(null);
    const [isLoadingDocument, setIsLoadingDocument] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        let nextLoaded: LoadedPdf | null = null;

        if (!pdfBlob) {
            setLoaded((current) => {
                current?.task.destroy();
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

                const task = getDocument({ data: new Uint8Array(buffer) });
                const document = await task.promise;
                nextLoaded = { document, task };

                if (cancelled) {
                    return;
                }

                setLoaded((current) => {
                    current?.task.destroy();
                    return nextLoaded;
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }

                console.error('PDF preview render failed:', error);
                setLoaded((current) => {
                    current?.task.destroy();
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
            nextLoaded?.task.destroy();
        };
    }, [pdfBlob]);

    return {
        pdfDocument: loaded?.document ?? null,
        isLoadingDocument,
        loadError,
    };
}

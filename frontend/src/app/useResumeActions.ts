import { useRef, useState } from 'react';
import { analyzeResume } from '../hooks/api/useAnalyzeResume';
import { exportResume } from '../hooks/api/useExportResume';
import { uploadResume } from '../hooks/api/useUploadResume';
import { useDocumentSession } from './useDocumentSession';

export function useResumeActions() {
    const { state, dispatch } = useDocumentSession();
    const [operation, setOperation] = useState<'upload' | 'analyze' | 'export' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const busyRef = useRef(false);

    async function run(kind: NonNullable<typeof operation>, action: () => Promise<void>) {
        if (busyRef.current) return;
        busyRef.current = true;
        setOperation(kind);
        setError(null);
        try {
            await action();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : 'Something went wrong. Please try again.');
        } finally {
            busyRef.current = false;
            setOperation(null);
        }
    }

    function upload(file: File) {
        if (state.changes.length && !window.confirm('Replace this resume? Export first to keep your changes.')) return;
        return run('upload', async () => {
            const document = await uploadResume(file);
            dispatch({ type: 'uploadSuccess', document });
        });
    }

    function analyze() {
        if (!state.document || !state.jobDescription.trim() || state.hasAnalyzed) return;
        return run('analyze', async () => {
            const result = await analyzeResume(state.document!.doc_id, state.jobDescription, state.changes);
            dispatch({ type: 'analyzeSuccess', result, revision: state.revision });
        });
    }

    function download() {
        if (!state.document) return;
        return run('export', async () => {
            const blob = await exportResume(state.document!.doc_id, state.changes);
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = 'refined_resume.docx';
            document.body.append(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
    }

    return { operation, error, upload, analyze, download, clearError: () => setError(null) };
}

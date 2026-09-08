import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { documentSessionReducer, initialDocumentSessionState, type DocumentSessionState } from './documentSessionReducer';
import { DocumentSessionContext } from './documentSessionShared';

// v3 added the per-document access token; a restored v2 session has none
// and every document request would fail, so the key is bumped to reset it.
const STORAGE_KEY = 'resume-refine.document-session.v3';

function loadPersistedState(): DocumentSessionState {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) return initialDocumentSessionState;
        return JSON.parse(stored);
    } catch {
        return initialDocumentSessionState;
    }
}

export function DocumentSessionProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(documentSessionReducer, initialDocumentSessionState, loadPersistedState);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    useEffect(() => {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch {
            console.warn('Resume progress could not be saved in this browser.');
        }
    }, [state]);
    return <DocumentSessionContext.Provider value={value}>{children}</DocumentSessionContext.Provider>;
}

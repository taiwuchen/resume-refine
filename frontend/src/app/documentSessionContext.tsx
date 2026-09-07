import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { documentSessionReducer, initialDocumentSessionState, type DocumentSessionState } from './documentSessionReducer';
import { DocumentSessionContext } from './documentSessionShared';

const STORAGE_KEY = 'resume-refine.document-session.v2';

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

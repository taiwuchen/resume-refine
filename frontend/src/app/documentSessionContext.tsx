import { useEffect, useMemo, useReducer, type ReactNode } from 'react';
import {
    documentSessionReducer,
    initialDocumentSessionState,
    type DocumentSessionState,
} from './documentSessionReducer';
import { DocumentSessionContext } from './documentSessionShared';

const STORAGE_KEY = 'resume-refine.document-session.v1';

function loadPersistedState(): DocumentSessionState {
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return initialDocumentSessionState;
        }

        return {
            ...initialDocumentSessionState,
            ...JSON.parse(stored),
            isAnalyzing: false,
            isExporting: false,
            isChatLoading: false,
        };
    } catch {
        return initialDocumentSessionState;
    }
}

export function DocumentSessionProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(documentSessionReducer, initialDocumentSessionState, loadPersistedState);
    const value = useMemo(() => ({ state, dispatch }), [state]);

    useEffect(() => {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...state,
            isAnalyzing: false,
            isExporting: false,
            isChatLoading: false,
        }));
    }, [state]);

    return (
        <DocumentSessionContext.Provider value={value}>
            {children}
        </DocumentSessionContext.Provider>
    );
}

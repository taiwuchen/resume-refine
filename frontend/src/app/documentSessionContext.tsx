import { useMemo, useReducer, type ReactNode } from 'react';
import {
    documentSessionReducer,
    initialDocumentSessionState,
} from './documentSessionReducer';
import { DocumentSessionContext } from './documentSessionShared';

export function DocumentSessionProvider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(documentSessionReducer, initialDocumentSessionState);
    const value = useMemo(() => ({ state, dispatch }), [state]);

    return (
        <DocumentSessionContext.Provider value={value}>
            {children}
        </DocumentSessionContext.Provider>
    );
}

import { createContext, type Dispatch } from 'react';
import type { DocumentSessionAction, DocumentSessionState } from './documentSessionReducer';

export interface DocumentSessionContextValue {
    state: DocumentSessionState;
    dispatch: Dispatch<DocumentSessionAction>;
}

export const DocumentSessionContext = createContext<DocumentSessionContextValue | null>(null);

import { useContext } from 'react';
import { DocumentSessionContext } from './documentSessionShared';

export function useDocumentSession() {
    const context = useContext(DocumentSessionContext);
    if (!context) {
        throw new Error('useDocumentSession must be used within DocumentSessionProvider');
    }

    return context;
}

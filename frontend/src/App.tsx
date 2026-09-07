import { Header } from './components/Header';
import { DocumentPreview } from './components/documentPreview/DocumentPreview';
import { Sidebar } from './components/Sidebar';
import { DocumentSessionProvider } from './app/documentSessionContext';
import { useDocumentSession } from './app/useDocumentSession';
import { useResumeActions } from './app/useResumeActions';
import './App.css';

function AppContent() {
    const { state, dispatch } = useDocumentSession();
    const actions = useResumeActions();
    const busy = actions.operation !== null;
    return (
        <div className="app">
            <Header
                hasDocument={!!state.document} hasAnalyzed={state.hasAnalyzed}
                jobDescription={state.jobDescription} operation={actions.operation}
                canUndo={state.undoStack.length > 0}
                onFileUpload={actions.upload} onAnalyze={actions.analyze} onExport={actions.download}
                onUndo={() => dispatch({ type: 'undo' })}
                onJobDescriptionChange={jobDescription => {
                    actions.clearError();
                    dispatch({ type: 'setJobDescription', jobDescription });
                }}
                error={actions.error}
            />
            <main className="main-content">
                <DocumentPreview document={state.document} changes={state.changes}
                    suggestions={state.suggestions} activeParagraphId={state.activeParagraphId}
                    onSelectParagraph={paragraphId => dispatch({ type: 'setActiveParagraph', paragraphId })} />
                <Sidebar suggestions={state.suggestions} hasDocument={!!state.document}
                    hasJobDescription={!!state.jobDescription.trim()} hasAnalyzed={state.hasAnalyzed}
                    isAnalyzing={actions.operation === 'analyze'} disabled={busy}
                    activeParagraphId={state.activeParagraphId}
                    onSelect={paragraphId => dispatch({ type: 'setActiveParagraph', paragraphId })}
                    onAccept={(suggestionId, replacement) => dispatch({ type: 'acceptSuggestion', suggestionId, replacement })}
                    onDismiss={suggestionId => dispatch({ type: 'dismissSuggestion', suggestionId })} />
            </main>
        </div>
    );
}

export default function App() {
    return <DocumentSessionProvider><AppContent /></DocumentSessionProvider>;
}

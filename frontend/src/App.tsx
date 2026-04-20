import { Header } from './components/Header';
import { DocumentPreview } from './components/DocumentPreview';
import { Sidebar } from './components/Sidebar';
import { DocumentSessionProvider } from './app/documentSessionContext';
import { useDocumentSession } from './app/useDocumentSession';
import type { ChatMessage } from './types';
import { analyzeResume, getSuggestions } from './hooks/api/useAnalyzeResume';
import { sendChatMessage } from './hooks/api/useChatResume';
import { exportResume } from './hooks/api/useExportResume';
import { uploadResume } from './hooks/api/useUploadResume';
import './App.css';

function AppContent() {
    const { state, dispatch } = useDocumentSession();
    const {
        document,
        jobDescription,
        suggestions,
        changes,
        chatMessages,
        activeParagraphId,
        isAnalyzing,
        isExporting,
        isChatLoading,
    } = state;

    const handleFileUpload = async (file: File) => {
        try {
            const uploadedDocument = await uploadResume(file);
            dispatch({ type: 'uploadSuccess', document: uploadedDocument });
        } catch (error) {
            console.error('Upload failed:', error);
            alert(error instanceof Error ? error.message : 'Upload failed');
        }
    };

    const handleAnalyze = async () => {
        if (!document || !jobDescription.trim()) {
            return;
        }

        dispatch({ type: 'analyzeStart' });
        try {
            const nextSuggestions = await analyzeResume(document.doc_id, jobDescription);
            dispatch({ type: 'analyzeSuccess', suggestions: nextSuggestions });
        } catch (error) {
            dispatch({ type: 'analyzeFailure' });
            console.error('Analysis failed:', error);
            alert(error instanceof Error ? error.message : 'Analysis failed');
        }
    };

    const handleExport = async () => {
        if (!document) {
            return;
        }

        dispatch({ type: 'exportStart' });
        try {
            const blob = await exportResume(document.doc_id, changes);
            const url = URL.createObjectURL(blob);
            const anchor = window.document.createElement('a');
            anchor.href = url;
            anchor.download = 'refined_resume.docx';
            anchor.click();
            URL.revokeObjectURL(url);
            dispatch({ type: 'exportSuccess' });
        } catch (error) {
            dispatch({ type: 'exportFailure' });
            console.error('Export failed:', error);
            alert(error instanceof Error ? error.message : 'Export failed');
        }
    };

    const handleRefreshSuggestion = async (suggestionId: string) => {
        if (!document || !jobDescription.trim()) {
            return;
        }

        const suggestion = suggestions.find((candidate) => candidate.id === suggestionId);
        if (!suggestion) {
            return;
        }

        try {
            const nextSuggestion = await getSuggestions(
                document.doc_id,
                suggestion.paragraph_id,
                suggestion.start,
                suggestion.end,
                suggestion.original_text,
                jobDescription,
            );
            dispatch({
                type: 'refreshSuggestionSuccess',
                suggestionId,
                suggestion: nextSuggestion,
            });
        } catch (error) {
            console.error('Refresh failed:', error);
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!document) {
            return;
        }

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: message,
        };

        dispatch({ type: 'chatStart', userMessage });

        try {
            const apiMessages = [...chatMessages, userMessage].map((chatMessage) => ({
                role: chatMessage.role,
                content: chatMessage.content,
            }));

            const response = await sendChatMessage(document.doc_id, jobDescription, apiMessages);
            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.message,
                edits: response.edits,
            };

            dispatch({ type: 'chatSuccess', assistantMessage });
        } catch (error) {
            console.error('Chat failed:', error);
            const errorMessage: ChatMessage = {
                id: `error-${Date.now()}`,
                role: 'assistant',
                content: 'Sorry, something went wrong. Please try again.',
            };
            dispatch({ type: 'chatFailure', errorMessage });
        }
    };

    return (
        <div className="app">
            <Header
                onFileUpload={handleFileUpload}
                onAnalyze={handleAnalyze}
                onExport={handleExport}
                jobDescription={jobDescription}
                onJobDescriptionChange={(value) => dispatch({ type: 'setJobDescription', jobDescription: value })}
                hasDocument={!!document}
                isAnalyzing={isAnalyzing}
                isExporting={isExporting}
            />

            <main className="main-content">
                <DocumentPreview
                    document={document}
                    changes={changes}
                    suggestions={suggestions}
                    activeParagraphId={activeParagraphId}
                    onSelectParagraph={(paragraphId) => dispatch({ type: 'setActiveParagraph', paragraphId })}
                />

                <Sidebar
                    suggestions={suggestions}
                    changes={changes}
                    activeParagraphId={activeParagraphId}
                    onAcceptSuggestion={(suggestion, replacement) => dispatch({
                        type: 'acceptSuggestion',
                        suggestion,
                        replacement,
                    })}
                    onDismissSuggestion={(suggestionId) => dispatch({ type: 'dismissSuggestion', suggestionId })}
                    onRefreshSuggestion={(suggestion) => handleRefreshSuggestion(suggestion.id)}
                    onSelectSuggestion={(paragraphId) => dispatch({ type: 'setActiveParagraph', paragraphId })}
                    onRevertSuggestion={(paragraphId) => dispatch({ type: 'revertChange', paragraphId })}
                    isAnalyzing={isAnalyzing}
                    chatMessages={chatMessages}
                    onSendMessage={handleSendMessage}
                    onClearChat={() => dispatch({ type: 'clearChat' })}
                    onAcceptEdit={(edit) => dispatch({ type: 'acceptChatEdit', edit })}
                    onRejectEdit={(messageId, editIndex) => dispatch({ type: 'rejectChatEdit', messageId, editIndex })}
                    isChatLoading={isChatLoading}
                    hasDocument={!!document}
                />
            </main>
        </div>
    );
}

function App() {
    return (
        <DocumentSessionProvider>
            <AppContent />
        </DocumentSessionProvider>
    );
}

export default App;

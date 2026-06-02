import { useState } from 'react';
import { Header } from './components/Header';
import { DocumentPreview } from './components/documentPreview/DocumentPreview';
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
    const [sidebarActiveTab, setSidebarActiveTab] = useState<'suggestions' | 'chat'>('suggestions');
    const {
        document,
        jobDescription,
        suggestions,
        changes,
        chatMessages,
        activeParagraphId,
        activeSuggestionId,
        activeAnalysisId,
        readinessScore,
        analysisCacheHit,
        isAnalysisStale,
        isJobDescriptionLocked,
        chatDraft,
        isAnalyzing,
        isExporting,
        isChatLoading,
    } = state;
    const activeSuggestion = suggestions.find((suggestion) => suggestion.id === activeSuggestionId) ?? null;
    const hasActiveWork = !!document || !!jobDescription.trim();
    const openSuggestionCount = suggestions.filter((suggestion) => (
        suggestion.state === 'open' || suggestion.state === 'regenerated'
    )).length;

    const handleFileUpload = async (file: File) => {
        if (hasActiveWork && !window.confirm('Start a new session and upload this resume?')) {
            return;
        }

        try {
            const uploadedDocument = await uploadResume(file);
            dispatch({ type: 'uploadSuccess', document: uploadedDocument });
        } catch (error) {
            console.error('Upload failed:', error);
            alert(error instanceof Error ? error.message : 'Upload failed');
        }
    };

    const handleAnalyze = async (generateNewPass = false) => {
        if (!document || !jobDescription.trim()) {
            return;
        }

        if (generateNewPass && openSuggestionCount > 0) {
            const shouldContinue = window.confirm('Replace unresolved open suggestions with a new pass?');
            if (!shouldContinue) {
                return;
            }
        }

        dispatch({ type: 'analyzeStart' });
        try {
            const result = await analyzeResume(
                document.doc_id,
                jobDescription,
                changes,
                generateNewPass,
                suggestions,
            );
            dispatch({
                type: 'analyzeSuccess',
                suggestions: result.suggestions,
                analysisId: result.analysis_id,
                resumeVersionId: result.resume_version_id,
                readinessScore: result.readiness_score,
                cacheHit: result.cache_hit,
                preserveHistory: generateNewPass,
            });
        } catch (error) {
            dispatch({ type: 'analyzeFailure' });
            console.error('Analysis failed:', error);
            alert(error instanceof Error ? error.message : 'Analysis failed');
        }
    };

    const handleNewSession = () => {
        if (!hasActiveWork) {
            return;
        }

        if (window.confirm('Clear this resume session and start over?')) {
            dispatch({ type: 'resetSession' });
            setSidebarActiveTab('suggestions');
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

            const response = await sendChatMessage(
                document.doc_id,
                jobDescription,
                apiMessages,
                changes,
                activeAnalysisId,
                activeSuggestionId,
                suggestions,
            );
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
                onNewSession={handleNewSession}
                jobDescription={jobDescription}
                onJobDescriptionChange={(value) => dispatch({ type: 'setJobDescription', jobDescription: value })}
                hasDocument={!!document}
                hasActiveWork={hasActiveWork}
                isJobDescriptionLocked={isJobDescriptionLocked}
                isAnalyzing={isAnalyzing}
                isExporting={isExporting}
                isAnalyzed={!!activeAnalysisId && !isAnalysisStale}
            />

            <main className="main-content">
                <DocumentPreview
                    document={document}
                    changes={changes}
                    suggestions={suggestions}
                    activeParagraphId={activeParagraphId}
                    onSelectParagraph={(paragraphId) => {
                        dispatch({ type: 'setActiveParagraph', paragraphId });
                        if (paragraphId) {
                            setSidebarActiveTab('suggestions');
                        }
                    }}
                />

                <Sidebar
                    activeTab={sidebarActiveTab}
                    suggestions={suggestions}
                    activeParagraphId={activeParagraphId}
                    activeSuggestionId={activeSuggestionId}
                    activeSuggestion={activeSuggestion}
                    readinessScore={readinessScore}
                    analysisCacheHit={analysisCacheHit}
                    isAnalysisStale={isAnalysisStale}
                    chatDraft={chatDraft}
                    onChatDraftChange={(value) => dispatch({ type: 'setChatDraft', chatDraft: value })}
                    onActiveTabChange={setSidebarActiveTab}
                    onAcceptSuggestion={(suggestion, replacement) => dispatch({
                        type: 'acceptSuggestion',
                        suggestion,
                        replacement,
                    })}
                    onDismissSuggestion={(suggestionId) => dispatch({ type: 'dismissSuggestion', suggestionId })}
                    onRefreshSuggestion={(suggestion) => handleRefreshSuggestion(suggestion.id)}
                    onGenerateAnotherPass={() => handleAnalyze(true)}
                    onSelectSuggestion={(suggestionId) => dispatch({ type: 'setActiveSuggestion', suggestionId })}
                    onAskSuggestion={(suggestion) => {
                        dispatch({ type: 'setActiveSuggestion', suggestionId: suggestion.id });
                        dispatch({
                            type: 'setChatDraft',
                            chatDraft: suggestion.state === 'accepted'
                                ? 'Review the applied edit.'
                                : 'Why is this suggested?',
                        });
                        setSidebarActiveTab('chat');
                    }}
                    onRevertSuggestion={(suggestion) => dispatch(
                        suggestion.state === 'dismissed'
                            ? { type: 'reopenSuggestion', suggestionId: suggestion.id }
                            : { type: 'revertChange', paragraphId: suggestion.paragraph_id }
                    )}
                    isAnalyzing={isAnalyzing}
                    chatMessages={chatMessages}
                    onSendMessage={handleSendMessage}
                    onClearChat={() => dispatch({ type: 'clearChat' })}
                    onUseEditAsSuggestion={(edit) => dispatch({
                        type: 'addChatSuggestion',
                        edit,
                        parentSuggestionId: activeSuggestionId,
                    })}
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

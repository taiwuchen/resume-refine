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

    const handleAnalyze = async (generateNewPass = false) => {
        if (!document || !jobDescription.trim()) {
            return;
        }

        dispatch({ type: 'analyzeStart' });
        try {
            const result = await analyzeResume(document.doc_id, jobDescription, changes, generateNewPass);
            dispatch({
                type: 'analyzeSuccess',
                suggestions: result.suggestions,
                analysisId: result.analysis_id,
                resumeVersionId: result.resume_version_id,
                readinessScore: result.readiness_score,
                cacheHit: result.cache_hit,
            });
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
                jobDescription={jobDescription}
                onJobDescriptionChange={(value) => dispatch({ type: 'setJobDescription', jobDescription: value })}
                hasDocument={!!document}
                isAnalyzing={isAnalyzing}
                isExporting={isExporting}
                analyzeLabel={suggestions.length > 0 || isAnalysisStale ? 'Re-analyze' : 'Analyze'}
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
                    changes={changes}
                    activeParagraphId={activeParagraphId}
                    activeSuggestionId={activeSuggestionId}
                    readinessScore={readinessScore}
                    analysisCacheHit={analysisCacheHit}
                    isAnalysisStale={isAnalysisStale}
                    onActiveTabChange={setSidebarActiveTab}
                    onAcceptSuggestion={(suggestion, replacement) => dispatch({
                        type: 'acceptSuggestion',
                        suggestion,
                        replacement,
                    })}
                    onDismissSuggestion={(suggestionId) => dispatch({ type: 'dismissSuggestion', suggestionId })}
                    onRefreshSuggestion={(suggestion) => handleRefreshSuggestion(suggestion.id)}
                    onGenerateAnotherPass={() => handleAnalyze(true)}
                    onSelectSuggestion={(paragraphId) => dispatch({ type: 'setActiveParagraph', paragraphId })}
                    onAskSuggestion={(suggestion) => {
                        dispatch({ type: 'setActiveParagraph', paragraphId: suggestion.paragraph_id });
                        setSidebarActiveTab('chat');
                    }}
                    onRevertSuggestion={(paragraphId) => dispatch({ type: 'revertChange', paragraphId })}
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

import { useState } from 'react';
import { Header } from './components/Header';
import { DocumentPreview } from './components/DocumentPreview';
import { Sidebar } from './components/Sidebar';
import type { ParsedDocument, Suggestion, Change, ChatMessage, ChatEdit } from './types';
import { uploadResume, analyzeResume, getSuggestions, exportResume, sendChatMessage } from './hooks/useApi';
import { removeChangeByParagraphId, upsertParagraphChange } from './utils/changeState';
import './App.css';

function App() {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activeParagraphId, setActiveParagraphId] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      const doc = await uploadResume(file);
      setDocument(doc);
      setSuggestions([]);
      setChanges([]);
      setChatMessages([]);
      setActiveParagraphId(null);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const handleAnalyze = async () => {
    if (!document || !jobDescription.trim()) return;

    setIsAnalyzing(true);
    try {
      const newSuggestions = await analyzeResume(document.doc_id, jobDescription);
      setSuggestions(newSuggestions);
      setActiveParagraphId(newSuggestions[0]?.paragraph_id ?? null);
    } catch (error) {
      console.error('Analysis failed:', error);
      alert(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (!document) return;

    setIsExporting(true);
    try {
      const blob = await exportResume(document.doc_id, changes);
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = 'refined_resume.docx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAcceptSuggestion = (suggestion: Suggestion, replacement: string) => {
    const change: Change = {
      paragraph_id: suggestion.paragraph_id,
      start: suggestion.start,
      end: suggestion.end,
      original: suggestion.original_text,
      replacement,
    };
    setChanges((prev) => upsertParagraphChange(prev, change));
    setActiveParagraphId(suggestion.paragraph_id);
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions((prev) => {
      const nextSuggestions = prev.filter((suggestion) => suggestion.id !== suggestionId);
      const removedSuggestion = prev.find((suggestion) => suggestion.id === suggestionId);
      if (removedSuggestion?.paragraph_id === activeParagraphId) {
        setActiveParagraphId(nextSuggestions[0]?.paragraph_id ?? null);
      }
      return nextSuggestions;
    });
  };

  const handleRevertChangeByParagraphId = (paragraphId: string) => {
    setChanges((prev) => removeChangeByParagraphId(prev, paragraphId));
    setActiveParagraphId(paragraphId);
  };

  const handleRefreshSuggestion = async (suggestion: Suggestion) => {
    if (!document || !jobDescription.trim()) return;

    try {
      const newSuggestion = await getSuggestions(
        document.doc_id,
        suggestion.paragraph_id,
        suggestion.start,
        suggestion.end,
        suggestion.original_text,
        jobDescription
      );
      setSuggestions((prev) => prev.map((currentSuggestion) => (
        currentSuggestion.id === suggestion.id ? newSuggestion : currentSuggestion
      )));
      setActiveParagraphId(suggestion.paragraph_id);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  // Chat handlers
  const handleSendMessage = async (message: string) => {
    if (!document) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      // Convert chat messages to API format (exclude edits, just role + content)
      const apiMessages = [...chatMessages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage(
        document.doc_id,
        jobDescription,
        apiMessages
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        edits: response.edits,
      };

      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat failed:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setChatMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
  };

  const handleAcceptEdit = (edit: ChatEdit) => {
    const change: Change = {
      paragraph_id: edit.paragraph_id,
      start: edit.start,
      end: edit.end,
      original: edit.original_text,
      replacement: edit.new_text,
    };

    setChanges((prev) => upsertParagraphChange(prev, change));
    setActiveParagraphId(edit.paragraph_id);

    setChatMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        edits: msg.edits?.filter(
          (candidate) => !(
            candidate.paragraph_id === edit.paragraph_id
            && candidate.new_text === edit.new_text
          )
        ),
      }))
    );
  };

  const handleRejectEdit = (messageId: string, editIndex: number) => {
    setChatMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        return {
          ...msg,
          edits: msg.edits?.filter((_, i) => i !== editIndex),
        };
      })
    );
  };
  
  return (
    <div className="app">
      <Header
        onFileUpload={handleFileUpload}
        onAnalyze={handleAnalyze}
        onExport={handleExport}
        jobDescription={jobDescription}
        onJobDescriptionChange={setJobDescription}
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
          onSelectParagraph={setActiveParagraphId}
        />

        <Sidebar
          suggestions={suggestions}
          changes={changes}
          activeParagraphId={activeParagraphId}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onRefreshSuggestion={handleRefreshSuggestion}
          onSelectSuggestion={setActiveParagraphId}
          onRevertSuggestion={handleRevertChangeByParagraphId}
          isAnalyzing={isAnalyzing}
          chatMessages={chatMessages}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          onAcceptEdit={handleAcceptEdit}
          onRejectEdit={handleRejectEdit}
          isChatLoading={isChatLoading}
          hasDocument={!!document}
        />
      </main>
    </div>
  );
}

export default App;

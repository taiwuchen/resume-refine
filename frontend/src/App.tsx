import { useState } from 'react';
import { Header } from './components/Header';
import { DocumentPreview } from './components/DocumentPreview';
import { Sidebar } from './components/Sidebar';
import type { ParsedDocument, Suggestion, Change, ChatMessage, ChatEdit } from './types';
import { uploadResume, analyzeResume, getSuggestions, exportResume, sendChatMessage } from './hooks/useApi';
import './App.css';

function App() {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

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
      start: suggestion.start,
      end: suggestion.end,
      original: suggestion.original_text,
      replacement,
    };
    setChanges([...changes, change]);
    setSuggestions(suggestions.filter((s) => s.id !== suggestion.id));
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
  };

  const handleRevertChange = (index: number) => {
    setChanges(changes.filter((_, i) => i !== index));
  };

  const handleRefreshSuggestion = async (suggestion: Suggestion) => {
    if (!document || !jobDescription.trim()) return;

    try {
      const newSuggestion = await getSuggestions(
        document.doc_id,
        suggestion.start,
        suggestion.end,
        suggestion.original_text,
        jobDescription
      );
      setSuggestions(
        suggestions.map((s) => (s.id === suggestion.id ? newSuggestion : s))
      );
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
    // Find position in full text (simple substring search)
    const fullText = document?.full_text || '';
    const start = fullText.indexOf(edit.original_text);
    if (start === -1) {
      alert('Could not find the original text in the document');
      return;
    }

    const change: Change = {
      start,
      end: start + edit.original_text.length,
      original: edit.original_text,
      replacement: edit.new_text,
    };

    setChanges([...changes, change]);

    // Remove the edit from the message
    setChatMessages((prev) =>
      prev.map((msg) => ({
        ...msg,
        edits: msg.edits?.filter(
          (e) => e.original_text !== edit.original_text || e.new_text !== edit.new_text
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
          docId={document?.doc_id ?? null}
          changes={changes}
          suggestions={suggestions}
          onRevertChange={handleRevertChange}
        />

        <Sidebar
          suggestions={suggestions}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onRefreshSuggestion={handleRefreshSuggestion}
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

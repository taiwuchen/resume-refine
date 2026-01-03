import { useState } from 'react';
import { Header } from './components/Header';
import { ResumePreview } from './components/ResumePreview';
import { ChatSidebar } from './components/ChatSidebar';
import type { ParsedDocument, Suggestion, Change, ChatMessage } from './types';
import { uploadResume, analyzeResume, getSuggestions, exportResume } from './hooks/useApi';
import './App.css';

function App() {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [displayText, setDisplayText] = useState('');

  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      const doc = await uploadResume(file);
      setDocument(doc);
      setDisplayText(doc.full_text);
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

  const handleTextSelect = (start: number, end: number, text: string) => {
    setSelectedText(text);
    setSelectedRange({ start, end });
  };

  const handleAcceptSuggestion = (suggestion: Suggestion, replacement: string) => {
    const change: Change = {
      start: suggestion.start,
      end: suggestion.end,
      original: suggestion.original_text,
      replacement,
    };
    setChanges([...changes, change]);

    const lengthDiff = replacement.length - suggestion.original_text.length;
    const newText =
      displayText.slice(0, suggestion.start) +
      replacement +
      displayText.slice(suggestion.end);
    setDisplayText(newText);

    setSuggestions(
      suggestions
        .filter((s) => s.id !== suggestion.id)
        .map((s) => {
          if (s.start > suggestion.end) {
            return { ...s, start: s.start + lengthDiff, end: s.end + lengthDiff };
          }
          return s;
        })
    );
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    setSuggestions(suggestions.filter((s) => s.id !== suggestionId));
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

  const handleSendPrompt = async (prompt: string) => {
    if (!document || !selectedRange || !jobDescription.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
    };
    setChatMessages([...chatMessages, userMessage]);

    setIsChatLoading(true);
    try {
      const suggestion = await getSuggestions(
        document.doc_id,
        selectedRange.start,
        selectedRange.end,
        selectedText,
        jobDescription,
        prompt
      );

      const existingIndex = suggestions.findIndex(
        (s) => s.start === selectedRange.start && s.end === selectedRange.end
      );

      if (existingIndex >= 0) {
        setSuggestions(suggestions.map((s, i) => (i === existingIndex ? suggestion : s)));
      } else {
        setSuggestions([...suggestions, suggestion]);
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Generated 3 suggestions. Click the highlighted text to see options.',
        suggestion,
      };
      setChatMessages([...chatMessages, userMessage, assistantMessage]);
    } catch (error) {
      console.error('Suggestion failed:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Failed to generate suggestions. Please try again.',
      };
      setChatMessages([...chatMessages, userMessage, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
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
        <ResumePreview
          text={displayText}
          suggestions={suggestions}
          onTextSelect={handleTextSelect}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onRefreshSuggestion={handleRefreshSuggestion}
        />

        <ChatSidebar
          selectedText={selectedText}
          messages={chatMessages}
          onSendPrompt={handleSendPrompt}
          isLoading={isChatLoading}
        />
      </main>
    </div>
  );
}

export default App;

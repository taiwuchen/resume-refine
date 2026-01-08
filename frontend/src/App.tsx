import { useState } from 'react';
import { Header } from './components/Header';
import { DocumentPreview } from './components/DocumentPreview';
import { Sidebar } from './components/Sidebar';
import type { ParsedDocument, Suggestion, Change } from './types';
import { uploadResume, analyzeResume, getSuggestions, exportResume } from './hooks/useApi';
import './App.css';

function App() {
  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);

  const [selectedText, setSelectedText] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const handleFileUpload = async (file: File) => {
    try {
      const doc = await uploadResume(file);
      setDocument(doc);
      setSuggestions([]);
      setChanges([]);
      setSelectedText('');
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

  const handleTextSelect = (text: string) => {
    setSelectedText(text);
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
    if (!document || !selectedText || !jobDescription.trim()) return;

    setIsChatLoading(true);
    try {
      const suggestion = await getSuggestions(
        document.doc_id,
        0,
        selectedText.length,
        selectedText,
        jobDescription,
        prompt
      );
      setSuggestions([suggestion, ...suggestions]);
      setSelectedText('');
    } catch (error) {
      console.error('Suggestion failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to get suggestions');
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
        <DocumentPreview
          docId={document?.doc_id ?? null}
          changes={changes}
          onTextSelect={handleTextSelect}
        />

        <Sidebar
          selectedText={selectedText}
          suggestions={suggestions}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onRefreshSuggestion={handleRefreshSuggestion}
          onSendPrompt={handleSendPrompt}
          isAnalyzing={isAnalyzing}
          isChatLoading={isChatLoading}
        />
      </main>
    </div>
  );
}

export default App;

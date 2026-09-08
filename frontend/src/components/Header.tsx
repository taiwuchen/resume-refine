import { useRef, useState } from 'react';
import { getApiKey, setApiKey } from '../config/apiKey';
import './Header.css';

interface HeaderProps {
    hasDocument: boolean;
    hasAnalyzed: boolean;
    jobDescription: string;
    operation: 'upload' | 'analyze' | 'export' | null;
    canUndo: boolean;
    error: string | null;
    onFileUpload: (file: File) => void;
    onAnalyze: () => void;
    onExport: () => void;
    onUndo: () => void;
    onJobDescriptionChange: (value: string) => void;
}

export function Header(props: HeaderProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [apiKey, setApiKeyState] = useState(getApiKey);
    const busy = props.operation !== null;
    const hasApiKey = apiKey.trim().length > 0;
    return (
        <header className="header">
            <div className="header-top">
                <h1 className="logo"><img className="logo-mark" src="/logo.svg" alt="" />Resume Refine</h1>
                <div className="header-actions">
                    <input ref={inputRef} type="file" accept=".docx" hidden disabled={busy}
                        aria-label="Resume DOCX file" onChange={event => {
                            const file = event.target.files?.[0];
                            if (file) props.onFileUpload(file);
                            event.target.value = '';
                        }} />
                    <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>
                        {props.operation === 'upload' ? 'Uploading...' : props.hasDocument ? 'Replace resume' : 'Upload resume'}
                    </button>
                    <button className="btn" disabled={busy || !props.canUndo} onClick={props.onUndo}>Undo last change</button>
                    <button className="btn btn-success" disabled={busy || !props.hasDocument} onClick={props.onExport}>
                        {props.operation === 'export' ? 'Exporting...' : 'Export DOCX'}
                    </button>
                </div>
            </div>
            <div className="key-section">
                <label htmlFor="openrouter-key">OpenRouter API key</label>
                <input id="openrouter-key" className="key-input" type="password"
                    autoComplete="off" spellCheck={false} placeholder="sk-or-v1-..."
                    value={apiKey} disabled={busy}
                    onChange={event => {
                        setApiKeyState(event.target.value);
                        setApiKey(event.target.value);
                    }} />
                <span className="key-hint">
                    Stays in this browser and is sent only to run your analysis.{' '}
                    <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer noopener">Get a key</a>
                </span>
            </div>
            <div className="jd-section">
                <label htmlFor="job-description">Target job description</label>
                <div className="jd-controls">
                    <textarea id="job-description" className="jd-input" rows={2}
                        placeholder="Paste the job description to guide your suggestions."
                        value={props.jobDescription} disabled={busy}
                        onChange={event => props.onJobDescriptionChange(event.target.value)} />
                    <button className="btn btn-primary" onClick={props.onAnalyze}
                        title={hasApiKey ? undefined : 'Add your OpenRouter API key to analyze'}
                        disabled={busy || !props.hasDocument || !props.jobDescription.trim() || props.hasAnalyzed || !hasApiKey}>
                        {props.operation === 'analyze' ? 'Analyzing...' : props.hasAnalyzed ? 'Analyzed' : 'Analyze'}
                    </button>
                </div>
                {props.error && <p className="action-error" role="alert">{props.error}</p>}
            </div>
        </header>
    );
}

import { useRef, useState } from 'react';
import './Header.css';

interface HeaderProps {
    onFileUpload: (file: File) => void;
    onAnalyze: () => void;
    onExport: () => void;
    jobDescription: string;
    onJobDescriptionChange: (jd: string) => void;
    hasDocument: boolean;
    isAnalyzing: boolean;
    isExporting: boolean;
    analyzeLabel: string;
}

export function Header({
    onFileUpload,
    onAnalyze,
    onExport,
    jobDescription,
    onJobDescriptionChange,
    hasDocument,
    isAnalyzing,
    isExporting,
    analyzeLabel,
}: HeaderProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isJdExpanded, setIsJdExpanded] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) onFileUpload(file);
    };

    return (
        <header className="header">
            <div className="header-top">
                <h1 className="logo">Resume Refine</h1>
                <div className="header-actions">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".docx"
                        onChange={handleFileChange}
                        hidden
                    />
                    <button
                        className="btn btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Upload Resume
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => onAnalyze()}
                        disabled={!hasDocument || !jobDescription.trim() || isAnalyzing}
                    >
                        {isAnalyzing ? 'Analyzing...' : analyzeLabel}
                    </button>
                    <button
                        className="btn btn-success"
                        onClick={onExport}
                        disabled={!hasDocument || isExporting}
                    >
                        {isExporting ? 'Exporting...' : 'Export'}
                    </button>
                </div>
            </div>

            <div className="jd-section">
                <button
                    className="jd-toggle"
                    onClick={() => setIsJdExpanded(!isJdExpanded)}
                >
                    Job Description {isJdExpanded ? '▲' : '▼'}
                </button>
                {isJdExpanded && (
                    <textarea
                        className="jd-input"
                        placeholder="Paste the job description here..."
                        value={jobDescription}
                        onChange={(e) => onJobDescriptionChange(e.target.value)}
                    />
                )}
            </div>
        </header>
    );
}

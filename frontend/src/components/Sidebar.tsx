import { useEffect, useRef } from 'react';
import type { Suggestion } from '../types';
import './Sidebar.css';

interface SidebarProps {
    suggestions: Suggestion[];
    hasDocument: boolean;
    hasJobDescription: boolean;
    hasAnalyzed: boolean;
    isAnalyzing: boolean;
    disabled: boolean;
    activeParagraphId: string | null;
    onSelect: (paragraphId: string) => void;
    onAccept: (id: string, replacement: string) => void;
    onDismiss: (id: string) => void;
}

export function Sidebar(props: SidebarProps) {
    const listRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const selected = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
        if (selected && listRef.current) {
            listRef.current.scrollTo({ top: selected.offsetTop, behavior: 'smooth' });
        }
    }, [props.activeParagraphId]);
    const openCount = props.suggestions.filter(suggestion => suggestion.state === 'open').length;
    const emptyMessage = !props.hasDocument ? 'Upload a DOCX resume to get started.'
        : !props.hasJobDescription ? 'Add a job description, then select Analyze.'
        : !props.hasAnalyzed ? 'Select Analyze to find improvements for this job.'
        : 'No suggestions to review. You can export your resume.';
    return (
        <aside className="sidebar" aria-label="Resume suggestions">
            <div className="sidebar-heading"><h2>Suggestions</h2>
                {props.hasAnalyzed && <span>{openCount} to review</span>}
            </div>
            {props.isAnalyzing ? <p className="suggestions-status" role="status">Finding improvements for your resume...</p>
                : !props.suggestions.length ? <p className="suggestions-status" role="status">{emptyMessage}</p>
                : <div className="suggestions-list" ref={listRef}>
                    {props.suggestions.map((suggestion, index) => {
                        const active = props.activeParagraphId === suggestion.paragraph_id;
                        return <section className={`suggestion-card ${active ? 'active' : ''}`}
                            data-active={active} key={suggestion.id}>
                            <button className="suggestion-heading" aria-expanded={active}
                                aria-controls={`suggestion-${suggestion.id}`} onClick={() => props.onSelect(suggestion.paragraph_id)}>
                                <span>{index + 1}. {suggestion.reason}</span>
                                {suggestion.state === 'accepted' && <span className="applied-label">Applied</span>}
                            </button>
                            <p className="original-text">{suggestion.applied_text ?? suggestion.original_text}</p>
                            {active && <div className="suggestion-options" id={`suggestion-${suggestion.id}`}>
                                {suggestion.state === 'accepted' ? <p className="applied-note">Applied to your resume. Use Undo last change to reverse an edit.</p>
                                    : <>
                                        <p className="options-label">Choose a replacement</p>
                                        {suggestion.alternatives.map((alternative, alternativeIndex) => <button
                                            className="alternative-btn" key={alternativeIndex} disabled={props.disabled}
                                            onClick={() => props.onAccept(suggestion.id, alternative)}>
                                            <span className="alt-number">{alternativeIndex + 1}</span><span>{alternative}</span>
                                        </button>)}
                                        <button className="dismiss-btn" disabled={props.disabled}
                                            onClick={() => props.onDismiss(suggestion.id)}>Dismiss suggestion</button>
                                    </>}
                            </div>}
                        </section>;
                    })}
                </div>}
        </aside>
    );
}

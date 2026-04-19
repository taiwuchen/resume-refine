import { useEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { Change, Paragraph, ParagraphRun, ParsedDocument, Suggestion } from '../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    document: ParsedDocument | null;
    changes: Change[];
    suggestions: Suggestion[];
    activeParagraphId: string | null;
    onSelectParagraph: (paragraphId: string | null) => void;
    onRevertChange: (paragraphId: string) => void;
}

function renderFormattedRun(run: ParagraphRun, key: string): ReactNode {
    let content: ReactNode = run.text || <br />;

    if (run.bold) {
        content = <strong>{content}</strong>;
    }
    if (run.italic) {
        content = <em>{content}</em>;
    }
    if (run.underline) {
        content = <u>{content}</u>;
    }

    return <span key={key}>{content}</span>;
}

function buildDisplayRuns(paragraph: Paragraph, change: Change | undefined): ParagraphRun[] {
    if (!change) {
        return paragraph.runs;
    }

    const formattingSource = paragraph.runs[0];
    return [{
        text: change.replacement,
        start: change.start,
        end: change.end,
        bold: formattingSource?.bold ?? false,
        italic: formattingSource?.italic ?? false,
        underline: formattingSource?.underline ?? false,
    }];
}

export function DocumentPreview({
    document,
    changes,
    suggestions,
    activeParagraphId,
    onSelectParagraph,
    onRevertChange,
}: DocumentPreviewProps) {
    const paragraphRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const changeByParagraphId = new Map<string, Change>(
        changes.map((change) => [change.paragraph_id, change])
    );
    const suggestionIds = new Set(suggestions.map((suggestion) => suggestion.paragraph_id));

    useEffect(() => {
        if (!activeParagraphId) return;
        paragraphRefs.current[activeParagraphId]?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
        });
    }, [activeParagraphId]);

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">Select highlighted text to sync with suggestions</span>
            </div>
            <div className="preview-container">
                {!document && (
                    <div className="preview-empty">
                        <p>Upload a resume to see preview</p>
                    </div>
                )}
                {document && (
                    <div className="structured-content">
                        {document.paragraphs.map((paragraph) => {
                            const change = changeByParagraphId.get(paragraph.paragraph_id);
                            const isSuggested = suggestionIds.has(paragraph.paragraph_id) && !change;
                            const isInteractive = isSuggested || !!change;
                            const isActive = activeParagraphId === paragraph.paragraph_id;
                            const paragraphClassName = [
                                'preview-paragraph',
                                paragraph.is_list_item ? 'preview-list-item' : '',
                                isSuggested ? 'suggestion-pending' : '',
                                change ? 'change-applied' : '',
                                isInteractive ? 'preview-interactive' : '',
                                isActive ? 'preview-selected' : '',
                            ].filter(Boolean).join(' ');
                            const displayRuns = buildDisplayRuns(paragraph, change);
                            const listIndent = `${paragraph.list_level * 20}px`;
                            const paragraphStyle: CSSProperties = paragraph.is_list_item
                                ? { paddingLeft: listIndent }
                                : {};

                            return (
                                <div
                                    key={paragraph.paragraph_id}
                                    ref={(node) => {
                                        paragraphRefs.current[paragraph.paragraph_id] = node;
                                    }}
                                    data-paragraph-id={paragraph.paragraph_id}
                                    className={paragraphClassName}
                                    onClick={() => {
                                        if (isInteractive) {
                                            onSelectParagraph(paragraph.paragraph_id);
                                        }
                                    }}
                                    style={paragraphStyle}
                                    title={isInteractive ? 'Click to focus this suggestion' : undefined}
                                >
                                    {paragraph.is_list_item && (
                                        <span className="preview-bullet" aria-hidden="true">•</span>
                                    )}
                                    <span className="preview-paragraph-text">
                                        {displayRuns.length > 0
                                            ? displayRuns.map((run, index) => renderFormattedRun(run, `${paragraph.paragraph_id}-${index}`))
                                            : <br />}
                                    </span>
                                    {isActive && change && (
                                        <button
                                            type="button"
                                            className="preview-action-btn"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onRevertChange(paragraph.paragraph_id);
                                            }}
                                        >
                                            Revert
                                        </button>
                                    )}
                                    {isActive && isSuggested && !change && (
                                        <span className="preview-selection-badge">Suggestion selected</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

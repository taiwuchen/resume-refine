import type { CSSProperties, ReactNode } from 'react';
import type { Change, Paragraph, ParagraphRun, ParsedDocument, Suggestion } from '../types';
import './DocumentPreview.css';

interface DocumentPreviewProps {
    document: ParsedDocument | null;
    changes: Change[];
    suggestions: Suggestion[];
    onRevertChange: (index: number) => void;
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
    onRevertChange,
}: DocumentPreviewProps) {
    const changeIndexByParagraphId = new Map<string, number>(
        changes.map((change, index) => [change.paragraph_id, index])
    );
    const suggestionIds = new Set(suggestions.map((suggestion) => suggestion.paragraph_id));

    return (
        <div className="document-preview">
            <div className="preview-header">
                <span className="preview-title">Document Preview</span>
                <span className="preview-hint">Click highlighted text to revert</span>
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
                            const changeIndex = changeIndexByParagraphId.get(paragraph.paragraph_id);
                            const change = changeIndex !== undefined ? changes[changeIndex] : undefined;
                            const isSuggested = suggestionIds.has(paragraph.paragraph_id) && changeIndex === undefined;
                            const paragraphClassName = [
                                'preview-paragraph',
                                paragraph.is_list_item ? 'preview-list-item' : '',
                                isSuggested ? 'suggestion-pending' : '',
                                change ? 'change-applied' : '',
                            ].filter(Boolean).join(' ');
                            const displayRuns = buildDisplayRuns(paragraph, change);
                            const listIndent = `${paragraph.list_level * 20}px`;
                            const paragraphStyle: CSSProperties = paragraph.is_list_item
                                ? { paddingLeft: listIndent }
                                : {};

                            return (
                                <div
                                    key={paragraph.paragraph_id}
                                    data-paragraph-id={paragraph.paragraph_id}
                                    className={paragraphClassName}
                                    onClick={() => {
                                        if (changeIndex !== undefined) {
                                            onRevertChange(changeIndex);
                                        }
                                    }}
                                    style={paragraphStyle}
                                    title={change ? 'Click to revert' : undefined}
                                >
                                    {paragraph.is_list_item && (
                                        <span className="preview-bullet" aria-hidden="true">•</span>
                                    )}
                                    <span className="preview-paragraph-text">
                                        {displayRuns.length > 0
                                            ? displayRuns.map((run, index) => renderFormattedRun(run, `${paragraph.paragraph_id}-${index}`))
                                            : <br />}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

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

    if (run.is_hyperlink && run.href) {
        content = (
            <a
                href={run.href}
                className="preview-link"
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => event.stopPropagation()}
            >
                {content}
            </a>
        );
    }

    return <span key={key}>{content}</span>;
}

interface HyperlinkSegment {
    text: string;
    href: string;
    formattingSource: ParagraphRun;
}

function getHyperlinkSegments(runs: ParagraphRun[]): HyperlinkSegment[] {
    const segments: HyperlinkSegment[] = [];

    for (const run of runs) {
        if (!run.is_hyperlink || !run.href || !run.text) {
            continue;
        }

        const lastSegment = segments[segments.length - 1];
        if (lastSegment && lastSegment.href === run.href) {
            lastSegment.text += run.text;
            continue;
        }

        segments.push({
            text: run.text,
            href: run.href,
            formattingSource: run,
        });
    }

    return segments;
}

function createPlainRun(
    text: string,
    start: number,
    formattingSource: ParagraphRun | undefined,
): ParagraphRun {
    return {
        text,
        start,
        end: start + text.length,
        bold: formattingSource?.bold ?? false,
        italic: formattingSource?.italic ?? false,
        underline: formattingSource?.underline ?? false,
        href: null,
        is_hyperlink: false,
    };
}

function buildDisplayRuns(paragraph: Paragraph, change: Change | undefined): ParagraphRun[] {
    if (!change) {
        return paragraph.runs;
    }

    const plainFormattingSource = paragraph.runs.find((run) => !run.is_hyperlink) ?? paragraph.runs[0];
    const hyperlinkSegments = getHyperlinkSegments(paragraph.runs);

    if (!hyperlinkSegments.length) {
        return [createPlainRun(change.replacement, change.start, plainFormattingSource)];
    }

    const displayRuns: ParagraphRun[] = [];
    let cursor = 0;
    let absoluteStart = change.start;
    let hasPreservedHyperlink = false;

    for (const segment of hyperlinkSegments) {
        const matchIndex = change.replacement.indexOf(segment.text, cursor);
        if (matchIndex === -1) {
            continue;
        }

        if (matchIndex > cursor) {
            const plainText = change.replacement.slice(cursor, matchIndex);
            displayRuns.push(createPlainRun(plainText, absoluteStart, plainFormattingSource));
            absoluteStart += plainText.length;
        }

        displayRuns.push({
            text: segment.text,
            start: absoluteStart,
            end: absoluteStart + segment.text.length,
            bold: segment.formattingSource.bold,
            italic: segment.formattingSource.italic,
            underline: segment.formattingSource.underline,
            href: segment.href,
            is_hyperlink: true,
        });
        absoluteStart += segment.text.length;
        cursor = matchIndex + segment.text.length;
        hasPreservedHyperlink = true;
    }

    if (cursor < change.replacement.length) {
        const trailingText = change.replacement.slice(cursor);
        displayRuns.push(createPlainRun(trailingText, absoluteStart, plainFormattingSource));
    }

    if (!hasPreservedHyperlink) {
        return [createPlainRun(change.replacement, change.start, plainFormattingSource)];
    }

    return displayRuns;
}

export function DocumentPreview({
    document,
    changes,
    suggestions,
    activeParagraphId,
    onSelectParagraph,
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
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

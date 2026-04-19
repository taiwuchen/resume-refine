import { render } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, expect, it, vi } from 'vitest';
import { DocumentPreview } from './DocumentPreview';
import type { Change, ParsedDocument, Suggestion } from '../types';


const documentFixture: ParsedDocument = {
    doc_id: 'doc-1',
    full_text: 'Repeated bullet\nRepeated bullet\nSummary line',
    position_map: [],
    paragraphs: [
        {
            paragraph_id: 'p0',
            start: 0,
            end: 15,
            text: 'Repeated bullet',
            runs: [{ text: 'Repeated bullet', start: 0, end: 15, bold: false, italic: false, underline: false }],
            is_editable: true,
            is_list_item: true,
            list_level: 0,
        },
        {
            paragraph_id: 'p1',
            start: 16,
            end: 31,
            text: 'Repeated bullet',
            runs: [{ text: 'Repeated bullet', start: 16, end: 31, bold: false, italic: false, underline: false }],
            is_editable: true,
            is_list_item: true,
            list_level: 0,
        },
        {
            paragraph_id: 'p2',
            start: 32,
            end: 44,
            text: 'Summary line',
            runs: [{ text: 'Summary line', start: 32, end: 44, bold: false, italic: false, underline: false }],
            is_editable: true,
            is_list_item: false,
            list_level: 0,
        },
    ],
};

const anchoredSuggestion: Suggestion = {
    id: 's1',
    paragraph_id: 'p1',
    start: 16,
    end: 31,
    original_text: 'Repeated bullet',
    alternatives: ['Anchored rewrite 1', 'Anchored rewrite 2', 'Anchored rewrite 3'],
};

const anchoredChange: Change = {
    paragraph_id: 'p1',
    start: 16,
    end: 31,
    original: 'Repeated bullet',
    replacement: 'Anchored replacement',
};


describe('DocumentPreview', () => {
    it('renders duplicate paragraphs and anchors suggestion highlighting to the correct paragraph', () => {
        const { container } = render(
            <DocumentPreview
                document={documentFixture}
                changes={[]}
                suggestions={[anchoredSuggestion]}
                onRevertChange={() => undefined}
            />
        );

        expect(container.querySelectorAll('[data-paragraph-id]')).toHaveLength(3);
        expect(container.querySelectorAll('.preview-list-item')).toHaveLength(2);
        expect(container.textContent).toContain('Repeated bullet');
        expect(container.querySelector('[data-paragraph-id="p1"]')).toHaveClass('suggestion-pending');
        expect(container.querySelector('[data-paragraph-id="p0"]')).not.toHaveClass('suggestion-pending');
    });

    it('applies and reverts a change for only the targeted paragraph', () => {
        const onRevertChange = vi.fn();
        const { container, getByText } = render(
            <DocumentPreview
                document={documentFixture}
                changes={[anchoredChange]}
                suggestions={[anchoredSuggestion]}
                onRevertChange={onRevertChange}
            />
        );

        expect(container.querySelector('[data-paragraph-id="p0"]')).toHaveTextContent('Repeated bullet');
        expect(container.querySelector('[data-paragraph-id="p1"]')).toHaveTextContent('Anchored replacement');
        expect(getByText('Anchored replacement')).toBeInTheDocument();

        fireEvent.click(container.querySelector('[data-paragraph-id="p1"]') as HTMLElement);

        expect(onRevertChange).toHaveBeenCalledWith(0);
    });
});

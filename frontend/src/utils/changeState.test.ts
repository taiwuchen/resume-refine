import { describe, expect, it } from 'vitest';
import type { Change, Suggestion } from '../types';
import { getVisibleSuggestions, removeChangeAtIndex, upsertParagraphChange } from './changeState';


const baseSuggestions: Suggestion[] = [
    {
        id: 's1',
        paragraph_id: 'p0',
        start: 0,
        end: 12,
        original_text: 'First bullet',
        alternatives: ['First option', 'Second option', 'Third option'],
    },
    {
        id: 's2',
        paragraph_id: 'p1',
        start: 13,
        end: 25,
        original_text: 'Second bullet',
        alternatives: ['Alt a', 'Alt b', 'Alt c'],
    },
];

const firstChange: Change = {
    paragraph_id: 'p1',
    start: 13,
    end: 25,
    original: 'Second bullet',
    replacement: 'Updated second bullet',
};


describe('changeState', () => {
    it('replaces an existing paragraph change instead of appending a duplicate', () => {
        const nextChange: Change = {
            ...firstChange,
            replacement: 'More precise bullet',
        };

        const updated = upsertParagraphChange([firstChange], nextChange);

        expect(updated).toHaveLength(1);
        expect(updated[0].replacement).toBe('More precise bullet');
    });

    it('hides suggestions for changed paragraphs and restores them after revert', () => {
        const visibleBeforeRevert = getVisibleSuggestions(baseSuggestions, [firstChange]);

        expect(visibleBeforeRevert.map((suggestion) => suggestion.paragraph_id)).toEqual(['p0']);

        const revertedChanges = removeChangeAtIndex([firstChange], 0);
        const visibleAfterRevert = getVisibleSuggestions(baseSuggestions, revertedChanges);

        expect(revertedChanges).toEqual([]);
        expect(visibleAfterRevert.map((suggestion) => suggestion.paragraph_id)).toEqual(['p0', 'p1']);
    });
});

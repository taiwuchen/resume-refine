import type { Change, Suggestion } from '../types';


export function upsertParagraphChange(changes: Change[], nextChange: Change): Change[] {
    const existingIndex = changes.findIndex(
        (change) => change.paragraph_id === nextChange.paragraph_id
    );

    if (existingIndex === -1) {
        return [...changes, nextChange];
    }

    return changes.map((change, index) => (
        index === existingIndex ? nextChange : change
    ));
}


export function removeChangeAtIndex(changes: Change[], indexToRemove: number): Change[] {
    return changes.filter((_, index) => index !== indexToRemove);
}


export function getVisibleSuggestions(
    suggestions: Suggestion[],
    changes: Change[],
): Suggestion[] {
    const changedParagraphIds = new Set(changes.map((change) => change.paragraph_id));
    return suggestions.filter(
        (suggestion) => !changedParagraphIds.has(suggestion.paragraph_id)
    );
}

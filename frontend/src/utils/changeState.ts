import type { Change } from '../types';


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

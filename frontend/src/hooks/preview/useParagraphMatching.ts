import { useMemo } from 'react';
import type { Change, PageRenderState, ParsedDocument, PreviewParagraphMatch, TextToken } from '../../types';

interface MatchResult {
    endIndex: number;
    tokenIndexes: number[];
}

function normalizeComparableText(value: string): string {
    return value
        .replace(/\u00ad/g, '')
        .replace(/[\u00A0\u2002\u2003\u2009\u200A\u200B\u2060]/g, ' ')
        .replace(/[‐‑‒–—]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function isBulletToken(value: string): boolean {
    const cleaned = value.replace(/[•◦▪‣∙]/g, '').trim();
    return !cleaned.length;
}

function shouldInsertTokenSeparator(previousToken: TextToken | null, nextToken: TextToken): boolean {
    if (!previousToken) {
        return false;
    }

    const previousText = previousToken.rawText;
    const nextText = nextToken.rawText;
    if (!previousText || !nextText) {
        return false;
    }

    if (/\s$/.test(previousText) || /^\s/.test(nextText)) {
        return false;
    }

    if (/^[,.;:!?%)\]}]/.test(nextText)) {
        return false;
    }

    if (/[([{/]$/.test(previousText)) {
        return false;
    }

    if (previousToken.pageIndex !== nextToken.pageIndex) {
        return true;
    }

    const previousRect = previousToken.textElement.getBoundingClientRect();
    const nextRect = nextToken.textElement.getBoundingClientRect();
    const lineHeight = Math.max(previousRect.height, nextRect.height, 12);
    const movedToNextLine = Math.abs(nextRect.top - previousRect.top) > lineHeight * 0.6;

    if (movedToNextLine) {
        return true;
    }

    const horizontalGap = nextRect.left - previousRect.right;
    return horizontalGap > Math.max(2, lineHeight * 0.08);
}

function appendComparableTokenText(
    currentAggregate: string,
    previousToken: TextToken | null,
    nextToken: TextToken,
): string {
    if (shouldInsertTokenSeparator(previousToken, nextToken)) {
        return `${currentAggregate} ${nextToken.rawText}`;
    }

    return `${currentAggregate}${nextToken.rawText}`;
}

function buildPreviewParagraphTexts(parsedDocument: ParsedDocument, changes: Change[]): Map<string, string> {
    const changeByParagraphId = new Map(changes.map((change) => [change.paragraph_id, change.replacement]));

    return new Map(
        parsedDocument.paragraphs.map((paragraph) => [
            paragraph.paragraph_id,
            changeByParagraphId.get(paragraph.paragraph_id) ?? paragraph.text,
        ]),
    );
}

function findParagraphMatch(tokens: TextToken[], target: string, startIndex: number): MatchResult | null {
    if (!target) {
        return null;
    }

    for (let candidateIndex = startIndex; candidateIndex < tokens.length; candidateIndex += 1) {
        let aggregate = '';
        const tokenIndexes: number[] = [];
        let previousToken: TextToken | null = null;

        for (let tokenIndex = candidateIndex; tokenIndex < tokens.length; tokenIndex += 1) {
            const token = tokens[tokenIndex];
            aggregate = appendComparableTokenText(aggregate, previousToken, token);
            tokenIndexes.push(tokenIndex);
            previousToken = token;

            const normalizedAggregate = normalizeComparableText(aggregate);
            if (!normalizedAggregate) {
                continue;
            }

            if (normalizedAggregate === target) {
                return {
                    endIndex: tokenIndex,
                    tokenIndexes,
                };
            }

            if (!target.startsWith(normalizedAggregate)) {
                break;
            }
        }
    }

    return null;
}

function expandTokenIndexesForBullet(tokens: TextToken[], tokenIndexes: number[]): number[] {
    if (!tokenIndexes.length) {
        return tokenIndexes;
    }

    const firstIndex = tokenIndexes[0];
    if (firstIndex === 0) {
        return tokenIndexes;
    }

    const previousToken = tokens[firstIndex - 1];
    const firstToken = tokens[firstIndex];

    if (!isBulletToken(previousToken.rawText)) {
        return tokenIndexes;
    }

    if (previousToken.pageIndex !== firstToken.pageIndex) {
        return tokenIndexes;
    }

    const previousRect = previousToken.textElement.getBoundingClientRect();
    const firstRect = firstToken.textElement.getBoundingClientRect();
    if (Math.abs(previousRect.top - firstRect.top) > Math.max(6, firstRect.height * 0.75)) {
        return tokenIndexes;
    }

    return [firstIndex - 1, ...tokenIndexes];
}

export function useParagraphMatching(
    parsedDocument: ParsedDocument | null,
    changes: Change[],
    pageStates: PageRenderState[],
): PreviewParagraphMatch[] {
    return useMemo(() => {
        if (!parsedDocument || !pageStates.length) {
            return [];
        }

        const previewParagraphTexts = buildPreviewParagraphTexts(parsedDocument, changes);
        const allTokens = pageStates.flatMap((pageState) => pageState.tokens);
        const matches: PreviewParagraphMatch[] = [];
        let nextTokenIndex = 0;

        for (const paragraph of parsedDocument.paragraphs) {
            const previewText = previewParagraphTexts.get(paragraph.paragraph_id) ?? paragraph.text;
            const normalizedTarget = normalizeComparableText(previewText);
            if (!normalizedTarget) {
                continue;
            }

            const match = findParagraphMatch(allTokens, normalizedTarget, nextTokenIndex);
            if (!match) {
                continue;
            }

            nextTokenIndex = match.endIndex + 1;
            matches.push({
                paragraphId: paragraph.paragraph_id,
                tokenIndexes: expandTokenIndexesForBullet(allTokens, match.tokenIndexes),
            });
        }

        return matches;
    }, [changes, pageStates, parsedDocument]);
}

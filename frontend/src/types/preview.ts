export interface TextToken {
    pageIndex: number;
    pageElement: HTMLDivElement;
    overlayElement: HTMLDivElement;
    textElement: HTMLSpanElement;
    rawText: string;
}

export interface PageRenderState {
    pageIndex: number;
    pageElement: HTMLDivElement;
    overlayElement: HTMLDivElement;
    tokens: TextToken[];
}

export interface OverlayRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface PreviewParagraphMatch {
    paragraphId: string;
    tokenIndexes: number[];
}

export interface PreviewOverlay {
    id: string;
    paragraphId: string;
    pageIndex: number;
    rect: OverlayRect;
    isPending: boolean;
    isAccepted: boolean;
    isActive: boolean;
}

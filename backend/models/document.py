from pydantic import BaseModel, Field

from config import MAX_REPLACEMENT_CHARS


class PositionMapping(BaseModel):
    start: int
    end: int
    para_idx: int
    run_idx: int


class ParagraphRun(BaseModel):
    text: str
    start: int
    end: int
    bold: bool = False
    italic: bool = False
    underline: bool = False
    href: str | None = None
    is_hyperlink: bool = False


class Paragraph(BaseModel):
    paragraph_id: str
    start: int
    end: int
    text: str
    runs: list[ParagraphRun]
    is_editable: bool
    is_list_item: bool = False
    list_level: int = 0


class ParsedDocument(BaseModel):
    doc_id: str
    full_text: str
    position_map: list[PositionMapping]
    paragraphs: list[Paragraph]


class Change(BaseModel):
    paragraph_id: str
    start: int
    end: int
    original: str
    # Bounded: this text is rewritten into the DOCX and rendered to PDF, so an
    # unbounded value is a cheap way to make both expensive.
    replacement: str = Field(max_length=MAX_REPLACEMENT_CHARS)


class UploadResponse(BaseModel):
    document: ParsedDocument
    # Returned once. The client must send it back as X-Document-Token to read,
    # analyze, preview, or export this document.
    access_token: str

from pydantic import BaseModel


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
    replacement: str

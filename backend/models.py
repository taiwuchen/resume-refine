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


class Suggestion(BaseModel):
    id: str
    paragraph_id: str
    start: int
    end: int
    original_text: str
    alternatives: list[str]


class AnalyzeRequest(BaseModel):
    doc_id: str
    job_description: str


class AnalyzeResponse(BaseModel):
    suggestions: list[Suggestion]


class SuggestRequest(BaseModel):
    doc_id: str
    paragraph_id: str
    start: int
    end: int
    selected_text: str
    job_description: str
    user_prompt: str | None = None


class SuggestResponse(BaseModel):
    suggestion: Suggestion


class ExportRequest(BaseModel):
    doc_id: str
    changes: list[Change]


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatEdit(BaseModel):
    paragraph_id: str
    start: int
    end: int
    original_text: str
    new_text: str
    explanation: str


class ChatRequest(BaseModel):
    doc_id: str
    job_description: str
    messages: list[ChatMessage]


class ChatResponse(BaseModel):
    message: str
    edits: list[ChatEdit] = []

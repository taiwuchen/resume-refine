from pydantic import BaseModel


class PositionMapping(BaseModel):
    start: int
    end: int
    para_idx: int
    run_idx: int


class ParsedDocument(BaseModel):
    doc_id: str
    full_text: str
    position_map: list[PositionMapping]


class Change(BaseModel):
    start: int
    end: int
    original: str
    replacement: str


class Suggestion(BaseModel):
    id: str
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
    start: int
    end: int
    selected_text: str
    job_description: str
    user_prompt: str | None = None


class SuggestResponse(BaseModel):
    suggestion: Suggestion


class ApplyRequest(BaseModel):
    doc_id: str
    start: int
    end: int
    original: str
    replacement: str


class ExportRequest(BaseModel):
    doc_id: str
    changes: list[Change]

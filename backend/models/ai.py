from pydantic import BaseModel, Field

from models.document import Change


class Suggestion(BaseModel):
    id: str
    paragraph_id: str
    start: int
    end: int
    original_text: str
    alternatives: list[str]
    reason: str


class AnalyzeRequest(BaseModel):
    doc_id: str
    job_description: str
    changes: list[Change] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    suggestions: list[Suggestion]

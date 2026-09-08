from pydantic import BaseModel, Field

from config import MAX_JOB_DESCRIPTION_CHARS
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
    # Bounded: this goes straight into the prompt, so an unbounded value costs
    # the caller tokens and costs the server request time.
    job_description: str = Field(max_length=MAX_JOB_DESCRIPTION_CHARS)
    changes: list[Change] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    suggestions: list[Suggestion]

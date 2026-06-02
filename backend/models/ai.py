from pydantic import BaseModel, Field


class Suggestion(BaseModel):
    id: str
    paragraph_id: str
    start: int
    end: int
    original_text: str
    alternatives: list[str]
    issue_key: str | None = None
    category: str = "general"
    severity: str = "recommended"
    state: str = "open"
    reason: str = ""
    source: str = "analysis"
    parent_suggestion_id: str | None = None
    applied_text: str | None = None


class AnalyzeRequest(BaseModel):
    doc_id: str
    job_description: str
    changes: list["Change"] = Field(default_factory=list)
    generate_new_pass: bool = False
    decision_history: list[Suggestion] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    analysis_id: str
    resume_version_id: str
    resume_hash: str
    job_description_hash: str
    readiness_score: int
    status: str
    cache_hit: bool
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


class ChatMessage(BaseModel):
    role: str
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
    changes: list["Change"] = Field(default_factory=list)
    analysis_id: str | None = None
    active_suggestion_id: str | None = None
    suggestions: list[Suggestion] = Field(default_factory=list)


class ChatResponse(BaseModel):
    message: str
    edits: list[ChatEdit] = []


from models.document import Change  # noqa: E402

AnalyzeRequest.model_rebuild()
ChatRequest.model_rebuild()

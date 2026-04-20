from pydantic import BaseModel


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


class ChatResponse(BaseModel):
    message: str
    edits: list[ChatEdit] = []

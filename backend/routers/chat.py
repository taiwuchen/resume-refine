from fastapi import APIRouter, HTTPException
from models.ai import ChatRequest, ChatResponse
from repositories.document_repository import document_repository
from services.ai.chat import handle_chat
from services.resume_state import apply_changes_to_parsed_document

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    effective_doc = apply_changes_to_parsed_document(doc, request.changes)
    response = handle_chat(
        doc=effective_doc,
        job_description=request.job_description,
        messages=request.messages,
        active_suggestion_id=request.active_suggestion_id,
        suggestions=request.suggestions,
    )

    return response

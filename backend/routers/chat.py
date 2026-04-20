from fastapi import APIRouter, HTTPException
from models.ai import ChatRequest, ChatResponse
from repositories.document_repository import document_repository
from services.ai.chat import handle_chat

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    response = handle_chat(
        doc=doc,
        job_description=request.job_description,
        messages=request.messages,
    )

    return response

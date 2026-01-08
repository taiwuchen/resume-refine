from fastapi import APIRouter, HTTPException
from models import ChatRequest, ChatResponse
from services.chat import handle_chat
import storage

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    doc = storage.get_document(request.doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    response = handle_chat(
        resume_text=doc.full_text,
        job_description=request.job_description,
        messages=request.messages,
    )

    return response

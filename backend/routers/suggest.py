from fastapi import APIRouter, HTTPException

from models import SuggestRequest, SuggestResponse
from services.suggester import generate_suggestions
import storage

router = APIRouter()


@router.post("/suggest", response_model=SuggestResponse)
async def suggest(request: SuggestRequest):
    doc = storage.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if not request.job_description.strip():
        raise HTTPException(400, "Job description is required")
    
    suggestion = generate_suggestions(
        full_text=doc.full_text,
        selected_text=request.selected_text,
        start=request.start,
        end=request.end,
        job_description=request.job_description,
        user_prompt=request.user_prompt,
    )
    
    return SuggestResponse(suggestion=suggestion)

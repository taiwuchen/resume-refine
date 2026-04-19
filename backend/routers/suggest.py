from fastapi import APIRouter, HTTPException

from models import SuggestRequest, SuggestResponse
from services.document_utils import validate_paragraph_selection
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

    try:
        paragraph = validate_paragraph_selection(
            doc,
            request.paragraph_id,
            request.start,
            request.end,
            request.selected_text,
        )
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    suggestion = generate_suggestions(
        doc=doc,
        paragraph_id=paragraph.paragraph_id,
        selected_text=paragraph.text,
        job_description=request.job_description,
        user_prompt=request.user_prompt,
    )
    
    return SuggestResponse(suggestion=suggestion)

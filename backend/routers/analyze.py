from fastapi import APIRouter, HTTPException

from models import AnalyzeRequest, AnalyzeResponse
from services.analyzer import analyze_resume
import storage

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    doc = storage.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if not request.job_description.strip():
        raise HTTPException(400, "Job description is required")
    
    suggestions = analyze_resume(doc, request.job_description)
    
    return AnalyzeResponse(suggestions=suggestions)

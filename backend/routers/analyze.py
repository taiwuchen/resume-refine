import logging

from fastapi import APIRouter, HTTPException

from config import OPENROUTER_API_KEY
from models.ai import AnalyzeRequest, AnalyzeResponse
from repositories.document_repository import document_repository
from services.ai.analyzer import InvalidAnalysisResponse, analyze_resume
from services.resume_state import apply_changes_to_parsed_document

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze(request: AnalyzeRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found. Please upload the resume again.")
    if not request.job_description.strip():
        raise HTTPException(400, "Job description is required")
    try:
        effective_doc = apply_changes_to_parsed_document(doc, request.changes)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    if not OPENROUTER_API_KEY:
        raise HTTPException(503, "Analysis is unavailable. Configure the server's OpenRouter API key.")
    try:
        return AnalyzeResponse(suggestions=analyze_resume(effective_doc, request.job_description))
    except InvalidAnalysisResponse as error:
        raise HTTPException(502, str(error)) from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except Exception as error:
        logger.warning("Analysis provider failed: %s", type(error).__name__)
        raise HTTPException(502, "Analysis could not finish. Please try again.") from error

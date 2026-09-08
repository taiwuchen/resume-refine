import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool

from models.ai import AnalyzeRequest, AnalyzeResponse
from routers.dependencies import document_token, openrouter_key, require_document
from services.ai.analyzer import InvalidAnalysisResponse, analyze_resume
from services.ai.llm import MissingAPIKey, resolve_api_key
from services.resume_state import apply_changes_to_parsed_document

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(
    request: AnalyzeRequest,
    token: str = Depends(document_token),
    caller_key: str = Depends(openrouter_key),
):
    doc = require_document(request.doc_id, token)
    if not request.job_description.strip():
        raise HTTPException(400, "Job description is required")

    try:
        api_key = resolve_api_key(caller_key)
    except MissingAPIKey as error:
        raise HTTPException(401, str(error)) from error

    try:
        effective_doc = apply_changes_to_parsed_document(doc, request.changes)
    except ValueError as error:
        raise HTTPException(400, str(error)) from error

    try:
        # The provider call blocks for as long as the model takes; keep it off
        # the event loop so slow analyses do not stall other requests.
        suggestions = await run_in_threadpool(
            analyze_resume, effective_doc, request.job_description, api_key
        )
    except InvalidAnalysisResponse as error:
        raise HTTPException(502, str(error)) from error
    except ValueError as error:
        raise HTTPException(400, str(error)) from error
    except Exception as error:
        # Log the class only. Provider exceptions can carry request details,
        # and this path handles the caller's API key.
        logger.warning("Analysis provider failed: %s", type(error).__name__)
        raise HTTPException(502, "Analysis could not finish. Please try again.") from error

    return AnalyzeResponse(suggestions=suggestions)

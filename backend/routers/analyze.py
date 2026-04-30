from fastapi import APIRouter, HTTPException

from models.ai import AnalyzeRequest, AnalyzeResponse
from config import OPENROUTER_MODEL
from repositories.analysis_repository import analysis_repository
from repositories.document_repository import document_repository
from services.ai.analyzer import analyze_resume, calculate_readiness_score
from services.resume_state import (
    apply_changes_to_parsed_document,
    compute_analysis_fingerprint,
    compute_job_description_hash,
    compute_resume_hash,
    compute_resume_version_id,
)

router = APIRouter()


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze(request: AnalyzeRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    
    if not request.job_description.strip():
        raise HTTPException(400, "Job description is required")
    
    effective_doc = apply_changes_to_parsed_document(doc, request.changes)
    resume_hash = compute_resume_hash(effective_doc)
    job_description_hash = compute_job_description_hash(request.job_description)
    resume_version_id = compute_resume_version_id(resume_hash)
    fingerprint = compute_analysis_fingerprint(
        resume_hash,
        job_description_hash,
        OPENROUTER_MODEL,
    )

    if not request.generate_new_pass:
        existing_analysis = analysis_repository.get_current_by_fingerprint(fingerprint)
        if existing_analysis:
            return AnalyzeResponse(
                analysis_id=existing_analysis.analysis_id,
                resume_version_id=existing_analysis.resume_version_id,
                resume_hash=existing_analysis.resume_hash,
                job_description_hash=existing_analysis.job_description_hash,
                readiness_score=existing_analysis.readiness_score,
                status=existing_analysis.status,
                cache_hit=True,
                suggestions=existing_analysis.suggestions,
            )

    suggestions = analyze_resume(effective_doc, request.job_description)
    readiness_score = calculate_readiness_score(suggestions)
    analysis = analysis_repository.store(
        resume_version_id=resume_version_id,
        resume_hash=resume_hash,
        job_description_hash=job_description_hash,
        fingerprint=fingerprint,
        readiness_score=readiness_score,
        suggestions=suggestions,
    )
    
    return AnalyzeResponse(
        analysis_id=analysis.analysis_id,
        resume_version_id=analysis.resume_version_id,
        resume_hash=analysis.resume_hash,
        job_description_hash=analysis.job_description_hash,
        readiness_score=analysis.readiness_score,
        status=analysis.status,
        cache_hit=False,
        suggestions=analysis.suggestions,
    )

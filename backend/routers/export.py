from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from config import UPLOAD_DIR
from models.export import ExportRequest
from repositories.document_repository import document_repository
from services.exporter import apply_changes_to_docx

router = APIRouter()


@router.post("/export")
async def export_resume(request: ExportRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    
    original_path = document_repository.get_file_path(request.doc_id)
    if not original_path or not original_path.exists():
        raise HTTPException(404, "Original file not found")
    
    output_path = UPLOAD_DIR / f"refined_{original_path.name}"
    
    try:
        apply_changes_to_docx(original_path, doc, request.changes, output_path)
    except ValueError as e:
        raise HTTPException(400, f"Invalid export change set: {e}")
    except Exception as e:
        raise HTTPException(500, f"Failed to export: {e}")
    
    return FileResponse(
        path=output_path,
        filename=f"refined_{original_path.name}",
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

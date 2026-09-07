import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from config import UPLOAD_DIR
from models.export import ExportRequest
from repositories.document_repository import document_repository
from services.exporter import apply_changes_to_docx

router = APIRouter()


@router.post("/export")
def export_resume(request: ExportRequest):
    doc = document_repository.get_document(request.doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    
    original_path = document_repository.get_file_path(request.doc_id)
    if not original_path or not original_path.exists():
        raise HTTPException(404, "Original file not found")
    
    output_path = UPLOAD_DIR / f"refined_{uuid.uuid4()}.docx"
    
    try:
        apply_changes_to_docx(original_path, doc, request.changes, output_path)
    except ValueError as e:
        output_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Invalid export change set: {e}")
    except Exception as e:
        output_path.unlink(missing_ok=True)
        raise HTTPException(500, f"Failed to export: {e}")
    
    return FileResponse(
        path=output_path,
        filename="refined_resume.docx",
        background=BackgroundTask(output_path.unlink, missing_ok=True),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

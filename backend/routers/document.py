from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

import storage
from models import PreviewPdfRequest
from services.preview.pipeline import create_preview_pdf

router = APIRouter()


@router.get("/document/{doc_id}")
async def get_document(doc_id: str):
    """Serve the raw DOCX file for preview."""
    file_path = storage.get_file_path(doc_id)
    if not file_path or not file_path.exists():
        raise HTTPException(404, "Document not found")
    
    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=file_path.name,
    )


@router.post("/document/{doc_id}/preview-pdf")
async def get_document_preview_pdf(doc_id: str, request: PreviewPdfRequest):
    """Serve a PDF preview of the current document state."""
    doc = storage.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    original_path = storage.get_file_path(doc_id)
    if not original_path or not original_path.exists():
        raise HTTPException(404, "Original file not found")

    try:
        pdf_path = create_preview_pdf(original_path, doc, request.changes, doc_id=doc_id)
    except ValueError as error:
        raise HTTPException(400, f"Invalid preview change set: {error}")
    except RuntimeError as error:
        raise HTTPException(503, str(error))
    except Exception as error:
        raise HTTPException(500, f"Failed to generate PDF preview: {error}")

    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"{original_path.stem}.pdf",
    )

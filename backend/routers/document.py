import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from models.preview import PreviewPdfRequest
from routers.dependencies import document_token, require_document, require_document_file
from services.preview.pipeline import create_preview_pdf

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/document/{doc_id}")
def get_document(doc_id: str, token: str = Depends(document_token)):
    """Serve the raw DOCX file for preview."""
    file_path = require_document_file(doc_id, token)

    return FileResponse(
        path=file_path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=file_path.name,
    )


@router.post("/document/{doc_id}/preview-pdf")
async def get_document_preview_pdf(
    doc_id: str,
    request: PreviewPdfRequest,
    token: str = Depends(document_token),
):
    """Serve a PDF preview of the current document state."""
    doc = require_document(doc_id, token)
    original_path = require_document_file(doc_id, token)

    try:
        # Rendering shells out to LibreOffice and blocks; keep it off the loop.
        pdf_path = await run_in_threadpool(
            create_preview_pdf, original_path, doc, request.changes, doc_id=doc_id
        )
    except ValueError as error:
        raise HTTPException(400, f"Invalid preview change set: {error}") from error
    except Exception as error:
        # Renderer errors carry the internal Gotenberg URL and its response
        # body, so they are logged rather than returned.
        logger.warning("Preview rendering failed: %s: %s", type(error).__name__, error)
        raise HTTPException(503, "Preview is unavailable. Please try again.") from error

    return FileResponse(
        path=pdf_path,
        background=BackgroundTask(pdf_path.unlink, missing_ok=True),
        media_type="application/pdf",
        filename=f"{original_path.stem}.pdf",
    )

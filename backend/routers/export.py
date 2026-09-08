import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from config import UPLOAD_DIR
from models.export import ExportRequest
from routers.dependencies import document_token, require_document, require_document_file
from services.exporter import apply_changes_to_docx

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/export")
async def export_resume(request: ExportRequest, token: str = Depends(document_token)):
    doc = require_document(request.doc_id, token)
    original_path = require_document_file(request.doc_id, token)

    output_path = UPLOAD_DIR / f"refined_{uuid.uuid4()}.docx"

    try:
        await run_in_threadpool(
            apply_changes_to_docx, original_path, doc, request.changes, output_path
        )
    except ValueError as error:
        output_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Invalid export change set: {error}") from error
    except Exception as error:
        output_path.unlink(missing_ok=True)
        logger.warning("Export failed: %s", type(error).__name__)
        raise HTTPException(500, "Export could not finish. Please try again.") from error

    return FileResponse(
        path=output_path,
        filename="refined_resume.docx",
        background=BackgroundTask(output_path.unlink, missing_ok=True),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )

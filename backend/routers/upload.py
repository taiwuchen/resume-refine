import uuid

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from config import MAX_UPLOAD_BYTES, UPLOAD_DIR
from models.document import UploadResponse
from repositories.document_repository import document_repository, new_access_token
from services.docx_safety import UnsafeDocument, validate_docx_archive, validate_parsed_document
from services.parser import parse_docx

router = APIRouter()

_CHUNK_BYTES = 64 * 1024


async def _write_within_limit(file: UploadFile, destination) -> None:
    """Stream the upload to disk, aborting past the ceiling.

    Reading the whole body first would let a large upload exhaust memory
    before any limit could be applied.
    """
    written = 0
    while chunk := await file.read(_CHUNK_BYTES):
        written += len(chunk)
        if written > MAX_UPLOAD_BYTES:
            raise HTTPException(
                413,
                f"Resume is larger than the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            )
        destination.write(chunk)


@router.post("/upload", response_model=UploadResponse)
async def upload_resume(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(400, "Only .docx files are supported")

    file_path = UPLOAD_DIR / f"{uuid.uuid4()}.docx"

    try:
        with open(file_path, "wb") as destination:
            await _write_within_limit(file, destination)

        # Parsing is CPU-bound and blocking; keep it off the event loop so one
        # expensive document cannot stall every other request.
        await run_in_threadpool(validate_docx_archive, file_path)
        doc = await run_in_threadpool(parse_docx, file_path)
        validate_parsed_document(doc)
    except UnsafeDocument as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, str(error)) from error
    except HTTPException:
        file_path.unlink(missing_ok=True)
        raise
    except Exception as error:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, "This resume could not be read.") from error

    token = new_access_token()
    document_repository.store_document(doc, file_path, token)

    return UploadResponse(document=doc, access_token=token)

import uuid
from fastapi import APIRouter, UploadFile, HTTPException

from config import UPLOAD_DIR
from models.document import ParsedDocument
from repositories.document_repository import document_repository
from services.parser import parse_docx

router = APIRouter()


@router.post("/upload", response_model=ParsedDocument)
async def upload_resume(file: UploadFile):
    if not file.filename or not file.filename.lower().endswith(".docx"):
        raise HTTPException(400, "Only .docx files are supported")
    
    file_path = UPLOAD_DIR / f"{uuid.uuid4()}.docx"
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    try:
        doc = parse_docx(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Failed to parse DOCX: {e}")
    
    document_repository.store_document(doc, file_path)
    
    return doc

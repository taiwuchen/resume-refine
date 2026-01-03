from pathlib import Path
from fastapi import APIRouter, UploadFile, HTTPException

from config import UPLOAD_DIR
from models import ParsedDocument
from services.parser import parse_docx
import storage

router = APIRouter()


@router.post("/upload", response_model=ParsedDocument)
async def upload_resume(file: UploadFile):
    if not file.filename or not file.filename.endswith(".docx"):
        raise HTTPException(400, "Only .docx files are supported")
    
    file_path = UPLOAD_DIR / file.filename
    
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)
    
    try:
        doc = parse_docx(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Failed to parse DOCX: {e}")
    
    storage.store_document(doc, file_path)
    
    return doc

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

import storage

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

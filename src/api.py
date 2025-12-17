import os
import shutil
import uuid
from pathlib import Path
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from processor import process_resume_for_job

app = FastAPI(title="Resume Refine API")

# Temporary storage for uploads
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR = Path("output")
OUTPUT_DIR.mkdir(exist_ok=True)

class JobResponse(BaseModel):
    id: str
    company: str
    role: str
    status: str
    docx_path: str
    pdf_path: str

# Simple in-memory store for demo (no DB to keep it simple)
jobs_store = {}

@app.post("/process")
async def process_resume(
    resume: UploadFile = File(...),
    jds: List[str] = Form(...)
):
    """
    Process one resume against multiple job descriptions in parallel.
    """
    # Save the uploaded resume
    resume_id = str(uuid.uuid4())
    resume_path = UPLOAD_DIR / f"{resume_id}_{resume.filename}"
    with resume_path.open("wb") as buffer:
        shutil.copyfileobj(resume.file, buffer)

    results = []
    
    # We use a ThreadPoolExecutor for parallel processing of multiple JDs
    # The processor.py handles its own internal locking for the PDF step.
    with ThreadPoolExecutor() as executor:
        futures = [
            executor.submit(process_resume_for_job, resume_path, jd, OUTPUT_DIR)
            for jd in jds
        ]
        
        for future in futures:
            try:
                result = future.result()
                job_id = str(uuid.uuid4())
                job_info = {
                    "id": job_id,
                    "status": "completed",
                    **result
                }
                jobs_store[job_id] = job_info
                results.append(job_info)
            except Exception as e:
                print(f"Error processing job: {e}")
                # In a real app we'd track failed jobs too
                continue

    return results

@app.get("/download/{job_id}/{file_type}")
async def download_file(job_id: str, file_type: str):
    job = jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    path = job.get("pdf" if file_type == "pdf" else "docx")
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path, filename=os.path.basename(path))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

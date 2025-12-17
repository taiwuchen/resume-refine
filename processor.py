from pathlib import Path
from typing import Dict, Optional
import threading
import time

from src.exporter import apply_changes, export_pdf, save_docx
from src.job_metadata import extract_job_metadata, sanitize_for_path
from src.optimizer import optimize_resume
from src.parser import extract_structure, parse_docx

# docx2pdf uses AppleScript/COM to talk to Word. 
# It is NOT thread-safe. We use a lock to ensure one PDF at a time.
WORD_LOCK = threading.Lock()

def process_resume_for_job(
    resume_path: Path, 
    jd_text: str, 
    output_base_dir: Path = Path("output"),
    status_callback: Optional[callable] = None,
) -> Dict[str, str]:
    """
    Process a single resume against a single job description.
    Returns metadata about the generated files.
    """
    start = time.perf_counter()

    def notify(message: str, progress: float) -> None:
        if status_callback:
            elapsed = time.perf_counter() - start
            status_callback(message, progress, elapsed)

    notify("Extracting metadata...", 0.05)
    # 1. Extract metadata
    company, role = extract_job_metadata(jd_text)
    folder_name = f"{sanitize_for_path(company)}__{sanitize_for_path(role)}"
    output_dir = output_base_dir / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    notify("Parsing resume...", 0.15)
    # 2. Parse
    doc = parse_docx(str(resume_path))
    structure = extract_structure(doc)

    notify("Optimizing content (LLM)...", 0.40)
    # 3. Optimize (LLM call - parallelizable)
    changes = optimize_resume(structure, jd_text)

    notify("Applying changes...", 0.65)
    # 4. Apply & Save DOCX
    apply_changes(doc, changes)
    docx_path = output_dir / "resume.docx"
    save_docx(doc, str(docx_path))

    notify("Waiting for PDF lock...", 0.75)
    # 5. Export PDF (Locked - serialized)
    pdf_path = output_dir / "resume.pdf"
    with WORD_LOCK:
        notify("Exporting PDF via Word...", 0.85)
        export_pdf(str(docx_path), str(pdf_path))

    notify("Completed.", 1.0)
    return {
        "company": company,
        "role": role,
        "folder": folder_name,
        "docx": str(docx_path),
        "pdf": str(pdf_path),
    }

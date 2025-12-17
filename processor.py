from pathlib import Path
from typing import Dict, List, Tuple
import threading

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
    output_base_dir: Path = Path("output")
) -> Dict[str, str]:
    """
    Process a single resume against a single job description.
    Returns metadata about the generated files.
    """
    # 1. Extract metadata
    company, role = extract_job_metadata(jd_text)
    folder_name = f"{sanitize_for_path(company)}__{sanitize_for_path(role)}"
    output_dir = output_base_dir / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    # 2. Parse
    doc = parse_docx(str(resume_path))
    structure = extract_structure(doc)

    # 3. Optimize (LLM call - parallelizable)
    changes = optimize_resume(structure, jd_text)

    # 4. Apply & Save DOCX
    apply_changes(doc, changes)
    docx_path = output_dir / "resume.docx"
    save_docx(doc, str(docx_path))

    # 5. Export PDF (Locked - serialized)
    pdf_path = output_dir / "resume.pdf"
    with WORD_LOCK:
        export_pdf(str(docx_path), str(pdf_path))

    return {
        "company": company,
        "role": role,
        "folder": folder_name,
        "docx": str(docx_path),
        "pdf": str(pdf_path),
    }

import subprocess
from pathlib import Path

from config import OUTPUT_PDF_DIR, TMP_PDF_DIR
from models import Change, ParsedDocument
from services.exporter import apply_changes_to_docx

WORD_APP_PATH = Path("/Applications/Microsoft Word.app")


def create_preview_pdf(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    *,
    doc_id: str,
) -> Path:
    source_docx_path = original_path

    if changes:
        source_docx_path = TMP_PDF_DIR / f"{doc_id}_preview.docx"
        apply_changes_to_docx(original_path, doc, changes, source_docx_path)

    output_pdf_path = OUTPUT_PDF_DIR / f"{doc_id}_preview.pdf"
    convert_docx_to_pdf(source_docx_path, output_pdf_path)
    return output_pdf_path


def convert_docx_to_pdf(input_path: Path, output_path: Path) -> Path:
    if not WORD_APP_PATH.exists():
        raise RuntimeError("Microsoft Word is required for PDF preview on this machine")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    script = f"""
set inputPath to POSIX file "{input_path}"
set outputPath to POSIX file "{output_path}"
tell application "Microsoft Word"
    open inputPath
    save as active document file name outputPath file format format PDF
    close active document saving no
end tell
"""

    subprocess.run(
        ["osascript", "-"],
        input=script,
        text=True,
        check=True,
        capture_output=True,
    )

    if not output_path.exists():
        raise RuntimeError("PDF preview generation failed")

    return output_path

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

from docx import Document
from docx.text.paragraph import Paragraph as DocxParagraph


def _replace_paragraph_text(paragraph: DocxParagraph, new_text: str) -> None:
    """Replace text while preserving paragraph formatting."""
    runs = paragraph.runs
    if not runs:
        paragraph.add_run(new_text)
        return

    runs[0].text = new_text
    for run in runs[1:]:
        run.text = ""


def apply_changes(doc: Document, optimized: dict[int, str]) -> Document:
    for idx, new_text in optimized.items():
        if idx < 0 or idx >= len(doc.paragraphs):
            raise IndexError(f"Paragraph index {idx} out of range")

        paragraph = doc.paragraphs[idx]
        _replace_paragraph_text(paragraph, new_text)

    return doc


def save_docx(doc: Document, output_path: str) -> str:
    path = Path(output_path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(path)
    return str(path)


def export_pdf(doc: Document, output_path: str) -> str:
    """Export the given document to PDF using LibreOffice headless mode."""
    output = Path(output_path).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp:
        temp_docx = Path(temp.name)

    try:
        doc.save(temp_docx)

        output_dir = output.parent
        try:
            subprocess.run(
                [
                    "soffice",
                    "--headless",
                    "--convert-to",
                    "pdf",
                    "--outdir",
                    str(output_dir),
                    str(temp_docx),
                ],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                "LibreOffice 'soffice' command not found. "
                "Install LibreOffice (e.g., 'brew install --cask libreoffice') "
                "or update PATH."
            ) from exc
        except subprocess.CalledProcessError as exc:
            raise RuntimeError(
                f"LibreOffice conversion failed: {exc.stderr.decode().strip()}"
            ) from exc

        generated_pdf = output_dir / f"{temp_docx.stem}.pdf"
        generated_pdf.replace(output)
    finally:
        temp_docx.unlink(missing_ok=True)

    return str(output)


from __future__ import annotations

import tempfile
from pathlib import Path

from docx import Document
from docx.text.paragraph import Paragraph as DocxParagraph
from docx2pdf import convert


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
    output = Path(output_path).expanduser()
    output.parent.mkdir(parents=True, exist_ok=True)

    # docx2pdf requires a DOCX file on disk
    with tempfile.NamedTemporaryFile(suffix=".docx", delete=False) as temp:
        temp_path = Path(temp.name)
    try:
        doc.save(temp_path)
        convert(str(temp_path), str(output))
    finally:
        temp_path.unlink(missing_ok=True)

    return str(output)


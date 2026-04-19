from pathlib import Path
from docx import Document
from models import Change, ParsedDocument


def apply_changes_to_docx(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    output_path: Path,
) -> Path:
    """Apply text changes to original DOCX while preserving formatting."""
    
    docx = Document(original_path)

    paragraph_map = {
        paragraph.paragraph_id: (index, paragraph)
        for index, paragraph in enumerate(doc.paragraphs)
    }
    seen_paragraph_ids: set[str] = set()

    for change in changes:
        paragraph_entry = paragraph_map.get(change.paragraph_id)
        if paragraph_entry is None:
            raise ValueError(f"Unknown paragraph: {change.paragraph_id}")

        paragraph_index, paragraph = paragraph_entry
        if not paragraph.is_editable:
            raise ValueError(f"Paragraph is not editable: {change.paragraph_id}")

        if change.paragraph_id in seen_paragraph_ids:
            raise ValueError(f"Duplicate change for paragraph: {change.paragraph_id}")

        if change.start != paragraph.start or change.end != paragraph.end:
            raise ValueError("Changes must target a full paragraph")

        if change.original != paragraph.text:
            raise ValueError("Change original text does not match the paragraph")

        apply_single_change(docx, paragraph_index, change.replacement)
        seen_paragraph_ids.add(change.paragraph_id)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    docx.save(output_path)
    
    return output_path


def apply_single_change(docx: Document, paragraph_index: int, replacement: str) -> None:
    """Apply a single full-paragraph text change to the DOCX document."""

    if paragraph_index >= len(docx.paragraphs):
        raise ValueError(f"Paragraph index out of range: {paragraph_index}")

    paragraph = docx.paragraphs[paragraph_index]
    if paragraph.runs:
        paragraph.runs[0].text = replacement
        for run in paragraph.runs[1:]:
            run.text = ""
        return

    paragraph.add_run(replacement)

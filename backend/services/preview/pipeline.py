from pathlib import Path
from shutil import copyfile

from config import OUTPUT_PDF_DIR, TMP_PDF_DIR
from models import Change, ParsedDocument
from services.exporter import apply_changes_to_docx
from services.preview.normalizers.registry import normalize_preview_docx
from services.preview.renderers.gotenberg import GotenbergPreviewRenderer


def build_preview_source_docx(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    *,
    doc_id: str,
) -> Path:
    source_docx_path = TMP_PDF_DIR / f"{doc_id}_preview.docx"

    if changes:
        apply_changes_to_docx(original_path, doc, changes, source_docx_path)
    else:
        copyfile(original_path, source_docx_path)

    return source_docx_path


def create_preview_pdf(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    *,
    doc_id: str,
) -> Path:
    source_docx_path = build_preview_source_docx(
        original_path,
        doc,
        changes,
        doc_id=doc_id,
    )
    normalize_preview_docx(source_docx_path)

    output_pdf_path = OUTPUT_PDF_DIR / f"{doc_id}_preview.pdf"
    renderer = GotenbergPreviewRenderer()
    renderer.render(source_docx_path, output_pdf_path)
    return output_pdf_path

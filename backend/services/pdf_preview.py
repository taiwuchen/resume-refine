from pathlib import Path
from shutil import copyfile

import requests

from config import (
    GOTENBERG_TIMEOUT_SECONDS,
    GOTENBERG_URL,
    OUTPUT_PDF_DIR,
    TMP_PDF_DIR,
)
from models import Change, ParsedDocument
from services.exporter import apply_changes_to_docx
from services.preview_normalizer import normalize_preview_docx

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_CONVERT_ROUTE = "/forms/libreoffice/convert"


def create_preview_pdf(
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

    normalize_preview_docx(source_docx_path)

    output_pdf_path = OUTPUT_PDF_DIR / f"{doc_id}_preview.pdf"
    convert_docx_to_pdf(source_docx_path, output_pdf_path)
    return output_pdf_path


def convert_docx_to_pdf(input_path: Path, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with input_path.open("rb") as source_file:
            response = requests.post(
                f"{GOTENBERG_URL}{PDF_CONVERT_ROUTE}",
                files={
                    "files": (
                        input_path.name,
                        source_file,
                        DOCX_MEDIA_TYPE,
                    )
                },
                timeout=GOTENBERG_TIMEOUT_SECONDS,
            )
    except requests.Timeout as error:
        raise RuntimeError(
            f"PDF preview generation timed out after {GOTENBERG_TIMEOUT_SECONDS}s"
        ) from error
    except requests.RequestException as error:
        raise RuntimeError(
            f"PDF preview generation failed: could not reach Gotenberg at {GOTENBERG_URL}"
        ) from error

    if not response.ok:
        detail = response.text.strip() or response.reason or "unknown conversion error"
        raise RuntimeError(
            f"PDF preview generation failed: Gotenberg returned {response.status_code}: {detail[:300]}"
        )

    if not response.content:
        raise RuntimeError("PDF preview generation failed: empty response from Gotenberg")

    output_path.write_bytes(response.content)
    return output_path

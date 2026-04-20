from pathlib import Path

from models import Change, ParsedDocument
from services.preview.pipeline import create_preview_pdf
from services.preview.renderers.gotenberg import GotenbergPreviewRenderer


def convert_docx_to_pdf(input_path: Path, output_path: Path) -> Path:
    renderer = GotenbergPreviewRenderer()
    return renderer.render(input_path, output_path)

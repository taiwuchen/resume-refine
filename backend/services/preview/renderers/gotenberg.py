from pathlib import Path

import requests

from config import GOTENBERG_TIMEOUT_SECONDS, GOTENBERG_URL
from services.preview.renderers.base import PreviewRenderer

DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PDF_CONVERT_ROUTE = "/forms/libreoffice/convert"


class GotenbergPreviewRenderer(PreviewRenderer):
    def render(self, input_path: Path, output_path: Path) -> Path:
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

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def _bool_env(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Callers supply their own OpenRouter key per request. The server key is a
# local-development convenience only: leaving it enabled on a public
# deployment lets anonymous callers spend the operator's credits.
ALLOW_SERVER_API_KEY = _bool_env("ALLOW_SERVER_API_KEY", False)

# Comma-separated list of browser origins allowed to call this API. The
# defaults cover local development only; a deployment must set this.
CORS_ALLOW_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "CORS_ALLOW_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]

GOTENBERG_URL = os.getenv("GOTENBERG_URL", "http://localhost:3000").rstrip("/")
GOTENBERG_TIMEOUT_SECONDS = _int_env("GOTENBERG_TIMEOUT_SECONDS", 60)

# Upload and parsing limits. A DOCX is a ZIP archive, so a small upload can
# expand to gigabytes; every one of these is a guard against that.
MAX_UPLOAD_BYTES = _int_env("MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
MAX_EXPANDED_BYTES = _int_env("MAX_EXPANDED_BYTES", 40 * 1024 * 1024)
MAX_COMPRESSION_RATIO = _int_env("MAX_COMPRESSION_RATIO", 120)
MAX_ZIP_ENTRIES = _int_env("MAX_ZIP_ENTRIES", 2000)
MAX_PARAGRAPHS = _int_env("MAX_PARAGRAPHS", 5000)
MAX_DOCUMENT_CHARS = _int_env("MAX_DOCUMENT_CHARS", 400_000)
MAX_JOB_DESCRIPTION_CHARS = _int_env("MAX_JOB_DESCRIPTION_CHARS", 20_000)
MAX_REPLACEMENT_CHARS = _int_env("MAX_REPLACEMENT_CHARS", 5_000)

# Documents are deleted after this long. Resumes are personal data; retaining
# them indefinitely is both a privacy and a disk-growth problem.
DOCUMENT_TTL_SECONDS = _int_env("DOCUMENT_TTL_SECONDS", 24 * 60 * 60)

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

STATE_DIR = Path(__file__).parent.parent / "state"
STATE_DIR.mkdir(exist_ok=True)

TMP_PDF_DIR = Path(__file__).parent.parent / "tmp" / "pdfs"
TMP_PDF_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_PDF_DIR = Path(__file__).parent.parent / "output" / "pdf"
OUTPUT_PDF_DIR.mkdir(parents=True, exist_ok=True)

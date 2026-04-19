import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
GOTENBERG_URL = os.getenv("GOTENBERG_URL", "http://localhost:3001").rstrip("/")
GOTENBERG_TIMEOUT_SECONDS = int(os.getenv("GOTENBERG_TIMEOUT_SECONDS", "60"))

UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

TMP_PDF_DIR = Path(__file__).parent.parent / "tmp" / "pdfs"
TMP_PDF_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_PDF_DIR = Path(__file__).parent.parent / "output" / "pdf"
OUTPUT_PDF_DIR.mkdir(parents=True, exist_ok=True)

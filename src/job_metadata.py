import json
import re
from typing import Tuple

from openai import OpenAI  # pyright: ignore[reportMissingImports]

from src.config import OPENAI_API_KEY, OPENAI_MODEL, OPENAI_BASE_URL

SYSTEM_PROMPT = (
    "Extract the hiring company name and the role title from the job description. "
    "Return strict JSON with keys 'company' and 'role'. Do not include other text."
)


def _strip_code_fence(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        return "\n".join(text.split("\n")[1:-1]).strip()
    return text


def sanitize_for_path(label: str) -> str:
    """Make a safe folder/file component from a label."""
    cleaned = re.sub(r"[<>:\"/\\|?*\r\n\t]", " ", label).strip()
    cleaned = re.sub(r"\s+", " ", cleaned).strip(". ")
    if not cleaned:
        raise ValueError("Cannot build output path: empty label.")
    return cleaned.replace(" ", "_")


def extract_job_metadata(job_description: str) -> Tuple[str, str]:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY not set in environment")

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": job_description},
        ],
        timeout=60,
    )
    text = _strip_code_fence(response.choices[0].message.content or "")
    data = json.loads(text)
    company = data.get("company", "").strip()
    role = data.get("role", "").strip()
    if not company or not role:
        raise ValueError("Failed to extract company and role from job description.")
    return company, role

import hashlib
import re

from models.document import Change, Paragraph, ParsedDocument
from services.document_utils import get_paragraph_map


PROMPT_VERSION = "analysis-v2"
SCORING_VERSION = "readiness-v1"


def normalize_text_for_hash(text: str) -> str:
    """Normalize semantic text so harmless whitespace changes share a hash."""
    lines = [re.sub(r"\s+", " ", line).strip() for line in text.splitlines()]
    return "\n".join(line for line in lines if line)


def stable_hash(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def normalize_job_description(job_description: str) -> str:
    return normalize_text_for_hash(job_description).casefold()


def apply_changes_to_parsed_document(
    doc: ParsedDocument,
    changes: list[Change],
) -> ParsedDocument:
    """Build the effective text state used by analysis and chat."""
    if not changes:
        return doc

    paragraph_map = get_paragraph_map(doc)
    replacements = {change.paragraph_id: change.replacement for change in changes}
    next_paragraphs: list[Paragraph] = []

    for paragraph in doc.paragraphs:
        replacement = replacements.get(paragraph.paragraph_id)
        if replacement is None:
            next_paragraphs.append(paragraph)
            continue

        original_paragraph = paragraph_map.get(paragraph.paragraph_id)
        if original_paragraph is None or not original_paragraph.is_editable:
            continue

        next_paragraphs.append(paragraph.model_copy(update={"text": replacement}))

    return doc.model_copy(
        update={
            "full_text": "\n".join(paragraph.text for paragraph in next_paragraphs if paragraph.text.strip()),
            "paragraphs": next_paragraphs,
        }
    )


def compute_resume_hash(doc: ParsedDocument) -> str:
    catalog = "\n".join(
        f"{paragraph.paragraph_id}:{normalize_text_for_hash(paragraph.text)}"
        for paragraph in doc.paragraphs
    )
    return stable_hash(catalog)


def compute_job_description_hash(job_description: str) -> str:
    return stable_hash(normalize_job_description(job_description))


def compute_resume_version_id(resume_hash: str) -> str:
    return f"rv_{resume_hash[:16]}"


def compute_analysis_fingerprint(
    resume_hash: str,
    job_description_hash: str,
    model: str,
) -> str:
    return stable_hash(
        "|".join([
            resume_hash,
            job_description_hash,
            PROMPT_VERSION,
            model,
            SCORING_VERSION,
        ])
    )

import json
import uuid

from models.ai import Suggestion
from models.document import ParsedDocument
from prompts import ANALYZE_SYSTEM_PROMPT, build_analyze_user_prompt
from services.ai.llm import call_llm
from services.document_utils import build_paragraph_catalog, get_editable_paragraphs


def analyze_resume(doc: ParsedDocument, job_description: str) -> list[Suggestion]:
    """Analyze resume against JD and return suggestions for improvable sections."""
    editable_paragraphs = get_editable_paragraphs(doc)
    if not editable_paragraphs:
        return []

    user_prompt = build_analyze_user_prompt(
        doc.full_text,
        job_description,
        build_paragraph_catalog(editable_paragraphs),
    )

    response = call_llm([
        {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ])

    return parse_analyze_response(response, doc)


def parse_analyze_response(response: str, doc: ParsedDocument) -> list[Suggestion]:
    """Parse LLM response into suggestion objects."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        print(f"[analyzer] Failed to parse response: {text[:200]}")
        return []

    editable_paragraphs = {
        paragraph.paragraph_id: paragraph
        for paragraph in get_editable_paragraphs(doc)
    }

    suggestions = []
    seen_ids: set[str] = set()
    for item in data.get("suggestions", []):
        paragraph_id = item.get("paragraph_id")
        if not isinstance(paragraph_id, str):
            continue

        if paragraph_id in seen_ids:
            continue

        paragraph = editable_paragraphs.get(paragraph_id)
        if paragraph is None:
            print(f"[analyzer] Unknown paragraph ID: {paragraph_id}")
            continue

        alternatives = item.get("alternatives", [])
        if not isinstance(alternatives, list):
            continue

        normalized_alternatives = [
            alternative.strip()
            for alternative in alternatives
            if isinstance(alternative, str) and alternative.strip()
        ]
        if len(normalized_alternatives) < 3:
            print(f"[analyzer] Not enough alternatives for paragraph {paragraph_id}")
            continue

        suggestions.append(Suggestion(
            id=str(uuid.uuid4()),
            paragraph_id=paragraph_id,
            start=paragraph.start,
            end=paragraph.end,
            original_text=paragraph.text,
            alternatives=normalized_alternatives[:3],
        ))
        seen_ids.add(paragraph_id)

    return suggestions

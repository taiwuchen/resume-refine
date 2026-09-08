import json
import uuid

from models.ai import Suggestion
from models.document import ParsedDocument
from prompts import ANALYZE_SYSTEM_PROMPT, build_analyze_user_prompt
from services.ai.llm import call_llm
from services.document_utils import build_paragraph_catalog, get_editable_paragraphs


class InvalidAnalysisResponse(ValueError):
    pass


def analyze_resume(doc: ParsedDocument, job_description: str, api_key: str) -> list[Suggestion]:
    paragraphs = get_editable_paragraphs(doc)
    if not paragraphs:
        raise ValueError("No editable paragraphs were found in this resume.")
    response = call_llm(
        [
            {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
            {"role": "user", "content": build_analyze_user_prompt(
                doc.full_text, job_description, build_paragraph_catalog(paragraphs),
            )},
        ],
        api_key,
    )
    return parse_analyze_response(response, doc)


def parse_analyze_response(response: str, doc: ParsedDocument) -> list[Suggestion]:
    text = response.strip()
    if text.startswith("```") and text.endswith("```"):
        text = "\n".join(text.splitlines()[1:-1])
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        raise InvalidAnalysisResponse("The analysis returned invalid JSON. Please try again.") from error
    if not isinstance(data, dict) or not isinstance(data.get("suggestions"), list):
        raise InvalidAnalysisResponse("The analysis returned an invalid result. Please try again.")

    paragraphs = {paragraph.paragraph_id: paragraph for paragraph in get_editable_paragraphs(doc)}
    suggestions = []
    seen = set()
    for item in data["suggestions"]:
        if not isinstance(item, dict):
            raise InvalidAnalysisResponse("The analysis returned an invalid suggestion. Please try again.")
        paragraph_id = item.get("paragraph_id")
        if not isinstance(paragraph_id, str) or paragraph_id not in paragraphs or paragraph_id in seen:
            raise InvalidAnalysisResponse("The analysis could not match a suggestion to the resume. Please try again.")
        alternatives = item.get("alternatives")
        reason = item.get("reason")
        if (
            not isinstance(alternatives, list) or len(alternatives) != 3
            or any(not isinstance(value, str) or not value.strip() for value in alternatives)
            or not isinstance(reason, str) or not reason.strip()
        ):
            raise InvalidAnalysisResponse("The analysis returned incomplete suggestions. Please try again.")
        alternatives = [value.strip() for value in alternatives]
        if len(set(alternatives)) != 3:
            raise InvalidAnalysisResponse("The analysis returned duplicate alternatives. Please try again.")
        paragraph = paragraphs[paragraph_id]
        suggestions.append(Suggestion(
            id=str(uuid.uuid4()), paragraph_id=paragraph_id,
            start=paragraph.start, end=paragraph.end, original_text=paragraph.text,
            alternatives=alternatives, reason=reason.strip(),
        ))
        seen.add(paragraph_id)
    order = {paragraph.paragraph_id: index for index, paragraph in enumerate(doc.paragraphs)}
    return sorted(suggestions, key=lambda suggestion: order[suggestion.paragraph_id])

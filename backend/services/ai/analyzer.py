import json
import re
import uuid

from models.ai import Suggestion
from models.document import ParsedDocument
from prompts import ANALYZE_SYSTEM_PROMPT, build_analyze_user_prompt
from services.ai.llm import call_llm
from services.document_utils import build_paragraph_catalog, get_editable_paragraphs


VALID_CATEGORIES = {"impact", "keywords", "clarity", "length", "formatting", "relevance", "general"}
VALID_SEVERITIES = {"critical", "recommended", "optional"}


def analyze_resume(
    doc: ParsedDocument,
    job_description: str,
    decision_history: list[Suggestion] | None = None,
) -> list[Suggestion]:
    """Analyze resume against JD and return suggestions for improvable sections."""
    editable_paragraphs = get_editable_paragraphs(doc)
    if not editable_paragraphs:
        return []
    decisions = decision_history or []

    user_prompt = build_analyze_user_prompt(
        doc.full_text,
        job_description,
        build_paragraph_catalog(editable_paragraphs),
        build_decision_history_context(decisions),
    )

    response = call_llm([
        {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ])

    return filter_handled_suggestions(parse_analyze_response(response, doc), decisions)


def calculate_readiness_score(suggestions: list[Suggestion]) -> int:
    penalties = {
        "critical": 10,
        "recommended": 5,
        "optional": 2,
    }
    total_penalty = sum(penalties.get(suggestion.severity, 5) for suggestion in suggestions)
    return max(0, min(100, 100 - total_penalty))


def build_decision_history_context(decision_history: list[Suggestion]) -> str:
    handled = [
        suggestion
        for suggestion in decision_history
        if suggestion.state in {"accepted", "dismissed"}
    ]
    if not handled:
        return ""

    return "\n".join(
        " | ".join([
            f"issue_key={suggestion.issue_key or ''}",
            f"paragraph_id={suggestion.paragraph_id}",
            f"state={suggestion.state}",
            f"source={suggestion.source}",
            f"reason={suggestion.reason}",
        ])
        for suggestion in handled
    )


def filter_handled_suggestions(
    suggestions: list[Suggestion],
    decision_history: list[Suggestion],
) -> list[Suggestion]:
    handled_issue_keys = {
        suggestion.issue_key
        for suggestion in decision_history
        if suggestion.issue_key and suggestion.state in {"accepted", "dismissed"}
    }
    if not handled_issue_keys:
        return suggestions

    return [
        suggestion
        for suggestion in suggestions
        if suggestion.issue_key not in handled_issue_keys
    ]


def build_issue_key(paragraph_id: str, category: str, reason: str) -> str:
    key_source = f"{paragraph_id}-{category}-{reason}" if reason else f"{paragraph_id}-{category}"
    key = re.sub(r"[^a-z0-9]+", "-", key_source.casefold()).strip("-")
    return key[:80] or f"{paragraph_id}-general"


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

        category = item.get("category", "general")
        if not isinstance(category, str) or category not in VALID_CATEGORIES:
            category = "general"

        severity = item.get("severity", "recommended")
        if not isinstance(severity, str) or severity not in VALID_SEVERITIES:
            severity = "recommended"

        reason = item.get("reason", "")
        if not isinstance(reason, str):
            reason = ""

        issue_key = item.get("issue_key")
        if not isinstance(issue_key, str) or not issue_key.strip():
            issue_key = build_issue_key(paragraph_id, category, reason)

        suggestions.append(Suggestion(
            id=str(uuid.uuid4()),
            paragraph_id=paragraph_id,
            start=paragraph.start,
            end=paragraph.end,
            original_text=paragraph.text,
            alternatives=normalized_alternatives[:3],
            issue_key=issue_key.strip(),
            category=category,
            severity=severity,
            state="open",
            reason=reason.strip(),
            source="analysis",
        ))
        seen_ids.add(paragraph_id)

    return suggestions

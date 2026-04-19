import json
import uuid
from models import ParsedDocument, Suggestion
from services.llm import call_llm
from services.document_utils import get_editable_paragraphs
from prompts import SUGGEST_SYSTEM_PROMPT, build_suggest_user_prompt


def generate_suggestions(
    doc: ParsedDocument,
    paragraph_id: str,
    selected_text: str,
    job_description: str,
    user_prompt: str | None = None,
) -> Suggestion:
    """Generate 3 alternative suggestions for the selected text."""
    
    prompt = build_suggest_user_prompt(
        full_text=doc.full_text,
        paragraph_id=paragraph_id,
        selected_text=selected_text,
        job_description=job_description,
        user_prompt=user_prompt,
    )
    
    response = call_llm([
        {"role": "system", "content": SUGGEST_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ])
    
    alternatives = parse_suggest_response(response)
    
    paragraph = next(
        candidate
        for candidate in get_editable_paragraphs(doc)
        if candidate.paragraph_id == paragraph_id
    )

    return Suggestion(
        id=str(uuid.uuid4()),
        paragraph_id=paragraph_id,
        start=paragraph.start,
        end=paragraph.end,
        original_text=paragraph.text,
        alternatives=alternatives,
    )


def parse_suggest_response(response: str) -> list[str]:
    """Parse LLM response into list of alternatives."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    
    try:
        data = json.loads(text)
        alternatives = data.get("alternatives", [])
        if not isinstance(alternatives, list):
            return []

        normalized = [
            alternative.strip()
            for alternative in alternatives
            if isinstance(alternative, str) and alternative.strip()
        ]
        return normalized[:3]
    except json.JSONDecodeError:
        print(f"[suggester] Failed to parse response: {text[:200]}")
        return []

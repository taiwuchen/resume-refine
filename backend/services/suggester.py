import json
import uuid
from models import Suggestion
from services.llm import call_llm
from prompts import SUGGEST_SYSTEM_PROMPT, build_suggest_user_prompt


def generate_suggestions(
    full_text: str,
    selected_text: str,
    start: int,
    end: int,
    job_description: str,
    user_prompt: str | None = None,
) -> Suggestion:
    """Generate 3 alternative suggestions for the selected text."""
    
    prompt = build_suggest_user_prompt(
        full_text=full_text,
        selected_text=selected_text,
        job_description=job_description,
        user_prompt=user_prompt,
    )
    
    response = call_llm([
        {"role": "system", "content": SUGGEST_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ])
    
    alternatives = parse_suggest_response(response)
    
    return Suggestion(
        id=str(uuid.uuid4()),
        start=start,
        end=end,
        original_text=selected_text,
        alternatives=alternatives,
    )


def parse_suggest_response(response: str) -> list[str]:
    """Parse LLM response into list of alternatives."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    
    try:
        data = json.loads(text)
        return data.get("alternatives", [])[:3]
    except json.JSONDecodeError:
        print(f"[suggester] Failed to parse response: {text[:200]}")
        return []

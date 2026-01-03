import json
import uuid
from models import Suggestion
from services.llm import call_llm
from prompts import ANALYZE_SYSTEM_PROMPT, build_analyze_user_prompt


def analyze_resume(full_text: str, job_description: str) -> list[Suggestion]:
    """Analyze resume against JD and return suggestions for improvable sections."""
    
    user_prompt = build_analyze_user_prompt(full_text, job_description)
    
    response = call_llm([
        {"role": "system", "content": ANALYZE_SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ])
    
    return parse_analyze_response(response, full_text)


def parse_analyze_response(response: str, full_text: str) -> list[Suggestion]:
    """Parse LLM response into suggestion objects."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        print(f"[analyzer] Failed to parse response: {text[:200]}")
        return []
    
    suggestions = []
    for item in data.get("suggestions", []):
        original = item.get("original_text", "")
        
        start = full_text.find(original)
        if start == -1:
            print(f"[analyzer] Could not find text in resume: {original[:50]}")
            continue
        
        suggestions.append(Suggestion(
            id=str(uuid.uuid4()),
            start=start,
            end=start + len(original),
            original_text=original,
            alternatives=item.get("alternatives", []),
        ))
    
    return suggestions

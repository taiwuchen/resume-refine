import json
import httpx
from src.config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL
from src.parser import ResumeStructure


SYSTEM_PROMPT = """You are an expert ATS (Applicant Tracking System) resume optimizer.

RULES:
1. ONLY modify bullet points (work experience/project descriptions) and Skills section
2. DO NOT change: names, contact info, section headers, company names, job titles, dates, locations, education
3. Each paragraph has a CHARACTER LIMIT shown as "max:Xchars" - your output MUST be ≤ that limit
4. Include relevant keywords from the job description naturally
5. Keep the same meaning - don't fabricate experiences
6. Use strong action verbs and quantify achievements

OUTPUT FORMAT:
Return a JSON object where keys are paragraph indices and values are the optimized text.
Only include paragraphs you modified. Example:
{"12": "Optimized bullet here", "17": "Another bullet"}

Return ONLY the JSON object, no explanation."""


def call_openrouter(prompt: str) -> str:
    """Make API call to OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in environment")
    
    response = httpx.post(
        f"{OPENROUTER_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
        json={
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
        },
        timeout=120,
    )
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def parse_response(response: str) -> dict[int, str]:
    """Parse JSON response into dict of paragraph index -> new text."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    return {int(k): v for k, v in json.loads(text).items()}


def optimize_resume(structure: ResumeStructure, job_description: str) -> dict[int, str]:
    """Optimize resume content for job description."""
    prompt = f"""## RESUME (with paragraph indices and character limits)

{structure.to_prompt_format()}

## JOB DESCRIPTION

{job_description}

## TASK

Optimize bullet points to match the job description. Respect character limits strictly.
Return ONLY a JSON object with modified paragraphs."""

    response = call_openrouter(prompt)
    return parse_response(response)

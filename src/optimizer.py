import json
from typing import Dict, List
import time

import httpx

from src.config import OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_BASE_URL
from src.parser import ResumeStructure
from src.prompts import (
    OPTIMIZE_SYSTEM_PROMPT,
    SHORTEN_SYSTEM_PROMPT,
    build_optimize_user_prompt,
    build_shorten_user_prompt,
)


def call_openrouter(messages: List[Dict[str, str]], temperature: float = 0.3) -> str:
    """Make API call to OpenRouter."""
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in environment")

    start = time.perf_counter()
    print("[optimizer] Sending request to OpenRouter...")
    response = httpx.post(
        f"{OPENROUTER_BASE_URL}/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": OPENROUTER_MODEL,
            "messages": messages,
            "temperature": temperature,
        },
        timeout=120,
    )
    response.raise_for_status()
    elapsed = time.perf_counter() - start
    print(f"[optimizer] OpenRouter responded in {elapsed:.2f}s")
    return response.json()["choices"][0]["message"]["content"]


def parse_response(response: str) -> dict[int, str]:
    """Parse JSON response into dict of paragraph index -> new text."""
    text = response.strip()
    if text.startswith("```"):
        text = "\n".join(text.split("\n")[1:-1])
    return {int(k): v for k, v in json.loads(text).items()}


def shorten_text(
    original_text: str,
    attempted_text: str,
    job_description: str,
    max_chars: int,
    max_attempts: int = 3,
) -> str:
    latest = attempted_text

    for attempt in range(1, max_attempts + 1):
        print(f"[optimizer] Shorten attempt {attempt}/{max_attempts} (limit {max_chars}).")
        user_prompt = build_shorten_user_prompt(
            original_text=original_text,
            latest_text=latest,
            job_description=job_description,
            max_chars=max_chars,
        )

        result = call_openrouter(
            [
                {"role": "system", "content": SHORTEN_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.0,
        ).strip()

        if result.startswith("```"):
            result = "\n".join(result.split("\n")[1:-1]).strip()

        if len(result) <= max_chars:
            return result

        latest = result

    # If it still exceeds, fall back to original text
    print("[optimizer] Shorten attempts failed; reverting to original text.")
    return original_text


def enforce_limits(
    changes: dict[int, str],
    structure: ResumeStructure,
    job_description: str,
) -> dict[int, str]:
    """Ensure updated paragraphs respect original character counts."""
    limits = structure.get_char_limits()

    for idx, new_text in list(changes.items()):
        limit = limits.get(idx)
        if limit is None:
            continue

        if len(new_text) > limit:
            print(
                f"[optimizer] Paragraph {idx} exceeds limit "
                f"({len(new_text)} > {limit}). Triggering shorten."
            )
            original_text = structure.paragraphs[idx].text
            corrected = shorten_text(
                original_text=original_text,
                attempted_text=new_text,
                job_description=job_description,
                max_chars=limit,
            )
            changes[idx] = corrected

    return changes


def optimize_resume(structure: ResumeStructure, job_description: str) -> dict[int, str]:
    prompt = build_optimize_user_prompt(structure.to_prompt_format(), job_description)
    response = call_openrouter(
        [
            {"role": "system", "content": OPTIMIZE_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
    )
    changes = parse_response(response)
    return enforce_limits(changes, structure, job_description)

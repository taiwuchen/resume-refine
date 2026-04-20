import time

from openai import OpenAI

from config import OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL


def call_llm(messages: list[dict[str, str]]) -> str:
    if not OPENROUTER_API_KEY:
        raise ValueError("OPENROUTER_API_KEY not set in environment")

    start = time.perf_counter()
    print(f"[llm] Sending request to {OPENROUTER_MODEL}...")

    client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL)
    response = client.chat.completions.create(
        model=OPENROUTER_MODEL,
        messages=messages,
        timeout=120,
    )

    elapsed = time.perf_counter() - start
    print(f"[llm] Response received in {elapsed:.2f}s")

    return response.choices[0].message.content or ""

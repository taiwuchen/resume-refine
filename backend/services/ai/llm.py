import logging
import time

from openai import OpenAI

from config import ALLOW_SERVER_API_KEY, OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL

logger = logging.getLogger(__name__)


class MissingAPIKey(ValueError):
    pass


def resolve_api_key(caller_key: str) -> str:
    """Pick the key for this request.

    The caller's own key always wins. The server key is a local-development
    convenience and is only consulted when explicitly enabled, so a public
    deployment cannot quietly fund anonymous callers.
    """
    if caller_key:
        return caller_key
    if ALLOW_SERVER_API_KEY and OPENROUTER_API_KEY:
        return OPENROUTER_API_KEY
    raise MissingAPIKey("Add your OpenRouter API key to analyze this resume.")


def call_llm(messages: list[dict[str, str]], api_key: str) -> str:
    """Call OpenRouter with a request-scoped client.

    The key is never stored on a shared client, logged, or returned.
    """
    if not api_key:
        raise MissingAPIKey("Add your OpenRouter API key to analyze this resume.")

    start = time.perf_counter()
    logger.info("Requesting analysis from %s", OPENROUTER_MODEL)

    client = OpenAI(api_key=api_key, base_url=OPENROUTER_BASE_URL)
    response = client.chat.completions.create(
        model=OPENROUTER_MODEL,
        messages=messages,
        timeout=120,
    )

    logger.info("Analysis returned in %.2fs", time.perf_counter() - start)

    return response.choices[0].message.content or ""

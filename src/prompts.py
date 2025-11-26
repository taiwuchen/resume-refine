from __future__ import annotations

from textwrap import dedent


OPTIMIZE_SYSTEM_PROMPT = dedent(
    """\
    You are an expert ATS (Applicant Tracking System) resume optimizer.

    RULES:
    1. ONLY modify bullet points (work experience/project descriptions) and Skills section
    2. DO NOT change: names, contact info, section headers, company names, job titles, dates, locations, education
    3. Each paragraph has a CHARACTER LIMIT shown as "max:Xchars" - your output MUST be ≤ that limit
    4. Include relevant keywords from the job description naturally
    5. Keep the same meaning - don't fabricate experiences
    6. Use strong action verbs and quantify achievements

    OUTPUT FORMAT:
    Return a JSON object where keys are paragraph indices and values are the optimized text.
    Only include paragraphs that you modified. Example:
    {"12": "Optimized bullet here", "17": "Another bullet"}

    Return ONLY the JSON object, no explanation.
    """
).strip()


SHORTEN_SYSTEM_PROMPT = dedent(
    """\
    You are a concise resume editor.
    Rewrite the provided text so it:
    - stays truthful to the original content
    - includes relevant job description keywords when possible
    - fits within the specified maximum character count
    - returns PLAIN TEXT ONLY (no JSON, quotes, or commentary)
    """
).strip()


def build_optimize_user_prompt(resume_text: str, job_description: str) -> str:
    return dedent(
        f"""\
        ## RESUME (with paragraph indices and character limits)

        {resume_text}

        ## JOB DESCRIPTION

        {job_description}

        ## TASK

        Optimize bullet points/skills to match the job description. Respect character limits strictly.
        Return ONLY a JSON object with modified paragraphs.
        """
    ).strip()


def build_shorten_user_prompt(
    original_text: str,
    latest_text: str,
    job_description: str,
    max_chars: int,
) -> str:
    return dedent(
        f"""\
        The following paragraph exceeded the character limit of {max_chars}.

        ORIGINAL:
        {original_text}

        OVER-LIMIT VERSION:
        {latest_text}

        JOB DESCRIPTION CONTEXT:
        {job_description}

        TASK:
        Rewrite the paragraph so it stays truthful, impactful, and no longer than {max_chars} characters.
        Return only the rewritten text.
        """
    ).strip()


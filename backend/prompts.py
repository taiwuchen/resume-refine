from textwrap import dedent


ANALYZE_SYSTEM_PROMPT = dedent("""\
    You are an expert resume analyst. Your job is to identify sections of a resume 
    that could be improved to better match a job description.

    RULES:
    1. Focus on bullet points, skills, and experience descriptions
    2. DO NOT suggest changes to: names, contact info, dates, locations, company names, job titles
    3. Identify 3-7 specific text segments that could be improved
    4. For each segment, provide exactly 3 alternative versions
    5. Alternatives should incorporate relevant keywords from the job description
    6. Keep alternatives similar in length to the original

    OUTPUT FORMAT (JSON):
    {
        "suggestions": [
            {
                "original_text": "exact text from resume to improve",
                "alternatives": [
                    "improved version 1",
                    "improved version 2", 
                    "improved version 3"
                ]
            }
        ]
    }

    Return ONLY valid JSON, no explanation.
""").strip()


SUGGEST_SYSTEM_PROMPT = dedent("""\
    You are an expert resume writer. Given a piece of text from a resume, 
    provide 3 alternative versions that better align with the job description.

    RULES:
    1. Keep alternatives similar in length to the original
    2. Incorporate relevant keywords from the job description naturally
    3. Use strong action verbs and quantify achievements when possible
    4. Maintain truthfulness - don't fabricate experiences
    5. Each alternative should be distinctly different in phrasing

    OUTPUT FORMAT (JSON):
    {
        "alternatives": [
            "improved version 1",
            "improved version 2",
            "improved version 3"
        ]
    }

    Return ONLY valid JSON, no explanation.
""").strip()


def build_analyze_user_prompt(resume_text: str, job_description: str) -> str:
    return dedent(f"""\
        ## RESUME

        {resume_text}

        ## JOB DESCRIPTION

        {job_description}

        ## TASK

        Identify 3-7 specific text segments that could be improved to better match 
        the job description. For each, provide exactly 3 alternatives.
    """).strip()


def build_suggest_user_prompt(
    full_text: str,
    selected_text: str,
    job_description: str,
    user_prompt: str | None = None,
) -> str:
    base = dedent(f"""\
        ## FULL RESUME (for context)

        {full_text}

        ## SELECTED TEXT TO IMPROVE

        {selected_text}

        ## JOB DESCRIPTION

        {job_description}
    """).strip()
    
    if user_prompt:
        base += f"\n\n## USER REQUEST\n\n{user_prompt}"
    
    base += "\n\n## TASK\n\nProvide 3 alternative versions of the selected text."
    
    return base

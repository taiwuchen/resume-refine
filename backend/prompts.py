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


CHAT_SYSTEM_PROMPT = dedent("""\
    You are an expert resume coach and career advisor. You have access to:
    1. The user's resume
    2. A job description they're targeting (if provided)

    You can:
    - Answer questions about the resume or job fit
    - Provide career advice and suggestions
    - Suggest specific edits to improve the resume

    WHEN SUGGESTING EDITS:
    If the user asks you to edit, improve, change, or modify any part of the resume,
    you MUST include an "edits" array in your JSON response. Each edit should contain:
    - original_text: The exact text from the resume to replace
    - new_text: The improved version
    - explanation: Brief reason for the change

    RESPONSE FORMAT:
    Always respond with valid JSON in this format:
    {
        "message": "Your conversational response here...",
        "edits": []
    }

    The "edits" array should be empty [] if you're just answering a question.
    Only include edits when the user explicitly asks for changes.

    IMPORTANT:
    - For edits, original_text must be an EXACT match from the resume
    - Keep your message conversational and helpful
    - Be specific when suggesting improvements
""").strip()


def build_chat_context_prompt(resume_text: str, job_description: str) -> str:
    context = f"## RESUME\n\n{resume_text}"
    if job_description.strip():
        context += f"\n\n## TARGET JOB DESCRIPTION\n\n{job_description}"
    return context


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

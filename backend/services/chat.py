import json
import re
from models import ChatMessage, ChatResponse, ChatEdit
from prompts import CHAT_SYSTEM_PROMPT, build_chat_context_prompt
from services.llm import call_llm


def handle_chat(
    resume_text: str,
    job_description: str,
    messages: list[ChatMessage],
) -> ChatResponse:
    # Build system message with context
    context = build_chat_context_prompt(resume_text, job_description)
    system_content = f"{CHAT_SYSTEM_PROMPT}\n\n{context}"

    # Convert to LLM message format
    llm_messages = [{"role": "system", "content": system_content}]
    for msg in messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    # Call LLM
    raw_response = call_llm(llm_messages)

    # Parse response
    return parse_chat_response(raw_response)


def parse_chat_response(raw: str) -> ChatResponse:
    # Try to extract JSON from response
    try:
        # Try direct JSON parse
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from markdown code block
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if match:
            try:
                data = json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                # Return raw as message with no edits
                return ChatResponse(message=raw, edits=[])
        else:
            # Return raw as message with no edits
            return ChatResponse(message=raw, edits=[])

    # Extract message and edits
    message = data.get("message", "")
    edits_data = data.get("edits", [])

    edits = []
    for edit in edits_data:
        if isinstance(edit, dict) and "original_text" in edit and "new_text" in edit:
            edits.append(ChatEdit(
                original_text=edit["original_text"],
                new_text=edit["new_text"],
                explanation=edit.get("explanation", ""),
            ))

    return ChatResponse(message=message, edits=edits)

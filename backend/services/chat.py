import json
import re
from models import ChatMessage, ChatResponse, ChatEdit, ParsedDocument
from prompts import CHAT_SYSTEM_PROMPT, build_chat_context_prompt
from services.llm import call_llm
from services.document_utils import build_paragraph_catalog, get_editable_paragraphs, get_paragraph_or_none


def handle_chat(
    doc: ParsedDocument,
    job_description: str,
    messages: list[ChatMessage],
) -> ChatResponse:
    # Build system message with context
    editable_paragraphs = get_editable_paragraphs(doc)
    context = build_chat_context_prompt(
        doc.full_text,
        job_description,
        build_paragraph_catalog(editable_paragraphs),
    )
    system_content = f"{CHAT_SYSTEM_PROMPT}\n\n{context}"

    # Convert to LLM message format
    llm_messages = [{"role": "system", "content": system_content}]
    for msg in messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    # Call LLM
    raw_response = call_llm(llm_messages)

    # Parse response
    return parse_chat_response(raw_response, doc)


def parse_chat_response(raw: str, doc: ParsedDocument) -> ChatResponse:
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
    seen_paragraph_ids: set[str] = set()
    for edit in edits_data:
        if not isinstance(edit, dict):
            continue

        paragraph_id = edit.get("paragraph_id")
        new_text = edit.get("new_text")
        if not isinstance(paragraph_id, str) or not isinstance(new_text, str):
            continue

        if paragraph_id in seen_paragraph_ids:
            continue

        paragraph = get_paragraph_or_none(doc, paragraph_id)
        if paragraph is None or not paragraph.is_editable:
            continue

        updated_text = new_text.strip()
        if not updated_text:
            continue

        edits.append(ChatEdit(
            paragraph_id=paragraph.paragraph_id,
            start=paragraph.start,
            end=paragraph.end,
            original_text=paragraph.text,
            new_text=updated_text,
            explanation=edit.get("explanation", ""),
        ))
        seen_paragraph_ids.add(paragraph_id)

    return ChatResponse(message=message if isinstance(message, str) else "", edits=edits)

import json
import re

from models.ai import ChatEdit, ChatMessage, ChatResponse, Suggestion
from models.document import ParsedDocument
from prompts import CHAT_SYSTEM_PROMPT, build_chat_context_prompt
from services.ai.llm import call_llm
from services.document_utils import build_paragraph_catalog, get_editable_paragraphs, get_paragraph_or_none


def handle_chat(
    doc: ParsedDocument,
    job_description: str,
    messages: list[ChatMessage],
    active_suggestion_id: str | None = None,
    suggestions: list[Suggestion] | None = None,
) -> ChatResponse:
    editable_paragraphs = get_editable_paragraphs(doc)
    suggestion_list = suggestions or []
    context = build_chat_context_prompt(
        doc.full_text,
        job_description,
        build_paragraph_catalog(editable_paragraphs),
        build_active_suggestion_context(active_suggestion_id, suggestion_list),
        build_suggestion_state_context(suggestion_list),
    )
    system_content = f"{CHAT_SYSTEM_PROMPT}\n\n{context}"

    llm_messages = [{"role": "system", "content": system_content}]
    for msg in messages:
        llm_messages.append({"role": msg.role, "content": msg.content})

    raw_response = call_llm(llm_messages)
    return parse_chat_response(raw_response, doc)


def build_active_suggestion_context(
    active_suggestion_id: str | None,
    suggestions: list[Suggestion],
) -> str:
    if not active_suggestion_id:
        return ""

    suggestion = next(
        (candidate for candidate in suggestions if candidate.id == active_suggestion_id),
        None,
    )
    if suggestion is None:
        return ""

    alternatives = "\n".join(
        f"- {alternative}"
        for alternative in suggestion.alternatives
    )
    return "\n".join([
        f"id: {suggestion.id}",
        f"paragraph_id: {suggestion.paragraph_id}",
        f"category: {suggestion.category}",
        f"severity: {suggestion.severity}",
        f"state: {suggestion.state}",
        f"reason: {suggestion.reason}",
        f"original_text: {suggestion.original_text}",
        "alternatives:",
        alternatives,
    ])


def build_suggestion_state_context(suggestions: list[Suggestion]) -> str:
    if not suggestions:
        return ""

    return "\n".join(
        f"- {suggestion.paragraph_id} | {suggestion.state} | {suggestion.source} | {suggestion.severity} | {suggestion.category} | {suggestion.reason}"
        for suggestion in suggestions
    )


def parse_chat_response(raw: str, doc: ParsedDocument) -> ChatResponse:
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
        if match:
            try:
                data = json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                return ChatResponse(message=raw, edits=[])
        else:
            return ChatResponse(message=raw, edits=[])

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

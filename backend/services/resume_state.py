from models.document import Change, ParsedDocument
from services.document_utils import validate_changes


def apply_changes_to_parsed_document(doc: ParsedDocument, changes: list[Change]) -> ParsedDocument:
    validate_changes(doc, changes)
    replacements = {change.paragraph_id: change.replacement for change in changes}
    paragraphs = [
        paragraph.model_copy(update={"text": replacements[paragraph.paragraph_id]})
        if paragraph.paragraph_id in replacements else paragraph
        for paragraph in doc.paragraphs
    ]
    return doc.model_copy(update={
        "full_text": "\n".join(paragraph.text for paragraph in paragraphs),
        "paragraphs": paragraphs,
    })

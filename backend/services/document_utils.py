from models.document import Change, Paragraph, ParsedDocument


def get_editable_paragraphs(doc: ParsedDocument) -> list[Paragraph]:
    return [paragraph for paragraph in doc.paragraphs if paragraph.is_editable]


def validate_changes(doc: ParsedDocument, changes: list[Change]) -> None:
    paragraphs = {paragraph.paragraph_id: paragraph for paragraph in doc.paragraphs}
    seen = set()
    for change in changes:
        paragraph = paragraphs.get(change.paragraph_id)
        if paragraph is None or not paragraph.is_editable:
            raise ValueError(f"Unknown or uneditable paragraph: {change.paragraph_id}")
        if change.paragraph_id in seen:
            raise ValueError(f"Duplicate change for paragraph: {change.paragraph_id}")
        if change.start != paragraph.start or change.end != paragraph.end:
            raise ValueError("Changes must target a full paragraph")
        if change.original != paragraph.text:
            raise ValueError("Change original text does not match the paragraph")
        seen.add(change.paragraph_id)


def build_paragraph_catalog(paragraphs: list[Paragraph]) -> str:
    return "\n".join(f"- {paragraph.paragraph_id}: {paragraph.text}" for paragraph in paragraphs)

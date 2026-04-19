from models import ParsedDocument, Paragraph


def get_paragraph_map(doc: ParsedDocument) -> dict[str, Paragraph]:
    return {paragraph.paragraph_id: paragraph for paragraph in doc.paragraphs}


def get_editable_paragraphs(doc: ParsedDocument) -> list[Paragraph]:
    return [paragraph for paragraph in doc.paragraphs if paragraph.is_editable]


def get_paragraph_or_none(doc: ParsedDocument, paragraph_id: str) -> Paragraph | None:
    return get_paragraph_map(doc).get(paragraph_id)


def validate_paragraph_selection(
    doc: ParsedDocument,
    paragraph_id: str,
    start: int,
    end: int,
    selected_text: str,
) -> Paragraph:
    paragraph = get_paragraph_or_none(doc, paragraph_id)
    if paragraph is None:
        raise ValueError("Paragraph not found")

    if not paragraph.is_editable:
        raise ValueError("Paragraph is not editable")

    if paragraph.start != start or paragraph.end != end:
        raise ValueError("Selection must match a full paragraph")

    if paragraph.text != selected_text:
        raise ValueError("Selection text does not match the paragraph")

    return paragraph


def build_paragraph_catalog(paragraphs: list[Paragraph]) -> str:
    return "\n".join(
        f"- {paragraph.paragraph_id}: {paragraph.text}"
        for paragraph in paragraphs
    )

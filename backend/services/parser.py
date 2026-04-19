import uuid
from pathlib import Path

from docx import Document
from docx.text.hyperlink import Hyperlink
from docx.text.run import Run

from models import ParsedDocument, Paragraph, ParagraphRun, PositionMapping


def _is_list_paragraph(paragraph) -> tuple[bool, int]:
    p_pr = getattr(paragraph._p, "pPr", None)
    if p_pr is None:
        return False, 0

    num_pr = getattr(p_pr, "numPr", None)
    if num_pr is not None:
        ilvl = getattr(num_pr, "ilvl", None)
        try:
            level = int(ilvl.val) if ilvl is not None and ilvl.val is not None else 0
        except (TypeError, ValueError):
            level = 0
        return True, level

    style_name = getattr(paragraph.style, "name", "") or ""
    if "list" in style_name.lower():
        return True, 0

    return False, 0


def _resolve_hyperlink_target(hyperlink: Hyperlink) -> str | None:
    if hyperlink.url:
        return hyperlink.url
    if hyperlink.fragment:
        return f"#{hyperlink.fragment}"
    return None


def _append_paragraph_run(
    paragraph_runs: list[ParagraphRun],
    position_map: list[PositionMapping],
    *,
    para_idx: int,
    run_idx: int,
    current_pos: int,
    text: str,
    bold: bool,
    italic: bool,
    underline: bool,
    href: str | None,
    is_hyperlink: bool,
) -> int:
    start = current_pos
    end = current_pos + len(text)

    position_map.append(PositionMapping(
        start=start,
        end=end,
        para_idx=para_idx,
        run_idx=run_idx,
    ))
    paragraph_runs.append(ParagraphRun(
        text=text,
        start=start,
        end=end,
        bold=bold,
        italic=italic,
        underline=underline,
        href=href,
        is_hyperlink=is_hyperlink,
    ))
    return end


def parse_docx(file_path: Path) -> ParsedDocument:
    """Parse DOCX into full text with position→DOCX structure mapping."""
    doc = Document(file_path)

    full_text_parts: list[str] = []
    position_map: list[PositionMapping] = []
    paragraphs: list[Paragraph] = []
    current_pos = 0

    for para_idx, para in enumerate(doc.paragraphs):
        if para_idx > 0:
            full_text_parts.append("\n")
            current_pos += 1

        para_start = current_pos
        paragraph_runs: list[ParagraphRun] = []
        is_list_item, list_level = _is_list_paragraph(para)
        visible_run_idx = 0

        for item in para.iter_inner_content():
            href = _resolve_hyperlink_target(item) if isinstance(item, Hyperlink) else None
            child_runs = item.runs if isinstance(item, Hyperlink) else [item]

            for child_run in child_runs:
                if not isinstance(child_run, Run) or not child_run.text:
                    continue

                current_pos = _append_paragraph_run(
                    paragraph_runs,
                    position_map,
                    para_idx=para_idx,
                    run_idx=visible_run_idx,
                    current_pos=current_pos,
                    text=child_run.text,
                    bold=bool(child_run.bold),
                    italic=bool(child_run.italic),
                    underline=bool(child_run.underline),
                    href=href,
                    is_hyperlink=href is not None,
                )
                full_text_parts.append(child_run.text)
                visible_run_idx += 1

        paragraph_text = "".join(run.text for run in paragraph_runs)
        paragraphs.append(Paragraph(
            paragraph_id=f"p{para_idx}",
            start=para_start,
            end=current_pos,
            text=paragraph_text,
            runs=paragraph_runs,
            is_editable=bool(paragraph_text.strip()),
            is_list_item=is_list_item,
            list_level=list_level,
        ))

    return ParsedDocument(
        doc_id=str(uuid.uuid4()),
        full_text="".join(full_text_parts),
        position_map=position_map,
        paragraphs=paragraphs,
    )


def find_docx_locations(doc: ParsedDocument, start: int, end: int) -> list[PositionMapping]:
    """Find DOCX paragraph/run locations that overlap with the given character range."""
    locations = []
    for mapping in doc.position_map:
        if mapping.end > start and mapping.start < end:
            locations.append(mapping)
    return locations

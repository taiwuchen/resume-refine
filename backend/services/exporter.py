from pathlib import Path

from docx import Document
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.run import Run

from models import Change, ParagraphRun, ParsedDocument

HYPERLINK_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"


def apply_changes_to_docx(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    output_path: Path,
) -> Path:
    """Apply text changes to original DOCX while preserving formatting."""
    docx = Document(original_path)

    paragraph_map = {
        paragraph.paragraph_id: (index, paragraph)
        for index, paragraph in enumerate(doc.paragraphs)
    }
    seen_paragraph_ids: set[str] = set()

    for change in changes:
        paragraph_entry = paragraph_map.get(change.paragraph_id)
        if paragraph_entry is None:
            raise ValueError(f"Unknown paragraph: {change.paragraph_id}")

        paragraph_index, paragraph = paragraph_entry
        if not paragraph.is_editable:
            raise ValueError(f"Paragraph is not editable: {change.paragraph_id}")

        if change.paragraph_id in seen_paragraph_ids:
            raise ValueError(f"Duplicate change for paragraph: {change.paragraph_id}")

        if change.start != paragraph.start or change.end != paragraph.end:
            raise ValueError("Changes must target a full paragraph")

        if change.original != paragraph.text:
            raise ValueError("Change original text does not match the paragraph")

        apply_single_change(docx, paragraph_index, paragraph.runs, change.replacement)
        seen_paragraph_ids.add(change.paragraph_id)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    docx.save(output_path)
    return output_path


def _collapse_hyperlink_runs(runs: list[ParagraphRun]) -> list[tuple[str, str, ParagraphRun]]:
    segments: list[tuple[str, str, ParagraphRun]] = []

    for run in runs:
        if not run.is_hyperlink or not run.href or not run.text:
            continue

        if segments and segments[-1][0] == run.href:
            href, text, formatting_source = segments[-1]
            segments[-1] = (href, text + run.text, formatting_source)
            continue

        segments.append((run.href, run.text, run))

    return segments


def _build_output_runs(original_runs: list[ParagraphRun], replacement: str) -> list[ParagraphRun]:
    plain_formatting_source = next(
        (run for run in original_runs if not run.is_hyperlink),
        original_runs[0] if original_runs else None,
    )
    hyperlink_segments = _collapse_hyperlink_runs(original_runs)

    if not hyperlink_segments:
        return [_plain_run(replacement, plain_formatting_source)]

    rebuilt_runs: list[ParagraphRun] = []
    cursor = 0
    preserved_hyperlinks = 0

    for href, text, formatting_source in hyperlink_segments:
        match_index = replacement.find(text, cursor)
        if match_index == -1:
            continue

        if match_index > cursor:
            rebuilt_runs.append(
                _plain_run(replacement[cursor:match_index], plain_formatting_source)
            )

        rebuilt_runs.append(ParagraphRun(
            text=text,
            start=0,
            end=len(text),
            bold=formatting_source.bold,
            italic=formatting_source.italic,
            underline=formatting_source.underline,
            href=href,
            is_hyperlink=True,
        ))
        cursor = match_index + len(text)
        preserved_hyperlinks += 1

    if cursor < len(replacement):
        rebuilt_runs.append(_plain_run(replacement[cursor:], plain_formatting_source))

    if preserved_hyperlinks == 0:
        return [_plain_run(replacement, plain_formatting_source)]

    return [run for run in rebuilt_runs if run.text]


def _plain_run(text: str, formatting_source: ParagraphRun | None) -> ParagraphRun:
    return ParagraphRun(
        text=text,
        start=0,
        end=len(text),
        bold=formatting_source.bold if formatting_source else False,
        italic=formatting_source.italic if formatting_source else False,
        underline=formatting_source.underline if formatting_source else False,
        href=None,
        is_hyperlink=False,
    )


def _apply_run_formatting(run: Run, run_data: ParagraphRun, *, as_hyperlink: bool = False) -> None:
    if as_hyperlink:
        run.style = "Hyperlink"
    run.bold = True if run_data.bold else None
    run.italic = True if run_data.italic else None
    run.underline = True if run_data.underline else None


def _append_plain_run(paragraph, run_data: ParagraphRun) -> None:
    run = paragraph.add_run(run_data.text)
    _apply_run_formatting(run, run_data)


def _append_hyperlink_run(paragraph, run_data: ParagraphRun) -> None:
    if not run_data.href:
        _append_plain_run(paragraph, run_data)
        return

    hyperlink = OxmlElement("w:hyperlink")
    if run_data.href.startswith("#"):
        hyperlink.set(qn("w:anchor"), run_data.href[1:])
    else:
        r_id = paragraph.part.relate_to(run_data.href, HYPERLINK_REL, is_external=True)
        hyperlink.set(qn("r:id"), r_id)

    paragraph._p.append(hyperlink)
    run = Run(hyperlink.add_r(), paragraph)
    run.text = run_data.text
    _apply_run_formatting(run, run_data, as_hyperlink=True)


def apply_single_change(
    docx: Document,
    paragraph_index: int,
    original_runs: list[ParagraphRun],
    replacement: str,
) -> None:
    """Apply a single full-paragraph text change to the DOCX document."""
    if paragraph_index >= len(docx.paragraphs):
        raise ValueError(f"Paragraph index out of range: {paragraph_index}")

    paragraph = docx.paragraphs[paragraph_index]
    output_runs = _build_output_runs(original_runs, replacement)

    paragraph.clear()
    for run_data in output_runs:
        if run_data.is_hyperlink:
            _append_hyperlink_run(paragraph, run_data)
        else:
            _append_plain_run(paragraph, run_data)

    if not output_runs:
        paragraph.add_run("")

from copy import deepcopy

from docx.oxml.ns import qn

from services.docx.xml_utils import (
    clone_xml,
    extract_text,
    has_tab,
    preserve_text_spacing,
    strip_empty_content,
)


def trim_child_edges(children: list[object]) -> None:
    if not children:
        return

    first_text_nodes = list(children[0].iter(qn("w:t")))
    if first_text_nodes:
        first_text_nodes[0].text = (first_text_nodes[0].text or "").lstrip()

    last_text_nodes = list(children[-1].iter(qn("w:t")))
    if last_text_nodes:
        last_text_nodes[-1].text = (last_text_nodes[-1].text or "").rstrip()

    for child in children:
        preserve_text_spacing(child)


def clone_child_without_tabs(child):
    cloned_child = clone_xml(child)

    for tab in list(cloned_child.iter(qn("w:tab"))):
        tab.getparent().remove(tab)

    preserve_text_spacing(cloned_child)
    return cloned_child


def clone_child_text_range(child, start: int, end: int):
    if end <= start:
        return None

    child_text = extract_text(child)
    if not child_text:
        return None

    if start <= 0 and end >= len(child_text):
        cloned_child = clone_xml(child)
        preserve_text_spacing(cloned_child)
        return cloned_child

    cloned_child = clone_xml(child)
    cursor = 0

    for text_node in list(cloned_child.iter(qn("w:t"))):
        original_text = text_node.text or ""
        node_start = cursor
        node_end = cursor + len(original_text)
        overlap_start = max(start, node_start)
        overlap_end = min(end, node_end)

        if overlap_start >= overlap_end:
            text_node.text = ""
        else:
            local_start = overlap_start - node_start
            local_end = overlap_end - node_start
            text_node.text = original_text[local_start:local_end]

        cursor = node_end

    strip_empty_content(cloned_child)
    if not extract_text(cloned_child):
        return None

    preserve_text_spacing(cloned_child)
    return cloned_child


def split_children_by_text_offsets(
    paragraph,
    left_end: int,
    right_start: int,
) -> tuple[list[object], list[object]] | None:
    left_children: list[object] = []
    right_children: list[object] = []
    cursor = 0

    for child in paragraph._p:
        if child.tag == qn("w:pPr"):
            continue

        child_text = extract_text(child)
        child_length = len(child_text)
        child_start = cursor
        child_end = cursor + child_length

        if child_length == 0:
            continue

        if child_start < left_end and child_end > 0:
            left_child = clone_child_text_range(
                child,
                max(0, -child_start),
                min(child_length, left_end - child_start),
            )
            if left_child is not None:
                left_children.append(left_child)

        if child_end > right_start:
            right_child = clone_child_text_range(
                child,
                max(0, right_start - child_start),
                child_length,
            )
            if right_child is not None:
                right_children.append(right_child)

        cursor = child_end

    if not left_children or not right_children:
        return None

    return left_children, right_children


def split_tab_aligned_paragraph(paragraph) -> tuple[list[object], list[object]] | None:
    left_children: list[object] = []
    right_children: list[object] = []
    seen_separator_tabs = False

    for child in paragraph._p:
        if child.tag == qn("w:pPr"):
            continue

        child_text = extract_text(child)
        has_text = bool(child_text.strip())
        has_whitespace_text = bool(child_text) and not has_text

        if has_tab(child) and has_text:
            if not left_children:
                return None

            seen_separator_tabs = True
            right_child = clone_child_without_tabs(child)
            if extract_text(right_child).strip():
                right_children.append(right_child)
            continue

        if not seen_separator_tabs:
            if has_text:
                left_children.append(deepcopy(child))
                continue

            if has_whitespace_text and left_children:
                left_children.append(deepcopy(child))
                continue

            if has_tab(child) and left_children:
                seen_separator_tabs = True
            continue

        if has_tab(child) and not has_text:
            continue

        if has_text:
            right_children.append(deepcopy(child))
            continue

        if has_whitespace_text and right_children:
            right_children.append(deepcopy(child))

    if not left_children or not right_children:
        return None

    return left_children, right_children


def copy_paragraph_format(source_paragraph, target_paragraph) -> None:
    source_format = source_paragraph.paragraph_format
    target_format = target_paragraph.paragraph_format
    target_format.left_indent = source_format.left_indent
    target_format.right_indent = source_format.right_indent
    target_format.first_line_indent = source_format.first_line_indent
    target_format.keep_together = source_format.keep_together
    target_format.keep_with_next = source_format.keep_with_next
    target_format.page_break_before = source_format.page_break_before
    target_format.widow_control = source_format.widow_control
    target_format.space_before = source_format.space_before
    target_format.space_after = source_format.space_after
    target_format.line_spacing = source_format.line_spacing
    target_format.line_spacing_rule = source_format.line_spacing_rule


def populate_paragraph(target_paragraph, source_paragraph, children: list[object], alignment) -> None:
    target_paragraph.clear()
    target_paragraph.style = source_paragraph.style
    copy_paragraph_format(source_paragraph, target_paragraph)
    target_paragraph.alignment = alignment

    for child in children:
        target_paragraph._p.append(clone_xml(child))


def remove_paragraph(paragraph) -> None:
    element = paragraph._element
    element.getparent().remove(element)

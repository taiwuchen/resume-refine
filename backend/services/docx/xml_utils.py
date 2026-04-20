from copy import deepcopy

from docx.oxml.ns import qn


def extract_text(element) -> str:
    return "".join(node.text or "" for node in element.iter(qn("w:t")))


def extract_children_text(children: list[object]) -> str:
    return "".join(extract_text(child) for child in children)


def is_hyperlink(element) -> bool:
    return element.tag == qn("w:hyperlink")


def is_run(element) -> bool:
    return element.tag == qn("w:r")


def has_tab(element) -> bool:
    return any(True for _ in element.iter(qn("w:tab")))


def clone_xml(element):
    return deepcopy(element)


def preserve_text_spacing(element) -> None:
    for text_node in element.iter(qn("w:t")):
        text = text_node.text or ""
        if text.startswith(" ") or text.endswith(" ") or "  " in text:
            text_node.set(qn("xml:space"), "preserve")


def strip_empty_content(element) -> None:
    for descendant in reversed(list(element.iter())):
        if descendant is element:
            continue

        if descendant.tag == qn("w:t") and not (descendant.text or ""):
            parent = descendant.getparent()
            if parent is not None:
                parent.remove(descendant)
            continue

        if descendant.tag in {qn("w:r"), qn("w:hyperlink")}:
            if extract_text(descendant):
                continue
            parent = descendant.getparent()
            if parent is not None:
                parent.remove(descendant)


def clone_run_properties(source_run_element, target_run_element) -> None:
    source_properties = source_run_element.find(qn("w:rPr"))
    if source_properties is not None:
        target_run_element.append(deepcopy(source_properties))

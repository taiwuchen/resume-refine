from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


def get_content_width(doc) -> int:
    section = doc.sections[0]
    return int(section.page_width - section.left_margin - section.right_margin)


def insert_header_table_before(paragraph):
    document = paragraph.part.document
    table = document.add_table(rows=1, cols=2)
    paragraph._p.addprevious(table._tbl)
    return table


def configure_header_table(
    table,
    content_width: int,
    *,
    target_right_ratio: float,
    min_right_width: int,
    max_right_width: int,
) -> None:
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False

    _set_table_borders_none(table)
    _set_table_layout_fixed(table)

    right_width = int(content_width * target_right_ratio)
    right_width = max(min_right_width, min(max_right_width, right_width))
    left_width = max(0, content_width - right_width)

    for cell, width in zip(table.rows[0].cells, (left_width, right_width)):
        cell.width = width
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        _set_cell_width(cell, width)
        _set_cell_margins(cell, top=0, bottom=0, left=0, right=0)


def _set_table_borders_none(table) -> None:
    table_properties = table._tbl.tblPr
    borders = table_properties.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        table_properties.append(borders)

    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        edge_element = borders.find(qn(f"w:{edge}"))
        if edge_element is None:
            edge_element = OxmlElement(f"w:{edge}")
            borders.append(edge_element)
        edge_element.set(qn("w:val"), "nil")


def _set_table_layout_fixed(table) -> None:
    table_properties = table._tbl.tblPr
    layout = table_properties.first_child_found_in("w:tblLayout")
    if layout is None:
        layout = OxmlElement("w:tblLayout")
        table_properties.append(layout)
    layout.set(qn("w:type"), "fixed")


def _set_cell_width(cell, width: int) -> None:
    cell_properties = cell._tc.get_or_add_tcPr()
    width_element = cell_properties.first_child_found_in("w:tcW")
    if width_element is None:
        width_element = OxmlElement("w:tcW")
        cell_properties.append(width_element)
    width_element.set(qn("w:type"), "dxa")
    width_element.set(qn("w:w"), str(int(width / 635)))


def _set_cell_margins(cell, *, top: int, bottom: int, left: int, right: int) -> None:
    cell_properties = cell._tc.get_or_add_tcPr()
    margins = cell_properties.first_child_found_in("w:tcMar")
    if margins is None:
        margins = OxmlElement("w:tcMar")
        cell_properties.append(margins)

    for side, value in (("top", top), ("bottom", bottom), ("left", left), ("right", right)):
        margin = margins.find(qn(f"w:{side}"))
        if margin is None:
            margin = OxmlElement(f"w:{side}")
            margins.append(margin)
        margin.set(qn("w:w"), str(value))
        margin.set(qn("w:type"), "dxa")

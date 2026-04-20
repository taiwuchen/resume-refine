from docx.enum.text import WD_TAB_ALIGNMENT

from services.docx.paragraph_utils import split_tab_aligned_paragraph
from services.preview.normalizers.base import (
    HeaderRowCandidate,
    NormalizationContext,
    apply_header_row_transform,
    build_candidate,
)


class TabStopsRule:
    rule_name = "tab_stops"

    def match(self, paragraph, context: NormalizationContext) -> HeaderRowCandidate | None:
        if paragraph.text.count("\t") < 1:
            return None

        tab_stops = list(paragraph.paragraph_format.tab_stops)
        if not tab_stops:
            return None

        if not any(
            getattr(tab_stop, "alignment", None) == WD_TAB_ALIGNMENT.RIGHT
            for tab_stop in tab_stops
        ):
            return None

        split_children = split_tab_aligned_paragraph(paragraph)
        if split_children is None:
            return None

        return build_candidate(self.rule_name, *split_children)

    def transform(self, paragraph, candidate: HeaderRowCandidate, context: NormalizationContext) -> None:
        apply_header_row_transform(paragraph, candidate, context)

from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

from services.docx.paragraph_utils import split_tab_aligned_paragraph
from services.preview.normalizers.base import (
    MIN_HEADER_TAB_COUNT,
    HeaderRowCandidate,
    NormalizationContext,
    apply_header_row_transform,
    build_candidate,
)


class DistributedTabsRule:
    rule_name = "distributed_tabs"

    def match(self, paragraph, context: NormalizationContext) -> HeaderRowCandidate | None:
        if paragraph.alignment != WD_PARAGRAPH_ALIGNMENT.DISTRIBUTE:
            return None

        if paragraph.text.count("\t") < MIN_HEADER_TAB_COUNT:
            return None

        split_children = split_tab_aligned_paragraph(paragraph)
        if split_children is None:
            return None

        return build_candidate(self.rule_name, *split_children)

    def transform(self, paragraph, candidate: HeaderRowCandidate, context: NormalizationContext) -> None:
        apply_header_row_transform(paragraph, candidate, context)

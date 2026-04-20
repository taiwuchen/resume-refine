from services.docx.paragraph_utils import split_children_by_text_offsets
from services.preview.normalizers.base import (
    MANUAL_SPACE_SEPARATOR_RE,
    HeaderRowCandidate,
    NormalizationContext,
    apply_header_row_transform,
    build_candidate,
    is_likely_header_split,
)


class ManualSpacingRule:
    rule_name = "manual_spacing"

    def match(self, paragraph, context: NormalizationContext) -> HeaderRowCandidate | None:
        if "\t" in paragraph.text or not paragraph.text.strip():
            return None

        split_offsets = self._find_manual_spacing_split(paragraph.text)
        if split_offsets is None:
            return None

        left_end, right_start = split_offsets
        split_children = split_children_by_text_offsets(paragraph, left_end, right_start)
        if split_children is None:
            return None

        return build_candidate(self.rule_name, *split_children, strict=True)

    def transform(self, paragraph, candidate: HeaderRowCandidate, context: NormalizationContext) -> None:
        apply_header_row_transform(paragraph, candidate, context)

    def _find_manual_spacing_split(self, text: str) -> tuple[int, int] | None:
        matches = list(MANUAL_SPACE_SEPARATOR_RE.finditer(text))
        if not matches:
            return None

        for match in reversed(matches):
            left_text = text[: match.start()].rstrip()
            right_text = text[match.end() :].lstrip()
            if is_likely_header_split(left_text, right_text, strict=True):
                return match.start(), match.end()

        return None

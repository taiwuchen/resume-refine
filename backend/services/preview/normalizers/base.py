import logging
import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Protocol

from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.shared import Inches

from services.docx.layout_utils import configure_header_table, insert_header_table_before
from services.docx.paragraph_utils import populate_paragraph, remove_paragraph, trim_child_edges
from services.docx.xml_utils import extract_children_text

logger = logging.getLogger(__name__)

MIN_HEADER_TAB_COUNT = 3
MIN_RIGHT_COLUMN_WIDTH = int(Inches(2.4))
MAX_RIGHT_COLUMN_WIDTH = int(Inches(2.85))
TARGET_RIGHT_COLUMN_RATIO = 0.4
RIGHT_VALUE_MAX_LENGTH = 44
LEFT_VALUE_MAX_LENGTH = 140
MANUAL_SPACE_SEPARATOR_RE = re.compile(r" {3,}")
WHITESPACE_RE = re.compile(r"\s+")
MONTH_PATTERN = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|"
    r"Nov(?:ember)?|Dec(?:ember)?"
)
YEAR_PATTERN = r"\d{4}"
LOCATION_RE = re.compile(r"^[A-Za-z .&'/()-]+,\s*[A-Z]{2,4}$")
DATE_RE = re.compile(
    rf"^(?:"
    rf"(?:{MONTH_PATTERN})\s+{YEAR_PATTERN}"
    rf"|{YEAR_PATTERN}"
    rf"|(?:{MONTH_PATTERN})(?:\s*[-/]\s*(?:{MONTH_PATTERN}))?\s+{YEAR_PATTERN}"
    rf")"
    rf"(?:\s*[-/]\s*(?:Present|Current|{YEAR_PATTERN}|(?:{MONTH_PATTERN})\s+{YEAR_PATTERN}))?$",
    re.IGNORECASE,
)
SHORT_METADATA_VALUES = {
    "remote",
    "hybrid",
    "on-site",
    "onsite",
    "contract",
    "full-time",
    "part-time",
    "internship",
}


@dataclass
class HeaderRowCandidate:
    rule_name: str
    left_children: list[object]
    right_children: list[object]
    left_text: str
    right_text: str


@dataclass
class PreviewNormalizationStats:
    counts: Counter = field(default_factory=Counter)

    def record(self, rule_name: str) -> None:
        self.counts[rule_name] += 1

    @property
    def total(self) -> int:
        return sum(self.counts.values())

    def summary(self) -> str:
        return ", ".join(
            f"{rule_name}={count}"
            for rule_name, count in sorted(self.counts.items())
        )


@dataclass
class NormalizationContext:
    doc: object
    content_width: int
    stats: PreviewNormalizationStats


class NormalizationRule(Protocol):
    rule_name: str

    def match(self, paragraph, context: NormalizationContext) -> HeaderRowCandidate | None:
        ...

    def transform(self, paragraph, candidate: HeaderRowCandidate, context: NormalizationContext) -> None:
        ...


def normalize_inline_text(text: str) -> str:
    return WHITESPACE_RE.sub(" ", text.replace("\t", " ")).strip()


def build_candidate(
    rule_name: str,
    left_children: list[object],
    right_children: list[object],
    *,
    strict: bool = False,
) -> HeaderRowCandidate | None:
    if not left_children or not right_children:
        return None

    trim_child_edges(left_children)
    trim_child_edges(right_children)

    left_text = normalize_inline_text(extract_children_text(left_children))
    right_text = normalize_inline_text(extract_children_text(right_children))

    if not is_likely_header_split(left_text, right_text, strict=strict):
        return None

    return HeaderRowCandidate(
        rule_name=rule_name,
        left_children=left_children,
        right_children=right_children,
        left_text=left_text,
        right_text=right_text,
    )


def is_likely_header_split(left_text: str, right_text: str, *, strict: bool = False) -> bool:
    left_text = normalize_inline_text(left_text)
    right_text = normalize_inline_text(right_text)

    if not left_text or not right_text:
        return False

    if len(right_text) > RIGHT_VALUE_MAX_LENGTH or len(left_text) > LEFT_VALUE_MAX_LENGTH:
        return False

    if right_text.endswith((".", ";", ":")) or left_text.endswith(";"):
        return False

    if not is_likely_right_value(right_text):
        return False

    left_word_count = len(left_text.split())
    if strict and left_word_count > 10:
        return False

    if left_word_count > 18:
        return False

    if strict and len(left_text) <= len(right_text):
        return False

    if any(marker in left_text for marker in ("•", "▪", "◦")):
        return False

    return True


def is_likely_right_value(text: str) -> bool:
    normalized = normalize_inline_text(text)
    lowered = normalized.lower()

    if lowered in SHORT_METADATA_VALUES:
        return True

    if DATE_RE.match(normalized):
        return True

    if LOCATION_RE.match(normalized):
        return True

    if any(token in lowered for token in ("present", "current")):
        return True

    return bool(re.search(YEAR_PATTERN, normalized))


def apply_header_row_transform(paragraph, candidate: HeaderRowCandidate, context: NormalizationContext) -> None:
    table = insert_header_table_before(paragraph)
    configure_header_table(
        table,
        context.content_width,
        target_right_ratio=TARGET_RIGHT_COLUMN_RATIO,
        min_right_width=MIN_RIGHT_COLUMN_WIDTH,
        max_right_width=MAX_RIGHT_COLUMN_WIDTH,
    )

    left_paragraph = table.rows[0].cells[0].paragraphs[0]
    right_paragraph = table.rows[0].cells[1].paragraphs[0]

    populate_paragraph(
        left_paragraph,
        paragraph,
        candidate.left_children,
        WD_PARAGRAPH_ALIGNMENT.LEFT,
    )
    populate_paragraph(
        right_paragraph,
        paragraph,
        candidate.right_children,
        WD_PARAGRAPH_ALIGNMENT.RIGHT,
    )

    remove_paragraph(paragraph)

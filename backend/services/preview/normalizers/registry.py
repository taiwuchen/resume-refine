import logging
from pathlib import Path

from docx import Document

from services.docx.layout_utils import get_content_width
from services.preview.normalizers.base import NormalizationContext, PreviewNormalizationStats
from services.preview.normalizers.distributed_tabs import DistributedTabsRule
from services.preview.normalizers.manual_spacing import ManualSpacingRule
from services.preview.normalizers.tab_stops import TabStopsRule

logger = logging.getLogger(__name__)

RULES = [
    DistributedTabsRule(),
    TabStopsRule(),
    ManualSpacingRule(),
]


def normalize_preview_docx(docx_path: Path) -> int:
    doc = Document(docx_path)
    context = NormalizationContext(
        doc=doc,
        content_width=get_content_width(doc),
        stats=PreviewNormalizationStats(),
    )

    # Paragraphs are identified by index in logs. Their text is resume
    # content -- contact details and employment history -- and must not
    # reach the log stream.
    for index, paragraph in enumerate(doc.paragraphs):
        if not paragraph.text.strip():
            continue

        for rule in RULES:
            try:
                candidate = rule.match(paragraph, context)
            except Exception:
                logger.exception(
                    "Header row matcher %s failed at paragraph %s",
                    rule.rule_name,
                    index,
                )
                continue

            if candidate is None:
                continue

            try:
                rule.transform(paragraph, candidate, context)
                context.stats.record(rule.rule_name)
                logger.debug(
                    "Preview normalized header row at paragraph %s via %s",
                    index,
                    candidate.rule_name,
                )
            except Exception:
                logger.exception(
                    "Skipping preview normalization at paragraph %s via %s",
                    index,
                    candidate.rule_name,
                )

            break

    if context.stats.total:
        doc.save(docx_path)
        logger.info(
            "Normalized %s preview header rows (%s)",
            context.stats.total,
            context.stats.summary(),
        )

    return context.stats.total

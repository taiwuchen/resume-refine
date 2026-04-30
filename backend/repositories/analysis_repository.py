from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import uuid

from models.ai import Suggestion


@dataclass
class AnalysisRecord:
    analysis_id: str
    resume_version_id: str
    resume_hash: str
    job_description_hash: str
    fingerprint: str
    readiness_score: int
    status: str
    suggestions: list[Suggestion]
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class InMemoryAnalysisRepository:
    def __init__(self) -> None:
        self._records_by_id: dict[str, AnalysisRecord] = {}
        self._record_ids_by_fingerprint: dict[str, list[str]] = {}

    def get_current_by_fingerprint(self, fingerprint: str) -> AnalysisRecord | None:
        record_ids = self._record_ids_by_fingerprint.get(fingerprint, [])
        for record_id in reversed(record_ids):
            record = self._records_by_id.get(record_id)
            if record and record.status == "active":
                return deepcopy(record)
        return None

    def store(
        self,
        resume_version_id: str,
        resume_hash: str,
        job_description_hash: str,
        fingerprint: str,
        readiness_score: int,
        suggestions: list[Suggestion],
    ) -> AnalysisRecord:
        for record_id in self._record_ids_by_fingerprint.get(fingerprint, []):
            record = self._records_by_id.get(record_id)
            if record and record.status == "active":
                record.status = "superseded"

        record = AnalysisRecord(
            analysis_id=str(uuid.uuid4()),
            resume_version_id=resume_version_id,
            resume_hash=resume_hash,
            job_description_hash=job_description_hash,
            fingerprint=fingerprint,
            readiness_score=readiness_score,
            status="active",
            suggestions=deepcopy(suggestions),
        )
        self._records_by_id[record.analysis_id] = record
        self._record_ids_by_fingerprint.setdefault(fingerprint, []).append(record.analysis_id)
        return deepcopy(record)

    def update_suggestion_state(self, suggestion_id: str, state: str) -> None:
        for record in self._records_by_id.values():
            for index, suggestion in enumerate(record.suggestions):
                if suggestion.id == suggestion_id:
                    record.suggestions[index] = suggestion.model_copy(update={"state": state})
                    return

    def get_suggestions_by_ids(self, suggestion_ids: set[str]) -> list[Suggestion]:
        suggestions: list[Suggestion] = []
        for record in self._records_by_id.values():
            for suggestion in record.suggestions:
                if suggestion.id in suggestion_ids:
                    suggestions.append(suggestion)
        return deepcopy(suggestions)


analysis_repository = InMemoryAnalysisRepository()

from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import uuid

from config import STATE_DIR
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
        self._state_path = STATE_DIR / "analyses.json"
        self._records_by_id: dict[str, AnalysisRecord] = {}
        self._record_ids_by_fingerprint: dict[str, list[str]] = {}
        self._load()

    def _load(self) -> None:
        if not self._state_path.exists():
            return

        try:
            data = json.loads(self._state_path.read_text())
        except (json.JSONDecodeError, OSError):
            return

        for item in data.get("records", []):
            try:
                suggestions = [
                    Suggestion.model_validate(suggestion)
                    for suggestion in item["suggestions"]
                ]
                record = AnalysisRecord(
                    analysis_id=item["analysis_id"],
                    resume_version_id=item["resume_version_id"],
                    resume_hash=item["resume_hash"],
                    job_description_hash=item["job_description_hash"],
                    fingerprint=item["fingerprint"],
                    readiness_score=item["readiness_score"],
                    status=item["status"],
                    suggestions=suggestions,
                    created_at=item["created_at"],
                )
            except (KeyError, TypeError, ValueError):
                continue

            self._records_by_id[record.analysis_id] = record
            self._record_ids_by_fingerprint.setdefault(record.fingerprint, []).append(record.analysis_id)

    def _save(self) -> None:
        records = [
            {
                "analysis_id": record.analysis_id,
                "resume_version_id": record.resume_version_id,
                "resume_hash": record.resume_hash,
                "job_description_hash": record.job_description_hash,
                "fingerprint": record.fingerprint,
                "readiness_score": record.readiness_score,
                "status": record.status,
                "suggestions": [suggestion.model_dump() for suggestion in record.suggestions],
                "created_at": record.created_at,
            }
            for record in self._records_by_id.values()
        ]
        self._state_path.write_text(json.dumps({"records": records}))

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
        self._save()
        return deepcopy(record)

    def update_suggestion_state(self, suggestion_id: str, state: str) -> None:
        for record in self._records_by_id.values():
            for index, suggestion in enumerate(record.suggestions):
                if suggestion.id == suggestion_id:
                    record.suggestions[index] = suggestion.model_copy(update={"state": state})
                    self._save()
                    return

    def get_suggestions_by_ids(self, suggestion_ids: set[str]) -> list[Suggestion]:
        suggestions: list[Suggestion] = []
        for record in self._records_by_id.values():
            for suggestion in record.suggestions:
                if suggestion.id in suggestion_ids:
                    suggestions.append(suggestion)
        return deepcopy(suggestions)


analysis_repository = InMemoryAnalysisRepository()

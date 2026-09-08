from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from config import DOCUMENT_TTL_SECONDS, STATE_DIR
from models.document import ParsedDocument


def new_access_token() -> str:
    return secrets.token_urlsafe(32)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@dataclass
class DocumentRecord:
    document: ParsedDocument
    file_path: Path
    token_hash: str
    created_at: float

    def is_expired(self, now: float) -> bool:
        return now - self.created_at > DOCUMENT_TTL_SECONDS


class DocumentRepository(Protocol):
    def store_document(self, doc: ParsedDocument, file_path: Path, token: str) -> None: ...
    def get_document(self, doc_id: str, token: str) -> ParsedDocument | None: ...
    def get_file_path(self, doc_id: str, token: str) -> Path | None: ...


class InMemoryDocumentRepository:
    """Process-local document store backed by a JSON file.

    Records are scoped to the access token issued at upload, so knowing a
    doc_id is not enough to read a resume. Records also expire, because a
    resume is personal data and retaining it indefinitely is a liability.

    This holds for a single process. Running several workers or instances
    against the same directory still lets one process overwrite another's
    records, so a multi-instance deployment needs shared storage instead.
    """

    def __init__(self) -> None:
        self._state_path = STATE_DIR / "documents.json"
        self._records: dict[str, DocumentRecord] = {}
        self._lock = threading.Lock()
        self._load()

    def _load(self) -> None:
        if not self._state_path.exists():
            return

        try:
            data = json.loads(self._state_path.read_text())
        except (json.JSONDecodeError, OSError):
            return

        now = time.time()
        for doc_id, item in data.items():
            try:
                record = DocumentRecord(
                    document=ParsedDocument.model_validate(item["document"]),
                    file_path=Path(item["file_path"]),
                    token_hash=item["token_hash"],
                    created_at=float(item["created_at"]),
                )
            except (KeyError, TypeError, ValueError):
                continue
            if not record.is_expired(now):
                self._records[doc_id] = record

    def _save(self) -> None:
        """Write via a temporary file so an interrupted save cannot truncate
        every record."""
        data = {
            doc_id: {
                "document": record.document.model_dump(),
                "file_path": str(record.file_path),
                "token_hash": record.token_hash,
                "created_at": record.created_at,
            }
            for doc_id, record in self._records.items()
        }
        tmp_path = self._state_path.with_suffix(".json.tmp")
        tmp_path.write_text(json.dumps(data))
        os.replace(tmp_path, self._state_path)

    def _purge_expired(self) -> None:
        now = time.time()
        expired = [doc_id for doc_id, record in self._records.items() if record.is_expired(now)]
        for doc_id in expired:
            record = self._records.pop(doc_id)
            record.file_path.unlink(missing_ok=True)

    def _authorized(self, doc_id: str, token: str) -> DocumentRecord | None:
        record = self._records.get(doc_id)
        if record is None or not token:
            return None
        if not hmac.compare_digest(record.token_hash, _hash_token(token)):
            return None
        if record.is_expired(time.time()):
            return None
        return record

    def store_document(self, doc: ParsedDocument, file_path: Path, token: str) -> None:
        with self._lock:
            self._purge_expired()
            self._records[doc.doc_id] = DocumentRecord(
                document=doc,
                file_path=file_path,
                token_hash=_hash_token(token),
                created_at=time.time(),
            )
            self._save()

    def get_document(self, doc_id: str, token: str) -> ParsedDocument | None:
        with self._lock:
            record = self._authorized(doc_id, token)
            return record.document if record else None

    def get_file_path(self, doc_id: str, token: str) -> Path | None:
        with self._lock:
            record = self._authorized(doc_id, token)
            return record.file_path if record else None


document_repository = InMemoryDocumentRepository()

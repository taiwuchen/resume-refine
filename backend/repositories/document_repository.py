from pathlib import Path
import json
from typing import Protocol

from config import STATE_DIR
from models.document import ParsedDocument


class DocumentRepository(Protocol):
    def store_document(self, doc: ParsedDocument, file_path: Path) -> None: ...
    def get_document(self, doc_id: str) -> ParsedDocument | None: ...
    def get_file_path(self, doc_id: str) -> Path | None: ...


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._state_path = STATE_DIR / "documents.json"
        self._documents: dict[str, ParsedDocument] = {}
        self._file_paths: dict[str, Path] = {}
        self._load()

    def _load(self) -> None:
        if not self._state_path.exists():
            return

        try:
            data = json.loads(self._state_path.read_text())
        except (json.JSONDecodeError, OSError):
            return

        for doc_id, item in data.items():
            try:
                self._documents[doc_id] = ParsedDocument.model_validate(item["document"])
                self._file_paths[doc_id] = Path(item["file_path"])
            except (KeyError, TypeError, ValueError):
                continue

    def _save(self) -> None:
        data = {
            doc_id: {
                "document": document.model_dump(),
                "file_path": str(self._file_paths[doc_id]),
            }
            for doc_id, document in self._documents.items()
            if doc_id in self._file_paths
        }
        self._state_path.write_text(json.dumps(data))

    def store_document(self, doc: ParsedDocument, file_path: Path) -> None:
        self._documents[doc.doc_id] = doc
        self._file_paths[doc.doc_id] = file_path
        self._save()

    def get_document(self, doc_id: str) -> ParsedDocument | None:
        return self._documents.get(doc_id)

    def get_file_path(self, doc_id: str) -> Path | None:
        return self._file_paths.get(doc_id)


document_repository = InMemoryDocumentRepository()

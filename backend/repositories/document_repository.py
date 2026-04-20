from pathlib import Path
from typing import Protocol

from models.document import ParsedDocument


class DocumentRepository(Protocol):
    def store_document(self, doc: ParsedDocument, file_path: Path) -> None: ...
    def get_document(self, doc_id: str) -> ParsedDocument | None: ...
    def get_file_path(self, doc_id: str) -> Path | None: ...


class InMemoryDocumentRepository:
    def __init__(self) -> None:
        self._documents: dict[str, ParsedDocument] = {}
        self._file_paths: dict[str, Path] = {}

    def store_document(self, doc: ParsedDocument, file_path: Path) -> None:
        self._documents[doc.doc_id] = doc
        self._file_paths[doc.doc_id] = file_path

    def get_document(self, doc_id: str) -> ParsedDocument | None:
        return self._documents.get(doc_id)

    def get_file_path(self, doc_id: str) -> Path | None:
        return self._file_paths.get(doc_id)


document_repository = InMemoryDocumentRepository()

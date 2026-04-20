from pathlib import Path

from models.document import ParsedDocument
from repositories.document_repository import document_repository


def store_document(doc: ParsedDocument, file_path: Path) -> None:
    document_repository.store_document(doc, file_path)


def get_document(doc_id: str) -> ParsedDocument | None:
    return document_repository.get_document(doc_id)


def get_file_path(doc_id: str) -> Path | None:
    return document_repository.get_file_path(doc_id)

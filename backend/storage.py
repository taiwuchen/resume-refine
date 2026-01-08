from pathlib import Path
from models import ParsedDocument

_documents: dict[str, ParsedDocument] = {}
_file_paths: dict[str, Path] = {}


def store_document(doc: ParsedDocument, file_path: Path) -> None:
    _documents[doc.doc_id] = doc
    _file_paths[doc.doc_id] = file_path


def get_document(doc_id: str) -> ParsedDocument | None:
    return _documents.get(doc_id)


def get_file_path(doc_id: str) -> Path | None:
    return _file_paths.get(doc_id)

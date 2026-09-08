"""Shared request-scoped lookups for the document routes."""
from pathlib import Path

from fastapi import Header, HTTPException

from models.document import ParsedDocument
from repositories.document_repository import document_repository

DOCUMENT_TOKEN_HEADER = "X-Document-Token"
API_KEY_HEADER = "X-OpenRouter-Key"

# Missing, expired, and not-yours are all reported the same way: telling an
# anonymous caller that a document exists but belongs to someone else is
# itself a disclosure.
_NOT_FOUND = "Document not found. Please upload the resume again."


def document_token(x_document_token: str = Header(default="")) -> str:
    return x_document_token


def openrouter_key(x_openrouter_key: str = Header(default="")) -> str:
    """The caller's own OpenRouter key.

    Never log, persist, or echo this value.
    """
    return x_openrouter_key.strip()


def require_document(doc_id: str, token: str) -> ParsedDocument:
    doc = document_repository.get_document(doc_id, token)
    if doc is None:
        raise HTTPException(404, _NOT_FOUND)
    return doc


def require_document_file(doc_id: str, token: str) -> Path:
    file_path = document_repository.get_file_path(doc_id, token)
    if file_path is None or not file_path.exists():
        raise HTTPException(404, _NOT_FOUND)
    return file_path

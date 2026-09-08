"""Structural guards for untrusted DOCX uploads.

A DOCX is a ZIP archive, so a small upload can hold gigabytes of XML.
python-docx decompresses the parts it needs with no size ceiling of its own,
so these checks run before it ever opens the file.
"""
import zipfile
from pathlib import Path

from config import (
    MAX_COMPRESSION_RATIO,
    MAX_DOCUMENT_CHARS,
    MAX_EXPANDED_BYTES,
    MAX_PARAGRAPHS,
    MAX_ZIP_ENTRIES,
)
from models.document import ParsedDocument

# Read members in chunks: a central directory can understate a member's real
# size, so the only trustworthy measurement is the decompressed byte count.
_CHUNK_BYTES = 64 * 1024

_TOO_LARGE = "This resume is too large or too complex to process."
_NOT_A_DOCX = "This file is not a readable DOCX."


class UnsafeDocument(ValueError):
    """The upload is structurally hostile, not merely malformed."""


def _expanded_bytes_within_budget(archive: zipfile.ZipFile) -> int:
    """Decompress every member, stopping as soon as the budget is exceeded."""
    total = 0
    for entry in archive.infolist():
        if entry.is_dir():
            continue
        with archive.open(entry) as member:
            while chunk := member.read(_CHUNK_BYTES):
                total += len(chunk)
                if total > MAX_EXPANDED_BYTES:
                    raise UnsafeDocument(_TOO_LARGE)
    return total


def validate_docx_archive(file_path: Path) -> None:
    """Reject archives that would cost more to parse than they are worth.

    Raises UnsafeDocument for both hostile and unreadable input; callers turn
    it into a 400 so the two are indistinguishable to an anonymous caller.
    """
    try:
        archive = zipfile.ZipFile(file_path)
    except (zipfile.BadZipFile, OSError) as error:
        raise UnsafeDocument(_NOT_A_DOCX) from error

    with archive:
        if len(archive.infolist()) > MAX_ZIP_ENTRIES:
            raise UnsafeDocument(_TOO_LARGE)

        # A DOCX without this part is not a word processing document.
        if "word/document.xml" not in archive.namelist():
            raise UnsafeDocument(_NOT_A_DOCX)

        try:
            expanded = _expanded_bytes_within_budget(archive)
        except (zipfile.BadZipFile, OSError, EOFError) as error:
            raise UnsafeDocument(_NOT_A_DOCX) from error

    compressed = file_path.stat().st_size
    if compressed > 0 and expanded / compressed > MAX_COMPRESSION_RATIO:
        raise UnsafeDocument(_TOO_LARGE)


def validate_parsed_document(doc: ParsedDocument) -> None:
    """Bound the parsed result.

    The archive can sit inside every limit above and still produce a document
    whose in-memory form is far larger than the bytes on disk.
    """
    if len(doc.paragraphs) > MAX_PARAGRAPHS:
        raise UnsafeDocument(_TOO_LARGE)
    if len(doc.full_text) > MAX_DOCUMENT_CHARS:
        raise UnsafeDocument(_TOO_LARGE)

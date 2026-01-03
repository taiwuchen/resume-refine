import uuid
from pathlib import Path
from docx import Document
from models import ParsedDocument, PositionMapping


def parse_docx(file_path: Path) -> ParsedDocument:
    """Parse DOCX into full text with position→DOCX structure mapping."""
    doc = Document(file_path)
    
    full_text_parts: list[str] = []
    position_map: list[PositionMapping] = []
    current_pos = 0
    
    for para_idx, para in enumerate(doc.paragraphs):
        if para_idx > 0:
            full_text_parts.append("\n")
            current_pos += 1
        
        for run_idx, run in enumerate(para.runs):
            if not run.text:
                continue
            
            text = run.text
            start = current_pos
            end = current_pos + len(text)
            
            position_map.append(PositionMapping(
                start=start,
                end=end,
                para_idx=para_idx,
                run_idx=run_idx,
            ))
            
            full_text_parts.append(text)
            current_pos = end
    
    return ParsedDocument(
        doc_id=str(uuid.uuid4()),
        full_text="".join(full_text_parts),
        position_map=position_map,
    )


def find_docx_locations(doc: ParsedDocument, start: int, end: int) -> list[PositionMapping]:
    """Find DOCX paragraph/run locations that overlap with the given character range."""
    locations = []
    for mapping in doc.position_map:
        if mapping.end > start and mapping.start < end:
            locations.append(mapping)
    return locations

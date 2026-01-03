from pathlib import Path
from docx import Document
from models import Change, ParsedDocument


def apply_changes_to_docx(
    original_path: Path,
    doc: ParsedDocument,
    changes: list[Change],
    output_path: Path,
) -> Path:
    """Apply text changes to original DOCX while preserving formatting."""
    
    docx = Document(original_path)
    
    sorted_changes = sorted(changes, key=lambda c: c.start, reverse=True)
    
    for change in sorted_changes:
        apply_single_change(docx, doc, change)
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    docx.save(output_path)
    
    return output_path


def apply_single_change(docx: Document, doc: ParsedDocument, change: Change) -> None:
    """Apply a single text change to the DOCX document."""
    
    affected_mappings = [
        m for m in doc.position_map
        if m.end > change.start and m.start < change.end
    ]
    
    if not affected_mappings:
        print(f"[exporter] No mappings found for change at {change.start}-{change.end}")
        return
    
    if len(affected_mappings) == 1:
        m = affected_mappings[0]
        para = docx.paragraphs[m.para_idx]
        if m.run_idx < len(para.runs):
            run = para.runs[m.run_idx]
            
            run_start_in_text = m.start
            local_start = change.start - run_start_in_text
            local_end = change.end - run_start_in_text
            
            local_start = max(0, local_start)
            local_end = min(len(run.text), local_end)
            
            run.text = run.text[:local_start] + change.replacement + run.text[local_end:]
    else:
        first = affected_mappings[0]
        para = docx.paragraphs[first.para_idx]
        if first.run_idx < len(para.runs):
            run = para.runs[first.run_idx]
            local_start = max(0, change.start - first.start)
            run.text = run.text[:local_start] + change.replacement
        
        for m in affected_mappings[1:]:
            if m.para_idx < len(docx.paragraphs):
                para = docx.paragraphs[m.para_idx]
                if m.run_idx < len(para.runs):
                    para.runs[m.run_idx].text = ""

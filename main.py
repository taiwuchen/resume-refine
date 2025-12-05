from __future__ import annotations

from pathlib import Path
import time

import typer

from src.exporter import apply_changes, export_pdf, save_docx
from src.job_metadata import extract_job_metadata, sanitize_for_path
from src.optimizer import optimize_resume
from src.parser import extract_structure, parse_docx

DEFAULT_JD_PATH = Path("job_description.txt")
app = typer.Typer(help="Resume optimizer for ATS systems")


def load_job_description(path_override: str | None) -> str:
    """Read the job description from a text file (default: job_description.txt)."""
    path = (
        Path(path_override).expanduser()
        if path_override
        else DEFAULT_JD_PATH.expanduser()
    )
    if not path.exists():
        raise typer.BadParameter(
            f"Job description file not found: {path}. "
            "Create it or provide --job-description-file."
        )
    contents = path.read_text(encoding="utf-8").strip()
    if not contents:
        raise typer.BadParameter(f"Job description file '{path}' is empty")
    return contents


@app.command()
def optimize(
    resume: str = typer.Argument(..., help="Path to resume DOCX file"),
    job_description_file: str | None = typer.Option(
        None,
        "--job-description-file",
        "-j",
        help="Path to job description text file (default: job_description.txt)",
    ),
    output_pdf: str = typer.Option("output/resume.pdf", "--output-pdf", help="Output PDF path"),
    output_docx: str = typer.Option(
        None, "--output-docx", help="Output DOCX path (defaults to PDF path with .docx)"
    ),
):
    """Optimize a resume for a specific job description."""
    resume_path = Path(resume).expanduser()
    if not resume_path.exists():
        raise typer.BadParameter(f"Resume file not found: {resume_path}")

    start = time.perf_counter()
    def log_step(message: str) -> None:
        elapsed = time.perf_counter() - start
        typer.echo(f"[{elapsed:5.2f}s] {message}")

    jd_text = load_job_description(job_description_file)
    log_step("Loaded job description.")

    company, role = extract_job_metadata(jd_text)
    log_step(f"Detected company '{company}' and role '{role}'.")
    output_dir = Path("output") / f"{sanitize_for_path(company)}__{sanitize_for_path(role)}"
    log_step("Parsing resume...")
    doc = parse_docx(str(resume_path))
    structure = extract_structure(doc)
    log_step(f"Parsed resume with {len(structure.paragraphs)} paragraphs.")

    log_step("Optimizing content (calling LLM)...")
    changes = optimize_resume(structure, jd_text)
    log_step(f"LLM finished. Modified {len(changes)} paragraphs.")

    log_step("Applying changes to DOCX...")
    apply_changes(doc, changes)

    log_step("Saving DOCX...")
    pdf_name = Path(output_pdf).name
    docx_name = Path(output_docx).name if output_docx else Path(pdf_name).with_suffix(".docx").name
    docx_path = save_docx(doc, str(output_dir / docx_name))
    log_step(f"DOCX saved to {docx_path}")

    log_step("Exporting PDF via Word/docx2pdf...")
    pdf_path = str(output_dir / pdf_name)
    export_pdf(docx_path, pdf_path)
    log_step(f"PDF saved to {pdf_path}")
    log_step("All steps completed.")


if __name__ == "__main__":
    app()


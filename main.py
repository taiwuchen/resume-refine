from __future__ import annotations

from pathlib import Path

import typer

from src.exporter import apply_changes, export_pdf, save_docx
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

    jd_text = load_job_description(job_description_file)
    typer.echo("Parsing resume...")
    doc = parse_docx(str(resume_path))
    structure = extract_structure(doc)

    typer.echo("Optimizing content...")
    changes = optimize_resume(structure, jd_text)
    typer.echo(f"Modified {len(changes)} paragraphs")

    typer.echo("Applying changes...")
    apply_changes(doc, changes)

    typer.echo("Saving DOCX...")
    docx_path = output_docx or str(Path(output_pdf).with_suffix(".docx"))
    save_docx(doc, docx_path)

    typer.echo("Exporting PDF...")
    export_pdf(doc, output_pdf)

    typer.echo(f"Done! DOCX: {docx_path}  PDF: {output_pdf}")


if __name__ == "__main__":
    app()


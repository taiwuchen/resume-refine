from __future__ import annotations

from pathlib import Path

import typer

from src.exporter import apply_changes, export_pdf, save_docx
from src.optimizer import optimize_resume
from src.parser import extract_structure, parse_docx

app = typer.Typer(help="Resume optimizer for ATS systems")


def prompt_job_description() -> str:
    """Collect a multi-line job description from stdin."""
    typer.echo("Enter Job Description (finish with an empty line):")
    lines: list[str] = []
    while True:
        try:
            line = input()
        except EOFError:
            break

        if line.strip() == "" and lines:
            break
        if line.strip() == "":
            continue

        lines.append(line)

    job_description = "\n".join(lines).strip()
    if not job_description:
        raise typer.BadParameter("Job description cannot be empty")
    return job_description


@app.command()
def optimize(
    resume: str = typer.Argument(..., help="Path to resume DOCX file"),
    output_pdf: str = typer.Option("output/resume.pdf", "--output-pdf", help="Output PDF path"),
    output_docx: str = typer.Option(
        None, "--output-docx", help="Output DOCX path (defaults to PDF path with .docx)"
    ),
):
    """Optimize a resume for a specific job description."""
    resume_path = Path(resume).expanduser()
    if not resume_path.exists():
        raise typer.BadParameter(f"Resume file not found: {resume_path}")

    jd_text = prompt_job_description()
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


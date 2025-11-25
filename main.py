import typer

app = typer.Typer(help="Resume optimizer for ATS systems")


@app.command()
def optimize(
    resume: str = typer.Argument(..., help="Path to resume DOCX file"),
    job_description: str = typer.Argument(..., help="Path to job description text file"),
    output: str = typer.Option("output.pdf", "--output", "-o", help="Output PDF path"),
):
    """Optimize a resume for a specific job description."""
    typer.echo(f"Resume: {resume}")
    typer.echo(f"Job Description: {job_description}")
    typer.echo(f"Output: {output}")
    # TODO: Implement pipeline


if __name__ == "__main__":
    app()


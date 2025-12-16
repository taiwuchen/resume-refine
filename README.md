# Resume Refine CLI

A command-line tool that rewrites DOCX resumes to match a job description while preserving the original layout and exporting a pixel-identical PDF.

## Requirements

- Python 3.11+
- Microsoft Word (used by `docx2pdf` to render PDFs) or LibreOffice if you customize the exporter
- An OpenRouter API key with access to your preferred model

## Setup

```bash
git clone <repo-url>
cd resume-refine
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Create a `.env` file (see `.env.example`) with:

```
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-5-nano
```

Prepare a job description file (default path: `job_description.txt`), e.g.:

```
Senior ML Engineer
- Own distributed model training and deployment
- Experience with Python, GCP, Kubernetes
```

## Usage

```bash
python main.py optimize path/to/resume.docx
```

Flow:

1. Reads `job_description.txt` (or a file provided via `--job-description-file`).
2. Extracts company + role from the job description (stored under `output/{company}__{role}`).
3. Parses every paragraph of the resume and builds a structured prompt with per-paragraph character limits.
4. Calls OpenRouter to rewrite bullet points and skills.
5. Applies the changes in-place while preserving fonts, spacing, and layout.
6. Saves both DOCX and PDF into the per-role folder:
   - DOCX default name: `resume.docx`
   - PDF default name: `resume.pdf`

### Options

```
python main.py optimize RESUME.docx \
  --job-description-file job_description.txt \
  --output-docx custom.docx \
  --output-pdf custom.pdf
```

If `--output-docx` is omitted it defaults to the PDF path with a `.docx` suffix.
Provided output filenames are placed inside the per-role folder determined from the job description.

## Logging & Debugging

`main.py` prints timestamps for each major step (load JD, parse resume, call LLM, save DOCX, export PDF).  
`src/optimizer.py` logs when requests are sent to OpenRouter, how long they take, and when paragraphs need extra shortening passes. Use these logs to pinpoint slow stages.

## PDF Export Notes

`docx2pdf` automates Microsoft Word via AppleScript/COM. macOS may prompt the first time asking whether Terminal/Cursor is allowed to control Word. Approve this under **System Settings → Privacy & Security → Automation** to avoid repeated prompts.  
If you prefer a headless converter, replace `export_pdf` with a LibreOffice (`soffice --headless --convert-to pdf`) call.

## Tips

- Expect multiple OpenRouter calls per run: one main rewrite plus follow-up “shorten” calls if any paragraph exceeds its character limit.
- Word-to-PDF conversion typically takes 10–25 seconds regardless of model speed; use the log timestamps to see how much time comes from API calls vs. Word rendering.


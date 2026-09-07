# Resume Refine

An interactive, Grammarly-style resume refinement webapp that helps optimize your resume for specific job descriptions using AI.

## Features

- Upload a DOCX resume and paste a target job description.
- Analyze the resume and review three alternatives for each suggested improvement.
- Accept or dismiss suggestions, and undo accepted changes.
- Preview the current resume as a PDF and export it as DOCX.
- Edit the job description to analyze for a different job while keeping accepted edits.

The app analyzes body paragraphs. Text inside tables, headers, and footers is not analyzed.
Edited paragraphs use their existing base text style; mixed inline formatting may change.
Progress is saved in the current browser. Uploading a replacement starts a fresh resume review.

## Quick Start

### Prerequisites
- Node.js 20+ or 22+
- Python 3.9+
- OpenRouter API key
- Docker, or access to a running Gotenberg service

### Setup

1. Clone the repository
2. Set up environment:
   ```bash
   cp .env.example .env
   # Add your OPENROUTER_API_KEY to .env
   ```

3. Start Gotenberg for DOCX to PDF preview generation:
   ```bash
   docker run --rm -p 3000:3000 gotenberg/gotenberg:8
   ```
   If you are using a remote renderer instead, point `GOTENBERG_URL` in `.env` to that service.

4. Install backend dependencies:
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

5. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

### Running

Start the backend:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

Start the frontend (in a new terminal):
```bash
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

If preview rendering fails, verify that the service at `GOTENBERG_URL` is reachable and that it has the fonts your resume needs. Missing fonts are the main cause of preview layout drift.

### Branch workflow

- Use `main` as the default branch for daily development, including direct commits and pushes.
- Optional feature branches can be merged into `main` through pull requests and are deleted automatically after merging.
- Keep production deployments connected to `main`.

## Usage

1. Upload a DOCX resume.
2. Paste the target job description and click **Analyze**.
3. Select a suggestion or highlighted paragraph to review its alternatives.
4. Choose an alternative to apply it, or dismiss the suggestion.
5. Use **Undo last change** to reverse accepted edits.
6. Click **Export DOCX** to download the result.

Changing the job description clears the suggestions but keeps accepted edits.
Analysis errors are shown with an option to retry through **Analyze**.

## Verification

```bash
cd backend
../.venv/bin/python -m unittest discover -s tests -v
cd ../frontend
npm run build
npm run lint
```

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI (Python)
- **AI**: OpenRouter (OpenAI-compatible API)
- **Document**: python-docx for DOCX parsing/export
- **Preview Rendering**: Gotenberg (LibreOffice)

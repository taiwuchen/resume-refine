<img src="frontend/public/logo.svg" alt="" width="44" align="left" />

# ResumeLilt

An interactive, Grammarly-style resume refinement webapp that helps optimize your resume for specific job descriptions using AI.

## Features

- Bring your own OpenRouter API key; it stays in your browser.
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
- An OpenRouter API key (entered in the app, not the server)
- Docker, or access to a running Gotenberg service

### Setup

1. Clone the repository
2. Set up environment:
   ```bash
   cp .env.example .env
   ```
   No key is needed in `.env`. You enter your OpenRouter key in the app, and
   the backend forwards it to OpenRouter without storing it.

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

1. Paste your OpenRouter API key into the field in the header. It is kept in
   this browser's local storage and sent only with your analysis requests.
2. Upload a DOCX resume.
3. Paste the target job description and click **Analyze**.
4. Select a suggestion or highlighted paragraph to review its alternatives.
5. Choose an alternative to apply it, or dismiss the suggestion.
6. Use **Undo last change** to reverse accepted edits.
7. Click **Export DOCX** to download the result.

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

## Deploying

This runs single-process by design. Before putting it on the public internet:

- Set `CORS_ALLOW_ORIGINS` to your real frontend origin and `VITE_API_BASE` to
  the HTTPS backend URL. The frontend's default guess is plain HTTP and will be
  blocked as mixed content.
- Leave `ALLOW_SERVER_API_KEY` off so callers must supply their own key.
- Put a rate limit in front of `/api/upload` and the preview route. Uploads are
  anonymous, and PDF rendering is the expensive path.
- Uploaded resumes and their metadata are stored on local disk and scoped to a
  per-document token issued at upload. Running more than one worker or instance
  against the same directory will let one process overwrite another's records;
  a multi-instance deployment needs shared storage instead.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI (Python)
- **AI**: OpenRouter (OpenAI-compatible API)
- **Document**: python-docx for DOCX parsing/export
- **Preview Rendering**: Gotenberg (LibreOffice)

## License

[MIT](LICENSE) © Taiwu Chen

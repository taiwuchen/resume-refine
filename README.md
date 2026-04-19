# Resume Refine

An interactive, Grammarly-style resume refinement webapp that helps optimize your resume for specific job descriptions using AI.

## Features

- **Upload Resume**: Upload your DOCX resume for analysis
- **Job Description Context**: Paste a job description to guide improvements
- **AI-Powered Analysis**: Click "Analyze" to get suggestions for improvable sections
- **Inline Suggestions**: Highlighted text shows 3 alternative options on click
- **Custom Prompts**: Select any text and ask for specific improvements via the chat sidebar
- **Export**: Download your refined resume as DOCX with original formatting preserved

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
   docker run --rm -p 3001:3000 gotenberg/gotenberg:8
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

## Usage

1. Upload a DOCX resume
2. Paste a job description and expand the "Job Description" section
3. Click "Analyze" to get AI suggestions
4. Click highlighted text to see 3 improvement options
5. Accept suggestions to apply changes
6. Use the chat sidebar for custom improvements
7. Click "Export" to download the refined resume

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: FastAPI (Python)
- **AI**: OpenRouter (OpenAI-compatible API)
- **Document**: python-docx for DOCX parsing/export
- **Preview Rendering**: Gotenberg (LibreOffice)

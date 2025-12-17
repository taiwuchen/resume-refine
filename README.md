# Resume Refine

A tool to rewrite DOCX resumes to match multiple job descriptions while preserving the original layout and exporting Word-identical PDFs.

## Requirements
- Python 3.11+
- **Microsoft Word** (required for Word-identical PDF export via `docx2pdf`)
- OpenRouter API Key

## Setup
1. Clone the repo and install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Create a `.env` file:
   ```text
   OPENROUTER_API_KEY=your_key_here
   OPENROUTER_MODEL=openai/gpt-5-nano
   ```

## Usage

### 🚀 Web UI
The easiest way to process multiple jobs in parallel:
```bash
streamlit run app.py
```
- Upload your resume.
- Add multiple job descriptions.
- Click "Start Parallel Refine".
- Preview and download your PDFs directly in the browser.

## Parallel Processing
The system optimizes multiple jobs at once using a thread pool. However, because Microsoft Word can only reliably process one document at a time, the PDF conversion step is automatically queued (serialized) to ensure high-quality, non-corrupted outputs.

## Output
Files are saved in:
`output/{company}__{role}/resume.docx`
`output/{company}__{role}/resume.pdf`

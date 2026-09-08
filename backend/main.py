from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ALLOW_ORIGINS
from routers import analyze, document, export, upload

app = FastAPI(title="Resume Refine API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    # Requests carry the document token and the caller's API key in headers,
    # not cookies, so the browser never needs to attach credentials.
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "X-Document-Token", "X-OpenRouter-Key"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(document.router, prefix="/api", tags=["document"])


@app.get("/health")
def health_check():
    return {"status": "ok"}

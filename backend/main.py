from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import upload, analyze, suggest, export, document, chat

app = FastAPI(title="Resume Refine API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(analyze.router, prefix="/api", tags=["analyze"])
app.include_router(suggest.router, prefix="/api", tags=["suggest"])
app.include_router(export.router, prefix="/api", tags=["export"])
app.include_router(document.router, prefix="/api", tags=["document"])
app.include_router(chat.router, prefix="/api", tags=["chat"])


@app.get("/health")
def health_check():
    return {"status": "ok"}

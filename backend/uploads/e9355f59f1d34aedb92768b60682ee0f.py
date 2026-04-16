from fastapi import FastAPI, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
import os
import shutil
import uuid

# after the other include_router lines
from database import engine
import models
from routers import (
    auth,
    topics,
    logs,
    resources,
    dashboard,
    search,
    profile,
    notes,
    roadmaps,
    assistant,
    folders,
    goals,
    export,
    graph,
    capture,
    session,
    tags,
    confidence,
)

models.Base.metadata.create_all(bind=engine)


def ensure_schema_compatibility() -> None:
    # Keep local/dev databases compatible when adding simple new columns.
    with engine.begin() as conn:
        conn.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture VARCHAR(500)"
            )
        )


ensure_schema_compatibility()

app = FastAPI(title="DevTrack API", version="2.0.0")

allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

extra_origins = os.getenv("CORS_ALLOW_ORIGINS")
if extra_origins:
    allowed_origins.extend([o.strip() for o in extra_origins.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(topics.router)
app.include_router(logs.router)
app.include_router(resources.router)
app.include_router(dashboard.router)
app.include_router(search.router)
app.include_router(profile.router)
app.include_router(notes.router)
app.include_router(folders.router)
app.include_router(roadmaps.router)
app.include_router(assistant.router)
app.include_router(goals.router)
app.include_router(export.router)
app.include_router(graph.router)
app.include_router(capture.router)
app.include_router(session.router)
app.include_router(tags.router)
app.include_router(confidence.router)

os.makedirs("uploads", exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.post("/upload")
def upload_file(request: Request, file: UploadFile = File(...)):
    ext = (
        file.filename.split(".")[-1]
        if file.filename and "." in file.filename
        else "bin"
    )
    filename = f"{uuid.uuid4().hex}.{ext}"
    path = os.path.join("uploads", filename)
    with open(path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    base_url = str(request.base_url).rstrip("/")
    return {"url": f"{base_url}/api/uploads/{filename}"}


@app.get("/")
def root():
    return {"message": "DevTrack API v2 is running"}

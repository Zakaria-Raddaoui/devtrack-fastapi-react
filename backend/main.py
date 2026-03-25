from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(title="DevTrack API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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


@app.get("/")
def root():
    return {"message": "DevTrack API v2 is running"}

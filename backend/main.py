from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine
import models
from routers import auth, topics, logs, resources, dashboard

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DevTrack API",
    description="Developer Learning Tracker",
    version="1.0.0",
)

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

@app.get("/")
def root():
    return {"message": "DevTrack API is running"}
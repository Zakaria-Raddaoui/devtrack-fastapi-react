from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class Log(BaseModel):
    id: int
    date: str
    content: str

logs_db = []

@router.post("/logs/", response_model=Log)
async def create_log(log: Log):
    logs_db.append(log)
    return log

@router.get("/logs/", response_model=List[Log])
async def read_logs():
    return logs_db

@router.get("/logs/{log_id}", response_model=Log)
async def read_log(log_id: int):
    for log in logs_db:
        if log.id == log_id:
            return log
    raise HTTPException(status_code=404, detail="Log not found")

@router.put("/logs/{log_id}", response_model=Log)
async def update_log(log_id: int, updated_log: Log):
    for index, log in enumerate(logs_db):
        if log.id == log_id:
            logs_db[index] = updated_log
            return updated_log
    raise HTTPException(status_code=404, detail="Log not found")

@router.delete("/logs/{log_id}", response_model=Log)
async def delete_log(log_id: int):
    for index, log in enumerate(logs_db):
        if log.id == log_id:
            return logs_db.pop(index)
    raise HTTPException(status_code=404, detail="Log not found")

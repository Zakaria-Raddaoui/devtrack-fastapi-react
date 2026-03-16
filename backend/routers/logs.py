from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/logs", tags=["logs"])


@router.post("/", response_model=schemas.LogResponse, status_code=status.HTTP_201_CREATED)
def create_log(
    log: schemas.LogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    # Verify the topic belongs to the user
    topic = db.query(models.Topic).filter(
        models.Topic.id == log.topic_id,
        models.Topic.owner_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db_log = models.Log(**log.model_dump(), user_id=current_user.id)
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


@router.get("/", response_model=List[schemas.LogResponse])
def read_logs(
    skip: int = 0,
    limit: int = 20,
    topic_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    query = db.query(models.Log).filter(models.Log.user_id == current_user.id)
    if topic_id:
        query = query.filter(models.Log.topic_id == topic_id)
    return query.order_by(models.Log.date.desc()).offset(skip).limit(limit).all()


@router.get("/{log_id}", response_model=schemas.LogResponse)
def read_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    log = db.query(models.Log).filter(
        models.Log.id == log_id,
        models.Log.user_id == current_user.id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    return log


@router.put("/{log_id}", response_model=schemas.LogResponse)
def update_log(
    log_id: int,
    log_data: schemas.LogUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    log = db.query(models.Log).filter(
        models.Log.id == log_id,
        models.Log.user_id == current_user.id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")

    for field, value in log_data.model_dump(exclude_unset=True).items():
        setattr(log, field, value)

    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_log(
    log_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    log = db.query(models.Log).filter(
        models.Log.id == log_id,
        models.Log.user_id == current_user.id
    ).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
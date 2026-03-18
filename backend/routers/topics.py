from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/topics", tags=["topics"])


@router.post("/", response_model=schemas.TopicResponse, status_code=status.HTTP_201_CREATED)
def create_topic(
    topic: schemas.TopicCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_topic = models.Topic(**topic.model_dump(), owner_id=current_user.id)
    db.add(db_topic)
    db.commit()
    db.refresh(db_topic)
    return db_topic


@router.get("/", response_model=List[schemas.TopicResponse])
def read_topics(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id
    ).offset(skip).limit(limit).all()


# ── IMPORTANT: specific routes MUST come before /{topic_id} ──────────────────

@router.get("/{topic_id}/detail", response_model=schemas.TopicDetailResponse)
def read_topic_detail(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id,
        models.Topic.owner_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    total_minutes = db.query(func.sum(models.Log.time_spent)).filter(
        models.Log.topic_id == topic_id,
        models.Log.user_id == current_user.id
    ).scalar() or 0

    logs = db.query(models.Log).filter(
        models.Log.topic_id == topic_id,
        models.Log.user_id == current_user.id
    ).order_by(models.Log.date.desc()).all()

    resources = db.query(models.Resource).filter(
        models.Resource.topic_id == topic_id,
        models.Resource.owner_id == current_user.id
    ).all()

    steps = db.query(models.RoadmapStep).filter(
        models.RoadmapStep.topic_id == topic_id
    ).all()

    linked_steps = []
    for step in steps:
        roadmap = db.query(models.Roadmap).filter(
            models.Roadmap.id == step.roadmap_id,
            models.Roadmap.owner_id == current_user.id
        ).first()
        if roadmap:
            linked_steps.append({
                "id": step.id,
                "title": step.title,
                "is_completed": step.is_completed,
                "roadmap_title": roadmap.title,
            })

    return schemas.TopicDetailResponse(
        **{c.name: getattr(topic, c.name) for c in topic.__table__.columns},
        total_minutes=total_minutes,
        total_logs=len(logs),
        logs=logs,
        resources=resources,
        linked_steps=linked_steps,
    )


@router.get("/{topic_id}", response_model=schemas.TopicResponse)
def read_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id,
        models.Topic.owner_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.put("/{topic_id}", response_model=schemas.TopicResponse)
def update_topic(
    topic_id: int,
    topic_data: schemas.TopicUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id,
        models.Topic.owner_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    for field, value in topic_data.model_dump(exclude_unset=True).items():
        setattr(topic, field, value)

    db.commit()
    db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topic = db.query(models.Topic).filter(
        models.Topic.id == topic_id,
        models.Topic.owner_id == current_user.id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
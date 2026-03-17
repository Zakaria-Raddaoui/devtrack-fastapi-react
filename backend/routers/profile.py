from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/u", tags=["profile"])


@router.get("/{username}", response_model=schemas.PublicProfileResponse)
def get_public_profile(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(
        models.User.username == username,
        models.User.is_public == True
    ).first()

    if not user:
        raise HTTPException(status_code=404, detail="Profile not found or is private")

    total_minutes = db.query(func.sum(models.Log.time_spent)).filter(
        models.Log.user_id == user.id
    ).scalar() or 0

    topics_mastered = db.query(models.Topic).filter(
        models.Topic.owner_id == user.id,
        models.Topic.status == models.StatusEnum.mastered
    ).count()

    topics_in_progress = db.query(models.Topic).filter(
        models.Topic.owner_id == user.id,
        models.Topic.status == models.StatusEnum.learning
    ).count()

    topics = db.query(models.Topic).filter(
        models.Topic.owner_id == user.id
    ).order_by(models.Topic.created_at.desc()).limit(20).all()

    return schemas.PublicProfileResponse(
        username=user.username,
        bio=user.bio,
        total_hours=round(total_minutes / 60, 1),
        topics_mastered=topics_mastered,
        topics_in_progress=topics_in_progress,
        topics=topics,
        member_since=user.created_at,
    )


@router.patch("/me/profile", response_model=schemas.UserResponse)
def update_profile(
    data: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user
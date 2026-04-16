from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
import schemas
import security
from database import get_db

router = APIRouter(tags=["profile"])


# ─── Public profile ───────────────────────────────────────────────────────────


@router.get("/u/{username}", response_model=schemas.PublicProfileResponse)
def get_public_profile(
    username: str,
    db: Session = Depends(get_db),
    request_user: models.User = Depends(security.get_optional_user),
):
    if request_user and request_user.username == username:
        user = db.query(models.User).filter(models.User.username == username).first()
    else:
        user = (
            db.query(models.User)
            .filter(models.User.username == username, models.User.is_public == True)
            .first()
        )

    if not user:
        raise HTTPException(status_code=404, detail="Profile not found or is private")

    total_minutes = (
        db.query(func.sum(models.Log.time_spent))
        .filter(models.Log.user_id == user.id)
        .scalar()
        or 0
    )
    topics_mastered = (
        db.query(models.Topic)
        .filter(
            models.Topic.owner_id == user.id,
            models.Topic.status == models.StatusEnum.mastered,
        )
        .count()
    )
    topics_in_progress = (
        db.query(models.Topic)
        .filter(
            models.Topic.owner_id == user.id,
            models.Topic.status == models.StatusEnum.learning,
        )
        .count()
    )
    topics = (
        db.query(models.Topic)
        .filter(models.Topic.owner_id == user.id)
        .order_by(models.Topic.created_at.desc())
        .limit(20)
        .all()
    )

    return schemas.PublicProfileResponse(
        username=user.username,
        bio=user.bio,
        profile_picture=user.profile_picture,
        total_hours=round(total_minutes / 60, 1),
        topics_mastered=topics_mastered,
        topics_in_progress=topics_in_progress,
        topics=topics,
        member_since=user.created_at,
    )


# ─── Private profile (prefixed with /me to avoid conflicts) ──────────────────


@router.get("/me/profile", response_model=schemas.UserResponse)
def get_my_profile(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return current_user


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


@router.post("/me/profile/password")
def change_password(
    data: schemas.PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    if not security.verify_password(
        data.current_password, current_user.hashed_password
    ):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(data.new_password) < 6:
        raise HTTPException(
            status_code=400, detail="New password must be at least 6 characters"
        )
    current_user.hashed_password = security.hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.get("/me/profile/stats", response_model=schemas.ProfileStats)
def get_profile_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    total_minutes = (
        db.query(func.sum(models.Log.time_spent))
        .filter(models.Log.user_id == current_user.id)
        .scalar()
        or 0
    )
    total_sessions = (
        db.query(models.Log).filter(models.Log.user_id == current_user.id).count()
    )
    logs = db.query(models.Log).filter(models.Log.user_id == current_user.id).all()
    active_days = len(set(f"{l.date.year}-{l.date.month}-{l.date.day}" for l in logs))

    return schemas.ProfileStats(
        total_hours=round(total_minutes / 60, 1),
        total_sessions=total_sessions,
        topics_total=db.query(models.Topic)
        .filter(models.Topic.owner_id == current_user.id)
        .count(),
        topics_mastered=db.query(models.Topic)
        .filter(
            models.Topic.owner_id == current_user.id,
            models.Topic.status == models.StatusEnum.mastered,
        )
        .count(),
        topics_learning=db.query(models.Topic)
        .filter(
            models.Topic.owner_id == current_user.id,
            models.Topic.status == models.StatusEnum.learning,
        )
        .count(),
        active_days=active_days,
        goals_active=db.query(models.Goal)
        .filter(
            models.Goal.owner_id == current_user.id, models.Goal.is_completed == False
        )
        .count(),
        goals_completed=db.query(models.Goal)
        .filter(
            models.Goal.owner_id == current_user.id, models.Goal.is_completed == True
        )
        .count(),
        notes_count=db.query(models.Note)
        .filter(models.Note.owner_id == current_user.id)
        .count(),
        roadmaps_count=db.query(models.Roadmap)
        .filter(models.Roadmap.owner_id == current_user.id)
        .count(),
        member_since=current_user.created_at,
    )

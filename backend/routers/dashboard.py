from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    total_minutes = db.query(func.sum(models.Log.time_spent)).filter(
        models.Log.user_id == current_user.id
    ).scalar() or 0

    topics_to_learn = db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id,
        models.Topic.status == models.StatusEnum.to_learn
    ).count()

    topics_in_progress = db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id,
        models.Topic.status == models.StatusEnum.learning
    ).count()

    topics_mastered = db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id,
        models.Topic.status == models.StatusEnum.mastered
    ).count()

    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    daily_logs = (
        db.query(
            func.date(models.Log.date).label("day"),
            func.sum(models.Log.time_spent).label("minutes"),
        )
        .filter(
            models.Log.user_id == current_user.id,
            models.Log.date >= seven_days_ago,
        )
        .group_by(func.date(models.Log.date))
        .order_by(func.date(models.Log.date))
        .all()
    )

    weekly_activity = [
        schemas.WeeklyActivity(date=str(row.day), hours=round(row.minutes / 60, 1))
        for row in daily_logs
    ]

    return schemas.DashboardStats(
        total_hours=round(total_minutes / 60, 1),
        topics_to_learn=topics_to_learn,
        topics_in_progress=topics_in_progress,
        topics_mastered=topics_mastered,
        weekly_activity=weekly_activity,
    )
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/goals", tags=["goals"])


def enrich_goal(goal: models.Goal, db: Session, user_id: int) -> schemas.GoalResponse:
    """Add logged_hours and topic_title to a goal response."""
    logged_hours = 0.0
    if goal.topic_id:
        mins = db.query(func.sum(models.Log.time_spent)).filter(
            models.Log.topic_id == goal.topic_id,
            models.Log.user_id  == user_id,
        ).scalar() or 0
        logged_hours = round(mins / 60, 1)

    topic_title = goal.topic.title if goal.topic else None

    return schemas.GoalResponse(
        **{c.name: getattr(goal, c.name) for c in goal.__table__.columns},
        topic_title  = topic_title,
        logged_hours = logged_hours,
    )


@router.post("/", response_model=schemas.GoalResponse, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: schemas.GoalCreate,
    db:   Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    goal = models.Goal(**data.model_dump(), owner_id=current_user.id)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return enrich_goal(goal, db, current_user.id)


@router.get("/", response_model=List[schemas.GoalResponse])
def list_goals(
    db:   Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    goals = db.query(models.Goal).filter(
        models.Goal.owner_id == current_user.id
    ).order_by(models.Goal.is_completed.asc(), models.Goal.created_at.desc()).all()
    return [enrich_goal(g, db, current_user.id) for g in goals]


@router.put("/{goal_id}", response_model=schemas.GoalResponse)
def update_goal(
    goal_id: int,
    data:    schemas.GoalUpdate,
    db:      Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    goal = db.query(models.Goal).filter(
        models.Goal.id       == goal_id,
        models.Goal.owner_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return enrich_goal(goal, db, current_user.id)


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: int,
    db:      Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    goal = db.query(models.Goal).filter(
        models.Goal.id       == goal_id,
        models.Goal.owner_id == current_user.id,
    ).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


# ─────────────────────────────────────────
# Roadmap CRUD
# ─────────────────────────────────────────

@router.post("/", response_model=schemas.RoadmapResponse, status_code=status.HTTP_201_CREATED)
def create_roadmap(
    roadmap: schemas.RoadmapCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_roadmap = models.Roadmap(**roadmap.model_dump(), owner_id=current_user.id)
    db.add(db_roadmap)
    db.commit()
    db.refresh(db_roadmap)
    return db_roadmap


@router.get("/", response_model=List[schemas.RoadmapResponse])
def read_roadmaps(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return db.query(models.Roadmap).filter(
        models.Roadmap.owner_id == current_user.id
    ).order_by(models.Roadmap.updated_at.desc()).all()


@router.get("/{roadmap_id}", response_model=schemas.RoadmapResponse)
def read_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return roadmap


@router.put("/{roadmap_id}", response_model=schemas.RoadmapResponse)
def update_roadmap(
    roadmap_id: int,
    data: schemas.RoadmapUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(roadmap, field, value)
    db.commit()
    db.refresh(roadmap)
    return roadmap


@router.delete("/{roadmap_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    db.delete(roadmap)
    db.commit()


# ─────────────────────────────────────────
# Step CRUD
# ─────────────────────────────────────────

@router.post("/{roadmap_id}/steps", response_model=schemas.RoadmapStepResponse, status_code=status.HTTP_201_CREATED)
def add_step(
    roadmap_id: int,
    step: schemas.RoadmapStepCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    # Auto-assign order if not provided
    if step.order == 0:
        max_order = len(roadmap.steps)
        step_data = step.model_dump()
        step_data['order'] = max_order
    else:
        step_data = step.model_dump()

    db_step = models.RoadmapStep(**step_data, roadmap_id=roadmap_id)
    db.add(db_step)
    db.commit()
    db.refresh(db_step)
    return db_step


@router.put("/{roadmap_id}/steps/{step_id}", response_model=schemas.RoadmapStepResponse)
def update_step(
    roadmap_id: int,
    step_id: int,
    data: schemas.RoadmapStepUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    # Verify ownership via roadmap
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    step = db.query(models.RoadmapStep).filter(
        models.RoadmapStep.id == step_id,
        models.RoadmapStep.roadmap_id == roadmap_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(step, field, value)
    db.commit()
    db.refresh(step)
    return step


@router.delete("/{roadmap_id}/steps/{step_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_step(
    roadmap_id: int,
    step_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = db.query(models.Roadmap).filter(
        models.Roadmap.id == roadmap_id,
        models.Roadmap.owner_id == current_user.id
    ).first()
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    step = db.query(models.RoadmapStep).filter(
        models.RoadmapStep.id == step_id,
        models.RoadmapStep.roadmap_id == roadmap_id
    ).first()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    db.delete(step)
    db.commit()
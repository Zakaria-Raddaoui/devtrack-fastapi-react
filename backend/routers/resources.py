from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/resources", tags=["resources"])


@router.post("/", response_model=schemas.ResourceResponse, status_code=status.HTTP_201_CREATED)
def create_resource(
    resource: schemas.ResourceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_resource = models.Resource(**resource.model_dump(), owner_id=current_user.id)
    db.add(db_resource)
    db.commit()
    db.refresh(db_resource)
    return db_resource


@router.get("/", response_model=List[schemas.ResourceResponse])
def read_resources(
    skip: int = 0,
    limit: int = 20,
    topic_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    query = db.query(models.Resource).filter(models.Resource.owner_id == current_user.id)
    if topic_id:
        query = query.filter(models.Resource.topic_id == topic_id)
    return query.offset(skip).limit(limit).all()


@router.get("/{resource_id}", response_model=schemas.ResourceResponse)
def read_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    resource = db.query(models.Resource).filter(
        models.Resource.id == resource_id,
        models.Resource.owner_id == current_user.id
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource


@router.put("/{resource_id}", response_model=schemas.ResourceResponse)
def update_resource(
    resource_id: int,
    resource_data: schemas.ResourceUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    resource = db.query(models.Resource).filter(
        models.Resource.id == resource_id,
        models.Resource.owner_id == current_user.id
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")

    for field, value in resource_data.model_dump(exclude_unset=True).items():
        setattr(resource, field, value)

    db.commit()
    db.refresh(resource)
    return resource


@router.delete("/{resource_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_resource(
    resource_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    resource = db.query(models.Resource).filter(
        models.Resource.id == resource_id,
        models.Resource.owner_id == current_user.id
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    db.delete(resource)
    db.commit()
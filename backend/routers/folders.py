from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/folders", tags=["folders"])


@router.post("/", response_model=schemas.FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    folder: schemas.FolderCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_folder = models.Folder(**folder.model_dump(), owner_id=current_user.id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    count = db.query(models.Note).filter(
        models.Note.folder_id == db_folder.id,
        models.Note.owner_id == current_user.id
    ).count()
    return schemas.FolderResponse(**{c.name: getattr(db_folder, c.name) for c in db_folder.__table__.columns}, note_count=count)


@router.get("/", response_model=List[schemas.FolderResponse])
def read_folders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    folders = db.query(models.Folder).filter(
        models.Folder.owner_id == current_user.id
    ).order_by(models.Folder.title).all()

    result = []
    for f in folders:
        count = db.query(models.Note).filter(
            models.Note.folder_id == f.id,
            models.Note.owner_id == current_user.id
        ).count()
        result.append(schemas.FolderResponse(
            **{c.name: getattr(f, c.name) for c in f.__table__.columns},
            note_count=count
        ))
    return result


@router.put("/{folder_id}", response_model=schemas.FolderResponse)
def update_folder(
    folder_id: int,
    data: schemas.FolderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.owner_id == current_user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(folder, field, value)
    db.commit()
    db.refresh(folder)
    count = db.query(models.Note).filter(
        models.Note.folder_id == folder.id,
        models.Note.owner_id == current_user.id
    ).count()
    return schemas.FolderResponse(**{c.name: getattr(folder, c.name) for c in folder.__table__.columns}, note_count=count)


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    folder = db.query(models.Folder).filter(
        models.Folder.id == folder_id,
        models.Folder.owner_id == current_user.id
    ).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    # Move notes to unfiled
    db.query(models.Note).filter(
        models.Note.folder_id == folder_id,
        models.Note.owner_id == current_user.id
    ).update({"folder_id": None})
    db.delete(folder)
    db.commit()
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/notes", tags=["notes"])


@router.post("/", response_model=schemas.NoteResponse, status_code=status.HTTP_201_CREATED)
def create_note(
    note: schemas.NoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    db_note = models.Note(**note.model_dump(), owner_id=current_user.id)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note


@router.get("/", response_model=List[schemas.NoteResponse])
def read_notes(
    skip: int = 0,
    limit: int = 50,
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    query = db.query(models.Note).filter(models.Note.owner_id == current_user.id)

    if q:
        query = query.filter(
            models.Note.title.ilike(f"%{q}%") |
            models.Note.content.ilike(f"%{q}%")
        )

    if tag:
        query = query.filter(models.Note.tags.ilike(f"%{tag}%"))

    # Pinned first, then by updated_at
    query = query.order_by(
        models.Note.is_pinned.desc(),
        models.Note.updated_at.desc()
    )

    return query.offset(skip).limit(limit).all()


@router.get("/{note_id}", response_model=schemas.NoteResponse)
def read_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.owner_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.put("/{note_id}", response_model=schemas.NoteResponse)
def update_note(
    note_id: int,
    note_data: schemas.NoteUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.owner_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    for field, value in note_data.model_dump(exclude_unset=True).items():
        setattr(note, field, value)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    note = db.query(models.Note).filter(
        models.Note.id == note_id,
        models.Note.owner_id == current_user.id
    ).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
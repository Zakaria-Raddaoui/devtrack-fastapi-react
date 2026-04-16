from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import re

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/notes", tags=["notes"])


def _normalize_tags(tag_str: Optional[str]) -> Optional[str]:
    if not tag_str:
        return None

    seen = set()
    cleaned = []
    for raw in tag_str.split(","):
        tag = raw.strip().lower()
        tag = re.sub(r"[^a-z0-9\- ]+", "", tag)
        tag = re.sub(r"\s+", "-", tag)
        tag = re.sub(r"-+", "-", tag).strip("-")
        if not tag or tag in seen:
            continue
        seen.add(tag)
        cleaned.append(tag)

    return ", ".join(cleaned) if cleaned else None


def _ensure_tag_records(tags: Optional[str], db: Session, owner_id: int) -> None:
    if not tags:
        return
    names = [t.strip().lower() for t in tags.split(",") if t.strip()]
    if not names:
        return

    existing = {
        name
        for (name,) in db.query(models.Tag.name)
        .filter(models.Tag.owner_id == owner_id, models.Tag.name.in_(names))
        .all()
    }
    missing = [name for name in names if name not in existing]
    for name in missing:
        db.add(models.Tag(name=name, owner_id=owner_id))


@router.post(
    "/", response_model=schemas.NoteResponse, status_code=status.HTTP_201_CREATED
)
def create_note(
    note: schemas.NoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    payload = note.model_dump()
    payload["tags"] = _normalize_tags(payload.get("tags"))
    db_note = models.Note(**payload, owner_id=current_user.id)
    db.add(db_note)
    _ensure_tag_records(payload.get("tags"), db, current_user.id)
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
            models.Note.title.ilike(f"%{q}%") | models.Note.content.ilike(f"%{q}%")
        )

    if tag:
        query = query.filter(models.Note.tags.ilike(f"%{tag}%"))

    # Pinned first, then by updated_at
    query = query.order_by(models.Note.is_pinned.desc(), models.Note.updated_at.desc())

    return query.offset(skip).limit(limit).all()


@router.get("/{note_id}", response_model=schemas.NoteResponse)
def read_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.owner_id == current_user.id)
        .first()
    )
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
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.owner_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    updates = note_data.model_dump(exclude_unset=True)
    if "tags" in updates:
        updates["tags"] = _normalize_tags(updates.get("tags"))

    for field, value in updates.items():
        setattr(note, field, value)

    _ensure_tag_records(note.tags, db, current_user.id)

    db.commit()
    db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.owner_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()

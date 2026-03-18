from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/", response_model=schemas.SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    q_lower = f"%{q.lower()}%"
    results = []

    # Search topics
    topics = db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id,
        models.Topic.title.ilike(q_lower)
    ).limit(5).all()

    for t in topics:
        results.append(schemas.SearchResult(
            type="topic",
            id=t.id,
            title=t.title,
            subtitle=t.description or t.difficulty.value,
        ))

    # Search logs
    logs = db.query(models.Log).filter(
        models.Log.user_id == current_user.id,
        models.Log.notes.ilike(q_lower)
    ).limit(5).all()

    for l in logs:
        results.append(schemas.SearchResult(
            type="log",
            id=l.id,
            title=l.notes[:60] + ("..." if len(l.notes) > 60 else ""),
            subtitle=l.date.strftime("%b %d, %Y"),
        ))

    # Search resources
    resources = db.query(models.Resource).filter(
        models.Resource.owner_id == current_user.id,
        models.Resource.title.ilike(q_lower)
    ).limit(5).all()

    for r in resources:
        results.append(schemas.SearchResult(
            type="resource",
            id=r.id,
            title=r.title,
            subtitle=r.resource_type or "resource",
        ))

    # Search notes
    notes = db.query(models.Note).filter(
        models.Note.owner_id == current_user.id,
        (models.Note.title.ilike(q_lower) | models.Note.content.ilike(q_lower))
    ).limit(5).all()

    for n in notes:
        results.append(schemas.SearchResult(
            type="note",
            id=n.id,
            title=n.title,
            subtitle=n.tags or "note",
        ))

    return schemas.SearchResponse(results=results, total=len(results))
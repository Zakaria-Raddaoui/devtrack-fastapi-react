from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os
import json
from groq import Groq

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])


# ─────────────────────────────────────────
# Roadmap CRUD
# ─────────────────────────────────────────


@router.post(
    "/", response_model=schemas.RoadmapResponse, status_code=status.HTTP_201_CREATED
)
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
    return (
        db.query(models.Roadmap)
        .filter(models.Roadmap.owner_id == current_user.id)
        .order_by(models.Roadmap.updated_at.desc())
        .all()
    )


@router.get("/{roadmap_id}", response_model=schemas.RoadmapResponse)
def read_roadmap(
    roadmap_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
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
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
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
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    db.delete(roadmap)
    db.commit()


# ─────────────────────────────────────────
# AI Generation
# ─────────────────────────────────────────

from pydantic import BaseModel


class GenerateRoadmapRequest(BaseModel):
    title: str
    skill_level: str = "beginner"  # beginner | intermediate | advanced


@router.post(
    "/generate",
    response_model=schemas.RoadmapResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_roadmap(
    req: GenerateRoadmapRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    # Gather user's existing topics so AI can skip what they already know
    user_topics = (
        db.query(models.Topic).filter(models.Topic.owner_id == current_user.id).all()
    )

    mastered = [t.title for t in user_topics if t.status.value == "mastered"]
    learning = [t.title for t in user_topics if t.status.value == "learning"]

    context_lines = []
    if mastered:
        context_lines.append(f"Already mastered: {', '.join(mastered)}")
    if learning:
        context_lines.append(f"Currently learning: {', '.join(learning)}")
    context_str = (
        "\n".join(context_lines) if context_lines else "No prior topics tracked."
    )

    # Build topic lookup for auto-linking steps
    topic_title_map = {t.title.lower(): t.id for t in user_topics}

    prompt = f"""You are a senior developer and mentor creating a personalised learning roadmap.

Goal: "{req.title}"
Skill level: {req.skill_level}
User context:
{context_str}

Generate a complete, ordered learning roadmap with 8 to 14 steps.

Rules:
- Steps must be ordered from foundational to advanced
- Each step should be concrete and actionable, not vague
- If the user already mastered something, either skip it or mark it as a quick review
- Tailor depth to the skill level: beginners get more foundational steps, advanced users get fewer basics
- Keep titles short (max 8 words), descriptions 1-2 sentences
- Return ONLY valid JSON, no markdown fences, no extra text

JSON format:
{{
  "description": "One sentence describing what this roadmap will achieve",
  "steps": [
    {{
      "title": "Step title",
      "description": "What the learner will do or learn in this step"
    }}
  ]
}}"""

    api_key = os.getenv("GROQ_API_KEY")

    # ── If no Groq key, create a blank roadmap as fallback ───────────────────
    if not api_key:
        db_roadmap = models.Roadmap(
            title=req.title,
            description=f"Learning roadmap for: {req.title}",
            owner_id=current_user.id,
        )
        db.add(db_roadmap)
        db.commit()
        db.refresh(db_roadmap)
        return db_roadmap

    # ── Call Groq ─────────────────────────────────────────────────────────────
    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=1200,
        temperature=0.6,
    )

    raw = completion.choices[0].message.content.strip()

    # Strip markdown fences if model wraps anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: blank roadmap if parse fails
        parsed = {"description": f"A roadmap for {req.title}", "steps": []}

    # ── Save roadmap + steps in DB ────────────────────────────────────────────
    db_roadmap = models.Roadmap(
        title=req.title,
        description=parsed.get("description", ""),
        owner_id=current_user.id,
    )
    db.add(db_roadmap)
    db.commit()
    db.refresh(db_roadmap)

    steps_data = parsed.get("steps", [])
    for i, step in enumerate(steps_data):
        step_title = step.get("title", f"Step {i + 1}")
        step_desc = step.get("description", "")

        # Auto-link to existing topic if title matches
        linked_topic_id = None
        for topic_name, topic_id in topic_title_map.items():
            if topic_name in step_title.lower() or step_title.lower() in topic_name:
                linked_topic_id = topic_id
                break

        db_step = models.RoadmapStep(
            title=step_title,
            description=step_desc,
            order=i,
            is_completed=False,
            topic_id=linked_topic_id,
            roadmap_id=db_roadmap.id,
        )
        db.add(db_step)

    db.commit()
    db.refresh(db_roadmap)
    return db_roadmap


# ─────────────────────────────────────────
# Step CRUD
# ─────────────────────────────────────────


@router.post(
    "/{roadmap_id}/steps",
    response_model=schemas.RoadmapStepResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_step(
    roadmap_id: int,
    step: schemas.RoadmapStepCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    if step.order == 0:
        max_order = len(roadmap.steps)
        step_data = step.model_dump()
        step_data["order"] = max_order
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
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    step = (
        db.query(models.RoadmapStep)
        .filter(
            models.RoadmapStep.id == step_id,
            models.RoadmapStep.roadmap_id == roadmap_id,
        )
        .first()
    )
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
    roadmap = (
        db.query(models.Roadmap)
        .filter(
            models.Roadmap.id == roadmap_id, models.Roadmap.owner_id == current_user.id
        )
        .first()
    )
    if not roadmap:
        raise HTTPException(status_code=404, detail="Roadmap not found")

    step = (
        db.query(models.RoadmapStep)
        .filter(
            models.RoadmapStep.id == step_id,
            models.RoadmapStep.roadmap_id == roadmap_id,
        )
        .first()
    )
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    db.delete(step)
    db.commit()

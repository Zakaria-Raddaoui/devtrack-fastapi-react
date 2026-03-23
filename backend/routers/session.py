from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional
import os
import json
from groq import Groq

import models
import security
from database import get_db

router = APIRouter(prefix="/session", tags=["session"])


class SummarizeRequest(BaseModel):
    topic_id:    int
    duration:    int              # minutes spent
    brain_dump:  Optional[str] = None   # raw user notes, can be empty


class SummarizeResponse(BaseModel):
    log_entry:    str   # clean markdown for the log
    summary:      list  # 3 bullet strings
    next_session: str   # short suggestion for what to do next
    topic_title:  str


@router.post("/summarize", response_model=SummarizeResponse)
def summarize_session(
    req: SummarizeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    # Fetch topic
    topic = db.query(models.Topic).filter(
        models.Topic.id       == req.topic_id,
        models.Topic.owner_id == current_user.id,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Gather context: recent logs for this topic
    recent_logs = db.query(models.Log).filter(
        models.Log.topic_id == req.topic_id,
        models.Log.user_id  == current_user.id,
    ).order_by(models.Log.date.desc()).limit(3).all()

    total_minutes = db.query(func.sum(models.Log.time_spent)).filter(
        models.Log.topic_id == req.topic_id,
        models.Log.user_id  == current_user.id,
    ).scalar() or 0

    context_parts = []
    if recent_logs:
        context_parts.append("Recent sessions on this topic:")
        for l in recent_logs:
            short = (l.notes or "")[:200]
            context_parts.append(f"- {l.date.strftime('%b %d')}: {short}")

    context_str = "\n".join(context_parts) if context_parts else "No previous sessions."

    brain_dump = (req.brain_dump or "").strip()
    h = req.duration // 60
    m = req.duration % 60
    duration_str = f"{h}h {m}m" if h else f"{m} minutes"

    prompt = f"""You are a learning assistant helping a developer log their study session.

Topic: {topic.title}
Duration: {duration_str}
Total time on this topic so far: {round(total_minutes / 60, 1)}h

{context_str}

{"User's notes after session: " + brain_dump if brain_dump else "The user didn't write notes — infer from topic context."}

Generate a study session summary. Respond ONLY with valid JSON, no markdown fences, no extra text:

{{
  "log_entry": "A clean 3-6 sentence markdown log entry in first person. Use **bold** for key terms. Be specific and technical. Start with what was studied, include what was learned or accomplished.",
  "summary": ["bullet 1: key concept/skill covered", "bullet 2: key insight or progress", "bullet 3: challenge encountered or question raised"],
  "next_session": "One sentence suggestion for what to focus on next session, being specific and actionable."
}}"""

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        # Fallback: generate a basic log without AI
        log_entry = f"Studied **{topic.title}** for {duration_str}."
        if brain_dump:
            log_entry += f"\n\n{brain_dump}"
        return SummarizeResponse(
            log_entry    = log_entry,
            summary      = [
                f"Spent {duration_str} on {topic.title}",
                brain_dump[:100] if brain_dump else "Session completed",
                "Continue in next session",
            ],
            next_session = f"Continue working on {topic.title}.",
            topic_title  = topic.title,
        )

    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model    = "llama-3.3-70b-versatile",
        messages = [{"role": "user", "content": prompt}],
        max_tokens    = 600,
        temperature   = 0.7,
    )

    raw = completion.choices[0].message.content.strip()

    # Strip markdown fences if model adds them anyway
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
        return SummarizeResponse(
            log_entry    = parsed.get("log_entry", f"Studied **{topic.title}** for {duration_str}."),
            summary      = parsed.get("summary", [])[:3],
            next_session = parsed.get("next_session", f"Continue with {topic.title}."),
            topic_title  = topic.title,
        )
    except json.JSONDecodeError:
        return SummarizeResponse(
            log_entry    = f"Studied **{topic.title}** for {duration_str}.\n\n{brain_dump or ''}".strip(),
            summary      = [f"Studied {topic.title}", f"Duration: {duration_str}", "Session complete"],
            next_session = f"Continue with {topic.title}.",
            topic_title  = topic.title,
        )
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta
import math

import models
import security
from database import get_db

router = APIRouter(prefix="/confidence", tags=["confidence"])


# ─── Evidence scoring weights ─────────────────────────────────────────────────

# Evidence = objective proof you know the topic
# Each factor contributes points toward 100

WEIGHT_HOURS        = 35    # hours logged (saturates at ~20h = full weight)
WEIGHT_CONSISTENCY  = 20    # number of distinct log days (saturates at 12+ days)
WEIGHT_DEPTH        = 20    # avg note length (saturates at 300+ chars/session)
WEIGHT_RESOURCES    = 10    # resources read on this topic (saturates at 5+)
WEIGHT_ROADMAP      = 10    # roadmap steps completed on topic (saturates at 5+)
WEIGHT_GOALS        = 5     # goals completed on topic


def clamp(val, lo=0.0, hi=1.0):
    return max(lo, min(hi, val))


def compute_evidence(
    logs:           list,
    resources_read: int,
    roadmap_steps:  int,
    goals_done:     int,
) -> dict:
    """
    Returns evidence_score (0-100) + breakdown dict.
    """
    total_minutes  = sum(l.time_spent for l in logs)
    total_hours    = total_minutes / 60

    distinct_days  = len(set(
        l.date.strftime('%Y-%m-%d') for l in logs
    ))

    avg_note_len   = (
        sum(len(l.notes or '') for l in logs) / len(logs)
        if logs else 0
    )

    # Normalise each factor to 0-1
    hours_factor       = clamp(total_hours / 20)
    consistency_factor = clamp(distinct_days / 12)
    depth_factor       = clamp(avg_note_len / 300)
    resources_factor   = clamp(resources_read / 5)
    roadmap_factor     = clamp(roadmap_steps / 5)
    goals_factor       = clamp(goals_done / 2)

    score = (
        hours_factor       * WEIGHT_HOURS +
        consistency_factor * WEIGHT_CONSISTENCY +
        depth_factor       * WEIGHT_DEPTH +
        resources_factor   * WEIGHT_RESOURCES +
        roadmap_factor     * WEIGHT_ROADMAP +
        goals_factor       * WEIGHT_GOALS
    )

    return {
        "score":       round(score),
        "total_hours": round(total_hours, 1),
        "distinct_days": distinct_days,
        "avg_note_len":  round(avg_note_len),
        "resources_read": resources_read,
        "roadmap_steps":  roadmap_steps,
        "goals_done":     goals_done,
        "breakdown": {
            "hours":       round(hours_factor * WEIGHT_HOURS),
            "consistency": round(consistency_factor * WEIGHT_CONSISTENCY),
            "depth":       round(depth_factor * WEIGHT_DEPTH),
            "resources":   round(resources_factor * WEIGHT_RESOURCES),
            "roadmap":     round(roadmap_factor * WEIGHT_ROADMAP),
            "goals":       round(goals_factor * WEIGHT_GOALS),
        }
    }


def compute_confidence_trend(logs_with_conf: list) -> list:
    """
    Returns list of {date, confidence} for the last 10 logs that have confidence set.
    """
    rated = [l for l in logs_with_conf if l.confidence is not None]
    rated.sort(key=lambda l: l.date)
    return [
        {"date": l.date.strftime('%b %d'), "value": l.confidence}
        for l in rated[-10:]
    ]


def gap_label(confidence: int, evidence: int) -> str:
    diff = confidence - evidence
    if abs(diff) <= 10:
        return "aligned"
    elif diff > 30:
        return "overconfident"
    elif diff > 10:
        return "slightly overconfident"
    elif diff < -30:
        return "underestimating"
    else:
        return "slightly underestimating"


def gap_color(label: str) -> str:
    return {
        "aligned":                 "#22c55e",
        "slightly overconfident":  "#f59e0b",
        "overconfident":           "#ef4444",
        "slightly underestimating":"#3b82f6",
        "underestimating":         "#a855f7",
    }.get(label, "#6b7280")


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/topic/{topic_id}")
def get_topic_confidence(
    topic_id: int,
    db:       Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    topic = db.query(models.Topic).filter(
        models.Topic.id       == topic_id,
        models.Topic.owner_id == current_user.id,
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    logs = db.query(models.Log).filter(
        models.Log.topic_id == topic_id,
        models.Log.user_id  == current_user.id,
    ).order_by(models.Log.date.desc()).all()

    # Latest confidence reading
    latest_confidence = next(
        (l.confidence for l in logs if l.confidence is not None), None
    )

    # Evidence components
    resources_read = db.query(models.Resource).filter(
        models.Resource.topic_id == topic_id,
        models.Resource.owner_id == current_user.id,
        models.Resource.is_read  == True,
    ).count()

    roadmap_steps = db.query(models.RoadmapStep).filter(
        models.RoadmapStep.topic_id      == topic_id,
        models.RoadmapStep.is_completed  == True,
    ).count()

    goals_done = db.query(models.Goal).filter(
        models.Goal.topic_id     == topic_id,
        models.Goal.owner_id     == current_user.id,
        models.Goal.is_completed == True,
    ).count()

    evidence = compute_evidence(logs, resources_read, roadmap_steps, goals_done)
    trend    = compute_confidence_trend(logs)

    conf_score = latest_confidence if latest_confidence is not None else 0
    gap        = gap_label(conf_score, evidence["score"])

    return {
        "topic_id":    topic_id,
        "topic_title": topic.title,
        "confidence":  conf_score,
        "evidence":    evidence["score"],
        "has_confidence_data": latest_confidence is not None,
        "gap_label":   gap,
        "gap_color":   gap_color(gap),
        "trend":       trend,
        "evidence_breakdown": evidence["breakdown"],
        "evidence_detail": {
            "total_hours":    evidence["total_hours"],
            "distinct_days":  evidence["distinct_days"],
            "avg_note_len":   evidence["avg_note_len"],
            "resources_read": evidence["resources_read"],
            "roadmap_steps":  evidence["roadmap_steps"],
            "goals_done":     evidence["goals_done"],
        },
        "log_count": len(logs),
    }


@router.get("/overview")
def get_confidence_overview(
    db:   Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """All topics with confidence + evidence scores, sorted by gap."""
    topics = db.query(models.Topic).filter(
        models.Topic.owner_id == current_user.id
    ).all()

    results = []
    for topic in topics:
        logs = db.query(models.Log).filter(
            models.Log.topic_id == topic.id,
            models.Log.user_id  == current_user.id,
        ).order_by(models.Log.date.desc()).all()

        if not logs:
            continue

        latest_confidence = next(
            (l.confidence for l in logs if l.confidence is not None), None
        )

        resources_read = db.query(models.Resource).filter(
            models.Resource.topic_id == topic.id,
            models.Resource.owner_id == current_user.id,
            models.Resource.is_read  == True,
        ).count()

        roadmap_steps = db.query(models.RoadmapStep).filter(
            models.RoadmapStep.topic_id     == topic.id,
            models.RoadmapStep.is_completed == True,
        ).count()

        goals_done = db.query(models.Goal).filter(
            models.Goal.topic_id     == topic.id,
            models.Goal.owner_id     == current_user.id,
            models.Goal.is_completed == True,
        ).count()

        evidence    = compute_evidence(logs, resources_read, roadmap_steps, goals_done)
        conf_score  = latest_confidence if latest_confidence is not None else None
        trend       = compute_confidence_trend(logs)

        gap  = gap_label(conf_score or 0, evidence["score"]) if conf_score is not None else "no data"
        gclr = gap_color(gap)

        results.append({
            "topic_id":    topic.id,
            "topic_title": topic.title,
            "confidence":  conf_score,
            "evidence":    evidence["score"],
            "has_confidence_data": conf_score is not None,
            "gap_label":   gap,
            "gap_color":   gclr,
            "trend":       trend[-5:],   # sparkline: last 5 points
            "total_hours": evidence["total_hours"],
        })

    # Sort: overconfident first (biggest gap), then aligned, then underestimating
    def sort_key(r):
        if not r["has_confidence_data"]: return 999
        return -(r["confidence"] - r["evidence"])

    results.sort(key=sort_key)
    return results
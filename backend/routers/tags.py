from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import re
from groq import Groq

import models
import security
from database import get_db

router = APIRouter(prefix="/tags", tags=["tags"])


# ─── Pydantic models ──────────────────────────────────────────────────────────


class TagResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int]
    parent_name: Optional[str]
    note_count: int
    children: List["TagResponse"] = []

    model_config = {"from_attributes": True}


TagResponse.model_rebuild()


class TagCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None


class MergeSuggestionResponse(BaseModel):
    id: int
    suggested_parent: str
    children: List[str]
    reason: str

    model_config = {"from_attributes": True}


class SuggestTagsRequest(BaseModel):
    note_id: Optional[int] = None
    content: str
    title: str
    current_tags: Optional[str] = None


class SuggestTagsResponse(BaseModel):
    suggested_tags: List[str]


class AcceptMergeRequest(BaseModel):
    suggestion_id: int
    parent_name: str
    child_names: List[str]


class DismissMergeRequest(BaseModel):
    suggestion_id: int


# ─── Helpers ──────────────────────────────────────────────────────────────────


def get_or_create_tag(name: str, owner_id: int, db: Session) -> models.Tag:
    name = name.strip().lower()
    tag = (
        db.query(models.Tag)
        .filter(models.Tag.name == name, models.Tag.owner_id == owner_id)
        .first()
    )
    if not tag:
        tag = models.Tag(name=name, owner_id=owner_id)
        db.add(tag)
        db.commit()
        db.refresh(tag)
    return tag


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "i",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "were",
    "with",
    "you",
    "your",
}


TECH_KEYWORDS = {
    "docker",
    "docker-compose",
    "kubernetes",
    "python",
    "fastapi",
    "react",
    "javascript",
    "typescript",
    "sql",
    "postgres",
    "sqlite",
    "api",
    "backend",
    "frontend",
    "devops",
    "linux",
    "git",
    "github",
    "aws",
    "database",
    "security",
    "authentication",
    "jwt",
    "testing",
    "debugging",
    "performance",
    "redis",
    "nginx",
    "css",
    "html",
}


def _sanitize_tag(raw: str) -> Optional[str]:
    if not raw:
        return None
    tag = raw.strip().lower()
    tag = re.sub(r"[^a-z0-9\- ]+", "", tag)
    tag = re.sub(r"\s+", "-", tag)
    tag = re.sub(r"-+", "-", tag).strip("-")
    if len(tag) < 2:
        return None
    return tag[:40]


def _split_tags(tag_str: Optional[str]) -> set[str]:
    if not tag_str:
        return set()
    parts = [t.strip() for t in tag_str.split(",") if t.strip()]
    cleaned = set()
    for p in parts:
        s = _sanitize_tag(p)
        if s:
            cleaned.add(s)
    return cleaned


def _extract_fallback_tags(
    title: str,
    content: str,
    all_known: List[str],
    excluded: set[str],
) -> List[str]:
    text = f"{title or ''} {content or ''}".lower()
    tokens = re.findall(r"[a-z0-9][a-z0-9\-]{1,30}", text)
    token_set = set(tokens)

    ranked = []

    # Prefer known tags already used by the user.
    for known in all_known:
        s = _sanitize_tag(known)
        if s and s not in excluded and (s in token_set or s in text):
            ranked.append(s)

    # Add direct tech keyword hits.
    for kw in TECH_KEYWORDS:
        if kw in text and kw not in excluded:
            ranked.append(kw)

    # Add statistically useful tokens from the current text.
    counts = {}
    for token in tokens:
        if token in STOPWORDS or token in excluded:
            continue
        if token.isdigit() or len(token) < 3:
            continue
        counts[token] = counts.get(token, 0) + 1

    for token, count in sorted(counts.items(), key=lambda x: (-x[1], -len(x[0]), x[0])):
        if count >= 2 or token in TECH_KEYWORDS:
            ranked.append(token)

    # Deduplicate while preserving order.
    seen = set()
    final = []
    for raw in ranked:
        clean = _sanitize_tag(raw)
        if not clean or clean in excluded or clean in seen:
            continue
        seen.add(clean)
        final.append(clean)
        if len(final) >= 6:
            break

    return final


def build_tag_tree(
    tags: List[models.Tag], db: Session, owner_id: int
) -> List[TagResponse]:
    """Build a tree of tags from a flat list."""
    tag_map = {}
    for tag in tags:
        note_count = (
            db.query(models.Note)
            .filter(
                models.Note.owner_id == owner_id,
                models.Note.tags.ilike(f"%{tag.name}%"),
            )
            .count()
        )
        tag_map[tag.id] = TagResponse(
            id=tag.id,
            name=tag.name,
            parent_id=tag.parent_id,
            parent_name=None,
            note_count=note_count,
            children=[],
        )

    # Assign parent names and build tree
    roots = []
    for tag in tags:
        resp = tag_map[tag.id]
        if tag.parent_id and tag.parent_id in tag_map:
            resp.parent_name = tag_map[tag.parent_id].name
            tag_map[tag.parent_id].children.append(resp)
        else:
            roots.append(resp)

    return roots


# ─── Routes ───────────────────────────────────────────────────────────────────


@router.get("/", response_model=List[TagResponse])
def list_tags(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """Return all tags for the user as a tree (parents with children nested)."""
    tags = (
        db.query(models.Tag)
        .filter(models.Tag.owner_id == current_user.id)
        .order_by(models.Tag.name)
        .all()
    )
    return build_tag_tree(tags, db, current_user.id)


@router.post("/suggest", response_model=SuggestTagsResponse)
def suggest_tags(
    req: SuggestTagsRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """
    Given a note title + content, use AI to suggest relevant tags.
    Also takes existing user tags into account so suggestions are consistent.
    """
    existing_tags = (
        db.query(models.Tag).filter(models.Tag.owner_id == current_user.id).all()
    )
    existing_names = [t.name.strip().lower() for t in existing_tags if t.name]

    # Also collect tags already in use across notes (from the tags string field)
    notes = db.query(models.Note).filter(models.Note.owner_id == current_user.id).all()
    inline_tags = set()
    for n in notes:
        if n.tags:
            for t in n.tags.split(","):
                t = _sanitize_tag(t)
                if t:
                    inline_tags.add(t)

    all_known = sorted(set(existing_names) | inline_tags)

    # Exclude tags already attached to the note or passed in request.
    existing_for_note = set()
    if req.note_id:
        note = (
            db.query(models.Note)
            .filter(
                models.Note.id == req.note_id, models.Note.owner_id == current_user.id
            )
            .first()
        )
        if note and note.tags:
            existing_for_note |= _split_tags(note.tags)

    existing_for_note |= _split_tags(req.current_tags)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        # Deterministic fallback when no AI key is configured.
        found = _extract_fallback_tags(
            req.title, req.content, all_known, existing_for_note
        )
        return SuggestTagsResponse(suggested_tags=found)

    # Trim content to avoid token overflow
    content_preview = req.content[:800] if req.content else ""

    prompt = f"""You are a tagging assistant for a developer knowledge base.

Note title: "{req.title}"
Note content preview:
{content_preview}

Existing tags the user already uses:
{', '.join(all_known[:40]) if all_known else 'none yet'}

Suggest 3-6 concise lowercase tags for this note.
Rules:
- Prefer reusing existing tags when they fit
- Tags should be specific but reusable (e.g. "docker", "networking", "debugging", "python")
- No spaces in tags — use hyphens if needed (e.g. "docker-compose")
- Do NOT suggest tags already in the note's current tag string
- Return ONLY valid JSON, no markdown, no explanation

JSON format:
{{"tags": ["tag1", "tag2", "tag3"]}}"""

    client = Groq(api_key=api_key)
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=150,
        temperature=0.3,
    )

    raw = completion.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        parsed = json.loads(raw)
        tags = []
        for t in parsed.get("tags", []):
            clean = _sanitize_tag(t)
            if clean and clean not in existing_for_note and clean not in tags:
                tags.append(clean)
            if len(tags) >= 6:
                break
        return SuggestTagsResponse(suggested_tags=tags)
    except Exception:
        fallback = _extract_fallback_tags(
            req.title, req.content, all_known, existing_for_note
        )
        return SuggestTagsResponse(suggested_tags=fallback)


@router.get("/merge-suggestions", response_model=List[MergeSuggestionResponse])
def get_merge_suggestions(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """
    Analyze the user's tags and return merge suggestions.
    Looks for tags that share a common prefix or are semantically related.
    Skips already-dismissed suggestions.
    """
    # All tags for this user (from Tag model + inline note tags)
    db_tags = (
        db.query(models.Tag)
        .filter(
            models.Tag.owner_id == current_user.id,
            models.Tag.parent_id == None,  # only top-level tags
        )
        .all()
    )

    notes = db.query(models.Note).filter(models.Note.owner_id == current_user.id).all()

    inline_tags = set()
    for n in notes:
        if n.tags:
            for t in n.tags.split(","):
                t = t.strip().lower()
                if t:
                    inline_tags.add(t)

    db_tag_names = {t.name for t in db_tags}
    all_tag_names = list(db_tag_names | inline_tags)

    if len(all_tag_names) < 3:
        return []

    # Get already-dismissed suggestions
    dismissed = (
        db.query(models.TagMergeSuggestion)
        .filter(
            models.TagMergeSuggestion.owner_id == current_user.id,
            models.TagMergeSuggestion.dismissed == True,
        )
        .all()
    )
    dismissed_keys = {s.suggestion_key for s in dismissed}

    # Simple prefix clustering (no AI needed — fast and deterministic)
    # Group tags that share a common prefix of 4+ chars
    clusters = {}
    sorted_tags = sorted(all_tag_names)

    for tag in sorted_tags:
        placed = False
        for parent_prefix in list(clusters.keys()):
            if tag.startswith(parent_prefix) and tag != parent_prefix:
                clusters[parent_prefix].append(tag)
                placed = True
                break
        if not placed:
            # Check if this tag is a prefix of any existing cluster parent
            prefix = tag[:4] if len(tag) >= 4 else tag
            if prefix not in clusters:
                clusters[prefix] = [tag]
            else:
                clusters[prefix].append(tag)

    # Also detect exact-prefix groups (e.g. docker, docker-compose, docker-network)
    prefix_groups = {}
    for tag in all_tag_names:
        for other in all_tag_names:
            if other != tag and other.startswith(tag + "-"):
                if tag not in prefix_groups:
                    prefix_groups[tag] = []
                if other not in prefix_groups[tag]:
                    prefix_groups[tag].append(other)

    suggestions = []
    seen_keys = set()

    for parent, children in prefix_groups.items():
        if len(children) < 2:
            continue
        key = parent + ":" + ",".join(sorted(children))
        if key in dismissed_keys or key in seen_keys:
            continue
        seen_keys.add(key)

        # Save or get the suggestion
        existing = (
            db.query(models.TagMergeSuggestion)
            .filter(
                models.TagMergeSuggestion.owner_id == current_user.id,
                models.TagMergeSuggestion.suggestion_key == key,
            )
            .first()
        )

        if not existing:
            existing = models.TagMergeSuggestion(
                owner_id=current_user.id,
                suggestion_key=key,
                suggested_parent=parent,
                children_json=json.dumps(children),
                reason=f'You have {len(children)} tags starting with "{parent}-". Merge them under "{parent}" as subtopics?',
                dismissed=False,
            )
            db.add(existing)
            db.commit()
            db.refresh(existing)

        suggestions.append(
            MergeSuggestionResponse(
                id=existing.id,
                suggested_parent=parent,
                children=children,
                reason=existing.reason,
            )
        )

    return suggestions[:5]  # cap at 5 suggestions at a time


@router.post("/merge-suggestions/accept")
def accept_merge(
    req: AcceptMergeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """
    Accept a merge suggestion: create/find the parent tag,
    set it as parent for the child tags, and update note tag strings.
    """
    parent_name = req.parent_name.strip().lower()

    # Get or create parent Tag
    parent_tag = get_or_create_tag(parent_name, current_user.id, db)

    for child_name in req.child_names:
        child_name = child_name.strip().lower()
        child_tag = get_or_create_tag(child_name, current_user.id, db)
        if child_tag.id != parent_tag.id:
            child_tag.parent_id = parent_tag.id
            db.commit()

    # Mark suggestion as dismissed (accepted = done)
    suggestion = (
        db.query(models.TagMergeSuggestion)
        .filter(
            models.TagMergeSuggestion.id == req.suggestion_id,
            models.TagMergeSuggestion.owner_id == current_user.id,
        )
        .first()
    )
    if suggestion:
        suggestion.dismissed = True
        db.commit()

    return {"message": "Merge accepted", "parent": parent_name}


@router.post("/merge-suggestions/dismiss")
def dismiss_merge(
    req: DismissMergeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    suggestion = (
        db.query(models.TagMergeSuggestion)
        .filter(
            models.TagMergeSuggestion.id == req.suggestion_id,
            models.TagMergeSuggestion.owner_id == current_user.id,
        )
        .first()
    )
    if not suggestion:
        raise HTTPException(status_code=404, detail="Suggestion not found")
    suggestion.dismissed = True
    db.commit()
    return {"message": "Dismissed"}


@router.post("/apply-to-note")
def apply_tags_to_note(
    note_id: int,
    tags: List[str],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    """Apply a list of tags to a note, merging with existing tags."""
    note = (
        db.query(models.Note)
        .filter(models.Note.id == note_id, models.Note.owner_id == current_user.id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    existing = set(t.strip().lower() for t in (note.tags or "").split(",") if t.strip())
    new_tags = set(t.strip().lower() for t in tags if t.strip())
    merged = existing | new_tags

    # Also ensure Tag records exist
    for name in new_tags:
        get_or_create_tag(name, current_user.id, db)

    note.tags = ", ".join(sorted(merged))
    db.commit()
    db.refresh(note)
    return {"tags": note.tags}

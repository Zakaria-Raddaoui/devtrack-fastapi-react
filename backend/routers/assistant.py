from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from groq import Groq
from typing import List
import os
import json

import models
import schemas
import security
from database import get_db

router = APIRouter(prefix="/assistant", tags=["assistant"])


def build_context(user: models.User, db: Session) -> str:
    topics = db.query(models.Topic).filter(models.Topic.owner_id == user.id).all()
    logs   = db.query(models.Log).filter(models.Log.user_id == user.id).order_by(models.Log.date.desc()).limit(20).all()
    notes  = db.query(models.Note).filter(models.Note.owner_id == user.id).order_by(models.Note.updated_at.desc()).limit(5).all()
    total_minutes = db.query(func.sum(models.Log.time_spent)).filter(models.Log.user_id == user.id).scalar() or 0

    ctx  = f"The user's name is {user.username}.\n"
    ctx += f"Total learning time: {round(total_minutes / 60, 1)} hours.\n\n"

    if topics:
        ctx += "## Topics:\n"
        for t in topics:
            mins = db.query(func.sum(models.Log.time_spent)).filter(models.Log.topic_id == t.id, models.Log.user_id == user.id).scalar() or 0
            ctx += f"- {t.title} | {t.status.value} | {t.difficulty.value} | {round(mins/60,1)}h\n"
        ctx += "\n"

    if logs:
        ctx += "## Recent logs:\n"
        for l in logs:
            t = db.query(models.Topic).filter(models.Topic.id == l.topic_id).first()
            ctx += f"- [{l.date.strftime('%Y-%m-%d')}] {t.title if t else 'Unknown'} ({round(l.time_spent/60,1)}h): {l.notes[:200]}\n"
        ctx += "\n"

    if notes:
        ctx += "## Recent notes:\n"
        for n in notes:
            ctx += f"- {n.title}"
            if n.content: ctx += f": {n.content[:150]}"
            ctx += "\n"

    return ctx


# ─── Conversations ────────────────────────────────────────────────────────────

@router.get("/conversations", response_model=List[schemas.ConversationResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    return db.query(models.Conversation).filter(
        models.Conversation.owner_id == current_user.id
    ).order_by(models.Conversation.updated_at.desc()).all()


@router.post("/conversations", response_model=schemas.ConversationResponse)
def create_conversation(
    data: schemas.ConversationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    conv = models.Conversation(title=data.title, owner_id=current_user.id)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


@router.put("/conversations/{conv_id}", response_model=schemas.ConversationResponse)
def rename_conversation(
    conv_id: int,
    data: schemas.ConversationUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.owner_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.title = data.title
    db.commit()
    db.refresh(conv)
    return conv


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.owner_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"message": "Deleted"}


@router.get("/conversations/{conv_id}/messages", response_model=List[schemas.ChatMessageResponse])
def get_messages(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    conv = db.query(models.Conversation).filter(
        models.Conversation.id == conv_id,
        models.Conversation.owner_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv.messages


# ─── Chat ─────────────────────────────────────────────────────────────────────

@router.post("/chat")
def chat(
    request: schemas.ChatRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(security.get_current_user),
):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI assistant is not configured. Add GROQ_API_KEY to your .env file.")

    conv = db.query(models.Conversation).filter(
        models.Conversation.id == request.conversation_id,
        models.Conversation.owner_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = models.ChatMessage(
        role="user",
        content=request.message,
        conversation_id=conv.id,
        owner_id=current_user.id,
    )
    db.add(user_msg)

    # Auto-title conversation from first message
    if len(conv.messages) == 0:
        conv.title = request.message[:60] + ("..." if len(request.message) > 60 else "")

    db.commit()

    # Build full conversation history for context
    history = [{"role": m.role, "content": m.content} for m in conv.messages]

    # Build system prompt with learning context
    learning_context = build_context(current_user, db)
    system_prompt = f"""You are DevTrack AI — a warm, encouraging personal learning assistant living inside DevTrack, a developer learning tracker app.

Your personality:
- Friendly, warm, and genuinely excited about the user's learning journey
- Conversational but smart — like a knowledgeable friend, not a textbook
- Encouraging and motivating, celebrate their progress
- Never robotic or overly formal
- Occasionally use light humor when appropriate

Your formatting rules (ALWAYS follow these):
- NEVER write one big paragraph — break everything into short, readable chunks
- Use **bold** for key terms, topic names, and important points
- Use bullet points or numbered lists when listing things — never comma-separated walls of text
- Use ## headings to separate sections when the response is long
- Use \`code\` for technical terms, commands, and tool names
- Use > blockquotes for tips, encouragement, or highlighted advice
- Keep individual paragraphs to 2-3 sentences max
- End responses with a follow-up question or encouraging nudge when it feels natural

You have full memory of this conversation and access to the user's real learning data:

{learning_context}

Reference their actual data — their topics, hours, progress — to make advice personal and specific from time to time."""

    client = Groq(api_key=api_key)
    messages = [{"role": "system", "content": system_prompt}] + history

    full_response = []

    def generate():
        stream = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            max_tokens=1024,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_response.append(delta)
                yield f"data: {json.dumps({'token': delta})}\n\n"

        # Save assistant response
        assistant_content = ''.join(full_response)
        if assistant_content:
            db.add(models.ChatMessage(
                role="assistant",
                content=assistant_content,
                conversation_id=conv.id,
                owner_id=current_user.id,
            ))
            # Update conversation updated_at
            from datetime import datetime
            conv.updated_at = datetime.utcnow()
            db.commit()

        yield f"data: {json.dumps({'done': True, 'conv_title': conv.title})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
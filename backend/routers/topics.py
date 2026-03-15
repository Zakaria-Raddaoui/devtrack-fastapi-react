from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List

from app.dependencies import get_db, get_current_user
from app.models import Topic, TopicCreate, TopicUpdate
from app.schemas import TopicResponse

router = APIRouter()

@router.post("/topics/", response_model=TopicResponse)
async def create_topic(topic: TopicCreate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    new_topic = Topic(**topic.dict())
    db.add(new_topic)
    db.commit()
    db.refresh(new_topic)
    return new_topic

@router.get("/topics/", response_model=List[TopicResponse])
async def read_topics(skip: int = 0, limit: int = 10, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    topics = db.query(Topic).offset(skip).limit(limit).all()
    return topics

@router.get("/topics/{topic_id}", response_model=TopicResponse)
async def read_topic(topic_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic

@router.put("/topics/{topic_id}", response_model=TopicResponse)
async def update_topic(topic_id: int, topic: TopicUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    existing_topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if existing_topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    for key, value in topic.dict().items():
        setattr(existing_topic, key, value)
    db.commit()
    return existing_topic

@router.delete("/topics/{topic_id}", response_model=TopicResponse)
async def delete_topic(topic_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise HTTPException(status_code=404, detail="Topic not found")
    db.delete(topic)
    db.commit()
    return topic

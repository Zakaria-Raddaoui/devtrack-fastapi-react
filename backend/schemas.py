from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models import DifficultyEnum, StatusEnum


# ─────────────────────────────────────────
# User schemas
# ─────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    bio: Optional[str] = None
    is_public: Optional[bool] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    bio: Optional[str]
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Topic schemas
# ─────────────────────────────────────────

class TopicCreate(BaseModel):
    title: str
    description: Optional[str] = None
    difficulty: DifficultyEnum = DifficultyEnum.beginner
    status: StatusEnum = StatusEnum.to_learn
    goal_hours: Optional[float] = None

class TopicUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    difficulty: Optional[DifficultyEnum] = None
    status: Optional[StatusEnum] = None
    goal_hours: Optional[float] = None

class TopicResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    difficulty: DifficultyEnum
    status: StatusEnum
    goal_hours: Optional[float]
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Log schemas
# ─────────────────────────────────────────

class LogCreate(BaseModel):
    notes: str
    time_spent: int
    topic_id: int
    date: Optional[datetime] = None

class LogUpdate(BaseModel):
    notes: Optional[str] = None
    time_spent: Optional[int] = None
    topic_id: Optional[int] = None
    date: Optional[datetime] = None

class LogResponse(BaseModel):
    id: int
    notes: str
    time_spent: int
    topic_id: int
    user_id: int
    date: datetime
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Resource schemas
# ─────────────────────────────────────────

class ResourceCreate(BaseModel):
    title: str
    url: str
    resource_type: Optional[str] = None
    topic_id: Optional[int] = None

class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    resource_type: Optional[str] = None
    topic_id: Optional[int] = None

class ResourceResponse(BaseModel):
    id: int
    title: str
    url: str
    resource_type: Optional[str]
    topic_id: Optional[int]
    owner_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Auth schemas
# ─────────────────────────────────────────

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None


# ─────────────────────────────────────────
# Dashboard schemas
# ─────────────────────────────────────────

class WeeklyActivity(BaseModel):
    date: str
    hours: float

class DashboardStats(BaseModel):
    total_hours: float
    topics_to_learn: int
    topics_in_progress: int
    topics_mastered: int
    weekly_activity: List[WeeklyActivity]


# ─────────────────────────────────────────
# Search schemas
# ─────────────────────────────────────────

class SearchResult(BaseModel):
    type: str        # "topic" | "log" | "resource"
    id: int
    title: str
    subtitle: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]
    total: int


# ─────────────────────────────────────────
# Public profile schemas
# ─────────────────────────────────────────

class PublicTopicResponse(BaseModel):
    title: str
    difficulty: DifficultyEnum
    status: StatusEnum

    model_config = {"from_attributes": True}

class PublicProfileResponse(BaseModel):
    username: str
    bio: Optional[str]
    total_hours: float
    topics_mastered: int
    topics_in_progress: int
    topics: List[PublicTopicResponse]
    member_since: datetime
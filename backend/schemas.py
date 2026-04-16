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
    profile_picture: Optional[str] = None


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    bio: Optional[str]
    is_public: bool
    profile_picture: Optional[str] = None
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
    confidence: Optional[int] = None  # 0–100


class LogUpdate(BaseModel):
    notes: Optional[str] = None
    time_spent: Optional[int] = None
    topic_id: Optional[int] = None
    date: Optional[datetime] = None
    confidence: Optional[int] = None


class LogResponse(BaseModel):
    id: int
    notes: str
    time_spent: int
    topic_id: int
    user_id: int
    date: datetime
    confidence: Optional[int] = None
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
    rating: Optional[int] = None
    is_read: bool = False
    notes: Optional[str] = None


class ResourceUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    resource_type: Optional[str] = None
    topic_id: Optional[int] = None
    rating: Optional[int] = None
    is_read: Optional[bool] = None
    notes: Optional[str] = None


class ResourceResponse(BaseModel):
    id: int
    title: str
    url: str
    resource_type: Optional[str]
    topic_id: Optional[int]
    owner_id: int
    rating: Optional[int]
    is_read: bool
    notes: Optional[str]
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
    type: str  # "topic" | "log" | "resource"
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
    profile_picture: Optional[str] = None
    total_hours: float
    topics_mastered: int
    topics_in_progress: int
    topics: List[PublicTopicResponse]
    member_since: datetime


# ─────────────────────────────────────────
# Note schemas
# ─────────────────────────────────────────


class NoteCreate(BaseModel):
    title: str
    content: Optional[str] = None
    tags: Optional[str] = None
    is_pinned: bool = False
    folder_id: Optional[int] = None


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    tags: Optional[str] = None
    is_pinned: Optional[bool] = None
    folder_id: Optional[int] = None


class NoteResponse(BaseModel):
    id: int
    title: str
    content: Optional[str]
    tags: Optional[str]
    is_pinned: bool
    folder_id: Optional[int]
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Roadmap schemas
# ─────────────────────────────────────────


class RoadmapStepCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order: int = 0
    is_completed: bool = False
    topic_id: Optional[int] = None


class RoadmapStepUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order: Optional[int] = None
    is_completed: Optional[bool] = None
    topic_id: Optional[int] = None


class RoadmapStepResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    order: int
    is_completed: bool
    topic_id: Optional[int]
    roadmap_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class RoadmapCreate(BaseModel):
    title: str
    description: Optional[str] = None


class RoadmapUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class RoadmapResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    owner_id: int
    created_at: datetime
    updated_at: datetime
    steps: List[RoadmapStepResponse] = []

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Topic detail schema
# ─────────────────────────────────────────


class LinkedStepResponse(BaseModel):
    id: int
    title: str
    is_completed: bool
    roadmap_title: str


class TopicDetailResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    difficulty: DifficultyEnum
    status: StatusEnum
    goal_hours: Optional[float]
    owner_id: int
    created_at: datetime
    updated_at: datetime

    # Aggregated
    total_minutes: int
    total_logs: int
    logs: List[LogResponse] = []
    resources: List[ResourceResponse] = []
    linked_steps: List[LinkedStepResponse] = []

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Assistant schemas
# ─────────────────────────────────────────


class AssistantMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AssistantRequest(BaseModel):
    messages: List[AssistantMessage]


class AssistantResponse(BaseModel):
    reply: str


# ─────────────────────────────────────────
# Folder schemas
# ─────────────────────────────────────────


class FolderCreate(BaseModel):
    title: str


class FolderUpdate(BaseModel):
    title: Optional[str] = None


class FolderResponse(BaseModel):
    id: int
    title: str
    owner_id: int
    created_at: datetime
    note_count: int = 0

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Chat history schemas
# ─────────────────────────────────────────


class ChatMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Conversation schemas
# ─────────────────────────────────────────


class ConversationCreate(BaseModel):
    title: str = "New chat"


class ConversationUpdate(BaseModel):
    title: str


class ConversationResponse(BaseModel):
    id: int
    title: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ConversationWithMessages(BaseModel):
    id: int
    title: str
    messages: List[ChatMessageResponse] = []

    model_config = {"from_attributes": True}


class ChatRequest(BaseModel):
    conversation_id: int
    message: str


# ─────────────────────────────────────────
# Goal schemas
# ─────────────────────────────────────────


class GoalCreate(BaseModel):
    title: str
    description: Optional[str] = None
    target_hours: Optional[float] = None
    target_date: Optional[datetime] = None
    topic_id: Optional[int] = None


class GoalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_hours: Optional[float] = None
    target_date: Optional[datetime] = None
    topic_id: Optional[int] = None
    is_completed: Optional[bool] = None


class GoalResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    target_hours: Optional[float]
    target_date: Optional[datetime]
    topic_id: Optional[int]
    topic_title: Optional[str] = None
    is_completed: bool
    owner_id: int
    created_at: datetime
    updated_at: datetime
    logged_hours: float = 0.0

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────
# Password change schema
# ─────────────────────────────────────────


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileStats(BaseModel):
    total_hours: float
    total_sessions: int
    topics_total: int
    topics_mastered: int
    topics_learning: int
    active_days: int
    goals_active: int
    goals_completed: int
    notes_count: int
    roadmaps_count: int
    member_since: datetime

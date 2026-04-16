from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Enum,
    Text,
    Float,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class DifficultyEnum(str, enum.Enum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class StatusEnum(str, enum.Enum):
    to_learn = "to_learn"
    learning = "learning"
    mastered = "mastered"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True)
    profile_picture = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    topics = relationship("Topic", back_populates="owner", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="user", cascade="all, delete-orphan")
    resources = relationship(
        "Resource", back_populates="owner", cascade="all, delete-orphan"
    )
    notes = relationship("Note", back_populates="owner", cascade="all, delete-orphan")
    roadmaps = relationship(
        "Roadmap", back_populates="owner", cascade="all, delete-orphan"
    )
    folders = relationship(
        "Folder", back_populates="owner", cascade="all, delete-orphan"
    )
    chat_messages = relationship(
        "ChatMessage", back_populates="owner", cascade="all, delete-orphan"
    )
    conversations = relationship(
        "Conversation", back_populates="owner", cascade="all, delete-orphan"
    )
    goals = relationship("Goal", back_populates="owner", cascade="all, delete-orphan")
    tags = relationship("Tag", back_populates="owner", cascade="all, delete-orphan")
    tag_merge_suggestions = relationship(
        "TagMergeSuggestion", back_populates="owner", cascade="all, delete-orphan"
    )


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
    difficulty = Column(Enum(DifficultyEnum), default=DifficultyEnum.beginner)
    status = Column(Enum(StatusEnum), default=StatusEnum.to_learn)
    goal_hours = Column(Float, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="topics")
    logs = relationship("Log", back_populates="topic")
    resources = relationship("Resource", back_populates="topic")


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    notes = Column(Text, nullable=False)
    time_spent = Column(Integer, nullable=False)
    date = Column(DateTime(timezone=True), server_default=func.now())
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    confidence = Column(Integer, nullable=True)  # 0–100, user's self-rating
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="logs")
    topic = relationship("Topic", back_populates="logs")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    resource_type = Column(String(50), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Integer, nullable=True)  # 1-5
    is_read = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="resources")
    topic = relationship("Topic", back_populates="resources")


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    content = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)
    is_pinned = Column(Boolean, default=False)
    folder_id = Column(Integer, ForeignKey("folders.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="notes")
    folder = relationship("Folder", back_populates="notes")


class Roadmap(Base):
    __tablename__ = "roadmaps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="roadmaps")
    steps = relationship(
        "RoadmapStep",
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapStep.order",
    )


class RoadmapStep(Base):
    __tablename__ = "roadmap_steps"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    order = Column(Integer, nullable=False, default=0)
    is_completed = Column(Boolean, default=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    roadmap_id = Column(Integer, ForeignKey("roadmaps.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    roadmap = relationship("Roadmap", back_populates="steps")
    topic = relationship("Topic")


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="folders")
    notes = relationship("Note", back_populates="folder")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="chat_messages")
    conversation = relationship("Conversation", back_populates="messages")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False, default="New chat")
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="conversations")
    messages = relationship(
        "ChatMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class Goal(Base):
    __tablename__ = "goals"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    target_hours = Column(Float, nullable=True)
    target_date = Column(DateTime(timezone=True), nullable=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)
    is_completed = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    owner = relationship("User", back_populates="goals")
    topic = relationship("Topic")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    parent_id = Column(Integer, ForeignKey("tags.id"), nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="tags")
    parent = relationship("Tag", remote_side="Tag.id", back_populates="children")
    children = relationship(
        "Tag", back_populates="parent", cascade="all, delete-orphan"
    )


class TagMergeSuggestion(Base):
    __tablename__ = "tag_merge_suggestions"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    suggestion_key = Column(String(500), nullable=False)  # deterministic key for dedup
    suggested_parent = Column(String(100), nullable=False)
    children_json = Column(Text, nullable=False)  # JSON array of child tag names
    reason = Column(Text, nullable=False)
    dismissed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="tag_merge_suggestions")

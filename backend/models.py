from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Text, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class DifficultyEnum(str, enum.Enum):
    beginner     = "beginner"
    intermediate = "intermediate"
    advanced     = "advanced"


class StatusEnum(str, enum.Enum):
    to_learn = "to_learn"
    learning = "learning"
    mastered = "mastered"


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    username        = Column(String(50), unique=True, index=True, nullable=False)
    email           = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    bio             = Column(Text, nullable=True)
    is_public       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    updated_at      = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    topics    = relationship("Topic",    back_populates="owner", cascade="all, delete-orphan")
    logs      = relationship("Log",      back_populates="user",  cascade="all, delete-orphan")
    resources = relationship("Resource", back_populates="owner", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id          = Column(Integer, primary_key=True, index=True)
    title       = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
    difficulty  = Column(Enum(DifficultyEnum), default=DifficultyEnum.beginner)
    status      = Column(Enum(StatusEnum), default=StatusEnum.to_learn)
    goal_hours  = Column(Float, nullable=True)
    owner_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at  = Column(DateTime(timezone=True), server_default=func.now())
    updated_at  = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner     = relationship("User",     back_populates="topics")
    logs      = relationship("Log",      back_populates="topic")
    resources = relationship("Resource", back_populates="topic")


class Log(Base):
    __tablename__ = "logs"

    id         = Column(Integer, primary_key=True, index=True)
    notes      = Column(Text, nullable=False)
    time_spent = Column(Integer, nullable=False)
    date       = Column(DateTime(timezone=True), server_default=func.now())
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic_id   = Column(Integer, ForeignKey("topics.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user  = relationship("User",  back_populates="logs")
    topic = relationship("Topic", back_populates="logs")


class Resource(Base):
    __tablename__ = "resources"

    id            = Column(Integer, primary_key=True, index=True)
    title         = Column(String(200), nullable=False)
    url           = Column(String(500), nullable=False)
    resource_type = Column(String(50), nullable=True)
    topic_id      = Column(Integer, ForeignKey("topics.id"), nullable=True)
    owner_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at    = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User",  back_populates="resources")
    topic = relationship("Topic", back_populates="resources")
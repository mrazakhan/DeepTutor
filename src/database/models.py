"""SQLAlchemy models for AP Academy course structure."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def generate_uuid():
    return str(uuid.uuid4())


def utcnow():
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Course(Base):
    __tablename__ = "courses"

    id = Column(String, primary_key=True, default=generate_uuid)
    code = Column(String(30), unique=True, nullable=False)  # e.g. "AP_CSA"
    name = Column(String(200), nullable=False)
    subject_area = Column(String(50), nullable=False)  # computer_science, math, science
    description = Column(Text)
    exam_format = Column(Text)  # JSON string
    reference_materials = Column(Text)  # JSON string
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    units = relationship("Unit", back_populates="course", cascade="all, delete-orphan",
                         order_by="Unit.unit_number")


class Unit(Base):
    __tablename__ = "units"

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    unit_number = Column(Integer, nullable=False)
    title = Column(String(200), nullable=False)
    big_idea = Column(String(200))
    description = Column(Text)
    estimated_hours = Column(Float)

    course = relationship("Course", back_populates="units")
    topics = relationship("Topic", back_populates="unit", cascade="all, delete-orphan",
                          order_by="Topic.topic_number")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(String, primary_key=True, default=generate_uuid)
    unit_id = Column(String, ForeignKey("units.id", ondelete="CASCADE"), nullable=False)
    topic_number = Column(String(10), nullable=False)  # "1.1", "1.2"
    title = Column(String(200), nullable=False)
    description = Column(Text)

    unit = relationship("Unit", back_populates="topics")
    learning_objectives = relationship("LearningObjective", back_populates="topic",
                                       cascade="all, delete-orphan")


class LearningObjective(Base):
    __tablename__ = "learning_objectives"

    id = Column(String, primary_key=True, default=generate_uuid)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    objective_code = Column(String(30), nullable=False)  # "MOD-1.A"
    description = Column(Text, nullable=False)
    skill_category = Column(String(50))

    topic = relationship("Topic", back_populates="learning_objectives")

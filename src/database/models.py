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
    UniqueConstraint,
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
    topics = relationship("Topic", back_populates="unit", cascade="all, delete-orphan")


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
    preloaded_content = relationship("TopicContent", back_populates="topic",
                                     uselist=False, cascade="all, delete-orphan")


class LearningObjective(Base):
    __tablename__ = "learning_objectives"

    id = Column(String, primary_key=True, default=generate_uuid)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    objective_code = Column(String(30), nullable=False)  # "MOD-1.A"
    description = Column(Text, nullable=False)
    skill_category = Column(String(50))

    topic = relationship("Topic", back_populates="learning_objectives")


class TopicContent(Base):
    """Pre-generated topic content, shared across all users.

    The `content` column stores a JSON object with keys:
      - intro: str — "Explain <topic> step by step"
      - practice_mcq: list[dict] — Multiple choice questions, each:
            {question, options: {A,B,C,D}, correct, explanation}
      - practice_frq: list[dict] — Free response questions, each:
            {question, sample_solution, rubric, explanation}
      - exam: str — "How does this appear on the AP exam?"
      - mistakes: str — "What are common mistakes students make?"
    """

    __tablename__ = "topic_content"

    id = Column(String, primary_key=True, default=generate_uuid)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, unique=True)
    content = Column(Text, nullable=False)  # JSON: {intro, practice_mcq, practice_frq, exam, mistakes}
    generated_by = Column(String(100))  # Username who triggered generation
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    topic = relationship("Topic", back_populates="preloaded_content")


class User(Base):
    """Simple user model for authentication."""

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    username = Column(String(50), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    display_name = Column(String(100), nullable=False)
    role = Column(String(20), nullable=False, default="student")  # student | admin
    created_at = Column(DateTime, default=utcnow)
    last_login_at = Column(DateTime, nullable=True)

    assessments = relationship("TopicAssessment", back_populates="user", cascade="all, delete-orphan")
    favorite_courses = relationship("UserCourseFavorite", back_populates="user", cascade="all, delete-orphan")


class UserCourseFavorite(Base):
    """Tracks which courses a user has starred/favorited."""

    __tablename__ = "user_course_favorites"
    __table_args__ = (UniqueConstraint("user_id", "course_id", name="uq_user_course_fav"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="favorite_courses")
    course = relationship("Course")


class TopicAssessment(Base):
    """Tracks a student's assessment attempts and proficiency per topic."""

    __tablename__ = "topic_assessments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    # Proficiency: 0-100 score based on recent performance
    proficiency = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    # Last assessment timestamp
    last_assessed_at = Column(DateTime, default=utcnow)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="assessments")
    topic = relationship("Topic")
    answers = relationship("AssessmentAnswer", back_populates="assessment", cascade="all, delete-orphan")


class AssessmentAnswer(Base):
    """Individual answer records for assessment questions."""

    __tablename__ = "assessment_answers"

    id = Column(String, primary_key=True, default=generate_uuid)
    assessment_id = Column(String, ForeignKey("topic_assessments.id", ondelete="CASCADE"), nullable=False)
    question_type = Column(String(10), nullable=False)  # "mcq" or "frq"
    question_text = Column(Text, nullable=False)
    student_answer = Column(Text, nullable=False)
    correct_answer = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False)
    explanation = Column(Text)
    question_category = Column(String(100), nullable=True)  # "Methods", "ArrayList", "2D Array", etc.
    created_at = Column(DateTime, default=utcnow)

    assessment = relationship("TopicAssessment", back_populates="answers")


# Minimum questions required before claiming mastery of a dimension
MIN_QUESTIONS_FOR_MASTERY = 5


class ProficiencyDimension(Base):
    """Per-dimension proficiency tracking (question type + AP category)."""

    __tablename__ = "proficiency_dimensions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    topic_id = Column(String, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)
    dimension_type = Column(String(30), nullable=False)  # "question_type" | "category"
    dimension_value = Column(String(100), nullable=False)  # "mcq"|"frq"|"Methods"|"ArrayList" etc.
    correct = Column(Integer, default=0)
    total = Column(Integer, default=0)
    proficiency = Column(Integer, default=0)  # 0-100
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

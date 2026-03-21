"""AP Academy Course Catalog API router."""

import json

from fastapi import APIRouter, HTTPException

from src.database.engine import get_db, init_db
from src.database.models import Course, Unit, Topic

router = APIRouter()

# Ensure tables exist on import
init_db()


@router.get("/list")
async def list_courses(subject_area: str | None = None):
    """List all AP courses, optionally filtered by subject area."""
    db = get_db()
    try:
        query = db.query(Course).filter(Course.is_active == True)
        if subject_area:
            query = query.filter(Course.subject_area == subject_area)
        courses = query.order_by(Course.subject_area, Course.name).all()

        return [
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "subject_area": c.subject_area,
                "description": c.description,
                "unit_count": len(c.units),
                "topic_count": sum(len(u.topics) for u in c.units),
            }
            for c in courses
        ]
    finally:
        db.close()


@router.get("/subjects")
async def list_subjects():
    """List available subject areas with course counts."""
    db = get_db()
    try:
        courses = db.query(Course).filter(Course.is_active == True).all()
        subjects = {}
        for c in courses:
            area = c.subject_area
            if area not in subjects:
                subjects[area] = {"subject_area": area, "count": 0, "label": _subject_label(area)}
            subjects[area]["count"] += 1
        return list(subjects.values())
    finally:
        db.close()


@router.get("/{course_id}")
async def get_course(course_id: str):
    """Get full course detail with units and topics."""
    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        return {
            "id": course.id,
            "code": course.code,
            "name": course.name,
            "subject_area": course.subject_area,
            "description": course.description,
            "exam_format": json.loads(course.exam_format) if course.exam_format else None,
            "units": [
                {
                    "id": u.id,
                    "unit_number": u.unit_number,
                    "title": u.title,
                    "big_idea": u.big_idea,
                    "description": u.description,
                    "topic_count": len(u.topics),
                    "topics": [
                        {
                            "id": t.id,
                            "topic_number": t.topic_number,
                            "title": t.title,
                            "description": t.description,
                        }
                        for t in u.topics
                    ],
                }
                for u in course.units
            ],
        }
    finally:
        db.close()


@router.get("/{course_id}/units/{unit_id}")
async def get_unit(course_id: str, unit_id: str):
    """Get unit detail with all topics."""
    db = get_db()
    try:
        unit = db.query(Unit).filter(Unit.id == unit_id, Unit.course_id == course_id).first()
        if not unit:
            raise HTTPException(status_code=404, detail="Unit not found")

        return {
            "id": unit.id,
            "unit_number": unit.unit_number,
            "title": unit.title,
            "big_idea": unit.big_idea,
            "description": unit.description,
            "course_name": unit.course.name,
            "course_code": unit.course.code,
            "topics": [
                {
                    "id": t.id,
                    "topic_number": t.topic_number,
                    "title": t.title,
                    "description": t.description,
                    "learning_objectives": [
                        {
                            "id": lo.id,
                            "objective_code": lo.objective_code,
                            "description": lo.description,
                            "skill_category": lo.skill_category,
                        }
                        for lo in t.learning_objectives
                    ],
                }
                for t in unit.topics
            ],
        }
    finally:
        db.close()


@router.get("/{course_id}/topics/{topic_id}")
async def get_topic(course_id: str, topic_id: str):
    """Get topic detail with learning objectives."""
    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")

        # Verify the topic belongs to the given course
        if topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found in this course")

        return {
            "id": topic.id,
            "topic_number": topic.topic_number,
            "title": topic.title,
            "description": topic.description,
            "unit_title": topic.unit.title,
            "unit_number": topic.unit.unit_number,
            "course_name": topic.unit.course.name,
            "course_code": topic.unit.course.code,
            "learning_objectives": [
                {
                    "id": lo.id,
                    "objective_code": lo.objective_code,
                    "description": lo.description,
                    "skill_category": lo.skill_category,
                }
                for lo in topic.learning_objectives
            ],
        }
    finally:
        db.close()


def _subject_label(area: str) -> str:
    """Human-readable label for subject area."""
    labels = {
        "computer_science": "Computer Science",
        "math": "Mathematics",
        "science": "Science",
    }
    return labels.get(area, area.replace("_", " ").title())

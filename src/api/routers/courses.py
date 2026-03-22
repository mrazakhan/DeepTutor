"""AP Academy Course Catalog API router."""

import json
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import Course, Topic, TopicContent, Unit
from src.logging import get_logger

logger = get_logger("CoursesAPI")

router = APIRouter()


class PreloadRequest(BaseModel):
    generated_by: str | None = None

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


@router.get("/{course_id}/content-status")
async def get_content_status(course_id: str):
    """Return which topics have preloaded content: {topic_id: true/false}."""
    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        status = {}
        for unit in course.units:
            for topic in unit.topics:
                has_content = (
                    db.query(TopicContent)
                    .filter(TopicContent.topic_id == topic.id)
                    .first()
                    is not None
                )
                status[topic.id] = has_content
        return status
    finally:
        db.close()


@router.get("/{course_id}/topics/{topic_id}/content")
async def get_topic_content(course_id: str, topic_id: str):
    """Get preloaded content for a topic (JSON with intro/practice/exam/mistakes)."""
    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic_id).first()
        if not tc:
            return {"topic_id": topic_id, "content": None}

        return {
            "topic_id": tc.topic_id,
            "content": json.loads(tc.content),
            "generated_by": tc.generated_by,
            "created_at": tc.created_at.isoformat() if tc.created_at else None,
        }
    finally:
        db.close()


# Prompts for each content type
_CONTENT_PROMPTS = {
    "intro": (
        "Provide a comprehensive introduction to the topic '{topic_title}' "
        "(Topic {topic_number}) from Unit {unit_number}: {unit_title} "
        "in {course_name}. Cover the key concepts, why they matter for the AP exam, "
        "and give a clear explanation suitable for a student seeing this for the first time. "
        "Use markdown formatting with headers, bullet points, and examples where appropriate."
    ),
    "practice": (
        "Create a challenging but fair AP-style multiple choice practice question about "
        "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
        "in {course_name}.\n\n"
        "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
        '{{\n'
        '  "question": "The question text here (use \\n for newlines, include any code blocks as ```lang\\ncode\\n```)",\n'
        '  "options": {{\n'
        '    "A": "First option",\n'
        '    "B": "Second option",\n'
        '    "C": "Third option",\n'
        '    "D": "Fourth option",\n'
        '    "E": "Fifth option (optional, omit if not needed)"\n'
        '  }},\n'
        '  "correct": "B",\n'
        '  "explanation": "Detailed step-by-step explanation in markdown format"\n'
        '}}\n\n'
        "Make it representative of what students would see on the AP exam. "
        "The explanation should cover why the correct answer is right AND why each "
        "incorrect answer is wrong."
    ),
    "exam": (
        "Explain how the topic '{topic_title}' (Topic {topic_number}) from "
        "Unit {unit_number}: {unit_title} in {course_name} appears on the AP exam. "
        "Cover: what types of questions test this topic (MCQ vs FRQ), how frequently "
        "it appears, what specific skills are tested, and any connections to other topics. "
        "Give concrete examples of how exam questions are framed around this topic."
    ),
    "mistakes": (
        "What are the most common mistakes and misconceptions students have about "
        "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
        "in {course_name}? For each mistake, explain: what students get wrong, why they "
        "get confused, and how to avoid the error. Include specific examples that "
        "illustrate the correct vs incorrect approach."
    ),
}


@router.post("/{course_id}/topics/{topic_id}/preload")
async def preload_topic_content(
    course_id: str,
    topic_id: str,
    body: PreloadRequest | None = None,
):
    """Generate and store all 4 content types for a topic using the TutorAgent."""
    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        # Check if already generated
        existing = db.query(TopicContent).filter(TopicContent.topic_id == topic_id).first()
        if existing:
            return {
                "topic_id": existing.topic_id,
                "content": json.loads(existing.content),
                "generated_by": existing.generated_by,
                "already_existed": True,
            }

        course = topic.unit.course
        unit = topic.unit

        # Initialize TutorAgent
        from src.agents.tutor import TutorAgent
        from src.services.llm.config import get_llm_config

        try:
            llm_config = get_llm_config()
            api_key = llm_config.api_key
            base_url = llm_config.base_url
            api_version = getattr(llm_config, "api_version", None)
        except Exception:
            api_key = None
            base_url = None
            api_version = None

        project_root = Path(__file__).parent.parent.parent.parent
        from src.services.config import load_config_with_main
        config = load_config_with_main("solve_config.yaml", project_root)

        agent = TutorAgent(
            course_code=course.code,
            course_name=course.name,
            language="en",
            config=config,
            api_key=api_key,
            base_url=base_url,
            api_version=api_version,
        )

        fmt = {
            "topic_title": topic.title,
            "topic_number": topic.topic_number,
            "unit_number": unit.unit_number,
            "unit_title": unit.title,
            "course_name": course.name,
        }

        # Generate all 4 content types sequentially
        content_dict = {}
        for key, prompt_template in _CONTENT_PROMPTS.items():
            prompt = prompt_template.format(**fmt)
            logger.info(f"Generating '{key}' for topic {topic.topic_number} {topic.title}...")

            result = await agent.process(
                message=prompt,
                history=[],
                topic_title=topic.title,
                unit_title=unit.title,
                unit_number=unit.unit_number,
                stream=False,
            )
            response_text = result.get("response", "")

            # For practice questions, try to parse as structured JSON
            if key == "practice" and response_text:
                try:
                    # Strip markdown code fences if present
                    cleaned = response_text.strip()
                    if cleaned.startswith("```"):
                        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                        cleaned = cleaned.rsplit("```", 1)[0]
                    parsed = json.loads(cleaned)
                    # Validate required fields
                    if all(k in parsed for k in ("question", "options", "correct", "explanation")):
                        response_text = json.dumps(parsed)  # re-serialize clean
                except (json.JSONDecodeError, KeyError):
                    logger.warning(f"Practice question for {topic.title} not valid JSON, storing as-is")

            content_dict[key] = response_text

        if not any(content_dict.values()):
            raise HTTPException(status_code=500, detail="Failed to generate content")

        # Save to DB as JSON
        generated_by = body.generated_by if body else None
        tc = TopicContent(
            topic_id=topic_id,
            content=json.dumps(content_dict),
            generated_by=generated_by,
        )
        db.add(tc)
        db.commit()
        db.refresh(tc)

        logger.info(f"Preloaded all content for topic {topic_id} ({topic.title})")

        return {
            "topic_id": tc.topic_id,
            "content": content_dict,
            "generated_by": tc.generated_by,
            "already_existed": False,
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

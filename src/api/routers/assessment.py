"""Assessment and progress tracking API router."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import (
    AssessmentAnswer,
    Course,
    Topic,
    TopicAssessment,
    TopicContent,
    User,
)
from src.logging import get_logger

logger = get_logger("AssessmentAPI")

router = APIRouter()
init_db()


class SubmitAnswerRequest(BaseModel):
    question_type: str  # "mcq" or "frq"
    question_text: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None = None


class GenerateQuestionsRequest(BaseModel):
    count: int = 3
    difficulty: str = "medium"  # "easy", "medium", "hard"


def _get_user_from_request(request: Request) -> dict:
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def _get_or_create_assessment(db, user_id: str, topic_id: str) -> TopicAssessment:
    """Get existing assessment or create a new one for this user+topic."""
    assessment = (
        db.query(TopicAssessment)
        .filter(TopicAssessment.user_id == user_id, TopicAssessment.topic_id == topic_id)
        .first()
    )
    if not assessment:
        assessment = TopicAssessment(user_id=user_id, topic_id=topic_id)
        db.add(assessment)
        db.commit()
        db.refresh(assessment)
    return assessment


def _recalculate_proficiency(assessment: TopicAssessment) -> int:
    """Calculate proficiency as weighted score of recent answers.

    Uses exponential decay: recent answers matter more.
    """
    if assessment.total_questions == 0:
        return 0
    # Simple percentage-based proficiency
    raw = (assessment.correct_answers / assessment.total_questions) * 100
    return min(100, max(0, int(raw)))


@router.post("/{course_id}/topics/{topic_id}/submit-answer")
async def submit_answer(
    course_id: str,
    topic_id: str,
    body: SubmitAnswerRequest,
    request: Request,
):
    """Submit an answer and update proficiency."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        assessment = _get_or_create_assessment(db, user_id, topic_id)

        # Record the answer
        answer = AssessmentAnswer(
            assessment_id=assessment.id,
            question_type=body.question_type,
            question_text=body.question_text,
            student_answer=body.student_answer,
            correct_answer=body.correct_answer,
            is_correct=body.is_correct,
            explanation=body.explanation,
        )
        db.add(answer)

        # Update totals
        assessment.total_questions += 1
        if body.is_correct:
            assessment.correct_answers += 1
        assessment.proficiency = _recalculate_proficiency(assessment)
        assessment.last_assessed_at = datetime.now(timezone.utc)
        db.commit()

        return {
            "proficiency": assessment.proficiency,
            "total_questions": assessment.total_questions,
            "correct_answers": assessment.correct_answers,
            "is_correct": body.is_correct,
        }
    finally:
        db.close()


@router.get("/{course_id}/topics/{topic_id}/progress")
async def get_topic_progress(course_id: str, topic_id: str, request: Request):
    """Get a student's progress for a specific topic."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        assessment = (
            db.query(TopicAssessment)
            .filter(TopicAssessment.user_id == user_id, TopicAssessment.topic_id == topic_id)
            .first()
        )
        if not assessment:
            return {
                "topic_id": topic_id,
                "proficiency": 0,
                "total_questions": 0,
                "correct_answers": 0,
                "last_assessed_at": None,
            }

        return {
            "topic_id": topic_id,
            "proficiency": assessment.proficiency,
            "total_questions": assessment.total_questions,
            "correct_answers": assessment.correct_answers,
            "last_assessed_at": assessment.last_assessed_at.isoformat() if assessment.last_assessed_at else None,
        }
    finally:
        db.close()


@router.get("/{course_id}/progress")
async def get_course_progress(course_id: str, request: Request):
    """Get a student's progress across all topics in a course.

    Returns a map of topic_id -> {proficiency, total_questions, correct_answers}.
    """
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Get all topic IDs for this course
        topic_ids = []
        for unit in course.units:
            for topic in unit.topics:
                topic_ids.append(topic.id)

        # Get all assessments for this user in these topics
        assessments = (
            db.query(TopicAssessment)
            .filter(
                TopicAssessment.user_id == user_id,
                TopicAssessment.topic_id.in_(topic_ids),
            )
            .all()
        )

        progress = {}
        for a in assessments:
            progress[a.topic_id] = {
                "proficiency": a.proficiency,
                "total_questions": a.total_questions,
                "correct_answers": a.correct_answers,
                "last_assessed_at": a.last_assessed_at.isoformat() if a.last_assessed_at else None,
            }

        return progress
    finally:
        db.close()


@router.post("/{course_id}/topics/{topic_id}/generate-questions")
async def generate_additional_questions(
    course_id: str,
    topic_id: str,
    body: GenerateQuestionsRequest,
    request: Request,
):
    """Generate additional practice questions for a topic using AI.

    Used when a student needs more practice (low proficiency).
    """
    user = _get_user_from_request(request)

    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        course = topic.unit.course
        unit = topic.unit

        # Get existing assessment to tailor difficulty
        assessment = (
            db.query(TopicAssessment)
            .filter(
                TopicAssessment.user_id == user["user_id"],
                TopicAssessment.topic_id == topic_id,
            )
            .first()
        )

        proficiency = assessment.proficiency if assessment else 0

        # Tailor difficulty based on proficiency
        if proficiency < 40:
            difficulty_hint = (
                "\n\nThe student is struggling with this topic (low proficiency). "
                "Create questions that test FUNDAMENTAL concepts with clear, "
                "straightforward scenarios. Include helpful hints in the explanation."
            )
        elif proficiency < 70:
            difficulty_hint = (
                "\n\nThe student has moderate understanding. Create questions that "
                "test APPLICATION of concepts with realistic scenarios."
            )
        else:
            difficulty_hint = (
                "\n\nThe student has good understanding. Create CHALLENGING questions "
                "that test edge cases, subtle distinctions, and deeper reasoning."
            )

        # Get previously answered questions to avoid repeats
        prev_questions = []
        if assessment:
            answers = (
                db.query(AssessmentAnswer)
                .filter(AssessmentAnswer.assessment_id == assessment.id)
                .order_by(AssessmentAnswer.created_at.desc())
                .limit(10)
                .all()
            )
            prev_questions = [a.question_text[:100] for a in answers]

        avoid_hint = ""
        if prev_questions:
            avoid_hint = (
                "\n\nAvoid creating questions similar to these recently answered ones:\n"
                + "\n".join(f"- {q}" for q in prev_questions[:5])
            )

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

        from pathlib import Path
        from src.services.config import load_config_with_main
        project_root = Path(__file__).parent.parent.parent.parent
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

        async def _generate(prompt: str) -> str:
            result = await agent.process(
                message=prompt,
                history=[],
                topic_title=topic.title,
                unit_title=unit.title,
                unit_number=unit.unit_number,
                stream=False,
            )
            return result.get("response", "")

        def _parse_json_response(raw: str) -> dict | None:
            import re
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                cleaned = cleaned.rsplit("```", 1)[0].strip()
            try:
                return json.loads(cleaned)
            except (json.JSONDecodeError, KeyError, ValueError):
                pass
            first_brace = cleaned.find("{")
            last_brace = cleaned.rfind("}")
            if first_brace != -1 and last_brace > first_brace:
                candidate = cleaned[first_brace:last_brace + 1]
                try:
                    return json.loads(candidate)
                except (json.JSONDecodeError, ValueError):
                    fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
                    try:
                        return json.loads(fixed)
                    except (json.JSONDecodeError, ValueError):
                        pass
            return None

        mcq_prompt = (
            "Create a challenging but fair AP-style multiple choice practice question about "
            "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
            "in {course_name}.\n\n"
            "IMPORTANT: The AP CSA exam uses 4 answer choices (A-D), NOT 5.\n\n"
            "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
            '{{\n'
            '  "question": "The question text here",\n'
            '  "options": {{\n'
            '    "A": "First option",\n'
            '    "B": "Second option",\n'
            '    "C": "Third option",\n'
            '    "D": "Fourth option"\n'
            '  }},\n'
            '  "correct": "B",\n'
            '  "explanation": "Detailed step-by-step explanation"\n'
            '}}\n\n'
            "The explanation should cover why the correct answer is right AND why each "
            "incorrect answer is wrong."
            + difficulty_hint + avoid_hint
        )

        questions = []
        for i in range(body.count):
            variation = ""
            if i > 0:
                variation = f"\n\nThis is question {i+1} of {body.count}. Make it test a DIFFERENT aspect than the previous questions."

            logger.info(f"Generating additional MCQ {i+1}/{body.count} for {topic.topic_number}...")
            raw = await _generate(mcq_prompt.format(**fmt) + variation)
            parsed = _parse_json_response(raw)
            if parsed and all(k in parsed for k in ("question", "options", "correct", "explanation")):
                questions.append(parsed)
            else:
                logger.warning(f"Additional MCQ {i+1} not valid JSON")
                questions.append({"raw_text": raw})

        return {"questions": questions, "count": len(questions)}
    finally:
        db.close()

"""Assessment and progress tracking API router."""

import json
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import (
    AssessmentAnswer,
    Course,
    MIN_QUESTIONS_FOR_MASTERY,
    ProficiencyDimension,
    Topic,
    TopicAssessment,
    TopicContent,
    User,
)
from src.logging import get_logger

logger = get_logger("AssessmentAPI")

router = APIRouter()
init_db()


def _get_user_kb_name(user_id: str, course_code: str) -> str | None:
    """Check if user has uploaded materials and return their KB name."""
    upload_dir = Path("data/user_uploads") / str(user_id) / course_code
    if upload_dir.exists() and any(upload_dir.iterdir()):
        return f"user-{user_id}-{course_code.lower().replace('_', '-')}"
    return None


class SubmitAnswerRequest(BaseModel):
    question_type: str  # "mcq" or "frq"
    question_text: str
    student_answer: str
    correct_answer: str
    is_correct: bool
    explanation: str | None = None
    question_category: str | None = None  # "Methods", "ArrayList", "2D Array", etc.


class GenerateQuestionsRequest(BaseModel):
    count: int = 3
    difficulty: str = "medium"  # "easy", "medium", "hard"
    use_uploads: bool = False  # Generate from user-uploaded materials


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


def _upsert_dimension(db, user_id: str, topic_id: str, dim_type: str, dim_value: str, is_correct: bool):
    """Upsert a proficiency dimension row."""
    dim = (
        db.query(ProficiencyDimension)
        .filter(
            ProficiencyDimension.user_id == user_id,
            ProficiencyDimension.topic_id == topic_id,
            ProficiencyDimension.dimension_type == dim_type,
            ProficiencyDimension.dimension_value == dim_value,
        )
        .first()
    )
    if not dim:
        dim = ProficiencyDimension(
            user_id=user_id, topic_id=topic_id,
            dimension_type=dim_type, dimension_value=dim_value,
            correct=0, total=0, proficiency=0,
        )
        db.add(dim)
    dim.total += 1
    if is_correct:
        dim.correct += 1
    dim.proficiency = min(100, max(0, int((dim.correct / dim.total) * 100))) if dim.total > 0 else 0


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
            question_category=body.question_category,
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


@router.get("/{course_id}/topics/{topic_id}/progress/dimensions")
async def get_topic_dimensions(course_id: str, topic_id: str, request: Request):
    """Get per-dimension proficiency breakdown for a topic."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        dims = (
            db.query(ProficiencyDimension)
            .filter(
                ProficiencyDimension.user_id == user_id,
                ProficiencyDimension.topic_id == topic_id,
            )
            .all()
        )

        result: dict = {"question_type": {}, "category": {}}
        for d in dims:
            result.setdefault(d.dimension_type, {})[d.dimension_value] = {
                "correct": d.correct,
                "total": d.total,
                "proficiency": d.proficiency,
                "mastered": d.proficiency >= 80 and d.total >= MIN_QUESTIONS_FOR_MASTERY,
            }
        return result
    finally:
        db.close()


@router.get("/{course_id}/progress/dimensions")
async def get_course_dimensions(course_id: str, request: Request):
    """Get aggregated per-dimension proficiency across all topics in a course."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        topic_ids = []
        for unit in course.units:
            for topic in unit.topics:
                topic_ids.append(topic.id)

        dims = (
            db.query(ProficiencyDimension)
            .filter(
                ProficiencyDimension.user_id == user_id,
                ProficiencyDimension.topic_id.in_(topic_ids),
            )
            .all()
        )

        # Aggregate by dimension_type + dimension_value across topics
        agg: dict = {}
        for d in dims:
            key = (d.dimension_type, d.dimension_value)
            if key not in agg:
                agg[key] = {"correct": 0, "total": 0}
            agg[key]["correct"] += d.correct
            agg[key]["total"] += d.total

        result: dict = {"question_type": {}, "category": {}}
        for (dim_type, dim_value), counts in agg.items():
            prof = int((counts["correct"] / counts["total"]) * 100) if counts["total"] > 0 else 0
            result.setdefault(dim_type, {})[dim_value] = {
                "correct": counts["correct"],
                "total": counts["total"],
                "proficiency": prof,
                "mastered": prof >= 80 and counts["total"] >= MIN_QUESTIONS_FOR_MASTERY,
            }
        return result
    finally:
        db.close()


@router.get("/{course_id}/progress/mistakes")
async def get_course_mistakes(course_id: str, request: Request, limit: int = 100):
    """Get wrong answers for a user across all topics in a course.

    Returns mistakes grouped by topic with full question/answer context.
    """
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Get all topic IDs with their context
        topic_map = {}  # topic_id -> {topic_title, topic_number, unit_title, unit_number}
        for unit in course.units:
            for topic in unit.topics:
                topic_map[topic.id] = {
                    "topic_title": topic.title,
                    "topic_number": topic.topic_number,
                    "unit_title": unit.title,
                    "unit_number": unit.unit_number,
                }

        # Get assessments for this user in this course
        assessments = (
            db.query(TopicAssessment)
            .filter(
                TopicAssessment.user_id == user_id,
                TopicAssessment.topic_id.in_(list(topic_map.keys())),
            )
            .all()
        )

        assessment_map = {a.topic_id: a.id for a in assessments}

        if not assessment_map:
            return {"mistakes": {}, "total_mistakes": 0}

        # Get wrong answers across all assessments
        wrong_answers = (
            db.query(AssessmentAnswer)
            .filter(
                AssessmentAnswer.assessment_id.in_(list(assessment_map.values())),
                AssessmentAnswer.is_correct == False,  # noqa: E712
            )
            .order_by(AssessmentAnswer.created_at.desc())
            .limit(limit)
            .all()
        )

        # Build reverse map: assessment_id -> topic_id
        assessment_to_topic = {v: k for k, v in assessment_map.items()}

        # Group by topic
        mistakes_by_topic: dict = {}
        for ans in wrong_answers:
            topic_id = assessment_to_topic.get(ans.assessment_id)
            if not topic_id or topic_id not in topic_map:
                continue

            if topic_id not in mistakes_by_topic:
                info = topic_map[topic_id]
                mistakes_by_topic[topic_id] = {
                    "topic_title": info["topic_title"],
                    "topic_number": info["topic_number"],
                    "unit_title": info["unit_title"],
                    "unit_number": info["unit_number"],
                    "mistakes": [],
                }

            mistakes_by_topic[topic_id]["mistakes"].append({
                "question_text": ans.question_text,
                "student_answer": ans.student_answer,
                "correct_answer": ans.correct_answer,
                "explanation": ans.explanation,
                "question_type": ans.question_type,
                "question_category": ans.question_category,
                "created_at": ans.created_at.isoformat() if ans.created_at else None,
            })

        return {
            "mistakes": mistakes_by_topic,
            "total_mistakes": len(wrong_answers),
        }
    finally:
        db.close()


@router.delete("/{course_id}/topics/{topic_id}/progress")
async def reset_topic_progress(course_id: str, topic_id: str, request: Request):
    """Reset progress for a single topic (deletes assessment, answers, dimensions)."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        # Delete proficiency dimensions
        db.query(ProficiencyDimension).filter(
            ProficiencyDimension.user_id == user_id,
            ProficiencyDimension.topic_id == topic_id,
        ).delete()

        # Delete assessment (cascades to answers)
        db.query(TopicAssessment).filter(
            TopicAssessment.user_id == user_id,
            TopicAssessment.topic_id == topic_id,
        ).delete()

        db.commit()
        return {"success": True, "reset": "topic", "topic_id": topic_id}
    finally:
        db.close()


@router.delete("/{course_id}/units/{unit_id}/progress")
async def reset_unit_progress(course_id: str, unit_id: str, request: Request):
    """Reset progress for all topics in a unit."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        unit = db.query(Unit).filter(Unit.id == unit_id).first()
        if not unit or unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Unit not found")

        topic_ids = [t.id for t in unit.topics]
        if not topic_ids:
            return {"success": True, "reset": "unit", "topics_reset": 0}

        db.query(ProficiencyDimension).filter(
            ProficiencyDimension.user_id == user_id,
            ProficiencyDimension.topic_id.in_(topic_ids),
        ).delete(synchronize_session=False)

        db.query(TopicAssessment).filter(
            TopicAssessment.user_id == user_id,
            TopicAssessment.topic_id.in_(topic_ids),
        ).delete(synchronize_session=False)

        db.commit()
        return {"success": True, "reset": "unit", "topics_reset": len(topic_ids)}
    finally:
        db.close()


@router.delete("/{course_id}/progress")
async def reset_course_progress(course_id: str, request: Request):
    """Reset progress for all topics in a course."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        topic_ids = []
        for unit in course.units:
            for topic in unit.topics:
                topic_ids.append(topic.id)

        if not topic_ids:
            return {"success": True, "reset": "course", "topics_reset": 0}

        db.query(ProficiencyDimension).filter(
            ProficiencyDimension.user_id == user_id,
            ProficiencyDimension.topic_id.in_(topic_ids),
        ).delete(synchronize_session=False)

        db.query(TopicAssessment).filter(
            TopicAssessment.user_id == user_id,
            TopicAssessment.topic_id.in_(topic_ids),
        ).delete(synchronize_session=False)

        db.commit()
        return {"success": True, "reset": "course", "topics_reset": len(topic_ids)}
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

        # Check if user has uploaded materials for this course
        user_kb_name = None
        upload_context = ""
        if body.use_uploads:
            user_kb_name = _get_user_kb_name(user["user_id"], course.code)

        agent = TutorAgent(
            course_code=course.code,
            course_name=course.name,
            language="en",
            config=config,
            api_key=api_key,
            base_url=base_url,
            api_version=api_version,
            user_kb_name=user_kb_name,
        )

        # If using uploads, retrieve context from user materials
        if user_kb_name:
            try:
                ctx, _ = await agent.retrieve_context(
                    f"{topic.title} {unit.title} practice questions"
                )
                if ctx:
                    upload_context = (
                        f"\n\n**Use the following study material as additional context "
                        f"for generating questions:**\n{ctx[:3000]}\n"
                    )
            except Exception:
                pass

        fmt = {
            "topic_title": topic.title,
            "topic_number": topic.topic_number,
            "unit_number": unit.unit_number,
            "unit_title": unit.title,
            "course_name": course.name,
        }

        async def _generate(prompt: str) -> str:
            result = await agent.process(
                message=prompt + upload_context,
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
            "CRITICAL ACCURACY RULES:\n"
            "- For code questions: mentally execute EVERY line before choosing an answer.\n"
            "- You MUST fill in the 'reasoning' field BEFORE the 'correct' field.\n"
            "- Your 'correct' answer MUST match your conclusion in 'reasoning'.\n"
            "- They must NEVER contradict each other. After writing your reasoning, "
            "re-read it and confirm 'correct' matches your conclusion.\n\n"
            "You MUST respond in EXACTLY this JSON format (fields in this order, no markdown, no extra text):\n"
            '{{\n'
            '  "question": "The question text here. For code, use ```java\\ncode\\n``` blocks.",\n'
            '  "options": {{\n'
            '    "A": "First option",\n'
            '    "B": "Second option",\n'
            '    "C": "Third option",\n'
            '    "D": "Fourth option"\n'
            '  }},\n'
            '  "reasoning": "Step-by-step trace. For code: simulate each line and track every variable value. '
            'End with: Therefore the answer is X because ...",\n'
            '  "correct": "X",\n'
            '  "explanation": "Why X is correct and why each other option is wrong.",\n'
            '  "category": "The AP CSA concept category tested, e.g. Methods, ArrayList, 2D Array, Recursion, Inheritance"\n'
            '}}\n'
            + difficulty_hint + avoid_hint
        )

        async def _verify_assessment_mcq(parsed: dict) -> dict:
            """Verification pass for code-based MCQs to catch answer/explanation contradictions."""
            question_text = parsed.get("question", "")
            if "```" not in question_text and "arr" not in question_text and "int " not in question_text:
                return parsed  # Not a code question
            try:
                from src.api.routers.exam import _MCQ_VERIFY_PROMPT, _parse_json_response as _exam_parse
                options_str = "\n".join(f"  {k}: {v}" for k, v in parsed.get("options", {}).items())
                verify_prompt = _MCQ_VERIFY_PROMPT.format(
                    question=question_text,
                    options=options_str,
                    correct=parsed.get("correct", "?"),
                    reasoning=parsed.get("reasoning", parsed.get("explanation", "")),
                    explanation=parsed.get("explanation", ""),
                )
                result = await agent.process(
                    message=verify_prompt, history=[],
                    topic_title=topic.title, unit_title=unit.title,
                    unit_number=unit.unit_number, stream=False,
                )
                raw_v = result.get("response", "")
                verified = _parse_json_response(raw_v)
                if verified and "correct" in verified and not verified.get("verified", True):
                    logger.warning(f"Assessment MCQ answer corrected: {parsed.get('correct')} → {verified['correct']}")
                    parsed["correct"] = verified["correct"]
                    parsed["explanation"] = verified.get("explanation", parsed.get("explanation", ""))
            except Exception as e:
                logger.warning(f"Assessment MCQ verification failed: {e}")
            return parsed

        questions = []
        for i in range(body.count):
            variation = ""
            if i > 0:
                variation = f"\n\nThis is question {i+1} of {body.count}. Make it test a DIFFERENT aspect than the previous questions."

            logger.info(f"Generating additional MCQ {i+1}/{body.count} for {topic.topic_number}...")
            raw = await _generate(mcq_prompt.format(**fmt) + variation)
            parsed = _parse_json_response(raw)
            if parsed and all(k in parsed for k in ("question", "options", "correct", "explanation")):
                # Verification pass for code questions
                parsed = await _verify_assessment_mcq(parsed)
                questions.append(parsed)
            else:
                logger.warning(f"Additional MCQ {i+1} not valid JSON")
                questions.append({"raw_text": raw})
            try:
                from src.api.middleware.llm_tracking import log_llm_usage
                log_llm_usage(user_id=user["user_id"], endpoint="assessment", response_text=raw)
            except Exception:
                pass

        return {"questions": questions, "count": len(questions)}
    finally:
        db.close()

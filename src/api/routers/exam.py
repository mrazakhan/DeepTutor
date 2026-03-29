"""Mock AP Exam API endpoints.

Generates timed mock exams with fresh questions, handles answer submission,
auto-grades MCQs, and triggers LLM evaluation for FRQs.
"""

import asyncio
import json
import random
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func

from src.database.engine import get_db, init_db
from src.database.models import (
    Course,
    ExamQuestion,
    MockExam,
    Topic,
    TopicContent,
    Unit,
)
from src.logging import get_logger

router = APIRouter()
init_db()
logger = get_logger("ExamAPI")


def _get_current_user(request: Request) -> dict | None:
    from src.api.routers.auth import _get_current_user
    return _get_current_user(request)


def _require_user(request: Request) -> dict:
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def _parse_json_response(raw: str) -> dict | None:
    """Try to parse JSON from LLM response, stripping markdown fences."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        text = text.rsplit("```", 1)[0].strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object in text
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                return None
    return None


def _get_tutor_agent(course):
    """Create a TutorAgent instance for question generation."""
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

    return TutorAgent(
        course_code=course.code,
        course_name=course.name,
        language="en",
        config=config,
        api_key=api_key,
        base_url=base_url,
        api_version=api_version,
    )


# ── Prompts ──────────────────────────────────────────────────────────

_EXAM_MCQ_PROMPT = """Generate a single AP exam-level multiple choice question for {course_name}.

Topic: {topic_title} (Unit {unit_number}: {unit_title})

Here is an example of the style and difficulty expected:
{example_mcq}

Now generate a DIFFERENT question on the same topic at AP exam difficulty.
The question must be completely new — not a rephrasing of the example.

Return ONLY valid JSON (no markdown fences):
{{
  "question": "The question text with any code in ```java\\ncode\\n``` blocks",
  "options": {{"A": "first option", "B": "second option", "C": "third option", "D": "fourth option"}},
  "correct": "B",
  "explanation": "Step-by-step explanation of why the correct answer is right"
}}"""

_EXAM_FRQ_PROMPT = """Generate a single AP {course_name} Free Response Question.

FRQ Type: {frq_type}
The question should be at the same difficulty level as a real AP exam FRQ.
It should test concepts from across the course curriculum.

Requirements:
- Multi-part question (typically 2-3 parts: a, b, and optionally c)
- Include a class/method skeleton with clear specifications
- Each part should build on previous parts
- Include realistic context (school system, game, inventory, etc.)

Return ONLY valid JSON (no markdown fences):
{{
  "question": "The full FRQ question text with code blocks in ```java\\ncode\\n``` format",
  "frq_type": "{frq_type}",
  "sample_solution": "Complete Java code solution with comments",
  "rubric": "Detailed rubric with point values for each part (9 points total)",
  "explanation": "Step-by-step explanation of the solution approach"
}}"""


class GenerateExamRequest(BaseModel):
    mcq_count: int | None = None  # Override default from exam_format
    frq_count: int | None = None
    exam_type: str = "practice"  # "practice" or "final"


class AnswerRequest(BaseModel):
    question_id: str
    answer: str


class SubmitExamRequest(BaseModel):
    section_index: int | None = None  # Submit specific section, or None for all


# ── Endpoints ────────────────────────────────────────────────────────


@router.post("/{course_id}/exams/generate")
async def generate_exam(course_id: str, request: Request, body: GenerateExamRequest | None = None):
    """Generate a new mock exam with fresh questions."""
    user = _require_user(request)
    exam_type = (body.exam_type if body else "practice") or "practice"

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Final exams: only admins can generate, check if one already exists
        if exam_type == "final":
            if user.get("role") != "admin":
                raise HTTPException(status_code=403, detail="Only admins can generate final exams")
            existing_final = (
                db.query(MockExam)
                .filter(MockExam.course_id == course_id, MockExam.exam_type == "final",
                        MockExam.shared_exam_id.is_(None))
                .first()
            )
            if existing_final:
                raise HTTPException(status_code=409, detail="Final exam already exists for this course")

        # Parse exam format
        exam_format = json.loads(course.exam_format) if course.exam_format else None
        if not exam_format or not exam_format.get("sections"):
            raise HTTPException(status_code=400, detail="Course has no exam format defined")

        sections = exam_format["sections"]
        frq_types = exam_format.get("frq_types", [])
        unit_weights = exam_format.get("unit_weights", {})
        total_minutes = sum(s.get("minutes", 0) for s in sections)

        # Determine question counts
        mcq_sections = [s for s in sections if "multiple" in s.get("name", "").lower() or "mcq" in s.get("name", "").lower()]
        frq_sections = [s for s in sections if "free response" in s.get("name", "").lower() or "frq" in s.get("name", "").lower()]

        total_mcq = body.mcq_count if body and body.mcq_count else sum(s.get("count", 0) for s in mcq_sections)
        total_frq = body.frq_count if body and body.frq_count else sum(s.get("count", 0) for s in frq_sections)

        # Build section metadata
        exam_sections = []
        for i, s in enumerate(sections):
            is_mcq = "multiple" in s.get("name", "").lower() or "mcq" in s.get("name", "").lower()
            exam_sections.append({
                "name": s["name"],
                "type": "mcq" if is_mcq else "frq",
                "count": s.get("count", 0),
                "minutes": s.get("minutes", 0),
                "calculator": s.get("calculator", False),
            })

        # Create exam record
        exam = MockExam(
            user_id=user["user_id"],
            course_id=course_id,
            exam_type=exam_type,
            status="generating",
            time_limit_minutes=total_minutes,
            sections=json.dumps(exam_sections),
        )
        db.add(exam)
        db.commit()
        exam_id = exam.id

        # Get all topics with preloaded content, grouped by unit
        topics_by_unit: dict[int, list] = {}
        for unit in course.units:
            unit_topics = []
            for topic in unit.topics:
                tc = db.query(TopicContent).filter(TopicContent.topic_id == topic.id).first()
                if tc:
                    content = json.loads(tc.content)
                    unit_topics.append({
                        "topic": topic,
                        "unit": unit,
                        "mcqs": content.get("practice_mcq", []),
                        "frqs": content.get("practice_frq", []),
                    })
            if unit_topics:
                topics_by_unit[unit.unit_number] = unit_topics

        db.close()

        # Generate questions in background
        asyncio.create_task(_generate_exam_questions(
            exam_id, course, topics_by_unit, exam_sections,
            total_mcq, total_frq, frq_types, unit_weights, exam_format
        ))

        return {
            "exam_id": exam_id,
            "status": "generating",
            "exam_type": exam_type,
            "total_mcq": total_mcq,
            "total_frq": total_frq,
            "total_minutes": total_minutes,
            "sections": exam_sections,
        }

    finally:
        db.close()


@router.post("/{course_id}/exams/start-final")
async def start_final_exam(course_id: str, request: Request):
    """Start the final exam for a student — copies questions from the admin template."""
    user = _require_user(request)

    db = get_db()
    try:
        # Find the shared final exam template
        template = (
            db.query(MockExam)
            .filter(MockExam.course_id == course_id, MockExam.exam_type == "final",
                    MockExam.shared_exam_id.is_(None),
                    MockExam.status.in_(["ready", "completed"]))
            .first()
        )
        if not template:
            raise HTTPException(status_code=404, detail="No final exam available for this course")

        # Check if student already has a final attempt
        existing = (
            db.query(MockExam)
            .filter(MockExam.user_id == user["user_id"], MockExam.course_id == course_id,
                    MockExam.exam_type == "final", MockExam.shared_exam_id == template.id)
            .first()
        )
        if existing:
            return {"exam_id": existing.id, "status": existing.status, "already_exists": True}

        # Create student's personal copy
        student_exam = MockExam(
            user_id=user["user_id"],
            course_id=course_id,
            exam_type="final",
            shared_exam_id=template.id,
            status="ready",
            time_limit_minutes=template.time_limit_minutes,
            sections=template.sections,
        )
        db.add(student_exam)
        db.flush()

        # Copy all questions with randomized order within each section
        # Group by section, shuffle within each, reassign question_index
        from collections import defaultdict
        section_qs: dict[int, list] = defaultdict(list)
        for q in template.questions:
            section_qs[q.section_index].append(q)

        for sec_idx, qs in section_qs.items():
            shuffled = list(qs)
            random.shuffle(shuffled)
            for new_idx, q in enumerate(shuffled):
                # For MCQs, also randomize answer option order
                qdata = json.loads(q.question_data)
                if q.question_type == "mcq" and "options" in qdata:
                    opts = list(qdata["options"].items())
                    random.shuffle(opts)
                    new_letters = ["A", "B", "C", "D"]
                    old_correct = qdata.get("correct", "")
                    new_options = {}
                    new_correct = old_correct
                    for i, (old_letter, text) in enumerate(opts):
                        new_options[new_letters[i]] = text
                        if old_letter == old_correct:
                            new_correct = new_letters[i]
                    qdata["options"] = new_options
                    qdata["correct"] = new_correct

                copy = ExamQuestion(
                    exam_id=student_exam.id,
                    section_index=sec_idx,
                    question_index=new_idx,
                    question_type=q.question_type,
                    question_data=json.dumps(qdata),
                    max_score=q.max_score,
                )
                db.add(copy)

        db.commit()
        return {"exam_id": student_exam.id, "status": "ready", "already_exists": False}
    finally:
        db.close()


@router.get("/{course_id}/exams/final-status")
async def final_exam_status(course_id: str, request: Request):
    """Check if a final exam exists and student's attempt status."""
    user = _require_user(request)

    db = get_db()
    try:
        template = (
            db.query(MockExam)
            .filter(MockExam.course_id == course_id, MockExam.exam_type == "final",
                    MockExam.shared_exam_id.is_(None))
            .first()
        )
        if not template:
            return {"available": False}

        student_attempt = (
            db.query(MockExam)
            .filter(MockExam.user_id == user["user_id"], MockExam.shared_exam_id == template.id)
            .first()
        )

        return {
            "available": template.status in ("ready", "completed"),
            "template_status": template.status,
            "student_attempt": {
                "exam_id": student_attempt.id,
                "status": student_attempt.status,
                "total_score": student_attempt.total_score,
                "ap_score": getattr(student_attempt, "ap_score", None),
            } if student_attempt else None,
        }
    finally:
        db.close()


async def _generate_exam_questions(
    exam_id: str, course, topics_by_unit: dict,
    sections: list, total_mcq: int, total_frq: int, frq_types: list,
    unit_weights: dict | None = None, exam_format: dict | None = None,
):
    """Background task: generate exam questions via LLM."""
    db = get_db()
    try:
        agent = _get_tutor_agent(course)

        async def _gen(prompt: str, topic_title: str, unit_title: str, unit_number: int) -> str:
            result = await agent.process(
                message=prompt, history=[],
                topic_title=topic_title, unit_title=unit_title,
                unit_number=unit_number, stream=False,
            )
            return result.get("response", "")

        questions = []
        all_topics = []
        for unit_topics in topics_by_unit.values():
            all_topics.extend(unit_topics)

        # ── Generate MCQs ──
        if all_topics and total_mcq > 0:
            # Build topic list with unit-weighted distribution
            topics_per_q = []
            if unit_weights and topics_by_unit:
                # Weighted distribution: allocate MCQs per unit based on official weights
                for unit_num_str, weight in unit_weights.items():
                    unit_num = int(unit_num_str)
                    unit_topics = topics_by_unit.get(unit_num, [])
                    if not unit_topics:
                        continue
                    # Use midpoint of min/max range
                    pct = (weight["min"] + weight["max"]) / 2 / 100
                    n_questions = max(1, round(total_mcq * pct))
                    # Pick topics from this unit, cycling if needed
                    for i in range(n_questions):
                        topics_per_q.append(random.choice(unit_topics))
                # Trim or pad to exact count
                random.shuffle(topics_per_q)
                if len(topics_per_q) > total_mcq:
                    topics_per_q = topics_per_q[:total_mcq]
                while len(topics_per_q) < total_mcq:
                    topics_per_q.append(random.choice(all_topics))
            else:
                # Fallback: uniform distribution across all topics
                while len(topics_per_q) < total_mcq:
                    batch = list(all_topics)
                    random.shuffle(batch)
                    topics_per_q.extend(batch)
                topics_per_q = topics_per_q[:total_mcq]

            # Find which section index is MCQ
            mcq_section_idx = next((i for i, s in enumerate(sections) if s["type"] == "mcq"), 0)

            for qi, tc in enumerate(topics_per_q):
                topic = tc["topic"]
                unit = tc["unit"]
                example_mcqs = [m for m in tc["mcqs"] if not m.get("raw_text")]
                example = json.dumps(random.choice(example_mcqs), indent=2) if example_mcqs else "{}"

                prompt = _EXAM_MCQ_PROMPT.format(
                    course_name=course.name,
                    topic_title=topic.title,
                    unit_number=unit.unit_number,
                    unit_title=unit.title,
                    example_mcq=example,
                )

                try:
                    raw = await _gen(prompt, topic.title, unit.title, unit.unit_number)
                    parsed = _parse_json_response(raw)
                    if parsed and all(k in parsed for k in ("question", "options", "correct")):
                        questions.append(ExamQuestion(
                            exam_id=exam_id,
                            section_index=mcq_section_idx,
                            question_index=qi,
                            question_type="mcq",
                            question_data=json.dumps(parsed),
                            max_score=1.0,
                        ))
                        logger.info(f"Exam {exam_id}: MCQ {qi+1}/{total_mcq} generated")
                    else:
                        logger.warning(f"Exam {exam_id}: MCQ {qi+1} invalid JSON")
                    try:
                        from src.api.middleware.llm_tracking import log_llm_usage
                        log_llm_usage(user_id=None, endpoint="exam", response_text=raw)
                    except Exception:
                        pass
                except Exception as e:
                    logger.error(f"Exam {exam_id}: MCQ {qi+1} error: {e}")

        # ── Generate FRQs ──
        if total_frq > 0:
            frq_section_idx = next((i for i, s in enumerate(sections) if s["type"] == "frq"), len(sections) - 1)
            frq_type_list = frq_types[:total_frq] if frq_types else ["General"] * total_frq

            for qi, frq_type in enumerate(frq_type_list):
                prompt = _EXAM_FRQ_PROMPT.format(
                    course_name=course.name,
                    frq_type=frq_type,
                )

                try:
                    raw = await _gen(prompt, frq_type, "Full Course", 0)
                    parsed = _parse_json_response(raw)
                    if parsed and "question" in parsed:
                        parsed.setdefault("rubric", "")
                        parsed.setdefault("sample_solution", "")
                        questions.append(ExamQuestion(
                            exam_id=exam_id,
                            section_index=frq_section_idx,
                            question_index=qi,
                            question_type="frq",
                            question_data=json.dumps(parsed),
                            max_score=9.0,
                        ))
                        logger.info(f"Exam {exam_id}: FRQ {qi+1}/{total_frq} generated ({frq_type})")
                    else:
                        logger.warning(f"Exam {exam_id}: FRQ {qi+1} invalid JSON")
                    try:
                        from src.api.middleware.llm_tracking import log_llm_usage
                        log_llm_usage(user_id=None, endpoint="exam", response_text=raw)
                    except Exception:
                        pass
                except Exception as e:
                    logger.error(f"Exam {exam_id}: FRQ {qi+1} error: {e}")

        # Save all questions and mark exam as ready
        db.add_all(questions)
        exam = db.query(MockExam).filter(MockExam.id == exam_id).first()
        if exam:
            exam.status = "ready"
        db.commit()
        logger.info(f"Exam {exam_id}: ready with {len(questions)} questions")

    except Exception as e:
        logger.error(f"Exam {exam_id}: generation failed: {e}")
        exam = db.query(MockExam).filter(MockExam.id == exam_id).first()
        if exam:
            exam.status = "ready"  # Allow partial exam
        db.commit()
    finally:
        db.close()


@router.get("/{course_id}/exams")
async def list_exams(course_id: str, request: Request):
    """List user's mock exams for a course."""
    user = _require_user(request)
    db = get_db()
    try:
        exams = (
            db.query(MockExam)
            .filter(MockExam.user_id == user["user_id"], MockExam.course_id == course_id)
            .order_by(MockExam.created_at.desc())
            .all()
        )
        return [
            {
                "id": e.id,
                "status": e.status,
                "created_at": e.created_at.isoformat() if e.created_at else None,
                "started_at": e.started_at.isoformat() if e.started_at else None,
                "completed_at": e.completed_at.isoformat() if e.completed_at else None,
                "time_limit_minutes": e.time_limit_minutes,
                "total_score": e.total_score,
                "ap_score": getattr(e, "ap_score", None),
                "exam_type": getattr(e, "exam_type", "practice"),
                "mcq_score": e.mcq_score,
                "frq_score": e.frq_score,
                "sections": json.loads(e.sections) if e.sections else [],
                "question_count": len(e.questions),
            }
            for e in exams
        ]
    finally:
        db.close()


@router.get("/{course_id}/exams/{exam_id}")
async def get_exam(course_id: str, exam_id: str, request: Request):
    """Get exam state with questions and answers."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        # Calculate time remaining
        time_remaining = None
        if exam.status == "in_progress" and exam.started_at:
            elapsed = (datetime.now(timezone.utc) - exam.started_at.replace(tzinfo=timezone.utc)).total_seconds()
            # Use current section's time limit
            sections = json.loads(exam.sections) if exam.sections else []
            section_minutes = sections[exam.current_section]["minutes"] if exam.current_section < len(sections) else exam.time_limit_minutes
            # Calculate section start time (sum of previous sections' minutes)
            prev_minutes = sum(s["minutes"] for s in sections[:exam.current_section])
            section_elapsed = elapsed - (prev_minutes * 60)
            time_remaining = max(0, (section_minutes * 60) - section_elapsed)

        questions = []
        for q in exam.questions:
            qdata = json.loads(q.question_data)
            # Don't reveal correct answer or solution until exam is completed
            if exam.status not in ("completed", "timed_out"):
                qdata.pop("correct", None)
                qdata.pop("explanation", None)
                qdata.pop("sample_solution", None)
                qdata.pop("rubric", None)
            questions.append({
                "id": q.id,
                "section_index": q.section_index,
                "question_index": q.question_index,
                "question_type": q.question_type,
                "question_data": qdata,
                "student_answer": q.student_answer,
                "is_correct": q.is_correct if exam.status in ("completed", "timed_out") else None,
                "score": q.score if exam.status in ("completed", "timed_out") else None,
                "max_score": q.max_score,
                "evaluation": json.loads(q.evaluation) if q.evaluation and exam.status in ("completed", "timed_out") else None,
                "flagged": q.flagged,
                "answered": q.student_answer is not None,
            })

        return {
            "id": exam.id,
            "status": exam.status,
            "current_section": exam.current_section,
            "sections": json.loads(exam.sections) if exam.sections else [],
            "time_remaining_seconds": time_remaining,
            "started_at": exam.started_at.isoformat() if exam.started_at else None,
            "questions": questions,
            "mcq_score": exam.mcq_score,
            "frq_score": exam.frq_score,
            "total_score": exam.total_score,
            "ap_score": getattr(exam, "ap_score", None),
            "exam_type": getattr(exam, "exam_type", "practice"),
        }
    finally:
        db.close()


@router.post("/{course_id}/exams/{exam_id}/start")
async def start_exam(course_id: str, exam_id: str, request: Request):
    """Start the exam timer."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.status not in ("ready",):
            raise HTTPException(status_code=400, detail=f"Cannot start exam in '{exam.status}' state")

        exam.status = "in_progress"
        exam.started_at = datetime.now(timezone.utc)
        exam.current_section = 0
        db.commit()

        return {"status": "in_progress", "started_at": exam.started_at.isoformat()}
    finally:
        db.close()


@router.post("/{course_id}/exams/{exam_id}/answer")
async def save_answer(course_id: str, exam_id: str, body: AnswerRequest, request: Request):
    """Save an answer for a question (no grading yet)."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.status != "in_progress":
            raise HTTPException(status_code=400, detail="Exam is not in progress")

        question = db.query(ExamQuestion).filter(
            ExamQuestion.id == body.question_id,
            ExamQuestion.exam_id == exam_id,
        ).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")

        question.student_answer = body.answer
        question.answered_at = datetime.now(timezone.utc)
        db.commit()

        return {"saved": True}
    finally:
        db.close()


@router.post("/{course_id}/exams/{exam_id}/flag")
async def toggle_flag(course_id: str, exam_id: str, body: AnswerRequest, request: Request):
    """Toggle flag on a question."""
    user = _require_user(request)
    db = get_db()
    try:
        question = db.query(ExamQuestion).filter(
            ExamQuestion.id == body.question_id,
            ExamQuestion.exam_id == exam_id,
        ).first()
        if not question:
            raise HTTPException(status_code=404, detail="Question not found")
        question.flagged = not question.flagged
        db.commit()
        return {"flagged": question.flagged}
    finally:
        db.close()


@router.post("/{course_id}/exams/{exam_id}/next-section")
async def next_section(course_id: str, exam_id: str, request: Request):
    """Move to the next section of the exam."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")

        sections = json.loads(exam.sections) if exam.sections else []
        if exam.current_section + 1 >= len(sections):
            raise HTTPException(status_code=400, detail="No more sections")

        # Auto-grade MCQs for the completed section
        completed_section = sections[exam.current_section]
        if completed_section["type"] == "mcq":
            _grade_mcq_section(db, exam_id, exam.current_section)

        exam.current_section += 1
        db.commit()

        return {"current_section": exam.current_section}
    finally:
        db.close()


def _grade_mcq_section(db, exam_id: str, section_index: int):
    """Grade all MCQ questions in a section."""
    questions = (
        db.query(ExamQuestion)
        .filter(ExamQuestion.exam_id == exam_id, ExamQuestion.section_index == section_index,
                ExamQuestion.question_type == "mcq")
        .all()
    )
    for q in questions:
        qdata = json.loads(q.question_data)
        correct = qdata.get("correct", "")
        q.is_correct = q.student_answer == correct
        q.score = 1.0 if q.is_correct else 0.0


@router.post("/{course_id}/exams/{exam_id}/submit")
async def submit_exam(course_id: str, exam_id: str, request: Request):
    """Submit the entire exam for grading."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.status not in ("in_progress",):
            raise HTTPException(status_code=400, detail="Exam is not in progress")

        sections = json.loads(exam.sections) if exam.sections else []

        # Grade all MCQ sections
        for i, s in enumerate(sections):
            if s["type"] == "mcq":
                _grade_mcq_section(db, exam_id, i)

        # Calculate MCQ score
        mcq_questions = (
            db.query(ExamQuestion)
            .filter(ExamQuestion.exam_id == exam_id, ExamQuestion.question_type == "mcq")
            .all()
        )
        mcq_correct = sum(1 for q in mcq_questions if q.is_correct)
        mcq_total = len(mcq_questions)
        exam.mcq_score = round((mcq_correct / mcq_total * 100) if mcq_total else 0, 1)

        exam.status = "completed"
        exam.completed_at = datetime.now(timezone.utc)
        db.commit()

        exam_id_copy = exam.id
        course_obj = exam.course
        db.close()

        # Evaluate FRQs in background
        frq_questions = [q for q in mcq_questions if False]  # need fresh query
        db2 = get_db()
        frq_qs = (
            db2.query(ExamQuestion)
            .filter(ExamQuestion.exam_id == exam_id_copy, ExamQuestion.question_type == "frq",
                    ExamQuestion.student_answer.isnot(None))
            .all()
        )
        frq_ids = [q.id for q in frq_qs]
        db2.close()

        if frq_ids:
            asyncio.create_task(_evaluate_frqs(exam_id_copy, frq_ids, course_obj))

        return {
            "status": "completed",
            "mcq_score": exam.mcq_score,
            "mcq_correct": mcq_correct,
            "mcq_total": mcq_total,
            "frq_evaluating": len(frq_ids),
        }
    finally:
        try:
            db.close()
        except Exception:
            pass


async def _evaluate_frqs(exam_id: str, frq_question_ids: list, course):
    """Background task: evaluate FRQ answers via LLM."""
    db = get_db()
    try:
        agent = _get_tutor_agent(course)

        for qid in frq_question_ids:
            q = db.query(ExamQuestion).filter(ExamQuestion.id == qid).first()
            if not q or not q.student_answer:
                continue

            qdata = json.loads(q.question_data)
            rubric = qdata.get("rubric", "Standard AP FRQ rubric (9 points)")

            # Check if answer is a handwritten drawing
            image_data = None
            if q.student_answer.startswith("[DRAWING]"):
                image_data = q.student_answer[len("[DRAWING]"):]
                eval_prompt = (
                    f"Evaluate this AP {course.name} FRQ submission.\n\n"
                    f"**Question:**\n{qdata['question']}\n\n"
                    f"The student's handwritten answer is shown in the attached image. "
                    f"Please read and evaluate their handwritten response.\n\n"
                    f"**Rubric:**\n{rubric}\n\n"
                    f"Score each rubric point with ✅ or ❌.\n"
                    f"End with **Score: X/9** where X is the total points earned.\n"
                    f"Return JSON: {{\"score\": X, \"max_score\": 9, \"feedback\": \"detailed evaluation\"}}"
                )
            else:
                eval_prompt = (
                    f"Evaluate this AP {course.name} FRQ submission.\n\n"
                    f"**Question:**\n{qdata['question']}\n\n"
                    f"**Student Code:**\n```java\n{q.student_answer}\n```\n\n"
                    f"**Rubric:**\n{rubric}\n\n"
                    f"Score each rubric point with ✅ or ❌.\n"
                    f"End with **Score: X/9** where X is the total points earned.\n"
                    f"Return JSON: {{\"score\": X, \"max_score\": 9, \"feedback\": \"detailed evaluation\"}}"
                )

            try:
                result = await agent.process(
                    message=eval_prompt, history=[], stream=False,
                    topic_title="FRQ Evaluation", unit_title="Mock Exam",
                    unit_number=0,
                    image_data=image_data,
                )
                response = result.get("response", "")
                parsed = _parse_json_response(response)

                if parsed and "score" in parsed:
                    q.score = float(parsed["score"])
                    q.max_score = float(parsed.get("max_score", 9))
                    q.evaluation = json.dumps(parsed)
                else:
                    # Try to extract score from text
                    import re
                    score_match = re.search(r"Score:\s*(\d+)/(\d+)", response)
                    if score_match:
                        q.score = float(score_match.group(1))
                        q.max_score = float(score_match.group(2))
                    q.evaluation = json.dumps({"feedback": response, "score": q.score, "max_score": q.max_score})

                q.is_correct = q.score and q.score > 0
                logger.info(f"Exam {exam_id}: FRQ {qid} scored {q.score}/{q.max_score}")
                try:
                    from src.api.middleware.llm_tracking import log_llm_usage
                    log_llm_usage(user_id=None, endpoint="exam", response_text=response)
                except Exception:
                    pass

            except Exception as e:
                logger.error(f"Exam {exam_id}: FRQ eval error: {e}")
                q.evaluation = json.dumps({"feedback": f"Evaluation error: {e}", "score": 0})

            db.commit()

        # Update exam FRQ and total scores
        exam = db.query(MockExam).filter(MockExam.id == exam_id).first()
        if exam:
            frq_qs = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.exam_id == exam_id, ExamQuestion.question_type == "frq")
                .all()
            )
            if frq_qs:
                frq_earned = sum(q.score or 0 for q in frq_qs)
                frq_max = sum(q.max_score for q in frq_qs)
                exam.frq_score = round((frq_earned / frq_max * 100) if frq_max else 0, 1)

            # Total score — use dynamic weights from exam_format
            if exam.mcq_score is not None:
                frq_pct = exam.frq_score or 0
                try:
                    course_obj = db.query(Course).filter(Course.id == exam.course_id).first()
                    ef = json.loads(course_obj.exam_format) if course_obj and course_obj.exam_format else {}
                    weight = ef.get("weight", {"mcq": 55, "frq": 45})
                    mcq_w = weight.get("mcq", 55) / 100
                    frq_w = weight.get("frq", 45) / 100
                    score_cutoffs = ef.get("score_cutoffs", {"5": 77, "4": 59, "3": 46, "2": 33})
                except Exception:
                    mcq_w, frq_w = 0.55, 0.45
                    score_cutoffs = {"5": 77, "4": 59, "3": 46, "2": 33}

                exam.total_score = round(exam.mcq_score * mcq_w + frq_pct * frq_w, 1)

                # Calculate AP score (1-5)
                total = exam.total_score
                ap = 1
                for s_str in ["5", "4", "3", "2"]:
                    if total >= score_cutoffs.get(s_str, 100):
                        ap = int(s_str)
                        break
                exam.ap_score = ap

            db.commit()

    finally:
        db.close()


@router.get("/{course_id}/exams/{exam_id}/results")
async def get_results(course_id: str, exam_id: str, request: Request):
    """Get detailed exam results."""
    user = _require_user(request)
    db = get_db()
    try:
        exam = db.query(MockExam).filter(
            MockExam.id == exam_id,
            MockExam.user_id == user["user_id"],
        ).first()
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found")
        if exam.status not in ("completed", "timed_out"):
            raise HTTPException(status_code=400, detail="Exam not yet completed")

        questions = []
        for q in exam.questions:
            qdata = json.loads(q.question_data)
            questions.append({
                "id": q.id,
                "section_index": q.section_index,
                "question_index": q.question_index,
                "question_type": q.question_type,
                "question_data": qdata,
                "student_answer": q.student_answer,
                "is_correct": q.is_correct,
                "score": q.score,
                "max_score": q.max_score,
                "evaluation": json.loads(q.evaluation) if q.evaluation else None,
            })

        return {
            "id": exam.id,
            "status": exam.status,
            "sections": json.loads(exam.sections) if exam.sections else [],
            "mcq_score": exam.mcq_score,
            "frq_score": exam.frq_score,
            "total_score": exam.total_score,
            "ap_score": getattr(exam, "ap_score", None),
            "exam_type": getattr(exam, "exam_type", "practice"),
            "started_at": exam.started_at.isoformat() if exam.started_at else None,
            "completed_at": exam.completed_at.isoformat() if exam.completed_at else None,
            "questions": questions,
        }
    finally:
        db.close()

"""AP Academy Course Catalog API router."""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import tempfile
import uuid as _uuid

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import Course, Topic, TopicContent, Unit, UserCourseFavorite


def _topic_sort_key(t):
    """Sort '4.2' before '4.10' by parsing parts as integers."""
    parts = t.topic_number.split(".")
    return tuple(int(p) for p in parts)
from src.logging import get_logger

logger = get_logger("CoursesAPI")

router = APIRouter()


class PreloadRequest(BaseModel):
    generated_by: str | None = None


class PatchContentRequest(BaseModel):
    key: str  # "intro", "exam", "mistakes"
    content: str

# Ensure tables exist on import
init_db()


@router.get("/list")
async def list_courses(subject_area: str | None = None, request: Request = None):
    """List courses visible to the current user (approved + own custom courses)."""
    from src.api.routers.auth import _get_current_user

    user = _get_current_user(request) if request else None
    user_id = user["user_id"] if user else None

    db = get_db()
    try:
        query = db.query(Course).filter(Course.is_active == True)
        if subject_area:
            query = query.filter(Course.subject_area == subject_area)
        courses = query.order_by(Course.subject_area, Course.name).all()

        # Filter: show approved courses + user's own unapproved custom courses
        visible = []
        for c in courses:
            is_approved = getattr(c, "is_approved", True)
            created_by = getattr(c, "created_by", None)
            if is_approved is None or is_approved:
                visible.append(c)
            elif user_id and created_by == user_id:
                visible.append(c)

        return [
            {
                "id": c.id,
                "code": c.code,
                "name": c.name,
                "subject_area": c.subject_area,
                "description": c.description,
                "unit_count": len(c.units),
                "topic_count": sum(len(u.topics) for u in c.units),
                "is_custom": c.code.startswith("CUSTOM_") if c.code else False,
                "is_approved": getattr(c, "is_approved", True),
            }
            for c in visible
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


# ---------- custom course from syllabus ----------


def _extract_syllabus_text(file_path: str, ext: str) -> str:
    """Extract text from uploaded syllabus file."""
    if ext == "pdf":
        import fitz
        doc = fitz.open(file_path)
        text = "\n".join(page.get_text() for page in doc)
        doc.close()
        return text.strip()
    elif ext in ("docx", "doc"):
        try:
            import docx
            doc = docx.Document(file_path)
            return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            import zipfile, re
            with zipfile.ZipFile(file_path) as z:
                xml = z.read("word/document.xml").decode("utf-8")
                text = re.sub(r"<[^>]+>", " ", xml)
                return re.sub(r"\s+", " ", text).strip()
    elif ext == "txt":
        return Path(file_path).read_text(errors="replace")
    return ""


@router.post("/parse-syllabus")
async def parse_syllabus(request: Request, file: UploadFile = File(...)):
    """Upload a syllabus PDF and parse it into a course structure using LLM."""
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    filename = file.filename or "syllabus"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx", "doc", "txt"):
        raise HTTPException(status_code=400, detail="Upload a PDF, DOCX, or TXT file.")

    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        syllabus_text = _extract_syllabus_text(tmp_path, ext)
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    if not syllabus_text or len(syllabus_text.strip()) < 50:
        raise HTTPException(status_code=400, detail="Could not extract sufficient text from the file.")

    # Use LLM to parse syllabus into structured course
    from src.services.llm.factory import stream as llm_stream
    from src.services.llm.config import get_llm_config

    parse_prompt = f"""Analyze this course syllabus and extract a structured course outline.

For each chapter/unit listed, expand it into 3-6 specific subtopics based on standard curriculum knowledge for this subject.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{{
  "name": "Course Name (e.g., Algebra 2)",
  "subject_area": "math|science|computer_science|english|history|other",
  "description": "Brief course description (2-3 sentences)",
  "units": [
    {{
      "number": 1,
      "title": "Chapter/Unit Title",
      "topics": [
        {{"num": "1.1", "title": "Specific Subtopic Title", "description": "Brief description of what this covers"}},
        {{"num": "1.2", "title": "Another Subtopic", "description": "Brief description"}}
      ]
    }}
  ]
}}

Rules:
- Extract ALL chapters/units from the syllabus
- Expand each chapter into 3-6 subtopics based on what's typically covered in this subject
- Topic numbers follow "unit.topic" format (e.g., "3.2" for unit 3, topic 2)
- Ignore administrative content (grading policies, attendance, etc.)
- Focus only on academic content and learning objectives
- subject_area must be one of: math, science, computer_science, english, history, other

=== SYLLABUS TEXT ===
{syllabus_text[:8000]}"""

    llm_config = get_llm_config()
    full_response = ""
    async for chunk in llm_stream(
        prompt=parse_prompt,
        system_prompt="You are a curriculum expert. Extract course structure from syllabi. Return only valid JSON.",
        model=llm_config.model,
        api_key=llm_config.api_key,
        base_url=llm_config.base_url,
        binding=getattr(llm_config, "binding", None),
        temperature=0.3,
        max_tokens=4096,
    ):
        full_response += chunk

    # Parse the JSON response
    try:
        # Clean up common LLM JSON issues
        cleaned = full_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Failed to parse syllabus structure. Please try again.")

    # Generate a unique course code
    short_id = str(_uuid.uuid4())[:8]
    course_name = parsed.get("name", "Custom Course")
    code_base = course_name.upper().replace(" ", "_")[:30]
    parsed["code"] = f"CUSTOM_{code_base}_{short_id}"

    # Add exam format for custom courses (MCQ + FRQ, no AP specifics)
    parsed["exam_format"] = {
        "sections": [
            {"type": "mcq", "count": 10, "time_minutes": 20},
            {"type": "frq", "count": 3, "time_minutes": 30},
        ],
        "is_custom": True,
    }

    return parsed


class CreateCustomCourseRequest(BaseModel):
    name: str
    code: str
    subject_area: str
    description: str = ""
    exam_format: dict | None = None
    units: list


@router.post("/create-custom")
async def create_custom_course(request: Request, body: CreateCustomCourseRequest):
    """Create a custom course from a parsed syllabus structure."""
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user["user_id"]

    # Ensure code starts with CUSTOM_
    code = body.code if body.code.startswith("CUSTOM_") else f"CUSTOM_{body.code}"

    db = get_db()
    try:
        # Check for duplicate code
        existing = db.query(Course).filter(Course.code == code).first()
        if existing:
            raise HTTPException(status_code=409, detail="A course with this code already exists.")

        # Create course
        course = Course(
            code=code,
            name=body.name,
            subject_area=body.subject_area,
            description=body.description,
            exam_format=json.dumps(body.exam_format) if body.exam_format else None,
            is_active=True,
            is_approved=False,
            created_by=user_id,
        )
        db.add(course)
        db.flush()  # Get course.id

        # Create units and topics
        total_topics = 0
        for unit_data in body.units:
            unit = Unit(
                course_id=course.id,
                unit_number=unit_data.get("number", 1),
                title=unit_data.get("title", ""),
                description=unit_data.get("description", ""),
            )
            db.add(unit)
            db.flush()

            for topic_data in unit_data.get("topics", []):
                topic = Topic(
                    unit_id=unit.id,
                    topic_number=str(topic_data.get("num", "")),
                    title=topic_data.get("title", ""),
                    description=topic_data.get("description", ""),
                )
                db.add(topic)
                total_topics += 1

        db.commit()

        return {
            "success": True,
            "course_id": course.id,
            "code": course.code,
            "name": course.name,
            "unit_count": len(body.units),
            "topic_count": total_topics,
            "is_approved": False,
            "message": "Course created. An admin will review and approve it.",
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create course: {str(e)}")
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
                        for t in sorted(u.topics, key=_topic_sort_key)
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
                for t in sorted(unit.topics, key=_topic_sort_key)
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

        content = json.loads(tc.content)

        # Strip FRQ content for courses without FRQ exam sections
        course = topic.unit.course
        if content.get("practice_frq") and course.exam_format:
            try:
                ef = json.loads(course.exam_format) if isinstance(course.exam_format, str) else course.exam_format
                has_frq = any(
                    "free response" in s.get("name", "").lower() or "frq" in s.get("name", "").lower()
                    for s in ef.get("sections", [])
                )
                if not has_frq:
                    del content["practice_frq"]
            except (json.JSONDecodeError, TypeError):
                pass

        return {
            "topic_id": tc.topic_id,
            "content": content,
            "golden_solutions": json.loads(tc.golden_solutions) if tc.golden_solutions else None,
            "extra_frqs": json.loads(tc.extra_frqs) if tc.extra_frqs else None,
            "generated_by": tc.generated_by,
            "created_at": tc.created_at.isoformat() if tc.created_at else None,
        }
    finally:
        db.close()


@router.patch("/{course_id}/topics/{topic_id}/content")
async def patch_topic_content(course_id: str, topic_id: str, body: PatchContentRequest):
    """Save a single content key (intro/exam/mistakes) without overwriting others."""
    ALLOWED_KEYS = {"intro", "exam", "mistakes"}
    if body.key not in ALLOWED_KEYS:
        raise HTTPException(status_code=400, detail=f"Key must be one of {ALLOWED_KEYS}")

    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic_id).first()
        if tc:
            existing = json.loads(tc.content)
            existing[body.key] = body.content
            tc.content = json.dumps(existing)
        else:
            tc = TopicContent(
                topic_id=topic_id,
                content=json.dumps({body.key: body.content}),
                generated_by="ai-cached",
            )
            db.add(tc)
        db.commit()
        return {"status": "ok", "key": body.key}
    finally:
        db.close()


# ──────────────────────────────────────────────────────
# Prompts for each content type
# ──────────────────────────────────────────────────────

_PROMPT_INTRO = (
    "You are an expert AP Computer Science tutor. Write a THOROUGH, DETAILED, LESSON-QUALITY "
    "step-by-step explanation of '{topic_title}' (Topic {topic_number}) from "
    "Unit {unit_number}: {unit_title} in {course_name}.\n\n"

    "DEPTH REQUIREMENTS — every ## section MUST contain ALL of the following:\n"
    "1. A clear conceptual explanation in 2–4 paragraphs (not just 1 sentence). "
    "Explain the WHY behind the concept, not just the WHAT.\n"
    "2. At least one annotated code example with comments explaining each line.\n"
    "3. A step-by-step trace or walkthrough showing what happens when the code runs "
    "(e.g. 'After line 3, x = 5 because ...').\n"
    "4. Common mistakes or misconceptions students have with this concept, and how to avoid them.\n"
    "5. Connection to the AP exam: how this concept is tested (MCQ trap answers, FRQ expectations).\n\n"

    "STRUCTURE:\n"
    "- Use ## headers, one per major sub-concept (aim for 5–8 sections total).\n"
    "- Use bullet points and **bold** for key terms on first use.\n"
    "- Use ```java code blocks for all code.\n"
    "- Do NOT write superficial one-liner explanations. Each section should be meaty enough "
    "that a student who has never seen this concept before fully understands it.\n\n"

    "IMPORTANT — Interactive Visualizations:\n"
    "When explaining a concept that can be visualized, insert a marker on its own line "
    "immediately after the explanation paragraph:\n"
    "[VISUALIZE:type]\n\n"
    "Available types:\n"
    "- bubble_sort, selection_sort, insertion_sort, merge_sort\n"
    "- binary_search, linear_search\n"
    "- stack, queue, linked_list, arraylist\n"
    "- recursion, tree_traversal\n\n"
    "Place the marker RIGHT AFTER the paragraph that explains that concept. "
    "Only use markers for directly relevant concepts.\n\n"
    "Example section format:\n"
    "## Bubble Sort\n"
    "Bubble sort is a simple comparison-based algorithm that works by repeatedly stepping "
    "through the list and swapping adjacent elements that are in the wrong order. "
    "The name comes from the way larger elements 'bubble up' to the end of the list with each pass...\n\n"
    "[VISUALIZE:bubble_sort]\n\n"
    "**Step-by-step trace** for array [5, 3, 8, 1]:\n"
    "- Pass 1: Compare 5 and 3 → swap → [3, 5, 8, 1]. Compare 5 and 8 → no swap. "
    "Compare 8 and 1 → swap → [3, 5, 1, 8] ...\n\n"
    "**Common mistake:** Students often forget that after each full pass, one more element "
    "is in its final position, so the inner loop bound can shrink ..."
)

_PROMPT_MCQ = (
    "Create a challenging but fair AP-style multiple choice practice question about "
    "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
    "in {course_name}.\n\n"
    "IMPORTANT: The AP CSA exam uses 4 answer choices (A-D), NOT 5.\n\n"
    "CRITICAL: The correct answer MUST be placed at position {correct_position}. "
    "Do NOT always put the correct answer at the same position.\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "question": "The question text here (use \\n for newlines, include any code blocks as ```lang\\ncode\\n```)",\n'
    '  "options": {{\n'
    '    "A": "First option",\n'
    '    "B": "Second option",\n'
    '    "C": "Third option",\n'
    '    "D": "Fourth option"\n'
    '  }},\n'
    '  "correct": "{correct_position}",\n'
    '  "explanation": "Detailed step-by-step explanation in markdown format",\n'
    '  "category": "The AP CSA concept category tested, e.g. Methods, ArrayList, 2D Array, Recursion, Inheritance, Polymorphism"\n'
    '}}\n\n'
    "Make it representative of what students would see on the AP exam. "
    "The explanation field MUST: (1) clearly explain why the correct answer is right with "
    "a step-by-step justification, (2) explain why EACH incorrect option is wrong using "
    "the exact label format 'Option A:', 'Option B:', 'Option C:', 'Option D:' so each "
    "option gets its own paragraph. Do not skip any option.{variation_hint}"
)

_PROMPT_FRQ = (
    "Create an AP-style free response question about '{topic_title}' "
    "(Topic {topic_number}) from Unit {unit_number}: {unit_title} in {course_name}.\n\n"
    "The AP CSA exam has 4 FRQ types: (1) Methods and Control Structures, "
    "(2) Class Design, (3) Data Analysis with ArrayList, (4) 2D Array.\n"
    "Choose the FRQ type most relevant to this topic.\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "question": "Full problem statement in markdown (include any class/method signatures, requirements, examples)",\n'
    '  "frq_type": "Methods and Control Structures",\n'
    '  "sample_solution": "Complete Java code solution",\n'
    '  "rubric": "Point-by-point scoring rubric in markdown (e.g., +1 for loop, +1 for correct return)",\n'
    '  "explanation": "Step-by-step explanation of the solution approach in markdown"\n'
    '}}\n\n'
    "Make it realistic and representative of actual AP CSA FRQs. "
    "The question should require writing Java code (a method or class).{variation_hint}"
)

_PROMPT_EXAM = (
    "Explain how the topic '{topic_title}' (Topic {topic_number}) from "
    "Unit {unit_number}: {unit_title} in {course_name} appears on the AP exam. "
    "Cover: what types of questions test this topic (MCQ vs FRQ), how frequently "
    "it appears, what specific skills are tested, and any connections to other topics. "
    "Give concrete examples of how exam questions are framed around this topic."
)

_PROMPT_MISTAKES = (
    "What are the most common mistakes and misconceptions students have about "
    "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
    "in {course_name}? For each mistake, explain: what students get wrong, why they "
    "get confused, and how to avoid the error. Include specific examples that "
    "illustrate the correct vs incorrect approach."
)

# ── Custom course prompt variants (non-AP) ──

_PROMPT_INTRO_CUSTOM = (
    "You are an expert tutor. Write a THOROUGH, DETAILED, LESSON-QUALITY step-by-step "
    "explanation of '{topic_title}' (Topic {topic_number}) from "
    "Unit {unit_number}: {unit_title} in {course_name}.\n\n"
    "DEPTH REQUIREMENTS — every ## section MUST include:\n"
    "1. A conceptual explanation in 2–4 paragraphs explaining the WHY, not just the WHAT.\n"
    "2. At least one worked example with full solution steps shown.\n"
    "3. A step-by-step trace or walkthrough of the example.\n"
    "4. Common mistakes or misconceptions and how to avoid them.\n\n"
    "STRUCTURE: Use ## headers (one per sub-concept, aim for 5–8 sections), "
    "bullet points, and **bold** for key terms. "
    "Do NOT write superficial one-liner explanations — each section must be thorough enough "
    "that a student seeing this for the first time fully understands it."
)

_PROMPT_MCQ_CUSTOM = (
    "Create a challenging but fair multiple choice practice question about "
    "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
    "in {course_name}.\n\n"
    "Use 4 answer choices (A-D).\n\n"
    "CRITICAL: The correct answer MUST be placed at position {correct_position}. "
    "Do NOT always put the correct answer at the same position.\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "question": "The question text here (use \\n for newlines)",\n'
    '  "options": {{\n'
    '    "A": "First option",\n'
    '    "B": "Second option",\n'
    '    "C": "Third option",\n'
    '    "D": "Fourth option"\n'
    '  }},\n'
    '  "correct": "{correct_position}",\n'
    '  "explanation": "Detailed step-by-step explanation showing the work",\n'
    '  "category": "The concept category tested"\n'
    '}}\n\n'
    "For math topics: include calculation problems where students must show work. "
    "For other subjects: test understanding, application, and analysis. "
    "The explanation MUST show the complete solution process.{variation_hint}"
)

_PROMPT_FRQ_CUSTOM = (
    "Create a practice problem about '{topic_title}' "
    "(Topic {topic_number}) from Unit {unit_number}: {unit_title} in {course_name}.\n\n"
    "This should be a multi-step problem requiring detailed work.\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "question": "Full problem statement with all given information and what to find/solve",\n'
    '  "frq_type": "Problem Solving",\n'
    '  "sample_solution": "Complete step-by-step solution showing all work",\n'
    '  "rubric": "Point-by-point scoring criteria",\n'
    '  "explanation": "Explanation of the approach and key concepts used"\n'
    '}}\n\n'
    "The problem should test real understanding, not just memorization.{variation_hint}"
)

_PROMPT_MISTAKES_CUSTOM = (
    "What are the most common mistakes and misconceptions students have about "
    "'{topic_title}' (Topic {topic_number}) from Unit {unit_number}: {unit_title} "
    "in {course_name}? For each mistake, explain: what students get wrong, why they "
    "get confused, and how to avoid the error. Include specific examples."
)


def _is_custom_course(course_code: str) -> bool:
    """Check if a course is a custom (non-AP) course."""
    return course_code.startswith("CUSTOM_") if course_code else False


# How many practice questions of each type to generate per topic
_MCQ_COUNT = 10
_FRQ_COUNT = 2


def _parse_json_response(raw: str) -> dict | None:
    """Try to parse a JSON response, with aggressive cleanup."""
    import re

    def _try_parse(s: str) -> dict | None:
        try:
            return json.loads(s)
        except (json.JSONDecodeError, KeyError, ValueError):
            return None

    cleaned = raw.strip()

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    result = _try_parse(cleaned)
    if result:
        return result

    # Fallback: extract first JSON object via brace matching
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace > first_brace:
        candidate = cleaned[first_brace : last_brace + 1]
        result = _try_parse(candidate)
        if result:
            return result
        # Try fixing trailing commas (common LLM error)
        fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
        result = _try_parse(fixed)
        if result:
            return result

    return None


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
            existing_content = json.loads(existing.content)
            existing_mcqs = existing_content.get("practice_mcq", [])
            # If pool is already full, return as-is
            if len(existing_mcqs) >= _MCQ_COUNT:
                return {
                    "topic_id": existing.topic_id,
                    "content": existing_content,
                    "generated_by": existing.generated_by,
                    "already_existed": True,
                }
            # Otherwise, fall through to extend the MCQ pool below
            extend_existing = existing
            extend_content = existing_content
            extend_mcq_start = len(existing_mcqs)
        else:
            extend_existing = None
            extend_content = None
            extend_mcq_start = 0

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

        # Select prompt templates based on course type
        is_custom = _is_custom_course(course.code)
        prompt_intro = _PROMPT_INTRO_CUSTOM if is_custom else _PROMPT_INTRO
        prompt_mcq = _PROMPT_MCQ_CUSTOM if is_custom else _PROMPT_MCQ
        prompt_frq = _PROMPT_FRQ_CUSTOM if is_custom else _PROMPT_FRQ
        prompt_mistakes = _PROMPT_MISTAKES_CUSTOM if is_custom else _PROMPT_MISTAKES

        # If extending existing content, only generate the missing MCQs
        if extend_existing:
            content_dict = extend_content
            mcq_list = content_dict.get("practice_mcq", [])
            logger.info(f"Extending MCQ pool for {topic.title}: {len(mcq_list)} -> {_MCQ_COUNT}")
        else:
            content_dict = {}
            # 1. Generate intro
            logger.info(f"Generating 'intro' for {topic.topic_number} {topic.title}...")
            content_dict["intro"] = await _generate(prompt_intro.format(**fmt))
            mcq_list = []

        # 2. Generate MCQs (starting from where we left off)
        variation_hints = [
            "",
            "\n\nMake this question focus on a DIFFERENT concept or aspect than a typical question about this topic.",
            "\n\nMake this a TRICKY question that tests edge cases or subtle details that students often miss.",
            "\n\nCreate a question that requires applying this concept to a real-world scenario.",
            "\n\nWrite a question that tests understanding of WHY something works, not just WHAT happens.",
            "\n\nMake this question involve detailed step-by-step problem solving.",
            "\n\nCreate a question where the student must identify an error in a given solution.",
            "\n\nWrite a question that combines this topic with a closely related concept.",
            "\n\nMake this an easy warm-up question testing basic recall of this topic.",
            "\n\nCreate a challenging question that tests deep understanding.",
        ]
        _answer_positions = ["A", "B", "C", "D"]
        for i in range(extend_mcq_start, _MCQ_COUNT):
            hint = variation_hints[i] if i < len(variation_hints) else variation_hints[-1]
            correct_pos = _answer_positions[i % 4]  # Cycle through A, B, C, D
            logger.info(f"Generating MCQ {i+1}/{_MCQ_COUNT} for {topic.topic_number}...")
            raw = await _generate(prompt_mcq.format(**fmt, variation_hint=hint, correct_position=correct_pos))
            parsed = _parse_json_response(raw)
            if parsed and all(k in parsed for k in ("question", "options", "correct", "explanation")):
                mcq_list.append(parsed)
            else:
                logger.warning(f"MCQ {i+1} for {topic.title} not valid JSON, storing as text")
                mcq_list.append({"raw_text": raw})
        content_dict["practice_mcq"] = mcq_list

        # Skip non-MCQ generation when extending existing content
        if not extend_existing:
            # 3. Generate FRQs — for custom courses, always generate practice problems
            has_frq_section = is_custom  # Custom courses always get practice problems
            if not is_custom and course.exam_format:
                try:
                    ef = json.loads(course.exam_format) if isinstance(course.exam_format, str) else course.exam_format
                    has_frq_section = any(
                        "free response" in s.get("name", "").lower()
                        or "frq" in s.get("name", "").lower()
                        or s.get("type", "") == "frq"
                        for s in ef.get("sections", [])
                    )
                except (json.JSONDecodeError, TypeError):
                    pass

            if has_frq_section:
                frq_list = []
                frq_hints = [
                    "",
                    "\n\nMake this a DIFFERENT style of problem focusing on a different aspect of the topic.",
                ]
                for i in range(_FRQ_COUNT):
                    hint = frq_hints[i] if i < len(frq_hints) else frq_hints[-1]
                    logger.info(f"Generating FRQ {i+1}/{_FRQ_COUNT} for {topic.topic_number}...")
                    raw = await _generate(prompt_frq.format(**fmt, variation_hint=hint))
                    parsed = _parse_json_response(raw)
                    if parsed and all(k in parsed for k in ("question", "sample_solution", "explanation")):
                        frq_list.append(parsed)
                    else:
                        logger.warning(f"FRQ {i+1} for {topic.title} not valid JSON, storing as text")
                        frq_list.append({"raw_text": raw})
                content_dict["practice_frq"] = frq_list
            else:
                logger.info(f"Skipping FRQ generation for {course.name} (no FRQ exam section)")

            # 4. Generate exam info (skip for custom courses)
            if not is_custom:
                logger.info(f"Generating 'exam' for {topic.topic_number}...")
                content_dict["exam"] = await _generate(_PROMPT_EXAM.format(**fmt))
            else:
                logger.info(f"Skipping AP exam info for custom course {course.name}")

            # 5. Generate common mistakes
            logger.info(f"Generating 'mistakes' for {topic.topic_number}...")
            content_dict["mistakes"] = await _generate(prompt_mistakes.format(**fmt))

            if not content_dict.get("intro"):
                raise HTTPException(status_code=500, detail="Failed to generate content")

        # Save to DB
        generated_by = body.generated_by if body else None
        if extend_existing:
            # Update existing record with extended MCQ pool
            extend_existing.content = json.dumps(content_dict)
            db.commit()
            db.refresh(extend_existing)
            logger.info(f"Extended MCQ pool for topic {topic_id} ({topic.title}): now {len(content_dict['practice_mcq'])} MCQs")
            return {
                "topic_id": extend_existing.topic_id,
                "content": content_dict,
                "generated_by": extend_existing.generated_by,
                "already_existed": True,
                "extended_mcqs": True,
            }
        else:
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


_PROMPT_GOLDEN_SOLUTION = (
    "You are an expert AP CSA instructor writing a GOLDEN (ideal, exemplary) solution "
    "for the following free response question.\n\n"
    "**FRQ Type:** {frq_type}\n\n"
    "**Question:**\n{question}\n\n"
    "Write the best possible Java solution with:\n"
    "- Clean, well-structured code following AP CSA conventions\n"
    "- Detailed inline comments explaining EACH logical step\n"
    "- Meaningful variable names\n"
    "- Proper edge case handling\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "solution_code": "Complete Java code with detailed comments",\n'
    '  "explanation": "Step-by-step walkthrough of the approach and why each choice was made"\n'
    '}}'
)

_PROMPT_EXTRA_FRQ = (
    "Create an AP-style free response question about '{topic_title}' "
    "(Topic {topic_number}) from Unit {unit_number}: {unit_title} in {course_name}.\n\n"
    "The AP CSA exam has 4 FRQ types: (1) Methods and Control Structures, "
    "(2) Class Design, (3) Data Analysis with ArrayList, (4) 2D Array.\n"
    "Choose the FRQ type most relevant to this topic.\n\n"
    "IMPORTANT: This question must be DIFFERENT from these existing questions:\n"
    "{existing_questions}\n\n"
    "You MUST respond in EXACTLY this JSON format (no markdown, no extra text):\n"
    '{{\n'
    '  "question": "Full problem statement in markdown (include any class/method signatures, requirements, examples)",\n'
    '  "frq_type": "Methods and Control Structures",\n'
    '  "sample_solution": "Complete Java code solution",\n'
    '  "rubric": "Point-by-point scoring rubric in markdown (e.g., +1 for loop, +1 for correct return)",\n'
    '  "explanation": "Step-by-step explanation of the solution approach in markdown"\n'
    '}}\n\n'
    "Make it realistic and representative of actual AP CSA FRQs. "
    "The question should require writing Java code (a method or class).{variation_hint}"
)

_EXTRA_FRQ_COUNT = 3


def _init_tutor_agent(course):
    """Create a TutorAgent instance for content generation."""
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


@router.post("/{course_id}/topics/{topic_id}/golden-solutions")
async def generate_golden_solutions(course_id: str, topic_id: str):
    """Generate golden (ideal) solutions for existing FRQ questions. Stores separately from content."""
    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic_id).first()
        if not tc:
            raise HTTPException(status_code=400, detail="Preloaded content required first")

        content = json.loads(tc.content)
        frqs = content.get("practice_frq", [])
        if not frqs:
            raise HTTPException(status_code=400, detail="No FRQ questions found in preloaded content")

        # Also include extra_frqs if they exist
        extra = json.loads(tc.extra_frqs) if tc.extra_frqs else []
        all_frqs = frqs + extra

        course = topic.unit.course
        agent = _init_tutor_agent(course)

        async def _gen(prompt):
            result = await agent.process(
                message=prompt, history=[], topic_title=topic.title,
                unit_title=topic.unit.title, unit_number=topic.unit.unit_number, stream=False,
            )
            return result.get("response", "")

        golden = []
        for i, frq in enumerate(all_frqs):
            if "raw_text" in frq and "question" not in frq:
                continue
            question = frq.get("question", "")
            frq_type = frq.get("frq_type", "Methods and Control Structures")
            logger.info(f"Generating golden solution {i+1}/{len(all_frqs)} for {topic.topic_number}...")
            raw = await _gen(_PROMPT_GOLDEN_SOLUTION.format(question=question, frq_type=frq_type))
            parsed = _parse_json_response(raw)
            if parsed and "solution_code" in parsed:
                golden.append({"frq_index": i, **parsed})
            else:
                golden.append({"frq_index": i, "solution_code": raw, "explanation": ""})

        tc.golden_solutions = json.dumps(golden)
        db.commit()

        return {"topic_id": topic_id, "golden_solutions": golden, "count": len(golden)}
    finally:
        db.close()


@router.post("/{course_id}/topics/{topic_id}/extra-frqs")
async def generate_extra_frqs(course_id: str, topic_id: str):
    """Generate additional FRQ questions. Stores separately in extra_frqs column."""
    db = get_db()
    try:
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic or topic.unit.course_id != course_id:
            raise HTTPException(status_code=404, detail="Topic not found")

        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic_id).first()
        if not tc:
            raise HTTPException(status_code=400, detail="Preloaded content required first")

        content = json.loads(tc.content)
        existing_frqs = content.get("practice_frq", [])

        # Summarize existing questions so the LLM avoids duplicates
        existing_summaries = []
        for j, frq in enumerate(existing_frqs):
            q = frq.get("question", frq.get("raw_text", ""))[:200]
            existing_summaries.append(f"  FRQ {j+1}: {q}")
        existing_text = "\n".join(existing_summaries) if existing_summaries else "(none)"

        course = topic.unit.course
        unit = topic.unit
        agent = _init_tutor_agent(course)

        fmt = {
            "topic_title": topic.title,
            "topic_number": topic.topic_number,
            "unit_number": unit.unit_number,
            "unit_title": unit.title,
            "course_name": course.name,
            "existing_questions": existing_text,
        }

        async def _gen(prompt):
            result = await agent.process(
                message=prompt, history=[], topic_title=topic.title,
                unit_title=unit.title, unit_number=unit.unit_number, stream=False,
            )
            return result.get("response", "")

        extra_hints = [
            "",
            "\n\nMake this a DIFFERENT style focusing on a different FRQ type or aspect.",
            "\n\nMake this a challenging question combining multiple concepts from this topic.",
        ]

        extra_list = []
        for i in range(_EXTRA_FRQ_COUNT):
            hint = extra_hints[i] if i < len(extra_hints) else extra_hints[-1]
            logger.info(f"Generating extra FRQ {i+1}/{_EXTRA_FRQ_COUNT} for {topic.topic_number}...")
            raw = await _gen(_PROMPT_EXTRA_FRQ.format(**fmt, variation_hint=hint))
            parsed = _parse_json_response(raw)
            if parsed and all(k in parsed for k in ("question", "sample_solution", "explanation")):
                extra_list.append(parsed)
            else:
                logger.warning(f"Extra FRQ {i+1} not valid JSON, storing as text")
                extra_list.append({"raw_text": raw})

        tc.extra_frqs = json.dumps(extra_list)
        db.commit()

        return {"topic_id": topic_id, "extra_frqs": extra_list, "count": len(extra_list)}
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


# ──────────────────────────────────────────────────────
# Course Favorites
# ──────────────────────────────────────────────────────

@router.get("/favorites")
async def list_favorites(request: Request):
    """List course IDs that the current user has favorited."""
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        favs = (
            db.query(UserCourseFavorite.course_id)
            .filter(UserCourseFavorite.user_id == user["user_id"])
            .all()
        )
        return [f[0] for f in favs]
    finally:
        db.close()


@router.post("/{course_id}/favorite")
async def toggle_favorite(course_id: str, request: Request):
    """Toggle favorite status for a course. Returns {favorited: bool}."""
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    db = get_db()
    try:
        existing = (
            db.query(UserCourseFavorite)
            .filter(
                UserCourseFavorite.user_id == user["user_id"],
                UserCourseFavorite.course_id == course_id,
            )
            .first()
        )
        if existing:
            db.delete(existing)
            db.commit()
            return {"favorited": False}
        else:
            fav = UserCourseFavorite(user_id=user["user_id"], course_id=course_id)
            db.add(fav)
            db.commit()
            return {"favorited": True}
    finally:
        db.close()


# ──────────────────────────────────────────────────────
# User Content Uploads (per-user, per-course KB)
# ──────────────────────────────────────────────────────

_USER_UPLOADS_DIR = Path("data/user_uploads")

def _get_user_from_request(request: Request) -> dict:
    """Extract authenticated user from request. Raises 401 if not authenticated."""
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def _user_upload_dir(user_id: str, course_code: str) -> Path:
    """Get the upload directory for a user's course-specific materials."""
    return _USER_UPLOADS_DIR / f"{user_id}" / course_code


@router.post("/{course_id}/user-upload")
async def upload_user_content(
    course_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
):
    """Upload personal study materials for a course (per-user, not shared).

    Files are saved to the user's upload dir AND indexed into a personal
    RAG knowledge base so the AI tutor can reference them in responses.
    """
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        # Save files to user upload directory (for listing/deletion)
        upload_dir = _user_upload_dir(user_id, course.code)
        upload_dir.mkdir(parents=True, exist_ok=True)

        # Also prepare KB raw directory for RAG indexing
        kb_name = f"user-{user_id}-{course.code.lower().replace('_', '-')}"
        kb_base_dir = Path(__file__).parent.parent.parent.parent / "data" / "knowledge_bases"
        kb_dir = kb_base_dir / kb_name
        raw_dir = kb_dir / "raw"
        raw_dir.mkdir(parents=True, exist_ok=True)

        # Create metadata.json if it doesn't exist (first upload)
        metadata_file = kb_dir / "metadata.json"
        if not metadata_file.exists():
            import json as _json
            metadata = {
                "name": kb_name,
                "description": f"Personal study materials for {course.name}",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "document_count": 0,
                "status": "ready",
                "rag_provider": "llamaindex",
            }
            with open(metadata_file, "w", encoding="utf-8") as mf:
                _json.dump(metadata, mf, indent=2)

        saved_files = []
        uploaded_file_paths = []
        for f in files:
            safe_name = f.filename.replace("/", "_").replace("\\", "_") if f.filename else "upload"
            content = await f.read()

            # Save to user uploads dir (for UI listing)
            dest = upload_dir / safe_name
            with open(dest, "wb") as out:
                out.write(content)

            # Also save to KB raw dir (for RAG indexing)
            kb_dest = raw_dir / safe_name
            with open(kb_dest, "wb") as out:
                out.write(content)

            saved_files.append(safe_name)
            uploaded_file_paths.append(str(kb_dest))
            logger.info(f"User {user_id} uploaded '{safe_name}' for {course.code}")

        # Trigger RAG indexing in background
        if uploaded_file_paths:
            try:
                from src.services.llm.config import get_llm_config
                llm_config = get_llm_config()
                api_key = llm_config.api_key
                base_url = llm_config.base_url
            except Exception:
                api_key = None
                base_url = None

            if api_key:
                from src.api.routers.knowledge import run_upload_processing_task
                background_tasks.add_task(
                    run_upload_processing_task,
                    kb_name=kb_name,
                    base_dir=str(kb_base_dir),
                    api_key=api_key,
                    base_url=base_url,
                    uploaded_file_paths=uploaded_file_paths,
                )
                logger.info(f"Triggered RAG indexing for user KB '{kb_name}' ({len(uploaded_file_paths)} files)")
            else:
                logger.warning(f"Skipping RAG indexing for '{kb_name}': no LLM API key configured")

        return {
            "message": f"Uploaded {len(saved_files)} file(s). Indexing in background for AI tutor use.",
            "files": saved_files,
            "course_code": course.code,
            "indexing": bool(uploaded_file_paths),
        }
    finally:
        db.close()


@router.get("/{course_id}/user-uploads")
async def list_user_uploads(course_id: str, request: Request):
    """List files the current user has uploaded for this course."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        upload_dir = _user_upload_dir(user_id, course.code)
        if not upload_dir.exists():
            return {"files": [], "course_code": course.code}

        files = []
        for f in sorted(upload_dir.iterdir()):
            if f.is_file():
                files.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                })

        return {"files": files, "course_code": course.code}
    finally:
        db.close()


@router.delete("/{course_id}/user-uploads/{filename}")
async def delete_user_upload(course_id: str, filename: str, request: Request):
    """Delete a user-uploaded file."""
    user = _get_user_from_request(request)
    user_id = user["user_id"]

    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")

        upload_dir = _user_upload_dir(user_id, course.code)
        target = upload_dir / filename
        if not target.exists() or not target.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        target.unlink()
        logger.info(f"User {user_id} deleted '{filename}' from {course.code}")
        return {"message": f"Deleted {filename}"}
    finally:
        db.close()

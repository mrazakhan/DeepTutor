"""Counseling content API — STEM area roadmaps stored in the database."""

import json
import asyncio
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import CounselingContent, CounselingResume

router = APIRouter()
init_db()


# ---------- request / response models ----------

class CounselingContentRequest(BaseModel):
    stem_area: str
    display_name: str
    icon: str = "GraduationCap"
    description: str = ""
    content: dict


# ---------- helper: get authenticated user ----------

def _get_user(request: Request) -> dict:
    from src.api.routers.auth import _get_current_user
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


# ---------- counseling content endpoints ----------

@router.get("/areas")
async def list_areas():
    """Return lightweight list of available STEM counseling areas."""
    db = get_db()
    try:
        rows = db.query(CounselingContent).order_by(CounselingContent.display_name).all()
        return [
            {
                "stem_area": r.stem_area,
                "display_name": r.display_name,
                "icon": r.icon,
                "description": r.description or "",
            }
            for r in rows
        ]
    finally:
        db.close()


@router.get("/content/{stem_area}")
async def get_content(stem_area: str):
    """Return full counseling roadmap content for a specific STEM area."""
    db = get_db()
    try:
        row = (
            db.query(CounselingContent)
            .filter(CounselingContent.stem_area == stem_area)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail=f"No counseling content for '{stem_area}'")
        return {
            "stem_area": row.stem_area,
            "display_name": row.display_name,
            "icon": row.icon,
            "description": row.description or "",
            "content": json.loads(row.content),
        }
    finally:
        db.close()


@router.post("/content")
async def upsert_content(request: Request, body: CounselingContentRequest):
    """Create or update counseling content for a STEM area (admin only)."""
    user = _get_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    db = get_db()
    try:
        row = (
            db.query(CounselingContent)
            .filter(CounselingContent.stem_area == body.stem_area)
            .first()
        )
        if row:
            row.display_name = body.display_name
            row.icon = body.icon
            row.description = body.description
            row.content = json.dumps(body.content)
        else:
            row = CounselingContent(
                stem_area=body.stem_area,
                display_name=body.display_name,
                icon=body.icon,
                description=body.description,
                content=json.dumps(body.content),
            )
            db.add(row)
        db.commit()
        return {"success": True, "stem_area": body.stem_area}
    finally:
        db.close()


# ---------- resume upload & analysis endpoints ----------

def _extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF file using PyMuPDF."""
    import fitz  # PyMuPDF

    doc = fitz.open(file_path)
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts).strip()


def _extract_text_from_docx(file_path: str) -> str:
    """Extract text from a DOCX file."""
    try:
        import docx
        doc = docx.Document(file_path)
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        # Fallback: read raw XML
        import zipfile
        import re
        with zipfile.ZipFile(file_path) as z:
            xml = z.read("word/document.xml").decode("utf-8")
            text = re.sub(r"<[^>]+>", " ", xml)
            return re.sub(r"\s+", " ", text).strip()


@router.get("/resume/status")
async def resume_status(request: Request):
    """Check if the current user has an uploaded resume."""
    user = _get_user(request)
    db = get_db()
    try:
        row = db.query(CounselingResume).filter(
            CounselingResume.user_id == user["user_id"]
        ).first()
        if not row:
            return {"has_resume": False}
        return {
            "has_resume": True,
            "filename": row.filename,
            "stem_area": row.stem_area,
            "has_analysis": bool(row.analysis),
            "text_length": len(row.extracted_text) if row.extracted_text else 0,
        }
    finally:
        db.close()


@router.post("/resume/upload")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    stem_area: str = Form(""),
):
    """Upload a resume PDF/DOCX for personalized counseling analysis."""
    user = _get_user(request)

    # Validate file type
    filename = file.filename or "resume"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("pdf", "docx", "doc", "txt"):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Please upload a PDF, DOCX, or TXT file.",
        )

    # Save to temp file and extract text
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:  # 10 MB limit
        raise HTTPException(status_code=400, detail="File too large. Maximum 10 MB.")

    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        if ext == "pdf":
            extracted = _extract_text_from_pdf(tmp_path)
        elif ext in ("docx", "doc"):
            extracted = _extract_text_from_docx(tmp_path)
        elif ext == "txt":
            extracted = content.decode("utf-8", errors="replace")
        else:
            extracted = ""

        if not extracted or len(extracted.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Could not extract sufficient text from the file. Please try a different format.",
            )
    finally:
        Path(tmp_path).unlink(missing_ok=True)

    # Upsert resume in DB
    db = get_db()
    try:
        row = db.query(CounselingResume).filter(
            CounselingResume.user_id == user["user_id"]
        ).first()
        if row:
            row.filename = filename
            row.extracted_text = extracted
            row.stem_area = stem_area or row.stem_area
            row.analysis = None  # Clear cached analysis on re-upload
        else:
            row = CounselingResume(
                user_id=user["user_id"],
                filename=filename,
                extracted_text=extracted,
                stem_area=stem_area,
            )
            db.add(row)
        db.commit()
        return {
            "success": True,
            "filename": filename,
            "text_length": len(extracted),
        }
    finally:
        db.close()


@router.delete("/resume")
async def delete_resume(request: Request):
    """Delete the current user's resume."""
    user = _get_user(request)
    db = get_db()
    try:
        row = db.query(CounselingResume).filter(
            CounselingResume.user_id == user["user_id"]
        ).first()
        if not row:
            raise HTTPException(status_code=404, detail="No resume found")
        db.delete(row)
        db.commit()
        return {"success": True}
    finally:
        db.close()


@router.get("/resume/analyze/{stem_area}")
async def analyze_resume(stem_area: str, request: Request):
    """Stream personalized counseling analysis based on resume + STEM area roadmap."""
    user = _get_user(request)

    db = get_db()
    try:
        resume = db.query(CounselingResume).filter(
            CounselingResume.user_id == user["user_id"]
        ).first()
        if not resume:
            raise HTTPException(status_code=404, detail="No resume uploaded")

        # Check for cached analysis for the same area
        if resume.analysis and resume.stem_area == stem_area:
            # Return cached analysis as a single SSE event
            async def cached_stream():
                yield f"data: {json.dumps({'type': 'chunk', 'content': resume.analysis})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
            return StreamingResponse(cached_stream(), media_type="text/event-stream")

        # Load roadmap content for the stem area
        roadmap = db.query(CounselingContent).filter(
            CounselingContent.stem_area == stem_area
        ).first()

        roadmap_text = ""
        display_name = stem_area.replace("_", " ").title()
        if roadmap:
            display_name = roadmap.display_name
            try:
                content = json.loads(roadmap.content)
                # Build a concise text summary of the roadmap
                parts = []
                for grade, data in content.get("grade_data", {}).items():
                    parts.append(f"\n=== {data.get('label', grade)} ({data.get('subtitle', '')}) ===")
                    for section in ("academics", "competitions", "projects", "summer"):
                        items = data.get(section, [])
                        if items:
                            parts.append(f"  {section.title()}:")
                            for item in items:
                                parts.append(f"    - {item['title']}: {item['description']}")
                for insight in content.get("key_insights", []):
                    parts.append(f"\nKey Insight - {insight['title']}: {insight['description']}")
                for school in content.get("target_schools", []):
                    parts.append(f"\nTarget School - {school['school']} ({school['program']}): {school['strategy']}")
                roadmap_text = "\n".join(parts)
            except Exception:
                roadmap_text = ""

        resume_text = resume.extracted_text
        user_id = user["user_id"]
    finally:
        db.close()

    # Build the analysis prompt
    system_prompt = f"""You are an expert college admissions counselor specializing in {display_name} programs at top universities.

You have access to:
1. A detailed 4-year roadmap for students targeting top {display_name} programs
2. The student's resume/profile

Your task is to provide a deeply personalized analysis. Be specific, actionable, and honest.

=== ROADMAP FOR {display_name.upper()} ===
{roadmap_text}

=== STUDENT'S RESUME/PROFILE ===
{resume_text}
"""

    user_prompt = f"""Based on my resume and the {display_name} admissions roadmap, please provide a comprehensive personalized analysis with these sections:

## 📊 Profile Summary
Briefly summarize my current position — grade level (if detectable), key strengths, and overall readiness.

## ✅ Strengths & What You're Doing Right
What parts of the roadmap am I already hitting? Be specific about which activities/courses align well.

## ⚠️ Gaps to Address
What critical items from the roadmap am I missing? Prioritize by impact. Be honest but constructive.

## 🎯 Recommended Next Steps (Next 3-6 Months)
Give me 5-7 specific, actionable items I should focus on immediately. Include timelines.

## 🏫 School Fit Analysis
Based on my profile, which target schools am I strongest for? Which are reaches? What would make my application stronger for each?

## 📅 Suggested Timeline
A brief month-by-month plan for the next 6 months tailored to my current position.

Be specific — reference my actual activities, courses, and achievements from my resume. Don't give generic advice."""

    # Stream LLM response via SSE
    async def generate():
        from src.services.llm.factory import stream as llm_stream
        from src.services.llm.config import get_llm_config

        llm_config = get_llm_config()
        full_response = []

        try:
            async for chunk in llm_stream(
                prompt=user_prompt,
                system_prompt=system_prompt,
                model=llm_config.model,
                api_key=llm_config.api_key,
                base_url=llm_config.base_url,
                binding=getattr(llm_config, "binding", None),
                temperature=0.7,
                max_tokens=4096,
            ):
                full_response.append(chunk)
                yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
                await asyncio.sleep(0)  # yield control

            # Cache the full analysis
            full_text = "".join(full_response)
            db2 = get_db()
            try:
                row = db2.query(CounselingResume).filter(
                    CounselingResume.user_id == user_id
                ).first()
                if row:
                    row.analysis = full_text
                    row.stem_area = stem_area
                    db2.commit()
            finally:
                db2.close()

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'content': str(e)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------- counseling chat (WebSocket) ----------

def _build_roadmap_text(stem_area: str) -> tuple[str, str]:
    """Load roadmap content and return (display_name, roadmap_text)."""
    db = get_db()
    try:
        roadmap = db.query(CounselingContent).filter(
            CounselingContent.stem_area == stem_area
        ).first()
        if not roadmap:
            return stem_area.replace("_", " ").title(), ""
        display_name = roadmap.display_name
        try:
            content = json.loads(roadmap.content)
            parts = []
            for grade, data in content.get("grade_data", {}).items():
                parts.append(f"\n=== {data.get('label', grade)} ({data.get('subtitle', '')}) ===")
                for section in ("academics", "competitions", "projects", "summer"):
                    items = data.get(section, [])
                    if items:
                        parts.append(f"  {section.title()}:")
                        for item in items:
                            parts.append(f"    - {item['title']}: {item['description']}")
            for insight in content.get("key_insights", []):
                parts.append(f"\nKey Insight - {insight['title']}: {insight['description']}")
            for school in content.get("target_schools", []):
                parts.append(f"\nTarget School - {school['school']} ({school['program']}): {school['strategy']}")
            return display_name, "\n".join(parts)
        except Exception:
            return display_name, ""
    finally:
        db.close()


def _build_counseling_system_prompt(display_name: str, roadmap_text: str, resume_text: str) -> str:
    """Build the system prompt for counseling chat."""
    resume_section = ""
    if resume_text:
        resume_section = f"""

=== STUDENT'S RESUME/PROFILE ===
{resume_text}
"""

    if resume_text:
        opening_instructions = """
IMPORTANT: The student has uploaded their resume/profile. You already know their background.
In your FIRST message:
- Acknowledge that you've reviewed their profile
- Immediately give 2-3 specific observations (strengths AND gaps) based on their resume
- Reference specific items from their resume (courses, competitions, projects, scores)
- Ask 1-2 targeted follow-up questions based on what you see in their profile
Do NOT ask generic questions like "what grade are you in?" — you already know from their resume."""
    else:
        opening_instructions = """
The student has NOT uploaded a resume, so you don't know their background yet.
Start by introducing yourself briefly and asking:
1. What grade they're in
2. What their main activities/coursework are so far
Keep your initial message SHORT (3-4 sentences max)."""

    return f"""You are an expert college admissions counselor specializing in {display_name} programs at top universities. You are having an interactive conversation with a high school student who wants to get into a top {display_name} program.

You have access to a detailed 4-year roadmap for students targeting top {display_name} programs.
{resume_section}

=== ROADMAP FOR {display_name.upper()} ===
{roadmap_text}

=== YOUR APPROACH ===
1. Be conversational, warm, and encouraging — but honest about gaps.
2. Based on what you know, give specific, actionable advice referencing the roadmap.
3. Proactively suggest what they should be doing NOW based on their grade level.
4. Help them understand how they compare to competitive applicants.
5. Ask follow-up questions to clarify details — but only 1-2 at a time, naturally woven into your advice.
6. Focus on improving their chances of admission — be practical, not just aspirational.
7. Don't dump everything at once — have a natural back-and-forth conversation.
{opening_instructions}"""


@router.websocket("/chat")
async def websocket_counseling_chat(websocket: WebSocket):
    """
    WebSocket endpoint for interactive counseling chat.

    Request format:
    {
        "message": str,
        "stem_area": str,
        "history": [...] | null
    }

    Response types:
    - {"type": "stream", "content": str}
    - {"type": "result", "content": str}
    - {"type": "error", "message": str}
    """
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "").strip()
            stem_area = data.get("stem_area", "cs")
            history = data.get("history") or []
            user_id = data.get("user_id")

            if not message:
                await websocket.send_json({"type": "error", "message": "Message is required"})
                continue

            try:
                # Load roadmap context
                display_name, roadmap_text = _build_roadmap_text(stem_area)

                # Load resume if available
                resume_text = ""
                if user_id:
                    db = get_db()
                    try:
                        resume = db.query(CounselingResume).filter(
                            CounselingResume.user_id == user_id
                        ).first()
                        if resume and resume.extracted_text:
                            resume_text = resume.extracted_text
                    finally:
                        db.close()

                # Build system prompt
                system_prompt = _build_counseling_system_prompt(
                    display_name, roadmap_text, resume_text
                )

                # Build messages array
                messages = [{"role": "system", "content": system_prompt}]
                for msg in history:
                    messages.append({
                        "role": msg.get("role", "user"),
                        "content": msg.get("content", ""),
                    })
                messages.append({"role": "user", "content": message})

                # Stream LLM response
                from src.services.llm.factory import stream as llm_stream
                from src.services.llm.config import get_llm_config

                llm_config = get_llm_config()
                full_response = ""

                async for chunk in llm_stream(
                    prompt=message,
                    system_prompt=system_prompt,
                    model=llm_config.model,
                    api_key=llm_config.api_key,
                    base_url=llm_config.base_url,
                    binding=getattr(llm_config, "binding", None),
                    temperature=0.7,
                    max_tokens=2048,
                    messages=messages,
                ):
                    full_response += chunk
                    await websocket.send_json({
                        "type": "stream",
                        "content": chunk,
                    })

                # Send final result
                await websocket.send_json({
                    "type": "result",
                    "content": full_response,
                })

            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.send_json({"type": "error", "message": "Connection error"})
        except Exception:
            pass

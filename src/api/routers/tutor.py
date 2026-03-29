"""
Tutor API Router
=================

WebSocket endpoint for AP course-scoped tutoring.
REST endpoints for tutor session management.
"""

from pathlib import Path
import sys

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

_project_root = Path(__file__).parent.parent.parent.parent
sys.path.insert(0, str(_project_root))

from src.agents.tutor import TutorAgent
from src.agents.tutor.session_manager import TutorSessionManager
from src.database import get_db
from src.database.models import Course, Topic, Unit
from src.logging import get_logger
from src.services.config import load_config_with_main
from src.services.llm.config import get_llm_config
from src.services.settings.interface_settings import get_ui_language

project_root = Path(__file__).parent.parent.parent.parent
config = load_config_with_main("solve_config.yaml", project_root)
log_dir = config.get("paths", {}).get("user_log_dir") or config.get("logging", {}).get("log_dir")
logger = get_logger("TutorAPI", level="INFO", log_dir=log_dir)

router = APIRouter()
session_manager = TutorSessionManager()


# =============================================================================
# REST Endpoints
# =============================================================================


@router.get("/sessions")
async def list_tutor_sessions(course_id: str | None = None, limit: int = 20):
    """List recent tutor sessions, optionally filtered by course."""
    return session_manager.list_sessions(course_id=course_id, limit=limit)


@router.get("/sessions/{session_id}")
async def get_tutor_session(session_id: str):
    """Get a specific tutor session with full message history."""
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_tutor_session(session_id: str):
    """Delete a tutor session."""
    if session_manager.delete_session(session_id):
        return {"status": "deleted", "session_id": session_id}
    raise HTTPException(status_code=404, detail="Session not found")


def _get_course_and_topic(course_id: str, topic_id: str | None = None):
    """Helper to load course and optional topic from DB."""
    db = get_db()
    try:
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            return None, None, None

        topic = None
        unit = None
        if topic_id:
            topic = db.query(Topic).filter(Topic.id == topic_id).first()
            if topic:
                unit = db.query(Unit).filter(Unit.id == topic.unit_id).first()

        return course, topic, unit
    finally:
        db.close()


# =============================================================================
# WebSocket Endpoint
# =============================================================================


@router.websocket("/chat")
async def websocket_tutor(websocket: WebSocket):
    """
    WebSocket endpoint for course-scoped tutoring.

    Request format:
    {
        "message": str,
        "session_id": str | null,
        "history": [...] | null,
        "course_id": int,
        "topic_id": int | null
    }

    Response types:
    - {"type": "session", "session_id": str, "intro": str | null}
    - {"type": "status", "stage": str, "message": str}
    - {"type": "stream", "content": str}
    - {"type": "sources", "rag": list}
    - {"type": "result", "content": str}
    - {"type": "error", "message": str}
    """
    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_json()
            message = data.get("message", "").strip()
            session_id = data.get("session_id")
            explicit_history = data.get("history")
            course_id = data.get("course_id")
            topic_id = data.get("topic_id")
            user_id = data.get("user_id")  # Optional: for user-specific KB
            image_data = data.get("image_data")  # Optional: base64 PNG for handwritten FRQ

            if not course_id:
                await websocket.send_json({"type": "error", "message": "course_id is required"})
                continue

            if not message:
                await websocket.send_json({"type": "error", "message": "Message is required"})
                continue

            logger.info(
                f"Tutor request: course={course_id}, topic={topic_id}, "
                f"session={session_id}, message={message[:50]}..."
            )

            try:
                # Load course and topic info from DB
                course, topic, unit = _get_course_and_topic(course_id, topic_id)
                if not course:
                    await websocket.send_json({"type": "error", "message": "Course not found"})
                    continue

                course_code = course.code
                course_name = course.name
                topic_title = topic.title if topic else ""
                unit_title = unit.title if unit else ""
                unit_number = unit.unit_number if unit else 0

                # Get or create session
                intro = None
                if session_id:
                    session = session_manager.get_session(session_id)
                    if not session:
                        session = session_manager.create_session(
                            course_id=course_id,
                            course_code=course_code,
                            course_name=course_name,
                            topic_id=topic_id,
                            topic_title=topic_title,
                            unit_title=unit_title,
                            unit_number=unit_number,
                        )
                        session_id = session["session_id"]
                else:
                    session = session_manager.create_session(
                        course_id=course_id,
                        course_code=course_code,
                        course_name=course_name,
                        topic_id=topic_id,
                        topic_title=topic_title,
                        unit_title=unit_title,
                        unit_number=unit_number,
                    )
                    session_id = session["session_id"]

                await websocket.send_json({
                    "type": "session",
                    "session_id": session_id,
                    "intro": intro,
                })

                # Build history
                if explicit_history is not None:
                    history = explicit_history
                else:
                    history = [
                        {"role": msg["role"], "content": msg["content"]}
                        for msg in session.get("messages", [])
                    ]

                # Save user message
                session_manager.add_message(
                    session_id=session_id,
                    role="user",
                    content=message,
                )

                # Initialize TutorAgent
                try:
                    llm_config = get_llm_config()
                    api_key = llm_config.api_key
                    base_url = llm_config.base_url
                    api_version = getattr(llm_config, "api_version", None)
                except Exception:
                    api_key = None
                    base_url = None
                    api_version = None

                # Build user-specific KB name if user_id is provided
                user_kb_name = None
                if user_id:
                    # Check if user has uploaded files for this course
                    user_upload_dir = Path("data/user_uploads") / str(user_id) / course_code
                    if user_upload_dir.exists() and any(user_upload_dir.iterdir()):
                        user_kb_name = f"user-{user_id}-{course_code.lower().replace('_', '-')}"

                agent = TutorAgent(
                    course_code=course_code,
                    course_name=course_name,
                    language="en",
                    config=config,
                    api_key=api_key,
                    base_url=base_url,
                    api_version=api_version,
                    user_kb_name=user_kb_name,
                )

                # Status updates
                await websocket.send_json({
                    "type": "status",
                    "stage": "rag",
                    "message": f"Searching {course_name} materials...",
                })

                await websocket.send_json({
                    "type": "status",
                    "stage": "generating",
                    "message": "Generating response...",
                })

                # Stream response
                full_response = ""
                sources = []

                stream_generator = await agent.process(
                    message=message,
                    history=history,
                    topic_title=topic_title,
                    unit_title=unit_title,
                    unit_number=unit_number,
                    stream=True,
                    image_data=image_data,
                )

                async for chunk_data in stream_generator:
                    if chunk_data["type"] == "chunk":
                        await websocket.send_json({
                            "type": "stream",
                            "content": chunk_data["content"],
                        })
                        full_response += chunk_data["content"]
                    elif chunk_data["type"] == "complete":
                        full_response = chunk_data["response"]
                        sources = chunk_data.get("sources", [])

                # Send sources
                if sources:
                    await websocket.send_json({"type": "sources", "rag": sources})

                # Send final result
                await websocket.send_json({
                    "type": "result",
                    "content": full_response,
                })

                # Save assistant message
                session_manager.add_message(
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    sources=sources if sources else None,
                )

                logger.info(f"Tutor completed: session={session_id}, {len(full_response)} chars")

                # Log LLM usage
                try:
                    from src.api.middleware.llm_tracking import log_llm_usage
                    log_llm_usage(user_id=user_id, endpoint="tutor", response_text=full_response)
                except Exception:
                    pass

            except Exception as e:
                logger.error(f"Tutor processing error: {e}")
                await websocket.send_json({"type": "error", "message": str(e)})

    except WebSocketDisconnect:
        logger.debug("Client disconnected from tutor")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass

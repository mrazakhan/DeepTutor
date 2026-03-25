"""Admin dashboard API endpoints.

All endpoints require admin role.
"""

import json
import secrets
import time

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from sqlalchemy import func

from src.database.engine import get_db
from src.database.models import (
    AssessmentAnswer,
    Course,
    Topic,
    TopicAssessment,
    TopicContent,
    Unit,
    User,
    UserCourseFavorite,
)

router = APIRouter()


def _require_admin(request: Request) -> dict:
    """Extract user from request and verify admin role."""
    from src.api.routers.auth import _get_current_user

    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/users")
async def list_users(request: Request):
    """List all users with activity stats."""
    _require_admin(request)

    db = get_db()
    try:
        users = db.query(User).order_by(User.created_at.desc()).all()

        result = []
        for u in users:
            # Count total questions answered
            total_questions = (
                db.query(func.sum(TopicAssessment.total_questions))
                .filter(TopicAssessment.user_id == u.id)
                .scalar()
            ) or 0

            correct_answers = (
                db.query(func.sum(TopicAssessment.correct_answers))
                .filter(TopicAssessment.user_id == u.id)
                .scalar()
            ) or 0

            # Count topics assessed
            topics_assessed = (
                db.query(func.count(TopicAssessment.id))
                .filter(TopicAssessment.user_id == u.id)
                .scalar()
            ) or 0

            # Count favorited courses
            favorites_count = (
                db.query(func.count(UserCourseFavorite.id))
                .filter(UserCourseFavorite.user_id == u.id)
                .scalar()
            ) or 0

            result.append({
                "id": u.id,
                "username": u.username,
                "display_name": u.display_name,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
                "total_questions": total_questions,
                "correct_answers": correct_answers,
                "topics_assessed": topics_assessed,
                "favorites_count": favorites_count,
            })

        return result
    finally:
        db.close()


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    """Delete a user account. Cannot delete yourself or other admins."""
    admin = _require_admin(request)

    if admin["user_id"] == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role == "admin":
            raise HTTPException(status_code=400, detail="Cannot delete admin accounts")

        username = user.username
        db.delete(user)
        db.commit()

        # Also remove any active tokens for this user
        from src.api.routers.auth import _tokens
        tokens_to_remove = [
            t for t, s in _tokens.items() if s.get("user_id") == user_id
        ]
        for t in tokens_to_remove:
            del _tokens[t]

        return {"deleted": True, "username": username}
    finally:
        db.close()


@router.post("/users/{user_id}/reset-password")
async def reset_password(user_id: str, request: Request):
    """Reset a user's password. Returns the new temporary password."""
    _require_admin(request)

    import hashlib

    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Generate a readable temporary password
        temp_password = secrets.token_urlsafe(8)
        user.password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
        db.commit()

        # Invalidate existing tokens for this user
        from src.api.routers.auth import _tokens
        tokens_to_remove = [
            t for t, s in _tokens.items() if s.get("user_id") == user_id
        ]
        for t in tokens_to_remove:
            del _tokens[t]

        return {
            "username": user.username,
            "temp_password": temp_password,
            "message": f"Password reset for {user.username}. They will need to log in with the new password.",
        }
    finally:
        db.close()


@router.get("/sessions")
async def list_sessions(request: Request):
    """List all active auth sessions."""
    _require_admin(request)

    from src.api.routers.auth import _tokens

    now = time.time()
    sessions = []
    for token_key, session in _tokens.items():
        if session["expires"] > now:
            sessions.append({
                "username": session.get("username"),
                "display_name": session.get("display_name"),
                "role": session.get("role"),
                "expires_in_hours": round((session["expires"] - now) / 3600, 1),
            })

    return sessions


@router.get("/stats")
async def get_stats(request: Request):
    """Overview statistics for the admin dashboard."""
    _require_admin(request)

    from src.api.routers.auth import _tokens

    db = get_db()
    try:
        total_users = db.query(func.count(User.id)).scalar() or 0
        students = db.query(func.count(User.id)).filter(User.role == "student").scalar() or 0
        admins = db.query(func.count(User.id)).filter(User.role == "admin").scalar() or 0
        total_assessments = db.query(func.count(TopicAssessment.id)).scalar() or 0
        total_questions = db.query(func.sum(TopicAssessment.total_questions)).scalar() or 0
        total_correct = db.query(func.sum(TopicAssessment.correct_answers)).scalar() or 0

        now = time.time()
        active_sessions = sum(1 for s in _tokens.values() if s["expires"] > now)

        return {
            "total_users": total_users,
            "students": students,
            "admins": admins,
            "active_sessions": active_sessions,
            "total_assessments": total_assessments,
            "total_questions": total_questions,
            "total_correct": total_correct,
        }
    finally:
        db.close()


# ── Batch generation helpers ──────────────────────────────────────────


def _get_course_topics_with_frqs(course_code: str):
    """Get all topics for a course that have preloaded FRQ content."""
    db = get_db()
    try:
        course = db.query(Course).filter(Course.code == course_code).first()
        if not course:
            return None, []
        topics = []
        for unit in course.units:
            for topic in unit.topics:
                tc = db.query(TopicContent).filter(TopicContent.topic_id == topic.id).first()
                if tc:
                    content = json.loads(tc.content)
                    if content.get("practice_frq"):
                        topics.append({
                            "course_id": course.id,
                            "topic_id": topic.id,
                            "topic_number": topic.topic_number,
                            "title": topic.title,
                            "has_golden": tc.golden_solutions is not None,
                            "has_extra": tc.extra_frqs is not None,
                        })
        return course, topics
    finally:
        db.close()


@router.post("/generate-golden-solutions")
async def batch_golden_solutions(request: Request, course_code: str = "apcsa"):
    """Batch-generate golden solutions for all topics in a course. Runs synchronously."""
    _require_admin(request)

    course, topics = _get_course_topics_with_frqs(course_code)
    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{course_code}' not found")

    pending = [t for t in topics if not t["has_golden"]]
    if not pending:
        return {"message": "All topics already have golden solutions", "total": len(topics), "generated": 0}

    from src.api.routers.courses import generate_golden_solutions

    results = []
    for t in pending:
        try:
            r = await generate_golden_solutions(t["course_id"], t["topic_id"])
            results.append({"topic": t["topic_number"], "title": t["title"], "status": "ok", "count": r["count"]})
        except Exception as e:
            results.append({"topic": t["topic_number"], "title": t["title"], "status": "error", "error": str(e)})

    return {
        "total_topics": len(topics),
        "already_done": len(topics) - len(pending),
        "generated": sum(1 for r in results if r["status"] == "ok"),
        "errors": sum(1 for r in results if r["status"] == "error"),
        "details": results,
    }


@router.post("/generate-extra-frqs")
async def batch_extra_frqs(request: Request, course_code: str = "apcsa"):
    """Batch-generate extra FRQ questions for all topics in a course."""
    _require_admin(request)

    course, topics = _get_course_topics_with_frqs(course_code)
    if not course:
        raise HTTPException(status_code=404, detail=f"Course '{course_code}' not found")

    pending = [t for t in topics if not t["has_extra"]]
    if not pending:
        return {"message": "All topics already have extra FRQs", "total": len(topics), "generated": 0}

    from src.api.routers.courses import generate_extra_frqs

    results = []
    for t in pending:
        try:
            r = await generate_extra_frqs(t["course_id"], t["topic_id"])
            results.append({"topic": t["topic_number"], "title": t["title"], "status": "ok", "count": r["count"]})
        except Exception as e:
            results.append({"topic": t["topic_number"], "title": t["title"], "status": "error", "error": str(e)})

    return {
        "total_topics": len(topics),
        "already_done": len(topics) - len(pending),
        "generated": sum(1 for r in results if r["status"] == "ok"),
        "errors": sum(1 for r in results if r["status"] == "error"),
        "details": results,
    }

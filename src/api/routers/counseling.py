"""Counseling content API — STEM area roadmaps stored in the database."""

import json

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import CounselingContent

router = APIRouter()
init_db()


# ---------- request / response models ----------

class CounselingContentRequest(BaseModel):
    stem_area: str
    display_name: str
    icon: str = "GraduationCap"
    description: str = ""
    content: dict


# ---------- endpoints ----------

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
    from src.api.routers.auth import _get_current_user

    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
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

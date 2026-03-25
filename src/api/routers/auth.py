"""Simple authentication router with JWT tokens.

Test users (seeded via seed_courses.py):
  - student1 / student1234 (role: student)
  - admin1 / admin1234 (role: admin)
"""

import hashlib
import secrets
import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from src.database.engine import get_db, init_db
from src.database.models import User

router = APIRouter()
init_db()

# Simple in-memory token store.  Replace with JWT or Redis for production.
_tokens: dict[str, dict] = {}  # token -> {user_id, username, role, expires}

TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 7  # 7 days


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str


class LoginResponse(BaseModel):
    token: str
    user: dict


def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def _get_current_user(request: Request) -> dict | None:
    """Extract user from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    session = _tokens.get(token)
    if not session:
        return None
    if session["expires"] < time.time():
        del _tokens[token]
        return None
    return session


@router.post("/register")
async def register(body: RegisterRequest):
    """Create a new student account and return a login token."""
    username = body.username.strip()
    display_name = body.display_name.strip()
    password = body.password

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if not display_name:
        raise HTTPException(status_code=400, detail="Display name is required")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = get_db()
    try:
        if db.query(User).filter(User.username == username).first():
            raise HTTPException(status_code=409, detail="Username already taken")

        user = User(
            username=username,
            password_hash=_hash_password(password),
            display_name=display_name,
            role="student",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        # Auto-login: issue token
        token = secrets.token_urlsafe(32)
        _tokens[token] = {
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
            "expires": time.time() + TOKEN_EXPIRY_SECONDS,
        }

        return {
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "role": user.role,
            },
        }
    finally:
        db.close()


@router.post("/login")
async def login(body: LoginRequest):
    """Authenticate with username/password, returns a bearer token."""
    db = get_db()
    try:
        user = db.query(User).filter(User.username == body.username).first()
        if not user or user.password_hash != _hash_password(body.password):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        token = secrets.token_urlsafe(32)
        _tokens[token] = {
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "role": user.role,
            "expires": time.time() + TOKEN_EXPIRY_SECONDS,
        }

        return {
            "token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "role": user.role,
            },
        }
    finally:
        db.close()


@router.get("/me")
async def get_me(request: Request):
    """Get current authenticated user from bearer token."""
    user = _get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user["user_id"],
        "username": user["username"],
        "display_name": user["display_name"],
        "role": user["role"],
    }


@router.post("/logout")
async def logout(request: Request):
    """Invalidate the current token."""
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        _tokens.pop(token, None)
    return {"status": "logged_out"}

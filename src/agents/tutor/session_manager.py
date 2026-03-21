"""
TutorSessionManager - Tutor session persistence.

Reuses the same pattern as chat SessionManager but stores
tutor sessions separately in data/user/tutor_sessions.json.
"""

import json
from pathlib import Path
import time
from typing import Any
import uuid


class TutorSessionManager:
    """Manages persistent storage of tutor sessions."""

    MAX_SESSIONS = 200

    def __init__(self, base_dir: str | None = None):
        if base_dir is None:
            project_root = Path(__file__).resolve().parents[3]
            base_dir_path = project_root / "data" / "user"
        else:
            base_dir_path = Path(base_dir)

        self.base_dir = base_dir_path
        self.sessions_file = self.base_dir / "tutor_sessions.json"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _load_sessions(self) -> list[dict]:
        if not self.sessions_file.exists():
            return []
        try:
            with open(self.sessions_file, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []

    def _save_sessions(self, sessions: list[dict]):
        with open(self.sessions_file, "w") as f:
            json.dump(sessions, f, indent=2, ensure_ascii=False)

    def create_session(
        self,
        course_id: int,
        course_code: str,
        course_name: str,
        topic_id: int | None = None,
        topic_title: str = "",
        unit_title: str = "",
        unit_number: int = 0,
        title: str = "",
    ) -> dict:
        session_id = f"tutor_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        session = {
            "session_id": session_id,
            "title": title or f"{course_name} - {topic_title}" if topic_title else course_name,
            "course_id": course_id,
            "course_code": course_code,
            "course_name": course_name,
            "topic_id": topic_id,
            "topic_title": topic_title,
            "unit_title": unit_title,
            "unit_number": unit_number,
            "messages": [],
            "created_at": time.time(),
            "updated_at": time.time(),
        }

        sessions = self._load_sessions()
        sessions.insert(0, session)

        # Trim old sessions
        if len(sessions) > self.MAX_SESSIONS:
            sessions = sessions[: self.MAX_SESSIONS]

        self._save_sessions(sessions)
        return session

    def get_session(self, session_id: str) -> dict | None:
        for session in self._load_sessions():
            if session.get("session_id") == session_id:
                return session
        return None

    def add_message(
        self,
        session_id: str,
        role: str,
        content: str,
        sources: list[dict] | None = None,
    ):
        sessions = self._load_sessions()
        for session in sessions:
            if session.get("session_id") == session_id:
                session["messages"].append({
                    "role": role,
                    "content": content,
                    "sources": sources,
                    "timestamp": time.time(),
                })
                session["updated_at"] = time.time()
                self._save_sessions(sessions)
                return
        raise ValueError(f"Session not found: {session_id}")

    def list_sessions(
        self,
        course_id: int | None = None,
        limit: int = 20,
        include_messages: bool = False,
    ) -> list[dict]:
        sessions = self._load_sessions()
        if course_id is not None:
            sessions = [s for s in sessions if s.get("course_id") == course_id]

        sessions = sessions[:limit]

        if not include_messages:
            return [
                {k: v for k, v in s.items() if k != "messages"}
                for s in sessions
            ]
        return sessions

    def delete_session(self, session_id: str) -> bool:
        sessions = self._load_sessions()
        original_len = len(sessions)
        sessions = [s for s in sessions if s.get("session_id") != session_id]
        if len(sessions) < original_len:
            self._save_sessions(sessions)
            return True
        return False

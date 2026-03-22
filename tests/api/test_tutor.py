"""Tests for the tutor API endpoints (REST only, not WebSocket)."""

import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.database.engine import DB_PATH


@pytest.fixture
def client(tmp_path):
    """Create a test client for tutor REST endpoints."""
    if not DB_PATH.exists():
        pytest.skip("Seeded database not found — run scripts/seed_courses.py first")

    os.environ.setdefault("LLM_BINDING", "anthropic")
    os.environ.setdefault("LLM_MODEL", "test")
    os.environ.setdefault("LLM_API_KEY", "test")
    os.environ.setdefault("LLM_HOST", "https://api.anthropic.com/v1")
    os.environ.setdefault("EMBEDDING_BINDING", "openai")
    os.environ.setdefault("EMBEDDING_MODEL", "test")
    os.environ.setdefault("EMBEDDING_API_KEY", "test")
    os.environ.setdefault("EMBEDDING_HOST", "https://api.voyageai.com/v1")
    os.environ.setdefault("EMBEDDING_DIMENSION", "1024")

    from src.api.routers.tutor import router, session_manager

    # Point session manager at temp dir so tests don't pollute real data
    session_manager.base_dir = tmp_path
    session_manager.sessions_file = tmp_path / "tutor_sessions.json"

    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router, prefix="/api/v1/tutor")
    return TestClient(app)


class TestTutorSessions:
    def test_list_sessions_empty(self, client):
        res = client.get("/api/v1/tutor/sessions")
        assert res.status_code == 200
        assert res.json() == []

    def test_get_session_not_found(self, client):
        res = client.get("/api/v1/tutor/sessions/nonexistent")
        assert res.status_code == 404

    def test_delete_session_not_found(self, client):
        res = client.delete("/api/v1/tutor/sessions/nonexistent")
        assert res.status_code == 404

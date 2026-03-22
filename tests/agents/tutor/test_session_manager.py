"""Tests for TutorSessionManager — session CRUD and persistence."""

import os
import sys
import tempfile

import pytest

PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "..")
sys.path.insert(0, PROJECT_ROOT)

# Import the module directly to avoid src.agents.__init__ pulling in BaseAgent
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "session_manager",
    os.path.join(PROJECT_ROOT, "src", "agents", "tutor", "session_manager.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
TutorSessionManager = _mod.TutorSessionManager


@pytest.fixture
def manager(tmp_path):
    """Create a session manager with a temp directory."""
    return TutorSessionManager(base_dir=str(tmp_path))


class TestCreateSession:
    def test_create_returns_session_dict(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        assert "session_id" in session
        assert session["course_code"] == "AP_CSA"
        assert session["messages"] == []

    def test_session_id_format(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        assert session["session_id"].startswith("tutor_")

    def test_create_with_topic(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
            topic_id="topic-1",
            topic_title="Primitive Types",
            unit_title="Primitive Types",
            unit_number=1,
        )
        assert session["topic_id"] == "topic-1"
        assert session["topic_title"] == "Primitive Types"
        assert session["unit_number"] == 1

    def test_create_persists_to_disk(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        assert manager.sessions_file.exists()

        # Create a new manager pointing to same dir to verify persistence
        manager2 = TutorSessionManager(base_dir=str(manager.base_dir))
        loaded = manager2.get_session(session["session_id"])
        assert loaded is not None
        assert loaded["course_code"] == "AP_CSA"


class TestGetSession:
    def test_get_existing_session(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        result = manager.get_session(session["session_id"])
        assert result is not None
        assert result["session_id"] == session["session_id"]

    def test_get_nonexistent_session(self, manager):
        result = manager.get_session("nonexistent")
        assert result is None


class TestAddMessage:
    def test_add_user_message(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        manager.add_message(session["session_id"], "user", "Hello")

        updated = manager.get_session(session["session_id"])
        assert len(updated["messages"]) == 1
        assert updated["messages"][0]["role"] == "user"
        assert updated["messages"][0]["content"] == "Hello"

    def test_add_assistant_message_with_sources(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        sources = [{"kb_name": "ap-csa", "content": "Java has 8 primitive types."}]
        manager.add_message(session["session_id"], "assistant", "Response here", sources=sources)

        updated = manager.get_session(session["session_id"])
        assert updated["messages"][0]["sources"] == sources

    def test_add_to_nonexistent_session_raises(self, manager):
        with pytest.raises(ValueError, match="Session not found"):
            manager.add_message("nonexistent", "user", "Hello")

    def test_multiple_messages_ordered(self, manager):
        session = manager.create_session(
            course_id="course-1",
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )
        manager.add_message(session["session_id"], "user", "Q1")
        manager.add_message(session["session_id"], "assistant", "A1")
        manager.add_message(session["session_id"], "user", "Q2")

        updated = manager.get_session(session["session_id"])
        assert len(updated["messages"]) == 3
        assert updated["messages"][0]["content"] == "Q1"
        assert updated["messages"][1]["content"] == "A1"
        assert updated["messages"][2]["content"] == "Q2"


class TestListSessions:
    def test_list_empty(self, manager):
        result = manager.list_sessions()
        assert result == []

    def test_list_returns_sessions(self, manager):
        manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        manager.create_session(course_id="c2", course_code="AP_CSP", course_name="CSP")

        result = manager.list_sessions()
        assert len(result) == 2

    def test_list_excludes_messages_by_default(self, manager):
        session = manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        manager.add_message(session["session_id"], "user", "Hello")

        result = manager.list_sessions()
        assert "messages" not in result[0]

    def test_list_includes_messages_when_requested(self, manager):
        session = manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        manager.add_message(session["session_id"], "user", "Hello")

        result = manager.list_sessions(include_messages=True)
        assert "messages" in result[0]
        assert len(result[0]["messages"]) == 1

    def test_list_filter_by_course(self, manager):
        manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        manager.create_session(course_id="c2", course_code="AP_CSP", course_name="CSP")
        manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")

        result = manager.list_sessions(course_id="c1")
        assert len(result) == 2
        assert all(s["course_id"] == "c1" for s in result)

    def test_list_limit(self, manager):
        for i in range(10):
            manager.create_session(course_id=f"c{i}", course_code="AP_CSA", course_name="CSA")

        result = manager.list_sessions(limit=3)
        assert len(result) == 3


class TestDeleteSession:
    def test_delete_existing(self, manager):
        session = manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        assert manager.delete_session(session["session_id"]) is True
        assert manager.get_session(session["session_id"]) is None

    def test_delete_nonexistent(self, manager):
        assert manager.delete_session("nonexistent") is False

    def test_delete_one_preserves_others(self, manager):
        s1 = manager.create_session(course_id="c1", course_code="AP_CSA", course_name="CSA")
        s2 = manager.create_session(course_id="c2", course_code="AP_CSP", course_name="CSP")

        manager.delete_session(s1["session_id"])
        assert manager.get_session(s1["session_id"]) is None
        assert manager.get_session(s2["session_id"]) is not None


class TestMaxSessions:
    def test_max_sessions_trimmed(self, manager):
        # Create more than MAX_SESSIONS
        original_max = TutorSessionManager.MAX_SESSIONS
        TutorSessionManager.MAX_SESSIONS = 5
        try:
            for i in range(10):
                manager.create_session(course_id=f"c{i}", course_code="AP_CSA", course_name="CSA")

            sessions = manager._load_sessions()
            assert len(sessions) <= 5
        finally:
            TutorSessionManager.MAX_SESSIONS = original_max

"""Tests for the courses API endpoints."""

import os
import sys

import pytest
from fastapi.testclient import TestClient

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from src.database.engine import DB_PATH


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    if not DB_PATH.exists():
        pytest.skip("Seeded database not found — run scripts/seed_courses.py first")

    # Need to set env vars before importing the app
    os.environ.setdefault("LLM_BINDING", "openai")
    os.environ.setdefault("LLM_MODEL", "test")
    os.environ.setdefault("LLM_API_KEY", "test")
    os.environ.setdefault("EMBEDDING_BINDING", "openai")
    os.environ.setdefault("EMBEDDING_MODEL", "test")
    os.environ.setdefault("EMBEDDING_API_KEY", "test")

    from src.api.routers.courses import router
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(router, prefix="/api/v1/courses")
    return TestClient(app)


class TestListCourses:
    def test_list_all_courses(self, client):
        res = client.get("/api/v1/courses/list")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 13

    def test_list_courses_has_required_fields(self, client):
        res = client.get("/api/v1/courses/list")
        course = res.json()[0]
        required_fields = {"id", "code", "name", "subject_area", "description", "unit_count", "topic_count"}
        assert required_fields.issubset(set(course.keys()))

    def test_filter_by_subject_cs(self, client):
        res = client.get("/api/v1/courses/list?subject_area=computer_science")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert all(c["subject_area"] == "computer_science" for c in data)

    def test_filter_by_subject_math(self, client):
        res = client.get("/api/v1/courses/list?subject_area=math")
        data = res.json()
        assert len(data) == 4
        assert all(c["subject_area"] == "math" for c in data)

    def test_filter_by_subject_science(self, client):
        res = client.get("/api/v1/courses/list?subject_area=science")
        data = res.json()
        assert len(data) == 7
        assert all(c["subject_area"] == "science" for c in data)

    def test_filter_invalid_subject_returns_empty(self, client):
        res = client.get("/api/v1/courses/list?subject_area=nonexistent")
        assert res.status_code == 200
        assert res.json() == []


class TestListSubjects:
    def test_list_subjects(self, client):
        res = client.get("/api/v1/courses/subjects")
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 3
        areas = {s["subject_area"] for s in data}
        assert areas == {"computer_science", "math", "science"}

    def test_subject_counts(self, client):
        res = client.get("/api/v1/courses/subjects")
        data = {s["subject_area"]: s["count"] for s in res.json()}
        assert data["computer_science"] == 2
        assert data["math"] == 4
        assert data["science"] == 7


class TestGetCourse:
    def _get_course_id(self, client, code: str) -> str:
        res = client.get("/api/v1/courses/list")
        for c in res.json():
            if c["code"] == code:
                return c["id"]
        raise ValueError(f"Course {code} not found")

    def test_get_course_detail(self, client):
        course_id = self._get_course_id(client, "AP_CSA")
        res = client.get(f"/api/v1/courses/{course_id}")
        assert res.status_code == 200
        data = res.json()
        assert data["code"] == "AP_CSA"
        assert data["name"] == "AP Computer Science A"
        assert "units" in data
        assert len(data["units"]) == 10

    def test_course_detail_has_topics(self, client):
        course_id = self._get_course_id(client, "AP_CSA")
        res = client.get(f"/api/v1/courses/{course_id}")
        data = res.json()
        unit1 = data["units"][0]
        assert "topics" in unit1
        assert len(unit1["topics"]) > 0
        topic = unit1["topics"][0]
        assert "topic_number" in topic
        assert "title" in topic

    def test_course_detail_has_exam_format(self, client):
        course_id = self._get_course_id(client, "AP_CALC_AB")
        res = client.get(f"/api/v1/courses/{course_id}")
        data = res.json()
        assert data["exam_format"] is not None
        assert "sections" in data["exam_format"]

    def test_course_not_found(self, client):
        res = client.get("/api/v1/courses/nonexistent-id")
        assert res.status_code == 404

    def test_all_courses_retrievable(self, client):
        """Every course from list should be retrievable by ID."""
        courses = client.get("/api/v1/courses/list").json()
        for c in courses:
            res = client.get(f"/api/v1/courses/{c['id']}")
            assert res.status_code == 200
            assert res.json()["code"] == c["code"]


class TestGetUnit:
    def _get_first_unit(self, client) -> tuple:
        courses = client.get("/api/v1/courses/list").json()
        course_id = courses[0]["id"]
        course = client.get(f"/api/v1/courses/{course_id}").json()
        unit = course["units"][0]
        return course_id, unit["id"]

    def test_get_unit_detail(self, client):
        course_id, unit_id = self._get_first_unit(client)
        res = client.get(f"/api/v1/courses/{course_id}/units/{unit_id}")
        assert res.status_code == 200
        data = res.json()
        assert "topics" in data
        assert "course_name" in data

    def test_unit_not_found(self, client):
        courses = client.get("/api/v1/courses/list").json()
        course_id = courses[0]["id"]
        res = client.get(f"/api/v1/courses/{course_id}/units/nonexistent")
        assert res.status_code == 404


class TestGetTopic:
    def _get_first_topic(self, client) -> tuple:
        courses = client.get("/api/v1/courses/list").json()
        course_id = courses[0]["id"]
        course = client.get(f"/api/v1/courses/{course_id}").json()
        topic = course["units"][0]["topics"][0]
        return course_id, topic["id"]

    def test_get_topic_detail(self, client):
        course_id, topic_id = self._get_first_topic(client)
        res = client.get(f"/api/v1/courses/{course_id}/topics/{topic_id}")
        assert res.status_code == 200
        data = res.json()
        assert "title" in data
        assert "unit_title" in data
        assert "course_name" in data

    def test_topic_not_found(self, client):
        courses = client.get("/api/v1/courses/list").json()
        course_id = courses[0]["id"]
        res = client.get(f"/api/v1/courses/{course_id}/topics/nonexistent")
        assert res.status_code == 404

    def test_topic_wrong_course(self, client):
        """A topic from one course shouldn't be accessible under another course's URL."""
        courses = client.get("/api/v1/courses/list").json()
        # Get a topic from first course
        c1_id = courses[0]["id"]
        c1 = client.get(f"/api/v1/courses/{c1_id}").json()
        topic_id = c1["units"][0]["topics"][0]["id"]

        # Try to access it under second course
        c2_id = courses[1]["id"]
        res = client.get(f"/api/v1/courses/{c2_id}/topics/{topic_id}")
        assert res.status_code == 404

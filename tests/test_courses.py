"""Tests for AP Academy course catalog — database models and API endpoints."""

import json

import pytest
from fastapi.testclient import TestClient

from src.database.engine import get_db, init_db
from src.database.models import Course, Unit, Topic

# ── Expected data ────────────────────────────────────────────────────────────

EXPECTED_COURSE_SUBJECTS = {
    "AP_CSA": "computer_science",
    "AP_CSP": "computer_science",
    "AP_CALC_AB": "math",
    "AP_CALC_BC": "math",
    "AP_PRECALC": "math",
    "AP_STATS": "math",
    "AP_BIO": "science",
    "AP_CHEM": "science",
    "AP_ENV_SCI": "science",
    "AP_PHYS1": "science",
    "AP_PHYS2": "science",
    "AP_PHYSC_EM": "science",
    "AP_PHYSC_MECH": "science",
}

EXPECTED_UNIT_COUNTS = {
    "AP_CSA": 10,
    "AP_CSP": 5,
    "AP_CALC_AB": 8,
    "AP_CALC_BC": 10,
    "AP_PRECALC": 4,
    "AP_STATS": 9,
    "AP_BIO": 8,
    "AP_CHEM": 9,
    "AP_ENV_SCI": 9,
    "AP_PHYS1": 7,
    "AP_PHYS2": 7,
    "AP_PHYSC_EM": 5,
    "AP_PHYSC_MECH": 7,
}

SUBJECT_COUNTS = {"computer_science": 2, "math": 4, "science": 7}

# ── Database / model tests ───────────────────────────────────────────────────


class TestDatabase:
    """Verify the seeded SQLite database."""

    def setup_method(self):
        init_db()
        self.db = get_db()

    def teardown_method(self):
        self.db.close()

    def test_database_initializes(self):
        """Tables exist and a basic query succeeds."""
        count = self.db.query(Course).count()
        assert count > 0

    def test_course_count_is_13(self):
        """Exactly 13 AP courses are seeded."""
        assert self.db.query(Course).count() == 13

    def test_course_subject_areas(self):
        """Each course has the correct subject_area."""
        courses = self.db.query(Course).all()
        for course in courses:
            expected = EXPECTED_COURSE_SUBJECTS.get(course.code)
            assert expected is not None, f"Unexpected course code: {course.code}"
            assert course.subject_area == expected, (
                f"{course.code}: expected subject_area={expected}, got {course.subject_area}"
            )

    def test_course_unit_counts(self):
        """Each course has the expected number of units."""
        courses = self.db.query(Course).all()
        for course in courses:
            expected = EXPECTED_UNIT_COUNTS[course.code]
            actual = len(course.units)
            assert actual == expected, (
                f"{course.code}: expected {expected} units, got {actual}"
            )

    def test_total_topic_count_is_683(self):
        """Total number of topics across all courses is 683."""
        assert self.db.query(Topic).count() == 683

    def test_course_codes_unique(self):
        """All course codes are unique."""
        codes = [c.code for c in self.db.query(Course).all()]
        assert len(codes) == len(set(codes))


# ── API endpoint tests ───────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def client():
    """Create a TestClient that skips the lifespan (config validation / LLM init)."""
    from src.api.routers.courses import router
    from fastapi import FastAPI

    test_app = FastAPI()
    test_app.include_router(router, prefix="/api/v1/courses")
    return TestClient(test_app)


class TestCourseListAPI:
    """Tests for GET /api/v1/courses/list."""

    def test_list_returns_13_courses(self, client):
        resp = client.get("/api/v1/courses/list")
        assert resp.status_code == 200
        assert len(resp.json()) == 13

    def test_list_filter_math(self, client):
        resp = client.get("/api/v1/courses/list", params={"subject_area": "math"})
        data = resp.json()
        assert resp.status_code == 200
        assert len(data) == SUBJECT_COUNTS["math"]
        assert all(c["subject_area"] == "math" for c in data)

    def test_list_filter_computer_science(self, client):
        resp = client.get("/api/v1/courses/list", params={"subject_area": "computer_science"})
        data = resp.json()
        assert len(data) == SUBJECT_COUNTS["computer_science"]
        assert all(c["subject_area"] == "computer_science" for c in data)

    def test_list_filter_science(self, client):
        resp = client.get("/api/v1/courses/list", params={"subject_area": "science"})
        data = resp.json()
        assert len(data) == SUBJECT_COUNTS["science"]
        assert all(c["subject_area"] == "science" for c in data)


class TestSubjectsAPI:
    """Tests for GET /api/v1/courses/subjects."""

    def test_subjects_returns_3(self, client):
        resp = client.get("/api/v1/courses/subjects")
        assert resp.status_code == 200
        subjects = resp.json()
        assert len(subjects) == 3

    def test_subjects_have_correct_labels(self, client):
        resp = client.get("/api/v1/courses/subjects")
        labels = {s["subject_area"]: s["label"] for s in resp.json()}
        assert labels["computer_science"] == "Computer Science"
        assert labels["math"] == "Mathematics"
        assert labels["science"] == "Science"


class TestCourseDetailAPI:
    """Tests for GET /api/v1/courses/{id}."""

    @pytest.fixture(autouse=True)
    def _fetch_first_course_id(self, client):
        """Grab a real course id for detail tests."""
        resp = client.get("/api/v1/courses/list")
        self.course = resp.json()[0]
        self.course_id = self.course["id"]

    def test_course_detail_success(self, client):
        resp = client.get(f"/api/v1/courses/{self.course_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == self.course_id
        assert "units" in data

    def test_course_detail_has_units_and_topics(self, client):
        resp = client.get(f"/api/v1/courses/{self.course_id}")
        data = resp.json()
        assert len(data["units"]) > 0
        first_unit = data["units"][0]
        assert "topics" in first_unit
        assert len(first_unit["topics"]) > 0

    def test_course_detail_exam_format_is_parsed_json(self, client):
        resp = client.get(f"/api/v1/courses/{self.course_id}")
        data = resp.json()
        exam = data.get("exam_format")
        assert exam is not None, "exam_format should not be None"
        assert isinstance(exam, dict), "exam_format should be parsed JSON (dict)"

    def test_course_detail_invalid_id_returns_404(self, client):
        resp = client.get("/api/v1/courses/nonexistent-id-12345")
        assert resp.status_code == 404

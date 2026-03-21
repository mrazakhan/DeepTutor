"""Tests for AP Academy database models and seed data integrity."""

import os
import sys
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.database.models import Base, Course, Unit, Topic, LearningObjective


@pytest.fixture
def db_session():
    """Create a fresh in-memory database for each test."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


class TestModels:
    """Test SQLAlchemy model creation and relationships."""

    def test_create_course(self, db_session):
        course = Course(
            code="TEST_101",
            name="Test Course",
            subject_area="math",
            description="A test course",
        )
        db_session.add(course)
        db_session.commit()

        result = db_session.query(Course).filter_by(code="TEST_101").first()
        assert result is not None
        assert result.name == "Test Course"
        assert result.subject_area == "math"
        assert result.is_active is True
        assert result.id is not None

    def test_course_code_unique(self, db_session):
        c1 = Course(code="UNIQUE_1", name="Course 1", subject_area="math")
        c2 = Course(code="UNIQUE_1", name="Course 2", subject_area="science")
        db_session.add(c1)
        db_session.commit()
        db_session.add(c2)
        with pytest.raises(Exception):
            db_session.commit()

    def test_course_unit_relationship(self, db_session):
        course = Course(code="REL_TEST", name="Rel Test", subject_area="science")
        db_session.add(course)
        db_session.flush()

        u1 = Unit(course_id=course.id, unit_number=1, title="Unit 1")
        u2 = Unit(course_id=course.id, unit_number=2, title="Unit 2")
        db_session.add_all([u1, u2])
        db_session.commit()

        assert len(course.units) == 2
        assert course.units[0].title == "Unit 1"
        assert course.units[1].title == "Unit 2"

    def test_unit_topic_relationship(self, db_session):
        course = Course(code="TOPIC_TEST", name="Topic Test", subject_area="math")
        db_session.add(course)
        db_session.flush()

        unit = Unit(course_id=course.id, unit_number=1, title="Unit 1")
        db_session.add(unit)
        db_session.flush()

        t1 = Topic(unit_id=unit.id, topic_number="1.1", title="Topic A")
        t2 = Topic(unit_id=unit.id, topic_number="1.2", title="Topic B")
        db_session.add_all([t1, t2])
        db_session.commit()

        assert len(unit.topics) == 2
        assert unit.topics[0].topic_number == "1.1"

    def test_topic_learning_objective_relationship(self, db_session):
        course = Course(code="LO_TEST", name="LO Test", subject_area="science")
        db_session.add(course)
        db_session.flush()

        unit = Unit(course_id=course.id, unit_number=1, title="Unit 1")
        db_session.add(unit)
        db_session.flush()

        topic = Topic(unit_id=unit.id, topic_number="1.1", title="Topic A")
        db_session.add(topic)
        db_session.flush()

        lo = LearningObjective(
            topic_id=topic.id,
            objective_code="MOD-1.A",
            description="Understand modules",
            skill_category="Concept",
        )
        db_session.add(lo)
        db_session.commit()

        assert len(topic.learning_objectives) == 1
        assert topic.learning_objectives[0].objective_code == "MOD-1.A"

    def test_cascade_delete(self, db_session):
        """Deleting a course should cascade-delete units and topics."""
        course = Course(code="CASCADE", name="Cascade Test", subject_area="math")
        db_session.add(course)
        db_session.flush()

        unit = Unit(course_id=course.id, unit_number=1, title="Unit 1")
        db_session.add(unit)
        db_session.flush()

        topic = Topic(unit_id=unit.id, topic_number="1.1", title="Topic A")
        db_session.add(topic)
        db_session.commit()

        db_session.delete(course)
        db_session.commit()

        assert db_session.query(Course).count() == 0
        assert db_session.query(Unit).count() == 0
        assert db_session.query(Topic).count() == 0

    def test_unit_ordering(self, db_session):
        """Units should be ordered by unit_number."""
        course = Course(code="ORDER_TEST", name="Order Test", subject_area="math")
        db_session.add(course)
        db_session.flush()

        # Add out of order
        u3 = Unit(course_id=course.id, unit_number=3, title="Third")
        u1 = Unit(course_id=course.id, unit_number=1, title="First")
        u2 = Unit(course_id=course.id, unit_number=2, title="Second")
        db_session.add_all([u3, u1, u2])
        db_session.commit()

        # Expire to force reload with ordering
        db_session.expire_all()
        units = course.units
        assert [u.unit_number for u in units] == [1, 2, 3]


class TestSeedData:
    """Test the actual seeded database for integrity."""

    @pytest.fixture
    def seeded_session(self):
        """Use the real seeded database."""
        from src.database.engine import get_engine, get_session_factory, DB_PATH

        if not DB_PATH.exists():
            pytest.skip("Seeded database not found — run scripts/seed_courses.py first")

        session = get_session_factory()()
        yield session
        session.close()

    def test_13_courses_exist(self, seeded_session):
        count = seeded_session.query(Course).count()
        assert count == 13, f"Expected 13 courses, got {count}"

    def test_all_subject_areas_present(self, seeded_session):
        areas = {c.subject_area for c in seeded_session.query(Course).all()}
        assert areas == {"computer_science", "math", "science"}

    def test_cs_courses(self, seeded_session):
        cs = seeded_session.query(Course).filter_by(subject_area="computer_science").all()
        codes = {c.code for c in cs}
        assert codes == {"AP_CSA", "AP_CSP"}

    def test_math_courses(self, seeded_session):
        math = seeded_session.query(Course).filter_by(subject_area="math").all()
        codes = {c.code for c in math}
        assert codes == {"AP_CALC_AB", "AP_CALC_BC", "AP_STATS", "AP_PRECALC"}

    def test_science_courses(self, seeded_session):
        sci = seeded_session.query(Course).filter_by(subject_area="science").all()
        codes = {c.code for c in sci}
        assert codes == {"AP_BIO", "AP_CHEM", "AP_PHYS1", "AP_PHYS2", "AP_PHYSC_MECH", "AP_PHYSC_EM", "AP_ENV_SCI"}

    def test_every_course_has_units(self, seeded_session):
        for course in seeded_session.query(Course).all():
            assert len(course.units) > 0, f"{course.name} has no units"

    def test_every_unit_has_topics(self, seeded_session):
        for unit in seeded_session.query(Unit).all():
            assert len(unit.topics) > 0, f"Unit '{unit.title}' has no topics"

    def test_total_topic_count(self, seeded_session):
        count = seeded_session.query(Topic).count()
        assert count == 683, f"Expected 683 topics, got {count}"

    def test_course_codes_unique(self, seeded_session):
        codes = [c.code for c in seeded_session.query(Course).all()]
        assert len(codes) == len(set(codes)), "Duplicate course codes found"

    def test_ap_csa_has_10_units(self, seeded_session):
        csa = seeded_session.query(Course).filter_by(code="AP_CSA").first()
        assert len(csa.units) == 10

    def test_ap_calc_ab_has_exam_format(self, seeded_session):
        import json
        calc = seeded_session.query(Course).filter_by(code="AP_CALC_AB").first()
        assert calc.exam_format is not None
        fmt = json.loads(calc.exam_format)
        assert "sections" in fmt
        assert len(fmt["sections"]) == 4

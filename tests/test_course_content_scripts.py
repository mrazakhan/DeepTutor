"""Tests for course content download and ingestion scripts.

Tests course code alignment, file discovery, and script configuration
without actually downloading or ingesting content.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestCourseCodeAlignment:
    """Verify that download and ingest scripts use the same course codes,
    and that those codes match the DB's code.lower().replace('_', '-') convention."""

    def _load_download_courses(self):
        """Import COURSE_CONTENT from download script."""
        from scripts.download_course_content import COURSE_CONTENT
        return COURSE_CONTENT

    def _load_ingest_groups(self):
        """Import COURSE_GROUPS from ingest script."""
        from scripts.ingest_course_content import COURSE_GROUPS
        return COURSE_GROUPS

    def test_download_keys_are_lowercase_hyphenated(self):
        courses = self._load_download_courses()
        for key in courses:
            assert key == key.lower(), f"Key '{key}' should be lowercase"
            assert "_" not in key, f"Key '{key}' should use hyphens, not underscores"

    def test_ingest_keys_are_lowercase_hyphenated(self):
        groups = self._load_ingest_groups()
        for codes in groups.values():
            for code in codes:
                assert code == code.lower(), f"Code '{code}' should be lowercase"
                assert "_" not in code, f"Code '{code}' should use hyphens, not underscores"

    def test_cs_courses_match(self):
        download = self._load_download_courses()
        ingest = self._load_ingest_groups()

        cs_download = {k for k in download if k.startswith("ap-cs")}
        cs_ingest = set(ingest["cs"])

        assert cs_download == cs_ingest, (
            f"CS mismatch: download has {cs_download}, ingest has {cs_ingest}"
        )

    def test_math_courses_match(self):
        download = self._load_download_courses()
        ingest = self._load_ingest_groups()

        math_keys = {"ap-calc-ab", "ap-calc-bc", "ap-stats", "ap-precalc"}
        math_download = {k for k in download if k in math_keys}
        math_ingest = set(ingest["math"])

        assert math_download == math_ingest, (
            f"Math mismatch: download has {math_download}, ingest has {math_ingest}"
        )

    def test_db_code_to_kb_name_convention(self):
        """DB codes (AP_CSA, AP_CALC_AB) map to KB names (ap-csa, ap-calc-ab)."""
        db_codes = [
            "AP_CSA", "AP_CSP",
            "AP_CALC_AB", "AP_CALC_BC", "AP_STATS", "AP_PRECALC",
            "AP_BIO", "AP_CHEM", "AP_PHYS1", "AP_PHYS2",
            "AP_PHYSC_MECH", "AP_PHYSC_EM", "AP_ENV_SCI",
        ]
        download = self._load_download_courses()

        for code in db_codes:
            kb_name = code.lower().replace("_", "-")
            assert kb_name in download, (
                f"DB code '{code}' maps to '{kb_name}' but not found in download script"
            )


class TestDownloadConfig:
    """Test download script configuration."""

    def test_all_courses_have_sources(self):
        from scripts.download_course_content import COURSE_CONTENT
        for code, info in COURSE_CONTENT.items():
            assert "sources" in info, f"Course '{code}' missing 'sources'"
            assert len(info["sources"]) > 0, f"Course '{code}' has no sources"

    def test_all_sources_have_required_fields(self):
        from scripts.download_course_content import COURSE_CONTENT
        required = {"name", "url", "filename", "license"}
        for code, info in COURSE_CONTENT.items():
            for source in info["sources"]:
                missing = required - set(source.keys())
                assert not missing, (
                    f"Course '{code}' source '{source.get('name', '?')}' "
                    f"missing fields: {missing}"
                )

    def test_filenames_are_pdf(self):
        from scripts.download_course_content import COURSE_CONTENT
        for code, info in COURSE_CONTENT.items():
            for source in info["sources"]:
                assert source["filename"].endswith(".pdf"), (
                    f"Course '{code}' filename '{source['filename']}' is not a PDF"
                )

    def test_urls_are_https(self):
        from scripts.download_course_content import COURSE_CONTENT
        for code, info in COURSE_CONTENT.items():
            for source in info["sources"]:
                assert source["url"].startswith("https://"), (
                    f"Course '{code}' URL '{source['url']}' should use HTTPS"
                )

    def test_no_duplicate_filenames_per_course(self):
        from scripts.download_course_content import COURSE_CONTENT
        for code, info in COURSE_CONTENT.items():
            filenames = [s["filename"] for s in info["sources"]]
            assert len(filenames) == len(set(filenames)), (
                f"Course '{code}' has duplicate filenames"
            )


class TestIngestConfig:
    """Test ingest script configuration."""

    def test_all_groups_exist(self):
        from scripts.ingest_course_content import COURSE_GROUPS
        assert "cs" in COURSE_GROUPS
        assert "math" in COURSE_GROUPS
        assert "science" in COURSE_GROUPS

    def test_no_duplicate_courses_across_groups(self):
        from scripts.ingest_course_content import COURSE_GROUPS
        all_courses = []
        for codes in COURSE_GROUPS.values():
            all_courses.extend(codes)
        assert len(all_courses) == len(set(all_courses)), "Duplicate courses across groups"

    def test_total_course_count(self):
        from scripts.ingest_course_content import COURSE_GROUPS
        total = sum(len(codes) for codes in COURSE_GROUPS.values())
        assert total == 13, f"Expected 13 courses, got {total}"

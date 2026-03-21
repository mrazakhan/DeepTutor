#!/usr/bin/env python3
"""
Download AP Course Content for DeepTutor++

Downloads free, open-source course materials for AP courses
and organizes them into per-course directories ready for KB ingestion.

Course codes match the database (e.g., AP_CSA -> ap-csa as KB name).

Usage:
    python scripts/download_course_content.py [--courses cs math science all]
    python scripts/download_course_content.py --courses cs math   # Phase 2A
    python scripts/download_course_content.py --courses science   # Phase 2B
"""

import argparse
from pathlib import Path
from urllib.request import Request, urlopen

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONTENT_DIR = PROJECT_ROOT / "data" / "course_content"


# =============================================================================
# Course Content Sources
# Keys = DB code lowered + underscore->hyphen (e.g., AP_CSA -> ap-csa)
# =============================================================================

COURSE_CONTENT = {
    # CS
    "ap-csa": {
        "name": "AP Computer Science A",
        "sources": [
            {
                "name": "Think Java 2 (AP CSA Textbook)",
                "url": "https://greenteapress.com/thinkjava7/thinkjava2.pdf",
                "filename": "think_java_2.pdf",
                "license": "CC BY-NC-SA 4.0",
            },
            {
                "name": "Intro to Programming Using Java (Eck)",
                "url": "https://math.hws.edu/eck/cs124/downloads/javanotes7-linked.pdf",
                "filename": "javanotes7.pdf",
                "license": "CC BY-NC-SA 3.0",
            },
            {
                "name": "AP CSA Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-course-and-exam-description-effective-fall-2025.pdf",
                "filename": "ap_csa_ced.pdf",
                "license": "College Board public",
            },
            {
                "name": "AP CSA Java Quick Reference",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-computer-science-a-java-quick-reference.pdf",
                "filename": "ap_csa_java_quick_ref.pdf",
                "license": "College Board public",
            },
        ],
    },
    "ap-csp": {
        "name": "AP Computer Science Principles",
        "sources": [
            {
                "name": "Blown to Bits (Digital Information Book)",
                "url": "https://www.bitsbook.com/wp-content/uploads/2023/01/B2B_3rd_Edition2023-01-17.pdf",
                "filename": "blown_to_bits.pdf",
                "license": "CC BY-NC-SA 4.0",
            },
            {
                "name": "AP CSP Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-computer-science-principles-course-and-exam-description.pdf",
                "filename": "ap_csp_ced.pdf",
                "license": "College Board public",
            },
        ],
    },
    # Math
    "ap-calc-ab": {
        "name": "AP Calculus AB",
        "sources": [
            {
                "name": "OpenStax Calculus Volume 1",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Calculus_Volume_1_-_WEB_68M1Z5W.pdf",
                "filename": "openstax_calculus_vol1.pdf",
                "license": "CC BY 4.0",
            },
            {
                "name": "AP Calculus AB/BC Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf",
                "filename": "ap_calc_ab_bc_ced.pdf",
                "license": "College Board public",
            },
        ],
    },
    "ap-calc-bc": {
        "name": "AP Calculus BC",
        "sources": [
            {
                "name": "OpenStax Calculus Volume 2",
                "url": "https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/CalculusVolume2-OP_esPpXTB.pdf",
                "filename": "openstax_calculus_vol2.pdf",
                "license": "CC BY 4.0",
            },
            {
                "name": "AP Calculus AB/BC Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-calculus-ab-and-bc-course-and-exam-description.pdf",
                "filename": "ap_calc_ab_bc_ced.pdf",
                "license": "College Board public",
            },
        ],
    },
    "ap-stats": {
        "name": "AP Statistics",
        "sources": [
            {
                "name": "OpenStax Introductory Statistics 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Introductory_Statistics_2e_-_WEB.pdf",
                "filename": "openstax_statistics_2e.pdf",
                "license": "CC BY 4.0",
            },
            {
                "name": "AP Statistics Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-statistics-course-and-exam-description.pdf",
                "filename": "ap_stats_ced.pdf",
                "license": "College Board public",
            },
        ],
    },
    "ap-precalc": {
        "name": "AP Precalculus",
        "sources": [
            {
                "name": "OpenStax Precalculus 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Precalculus2e-WEB_Rea8mN8.pdf",
                "filename": "openstax_precalculus_2e.pdf",
                "license": "CC BY 4.0",
            },
            {
                "name": "AP Precalculus Course & Exam Description",
                "url": "https://apcentral.collegeboard.org/media/pdf/ap-precalculus-course-and-exam-description.pdf",
                "filename": "ap_precalc_ced.pdf",
                "license": "College Board public",
            },
        ],
    },
    # Science (Phase 2B)
    "ap-bio": {
        "name": "AP Biology",
        "sources": [
            {
                "name": "OpenStax Biology 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB_Rea8mN8.pdf",
                "filename": "openstax_biology_2e.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-chem": {
        "name": "AP Chemistry",
        "sources": [
            {
                "name": "OpenStax Chemistry 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Chemistry2e-WEB_Rea8mN8.pdf",
                "filename": "openstax_chemistry_2e.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-phys1": {
        "name": "AP Physics 1",
        "sources": [
            {
                "name": "OpenStax College Physics 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/College_Physics_2e-WEB_7Zesqz6.pdf",
                "filename": "openstax_college_physics_2e.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-phys2": {
        "name": "AP Physics 2",
        "sources": [
            {
                "name": "OpenStax College Physics 2e",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/College_Physics_2e-WEB_7Zesqz6.pdf",
                "filename": "openstax_college_physics_2e.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-physc-mech": {
        "name": "AP Physics C: Mechanics",
        "sources": [
            {
                "name": "OpenStax University Physics Volume 1",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/UniversityPhysicsVolume1-WEB_7Zesqz6.pdf",
                "filename": "openstax_university_physics_vol1.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-physc-em": {
        "name": "AP Physics C: E&M",
        "sources": [
            {
                "name": "OpenStax University Physics Volume 2",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/UniversityPhysicsVolume2-WEB_7Zesqz6.pdf",
                "filename": "openstax_university_physics_vol2.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
    "ap-env-sci": {
        "name": "AP Environmental Science",
        "sources": [
            {
                "name": "OpenStax Biology 2e (Environmental chapters)",
                "url": "https://assets.openstax.org/oscms-prodcms/media/documents/Biology2e-WEB_Rea8mN8.pdf",
                "filename": "openstax_biology_2e.pdf",
                "license": "CC BY 4.0",
            },
        ],
    },
}

# Course groups
COURSE_GROUPS = {
    "cs": ["ap-csa", "ap-csp"],
    "math": ["ap-calc-ab", "ap-calc-bc", "ap-stats", "ap-precalc"],
    "science": [
        "ap-bio", "ap-chem", "ap-phys1", "ap-phys2",
        "ap-physc-mech", "ap-physc-em", "ap-env-sci",
    ],
}


def download_file(url: str, dest: Path, name: str) -> bool:
    """Download a file with progress indication."""
    if dest.exists():
        print(f"  [skip] {name} already downloaded ({dest.stat().st_size // 1024 // 1024}MB)")
        return True

    print(f"  [downloading] {name}...")
    print(f"    URL: {url}")

    try:
        req = Request(url, headers={"User-Agent": "DeepTutor++/1.0"})
        with urlopen(req) as response:
            total = int(response.headers.get("Content-Length", 0))
            downloaded = 0
            with open(dest, "wb") as f:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total > 0:
                        pct = downloaded * 100 // total
                        mb = downloaded // 1024 // 1024
                        print(f"\r    Progress: {pct}% ({mb}MB)", end="", flush=True)
            print()

        size_mb = dest.stat().st_size / 1024 / 1024
        print(f"  [done] {name} ({size_mb:.1f}MB)")
        return True
    except Exception as e:
        print(f"  [error] Failed to download {name}: {e}")
        if dest.exists():
            dest.unlink()
        return False


def download_courses(course_codes: list[str]) -> dict[str, list[Path]]:
    """Download content for specified courses."""
    results = {}
    for code in course_codes:
        if code not in COURSE_CONTENT:
            print(f"[warn] Unknown course code: {code}")
            continue

        course = COURSE_CONTENT[code]
        print(f"\n{'='*60}")
        print(f"Course: {course['name']} ({code})")
        print(f"{'='*60}")

        course_dir = CONTENT_DIR / code
        course_dir.mkdir(parents=True, exist_ok=True)

        downloaded = []
        for source in course["sources"]:
            dest = course_dir / source["filename"]
            if download_file(source["url"], dest, source["name"]):
                downloaded.append(dest)

        results[code] = downloaded
        print(f"  Total: {len(downloaded)}/{len(course['sources'])} files downloaded")

    return results


def main():
    parser = argparse.ArgumentParser(description="Download AP course content")
    parser.add_argument(
        "--courses", nargs="+",
        choices=["cs", "math", "science", "all"],
        default=["cs", "math"],
        help="Course groups to download (default: cs math)",
    )
    parser.add_argument("--list", action="store_true", help="List available courses")

    args = parser.parse_args()

    if args.list:
        for group, codes in COURSE_GROUPS.items():
            print(f"\n{group.upper()}:")
            for code in codes:
                info = COURSE_CONTENT[code]
                print(f"  {code:20s} {info['name']}")
        return

    course_codes = []
    for group in args.courses:
        if group == "all":
            for codes in COURSE_GROUPS.values():
                course_codes.extend(codes)
            break
        else:
            course_codes.extend(COURSE_GROUPS[group])

    # Deduplicate
    seen = set()
    course_codes = [c for c in course_codes if c not in seen and not seen.add(c)]

    print(f"Downloading content for {len(course_codes)} courses...")
    print(f"Content directory: {CONTENT_DIR}")

    results = download_courses(course_codes)

    print(f"\n{'='*60}")
    print("DOWNLOAD SUMMARY")
    print(f"{'='*60}")
    total_files = 0
    total_size = 0
    for code, files in results.items():
        size = sum(f.stat().st_size for f in files if f.exists())
        total_files += len(files)
        total_size += size
        print(f"  {code:20s} {len(files)} files, {size // 1024 // 1024}MB")

    print(f"\n  Total: {total_files} files, {total_size // 1024 // 1024}MB")
    print(f"\nNext: python scripts/ingest_course_content.py")


if __name__ == "__main__":
    main()

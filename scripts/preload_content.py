#!/usr/bin/env python3
"""Preload content for all topics across courses via the DeepTutor API."""

import argparse
import sys
import time

import requests


def get_courses(base_url: str) -> list[dict]:
    resp = requests.get(f"{base_url}/api/v1/courses/list", timeout=30)
    resp.raise_for_status()
    return resp.json()


def get_course_detail(base_url: str, course_id: str) -> dict:
    resp = requests.get(f"{base_url}/api/v1/courses/{course_id}", timeout=30)
    resp.raise_for_status()
    return resp.json()


def topic_has_content(base_url: str, course_id: str, topic_id: str) -> bool:
    resp = requests.get(
        f"{base_url}/api/v1/courses/{course_id}/topics/{topic_id}/content",
        timeout=30,
    )
    if resp.status_code == 404:
        return False
    resp.raise_for_status()
    return True


def preload_topic(base_url: str, course_id: str, topic_id: str) -> None:
    resp = requests.post(
        f"{base_url}/api/v1/courses/{course_id}/topics/{topic_id}/preload",
        timeout=600,
    )
    resp.raise_for_status()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Preload content for DeepTutor course topics."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8001",
        help="API base URL (default: http://localhost:8001)",
    )
    parser.add_argument(
        "--courses",
        default=None,
        help="Comma-separated course codes to preload (default: all courses)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List what would be preloaded without making changes",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=1.0,
        help="Delay in seconds between preload requests (default: 1.0)",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    filter_codes = (
        {c.strip() for c in args.courses.split(",")} if args.courses else None
    )

    # Fetch courses
    print(f"Fetching courses from {base_url} ...")
    try:
        courses = get_courses(base_url)
    except requests.RequestException as e:
        print(f"ERROR: Failed to fetch courses: {e}", file=sys.stderr)
        sys.exit(1)

    if filter_codes:
        courses = [c for c in courses if c.get("code") in filter_codes]
        found_codes = {c.get("code") for c in courses}
        missing = filter_codes - found_codes
        if missing:
            print(f"WARNING: Course codes not found: {', '.join(sorted(missing))}")

    if not courses:
        print("No courses to process.")
        return

    print(f"Found {len(courses)} course(s): {', '.join(c.get('code', c.get('name', '?')) for c in courses)}")

    # Gather all topics
    topics_to_check: list[dict] = []
    for course in courses:
        course_id = course["id"]
        code = course.get("code", course.get("name", str(course_id)))
        try:
            detail = get_course_detail(base_url, course_id)
        except requests.RequestException as e:
            print(f"  ERROR: Failed to fetch course {code}: {e}")
            continue

        units = detail.get("units", [])
        for unit in units:
            unit_title = unit.get("title", f"Unit {unit.get('unit_number', '?')}")
            for topic in unit.get("topics", []):
                topics_to_check.append(
                    {
                        "course_id": course_id,
                        "course_code": code,
                        "unit_title": unit_title,
                        "topic_id": topic["id"],
                        "topic_number": topic.get("topic_number", "?"),
                        "topic_title": topic.get("title", "Untitled"),
                    }
                )

    print(f"Found {len(topics_to_check)} total topic(s). Checking for existing content ...")

    # Filter out topics that already have content
    topics_to_preload: list[dict] = []
    for i, t in enumerate(topics_to_check):
        try:
            has = topic_has_content(base_url, t["course_id"], t["topic_id"])
        except requests.RequestException:
            has = False  # assume missing on error
        if not has:
            topics_to_preload.append(t)
        # Brief status every 20 checks
        if (i + 1) % 20 == 0:
            print(f"  Checked {i + 1}/{len(topics_to_check)} topics ...")

    skipped = len(topics_to_check) - len(topics_to_preload)
    print(f"Skipping {skipped} topic(s) that already have content.")
    print(f"{len(topics_to_preload)} topic(s) need preloading.")

    if not topics_to_preload:
        print("Nothing to do.")
        return

    if args.dry_run:
        print("\n--- DRY RUN: Would preload the following topics ---")
        for i, t in enumerate(topics_to_preload, 1):
            print(
                f"  [{i}/{len(topics_to_preload)}] {t['course_code']} > "
                f"{t['unit_title']} > Topic {t['topic_number']}: {t['topic_title']}"
            )
        print(f"\nTotal: {len(topics_to_preload)} topic(s) would be preloaded.")
        return

    # Preload
    print()
    success = 0
    errors = 0
    for i, t in enumerate(topics_to_preload, 1):
        label = (
            f"{t['course_code']} > {t['unit_title']} > "
            f"Topic {t['topic_number']}: {t['topic_title']}"
        )
        print(f"[{i}/{len(topics_to_preload)}] Preloading {label} ...", flush=True)
        try:
            preload_topic(base_url, t["course_id"], t["topic_id"])
            print(f"  Done.")
            success += 1
        except requests.RequestException as e:
            print(f"  ERROR: {e}")
            errors += 1

        if i < len(topics_to_preload):
            time.sleep(args.delay)

    print(f"\nFinished. {success} succeeded, {errors} failed, {skipped} skipped (already had content).")


if __name__ == "__main__":
    main()

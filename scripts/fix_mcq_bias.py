"""
Shuffle MCQ answer positions to fix answer bias.

The LLM tends to put the correct answer at position B (~70% of the time).
This script redistributes correct answers evenly across A/B/C/D by randomly
shuffling the option positions while preserving which answer is correct.
"""

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database.engine import get_db, init_db
from src.database.models import TopicContent, Topic, Unit, Course


def shuffle_mcq(mcq: dict) -> dict:
    """Shuffle the option positions of a single MCQ."""
    options = mcq.get("options", {})
    correct_key = mcq.get("correct", mcq.get("correct_answer", ""))

    if not isinstance(options, dict) or correct_key not in options:
        return mcq

    # Get correct answer text
    correct_text = options[correct_key]

    # Collect all option texts in a list and shuffle
    keys = sorted(options.keys())  # A, B, C, D
    texts = [options[k] for k in keys]

    # Remember which text is correct
    correct_idx = keys.index(correct_key)
    correct_answer_text = texts[correct_idx]

    # Shuffle the texts
    random.shuffle(texts)

    # Rebuild options and find new correct key
    new_options = {}
    new_correct = ""
    for i, key in enumerate(keys):
        new_options[key] = texts[i]
        if texts[i] == correct_answer_text:
            new_correct = key

    mcq["options"] = new_options
    mcq["correct"] = new_correct
    if "correct_answer" in mcq:
        mcq["correct_answer"] = new_correct

    return mcq


def fix_course(db, course_code: str):
    """Fix all MCQs for a given course."""
    course = db.query(Course).filter(Course.code == course_code).first()
    if not course:
        print(f"  Course {course_code} not found")
        return

    topics = db.query(Topic).join(Unit).filter(Unit.course_id == course.id).all()
    total_fixed = 0

    for topic in topics:
        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic.id).first()
        if not tc or not tc.content:
            continue

        content = json.loads(tc.content)
        mcqs = content.get("practice_mcq", [])

        if not mcqs:
            continue

        # Shuffle each MCQ
        shuffled = [shuffle_mcq(q) if isinstance(q, dict) else q for q in mcqs]
        content["practice_mcq"] = shuffled

        # Also fix extra FRQs MCQs if present
        extra_frqs = content.get("extra_frqs", [])

        tc.content = json.dumps(content)
        total_fixed += len(mcqs)

    db.commit()

    # Verify new distribution
    dist = {"A": 0, "B": 0, "C": 0, "D": 0}
    for topic in topics:
        tc = db.query(TopicContent).filter(TopicContent.topic_id == topic.id).first()
        if not tc or not tc.content:
            continue
        content = json.loads(tc.content)
        for q in content.get("practice_mcq", []):
            if isinstance(q, dict):
                ans = q.get("correct", q.get("correct_answer", ""))
                if ans in dist:
                    dist[ans] += 1

    total = sum(dist.values())
    print(f"  {course_code}: Shuffled {total_fixed} MCQs")
    if total > 0:
        print(f"    New distribution: A={dist['A']} ({dist['A']*100/total:.0f}%) "
              f"B={dist['B']} ({dist['B']*100/total:.0f}%) "
              f"C={dist['C']} ({dist['C']*100/total:.0f}%) "
              f"D={dist['D']} ({dist['D']*100/total:.0f}%)")


def main():
    random.seed(42)  # Reproducible but random-looking
    init_db()
    db = get_db()

    try:
        print("Fixing MCQ answer bias...\n")

        # Fix all courses with preloaded content
        courses = db.query(Course).all()
        for course in courses:
            # Check if course has preloaded content
            topic_count = (
                db.query(TopicContent)
                .join(Topic, TopicContent.topic_id == Topic.id)
                .join(Unit, Topic.unit_id == Unit.id)
                .filter(Unit.course_id == course.id)
                .count()
            )
            if topic_count > 0:
                fix_course(db, course.code)

        print("\nDone!")
    finally:
        db.close()


if __name__ == "__main__":
    main()

"""
Retroactive MCQ answer verification and correction.

Scans all pre-generated MCQs in topic_content (practice questions) and
exam_questions, finds ones with code that may have hallucinated answers,
and uses a second LLM pass to verify and correct them.

Usage:
    python scripts/verify_fix_mcqs.py                  # dry-run (no DB writes)
    python scripts/verify_fix_mcqs.py --fix            # apply corrections
    python scripts/verify_fix_mcqs.py --fix --table exam   # only exam questions
    python scripts/verify_fix_mcqs.py --fix --table practice  # only topic_content
    python scripts/verify_fix_mcqs.py --fix --limit 50    # limit to 50 questions
"""

import argparse
import asyncio
import json
import logging
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


# ── LLM verification prompt ──────────────────────────────────────────────────

VERIFY_PROMPT = """You are a precise answer verifier for a computer science education platform.

A multiple-choice question is shown below. Your job: independently determine the correct answer.

Question:
{question}

Options:
{options}

Claimed correct answer: {claimed}

INSTRUCTIONS:
1. For code questions: trace through EVERY line of execution. Track all variable values.
2. Determine the correct answer independently — ignore what the question claims.
3. If the claimed answer IS correct: respond {{"verified": true, "correct": "{claimed}", "explanation": "brief confirmation"}}
4. If the claimed answer is WRONG: respond {{"verified": false, "correct": "X", "explanation": "corrected step-by-step explanation of why X is right and {claimed} is wrong"}}

Return ONLY valid JSON. No markdown."""


def is_code_question(q: dict) -> bool:
    """Returns True if the question involves code (highest hallucination risk)."""
    text = q.get("question", "") + " ".join(q.get("options", {}).values())
    return (
        "```" in text
        or "int " in text
        or "arr[" in text
        or ".length" in text
        or "for (" in text
        or "while (" in text
        or "String " in text
        or "ArrayList" in text
        or "void " in text
        or "return " in text
        or "boolean " in text
        or "double " in text
    )


def parse_json(raw: str) -> dict | None:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    for candidate in [cleaned, cleaned[cleaned.find("{"):cleaned.rfind("}") + 1]]:
        try:
            return json.loads(candidate)
        except Exception:
            fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(fixed)
            except Exception:
                continue
    return None


async def verify_mcq(agent, q: dict, topic_title: str = "", unit_number: int = 1) -> tuple[bool, dict]:
    """
    Returns (was_corrected, corrected_q).
    If verified correct: returns (False, original_q).
    If corrected: returns (True, fixed_q).
    """
    options_str = "\n".join(f"  {k}: {v}" for k, v in q.get("options", {}).items())
    claimed = q.get("correct", q.get("correct_answer", "?"))
    prompt = VERIFY_PROMPT.format(
        question=q.get("question", ""),
        options=options_str,
        claimed=claimed,
    )
    try:
        result = await agent.process(
            message=prompt,
            history=[],
            topic_title=topic_title,
            unit_title="",
            unit_number=unit_number,
            stream=False,
        )
        raw = result.get("response", "")
        verified = parse_json(raw)
        if verified and "correct" in verified:
            if not verified.get("verified", True):
                corrected = dict(q)
                corrected["correct"] = verified["correct"]
                corrected["explanation"] = verified.get("explanation", q.get("explanation", ""))
                return True, corrected
    except Exception as e:
        logger.warning(f"Verification call failed: {e}")
    return False, q


# ── Main correction logic ─────────────────────────────────────────────────────

async def run(fix: bool, table: str, limit: int):
    from src.database.engine import get_db, init_db
    from src.database.models import TopicContent, ExamQuestion, Course, Unit, Topic
    from src.agents.tutor import TutorAgent
    from src.services.llm.config import get_llm_config
    from src.services.config import load_config_with_main

    init_db()

    try:
        llm_config = get_llm_config()
        api_key = llm_config.api_key
        base_url = llm_config.base_url
        api_version = getattr(llm_config, "api_version", None)
    except Exception as e:
        logger.error(f"Cannot load LLM config: {e}")
        sys.exit(1)

    project_root = Path(__file__).parent.parent
    config = load_config_with_main("solve_config.yaml", project_root)

    # Use AP_CSA agent as a generic code-capable agent
    agent = TutorAgent(
        course_code="AP_CSA",
        course_name="AP Computer Science A",
        language="en",
        config=config,
        api_key=api_key,
        base_url=base_url,
        api_version=api_version,
    )

    total_checked = 0
    total_corrected = 0
    total_skipped = 0

    db = get_db()
    try:
        # ── Practice MCQs in topic_content ───────────────────────────────────
        if table in ("all", "practice"):
            logger.info("=" * 60)
            logger.info("Scanning practice MCQs in topic_content ...")
            tc_rows = db.query(TopicContent).filter(TopicContent.content.isnot(None)).all()

            for tc in tc_rows:
                if limit and total_checked >= limit:
                    break
                try:
                    data = json.loads(tc.content)
                except Exception:
                    continue

                mcqs = data.get("practice_mcq", [])
                changed = False

                for i, mcq in enumerate(mcqs):
                    if limit and total_checked >= limit:
                        break
                    if not is_code_question(mcq):
                        total_skipped += 1
                        continue

                    total_checked += 1
                    topic_title = tc.topic.title if tc.topic else ""
                    unit_number = tc.topic.unit.unit_number if tc.topic and tc.topic.unit else 1

                    was_corrected, fixed_mcq = await verify_mcq(
                        agent, mcq, topic_title, unit_number
                    )

                    if was_corrected:
                        total_corrected += 1
                        old_ans = mcq.get("correct", "?")
                        new_ans = fixed_mcq["correct"]
                        logger.warning(
                            f"  CORRECTED [{topic_title}] MCQ {i}: {old_ans} → {new_ans}"
                        )
                        if fix:
                            mcqs[i] = fixed_mcq
                            changed = True
                    else:
                        logger.info(f"  OK [{topic_title}] MCQ {i}: {mcq.get('correct','?')}")

                    # Brief pause to avoid rate limits
                    await asyncio.sleep(0.5)

                if fix and changed:
                    data["practice_mcq"] = mcqs
                    tc.content = json.dumps(data)

            if fix:
                db.commit()
                logger.info("topic_content changes committed.")

        # ── Exam MCQs in exam_questions ───────────────────────────────────────
        if table in ("all", "exam"):
            logger.info("=" * 60)
            logger.info("Scanning exam MCQs in exam_questions ...")
            eq_rows = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.question_type == "mcq")
                .all()
            )

            for eq in eq_rows:
                if limit and total_checked >= limit:
                    break
                try:
                    qdata = json.loads(eq.question_data)
                except Exception:
                    continue

                if not is_code_question(qdata):
                    total_skipped += 1
                    continue

                total_checked += 1
                was_corrected, fixed_qdata = await verify_mcq(agent, qdata)

                if was_corrected:
                    total_corrected += 1
                    old_ans = qdata.get("correct", "?")
                    new_ans = fixed_qdata["correct"]
                    logger.warning(f"  CORRECTED exam MCQ {eq.id}: {old_ans} → {new_ans}")
                    if fix:
                        eq.question_data = json.dumps(fixed_qdata)
                        # Also fix is_correct for the student's answer if they already answered
                        if eq.student_answer is not None:
                            eq.is_correct = (eq.student_answer == new_ans)
                            eq.score = 1.0 if eq.is_correct else 0.0
                else:
                    logger.info(f"  OK exam MCQ {eq.id}: {qdata.get('correct','?')}")

                await asyncio.sleep(0.5)

            if fix:
                db.commit()
                logger.info("exam_questions changes committed.")

    finally:
        db.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info(f"SUMMARY")
    logger.info(f"  Code MCQs checked : {total_checked}")
    logger.info(f"  Non-code skipped  : {total_skipped}")
    logger.info(f"  Corrections made  : {total_corrected}")
    logger.info(f"  Accuracy rate     : {100 - (total_corrected / max(1, total_checked) * 100):.1f}%")
    if not fix:
        logger.info("")
        logger.info("  DRY RUN — no changes written. Re-run with --fix to apply.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Verify and fix MCQ answers in the database")
    parser.add_argument("--fix", action="store_true", help="Write corrections to DB (default: dry-run)")
    parser.add_argument(
        "--table",
        choices=["all", "practice", "exam"],
        default="all",
        help="Which table to scan (default: all)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Max number of code MCQs to check (0 = unlimited)",
    )
    args = parser.parse_args()
    asyncio.run(run(fix=args.fix, table=args.table, limit=args.limit))

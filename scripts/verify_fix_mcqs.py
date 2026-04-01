"""
Retroactive MCQ answer verification and correction.

Scans all pre-generated MCQs in topic_content (practice questions) and
exam_questions, finds code-based ones that may have hallucinated answers,
and uses a direct LLM call to verify and correct them.

Runs ~2-3s per question (no RAG needed for verification).

Usage:
    python scripts/verify_fix_mcqs.py                  # dry-run (no DB writes)
    python scripts/verify_fix_mcqs.py --fix            # apply corrections
    python scripts/verify_fix_mcqs.py --fix --table exam      # only exam questions
    python scripts/verify_fix_mcqs.py --fix --table practice  # only topic_content
    python scripts/verify_fix_mcqs.py --fix --limit 50        # limit to 50 code MCQs
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


# ── Verification prompt ───────────────────────────────────────────────────────

VERIFY_PROMPT = """You are a precise answer verifier for a computer science education platform.

A multiple-choice question is shown below. Your job: independently determine the correct answer.

Question:
{question}

Options:
{options}

Claimed correct answer: {claimed}

INSTRUCTIONS:
1. For code questions: trace through EVERY line of execution. Track ALL variable values step by step.
2. Determine the correct answer independently — do not assume the claimed answer is right.
3. If the claimed answer IS correct: respond {{"verified": true, "correct": "{claimed}", "explanation": "brief confirmation"}}
4. If the claimed answer is WRONG: respond {{"verified": false, "correct": "X", "explanation": "corrected step-by-step explanation of why X is right and {claimed} is wrong"}}

Return ONLY valid JSON. No markdown fences."""


def is_code_question(q: dict) -> bool:
    """Returns True if the question involves code (highest hallucination risk)."""
    text = q.get("question", "") + " ".join(str(v) for v in q.get("options", {}).values())
    return any(token in text for token in [
        "```", "int ", "arr[", ".length", "for (", "while (",
        "String ", "ArrayList", "void ", "return ", "boolean ",
        "double ", "System.out", "new int", "new String",
    ])


def parse_json(raw: str) -> dict | None:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        cleaned = cleaned.rsplit("```", 1)[0].strip()
    for candidate in [
        cleaned,
        cleaned[cleaned.find("{"):cleaned.rfind("}") + 1] if "{" in cleaned else "",
    ]:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except Exception:
            fixed = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(fixed)
            except Exception:
                continue
    return None


async def verify_one(llm_client, q: dict) -> tuple[bool, dict]:
    """
    Verify a single MCQ using a direct LLM call (no RAG).
    Returns (was_corrected, corrected_q).
    """
    options_str = "\n".join(f"  {k}: {v}" for k, v in q.get("options", {}).items())
    claimed = q.get("correct", q.get("correct_answer", "?"))

    prompt = VERIFY_PROMPT.format(
        question=q.get("question", ""),
        options=options_str,
        claimed=claimed,
    )

    try:
        raw = await llm_client.complete(prompt=prompt)
        verified = parse_json(raw)
        if verified and "correct" in verified:
            if not verified.get("verified", True):
                corrected = dict(q)
                corrected["correct"] = verified["correct"]
                corrected["explanation"] = verified.get("explanation", q.get("explanation", ""))
                return True, corrected
    except Exception as e:
        logger.warning(f"LLM call failed: {e}")

    return False, q


# ── Main ──────────────────────────────────────────────────────────────────────

async def run(fix: bool, table: str, limit: int):
    from src.database.engine import get_db, init_db
    from src.database.models import TopicContent, ExamQuestion
    from src.services.llm.client import LLMClient

    init_db()
    llm_client = LLMClient()
    logger.info("LLM client ready")

    total_checked = 0
    total_corrected = 0
    total_skipped = 0

    db = get_db()
    try:
        # ── Practice MCQs in topic_content ────────────────────────────────────
        if table in ("all", "practice"):
            logger.info("=" * 60)
            logger.info("Scanning practice MCQs in topic_content ...")
            tc_rows = db.query(TopicContent).filter(TopicContent.content.isnot(None)).all()
            logger.info(f"Found {len(tc_rows)} topic_content rows")

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
                    topic_title = tc.topic.title if tc.topic else f"tc:{tc.id}"

                    was_corrected, fixed_mcq = await verify_one(llm_client, mcq)

                    if was_corrected:
                        total_corrected += 1
                        old_ans = mcq.get("correct", "?")
                        new_ans = fixed_mcq["correct"]
                        logger.warning(f"  CORRECTED [{topic_title}] MCQ {i}: {old_ans} → {new_ans}")
                        if fix:
                            mcqs[i] = fixed_mcq
                            changed = True
                    else:
                        logger.info(f"  OK [{topic_title}] MCQ {i}: {mcq.get('correct','?')}")

                    await asyncio.sleep(0.3)  # gentle rate-limit

                if fix and changed:
                    data["practice_mcq"] = mcqs
                    tc.content = json.dumps(data)

            if fix:
                db.commit()
                logger.info("topic_content changes committed to DB.")

        # ── Exam MCQs in exam_questions ───────────────────────────────────────
        if table in ("all", "exam"):
            logger.info("=" * 60)
            logger.info("Scanning exam MCQs in exam_questions ...")
            eq_rows = (
                db.query(ExamQuestion)
                .filter(ExamQuestion.question_type == "mcq")
                .all()
            )
            logger.info(f"Found {len(eq_rows)} exam MCQ rows")

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
                was_corrected, fixed_qdata = await verify_one(llm_client, qdata)

                if was_corrected:
                    total_corrected += 1
                    old_ans = qdata.get("correct", "?")
                    new_ans = fixed_qdata["correct"]
                    logger.warning(f"  CORRECTED exam MCQ {eq.id[:8]}: {old_ans} → {new_ans}")
                    if fix:
                        eq.question_data = json.dumps(fixed_qdata)
                        # Also fix the student's score if they already answered
                        if eq.student_answer is not None:
                            eq.is_correct = (eq.student_answer == new_ans)
                            eq.score = 1.0 if eq.is_correct else 0.0
                else:
                    logger.info(f"  OK exam MCQ {eq.id[:8]}: {qdata.get('correct','?')}")

                await asyncio.sleep(0.3)

            if fix:
                db.commit()
                logger.info("exam_questions changes committed to DB.")

    finally:
        db.close()

    # ── Summary ───────────────────────────────────────────────────────────────
    logger.info("=" * 60)
    logger.info("SUMMARY")
    logger.info(f"  Code MCQs verified : {total_checked}")
    logger.info(f"  Non-code skipped   : {total_skipped}")
    logger.info(f"  Corrections made   : {total_corrected}")
    if total_checked > 0:
        accuracy = 100 - (total_corrected / total_checked * 100)
        logger.info(f"  Original accuracy  : {accuracy:.1f}%")
        logger.info(f"  Error rate         : {total_corrected / total_checked * 100:.1f}%")
    if not fix:
        logger.info("")
        logger.info("  >>> DRY RUN — no changes written. Re-run with --fix to apply. <<<")
    else:
        logger.info(f"  >>> {total_corrected} corrections written to database. <<<")


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

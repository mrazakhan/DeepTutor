#!/usr/bin/env python3
"""
Ingest AP Course Content into DeepTutor++ Knowledge Bases

Takes downloaded course content from data/course_content/{course_code}/
and creates per-course knowledge bases using DeepTutor's KB system.

Usage:
    python scripts/ingest_course_content.py [--courses cs math science all]
    python scripts/ingest_course_content.py --courses cs math     # Phase 2A
    python scripts/ingest_course_content.py --provider llamaindex  # Fastest
    python scripts/ingest_course_content.py --provider lightrag    # Knowledge graph
"""

import argparse
import asyncio
import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

CONTENT_DIR = PROJECT_ROOT / "data" / "course_content"
KB_DIR = PROJECT_ROOT / "data" / "knowledge_bases"

# Course groups (matching download script)
COURSE_GROUPS = {
    "cs": ["ap-csa", "ap-csp"],
    "math": ["ap-calc-ab", "ap-calc-bc", "ap-stats", "ap-precalc"],
    "science": [
        "ap-bio", "ap-chem", "ap-phys1", "ap-phys2",
        "ap-physc-mech", "ap-physc-em", "ap-env-sci",
    ],
}


async def ingest_course(course_code: str, provider: str = "llamaindex") -> bool:
    """Ingest a single course's content into a knowledge base."""
    content_dir = CONTENT_DIR / course_code

    if not content_dir.exists():
        print(f"  [skip] No content directory found for {course_code}")
        print(f"         Run 'python scripts/download_course_content.py' first")
        return False

    # Get list of files to ingest
    files = list(content_dir.glob("*.pdf")) + list(content_dir.glob("*.md")) + list(content_dir.glob("*.txt"))
    if not files:
        print(f"  [skip] No files found in {content_dir}")
        return False

    print(f"  Found {len(files)} file(s) to ingest:")
    for f in files:
        print(f"    - {f.name} ({f.stat().st_size // 1024 // 1024}MB)")

    # Check if KB already exists and has content
    kb_dir = KB_DIR / course_code
    if (kb_dir / "rag_storage").exists() and any((kb_dir / "rag_storage").iterdir()):
        print(f"  [skip] KB '{course_code}' already has RAG storage. Use --force to re-ingest.")
        return True

    # Import KB system
    from src.knowledge.initializer import KnowledgeBaseInitializer
    from src.knowledge.manager import KnowledgeBaseManager

    # Register KB
    manager = KnowledgeBaseManager(base_dir=str(KB_DIR))
    try:
        manager.register_knowledge_base(course_code, description=f"AP {course_code} course materials")
    except Exception:
        pass  # Already registered

    # Initialize KB with content
    print(f"  Initializing KB with provider: {provider}...")
    initializer = KnowledgeBaseInitializer(
        kb_name=course_code,
        base_dir=str(KB_DIR),
        rag_provider=provider,
    )

    # Create directory structure
    initializer.create_directory_structure()

    # Copy documents
    source_paths = [str(f) for f in files]
    initializer.copy_documents(source_paths)

    # Process documents (async - this does the actual RAG indexing)
    print(f"  Processing documents (this may take a while)...")
    try:
        await initializer.process_documents()
        print(f"  [done] KB '{course_code}' created successfully!")

        # Update status
        manager.update_kb_status(course_code, "ready")
        return True
    except Exception as e:
        print(f"  [error] Failed to process documents: {e}")
        manager.update_kb_status(course_code, "error", progress={"error": str(e)})
        return False


async def main():
    parser = argparse.ArgumentParser(description="Ingest AP course content into KBs")
    parser.add_argument(
        "--courses",
        nargs="+",
        choices=["cs", "math", "science", "all"],
        default=["cs", "math"],
        help="Course groups to ingest (default: cs math)",
    )
    parser.add_argument(
        "--provider",
        choices=["llamaindex", "lightrag", "raganything"],
        default="llamaindex",
        help="RAG provider to use (default: llamaindex - fastest)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-ingest even if KB already exists",
    )
    parser.add_argument(
        "--course",
        type=str,
        help="Ingest a single course by code (e.g., ap-csa)",
    )

    args = parser.parse_args()

    # Build course list
    if args.course:
        course_codes = [args.course]
    else:
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
    unique = []
    for code in course_codes:
        if code not in seen:
            seen.add(code)
            unique.append(code)
    course_codes = unique

    print(f"Ingesting content for {len(course_codes)} courses...")
    print(f"RAG Provider: {args.provider}")
    print(f"KB Directory: {KB_DIR}")

    results = {}
    for code in course_codes:
        print(f"\n{'='*60}")
        print(f"Course: {code}")
        print(f"{'='*60}")

        if args.force:
            # Remove existing KB
            kb_dir = KB_DIR / code
            if kb_dir.exists():
                import shutil
                shutil.rmtree(kb_dir)
                print(f"  Removed existing KB: {kb_dir}")

        success = await ingest_course(code, args.provider)
        results[code] = success

    # Summary
    print(f"\n{'='*60}")
    print("INGESTION SUMMARY")
    print(f"{'='*60}")
    success_count = sum(1 for v in results.values() if v)
    for code, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  {code:25s} [{status}]")
    print(f"\n  {success_count}/{len(results)} courses ingested successfully")


if __name__ == "__main__":
    asyncio.run(main())

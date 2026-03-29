"""Seed USACO Bronze course into the database.

Can be run multiple times safely — uses upsert logic.
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.database.engine import get_db, init_db
from src.database.models import Course, Unit, Topic


USACO_BRONZE = {
    "code": "USACO_BRONZE",
    "name": "USACO Bronze",
    "subject_area": "computer_science",
    "description": (
        "Comprehensive preparation for the USACO Bronze division. "
        "Covers fundamental algorithms, data structures, and problem-solving techniques "
        "needed to pass Bronze and advance to Silver. Problems focus on simulation, "
        "brute force, sorting, greedy algorithms, and ad hoc problem solving. "
        "Language: C++, Java, or Python."
    ),
    "exam_format": json.dumps({
        "type": "programming_contest",
        "contest_format": "3-4 problems, 4 hours",
        "divisions": ["Bronze", "Silver", "Gold", "Platinum"],
        "grading": "Each problem is worth 1000 points. Test cases are all-or-nothing per subtask.",
        "languages": ["C++", "Java", "Python"],
        "sections": [
            {
                "name": "Problem Solving",
                "count": 3,
                "minutes": 240,
                "type": "frq",
                "description": "3-4 programming problems requiring full solutions"
            }
        ],
        "frq_types": [
            "Simulation",
            "Brute Force / Complete Search",
            "Sorting",
            "Greedy",
            "Ad Hoc",
            "Rectangle Geometry",
            "Graph Basics"
        ],
        "weight": {"mcq": 0, "frq": 100},
        "score_cutoffs": {"5": 850, "4": 700, "3": 500, "2": 300}
    }),
    "reference_materials": json.dumps({
        "resources": [
            "usaco.guide — Free structured curriculum",
            "CSES Problem Set — Foundational practice",
            "USACO official past problems — usaco.org",
            "Competitive Programmer's Handbook (Laaksonen)"
        ],
        "contest_schedule": "4 contests per season: December, January, February, US Open (March/April)",
        "promotion": "Score 750+ on a contest to promote to Silver"
    }),
    "units": [
        {
            "number": 1,
            "title": "Getting Started",
            "topics": [
                {"num": "1.1", "title": "Input and Output"},
                {"num": "1.2", "title": "Data Types and Operators"},
                {"num": "1.3", "title": "Conditional Statements"},
                {"num": "1.4", "title": "Loops and Iteration"},
                {"num": "1.5", "title": "Arrays and Strings"},
                {"num": "1.6", "title": "Functions and Modular Code"},
                {"num": "1.7", "title": "Time Complexity and Big-O Notation"},
            ]
        },
        {
            "number": 2,
            "title": "Simulation",
            "topics": [
                {"num": "2.1", "title": "Following Instructions Step by Step"},
                {"num": "2.2", "title": "Simulating Grid and Board Problems"},
                {"num": "2.3", "title": "Tracking State Over Time"},
                {"num": "2.4", "title": "Circular and Wraparound Simulation"},
                {"num": "2.5", "title": "Multi-Object Simulation"},
            ]
        },
        {
            "number": 3,
            "title": "Complete Search (Brute Force)",
            "topics": [
                {"num": "3.1", "title": "Iterating Over All Possibilities"},
                {"num": "3.2", "title": "Nested Loops and Pair Enumeration"},
                {"num": "3.3", "title": "Generating Subsets and Permutations"},
                {"num": "3.4", "title": "Pruning and Optimizing Brute Force"},
                {"num": "3.5", "title": "Recursive Complete Search"},
                {"num": "3.6", "title": "Backtracking Fundamentals"},
            ]
        },
        {
            "number": 4,
            "title": "Sorting and Searching",
            "topics": [
                {"num": "4.1", "title": "Built-in Sorting Functions"},
                {"num": "4.2", "title": "Custom Comparators and Sort Keys"},
                {"num": "4.3", "title": "Sorting Problems: Greedy with Sorting"},
                {"num": "4.4", "title": "Binary Search on Sorted Data"},
                {"num": "4.5", "title": "Two Pointers Technique"},
                {"num": "4.6", "title": "Coordinate Compression"},
            ]
        },
        {
            "number": 5,
            "title": "Data Structures",
            "topics": [
                {"num": "5.1", "title": "Sets and Maps (Hash Tables)"},
                {"num": "5.2", "title": "Stacks and Queues"},
                {"num": "5.3", "title": "Frequency Counting and Histograms"},
                {"num": "5.4", "title": "Prefix Sums (1D)"},
                {"num": "5.5", "title": "Custom Structs and Classes"},
            ]
        },
        {
            "number": 6,
            "title": "Rectangle Geometry",
            "topics": [
                {"num": "6.1", "title": "Axis-Aligned Rectangles"},
                {"num": "6.2", "title": "Rectangle Intersection and Union"},
                {"num": "6.3", "title": "Sweep Line for Rectangles"},
                {"num": "6.4", "title": "Coordinate Geometry Problems"},
            ]
        },
        {
            "number": 7,
            "title": "Greedy Algorithms",
            "topics": [
                {"num": "7.1", "title": "Greedy Algorithm Fundamentals"},
                {"num": "7.2", "title": "Interval Scheduling and Activity Selection"},
                {"num": "7.3", "title": "Optimal Ordering and Exchange Arguments"},
                {"num": "7.4", "title": "Greedy on Sorted Input"},
                {"num": "7.5", "title": "When Greedy Fails: Recognizing Limitations"},
            ]
        },
        {
            "number": 8,
            "title": "Introduction to Graphs",
            "topics": [
                {"num": "8.1", "title": "Graph Representation: Adjacency List and Matrix"},
                {"num": "8.2", "title": "Breadth-First Search (BFS)"},
                {"num": "8.3", "title": "Depth-First Search (DFS)"},
                {"num": "8.4", "title": "Connected Components"},
                {"num": "8.5", "title": "Flood Fill on Grids"},
                {"num": "8.6", "title": "Cycle Detection"},
            ]
        },
        {
            "number": 9,
            "title": "Ad Hoc and Problem-Solving Strategies",
            "topics": [
                {"num": "9.1", "title": "Reading and Understanding Problem Statements"},
                {"num": "9.2", "title": "Identifying Problem Types"},
                {"num": "9.3", "title": "Edge Cases and Corner Cases"},
                {"num": "9.4", "title": "Debugging and Testing Strategies"},
                {"num": "9.5", "title": "Contest Strategy and Time Management"},
            ]
        },
        {
            "number": 10,
            "title": "USACO Bronze Past Problems",
            "topics": [
                {"num": "10.1", "title": "December Contest Problems"},
                {"num": "10.2", "title": "January Contest Problems"},
                {"num": "10.3", "title": "February Contest Problems"},
                {"num": "10.4", "title": "US Open Problems"},
                {"num": "10.5", "title": "Mixed Practice: Full Contest Simulation"},
            ]
        },
    ]
}


def seed():
    init_db()
    db = get_db()

    try:
        # Check if course already exists
        existing_course = db.query(Course).filter(Course.code == USACO_BRONZE["code"]).first()

        if existing_course:
            # Update existing course metadata
            existing_course.name = USACO_BRONZE["name"]
            existing_course.subject_area = USACO_BRONZE["subject_area"]
            existing_course.description = USACO_BRONZE["description"]
            existing_course.exam_format = USACO_BRONZE["exam_format"]
            existing_course.reference_materials = USACO_BRONZE["reference_materials"]
            course = existing_course
            print(f"  Updated existing course: {course.name}")
        else:
            course = Course(
                code=USACO_BRONZE["code"],
                name=USACO_BRONZE["name"],
                subject_area=USACO_BRONZE["subject_area"],
                description=USACO_BRONZE["description"],
                exam_format=USACO_BRONZE["exam_format"],
                reference_materials=USACO_BRONZE["reference_materials"],
            )
            db.add(course)
            db.flush()
            print(f"  Created course: {course.name}")

        # Get existing units for this course
        existing_units = {u.unit_number: u for u in db.query(Unit).filter(Unit.course_id == course.id).all()}

        total_topics = 0
        for unit_data in USACO_BRONZE["units"]:
            if unit_data["number"] in existing_units:
                unit = existing_units[unit_data["number"]]
                unit.title = unit_data["title"]
            else:
                unit = Unit(
                    course_id=course.id,
                    unit_number=unit_data["number"],
                    title=unit_data["title"],
                )
                db.add(unit)
                db.flush()

            # Get existing topics for this unit
            existing_topics = {t.topic_number: t for t in db.query(Topic).filter(Topic.unit_id == unit.id).all()}

            for topic_data in unit_data["topics"]:
                if topic_data["num"] in existing_topics:
                    existing_topics[topic_data["num"]].title = topic_data["title"]
                else:
                    db.add(Topic(
                        unit_id=unit.id,
                        topic_number=topic_data["num"],
                        title=topic_data["title"],
                    ))
                total_topics += 1

        db.commit()
        print(f"\n  USACO Bronze: {len(USACO_BRONZE['units'])} units, {total_topics} topics")
        print("Done!")

    except Exception as e:
        db.rollback()
        print(f"Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()

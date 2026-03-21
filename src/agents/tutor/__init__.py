"""
Tutor Module - AP course-scoped tutoring agent.

Provides AI tutoring for AP courses with course-specific RAG retrieval.

Usage:
    from src.agents.tutor import TutorAgent

    agent = TutorAgent(
        course_code="ap-csa",
        course_name="AP Computer Science A",
        language="en",
    )
    response = await agent.process(
        message="Explain polymorphism",
        topic_title="Polymorphism",
        unit_title="Inheritance",
        unit_number=9,
        stream=True,
    )
"""

from .tutor_agent import TutorAgent

__all__ = ["TutorAgent"]

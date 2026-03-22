"""Tests for TutorAgent — prompt building, message construction, KB naming."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

# Set env vars before importing agent code
os.environ.setdefault("LLM_BINDING", "anthropic")
os.environ.setdefault("LLM_MODEL", "test-model")
os.environ.setdefault("LLM_API_KEY", "test-key")
os.environ.setdefault("LLM_HOST", "https://api.anthropic.com/v1")
os.environ.setdefault("EMBEDDING_BINDING", "openai")
os.environ.setdefault("EMBEDDING_MODEL", "test-embed")
os.environ.setdefault("EMBEDDING_API_KEY", "test-key")
os.environ.setdefault("EMBEDDING_HOST", "https://api.voyageai.com/v1")
os.environ.setdefault("EMBEDDING_DIMENSION", "1024")

from src.agents.tutor.tutor_agent import TutorAgent


class TestKBNaming(unittest.TestCase):
    """Test that course codes are correctly mapped to KB names."""

    def test_ap_csa_maps_to_ap_csa(self):
        agent = TutorAgent(course_code="AP_CSA", course_name="AP Computer Science A")
        self.assertEqual(agent.kb_name, "ap-csa")

    def test_ap_calc_ab_maps_correctly(self):
        agent = TutorAgent(course_code="AP_CALC_AB", course_name="AP Calculus AB")
        self.assertEqual(agent.kb_name, "ap-calc-ab")

    def test_ap_stats_maps_correctly(self):
        agent = TutorAgent(course_code="AP_STATS", course_name="AP Statistics")
        self.assertEqual(agent.kb_name, "ap-stats")

    def test_ap_precalc_maps_correctly(self):
        agent = TutorAgent(course_code="AP_PRECALC", course_name="AP Precalculus")
        self.assertEqual(agent.kb_name, "ap-precalc")

    def test_ap_csp_maps_correctly(self):
        agent = TutorAgent(course_code="AP_CSP", course_name="AP Computer Science Principles")
        self.assertEqual(agent.kb_name, "ap-csp")

    def test_ap_bio_maps_correctly(self):
        agent = TutorAgent(course_code="AP_BIO", course_name="AP Biology")
        self.assertEqual(agent.kb_name, "ap-bio")


class TestSystemPrompt(unittest.TestCase):
    """Test system prompt building with course context."""

    def setUp(self):
        self.agent = TutorAgent(
            course_code="AP_CSA",
            course_name="AP Computer Science A",
            language="en",
        )

    def test_system_prompt_contains_course_name(self):
        prompt = self.agent.build_system_prompt(
            topic_title="Primitive Types",
            unit_title="Primitive Types",
            unit_number=1,
        )
        self.assertIn("AP Computer Science A", prompt)

    def test_system_prompt_contains_topic(self):
        prompt = self.agent.build_system_prompt(
            topic_title="Why Programming?",
            unit_title="Primitive Types",
            unit_number=1,
        )
        self.assertIn("Why Programming?", prompt)

    def test_system_prompt_defaults(self):
        prompt = self.agent.build_system_prompt()
        self.assertIn("General", prompt)


class TestMessageBuilding(unittest.TestCase):
    """Test message array construction."""

    def setUp(self):
        self.agent = TutorAgent(
            course_code="AP_CSA",
            course_name="AP Computer Science A",
            language="en",
        )

    def test_messages_start_with_system(self):
        messages = self.agent.build_messages(
            message="What are loops?",
            history=[],
        )
        self.assertEqual(messages[0]["role"], "system")

    def test_messages_end_with_user(self):
        messages = self.agent.build_messages(
            message="Explain arrays",
            history=[],
        )
        self.assertEqual(messages[-1]["role"], "user")
        self.assertEqual(messages[-1]["content"], "Explain arrays")

    def test_context_adds_system_message(self):
        messages = self.agent.build_messages(
            message="What are loops?",
            history=[],
            context="Loops allow repeating code blocks.",
        )
        # Should have system prompt + context message + user message
        system_msgs = [m for m in messages if m["role"] == "system"]
        self.assertEqual(len(system_msgs), 2)

    def test_history_preserved(self):
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
        ]
        messages = self.agent.build_messages(
            message="Follow up",
            history=history,
        )
        contents = [m["content"] for m in messages]
        self.assertIn("Hello", contents)
        self.assertIn("Hi there!", contents)
        self.assertIn("Follow up", contents)

    def test_invalid_roles_filtered(self):
        history = [
            {"role": "system", "content": "injected system msg"},
            {"role": "user", "content": "real msg"},
        ]
        messages = self.agent.build_messages(
            message="Test",
            history=history,
        )
        # The injected system msg in history should be excluded
        history_system = [
            m for m in messages
            if m["role"] == "system" and m["content"] == "injected system msg"
        ]
        self.assertEqual(len(history_system), 0)


class TestHistoryTruncation(unittest.TestCase):
    """Test conversation history truncation."""

    def setUp(self):
        self.agent = TutorAgent(
            course_code="AP_CSA",
            course_name="AP Computer Science A",
        )

    def test_empty_history(self):
        result = self.agent.truncate_history([])
        self.assertEqual(result, [])

    def test_short_history_preserved(self):
        history = [{"role": "user", "content": "short msg"}]
        result = self.agent.truncate_history(history)
        self.assertEqual(len(result), 1)

    def test_long_history_truncated(self):
        # Create history that exceeds default max_history_tokens (4000)
        history = [
            {"role": "user", "content": "x" * 2000}
            for _ in range(20)
        ]
        result = self.agent.truncate_history(history, max_tokens=100)
        self.assertLess(len(result), len(history))

    def test_truncation_keeps_most_recent(self):
        history = [
            {"role": "user", "content": f"message {i}"}
            for i in range(100)
        ]
        result = self.agent.truncate_history(history, max_tokens=200)
        # Should keep the most recent messages
        last_content = result[-1]["content"]
        self.assertEqual(last_content, "message 99")


class TestTopicIntro(unittest.TestCase):
    """Test topic introduction messages."""

    def setUp(self):
        self.agent = TutorAgent(
            course_code="AP_CSA",
            course_name="AP Computer Science A",
            language="en",
        )

    def test_topic_intro_contains_topic(self):
        intro = self.agent.get_topic_intro(
            topic_title="Primitive Types",
            unit_title="Primitive Types",
            unit_number=1,
        )
        self.assertIn("Primitive Types", intro)

    def test_topic_intro_contains_course(self):
        intro = self.agent.get_topic_intro(
            topic_title="Arrays",
            unit_title="Array",
            unit_number=6,
        )
        self.assertIn("AP Computer Science A", intro)


if __name__ == "__main__":
    unittest.main()

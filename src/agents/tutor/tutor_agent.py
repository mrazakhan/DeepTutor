"""
TutorAgent - AP course-scoped tutoring agent with RAG.

This agent provides:
- Course-scoped RAG retrieval from per-course knowledge bases
- AP exam-aware tutoring with Socratic method
- Multi-turn conversation with history management
- Streaming response generation
"""

from pathlib import Path
import sys
from typing import Any, AsyncGenerator

_project_root = Path(__file__).parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.agents.base_agent import BaseAgent
from src.tools import rag_search


class TutorAgent(BaseAgent):
    """
    AP course-scoped tutoring agent.

    Extends ChatAgent pattern with:
    - Mandatory course context (course_code, course_name, etc.)
    - Always-on RAG scoped to the course's knowledge base
    - AP exam-aware system prompts
    """

    DEFAULT_MAX_HISTORY_TOKENS = 4000

    def __init__(
        self,
        course_code: str,
        course_name: str,
        language: str = "en",
        config: dict[str, Any] | None = None,
        max_history_tokens: int | None = None,
        **kwargs,
    ):
        super().__init__(
            module_name="tutor",
            agent_name="tutor_agent",
            language=language,
            config=config,
            **kwargs,
        )

        self.course_code = course_code
        self.course_name = course_name
        self.max_history_tokens = max_history_tokens or self.agent_config.get(
            "max_history_tokens", self.DEFAULT_MAX_HISTORY_TOKENS
        )

        # KB name: normalize DB code (AP_CSA) to KB name (ap-csa)
        self.kb_name = course_code.lower().replace("_", "-")

        self.logger.info(
            f"TutorAgent initialized: course={course_code}, kb={self.kb_name}"
        )

    def count_tokens(self, text: str) -> int:
        try:
            import tiktoken
            encoding = tiktoken.get_encoding("cl100k_base")
            return len(encoding.encode(text))
        except ImportError:
            return len(text) // 4

    def truncate_history(
        self,
        history: list[dict[str, str]],
        max_tokens: int | None = None,
    ) -> list[dict[str, str]]:
        max_tokens = max_tokens or self.max_history_tokens
        if not history:
            return []

        truncated = []
        total_tokens = 0
        for msg in reversed(history):
            tokens = self.count_tokens(msg.get("content", ""))
            if total_tokens + tokens > max_tokens:
                break
            truncated.insert(0, msg)
            total_tokens += tokens

        return truncated

    async def retrieve_context(self, message: str) -> tuple[str, list[dict]]:
        """Retrieve context from the course-scoped knowledge base."""
        sources = []
        try:
            self.logger.info(f"RAG search in {self.kb_name}: {message[:50]}...")
            rag_result = await rag_search(
                query=message,
                kb_name=self.kb_name,
                mode="hybrid",
            )
            rag_answer = rag_result.get("answer", "")
            if rag_answer:
                sources.append({
                    "kb_name": self.kb_name,
                    "content": rag_answer[:500] + "..." if len(rag_answer) > 500 else rag_answer,
                })
                return rag_answer, sources
        except Exception as e:
            self.logger.warning(f"RAG search failed for {self.kb_name}: {e}")

        return "", sources

    def build_system_prompt(
        self,
        topic_title: str = "",
        unit_title: str = "",
        unit_number: int = 0,
    ) -> str:
        """Build the system prompt with course context injected."""
        template = self.get_prompt(
            "system",
            "You are DeepTutor++, an expert AP exam tutor for {course_name}.",
        )
        return template.format(
            course_name=self.course_name,
            course_code=self.course_code,
            topic_title=topic_title or "General",
            unit_title=unit_title or "General",
            unit_number=unit_number,
        )

    def build_messages(
        self,
        message: str,
        history: list[dict[str, str]],
        context: str = "",
        topic_title: str = "",
        unit_title: str = "",
        unit_number: int = 0,
    ) -> list[dict[str, str]]:
        messages = []

        # System prompt with course context
        system_prompt = self.build_system_prompt(topic_title, unit_title, unit_number)
        messages.append({"role": "system", "content": system_prompt})

        # Add RAG context if available
        if context:
            context_template = self.get_prompt(
                "context_template",
                "Reference material:\n{context}",
            )
            context_msg = context_template.format(
                context=context,
                course_name=self.course_name,
            )
            messages.append({"role": "system", "content": context_msg})

        # Conversation history
        for msg in history:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": content})

        # Current user message
        messages.append({"role": "user", "content": message})

        return messages

    def get_topic_intro(
        self,
        topic_title: str,
        unit_title: str,
        unit_number: int,
    ) -> str:
        """Get the introductory message for a topic study session."""
        template = self.get_prompt("topic_intro", None)
        if template:
            return template.format(
                topic_title=topic_title,
                unit_title=unit_title,
                unit_number=unit_number,
                course_name=self.course_name,
            )
        return (
            f"Let's study **{topic_title}** from Unit {unit_number}: "
            f"{unit_title} in AP {self.course_name}. What would you like to learn?"
        )

    async def process(
        self,
        message: str,
        history: list[dict[str, str]] | None = None,
        topic_title: str = "",
        unit_title: str = "",
        unit_number: int = 0,
        stream: bool = False,
    ) -> dict[str, Any] | AsyncGenerator[dict[str, Any], None]:
        history = history or []
        truncated_history = self.truncate_history(history)

        # Always retrieve from course KB
        context, sources = await self.retrieve_context(message)

        # Build messages
        messages = self.build_messages(
            message=message,
            history=truncated_history,
            context=context,
            topic_title=topic_title,
            unit_title=unit_title,
            unit_number=unit_number,
        )

        if stream:
            async def stream_generator():
                full_response = ""
                system_prompt = ""
                user_prompt = message
                for msg in messages:
                    if msg.get("role") == "system":
                        system_prompt = msg.get("content", "")
                        break

                async for chunk in self.stream_llm(
                    user_prompt=user_prompt,
                    system_prompt=system_prompt,
                    messages=messages,
                    stage="tutor_stream",
                ):
                    full_response += chunk
                    yield {"type": "chunk", "content": chunk}

                yield {
                    "type": "complete",
                    "response": full_response,
                    "sources": sources,
                    "truncated_history": truncated_history,
                }

            return stream_generator()
        else:
            # Non-streaming
            system_prompt = ""
            for msg in messages:
                if msg.get("role") == "system":
                    system_prompt = msg.get("content", "")
                    break

            response = await self.call_llm(
                user_prompt=message,
                system_prompt=system_prompt,
                messages=messages,
                stage="tutor",
            )

            return {
                "response": response,
                "sources": sources,
                "truncated_history": truncated_history,
            }


__all__ = ["TutorAgent"]

"""LLM usage tracking helper.

Call `log_llm_usage()` after each LLM API call to record per-user usage.
"""

from src.database.engine import get_db
from src.database.models import LLMUsageLog
from src.logging import get_logger

logger = get_logger("LLMTracking")

# Rough per-token pricing (USD) for common models
_PRICING = {
    # input $/1K, output $/1K
    "gpt-4o": (0.0025, 0.01),
    "gpt-4o-mini": (0.00015, 0.0006),
    "gpt-4-turbo": (0.01, 0.03),
    "gpt-4": (0.03, 0.06),
    "gpt-3.5-turbo": (0.0005, 0.0015),
    "claude-3-5-sonnet": (0.003, 0.015),
    "claude-3-haiku": (0.00025, 0.00125),
    "claude-sonnet-4-20250514": (0.003, 0.015),
    "deepseek-chat": (0.00014, 0.00028),
}


def _estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Estimate cost in USD based on model pricing."""
    model_lower = (model or "").lower()
    for key, (inp_price, out_price) in _PRICING.items():
        if key in model_lower:
            return (prompt_tokens * inp_price + completion_tokens * out_price) / 1000
    # Default fallback: cheap model pricing
    return (prompt_tokens * 0.001 + completion_tokens * 0.002) / 1000


def log_llm_usage(
    user_id: str | None,
    endpoint: str,
    model: str | None = None,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    response_text: str | None = None,
):
    """Log an LLM API call to the database.

    If token counts aren't available, estimates from response_text length.
    """
    # Estimate tokens from text if not provided
    if not prompt_tokens and not completion_tokens and response_text:
        # ~1.3 tokens per word, ~4 chars per token
        completion_tokens = max(1, len(response_text) // 4)
        prompt_tokens = completion_tokens  # rough estimate

    cost = _estimate_cost(model or "", prompt_tokens, completion_tokens)

    try:
        db = get_db()
        log_entry = LLMUsageLog(
            user_id=user_id,
            endpoint=endpoint,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            estimated_cost=cost,
        )
        db.add(log_entry)
        db.commit()
        db.close()
    except Exception as e:
        logger.warning(f"Failed to log LLM usage: {e}")

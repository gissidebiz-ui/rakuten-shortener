"""
Retry helper module.
Provides common retry logic with exponential backoff + jitter.
"""
import time
import random
import json
import os
from typing import Dict, Any, Tuple, Optional


def metrics_log(event_type: str, info: Optional[Dict[str, Any]] = None) -> None:
    """
    Log metrics event to JSONL file for monitoring.
    
    Args:
        event_type: Type of event (e.g. 'ai_success', 'api_error')
        info: Optional dictionary with event details
    """
    try:
        os.makedirs("../logs", exist_ok=True)
        path = os.path.join("..", "logs", "ai_metrics.jsonl")
        entry = {
            "timestamp": int(time.time()),
            "event": event_type,
            "info": info or {}
        }
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        # Logging itself is auxiliary, so failure is silent
        pass


def should_retry_on_error(error_text: str) -> bool:
    """
    Determine if error suggests rate limiting and warrants longer backoff.
    
    Args:
        error_text: Error message text
        
    Returns:
        True if error indicates rate limiting
    """
    return ("RESOURCE_EXHAUSTED" in error_text) or ("429" in error_text) or ("rate" in error_text.lower())


def calculate_backoff(attempt: int, is_rate_limit: bool, config: Dict[str, Any]) -> Tuple[float, float, float]:
    """
    Calculate sleep time using exponential backoff + jitter.
    
    Args:
        attempt: Current attempt number (1-indexed)
        is_rate_limit: Whether error indicates rate limiting
        config: dict with retry config keys
    
    Returns:
        tuple: (backoff_seconds, jitter_seconds, total_sleep_seconds)
    """
    base = config.get("retry_base_backoff", 2.0)
    backoff = base * (2 ** (attempt - 1))
    
    if is_rate_limit:
        multiplier = config.get("rate_limit_multiplier", 6)
        backoff *= multiplier
    
    max_backoff = config.get("retry_max_backoff", 120)
    backoff = min(backoff, max_backoff)
    
    jitter = random.uniform(0, config.get("retry_jitter_max", 2))
    sleep_time = backoff + jitter
    
    return backoff, jitter, sleep_time


def log_retry_attempt(attempt: int, max_retries: int, error_text: str, sleep_time: float, backoff: float) -> None:
    """
    Log retry attempt information to stdout.
    
    Args:
        attempt: Current attempt number
        max_retries: Maximum total retries
        error_text: Error message text
        sleep_time: Total sleep time before retry
        backoff: Base backoff time
    """
    print(f"\n[!] AI呼び出し失敗 (試行 {attempt}/{max_retries})")
    print("--- エラー詳細 ---")
    print(error_text)
    print(f"再試行まで待機: {sleep_time:.1f}s（バックオフ: {backoff}s, 試行: {attempt}/{max_retries}）")

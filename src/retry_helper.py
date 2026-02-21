"""
Retry helper module.
Provides common retry logic with exponential backoff + jitter.
"""
import time
import random
import json
import os


def metrics_log(event_type, info=None):
    """
    Log metrics event to JSONL file for monitoring.
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


def should_retry_on_error(error_text):
    """
    Determine if error suggests rate limiting and warrants longer backoff.
    """
    return ("RESOURCE_EXHAUSTED" in error_text) or ("429" in error_text) or ("rate" in error_text.lower())


def calculate_backoff(attempt, is_rate_limit, config):
    """
    Calculate sleep time using exponential backoff + jitter.
    
    Args:
        attempt: Current attempt number (1-indexed)
        is_rate_limit: Whether error indicates rate limiting
        config: dict with retry config (base_backoff, max_backoff, jitter_max, rate_limit_multiplier)
    
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


def log_retry_attempt(attempt, max_retries, error_text, sleep_time, backoff):
    """
    Log retry attempt information to stdout.
    """
    print(f"\n[!] AI呼び出し失敗 (試行 {attempt}/{max_retries})")
    print("--- エラー詳細 ---")
    print(error_text)
    print(f"再試行まで待機: {sleep_time:.1f}s（バックオフ: {backoff}s, 試行: {attempt}/{max_retries}）")

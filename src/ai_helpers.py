"""
AI helpers module.
Handles AI client creation and content generation with retry logic.
"""
from google import genai
import time
from retry_helper import metrics_log, should_retry_on_error, calculate_backoff, log_retry_attempt


def create_ai_client(api_key):
    """Create and return Google Generative AI client."""
    return genai.Client(api_key=api_key)


def generate_with_retry(client, prompt, config):
    """
    Generate content from AI with exponential backoff + jitter retry logic.
    
    Args:
        client: Google Generative AI client
        prompt: str, prompt text for generation
        config: dict with retry configuration from generation_policy.yaml
    
    Returns:
        str: Generated text or empty string if all retries exhausted
    """
    max_retries = config.get("max_retries", 8)
    
    for attempt in range(1, max_retries + 1):
        try:
            # Log request start
            try:
                metrics_log("ai_request_start", {"attempt": attempt})
            except Exception:
                pass
            
            # Make AI request
            model_name = config.get("model_name", "gemini-2.0-flash")
            response = client.models.generate_content(
                model=model_name,
                contents=prompt
            )

            # Handle successful response
            if hasattr(response, "text") and response.text:
                try:
                    metrics_log("ai_success", {"attempts": attempt})
                except Exception:
                    pass
                return response.text.strip()
            else:
                # Fallback for response without text attribute
                try:
                    metrics_log("ai_success", {"attempts": attempt})
                except Exception:
                    pass
                return response.candidates[0].content.parts[0].text.strip()

        except Exception as e:
            # Log error
            err_text = str(e)
            
            try:
                metrics_log("ai_error", {"attempt": attempt, "error": err_text})
            except Exception:
                pass

            # Check if max retries reached
            if attempt == max_retries:
                print("[!] 最大リトライ到達。空の結果を返します。")
                try:
                    metrics_log("ai_final_failure", {"attempts": attempt, "error": err_text})
                except Exception:
                    pass
                return ""

            # Determine if rate limit error
            is_rate_limit = should_retry_on_error(err_text)
            
            if is_rate_limit:
                try:
                    metrics_log("ai_rate_limit", {"attempt": attempt})
                except Exception:
                    pass

            # Calculate and execute backoff
            backoff, jitter, sleep_time = calculate_backoff(attempt, is_rate_limit, config)
            log_retry_attempt(attempt, max_retries, err_text, sleep_time, backoff)
            time.sleep(sleep_time)

    return ""

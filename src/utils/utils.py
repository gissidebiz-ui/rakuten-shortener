"""
DEPRECATED: This module is deprecated as of Phase 1 refactoring.
All functionality has been migrated to specialized modules:
  - config_loader.py: Configuration loading
  - ai_helpers.py: AI client and generation
  - retry_helper.py: Retry logic and metrics
  - html_generator.py: HTML and short URL generation

Please import from the appropriate modules instead:
  - from config_loader import load_secrets, load_yaml
  - from ai_helpers import create_ai_client, generate_with_retry
  - from retry_helper import metrics_log
  - from html_generator import random_filename, create_redirect_html, generate_short_url

This file is retained for backward compatibility only.
Remove any remaining imports from this module in your codebase.
"""

# Legacy functions - DO NOT USE
# All functions below are deprecated and maintained only for backward compatibility
# Use the appropriate specialized modules instead

import os
import yaml
import time
import random
import string
from google import genai
import json

# ================================
# DEPRECATED - Use config_loader.load_secrets() instead
# ================================
def load_secrets():
    """DEPRECATED: Use config_loader.load_secrets() instead."""
    from config_loader import load_secrets as new_load_secrets
    return new_load_secrets()

# ================================
# DEPRECATED - Use config_loader.load_yaml() instead
# ================================
def load_yaml(path):
    """DEPRECATED: Use config_loader.load_yaml() instead."""
    from config_loader import load_yaml as new_load_yaml
    return new_load_yaml(path)

# ================================
# DEPRECATED - Use ai_helpers.create_ai_client() instead
# ================================
def create_ai_client(api_key):
    """DEPRECATED: Use ai_helpers.create_ai_client() instead."""
    from ai_helpers import create_ai_client as new_create_ai_client
    return new_create_ai_client(api_key)

# ================================
# DEPRECATED - Use ai_helpers.generate_with_retry() instead
# ================================
def generate_with_retry(client, prompt, max_retries=8):
    """DEPRECATED: Use ai_helpers.generate_with_retry() instead.
    
    Note: The new signature is generate_with_retry(client, prompt, config)
    where config is a dictionary with retry parameters.
    """
    from ai_helpers import generate_with_retry as new_generate_with_retry
    # Create a config dict from the old signature for backward compatibility
    config = {
        "max_retries": max_retries,
        "base": 2.0,
        "max_backoff": 120,
        "rate_limit_multiplier": 6
    }
    return new_generate_with_retry(client, prompt, config)

# ================================
# DEPRECATED - Use html_generator.random_filename() instead
# ================================
def random_filename(length=6):
    """DEPRECATED: Use html_generator.random_filename() instead."""
    from html_generator import random_filename as new_random_filename
    return new_random_filename(length)

# ================================
# DEPRECATED - Use retry_helper.metrics_log() instead
# ================================
def metrics_log(event_type, info=None):
    """DEPRECATED: Use retry_helper.metrics_log() instead."""
    from retry_helper import metrics_log as new_metrics_log
    return new_metrics_log(event_type, info)

# ================================
# DEPRECATED - Use html_generator.create_redirect_html() instead
# ================================
def create_redirect_html(url, filename, title="商品詳細はこちら", image_url="", output_dir="../html"):
    """DEPRECATED: Use html_generator.create_redirect_html() instead."""
    from html_generator import create_redirect_html as new_create_redirect_html
    return new_create_redirect_html(url, filename, title, image_url, output_dir)

# ================================
# DEPRECATED - Use html_generator.generate_short_url() instead
# ================================
def generate_short_url(affiliate_url, product_name, image_url, output_dir="../html"):
    """DEPRECATED: Use html_generator.generate_short_url() instead."""
    from html_generator import generate_short_url as new_generate_short_url
    return new_generate_short_url(affiliate_url, product_name, image_url, output_dir)

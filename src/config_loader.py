"""
Configuration loader module.
Handles loading YAML configuration files.
"""
import os
import yaml


def load_yaml(path):
    """Load YAML file and return as dictionary."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_config_path(filename):
    """Get absolute path to config file based on this module's location."""
    # This module is in src/ directory
    # Config files are in ../config/ (parent directory's config)
    src_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(src_dir)
    return os.path.join(root_dir, "config", filename)


def load_secrets():
    """Load secrets configuration from config/secrets.yaml."""
    return load_yaml(_get_config_path("secrets.yaml"))


def load_generation_policy():
    """Load generation policy configuration from config/generation_policy.yaml."""
    return load_yaml(_get_config_path("generation_policy.yaml"))


def load_accounts():
    """Load accounts configuration from config/accounts.yaml."""
    return load_yaml(_get_config_path("accounts.yaml"))


def load_themes():
    """Load themes configuration from config/themes.yaml."""
    return load_yaml(_get_config_path("themes.yaml"))

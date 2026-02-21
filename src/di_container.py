"""
Dependency injection module for the rktn project.
Provides factory functions and container for managing dependencies.
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging
from config_loader import load_generation_policy, load_secrets, load_accounts, load_themes
from ai_helpers import create_ai_client
from logging_provider import DefaultLoggerProvider, LoggerProvider


class ConfigProvider(ABC):
    """Abstract interface for configuration loading."""
    
    @abstractmethod
    def get_generation_policy(self) -> Dict[str, Any]:
        """Get generation policy configuration."""
        pass
    
    @abstractmethod
    def get_secrets(self) -> Dict[str, Any]:
        """Get secrets configuration."""
        pass
    
    @abstractmethod
    def get_accounts(self) -> Dict[str, Any]:
        """Get accounts configuration."""
        pass
    
    @abstractmethod
    def get_themes(self) -> Dict[str, Any]:
        """Get themes configuration."""
        pass


class DefaultConfigProvider(ConfigProvider):
    """Default implementation loading from YAML files."""
    
    def __init__(self):
        """Initialize with cached configs."""
        self._policy = None
        self._secrets = None
        self._accounts = None
        self._themes = None
    
    def get_generation_policy(self) -> Dict[str, Any]:
        """Get generation policy configuration."""
        if self._policy is None:
            self._policy = load_generation_policy()
        return self._policy
    
    def get_secrets(self) -> Dict[str, Any]:
        """Get secrets configuration."""
        if self._secrets is None:
            self._secrets = load_secrets()
        return self._secrets
    
    def get_accounts(self) -> Dict[str, Any]:
        """Get accounts configuration."""
        if self._accounts is None:
            self._accounts = load_accounts()
        return self._accounts
    
    def get_themes(self) -> Dict[str, Any]:
        """Get themes configuration."""
        if self._themes is None:
            self._themes = load_themes()
        return self._themes


class AIClientProvider(ABC):
    """Abstract interface for AI client provisioning."""
    
    @abstractmethod
    def get_client(self):
        """Get configured AI client."""
        pass


class DefaultAIClientProvider(AIClientProvider):
    """Default implementation creating AI client from secrets."""
    
    def __init__(self, config_provider: ConfigProvider):
        """Initialize with config provider."""
        self.config_provider = config_provider
        self._client = None
    
    def get_client(self):
        """Get configured AI client."""
        if self._client is None:
            secrets = self.config_provider.get_secrets()
            self._client = create_ai_client(secrets["google_api_key"])
        return self._client


class DIContainer:
    """Dependency injection container for the application."""
    
    def __init__(
        self,
        config_provider: Optional[ConfigProvider] = None,
        ai_client_provider: Optional[AIClientProvider] = None,
        logger_provider: Optional[LoggerProvider] = None
    ):
        """Initialize container with optional custom providers."""
        self.config_provider = config_provider or DefaultConfigProvider()
        self.ai_client_provider = ai_client_provider or DefaultAIClientProvider(self.config_provider)
        self.logger_provider = logger_provider or DefaultLoggerProvider()
    
    def get_config_provider(self) -> ConfigProvider:
        """Get configuration provider."""
        return self.config_provider
    
    def get_ai_client_provider(self) -> AIClientProvider:
        """Get AI client provider."""
        return self.ai_client_provider
    
    def get_logger_provider(self) -> LoggerProvider:
        """Get logger provider."""
        return self.logger_provider
    
    def get_ai_client(self):
        """Get configured AI client."""
        return self.ai_client_provider.get_client()
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get configured logger.
        
        Args:
            name: Logger name (typically module name)
            
        Returns:
            Logger instance
        """
        return self.logger_provider.get_logger(name)
    
    def setup_file_logging(self, log_dir: str) -> None:
        """Setup file logging.
        
        Args:
            log_dir: Directory to store log files
        """
        self.logger_provider.setup_file_logging(log_dir)
    
    def get_generation_policy(self) -> Dict[str, Any]:
        """Convenience method to get generation policy."""
        return self.config_provider.get_generation_policy()
    
    def get_secrets(self) -> Dict[str, Any]:
        """Convenience method to get secrets."""
        return self.config_provider.get_secrets()
    
    def get_accounts(self) -> Dict[str, Any]:
        """Convenience method to get accounts."""
        return self.config_provider.get_accounts()
    
    def get_themes(self) -> Dict[str, Any]:
        """Convenience method to get themes."""
        return self.config_provider.get_themes()


# Global container instance (can be replaced in tests)
_global_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """Get global DI container."""
    global _global_container
    if _global_container is None:
        _global_container = DIContainer()
    return _global_container


def set_container(container: DIContainer) -> None:
    """Set global DI container (for testing)."""
    global _global_container
    _global_container = container


def reset_container() -> None:
    """Reset global DI container (for testing)."""
    global _global_container
    _global_container = None

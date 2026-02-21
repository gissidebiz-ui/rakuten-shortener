"""
Logging provider module for dependency injection.
Provides abstract logger interface and default implementation.
"""
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime


class LoggerProvider(ABC):
    """Abstract interface for logging."""
    
    @abstractmethod
    def get_logger(self, name: str) -> logging.Logger:
        """Get configured logger instance.
        
        Args:
            name: Logger name (typically module name)
            
        Returns:
            Configured logger instance
        """
        pass
    
    @abstractmethod
    def setup_file_logging(self, log_dir: str, filename: str) -> None:
        """Setup file logging.
        
        Args:
            log_dir: Directory to store log files
            filename: Name of log file
        """
        pass


class DefaultLoggerProvider(LoggerProvider):
    """Default logger implementation with file and console output."""
    
    def __init__(self):
        """Initialize logger provider."""
        self._loggers: dict[str, logging.Logger] = {}
        self._log_dir: Optional[str] = None
        self._formatter: Optional[logging.Formatter] = None
        self._setup_formatter()
    
    def _setup_formatter(self) -> None:
        """Setup logging formatter."""
        format_string = "[%(asctime)s] %(levelname)s - %(name)s - %(message)s"
        self._formatter = logging.Formatter(format_string)
    
    def get_logger(self, name: str) -> logging.Logger:
        """Get or create logger.
        
        Args:
            name: Logger name
            
        Returns:
            Configured logger instance
        """
        if name in self._loggers:
            return self._loggers[name]
        
        # Create new logger
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
        
        # Remove existing handlers to avoid duplicates
        logger.handlers.clear()
        
        # Add console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(self._formatter)
        logger.addHandler(console_handler)
        
        # Add file handler if log directory is configured
        if self._log_dir:
            self._add_file_handler(logger)
        
        self._loggers[name] = logger
        return logger
    
    def _add_file_handler(self, logger: logging.Logger) -> None:
        """Add file handler to logger.
        
        Args:
            logger: Logger to add handler to
        """
        if not self._log_dir:
            return
        
        os.makedirs(self._log_dir, exist_ok=True)
        
        # Create daily log file
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(self._log_dir, f"log_{today}.txt")
        
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(self._formatter)
        logger.addHandler(file_handler)
    
    def setup_file_logging(self, log_dir: str, filename: str = "") -> None:
        """Setup file logging directory.
        
        Args:
            log_dir: Directory to store log files
            filename: Not used in default implementation (uses daily file format)
        """
        self._log_dir = log_dir
        
        # Recreate all loggers with file handlers
        for logger in self._loggers.values():
            self._add_file_handler(logger)


# Global logger provider instance
_global_logger_provider: Optional[LoggerProvider] = None


def get_logger_provider() -> LoggerProvider:
    """Get global logger provider.
    
    Returns:
        Global logger provider instance
    """
    global _global_logger_provider
    if _global_logger_provider is None:
        _global_logger_provider = DefaultLoggerProvider()
    return _global_logger_provider


def set_logger_provider(provider: LoggerProvider) -> None:
    """Set global logger provider (for testing).
    
    Args:
        provider: Logger provider instance
    """
    global _global_logger_provider
    _global_logger_provider = provider


def reset_logger_provider() -> None:
    """Reset logger provider to default (for testing)."""
    global _global_logger_provider
    _global_logger_provider = None

"""Tests for logging provider module."""
import unittest
import logging
import tempfile
import os
import sys

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from logging_provider import DefaultLoggerProvider, get_logger_provider, set_logger_provider, reset_logger_provider


class TestLoggingProvider(unittest.TestCase):
    """Test LoggerProvider abstract interface and default implementation."""
    
    def setUp(self):
        """Setup test fixtures."""
        reset_logger_provider()
    
    def tearDown(self):
        """Cleanup after tests."""
        reset_logger_provider()
    
    def test_default_logger_provider_creation(self):
        """Test creating default logger provider."""
        provider = DefaultLoggerProvider()
        self.assertIsNotNone(provider)
    
    def test_get_logger_returns_logger_instance(self):
        """Test get_logger returns logger instance."""
        provider = DefaultLoggerProvider()
        logger = provider.get_logger("test_module")
        
        self.assertIsInstance(logger, logging.Logger)
        self.assertEqual(logger.name, "test_module")
    
    def test_get_logger_caches_loggers(self):
        """Test that get_logger caches logger instances."""
        provider = DefaultLoggerProvider()
        logger1 = provider.get_logger("test")
        logger2 = provider.get_logger("test")
        
        self.assertIs(logger1, logger2)
    
    def test_get_logger_creates_different_loggers(self):
        """Test that get_logger creates different instances for different names."""
        provider = DefaultLoggerProvider()
        logger1 = provider.get_logger("test1")
        logger2 = provider.get_logger("test2")
        
        self.assertIsNot(logger1, logger2)
        self.assertEqual(logger1.name, "test1")
        self.assertEqual(logger2.name, "test2")
    
    def test_setup_file_logging(self):
        """Test file logging setup."""
        provider = DefaultLoggerProvider()
        
        # Just verify the method can be called without error
        with tempfile.TemporaryDirectory() as tmpdir:
            try:
                provider.setup_file_logging(tmpdir)
                self.assertTrue(os.path.exists(tmpdir))
            finally:
                # Clear handlers to avoid file locking issues
                for logger in provider._loggers.values():
                    for handler in logger.handlers[:]:
                        handler.close()
                        logger.removeHandler(handler)
    
    def test_global_logger_provider_singleton(self):
        """Test global logger provider singleton pattern."""
        provider1 = get_logger_provider()
        provider2 = get_logger_provider()
        
        self.assertIs(provider1, provider2)
    
    def test_set_logger_provider(self):
        """Test setting custom logger provider."""
        custom_provider = DefaultLoggerProvider()
        set_logger_provider(custom_provider)
        
        retrieved = get_logger_provider()
        self.assertIs(retrieved, custom_provider)
    
    def test_logger_has_handlers(self):
        """Test that logger has handlers configured."""
        provider = DefaultLoggerProvider()
        logger = provider.get_logger("test_handlers")
        
        # Should have at least console handler
        self.assertGreater(len(logger.handlers), 0)
    
    def test_logger_level_configuration(self):
        """Test logger level is set to DEBUG."""
        provider = DefaultLoggerProvider()
        logger = provider.get_logger("test_level")
        
        self.assertEqual(logger.level, logging.DEBUG)
    
    def test_multiple_loggers_independent(self):
        """Test that multiple loggers are independent."""
        provider = DefaultLoggerProvider()
        logger1 = provider.get_logger("logger1")
        logger2 = provider.get_logger("logger2")
        
        # Each logger should have its own handlers
        self.assertNotEqual(id(logger1.handlers), id(logger2.handlers))


if __name__ == "__main__":
    unittest.main()

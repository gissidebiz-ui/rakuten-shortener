"""
Unit tests for dependency injection container.
Tests DIP principle implementation.
"""
import unittest
import sys
import os
from unittest.mock import Mock, MagicMock

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from di_container import (
    DIContainer, ConfigProvider, DefaultConfigProvider,
    AIClientProvider, DefaultAIClientProvider,
    get_container, set_container, reset_container
)


class TestDependencyInversion(unittest.TestCase):
    """Test suite for dependency inversion principle."""

    def tearDown(self):
        """Reset global container after each test."""
        reset_container()

    def test_config_provider_abstraction(self):
        """Test that ConfigProvider is properly abstracted."""
        provider = DefaultConfigProvider()
        
        # Should be able to get all configurations
        policy = provider.get_generation_policy()
        self.assertIsNotNone(policy)
        
        secrets = provider.get_secrets()
        self.assertIsNotNone(secrets)
        
        accounts = provider.get_accounts()
        self.assertIsNotNone(accounts)
        
        themes = provider.get_themes()
        self.assertIsNotNone(themes)

    def test_ai_client_provider_abstraction(self):
        """Test that AIClientProvider is properly abstracted."""
        config_provider = Mock(spec=ConfigProvider)
        config_provider.get_secrets.return_value = {
            "google_api_key": "test_key"
        }
        
        from unittest.mock import patch
        with patch('di_container.create_ai_client') as mock_create:
            mock_client = Mock()
            mock_create.return_value = mock_client
            
            ai_provider = DefaultAIClientProvider(config_provider)
            client = ai_provider.get_client()
            
            self.assertEqual(client, mock_client)
            mock_create.assert_called_once_with("test_key")

    def test_di_container_factory(self):
        """Test that DI container properly instantiates dependencies."""
        container = DIContainer()
        
        # Should be able to get all dependencies
        config_provider = container.get_config_provider()
        self.assertIsNotNone(config_provider)
        
        ai_client_provider = container.get_ai_client_provider()
        self.assertIsNotNone(ai_client_provider)

    def test_di_container_convenience_methods(self):
        """Test convenience methods on DI container."""
        container = DIContainer()
        
        policy = container.get_generation_policy()
        self.assertIsNotNone(policy)
        
        secrets = container.get_secrets()
        self.assertIsNotNone(secrets)
        
        accounts = container.get_accounts()
        self.assertIsNotNone(accounts)

    def test_global_container_singleton(self):
        """Test that global container works as singleton."""
        container1 = get_container()
        container2 = get_container()
        
        # Should be same instance
        self.assertIs(container1, container2)

    def test_custom_container_injection(self):
        """Test that custom container can be injected."""
        # Create mock providers
        mock_config = Mock(spec=ConfigProvider)
        mock_ai = Mock(spec=AIClientProvider)
        
        custom_container = DIContainer(
            config_provider=mock_config,
            ai_client_provider=mock_ai
        )
        
        # Set custom container
        set_container(custom_container)
        retrieved = get_container()
        
        self.assertIs(retrieved, custom_container)
        self.assertIs(retrieved.config_provider, mock_config)
        self.assertIs(retrieved.ai_client_provider, mock_ai)

    def test_config_caching(self):
        """Test that configs are cached after first load."""
        provider = DefaultConfigProvider()
        
        # First call
        policy1 = provider.get_generation_policy()
        
        # Second call should return same object
        policy2 = provider.get_generation_policy()
        
        self.assertIs(policy1, policy2)

    def test_ai_client_caching(self):
        """Test that AI client is cached after first creation."""
        config_provider = DefaultConfigProvider()
        ai_provider = DefaultAIClientProvider(config_provider)
        
        # First call
        client1 = ai_provider.get_client()
        
        # Second call should return same object
        client2 = ai_provider.get_client()
        
        self.assertIs(client1, client2)


class TestDIPPatternUsage(unittest.TestCase):
    """Test patterns for using DIP in application code."""

    def tearDown(self):
        """Reset global container after each test."""
        reset_container()

    def test_generator_with_injected_dependencies(self):
        """Example of using DI in a generator class."""
        # Mock providers
        mock_config = Mock(spec=ConfigProvider)
        mock_config.get_generation_policy.return_value = {
            "normal_post_generation": {"posts_per_theme": 5}
        }
        mock_ai = Mock(spec=AIClientProvider)
        mock_client = Mock()
        mock_ai.get_client.return_value = mock_client
        
        custom_container = DIContainer(
            config_provider=mock_config,
            ai_client_provider=mock_ai
        )
        
        # Example generator class that uses DI
        class PostGenerator:
            def __init__(self, container: DIContainer):
                self.container = container
            
            def get_config(self):
                return self.container.get_generation_policy()
            
            def get_client(self):
                return self.container.get_ai_client()
        
        generator = PostGenerator(custom_container)
        
        # Verify dependencies are properly injected
        config = generator.get_config()
        self.assertEqual(config["normal_post_generation"]["posts_per_theme"], 5)
        
        client = generator.get_client()
        self.assertEqual(client, mock_client)


if __name__ == "__main__":
    unittest.main()

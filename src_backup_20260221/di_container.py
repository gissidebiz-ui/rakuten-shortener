"""
rktn プロジェクト用 依存性の注入 (DI) モジュール。
依存関係を管理するためのファクトリ関数とコンテナを提供します。
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import logging
from config_loader import load_generation_policy, load_secrets, load_accounts, load_themes
from ai_helpers import create_ai_client
from logging_provider import DefaultLoggerProvider, LoggerProvider


class ConfigProvider(ABC):
    """設定の読み込みを抽象化するインターフェース。"""
    
    @abstractmethod
    def get_generation_policy(self) -> Dict[str, Any]:
        """生成ポリシーの設定を取得します。"""
        pass
    
    @abstractmethod
    def get_secrets(self) -> Dict[str, Any]:
        """機密情報の設定を取得します。"""
        pass
    
    @abstractmethod
    def get_accounts(self) -> Dict[str, Any]:
        """アカウント設定を取得します。"""
        pass
    
    @abstractmethod
    def get_themes(self) -> Dict[str, Any]:
        """テーマの設定を取得します。"""
        pass


class DefaultConfigProvider(ConfigProvider):
    """YAML ファイルから設定を読み込むデフォルトの実装クラス。"""
    
    def __init__(self):
        """初期化。各設定は遅延読み込みされます。"""
        self._policy = None
        self._secrets = None
        self._accounts = None
        self._themes = None
    
    def get_generation_policy(self) -> Dict[str, Any]:
        """生成ポリシーを取得します。初回呼び出し時にファイルを読み込みます。"""
        if self._policy is None:
            self._policy = load_generation_policy()
        return self._policy
    
    def get_secrets(self) -> Dict[str, Any]:
        """機密情報を取得します。初回呼び出し時にファイルを読み込みます。"""
        if self._secrets is None:
            self._secrets = load_secrets()
        return self._secrets
    
    def get_accounts(self) -> Dict[str, Any]:
        """アカウント情報を取得します。初回呼び出し時にファイルを読み込みます。"""
        if self._accounts is None:
            self._accounts = load_accounts()
        return self._accounts
    
    def get_themes(self) -> Dict[str, Any]:
        """テーマ情報を取得します。初回呼び出し時にファイルを読み込みます。"""
        if self._themes is None:
            self._themes = load_themes()
        return self._themes


class AIClientProvider(ABC):
    """AI クライアントを供給するための抽象インターフェース。"""
    
    @abstractmethod
    def get_client(self):
        """設定済みの AI クライアントを取得します。"""
        pass


class DefaultAIClientProvider(AIClientProvider):
    """secrets から情報を読み取って AI クライアントを生成するデフォルト実装。"""
    
    def __init__(self, config_provider: ConfigProvider):
        """設定プロバイダーを指定して初期化します。"""
        self.config_provider = config_provider
        self._client = None
    
    def get_client(self):
        """機密情報から API キーを抽出し、AI クライアントを初期化して返します。"""
        if self._client is None:
            secrets = self.config_provider.get_secrets()
            self._client = create_ai_client(secrets["google_api_key"])
        return self._client


class DIContainer:
    """アプリケーション全体の依存関係を集約管理するコンテナ。"""
    
    def __init__(
        self,
        config_provider: Optional[ConfigProvider] = None,
        ai_client_provider: Optional[AIClientProvider] = None,
        logger_provider: Optional[LoggerProvider] = None
    ):
        """
        各プロバイダーを初期化します。指定がない場合はデフォルトの実装が使用されます。
        """
        self.config_provider = config_provider or DefaultConfigProvider()
        self.ai_client_provider = ai_client_provider or DefaultAIClientProvider(self.config_provider)
        self.logger_provider = logger_provider or DefaultLoggerProvider()
    
    def get_config_provider(self) -> ConfigProvider:
        """設定プロバイダーを取得します。"""
        return self.config_provider
    
    def get_ai_client_provider(self) -> AIClientProvider:
        """AI クライアントプロバイダーを取得します。"""
        return self.ai_client_provider
    
    def get_logger_provider(self) -> LoggerProvider:
        """ロギングプロバイダーを取得します。"""
        return self.logger_provider
    
    def get_ai_client(self):
        """シングルトンとして管理されている AI クライアントを取得します。"""
        return self.ai_client_provider.get_client()
    
    def get_logger(self, name: str) -> logging.Logger:
        """
        指定された名前のロガーを取得します。
        
        Args:
            name: ロガー名（通常はモジュール名）
            
        Returns:
            初期化済みの Logger インスタンス
        """
        return self.logger_provider.get_logger(name)
    
    def setup_file_logging(self, log_dir: str) -> None:
        """
        ファイルへのログ出力をセットアップします。
        
        Args:
            log_dir: ログファイルを保存するディレクトリ
        """
        self.logger_provider.setup_file_logging(log_dir)
    
    def get_generation_policy(self) -> Dict[str, Any]:
        """生成ポリシーを直接取得するためのショートカットメソッド。"""
        return self.config_provider.get_generation_policy()
    
    def get_secrets(self) -> Dict[str, Any]:
        """機密情報を直接取得するためのショートカットメソッド。"""
        return self.config_provider.get_secrets()
    
    def get_accounts(self) -> Dict[str, Any]:
        """アカウント設定を直接取得するためのショートカットメソッド。"""
        return self.config_provider.get_accounts()
    
    def get_themes(self) -> Dict[str, Any]:
        """テーマ設定を直接取得するためのショートカットメソッド。"""
        return self.config_provider.get_themes()


# プログラム全体で共有されるグローバルコンテナインスタンス
_global_container: Optional[DIContainer] = None


def get_container() -> DIContainer:
    """
    グローバルコンテナを取得します。存在しない場合は新規作成します。
    """
    global _global_container
    if _global_container is None:
        _global_container = DIContainer()
    return _global_container


def set_container(container: DIContainer) -> None:
    """
    グローバルコンテナを差し替えます（主にテスト用）。
    """
    global _global_container
    _global_container = container


def reset_container() -> None:
    """
    グローバルコンテナをリセット（消去）します（テスト環境のクリーンアップ用）。
    """
    global _global_container
    _global_container = None

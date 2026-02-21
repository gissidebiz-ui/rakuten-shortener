"""
依存性の注入 (DI) 用のロギング提供モジュール。
抽象ロガーインターフェースと、そのデフォルトの実装を提供します。
"""
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional
from datetime import datetime


class LoggerProvider(ABC):
    """ロギング機能の抽象インターフェース。"""
    
    @abstractmethod
    def get_logger(self, name: str) -> logging.Logger:
        """
        設定済みのロガーインスタンスを取得します。
        
        Args:
            name: ロガーの名前（通常はモジュール名）
            
        Returns:
            設定済みの Logger インスタンス
        """
        pass
    
    @abstractmethod
    def setup_file_logging(self, log_dir: str, filename: str) -> None:
        """
        ファイルへのロギングをセットアップします。
        
        Args:
            log_dir: ログファイルを保存するディレクトリ
            filename: ログファイルの名前
        """
        pass


class DefaultLoggerProvider(LoggerProvider):
    """標準的なファイル出力とコンソール出力を備えたロガーの実装。"""
    
    def __init__(self):
        """ロガープロバイダーを初期化します。"""
        self._loggers: dict[str, logging.Logger] = {}
        self._log_dir: Optional[str] = None
        self._formatter: Optional[logging.Formatter] = None
        self._setup_formatter()
    
    def _setup_formatter(self) -> None:
        """ログの出力形式（フォーマッタ）を設定します。"""
        # [日時] レベル - 名前 - メッセージ の形式
        format_string = "[%(asctime)s] %(levelname)s - %(name)s - %(message)s"
        self._formatter = logging.Formatter(format_string)
    
    def get_logger(self, name: str) -> logging.Logger:
        """
        ロガーを取得または新規作成します。
        
        Args:
            name: ロガー名
            
        Returns:
            設定済みの Logger インスタンス
        """
        if name in self._loggers:
            return self._loggers[name]
        
        # 新しいロガーを作成
        logger = logging.getLogger(name)
        logger.setLevel(logging.DEBUG)
        
        # 二重出力を防ぐため、既存のハンドラをクリア
        logger.handlers.clear()
        
        # コンソール出力用ハンドラを追加
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO) # コンソールは INFO 以上
        console_handler.setFormatter(self._formatter)
        logger.addHandler(console_handler)
        
        # ログディレクトリが設定されている場合は、ファイル出力用ハンドラも追加
        if self._log_dir:
            self._add_file_handler(logger)
        
        self._loggers[name] = logger
        return logger
    
    def _add_file_handler(self, logger: logging.Logger) -> None:
        """
        ロガーにファイル出力ハンドラを追加します。
        
        Args:
            logger: ハンドラを追加する対象のロガー
        """
        if not self._log_dir:
            return
        
        os.makedirs(self._log_dir, exist_ok=True)
        
        # 日付ごとのログファイル名を作成 (log_2026-02-21.txt 等)
        today = datetime.now().strftime("%Y-%m-%d")
        log_file = os.path.join(self._log_dir, f"log_{today}.txt")
        
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG) # ファイルには DEBUG レベルも詳細に記録
        file_handler.setFormatter(self._formatter)
        logger.addHandler(file_handler)
    
    def setup_file_logging(self, log_dir: str, filename: str = "") -> None:
        """
        ファイル出力用のディレクトリをセットアップし、既存ロガーに反映します。
        
        Args:
            log_dir: ログファイルを保存するディレクトリ
            filename: デフォルト実装では使用しません（日付別ファイル固定のため）
        """
        self._log_dir = log_dir
        
        # すでに生成済みのロガーすべてにファイルハンドラを追加（再適用）
        for logger in self._loggers.values():
            self._add_file_handler(logger)


# グローバルなロガープロバイダーインスタンス（シングルトン）
_global_logger_provider: Optional[LoggerProvider] = None


def get_logger_provider() -> LoggerProvider:
    """
    グローバルなロガープロバイダーを取得します。
    
    Returns:
        グローバルな LoggerProvider インスタンス
    """
    global _global_logger_provider
    if _global_logger_provider is None:
        _global_logger_provider = DefaultLoggerProvider()
    return _global_logger_provider


def set_logger_provider(provider: LoggerProvider) -> None:
    """
    グローバルなロガープロバイダーを差し替えます（主にテスト用）。
    
    Args:
        provider: 差し替えるロガープロバイダーインスタンス
    """
    global _global_logger_provider
    _global_logger_provider = provider


def reset_logger_provider() -> None:
    """ロガープロバイダーをデフォルト状態にリセットします（テスト用）。"""
    global _global_logger_provider
    _global_logger_provider = None

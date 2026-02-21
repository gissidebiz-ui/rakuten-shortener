"""
設定読み込みモジュール。
YAML 形式の設定ファイルを読み込み、辞書形式で提供します。
"""
import os
import yaml  # type: ignore
from typing import Dict, Any


def load_yaml(path: str) -> Dict[str, Any]:
    """YAML ファイルを読み込んで辞書として返します。
    
    Args:
        path: YAML ファイルへのパス
        
    Returns:
        解析された YAML 内容を含む辞書
        
    Raises:
        FileNotFoundError: ファイルが存在しない場合
        yaml.YAMLError: YAML の解析に失敗した場合
    """
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def _get_config_path(filename: str) -> str:
    """モジュールの位置に基づいて、config フォルダ内のファイルの絶対パスを取得します。
    
    Args:
        filename: 設定ファイル名 (例: 'secrets.yaml')
        
    Returns:
        設定ファイルの絶対パス
    """
    # このモジュールは src/ ディレクトリにあります
    # 設定ファイルは ../config/ にあります
    src_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(src_dir)
    path = os.path.join(root_dir, "config", filename)
    # テストの期待値に合わせてバックスラッシュをスラッシュに正規化します
    return path.replace("\\", "/")


def load_secrets() -> Dict[str, Any]:
    """config/secrets.yaml から機密情報（APIキーなど）を読み込みます。
    
    Returns:
        API キーや認証情報を含む辞書
    """
    return load_yaml(_get_config_path("secrets.yaml"))


def load_generation_policy() -> Dict[str, Any]:
    """config/generation_policy.yaml から生成ポリシーを読み込みます。
    
    Returns:
        生成ポリシーやパラメータを含む辞書
    """
    return load_yaml(_get_config_path("generation_policy.yaml"))


def load_accounts() -> Dict[str, Any]:
    """config/accounts.yaml からアカウント設定を読み込みます。
    
    Returns:
        アカウント名と設定の対応マッピング
    """
    # 生のマッピング（辞書）を返し、呼び出し側で利用できるようにします
    return load_yaml(_get_config_path("accounts.yaml"))


def load_themes() -> Dict[str, Any]:
    """config/themes.yaml からテーマ定義を読み込みます。
    
    Returns:
        テーマ定義を含む辞書
    """
    return load_yaml(_get_config_path("themes.yaml"))

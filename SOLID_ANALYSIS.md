# SOLID 原則準拠状況分析レポート

## 概要
本プロジェクトのPythonコード（normal_post_generator.py, affiliate_post_generator.py, make_input_csv.py, utils.py など）のSOLID原則への準拠状況を分析しました。

---

## 1. Single Responsibility Principle (SRP) - 単一責任の原則

### 現状：❌ 部分的に違反

#### 問題点：
- **normal_post_generator.py**
  - ポスト生成、テーマ選択、ファイル書き込みを同一ファイルで実施
  - `generate_posts_for_theme()` 内で生成と再試行ロジックが混在
  
- **affiliate_post_generator.py**
  - HTML削除、CSV読み込み、投稿生成、Git操作を同一モジュールで処理
  - `main()` 関数が複数の責任を持つ（cleanup, generate, commit/push）

- **make_input_csv.py**
  - APIリクエスト、データ抽出、重複排除、ファイル書き込みが混在
  - `fetch_items()` が責任過剰

#### 改善案：
```
推奨構成：
├── data_fetcher.py       # API取得のみ
├── data_processor.py     # 重複排除・データ抽出
├── csv_writer.py         # CSV書き込み
├── post_generator.py     # ポスト生成
├── post_publisher.py     # Git操作
└── file_manager.py       # ファイル管理（削除など）
```

---

## 2. Open/Closed Principle (OCP) - 開放/閉鎖の原則

### 現状：❌ 大部分で違反

#### 問題点：
- **ハードコードされた定数が多い**
  - `normal_post_generator.py`: テーマ数4つ、ポスト数5つが固定
  - `affiliate_post_generator.py`: 5日間の削除期限が固定コード
  - `make_input_csv.py`: DEFAULT_ITEM_NUM=5 がグローバル変数

- **APIレスポンス形式の条件分岐が複雑**
  - `make_input_csv.py` の `fetch_items()` で複数の JSON構造に対応
  - 新しい形式を追加する場合、コード修正が必須

- **再試行ロジックが複数箇所に重複**
  - `normal_post_generator.py` と `affiliate_post_generator.py` が同じ再試行パス実装

#### 改善案：
```python
# Config-driven approach (設定ベース)
# config/generation_policy.yaml
generation_policy:
  normal:
    posts_per_theme: 5
    selected_themes_per_account: 4
    retry_passes: 3
  affiliate:
    html_retention_days: 5
    retry_passes: 3

# コードは設定から値を読む
config = load_yaml("../config/generation_policy.yaml")
for _ in range(config["generation_policy"]["normal"]["posts_per_theme"]):
    # ...
```

---

## 3. Liskov Substitution Principle (LSP) - リスコフの置換原則

### 現状：⚠️ 該当なし（Pythonクラス設計が少ないため）

#### 観察：
- プロジェクトは class ベースの設計ではなく、関数ベース
- 継承やポリモーフィズムがほぼ使用されていない
- LSP は主にOOP言語の原則なため、直接適用は難しい

#### 改善案（オプション）：
```python
# 処理を抽象化したクラス構造を導入
from abc import ABC, abstractmethod

class PostGenerator(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str:
        pass

class AIPostGenerator(PostGenerator):
    def generate(self, prompt: str) -> str:
        return generate_with_retry(self.client, prompt)

class MockPostGenerator(PostGenerator):
    def generate(self, prompt: str) -> str:
        return "テスト投稿"
```

---

## 4. Interface Segregation Principle (ISP) - インターフェース分離の原則

### 現状：⚠️ 弱い（インターフェース定義がないため）

#### 問題点：
- `utils.py` の関数が多機能（load_yaml, create_ai_client, generate_with_retry, create_redirect_html など）
- 呼び出し側が必要ない関数もインポートしている可能性がある
- 例：`normal_post_generator.py` は `generate_short_url` が不要だが、同じ utils から import

#### 改善案：
```python
# 機能ごとにモジュールを分割
├── config_loader.py      # load_yaml, load_secrets
├── ai_client.py          # create_ai_client, generate_with_retry
├── html_generator.py     # create_redirect_html, generate_short_url
└── post_generator.py     # 必要な機能のみ import
```

---

## 5. Dependency Inversion Principle (DIP) - 依存性逆転の原則

### 現状：❌ 違反

#### 問題点：
- **↑ 高レベルモジュール（normal_post_generator.py）が↓低レベルモジュール（utils.py）に直接依存**
  ```python
  from utils.utils import load_yaml, create_ai_client, generate_with_retry
  ```

- **Google API クライアント（genai）が直接注入される**
  - `generate_with_retry()` が外部の genai ライブラリに直接依存

- **ファイルI/O（open()）が直接呼び出されている**
  - テストやモック化が困難

#### 改善案（DI = Dependency Injection）：
```python
# 1. 抽象インターフェースを定義
from abc import ABC, abstractmethod

class AIClient(ABC):
    @abstractmethod
    def generate_content(self, prompt: str) -> str:
        pass

# 2. 実装と抽象を分離
class GoogleAIClient(AIClient):
    def __init__(self, api_key: str):
        self.client = genai.Client(api_key=api_key)
    
    def generate_content(self, prompt: str) -> str:
        return generate_with_retry(self.client, prompt)

# 3. 高レベルモジュールに注入
def generate_posts(ai_client: AIClient, theme: str):
    return ai_client.generate_content(theme)
```

---

## 総合評価表

| 原則 | 評価 | 理由 |
|------|-----|------|
| SRP  | ❌ | 関数が複数の責任を持つ |
| OCP  | ❌ | ハードコード・条件分岐が多い |
| LSP  | ⚠️ | クラス設計が不足 |
| ISP  | ⚠️ | インターフェース定義がない |
| DIP  | ❌ | 直接依存が多く、DI が使用されていない |

**総合スコア**: 1.4/5.0（低い）

---

## 優先度別改善案

### Phase 1（最優先・効果大）
1. **utils.py を機能ごとに分割**
   - config_loader.py, ai_helpers.py, html_generator.py に分割
   - 各モジュールが明確な責任を持つ

2. **設定をコードから抽出**
   - config/generation_policy.yaml を追加
   - ハードコードされた定数（4, 5, 3など）をすべて移す

3. **再試行ロジックを共通化**
   - retry_helper.py を作成し、全モジュールが使用

### Phase 2（中優先・小規模リファクタリング）
4. **関数の責任を分離**
   - `generate_posts_for_theme()` を：
     - `generate_batch()` （指定数生成）
     - `retry_failed_posts()` （失敗分再試行）
     に分割

5. **ファイルI/O を抽象化**
   - FileWriter, FileReader インターフェースを導入
   - テスト時のモック化が容易に

### Phase 3（低優先・長期計画）
6. **DI フレームワークの導入**（オプション）
   - dependency_injector, injector など
   - ただし小規模プロジェクトでは初期コストが高い

---

## コード例：改善後の参考実装

```python
# 改善後の normal_post_generator.py (概要)

from config_loader import load_config
from ai_helpers import PostGeneratorWithRetry
from file_manager import FileWriter

class NormalPostGeneratorTask:
    def __init__(self, ai_client, config: dict, file_writer: FileWriter):
        self.ai_client = ai_client
        self.config = config
        self.file_writer = file_writer
        self.generator = PostGeneratorWithRetry(ai_client, config)

    def generate_for_account(self, account: str, themes: list) -> list:
        selected_themes = random.sample(
            themes, 
            min(self.config["selected_themes_per_account"], len(themes))
        )
        # ...他の処理

if __name__ == "__main__":
    config = load_config("../config/generation_policy.yaml")
    ai_client = create_ai_client()
    file_writer = FileWriter("../data/output")
    
    task = NormalPostGeneratorTask(ai_client, config, file_writer)
    task.execute()
```

---

## 結論

現在のコードは**迅速な実装重視**で作成されており、スケーラビリティやメンテナンス性の観点では改善余地があります。

- **短期的には機能するが、変更や拡張が困難**
- **テストが書きづらく、品質保証が難しい**
- **SOLID原則への準拠度は全体的に低い**

**推奨**: Phase 1 の改善（utils分割 + 設定抽出）を優先し、段階的にリファクタリングすることで、コード品質を向上させることが望まれます。


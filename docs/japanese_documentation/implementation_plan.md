# 実装計画 - 各処理コメントの日本語化と改善

ソースコード内の英語のコメントや Docstring をすべて日本語に翻訳し、日本人開発者が処理内容を直感的に理解できるように改善します。

## 概要

現在、高度な SOLID リファクタリングによりモジュール化されていますが、一部の Docstring やコメントが英語のままになっています。これらを日本語化し、かつ「何をしているか」だけでなく「なぜそうしているか（背景）」も含めて分かりやすく記載します。

## 変更内容

以下の全モジュールに対して、以下の修正を行います。

- **Docstring の日本語化**: クラス、メソッド、関数の説明、引数 (`Args`)、戻り値 (`Returns`) を日本語にします。
- **インラインコメントの改善**: 複雑な条件分岐や計算ロジックに、噛み砕いた日本語の解説を追加します。
- **用語の統一**: 「Dependency Injection」→「依存性の注入 (DI)」など、分かりやすい用語を使用します。

### 対象ファイル

1. `src/di_container.py`: 依存関係の管理ロジック
2. `src/config_loader.py`: 設定ファイルの読み込み
3. `src/retry_helper.py`: 指数バックオフなどのリトライ支援
4. `src/ai_helpers.py`: Gemini API との連携
5. `src/html_generator.py`: OGP 対応リダイレクト HTML 生成
6. `src/logging_provider.py`: ログローテーション設定
7. `src/make_input_csv.py`: 楽天APIからの商品・ホテル取得
8. `src/normal_post_generator.py`: 通常ポストの生成ロジック
9. `src/affiliate_post_generator.py`: アフィリエイトポストの生成
10. `src/merge_posts.py`: ポストのマージとクリーンアップ
11. `src/run_all.py`: パイプライン全体の実行制御
12. `src/secrets_template_generator.py`: テンプレート生成ツール

## 検証計画

### 自動検証

- 全ファイルを `python -m py_compile` でチェックし、コメントの修正によって構文エラーが発生していないことを確認します。

### 手動検証

- 各ファイルのコメントが自然な日本語であり、処理内容が正しく伝わるかセルフレビューを行います。

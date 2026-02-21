# 実装計画 - 処理の最適化と高速化

## 概要

現在の逐次実行パイプラインを最適化し、全体の実行時間を短縮します。主な変更点は、サブプロセス起動の廃止によるオーバーヘッド削減と、I/O待ちが発生する処理（APIリクエスト、AI生成）の並列化です。

## 変更内容

### 1. サブプロセス起動からの脱却

#### [MODIFY] [run_all.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/run_all.py)

- `subprocess.run(["python", "script.py"])` を廃止
- `make_input_csv.py`, `normal_post_generator.py`, `affiliate_post_generator.py` をモジュールとしてインポート
- インポートしたクラスの `generate()` メソッドを直接呼び出すよう変更

### 2. APIリクエストの並列化

#### [MODIFY] [make_input_csv.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/make_input_csv.py)

- `concurrent.futures.ThreadPoolExecutor` を導入
- 複数ジャンルの API リクエストを並列に実行
- 楽天 API の 1秒間に1リクエスト制限を遵守しつつの最適化（適度なワーカ数設定）

### 3. AI投稿文生成の並列化

#### [MODIFY] [normal_post_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/normal_post_generator.py)

#### [MODIFY] [affiliate_post_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/affiliate_post_generator.py)

- AI（Gemini）へのプロンプト送信と待機を並列化
- 並行リクエスト数を制御（レート制限エラー回避のため）

### 4. バックアップの作成

- 変更作業の前に `src` フォルダの内容を `src_backup_[timestamp]` または別名のフォルダにコピーします。

## 検証計画

### 自動テスト

- `run_all.py` を実行し、正常に完了することを確認。
- 各出力ファイル（`data/input/*.csv`, `data/output/*.txt`）が正しく生成されていることを確認。

### パフォーマンス検証

- 修正前と修正後の総実行時間を比較し、高速化の効果を測定。

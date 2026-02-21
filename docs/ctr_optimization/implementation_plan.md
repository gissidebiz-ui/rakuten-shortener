# 実装計画 - CTR 向上に向けたデータ拡張とプロンプト改善

## 概要

アフィリエイトポストのクリック率（CTR）を向上させるため、楽天 API から「価格」「評価」「ポイント還元率」などの魅力的な情報を追加で取得し、それを Gemini AI のプロンプトに組み込むことで、より説得力のある投稿文を生成します。また、OGP カードのタイトルも強化します。

## 変更内容

### 1. 楽天 API からの取得データ拡張

#### [MODIFY] [make_input_csv.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/make_input_csv.py)

- API レスポンスから以下のフィールドを追加で抽出するように変更:
  - `itemPrice` / `hotelMinCharge` (価格)
  - `reviewAverage` (評価点)
  - `reviewCount` (レビュー数)
  - `pointRate` (ポイント倍率)
- 保存する CSV の列を増やし、これらの情報を保持するようにします。

### 2. 生成プロンプトの強化

#### [MODIFY] [affiliate_post_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/affiliate_post_generator.py)

- 拡張された CSV データを読み込み、`generate_post_text` メソッドへ渡します。
- プロンプトに価格や評価、レビュー数を反映するように指示を追加します。
  - 例: 「★4.8の高評価」「今だけポイント10倍」などのフレーズを自然に組み込むよう指示。

### 3. OGP カードの魅力向上

#### [MODIFY] [html_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/html_generator.py)

- 生成される HTML の `<title>` タグや `og:title` に、価格や評価情報を付加するように修正します。
  - 例: 「商品名」→「【★4.5/ポイント10倍】商品名 - 楽天」

## 保存場所

- `docs/ctr_optimization` フォルダに本計画とタスクリストを保存します。

## 検証計画

### 自動検証

- `run_all.py` を実行し、CSV の列数増加に伴うエラーが発生しないことを確認。
- 生成された HTML のソースを確認し、OGP メタタグに正しい情報が入っていることを確認。

### 内容レビュー

- 生成された X 向けの投稿文を目視確認し、従来の汎用的な文言よりも「魅力（お得感・信頼感）」が向上しているか評価します。

# 実装計画 - ぴょんアカウントに楽天トラベルランキングを追加

ぴょんアカウントの `genres` に楽天トラベルのランキング情報を追加し、アフィリエイトポストのバリエーションを増やします。

## 変更内容

### [accounts.yaml](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/config/accounts.yaml)

- `ぴょん` アカウントの `genres` セクションに `トラベル` を追加。
- 楽天トラベルランキングAPI（HotelRanking）のURLを設定。
  - URL案: `https://app.rakuten.co.jp/services/api/Travel/HotelRanking/20170426?hits=5`

## 懸念点

- 楽天トラベルAPIはレスポンス構造が他のAPI（BooksやIchibaItem）と異なる可能性があるため、`src/make_input_csv.py` でのパース処理が正しく動作するか検証が必要です。

## 検証計画

- `python src/run_all.py` または `python src/make_input_csv.py` を実行し、`data/input/ぴょん_input.csv` にトラベル関連のデータが含まれることを確認します。

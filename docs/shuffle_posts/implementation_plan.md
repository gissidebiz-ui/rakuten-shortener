# 実装計画 - 投稿内容のシャッフル機能追加

通常ポスト（テーマ別）およびアフィリエイトポストの出力順をシャッフルし、投稿内容の並びをランダム化します。

## 概要

現状、各ジェネレーターはテーマごと、あるいはジャンルごとに順番通りに投稿文を生成・蓄積しています。これをそのままマージすると、同じテーマやジャンルの投稿が連続しがちになります。
出力直前にリストをシャッフルすることで、マージ後の最終的な投稿順（`merged.txt`）をより自然にばらつかせます。

## 変更内容

### [normal_post_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/normal_post_generator.py) [MODIFY]

- `generate` メソッド内で、全ポストを集約した `all_posts` リストをファイル出力する直前に `random.shuffle()` を実行するように修正します。

### [affiliate_post_generator.py](file:///c:/Users/hax37/Documents/yusuke_doc/git/work/rktn/src/affiliate_post_generator.py) [MODIFY]

- `import random` を追加します。
- `generate` メソッド内で、生成された `entries` リスト（または最終的な `posts` リスト）をファイル出力する直前に `random.shuffle()` を実行するように修正します。

## 検証計画

### 手動検証

1. `src/run_all.py` を実行します。
2. 生成された `{account}_normal_posts.txt` および `affiliate_posts.txt` を開き、内容が特定のテーマやジャンルで固まっておらず、シャッフルされていることを視認で確認します。
3. `merged.txt` がそれらを交互に組み合わせた結果、さらに多様な順序になっていることを確認します。

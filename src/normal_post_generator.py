import time
import random
from config_loader import load_accounts, load_themes, load_secrets, load_generation_policy
from ai_helpers import create_ai_client, generate_with_retry

# ================================
# 1. 設定読み込み
# ================================
accounts = load_accounts()
themes = load_themes()
config = load_generation_policy()

# ================================
# 2. Google AI API 設定
# ================================
secrets = load_secrets()
API_KEY = secrets["google_api_key"]
client = create_ai_client(API_KEY)

# ================================
# 3. テーマごとに5ポスト生成
# ================================
def generate_posts_for_theme(theme_key):
    prompt = themes[theme_key]
    posts = []
    
    posts_per_theme = config["normal_post_generation"]["posts_per_theme"]

    for i in range(posts_per_theme):
        print(f"生成中: {theme_key} → {i+1}/{posts_per_theme}")
        text = generate_with_retry(client, prompt, config["normal_post_generation"])
        text = text.replace("\n", "\\n")
        posts.append(text)

    # 初回生成で空やエラーの結果がある場合、それらだけ再試行パスを回す
    def _is_failed(p):
        if p is None:
            return True
        s = str(p).strip()
        return s == "" or s.startswith("[AIエラー]")

    failed_idxs = [i for i, p in enumerate(posts) if _is_failed(p)]
    if failed_idxs:
        retry_passes = config["normal_post_generation"]["retry_passes"]
        for rp in range(1, retry_passes + 1):
            print(f"[再試行パス {rp}/{retry_passes}] 空の生成結果を再実行します: {len(failed_idxs)} 件")
            for idx in failed_idxs[:]:
                print(f"再試行: {theme_key} インデックス {idx+1}")
                text = generate_with_retry(client, prompt, config["normal_post_generation"])
                if text:
                    text = text.replace("\n", "\\n")
                if not _is_failed(text):
                    posts[idx] = text
                    failed_idxs.remove(idx)
            if not failed_idxs:
                break

    return posts

# ================================
# 4. メイン処理
# ================================
def main():
    for account, data in accounts.items():
        theme_list = data.get("themes", [])

        print(f"\n=== {account} の通常ポスト生成開始 ===")

        # テーマをランダムで選択（設定値を使用）
        selected_count = config["normal_post_generation"]["selected_themes_per_account"]
        selected_themes = random.sample(theme_list, min(selected_count, len(theme_list)))
        print(f"選択されたテーマ: {selected_themes}")

        all_posts = []

        for theme in selected_themes:
            posts = generate_posts_for_theme(theme)
            all_posts.extend(posts)

        output_path = f"../data/output/{account}_posts.txt"

        with open(output_path, "w", encoding="utf-8") as f:
            for p in all_posts:
                f.write(p + "\n")

        print(f"{account} の通常ポスト {len(all_posts)}件を出力しました → {output_path}")

    print("\nすべてのアカウントの通常ポスト生成が完了しました！")

if __name__ == "__main__":
    main()

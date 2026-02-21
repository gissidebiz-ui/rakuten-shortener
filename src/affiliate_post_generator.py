import os
import csv
import glob
import time
import subprocess
from config_loader import load_accounts, load_secrets, load_generation_policy
from ai_helpers import create_ai_client, generate_with_retry
from html_generator import generate_short_url

# ================================
# 1. 設定読み込み
# ================================
accounts = load_accounts()
config = load_generation_policy()

# ================================
# 2. Google AI API 設定
# ================================
secrets = load_secrets()
API_KEY = secrets["google_api_key"]
client = create_ai_client(API_KEY)

# ================================
# 3. 古いHTML削除（index.htmlだけ残す）
# ================================
def cleanup_html():
    html_dir = "../html"
    now = time.time()
    
    # 設定から保持日数を取得
    html_config = config.get("html_cleanup", {})
    retention_days = config.get("affiliate_post_generation", {}).get("html_retention_days", 5)
    seconds_in_retention = retention_days * 24 * 60 * 60
    
    excluded_files = html_config.get("excluded_files", ["index.html"])
    extensions = html_config.get("default_extensions", [".html"])

    for f in os.listdir(html_dir):
        # 除外ファイルをスキップ、指定拡張子のみを対象
        if f in excluded_files or not any(f.endswith(ext) for ext in extensions):
            continue
            
        file_path = os.path.join(html_dir, f)
        file_mtime = os.path.getmtime(file_path)
        
        # 保持期間を超えたファイルを削除
        if now - file_mtime > seconds_in_retention:
            try:
                os.remove(file_path)
                print(f"削除しました: {f} ({retention_days}日以上経過)")
            except Exception as e:
                print(f"削除失敗: {f} - {e}")

# ================================
# 4. 投稿文生成
# ================================
def generate_post_text(product_name, short_url):
    max_name_len = config["affiliate_post_generation"].get("max_product_name_length", 80)
    safe_name = product_name[:max_name_len]

    prompt = f"""
以下の情報から、X（旧Twitter）向けの投稿文を作成してください。
※文章の中にURLは絶対に含めないでください。

【商品名】
{safe_name}

条件：
・本文は50文字以内
・売れそうなキャッチコピー寄り
・強すぎず自然なテンション
・絵文字は1つだけ
・短縮URLは文末に置く
・宣伝臭くしない
・1行で完結（改行しない）
"""
    text = generate_with_retry(client, prompt, config["affiliate_post_generation"])
    
    # 1. 不要なURL混入を削除（安全策）
    import re
    text = re.sub(r'https?://[\w/:%#\$&\?\(\)~\.=\+\-]+', '', text).strip()
    
    # 2. ハッシュタグが含まれているかチェック
    if "#" in text:
        text = text.replace(" #", "\\n#").replace("　#", "\\n#")
        text = re.sub(r'([^\\n])#', r'\1\\n#', text)

    # 3. 最終組み立て
    return f"{text}\\n\\n{short_url}"

# ================================
# 5. メイン処理
# ================================
def main():

    cleanup_html()

    input_files = glob.glob("../data/input/*_input.csv")

    for input_path in input_files:
        filename = os.path.basename(input_path)
        account = filename.replace("_input.csv", "")

        output_path = f"../data/output/{account}_affiliate_posts.txt"
        posts = []

        # main関数内のループ
        # 読み込み→短縮URL生成→生成（失敗は再試行するため蓄積）
        entries = []
        with open(input_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                try:
                    if len(row) < 3:
                        continue
                    product_name = row[0]
                    affiliate_url = row[1]
                    image_url = row[2]

                    short_url = generate_short_url(affiliate_url, product_name, image_url)
                    entries.append({
                        "product_name": product_name,
                        "short_url": short_url,
                        "post": None
                    })
                except Exception as e:
                    print(f"[ERROR] 行処理失敗: {row}")
                    import traceback
                    traceback.print_exc()
                    continue

        # 初回生成
        for e in entries:
            e["post"] = generate_post_text(e["product_name"], e["short_url"])

        # 失敗（空文字やAIエラー）だけ再試行するパス
        def _is_failed(p):
            if p is None:
                return True
            s = str(p).strip()
            return s == "" or s.startswith("[AIエラー]")

        failed_idxs = [i for i, e in enumerate(entries) if _is_failed(e.get("post"))]
        if failed_idxs:
            # 設定から再試行パス数を取得
            retry_passes = config["affiliate_post_generation"].get("retry_passes", 3)
            for rp in range(1, retry_passes + 1):
                print(f"[再試行パス {rp}/{retry_passes}] アフィリエイト投稿の空結果を再実行します: {len(failed_idxs)} 件")
                for idx in failed_idxs[:]:
                    e = entries[idx]
                    try:
                        new_post = generate_post_text(e["product_name"], e["short_url"])
                        if not _is_failed(new_post):
                            entries[idx]["post"] = new_post
                            failed_idxs.remove(idx)
                    except Exception as ex:
                        print(f"[ERROR] 再試行で失敗: {e['product_name']}")

        # 出力リスト作成
        for e in entries:
            posts.append(e.get("post") or "")

        with open(output_path, "w", encoding="utf-8") as f:
            for p in posts:
                # 念のため、出力直前に「2重のバックスラッシュ」を「1本のバックスラッシュ」に強制変換
                safe_post = p.replace("\\\\n", "\\n") 
                f.write(safe_post + "\n")

        print(f"{output_path} を生成しました！")

    try:
        subprocess.run(["git", "add", "-A"], check=True)
        subprocess.run(["git", "commit", "-m", "AI auto post update"], check=True)
        subprocess.run(["git", "push"], check=True)
    except Exception as e:
        print(f"GitHub push エラー: {e}")

    print("全アカウントのアフィリエイト投稿文生成が完了しました！")

if __name__ == "__main__":
    main()

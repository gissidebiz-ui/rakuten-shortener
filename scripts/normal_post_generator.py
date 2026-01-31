import time
from google import genai

# ================================
# 1. Google AI API 設定
# ================================
client = genai.Client(api_key="YOUR_API_KEY")  # ← あなたのキーを入れる

# ================================
# 2. AI呼び出し（リトライ付き）
# ================================
def generate_with_retry(prompt, max_retries=5):
    for i in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )

            if hasattr(response, "text") and response.text:
                return response.text.strip()
            else:
                return response.candidates[0].content.parts[0].text.strip()

        except Exception as e:
            wait = 1 + i
            print(f"AI呼び出し失敗: {e} → {wait}秒待機して再試行")
            time.sleep(wait)

    return "[AIエラー] 最大リトライ回数を超えました"

# ================================
# 3. テーマ別プロンプト
# ================================
THEMES = {
    "daily_insight": """
あなたは日常の小さな気づきを共有するXユーザーです。
以下の条件で自然な通常ポストを1つ生成してください。

条件：
・内容は「日常の気づき」「小さな学び」「ミニ哲学」
・前向きすぎず、説教臭くしない
・共感されやすい軽い気づき
・文字数は80文字以内
・絵文字は使っても使わなくてもよい（使う場合は1つだけ）
・1行で完結（改行なし）
""",

    "life_habit": """
あなたは生活改善や習慣化のコツを発信するXユーザーです。
以下の条件で通常ポストを1つ生成してください。

条件：
・生活が1%良くなる小さな習慣を紹介
・押しつけがましくしない
・誰でもできる簡単な内容
・文字数は80文字以内
・絵文字は1つまで
・1行で完結（改行なし）
""",

    "tech_ai": """
あなたはテクノロジーやAIの豆知識を発信するXユーザーです。
以下の条件で通常ポストを1つ生成してください。

条件：
・AIやテクノロジーに関するライトな豆知識
・専門用語を使いすぎない
・初心者でも理解できる内容
・文字数は80文字以内
・絵文字は1つまで
・1行で完結（改行なし）
""",

    "money_tips": """
あなたは投資やお金の知識をライトに発信するXユーザーです。
以下の条件で通常ポストを1つ生成してください。

条件：
・初心者向けの投資やお金の小ネタ
・具体的な銘柄名や推奨は書かない
・リスクを煽らない
・文字数は80文字以内
・絵文字は1つまで
・1行で完結（改行なし）
""",

    "quote_comment": """
あなたは名言を紹介し、短い感想を添えるXユーザーです。
以下の条件で通常ポストを1つ生成してください。

条件：
・有名な名言を1つ引用（著作権に問題ないもの）
・その後に短い感想を一言添える
・文字数は80文字以内
・絵文字は1つまで
・1行で完結（改行なし）
""",

    "humor": """
あなたは日常の「あるある」や軽いユーモアを投稿するXユーザーです。
以下の条件で通常ポストを1つ生成してください。

条件：
・日常の小さな笑い、共感ネタ
・攻撃的・皮肉・悪口はNG
・ゆるくて読みやすい内容
・文字数は80文字以内
・絵文字は1つまで
・1行で完結（改行なし）
"""
}

# ================================
# 4. テーマごとに10ポスト生成
# ================================
def generate_posts_for_theme(theme_key):
    prompt = THEMES[theme_key]
    posts = []
    for i in range(10):
        print(f"生成中: {theme_key} → {i+1}/10")
        text = generate_with_retry(prompt)
        text = text.replace("\n", "\\n")
        posts.append(text)
    return posts

# ================================
# 5. アカウント構成
# ================================
ACCOUNTS = {
    "puu": ["daily_insight", "life_habit"],
    "tsuiteru": ["tech_ai", "money_tips"],
    "sakura": ["quote_comment", "humor"]
}

# ================================
# 6. メイン処理
# ================================
def main():

    for account, themes in ACCOUNTS.items():
        print(f"\n=== {account} のポスト生成開始 ===")

        all_posts = []

        for theme in themes:
            posts = generate_posts_for_theme(theme)
            all_posts.extend(posts)

        output_path = f"../data/output/{account}_posts.txt"

        with open(output_path, "w", encoding="utf-8") as f:
            for p in all_posts:
                f.write(p + "\n")

        print(f"{account} の20ポストを出力しました → {output_path}")

    print("\nすべてのアカウントの通常ポスト生成が完了しました！")

if __name__ == "__main__":
    main()

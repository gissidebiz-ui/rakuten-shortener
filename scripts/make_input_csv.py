import csv
import requests
import time

APPLICATION_ID = 1080764017912469360
AFFILIATE_ID = "1b4f52c0.25c19287.1b4f52c1.45201d1a"

# 1ジャンルあたりの取得件数
JITEM_NUM = 10

# ================================
# ジャンル設定（アカウントごと）
# ================================
GENRES = {
    "puu": {  # ぷう
        "総合": "https://app.rakuten.co.jp/services/api/BooksTotal/Search/20170404?keyword=%E4%BA%88%E7%B4%84&booksGenreId=000&availability=5&sort=sales",
        "CD": "https://app.rakuten.co.jp/services/api/BooksCD/Search/20170404?title=%E9%99%90%E5%AE%9A&booksGenreId=002&availability=5&sort=sales",
        "ゲーム": "https://app.rakuten.co.jp/services/api/BooksGame/Search/20170404?title=%E7%89%B9%E5%85%B8&booksGenreId=006&availability=5&sort=sales",
    },
    "tsuiteru": {  # ツイてる
        "CD": "https://app.rakuten.co.jp/services/api/BooksCD/Search/20170404?title=%E9%99%90%E5%AE%9A&booksGenreId=002&availability=5&sort=sales&limitedFlag=1",
        "DVD": "https://app.rakuten.co.jp/services/api/BooksDVD/Search/20170404?booksGenreId=003&sort=standard&availability=5&limitedFlag=1",
        "雑誌": "https://app.rakuten.co.jp/services/api/BooksMagazine/Search/20170404?booksGenreId=007604001&sort=sales&availability=5",
        "ゲーム": "https://app.rakuten.co.jp/services/api/BooksGame/Search/20170404?title=%E7%89%B9%E5%85%B8&booksGenreId=006&availability=5&sort=sales",
    },
    # さくらはジャンルなし（通常ポスト専用）
}

# ================================
# 重複排除
# ================================
def remove_dup(items, genre):
    seen = set()
    result = []

    for entry in items:
        item = entry["Item"]

        if genre in ["雑誌", "ゲーム"]:
            key = item.get("title", "")
        else:
            key = item.get("artistName", "")

        if key not in seen:
            seen.add(key)
            result.append(item)

    return result

# ================================
# API取得
# ================================
def fetch_items(url, genre):
    params = {
        "format": "json",
        "applicationId": APPLICATION_ID,
        "affiliateId": AFFILIATE_ID,
        "page": 1,
    }

    time.sleep(1)
    response = requests.get(url, params=params)
    data = response.json()

    items = remove_dup(data["Items"], genre)

    results = []
    for i, item in enumerate(items):
        if i >= JITEM_NUM:
            break
        title = item.get("title", "")
        url = item.get("affiliateUrl", "")
        results.append((title, url))

    return results

# ================================
# メイン処理（アカウントごとに出力）
# ================================
def main():

    for account, genres in GENRES.items():
        print(f"\n=== {account} 用の商品取得開始 ===")

        account_items = []

        for genre_name, url in genres.items():
            print(f"  {genre_name} を取得中…")
            items = fetch_items(url, genre_name)
            account_items.extend(items)

        # アカウントごとに input.csv を出力
        output_path = f"../data/input/{account}_input.csv"

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            for title, url in account_items:
                writer.writerow([title, url])

        print(f"{account} 用 input.csv を生成しました（{len(account_items)}件） → {output_path}")

    print("\nすべてのアカウントの input.csv を生成しました！")

if __name__ == "__main__":
    main()

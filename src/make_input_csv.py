import os
import csv
import requests  # type: ignore
import time
from urllib.parse import urlparse, parse_qs
from typing import Dict, List, Tuple, Any
from di_container import get_container, DIContainer


class InputCSVGenerator:
    """CSV input generator using dependency injection."""
    
    DEFAULT_ITEM_NUM: int = 5  # URLに hits 指定がない場合のデフォルト取得件数
    
    def __init__(self, container: DIContainer | None = None):
        """Initialize with optional DI container.
        
        Args:
            container: DI container instance (uses global if not provided)
        """
        self.container = container or get_container()
        self.accounts = self.container.get_accounts()
        self.secrets = self.container.get_secrets()
        self.application_id = self.secrets.get("rakuten_application_id", "")
        self.affiliate_id = self.secrets.get("rakuten_affiliate_id", "")
    
    def remove_dup(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove duplicate items.
        
        Args:
            items: List of items
            
        Returns:
            Deduplicated items list
        """
        seen = set()
        result = []

        for entry in items:
            # APIの種類によって 'Item' または 'Hotel' 、'hotel'、'Ranking' 階層の有無がある
            # 共通のタイトル抽出ロジックで重複チェック
            item = entry.get("Item") or entry.get("Hotel") or entry.get("hotel") or entry.get("Ranking") or entry
            
            # 抽出対象がリストの場合（楽天トラベル KeywordSearch 等）
            base_info = {}
            if isinstance(item, list):
                for sub in item:
                    if "hotelBasicInfo" in sub or "basicInfo" in sub:
                        base_info = sub.get("hotelBasicInfo") or sub.get("basicInfo")
                        break
            elif isinstance(item, dict) and "Ranking" in entry: # ランキング
                hotels = item.get("hotels", [])
                if hotels and isinstance(hotels, list):
                    h_item = hotels[0].get("hotel", {})
                    if isinstance(h_item, list):
                        for sub in h_item:
                            if "hotelBasicInfo" in sub or "basicInfo" in sub:
                                base_info = sub.get("hotelBasicInfo") or sub.get("basicInfo")
                                break
            else:
                base_info = item.get("hotelBasicInfo") or item.get("basicInfo") or item
            
            # キーをタイトル（または商品名）に統一して重複チェック
            title = base_info.get("hotelName") or base_info.get("itemName") or base_info.get("title", "")
            
            if title and title not in seen:
                seen.add(title)
                result.append(entry)
        return result

    def fetch_items(self, url: str, genre_name: str) -> List[Tuple[str, str, str]]:
        """Fetch items from API.
        
        Args:
            url: API URL
            genre_name: Genre name
            
        Returns:
            List of (title, url, image_url) tuples
        """
        # 1. URLから 'hits' パラメータ（取得件数）を抽出
        parsed_url = urlparse(url)
        query_params = parse_qs(parsed_url.query)
        
        # URLに &hits=10 等があればそれを使い、なければ5にする
        target_count = int(query_params.get('hits', [self.DEFAULT_ITEM_NUM])[0])

        # 2. APIリクエストの実行
        # URL自体にパラメータが含まれているため params は認証情報のみ
        params = {
            "format": "json",
            "applicationId": self.application_id,
            "affiliateId": self.affiliate_id,
        }

        time.sleep(1)  # API負荷軽減
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            # ヘッダ方式で再試行（新APIがヘッダ認証を使う場合に対応）
            try:
                headers = {
                    "X-Rakuten-Application-Id": self.application_id,
                    "X-Rakuten-Affiliate-Id": self.affiliate_id,
                }
                response = requests.get(url, headers=headers, timeout=10)
                response.raise_for_status()
                data = response.json()
            except Exception as e2:
                print(f"  [ERROR] APIリクエスト失敗: {e} / retry with headers failed: {e2}")
                return []
        

        # 3. データの抽出（新旧APIのレスポンス構造に対応）
        raw_items = []
        if isinstance(data, dict):
            if "Items" in data:
                raw_items = data.get("Items", [])
            elif "items" in data:
                raw_items = data.get("items", [])
            if "Rankings" in data: # 楽天トラベルランキングAPI対応
                # Rankings はリストで、各要素に 'Ranking' -> 'hotels' がある
                # これを1つのホテルごとに平坦化する
                for r in data.get("Rankings", []):
                    hotels = r.get("Ranking", {}).get("hotels", [])
                    raw_items.extend(hotels)
            elif "hotels" in data: # 楽天トラベルキーワード検索API対応
                raw_items = data.get("hotels", [])
            elif "hits" in data and isinstance(data.get("hits"), list):
                raw_items = data.get("hits", [])
            elif "result" in data and isinstance(data.get("result"), dict) and "items" in data.get("result"):
                raw_items = data.get("result", {}).get("items", [])
            elif "data" in data and isinstance(data.get("data"), list):
                raw_items = data.get("data", [])
            else:
                if isinstance(data, list):
                    raw_items = data

        # 重複排除を実行
        unique_items = self.remove_dup(raw_items)

        results = []
        for entry in unique_items:
            # 指定された件数（hits）に達したらそのURLの取得を終了
            if len(results) >= target_count:
                break
                
            # APIの種類によって 'Item' または 'Hotel' 階層の有無がある
            # 楽天トラベルランキング: Rankings -> [ { Ranking: { hotels: [ { hotel: [ { basicInfo: ... } ] } ] } } ] ... いや、legacyコードを見ると違う
            # legacyコード: item = result['Rankings'][i]['Ranking']['hotels'] -> item[idx] は {'hotel': [ {'hotelBasicInfo': ...}, {'hotelRatingInfo': ...} ] }
            # KeywordSearch: result['hotels'][i]['hotel'][idx]
            
            # 手順:
            # 1. 'Ranking' 階層があれば剥がす
            if "Ranking" in entry:
                # ランキングの場合は entry['Ranking']['hotels'] がリスト
                hotels_list = entry["Ranking"].get("hotels", [])
                # ここでは1つのホテル情報を扱いたいので、もしリストなら最初の1つを対象にする（通常1つずつ入っている想定）
                if hotels_list and isinstance(hotels_list, list):
                    item_data = hotels_list[0].get("hotel", entry)
                else:
                    item_data = entry
            else:
                item_data = entry.get("hotel") or entry.get("Hotel") or entry.get("Item") or entry

            # item_data がリストの場合（楽天トラベル特有: [ {basicInfo}, {ratingInfo} ] ）
            base_info = {}
            if isinstance(item_data, list):
                for sub in item_data:
                    if "hotelBasicInfo" in sub:
                        base_info = sub["hotelBasicInfo"]
                        break
                    elif "basicInfo" in sub:
                        base_info = sub["basicInfo"]
                        break
            else:
                # 辞書の場合
                base_info = item_data.get("hotelBasicInfo") or item_data.get("basicInfo") or item_data

            # ランキングAPIは 'itemName'、Books検索APIは 'title'、トラベルは 'hotelName'
            title = base_info.get("hotelName") or base_info.get("itemName") or base_info.get("title") or ""
            url_link = base_info.get("hotelInformationUrl") or base_info.get("affiliateUrl") or ""

            # --- 画像URL取得 ---
            image_url = base_info.get("hotelImageUrl") or base_info.get("imageUrl") or ""
            if not image_url:
                medium_images = base_info.get("mediumImageUrls", [])
                if medium_images and isinstance(medium_images, list):
                    image_url = medium_images[0].get("imageUrl", "")
            
            if not image_url:
                images = item_data.get("images") or item_data.get("imageUrls") or []
                if isinstance(images, list) and images:
                    if isinstance(images[0], dict):
                        image_url = images[0].get("url") or images[0].get("imageUrl") or ""
                    else:
                        image_url = images[0]

            if title and url_link:
                results.append((title, url_link, image_url))

        return results

    def generate(self) -> None:
        """Generate input CSV for all accounts."""
        for account, data in self.accounts.items():
            genres = data.get("genres")

            # genresがNone（空）でない場合のみ処理を実行
            if not genres:
                print(f"\n=== {account} はジャンル設定がないためスキップ ===")
                continue

            print("\n" + "!" * 50)
            print(f"!!! DEBUG: ACCOUNT = {account}")
            print(f"!!! DEBUG: GENRES  = {list(genres.keys()) if genres else 'None'}")
            print("!" * 50 + "\n")
            account_items = []

            for genre_name, url in genres.items():
                print(f"  {genre_name} を取得中… (URL: {url[:50]}...)")
                items = self.fetch_items(url, genre_name)
                print(f"    -> {len(items)}件取得しました")
                account_items.extend(items)

            if not account_items:
                print(f"  [SKIP] 取得データが0件のため保存しません")
                continue

            # 保存処理
            # スクリプトの場所基準でパスを解決（srcフォルダ内からの相対パス）
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_path = os.path.join(script_dir, "..", "data", "input", f"{account}_input.csv")
            
            try:
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                with open(output_path, "w", encoding="utf-8", newline="") as f:
                    writer = csv.writer(f)
                    for title, url_link, image_url in account_items:
                        writer.writerow([title, url_link, image_url])
                print(f"  [SUCCESS] {output_path} を生成（合計: {len(account_items)}件）")
            except Exception as e:
                print(f"  [ERROR] ファイル保存失敗: {e}")

        print("\nすべてのアカウントの処理が完了しました！")


def main() -> None:
    """Main entry point."""
    generator = InputCSVGenerator()
    generator.generate()


if __name__ == "__main__":
    main()
"""
HTML 生成モジュール。
OGP タグ（SNSでのプレビュー用）を含むリダイレクト HTML ページの作成を担当します。
"""
import os
import string
import random
import html as html_module
from typing import Optional
import config_loader

# テスト環境などでモック化しやすくするため、モジュールレベルのラップ関数を提供します。
def load_secrets():
    return config_loader.load_secrets()


def random_filename(length: int = 6) -> str:
    """ランダムなファイル名（拡張子なし）を生成します。
    
    Args:
        length: 生成するファイル名の長さ（デフォルト: 6）
        
    Returns:
        小文字の英数字からなるランダムな文字列
    """
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))


def create_redirect_html(
    url: str,
    filename: str,
    title: str = "商品詳細はこちら",
    image_url: str = "",
    output_dir: str = "../html",
    price: str = "",
    review_average: str = "0.0",
    point_rate: str = "1"
) -> None:
    """
    SNS でのプレビュー（OGP）に対応したリダイレクト HTML ページを作成します。
    
    Args:
        url: 転送先のリダイレクト URL
        filename: 保存するファイル名（拡張子なし）
        title: OGP タグに使用する商品名（ベース）
        image_url: OGP タグ（og:image）に使用する画像 URL
        output_dir: HTML ファイルを保存する出力ディレクトリ
        price: 価格情報
        review_average: レビュー評価点
        point_rate: ポイント倍率
    """
    # 魅力を伝えるためのプレフィックスを作成
    prefix_elements = []
    if float(review_average) >= 4.0:
        prefix_elements.append(f"★{review_average}")
    if int(point_rate) > 1:
        prefix_elements.append(f"pt{point_rate}倍")
    
    prefix = f"【{' / '.join(prefix_elements)}】" if prefix_elements else ""
    
    # XSS を防止するため、属性値をエスケープします。
    # タイトルを装飾 (例: 【★4.8】商品名 - 楽天)
    decorated_title = f"{prefix}{title}"
    safe_title = html_module.escape(decorated_title)
    safe_image_url = html_module.escape(image_url) if image_url else ""
    
    og_description = f"楽天 - {safe_title}"
    if price:
        og_description = f"価格: {price}円 | {og_description}"
    
    # HTML コンテンツのテンプレート生成
    html_content = f"""<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{safe_title}</title>
    <meta property="og:title" content="{safe_title}">
    <meta property="og:description" content="{og_description}">
    <meta property="og:image" content="{safe_image_url}">
    <meta property="og:type" content="product">
    <meta property="og:url" content="{url}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{safe_title}">
    <meta name="twitter:description" content="{og_description}">
    <meta name="twitter:image" content="{safe_image_url}">
    <script>
      // ブラウザでの転送処理
      window.location.replace("{url}");
    </script>
  </head>
  <body></body>
</html>
"""
    try:
        # ディレクトリが存在しない場合は作成
        os.makedirs(output_dir, exist_ok=True)
        # 指定されたファイル名で UTF-8 保存
        with open(f"{output_dir}/{filename}.html", "w", encoding="utf-8") as f:
            f.write(html_content)
    except Exception as e:
        print(f"[ERROR] ファイル保存失敗: {e}")


def generate_short_url(
    affiliate_url: str,
    product_name: str,
    image_url: str,
    output_dir: str = "../html",
    price: str = "",
    review_average: str = "0.0",
    point_rate: str = "1"
) -> str:
    """
    リダイレクト HTML を生成し、対応する「短縮風 URL」を返します。
    
    Args:
        affiliate_url: 転送先のアフィリエイト URL
        product_name: OGP タイトルに使用する商品名
        image_url: 商品画像 URL
        output_dir: HTML ファイルを保存するディレクトリ
        price: 価格情報
        review_average: レビュー評価点
        point_rate: ポイント倍率
    
    Returns:
        str: 公開用の URL フォーマット {BASE_URL}/{filename}.html
    """
    secrets = load_secrets()
    BASE_URL = secrets.get("base_url", "")

    # ランダムなファイル名を決定して HTML を生成
    filename = random_filename()
    create_redirect_html(
        affiliate_url, 
        filename, 
        product_name, 
        image_url, 
        output_dir,
        price=price,
        review_average=review_average,
        point_rate=point_rate
    )
    
    return f"{BASE_URL}/{filename}.html"

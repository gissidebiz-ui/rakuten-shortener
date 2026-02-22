/**
 * ============================================================
 * PostGenerator.gs — 投稿生成モジュール（25%ルール）
 * ============================================================
 * トレンド解析結果を反映し、通常投稿3件＋アフィリエイト投稿1件の
 * 「4件セット」を生成します。Threads 特有のフォーマットを適用。
 * ============================================================
 */

/**
 * 楽天 API から商品情報を取得する
 * @param {string} keyword - 検索キーワード
 * @param {number} hits - 取得件数（デフォルト: 3）
 * @returns {Object[]} 商品情報の配列 [{name, url, price, reviewAvg, reviewCount, pointRate}]
 */
function fetchRakutenItems(keyword, hits) {
  hits = hits || 3;
  const appId = CONFIG.RAKUTEN_APP_ID;
  const affiliateId = CONFIG.RAKUTEN_AFFILIATE_ID;

  if (!appId) {
    throw new Error(
      "RAKUTEN_APP_ID がスクリプトプロパティに設定されていません",
    );
  }

  const url =
    "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601" +
    `?applicationId=${appId}` +
    `&affiliateId=${affiliateId}` +
    `&keyword=${encodeURIComponent(keyword)}` +
    `&hits=${hits}` +
    "&sort=-reviewCount" +
    "&availability=1";

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    if (!data.Items || data.Items.length === 0) {
      Logger.log(`[Rakuten] 商品が見つかりません: ${keyword}`);
      return [];
    }

    return data.Items.map(function (item) {
      const i = item.Item;
      return {
        name: i.itemName || "",
        url: i.affiliateUrl || i.itemUrl || "",
        price: String(i.itemPrice || ""),
        reviewAvg: String(i.reviewAverage || "0"),
        reviewCount: String(i.reviewCount || "0"),
        pointRate: String(i.pointRate || "1"),
        imageUrl:
          i.mediumImageUrls && i.mediumImageUrls[0]
            ? i.mediumImageUrls[0].imageUrl
            : "",
      };
    });
  } catch (e) {
    Logger.log(`[Rakuten] API エラー: ${e.message}`);
    return [];
  }
}

/**
 * 楽天 URL から直接商品情報を取得する（URL指定版）
 * @param {string} rakutenApiUrl - 楽天 API の完全な URL
 * @returns {Object[]} 商品情報の配列
 */
function fetchRakutenItemsByUrl(rakutenApiUrl) {
  const appId = CONFIG.RAKUTEN_APP_ID;
  const affiliateId = CONFIG.RAKUTEN_AFFILIATE_ID;

  // URL にアプリIDが含まれていなければ追加
  let url = rakutenApiUrl;
  if (url.indexOf("applicationId") === -1) {
    url += (url.indexOf("?") === -1 ? "?" : "&") + `applicationId=${appId}`;
  }
  if (url.indexOf("affiliateId") === -1 && affiliateId) {
    url += `&affiliateId=${affiliateId}`;
  }

  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const data = JSON.parse(response.getContentText());

    // 楽天 Books 系 API と Ichiba API で構造が異なるため両方に対応
    const items = data.Items || data.items || [];

    return items.map(function (item) {
      const i = item.Item || item;
      return {
        name: i.itemName || i.title || i.hotelName || "",
        url: i.affiliateUrl || i.itemUrl || i.hotelInformationUrl || "",
        price: String(i.itemPrice || i.salesPrice || i.hotelMinCharge || ""),
        reviewAvg: String(i.reviewAverage || "0"),
        reviewCount: String(i.reviewCount || "0"),
        pointRate: String(i.pointRate || "1"),
        imageUrl: "",
      };
    });
  } catch (e) {
    Logger.log(`[Rakuten] URL API エラー: ${e.message}`);
    return [];
  }
}

/**
 * Threads 向け通常投稿を1件生成する
 * @param {string} trendContext - トレンドコンテキスト文字列
 * @param {number} index - 通常投稿の番号（0, 1, 2）
 * @returns {string} 生成された投稿テキスト
 */
function generateNormalPost(trendContext, index) {
  const styles = [
    "共感系（「わかる〜」「これ私だ」と思わせる日常の気づき）",
    "有益系（明日から使える具体的なライフハックやコツ）",
    "日常系（等身大の日常の一コマを切り取ったつぶやき）",
  ];

  const style = styles[index % styles.length];

  const prompt = `あなたは Threads で ${TREND_CONFIG.TARGET_DEMO} 層に刺さる投稿を作るプロフェッショナルです。

${trendContext}

以下の条件で Threads 用の「${style}」投稿を1つだけ生成してください。

■ 条件:
・日本語のみ
・${POST_CONFIG.NORMAL_POST_MAX_CHARS}文字以内
・Threads特有の「改行を多用した読みやすい構成」にする
・投稿の最後に「問いかけ」を入れてエンゲージメントを促す
・上記トレンドのキーワードや話題を自然に取り入れる
・宣伝感ゼロの純粋なコンテンツ
・絵文字は2つまで
・ハッシュタグは2つまで（投稿末尾に配置）
・見出しや「投稿文案：」などの装飾は不要。投稿本文だけを出力してください
・「〇〇」「△△」などのプレースホルダは絶対に使わない`;

  const text = callGeminiAPI(prompt);
  return cleanPostText(text);
}

/**
 * Threads 向けアフィリエイト投稿を1件生成する
 * @param {Object} product - 楽天商品情報
 * @param {string} trendContext - トレンドコンテキスト文字列
 * @returns {string} 生成された投稿テキスト（#PR 付き）
 */
function generateAffiliatePost(product, trendContext) {
  // 商品名が長すぎる場合はカット
  const safeName =
    product.name.length > 60
      ? product.name.substring(0, 60) + "..."
      : product.name;

  // 追加情報の組み立て
  const infoLines = [];
  if (product.price)
    infoLines.push(`価格: ${Number(product.price).toLocaleString()}円`);
  if (parseFloat(product.reviewAvg) > 0)
    infoLines.push(`評価: ★${product.reviewAvg}（${product.reviewCount}件）`);
  if (parseInt(product.pointRate) > 1)
    infoLines.push(`ポイント: ${product.pointRate}倍`);

  const prompt = `あなたは Threads で ${TREND_CONFIG.TARGET_DEMO} 層に向けて、自然にモノを紹介するのが上手いインフルエンサーです。

${trendContext}

以下の商品を、上記のトレンドの流れに乗せて「自然に」紹介する Threads 投稿を作ってください。

【商品名】${safeName}
【商品情報】${infoLines.join(" / ")}
【商品URL】${product.url}

【トレンド・文脈】
    ${trendContext}

    【制約事項】
    1. 冒頭に必ず「商品の魅力やメリット（商品説明）」を具体的に2〜3行で記述してください。商品説明を省くのは厳禁です。
    2. なぜ今この商品がおすすめなのか、ターゲット（30代・効率化好き）に刺さる理由を添えてください。
    3. 最後に必ず商品URL (${product.url}) を含めてください。
    4. 専門用語は避け、等身大の言葉で「これ、本当に便利…」と思わせるトーンにしてください。
    5. 全体で${POST_CONFIG.AFFILIATE_POST_MIN_CHARS}文字〜${POST_CONFIG.AFFILIATE_POST_MAX_CHARS}文字程度にまとめてください（短すぎはNGです）。
`;

  let text = "";
  let retries = 0;
  while (retries < 3) {
    text = callGeminiAPI(prompt);
    text = cleanPostText(text);

    // 文字数チェック (商品説明が含まれていれば自然と長くなるはず)
    if (text.length >= POST_CONFIG.AFFILIATE_POST_MIN_CHARS) {
      break;
    }

    Logger.log(
      `[PostGenerator] アフィリエイト投稿が短すぎます（${text.length}文字）。再生成します。試行: ${retries + 1}`,
    );
    retries++;
    Utilities.sleep(2000);
  }

  // #PR が含まれていない場合は追加
  if (text && text.indexOf("#PR") === -1) {
    text = text + "\n\n#PR";
  }

  // 商品 URL が含まれていない場合は追加
  if (text && text.indexOf(product.url) === -1 && product.url) {
    text = text + "\n\n" + product.url;
  }

  return text;
}

/**
 * 投稿テキストのクリーニング処理
 * @param {string} text - 生成された生テキスト
 * @returns {string} クリーニング後のテキスト
 */
function cleanPostText(text) {
  // AIの前置きや装飾を除去
  text = text.replace(/^(投稿文案[：:]|本文[：:]|以下.*[：:])\s*/i, "");
  text = text.replace(/^```[\s\S]*?```/g, "");
  text = text.replace(/^【.*?】\s*/g, "");
  text = text.replace(/^例\d*[：:]\s*/g, "");

  // リテラルの \\n を実際の改行に変換
  text = text.replace(/\\n/g, "\n");

  // 3つ以上の連続改行を2つに圧縮
  text = text.replace(/\n{3,}/g, "\n\n");

  // 先頭・末尾の空白を除去
  text = text.trim();

  // プレースホルダの検出
  const placeholderPattern = /\[.*?\]|【.*?】|〇{2,}|○{2,}|◯{2,}|△{2,}/;
  const templateWords = [
    "ブランド名",
    "商品名を入れる",
    "店舗名",
    "〇〇",
    "○○",
  ];
  if (
    placeholderPattern.test(text) ||
    templateWords.some(function (w) {
      return text.indexOf(w) !== -1;
    })
  ) {
    Logger.log("[PostGenerator] プレースホルダ検出 → 再生成が必要");
    return "";
  }

  // 日本語チェック
  if (!/[ぁ-んァ-ン一-龥]/.test(text)) {
    Logger.log("[PostGenerator] 日本語未検出 → 再生成が必要");
    return "";
  }

  return text;
}

/**
 * トレンド反映済み4件セットを生成する
 * @param {string} rakutenUrl - 楽天 API URL または検索キーワード
 * @returns {Object[]} [{type: 'normal'|'affiliate', text: string, scheduledTime: null}]
 */
function generatePostSet(rakutenUrl) {
  Logger.log("[PostGenerator] 4件セット生成を開始...");

  // Step 1: トレンド解析
  const trendData = analyzeTrends(false);
  const trendContext = buildTrendContext(trendData);
  Logger.log("[PostGenerator] トレンドコンテキスト取得完了");

  // Step 2: 楽天から商品取得
  let products = [];
  if (rakutenUrl && rakutenUrl.indexOf("http") === 0) {
    products = fetchRakutenItemsByUrl(rakutenUrl);
  } else if (rakutenUrl) {
    // キーワードとして検索
    const keyword =
      trendData.keywords.length > 0
        ? rakutenUrl +
          " " +
          trendData.keywords[
            Math.floor(Math.random() * trendData.keywords.length)
          ]
        : rakutenUrl;
    products = fetchRakutenItems(keyword, 3);
  }

  if (products.length === 0) {
    // トレンドキーワードで検索
    const fallbackKeyword =
      trendData.keywords[
        Math.floor(Math.random() * trendData.keywords.length)
      ] || "おすすめ 人気";
    products = fetchRakutenItems(fallbackKeyword, 3);
  }

  Logger.log(`[PostGenerator] 楽天商品 ${products.length}件取得`);

  // Step 3: 通常投稿3件を生成
  const postSet = [];
  for (let i = 0; i < POST_CONFIG.NORMAL_POSTS_PER_SET; i++) {
    Logger.log(
      `[PostGenerator] 通常投稿 ${i + 1}/${POST_CONFIG.NORMAL_POSTS_PER_SET} 生成中...`,
    );

    let text = "";
    let retries = 0;
    while (!text && retries < 3) {
      text = generateNormalPost(trendContext, i);
      retries++;
      if (!text) {
        Logger.log(`[PostGenerator] 通常投稿 ${i + 1} リトライ ${retries}/3`);
        Utilities.sleep(1000);
      }
    }

    postSet.push({
      type: "normal",
      text: text || "（生成失敗）",
      scheduledTime: null,
    });

    // API レート制限対策
    Utilities.sleep(1500);
  }

  // Step 4: アフィリエイト投稿1件を生成
  Logger.log("[PostGenerator] アフィリエイト投稿生成中...");
  const product =
    products.length > 0
      ? products[Math.floor(Math.random() * products.length)]
      : null;

  if (product) {
    let affText = "";
    let retries = 0;
    while (!affText && retries < 3) {
      affText = generateAffiliatePost(product, trendContext);
      retries++;
      if (!affText) {
        Logger.log(`[PostGenerator] アフィリエイト投稿リトライ ${retries}/3`);
        Utilities.sleep(1000);
      }
    }

    postSet.push({
      type: "affiliate",
      text: affText || "（生成失敗）",
      scheduledTime: null,
      productInfo: product,
    });
  } else {
    Logger.log(
      "[PostGenerator] 楽天商品が見つからないため、アフィリエイト投稿をスキップ",
    );
  }

  Logger.log(
    `[PostGenerator] 4件セット生成完了 — 通常: ${POST_CONFIG.NORMAL_POSTS_PER_SET}件, アフィリエイト: ${product ? 1 : 0}件`,
  );
  return postSet;
}

// ================================
// テスト用関数
// ================================
function testPostGeneration() {
  const postSet = generatePostSet("おすすめ ライフハック");
  Logger.log("=== 生成された4件セット ===");
  postSet.forEach(function (post, i) {
    Logger.log(`--- 投稿 ${i + 1} (${post.type}) ---`);
    Logger.log(post.text);
    Logger.log("");
  });
}

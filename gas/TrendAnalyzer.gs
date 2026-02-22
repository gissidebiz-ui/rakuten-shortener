/**
 * ============================================================
 * TrendAnalyzer.gs — トレンド解析モジュール
 * ============================================================
 * Gemini API を活用し、Threads の「30代・事務職・ライフハック」界隈で
 * 現在バズっている傾向を解析します。
 * 結果は PropertiesService にキャッシュされ、6時間有効です。
 * ============================================================
 */

/**
 * Gemini API にリクエストを送信してテキストを生成する汎用関数
 * @param {string} prompt - プロンプト文
 * @returns {string} 生成されたテキスト
 */
function callGeminiAPI(prompt) {
  const apiKey = CONFIG.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY がスクリプトプロパティに設定されていません",
    );
  }

  const url = `${GEMINI_CONFIG.BASE_URL}${GEMINI_CONFIG.MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048,
    },
  };

  let lastError = null;
  for (let attempt = 1; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      };

      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();

      if (statusCode === 429 || statusCode >= 500) {
        // レート制限 or サーバーエラー → リトライ
        Logger.log(
          `[Gemini] リトライ ${attempt}/${GEMINI_CONFIG.MAX_RETRIES} (HTTP ${statusCode})`,
        );
        Utilities.sleep(GEMINI_CONFIG.RETRY_DELAY_MS * attempt);
        continue;
      }

      const json = JSON.parse(response.getContentText());

      if (json.candidates && json.candidates[0] && json.candidates[0].content) {
        return json.candidates[0].content.parts[0].text.trim();
      }

      throw new Error("Gemini API レスポンスにテキストが含まれていません");
    } catch (e) {
      lastError = e;
      Logger.log(`[Gemini] エラー (試行 ${attempt}): ${e.message}`);
      if (attempt < GEMINI_CONFIG.MAX_RETRIES) {
        Utilities.sleep(GEMINI_CONFIG.RETRY_DELAY_MS * attempt);
      }
    }
  }

  throw new Error(
    `Gemini API 呼び出しに ${GEMINI_CONFIG.MAX_RETRIES} 回失敗: ${lastError?.message}`,
  );
}

/**
 * トレンド解析を実行し、結果を構造化して返す
 * キャッシュが有効な場合はキャッシュから返却
 * @param {boolean} forceRefresh - true の場合キャッシュを無視して再取得
 * @returns {Object} {keywords: string[], themes: string[], toneStyle: string, seasonalTopics: string[], rawAnalysis: string}
 */
function analyzeTrends(forceRefresh) {
  forceRefresh = forceRefresh || false;
  const props = PropertiesService.getScriptProperties();

  // キャッシュチェック
  if (!forceRefresh) {
    const cachedTs = props.getProperty(TREND_CONFIG.CACHE_TIMESTAMP_KEY);
    if (cachedTs) {
      const cacheAge = (Date.now() - parseInt(cachedTs)) / (1000 * 60 * 60);
      if (cacheAge < TREND_CONFIG.CACHE_DURATION_HOURS) {
        const cached = props.getProperty(TREND_CONFIG.CACHE_KEY);
        if (cached) {
          Logger.log("[TrendAnalyzer] キャッシュからトレンドデータを取得");
          return JSON.parse(cached);
        }
      }
    }
  }

  Logger.log("[TrendAnalyzer] 最新トレンド解析を開始...");

  // 現在の日付と季節情報を取得
  const now = new Date();
  const month = now.getMonth() + 1;
  const seasonMap = {
    1: "冬",
    2: "冬",
    3: "春",
    4: "春",
    5: "春",
    6: "梅雨/初夏",
    7: "夏",
    8: "夏",
    9: "秋",
    10: "秋",
    11: "秋",
    12: "冬",
  };
  const season = seasonMap[month];
  const dateStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy年M月d日");

  const prompt = `あなたはSNSトレンドアナリストです。
今日は${dateStr}（${season}）です。

以下の調査を行い、結果を**必ずJSON形式のみ**で返してください。説明文や前置きは不要です。

■ 調査対象:
Threads（Meta社のSNS）における「${TREND_CONFIG.TARGET_DEMO}」界隈

■ 調査内容:
1. 現在エンゲージメントが高い投稿のテーマ（5つ）
2. 直近1週間で話題のキーワード（8つ）
3. 共感されやすい語り口・トーン（1文で説明）
4. 季節に関連する話題（${season}にちなんだもの、3つ）
  ※【最重要】現在は${dateStr}（2月/February）です。2月に「年末調整」や「大掃除」「お正月」といった12月・1月の話題を出すのは「致命的な誤り」です。必ず2月に相応しい内容（確定申告の準備、花粉症対策、新生活の準備、早春など）だけを出力してください。

■ 出力フォーマット（JSONのみ、コードブロック不要）:
{"keywords":["キーワード1","キーワード2",...],"themes":["テーマ1","テーマ2",...],"toneStyle":"語り口の説明","seasonalTopics":["季節ネタ1","季節ネタ2",...]}
`;

  const rawText = callGeminiAPI(prompt);

  // JSON パース（コードブロックで囲まれていても対応）
  let trendData;
  try {
    let jsonStr = rawText;
    // ```json ... ``` の形式で返された場合の対応
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    trendData = JSON.parse(jsonStr);
  } catch (e) {
    Logger.log(
      `[TrendAnalyzer] JSON パース失敗、デフォルト値を使用: ${e.message}`,
    );
    trendData = {
      keywords: [
        "時短術",
        "在宅ワーク",
        "コスパ",
        "朝活",
        "メンタルケア",
        "節約",
        "AI活用",
        "副業",
      ],
      themes: [
        "仕事効率化",
        "自分時間の作り方",
        "簡単レシピ",
        "プチ贅沢",
        "健康習慣",
      ],
      toneStyle: "等身大の語り口で、共感を誘う柔らかいトーン",
      seasonalTopics: [
        `${season}の過ごし方`,
        `${season}の節約術`,
        `${season}のおすすめ`,
      ],
    };
  }

  // rawAnalysis を追加
  trendData.rawAnalysis = rawText;

  // キャッシュに保存
  props.setProperty(TREND_CONFIG.CACHE_KEY, JSON.stringify(trendData));
  props.setProperty(TREND_CONFIG.CACHE_TIMESTAMP_KEY, String(Date.now()));

  Logger.log(
    `[TrendAnalyzer] トレンド解析完了 — キーワード: ${trendData.keywords.length}件, テーマ: ${trendData.themes.length}件`,
  );
  return trendData;
}

/**
 * トレンドデータを投稿生成用のコンテキスト文字列に変換
 * @param {Object} trendData - analyzeTrends() の返却値
 * @returns {string} プロンプトに挿入するコンテキスト文
 */
function buildTrendContext(trendData) {
  return `
【現在のトレンド情報】
・話題のキーワード: ${trendData.keywords.join("、")}
・人気テーマ: ${trendData.themes.join("、")}
・共感される語り口: ${trendData.toneStyle}
・季節の話題: ${trendData.seasonalTopics.join("、")}
`.trim();
}

// ================================
// テスト用関数
// ================================
function testTrendAnalysis() {
  const result = analyzeTrends(true);
  Logger.log("=== トレンド解析結果 ===");
  Logger.log(JSON.stringify(result, null, 2));
  Logger.log("=== トレンドコンテキスト ===");
  Logger.log(buildTrendContext(result));
}

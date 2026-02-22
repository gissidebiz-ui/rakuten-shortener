/**
 * ============================================================
 * Config.gs — 設定管理モジュール
 * ============================================================
 * スクリプトプロパティから API キーを安全に取得し、
 * スケジューリング定数やプロンプトテンプレートを一元管理します。
 *
 * 【セットアップ手順】
 * 1. GAS エディタ → プロジェクトの設定 → スクリプトプロパティ
 * 2. 以下のキーと値を登録:
 *    - GEMINI_API_KEY       : Google AI Studio で取得した API キー
 *    - THREADS_ACCESS_TOKEN : Meta Developers で取得した Threads トークン
 *    - THREADS_USER_ID      : Threads のユーザー ID
 *    - RAKUTEN_APP_ID       : 楽天 API アプリケーション ID
 *    - RAKUTEN_AFFILIATE_ID : 楽天アフィリエイト ID
 * ============================================================
 */

// ================================
// APIキー取得（スクリプトプロパティから）
// ================================
const CONFIG = {
  get GEMINI_API_KEY() {
    return (
      PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") ||
      ""
    );
  },
  get THREADS_ACCESS_TOKEN() {
    return (
      PropertiesService.getScriptProperties().getProperty(
        "THREADS_ACCESS_TOKEN",
      ) || ""
    );
  },
  get THREADS_USER_ID() {
    return (
      PropertiesService.getScriptProperties().getProperty("THREADS_USER_ID") ||
      ""
    );
  },
  get RAKUTEN_APP_ID() {
    return (
      PropertiesService.getScriptProperties().getProperty("RAKUTEN_APP_ID") ||
      ""
    );
  },
  get RAKUTEN_AFFILIATE_ID() {
    return (
      PropertiesService.getScriptProperties().getProperty(
        "RAKUTEN_AFFILIATE_ID",
      ) || ""
    );
  },
};

// ================================
// Gemini API 設定
// ================================
const GEMINI_CONFIG = {
  MODEL: "gemini-2.0-flash",
  BASE_URL: "https://generativelanguage.googleapis.com/v1beta/models/",
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
};

// ================================
// Threads API 設定
// ================================
const THREADS_API_CONFIG = {
  BASE_URL: "https://graph.threads.net/v1.0",
  PUBLISH_WAIT_MS: 5000, // コンテナ作成→公開の待機時間
  REPLY_DELAY_MS: 3000, // リプライ投稿間の待機時間
};

// ================================
// スケジューリング設定
// ================================
const SCHEDULE_CONFIG = {
  // 休止時間（0:00〜6:59）
  QUIET_HOURS_START: 0,
  QUIET_HOURS_END: 7,

  // ゴールデンタイム（20:00〜23:00）
  GOLDEN_TIME_START: 20,
  GOLDEN_TIME_END: 23,
  GOLDEN_INTERVAL_MIN: 60, // 分
  GOLDEN_INTERVAL_MAX: 60, // 分

  // 通常時間帯
  NORMAL_INTERVAL_MIN: 60, // 分
  NORMAL_INTERVAL_MAX: 60, // 分

  // 投稿時間の揺らぎ（0〜N分）
  JITTER_MAX_MIN: 5,
};

// ================================
// 投稿生成設定
// ================================
const POST_CONFIG = {
  // 通常投稿
  NORMAL_POST_MAX_CHARS: 500,
  // アフィリエイト投稿
  AFFILIATE_POST_MIN_CHARS: 200,
  AFFILIATE_POST_MAX_CHARS: 500,
  // 黄金比（通常:アフィリエイト = 3:1）
  NORMAL_POSTS_PER_SET: 3,
  AFFILIATE_POSTS_PER_SET: 1,
  TOTAL_POSTS_PER_SET: 4,
};

// ================================
// トレンド解析設定
// ================================
const TREND_CONFIG = {
  TARGET_DEMO:
    "30代 効率化・自動化に関心がある層 ライフハック・便利ガジェット愛好家",
  CACHE_KEY: "TREND_CACHE",
  CACHE_TIMESTAMP_KEY: "TREND_CACHE_TS",
  CACHE_DURATION_HOURS: 6,
};

// ================================
// スプレッドシート列定義
// ================================
const SHEET_COLUMNS = {
  SCHEDULED_TIME: 1, // A列: 予定時刻
  POST_TYPE: 2, // B列: 投稿タイプ (normal / affiliate)
  POST_TEXT: 3, // C列: 投稿本文
  STATUS: 4, // D列: ステータス (pending / posted / error)
  THREADS_ID: 5, // E列: Threads 投稿 ID
  PARENT_THREADS_ID: 6, // F列: 親投稿の Threads ID（リプライ用）
  CREATED_AT: 7, // G列: 作成日時
  ERROR_MSG: 8, // H列: エラーメッセージ
};

const SHEET_NAME = "投稿予約";
const LOG_SHEET_NAME = "実行ログ";

// ================================
// ドライランモード
// ================================
const DRY_RUN = false; // true にすると API 呼び出しをスキップしてログのみ出力

/**
 * ============================================================
 * Main.gs — メイン制御 / エントリポイント
 * ============================================================
 * GAS 時間主導型トリガーから呼び出されるエントリポイント関数群。
 *
 * ■ トリガー設定:
 *   1. generateAndSchedule — 日次（午前7時）
 *   2. processScheduledPosts — 1分間隔
 *
 * ■ 手動実行用:
 *   - initialSetup()         — 初回セットアップ
 *   - generateAndSchedule()  — 手動で4件セット生成
 *   - runFullTest()          — フルテスト実行
 *   - onOpen()               — カスタムメニューの追加
 * ============================================================
 */

/**
 * スプレッドシートを開いたときにメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const platformName = POST_CONFIG.PLATFORM === "threads" ? "Threads" : "X";
  ui.createMenu(`🐦 ${platformName} 自動投稿`)
    .addItem("📝 セット生成（トレンド自動）", "menuGenerateTrends")
    .addItem("🔗 セット生成（楽天URL指定）", "menuGenerateByUrl")
    .addSeparator()
    .addItem(`🚀 ${platformName} へ一括投稿`, "menuPublishToSocial")
    .addItem("📊 統計表示", "showStats")
    .addSeparator()
    .addItem("⚙️ トリガーを再設定", "resetTriggers")
    .addToUi();
}

/**
 * メニュー用: トレンド自動生成
 */
function menuGenerateTrends() {
  generateAndSchedule();
  SpreadsheetApp.getActiveSpreadsheet().toast(
    "トレンドからの予約生成が完了しました",
    "完了",
  );
}

/**
 * メニュー用: 楽天URL指定生成
 */
function menuGenerateByUrl() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt(
    "楽天商品URL指定",
    "対象商品のURLを入力してください:",
    ui.ButtonSet.OK_CANCEL,
  );
  if (res.getSelectedButton() === ui.Button.OK) {
    const url = res.getResponseText();
    if (url) {
      generateAndSchedule(url);
      ui.alert("指定されたURLからの予約生成が完了しました。");
    }
  }
}

/**
 * メニュー用: 指定SNSへ一括投稿 (未投稿分をすべて投稿)
 */
function menuPublishToSocial() {
  const set = getNextPendingPostSet();
  if (!set) {
    SpreadsheetApp.getUi().alert("投稿待ちのセットが見つかりませんでした。");
    return;
  }

  let results;
  const platformName = POST_CONFIG.PLATFORM === "threads" ? "Threads" : "X";
  if (POST_CONFIG.PLATFORM === "threads") {
    results = publishPostSetAsThread(set);
  } else {
    results = publishPostSetToTwitter(set);
  }

  updatePostStatusBatch(results);
  SpreadsheetApp.getUi().alert(`${platformName} への一括投稿が完了しました。`);
}

/**
 * ============================================================
 * 初回セットアップ
 * ============================================================
 * スプレッドシートのシート作成とトリガーの自動登録を行います。
 * 最初に1回だけ手動で実行してください。
 */
function initialSetup() {
  Logger.log("=== 初回セットアップ開始 ===");

  // 1. 必要なシートの作成
  getOrCreateSheet(SHEET_NAME);
  getOrCreateSheet(LOG_SHEET_NAME);
  Logger.log("シートの作成/確認が完了しました");

  // 2. スクリプトプロパティの確認
  const requiredKeys = [
    "GEMINI_API_KEY",
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_SECRET",
    "RAKUTEN_APP_ID",
    "RAKUTEN_ACCESS_KEY",
  ];
  const props = PropertiesService.getScriptProperties();
  const missingKeys = [];

  requiredKeys.forEach(function (key) {
    if (!props.getProperty(key)) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length > 0) {
    Logger.log("⚠️ 以下のスクリプトプロパティが未設定です:");
    missingKeys.forEach(function (key) {
      Logger.log(`  - ${key}`);
    });
    Logger.log("プロジェクトの設定 → スクリプトプロパティから設定してください");
  } else {
    Logger.log("✅ すべての必須スクリプトプロパティが設定済みです");
  }

  // 3. トリガーの設定
  setupTriggers();

  Logger.log("=== 初回セットアップ完了 ===");
  writeLog(
    "初回セットアップ",
    "success",
    `未設定キー: ${missingKeys.length}件`,
  );
}

/**
 * トリガーを自動設定する
 * 既存トリガーを重複登録しないようチェック
 */
function setupTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  // 同名トリガーの重複を検出し、重複があれば削除してから再登録
  const targetFunctions = [
    "generateAndSchedule",
    "processScheduledPosts",
    "refreshRecentPostInsights",
    "refreshThreadsToken",
  ];

  targetFunctions.forEach(function (funcName) {
    const existing = triggers.filter(function (t) {
      return t.getHandlerFunction() === funcName;
    });

    // 2つ以上の重複がある場合はすべて削除してから再登録する
    if (existing.length > 1) {
      Logger.log(
        `⚠️ 「${funcName}」のトリガーが${existing.length}件重複しています。全削除して再登録します`,
      );
      existing.forEach(function (t) {
        ScriptApp.deleteTrigger(t);
      });
    }
  });

  // 削除後のトリガーリストを再取得
  const currentTriggers = ScriptApp.getProjectTriggers();
  const existingFunctions = currentTriggers.map(function (t) {
    return t.getHandlerFunction();
  });

  // 1. 日次トリガー: generateAndSchedule（毎日午前7時）
  if (existingFunctions.indexOf("generateAndSchedule") === -1) {
    ScriptApp.newTrigger("generateAndSchedule")
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
    Logger.log(
      "✅ 日次トリガー「generateAndSchedule」を登録しました（毎日7時）",
    );
  } else {
    Logger.log("ℹ️ 日次トリガー「generateAndSchedule」は既に登録済みです");
  }

  // 2. 1分間隔トリガー: processScheduledPosts
  if (existingFunctions.indexOf("processScheduledPosts") === -1) {
    ScriptApp.newTrigger("processScheduledPosts")
      .timeBased()
      .everyMinutes(1)
      .create();
    Logger.log("✅ 1分間隔トリガー「processScheduledPosts」を登録しました");
  } else {
    Logger.log("ℹ️ 1分間隔トリガー「processScheduledPosts」は既に登録済みです");
  }

  // 3. 週次/日次トリガー: refreshRecentPostInsights（毎日午前2時）
  if (existingFunctions.indexOf("refreshRecentPostInsights") === -1) {
    ScriptApp.newTrigger("refreshRecentPostInsights")
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .create();
    Logger.log(
      "✅ 日次トリガー「refreshRecentPostInsights」を登録しました（毎日2時）",
    );
  }

  // 4. 月次トリガー: refreshThreadsToken（毎月1日の午前3時）
  if (existingFunctions.indexOf("refreshThreadsToken") === -1) {
    ScriptApp.newTrigger("refreshThreadsToken")
      .timeBased()
      .onMonthDay(1)
      .atHour(3)
      .create();
    Logger.log(
      "✅ 月次トリガー「refreshThreadsToken」を登録しました（毎月1日の3時）",
    );
  } else {
    Logger.log("ℹ️ 月次トリガー「refreshThreadsToken」は既に登録済みです");
  }
}

/**
 * 既存トリガーをすべて削除する（再設定用）
 */
function removeTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  Logger.log(`${triggers.length}件のトリガーを削除しました`);
}

/**
 * ============================================================
 * メイン処理①: 4件セット生成＆スケジュール書き込み
 * ============================================================
 * 日次トリガー（午前7時）または手動で実行。
 * トレンド解析 → 4件セット生成 → スケジュール計算 → スプレッドシート書き込み
 *
 * @param {string} rakutenUrl - 楽天 API URL（省略時はトレンドキーワードで自動検索）
 */
function generateAndSchedule(rakutenUrl) {
  // トリガーから呼ばれた場合、引数に event オブジェクトが渡されるため除外
  if (rakutenUrl && typeof rakutenUrl !== "string") {
    rakutenUrl = null;
  }

  // 複数のアカウントが同時に実行された場合のAPI衝突・レート制限を回避するため、
  // 最大20秒のランダムな待機時間を最初に挟む
  const jitterMs = Math.floor(Math.random() * 20000);
  Logger.log(
    `[Main] 同時実行回避のため、約${(jitterMs / 1000).toFixed(1)}秒待機します...`,
  );
  Utilities.sleep(jitterMs);

  Logger.log("=== 1日分（16件）生成＆スケジュール開始 ===");
  const startTime = Date.now();

  // スプレッドシートを初期化（前日の残りなどをクリア）
  clearPendingPosts();

  // トレンドキーワード取得（季節ネタの修正を即時反映させるため、初回は強制リフレッシュ）
  const allPostObjects = [];
  const trendData = analyzeTrends(true);

  const timeContexts = [
    "朝の通勤・始業前（07:00〜08:30）",
    "昼休み（11:30〜12:30）",
    "夕方の帰宅・疲労のピーク（17:30〜18:30）",
    "夜のリラックスタイム（20:30〜22:00）",
  ];

  try {
    for (let i = 0; i < 4; i++) {
      Logger.log(`--- セット ${i + 1} / 4 生成中 ---`);
      const currentTimeContext = timeContexts[i];

      // Step 1: 楽天 URL の決定
      let currentRakutenUrl = rakutenUrl;
      if (!currentRakutenUrl || typeof currentRakutenUrl !== "string") {
        // トレンドキーワードをベースに楽天検索（ループごとにランダムに選ぶ）
        currentRakutenUrl =
          trendData.keywords[
            Math.floor(Math.random() * trendData.keywords.length)
          ] || "おすすめ 人気";
      }

      // Step 2: 4件セット生成
      const offset = i * 4; // 1日全体の通し番号としてオフセットを計算
      const postSet = generatePostSet(
        currentRakutenUrl,
        offset,
        currentTimeContext,
      );

      if (postSet.length > 0) {
        // スケジュール前の生投稿オブジェクトを溜める
        allPostObjects.push.apply(allPostObjects, postSet);
      }

      // API レート制限対策としてセット間に待機
      if (i < 3) Utilities.sleep(10000); // バーストを防ぐため10秒待機
    }

    if (allPostObjects.length === 0) {
      Logger.log("[Main] 投稿が1件も生成されませんでした");
      writeLog("一括セット生成", "error", "生成された投稿が0件です");
      return;
    }

    // 最大16件に制限（万一超えた場合に切り詰め）
    const maxPosts = POST_CONFIG.TOTAL_POSTS_PER_SET * 4; // 4件 × 4セット = 16件
    if (allPostObjects.length > maxPosts) {
      Logger.log(
        `[Main] 投稿数が${maxPosts}件を超えています（${allPostObjects.length}件）。${maxPosts}件に切り詰めます`,
      );
      allPostObjects.length = maxPosts;
    }

    // Step 3: 全16件（4セット分）をまとめてスケジューリング
    // 現在時刻を基準に、稼働時間内でのスケジュールを生成する
    const startTimeForSchedule = getInitialStartTime();
    Logger.log(
      `[Main] スケジュール開始基準時刻: ${Utilities.formatDate(startTimeForSchedule, "Asia/Tokyo", "yyyy/MM/dd HH:mm")}`,
    );

    const allScheduledPosts = generateSchedule(
      allPostObjects,
      startTimeForSchedule,
    );

    // Step 4: スプレッドシートに一括書き込み
    writePendingPosts(allScheduledPosts);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    Logger.log(
      `=== 全セット生成完了（計${allScheduledPosts.length}件、${elapsed}秒） ===`,
    );

    // ログ記録
    const normalCount = allScheduledPosts.filter(function (p) {
      return p.type === "normal";
    }).length;
    const affCount = allScheduledPosts.filter(function (p) {
      return p.type.indexOf("affiliate") !== -1;
    }).length;
    writeLog(
      "一括セット生成",
      "success",
      `通常:${normalCount}件 アフィ:${affCount}件 計:${allScheduledPosts.length}件 (${elapsed}秒)`,
    );
  } catch (e) {
    Logger.log(`[Main] エラー: ${e.message}`);
    Logger.log(e.stack);
    writeLog("一括セット生成", "error", e.message);
  }
}

/**
 * ============================================================
 * メイン処理②: スケジュール済み投稿の実行
 * ============================================================
 * 1分間隔トリガーで呼び出される。
 * 予定時刻を過ぎた未投稿を検出し、Twitter API で投稿を実行。
 */
function processScheduledPosts() {
  if (!shouldPostNow()) return;

  try {
    const post = getNextPendingPost();
    if (!post) {
      // 動作確認のため、1時間に1回程度は「待機中」ログを出す（毎分だと多すぎるため、分が0の時のみ）
      if (new Date().getMinutes() === 0) {
        Logger.log("[Main] 投稿待機中（対象なし）");
        writeLog("定期投稿チェック", "idle", "投稿予約はありません");
      }
      return;
    }

    Logger.log(
      `[Main] 単一投稿を実行: ${post.row}行目 「${post.type}」, プラットフォーム: ${POST_CONFIG.PLATFORM}`,
    );

    // 投稿実行
    let postId;
    if (POST_CONFIG.PLATFORM === "threads") {
      postId = publishTextPost(post.text);
    } else {
      postId = postToTwitter(post.text, post.parentId);
    }

    // 結果を反映
    updatePostStatusBatch([
      {
        row: post.row,
        success: true,
        postId: postId,
        parentId: post.parentId,
      },
    ]);

    writeLog("定期投稿実行", "success", `${post.row}行目を投稿しました`);
  } catch (e) {
    Logger.log(`[Main] 投稿プロセスエラー: ${e.message}`);
    // なぜ: catchだけだと同じ行を無限に再処理してしまうため、ステータスを「error」に更新して再実行を防止する
    if (typeof post !== "undefined" && post && post.row) {
      updatePostStatusBatch([
        { row: post.row, success: false, error: e.message },
      ]);
    }
    writeLog("定期投稿プロセス", "error", e.message);
  }
}

/**
 * 統計情報の表示
 */
function showStats() {
  const stats = getPostStats();
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    `📊 運用統計\n\n` +
      `・合計投稿数: ${stats.total}\n` +
      `・成功: ${stats.posted}\n` +
      `・未処理: ${stats.pending}\n` +
      `・エラー: ${stats.error}\n\n` +
      `最終更新: ${new Date().toLocaleString()}`,
  );
}

// ------------------------------------------------------------
// トリガー再設定用（必要に応じて使用）
// ------------------------------------------------------------
function resetTriggers() {
  removeTriggers();
  setupTriggers();
}

/**
 * ============================================================
 * フルテスト実行
 * ============================================================
 * 全モジュールを順番にテストします（ドライランモード推奨）
 */
function runFullTest() {
  Logger.log("========================================");
  Logger.log("      フルテスト実行開始");
  Logger.log("========================================");

  // 1. トレンド解析テスト
  Logger.log("\n--- 1. トレンド解析テスト ---");
  try {
    testTrendAnalysis();
    Logger.log("✅ トレンド解析: OK");
  } catch (e) {
    Logger.log(`❌ トレンド解析: ${e.message}`);
  }

  // 2. 投稿生成テスト（Gemini API 呼び出しが必要）
  Logger.log("\n--- 2. 投稿生成テスト ---");
  try {
    testPostGeneration();
    Logger.log("✅ 投稿生成: OK");
  } catch (e) {
    Logger.log(`❌ 投稿生成: ${e.message}`);
  }

  // 3. スケジューラテスト
  Logger.log("\n--- 3. スケジューラテスト ---");
  try {
    testScheduler();
    Logger.log("✅ スケジューラ: OK");
  } catch (e) {
    Logger.log(`❌ スケジューラ: ${e.message}`);
  }

  // 4. スプレッドシートテスト
  Logger.log("\n--- 4. スプレッドシート管理テスト ---");
  try {
    testSheetsManager();
    Logger.log("✅ スプレッドシート管理: OK");
  } catch (e) {
    Logger.log(`❌ スプレッドシート管理: ${e.message}`);
  }

  // 5. SNS API テスト
  Logger.log("\n--- 5. SNS API テスト ---");
  try {
    if (DRY_RUN) {
      if (POST_CONFIG.PLATFORM === "threads") {
        const testId = publishTextPost("テスト投稿です #test");
        Logger.log(`✅ Threads API: OK (DRY_RUN ID: ${testId})`);
      } else {
        const testId = postToTwitter("テスト投稿です #test");
        Logger.log(`✅ Twitter API: OK (DRY_RUN ID: ${testId})`);
      }
    } else {
      Logger.log("⚠️ SNS API: DRY_RUN=false のためスキップしました");
    }
  } catch (e) {
    Logger.log(`❌ SNS API: ${e.message}`);
  }

  Logger.log("\n========================================");
  Logger.log("      フルテスト完了");
  Logger.log("========================================");
}

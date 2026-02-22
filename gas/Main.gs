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
 * ============================================================
 */

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
    "THREADS_ACCESS_TOKEN",
    "THREADS_USER_ID",
    "RAKUTEN_APP_ID",
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
  const existingFunctions = triggers.map(function (t) {
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
  Logger.log("=== 1日分（16件）生成＆スケジュール開始 ===");
  const startTime = Date.now();

  // スプレッドシートを初期化（前日の残りなどをクリア）
  clearPendingPosts();

  // accounts.yaml の設定に相当するデフォルトのトレンドキーワード取得
  // 季節ネタの修正を即時反映させるため、初回は強制リフレッシュ
  const allPostObjects = [];
  const trendData = analyzeTrends(true);

  try {
    for (let i = 0; i < 4; i++) {
      Logger.log(`--- セット ${i + 1} / 4 生成中 ---`);

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
      const postSet = generatePostSet(currentRakutenUrl);

      if (postSet.length > 0) {
        // スケジュール前の生投稿オブジェクトを溜める
        allPostObjects.push.apply(allPostObjects, postSet);
      }

      // API レート制限対策としてセット間に少し待機
      if (i < 3) Utilities.sleep(2000);
    }

    if (allPostObjects.length === 0) {
      Logger.log("[Main] 投稿が1件も生成されませんでした");
      writeLog("一括セット生成", "error", "生成された投稿が0件です");
      return;
    }

    // Step 3: 全16件（4セット分）をまとめてスケジューリング
    // 07:00から1時間おきに配置すると、16件目は22:00（またはジャンプ考慮で23:00代）に収まります。
    let startTimeForSchedule = new Date();
    startTimeForSchedule.setHours(7, 0, 0, 0); // 常に朝7時開始として計算

    // 手動実行などで既に7:30を過ぎている場合は、翌日のスケジュールとして予約する
    //（そうしないと過去の時刻として一気に投稿されてしまうため）
    const now = new Date();
    if (now.getTime() > startTimeForSchedule.getTime() + 30 * 60 * 1000) {
      startTimeForSchedule.setDate(startTimeForSchedule.getDate() + 1);
      Logger.log(
        "[Main] 現在時刻が7:30を過ぎているため、明日のスケジュールとして予約します",
      );
    }

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
      return p.type === "affiliate";
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
 * 予定時刻を過ぎた未投稿を検出し、Threads API で投稿を実行。
 */
function processScheduledPosts() {
  // 休止時間チェック
  if (!shouldPostNow()) {
    return; // 静かに終了
  }

  try {
    // 次の未投稿を取得
    const pendingPost = getNextPendingPost();

    if (!pendingPost) {
      return; // 投稿すべきものがない
    }

    Logger.log(`[Main] 投稿実行: 行${pendingPost.row} [${pendingPost.type}]`);

    // ステータスを「投稿中」に更新
    updatePostStatus(pendingPost.row, "posting", "", "", "");

    // Threads API で投稿
    const postId = publishTextPost(pendingPost.text);

    // 成功 → ステータス更新
    updatePostStatus(pendingPost.row, "posted", postId, "", "");
    writeLog(
      "投稿実行",
      "success",
      `行${pendingPost.row} ${pendingPost.type} → ${postId}`,
    );

    Logger.log(`[Main] 投稿成功: ${postId}`);
  } catch (e) {
    Logger.log(`[Main] 投稿実行エラー: ${e.message}`);

    // エラー → ステータス更新
    try {
      const pendingPost = getNextPendingPost();
      if (pendingPost) {
        updatePostStatus(pendingPost.row, "error", "", "", e.message);
      }
    } catch (innerE) {
      // ステータス更新自体がエラーの場合は無視
    }

    writeLog("投稿実行", "error", e.message);
  }
}

/**
 * ============================================================
 * 手動実行: スレッド形式で一括投稿
 * ============================================================
 * スプレッドシートの pending 投稿をまとめてスレッド形式で投稿する。
 * processScheduledPosts が1件ずつ投稿するのに対し、
 * こちらは連続する pending をスレッド（親+リプライ）として投稿する。
 */
function postAsThread() {
  Logger.log("=== スレッド形式一括投稿開始 ===");

  if (!shouldPostNow()) {
    Logger.log("現在は休止時間です。");
    return;
  }

  try {
    const pendingSet = getNextPendingPostSet();

    if (!pendingSet || pendingSet.length === 0) {
      Logger.log("投稿すべきセットがありません。");
      return;
    }

    Logger.log(`${pendingSet.length}件のセットをスレッド形式で投稿します`);

    // ステータスを一括で「投稿中」に更新
    pendingSet.forEach(function (post) {
      updatePostStatus(post.row, "posting", "", "", "");
    });

    // スレッド形式で投稿
    const results = publishPostSetAsThread(pendingSet);

    // 結果をシートに反映
    let parentId = "";
    results.forEach(function (result, i) {
      const post = pendingSet[i];
      if (result.success) {
        if (i === 0) parentId = result.postId;
        updatePostStatus(
          post.row,
          "posted",
          result.postId,
          i > 0 ? parentId : "",
          "",
        );
      } else {
        updatePostStatus(post.row, "error", "", "", result.error);
      }
    });

    const successCount = results.filter(function (r) {
      return r.success;
    }).length;
    writeLog(
      "スレッド投稿",
      "success",
      `${successCount}/${results.length}件成功`,
    );
  } catch (e) {
    Logger.log(`[Main] スレッド投稿エラー: ${e.message}`);
    writeLog("スレッド投稿", "error", e.message);
  }
}

/**
 * ============================================================
 * 楽天 URL 指定でセット生成（スプレッドシートのカスタムメニューから呼ぶ場合）
 * ============================================================
 */
function generateWithRakutenUrl() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt(
    "楽天 URL / キーワード入力",
    "楽天 API URL またはキーワードを入力してください（空欄でトレンド自動検索）:",
    ui.ButtonSet.OK_CANCEL,
  );

  if (result.getSelectedButton() !== ui.Button.OK) return;

  const input = result.getResponseText().trim();
  generateAndSchedule(input || undefined);

  ui.alert(
    "完了",
    "投稿セットの生成とスケジュール書き込みが完了しました。\n「投稿予約」シートを確認してください。",
    ui.ButtonSet.OK,
  );
}

/**
 * スプレッドシートにカスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🧵 Threads 自動投稿")
    .addItem("📝 セット生成（トレンド自動）", "generateAndSchedule")
    .addItem("🔗 セット生成（楽天URL指定）", "generateWithRakutenUrl")
    .addSeparator()
    .addItem("🚀 スレッド一括投稿", "postAsThread")
    .addItem("📊 統計表示", "showStats")
    .addSeparator()
    .addItem("⚙️ 初回セットアップ", "initialSetup")
    .addItem("🔄 トリガー再設定", "setupTriggers")
    .addItem("🗑️ トリガー全削除", "removeTriggers")
    .addToUi();
}

/**
 * 統計情報をダイアログで表示
 */
function showStats() {
  const stats = getPostStats();
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    "📊 投稿統計",
    `合計: ${stats.total}件\n` +
      `待機中 (pending): ${stats.pending}件\n` +
      `投稿済 (posted): ${stats.posted}件\n` +
      `エラー (error): ${stats.error}件`,
    ui.ButtonSet.OK,
  );
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

  // 5. Threads API テスト
  Logger.log("\n--- 5. Threads API テスト ---");
  try {
    testThreadsPost();
    Logger.log("✅ Threads API: OK");
  } catch (e) {
    Logger.log(`❌ Threads API: ${e.message}`);
  }

  Logger.log("\n========================================");
  Logger.log("      フルテスト完了");
  Logger.log("========================================");
}

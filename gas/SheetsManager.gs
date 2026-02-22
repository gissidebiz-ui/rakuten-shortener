/**
 * ============================================================
 * SheetsManager.gs — スプレッドシート管理モジュール
 * ============================================================
 * SpreadsheetApp を使用して、投稿予約の書き込み・ステータス管理・
 * ログ記録を行います。
 *
 * シート構成:
 *   「投稿予約」シート — 投稿の予約・実行状態管理
 *   「実行ログ」シート — 実行結果の履歴
 * ============================================================
 */

/**
 * アクティブなスプレッドシートを取得する
 * @returns {Spreadsheet}
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * 指定名のシートを取得（存在しない場合は作成）
 * @param {string} sheetName - シート名
 * @returns {Sheet}
 */
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    Logger.log(`[SheetsManager] シート「${sheetName}」を新規作成しました`);

    if (sheetName === SHEET_NAME) {
      // 投稿予約シートのヘッダーを追加
      sheet
        .getRange(1, 1, 1, 8)
        .setValues([
          [
            "予定時刻",
            "投稿タイプ",
            "投稿本文",
            "ステータス",
            "Threads ID",
            "親Threads ID",
            "作成日時",
            "エラー",
          ],
        ]);
      sheet.getRange(1, 1, 1, 8).setFontWeight("bold");
      sheet.setFrozenRows(1);

      // 列幅を調整
      sheet.setColumnWidth(1, 140); // 予定時刻
      sheet.setColumnWidth(2, 100); // 投稿タイプ
      sheet.setColumnWidth(3, 400); // 投稿本文
      sheet.setColumnWidth(4, 80); // ステータス
      sheet.setColumnWidth(5, 150); // Threads ID
      sheet.setColumnWidth(6, 150); // 親Threads ID
      sheet.setColumnWidth(7, 140); // 作成日時
      sheet.setColumnWidth(8, 200); // エラー
    }

    if (sheetName === LOG_SHEET_NAME) {
      // 実行ログシートのヘッダー
      sheet
        .getRange(1, 1, 1, 4)
        .setValues([["実行日時", "アクション", "結果", "詳細"]]);
      sheet.getRange(1, 1, 1, 4).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  }

  return sheet;
}

/**
 * スケジュール済み投稿セットをシートに書き込む
 * @param {Object[]} scheduledPosts - generateSchedule() の返却値
 */
function writePendingPosts(scheduledPosts) {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const now = new Date();
  const nowStr = Utilities.formatDate(now, "Asia/Tokyo", "yyyy/MM/dd HH:mm:ss");

  const rows = scheduledPosts.map(function (post) {
    const timeStr = Utilities.formatDate(
      post.scheduledTime,
      "Asia/Tokyo",
      "yyyy/MM/dd HH:mm",
    );
    return [
      timeStr, // A: 予定時刻
      post.type, // B: 投稿タイプ
      post.text, // C: 投稿本文
      "pending", // D: ステータス
      "", // E: Threads ID
      "", // F: 親Threads ID
      nowStr, // G: 作成日時
      "", // H: エラー
    ];
  });

  if (rows.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);
    Logger.log(`[SheetsManager] ${rows.length}件の予約を書き込みました`);
  }
}

/**
 * 投稿予約シートをクリアする（ヘッダー以外）
 */
function clearPendingPosts() {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    // コンテンツだけでなく書式（背景色）もクリアしないと getLastRow が減らないため、
    // 行ごと削除するのが最も確実です。
    sheet.deleteRows(2, lastRow - 1);
    SpreadsheetApp.flush(); // 即座に反映
    Logger.log("[SheetsManager] 投稿予約シートを初期化しました（行削除）");
  }
}

/**
 * 次の未投稿（pending）かつ予定時刻を過ぎた投稿を取得する
 * @returns {Object|null} {row, scheduledTime, type, text} or null
 */
function getNextPendingPost() {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return null; // ヘッダー行のみ

  const now = new Date();
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  for (let i = 0; i < data.length; i++) {
    const status = data[i][SHEET_COLUMNS.STATUS - 1];
    if (status !== "pending") continue;

    const scheduledTimeStr = data[i][SHEET_COLUMNS.SCHEDULED_TIME - 1];
    let scheduledTime;

    if (scheduledTimeStr instanceof Date) {
      scheduledTime = scheduledTimeStr;
    } else {
      scheduledTime = new Date(scheduledTimeStr);
    }

    // 予定時刻を過ぎていて、かつ休止時間でなければ投稿対象
    if (scheduledTime <= now && shouldPostNow()) {
      return {
        row: i + 2, // 1-indexed + ヘッダー行分
        scheduledTime: scheduledTime,
        type: data[i][SHEET_COLUMNS.POST_TYPE - 1],
        text: data[i][SHEET_COLUMNS.POST_TEXT - 1],
      };
    }
  }

  return null;
}

/**
 * 同じセット（連続する pending 投稿）をまとめて取得する
 * スレッド形式投稿のため、連続する pending を一括取得
 * @returns {Object[]|null} 連続する pending 投稿の配列 or null
 */
function getNextPendingPostSet() {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return null;

  const now = new Date();
  const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  const pendingSet = [];
  let setStarted = false;

  for (let i = 0; i < data.length; i++) {
    const status = data[i][SHEET_COLUMNS.STATUS - 1];
    const scheduledTimeStr = data[i][SHEET_COLUMNS.SCHEDULED_TIME - 1];

    let scheduledTime;
    if (scheduledTimeStr instanceof Date) {
      scheduledTime = scheduledTimeStr;
    } else {
      scheduledTime = new Date(scheduledTimeStr);
    }

    if (status === "pending" && scheduledTime <= now) {
      setStarted = true;
      pendingSet.push({
        row: i + 2,
        scheduledTime: scheduledTime,
        type: data[i][SHEET_COLUMNS.POST_TYPE - 1],
        text: data[i][SHEET_COLUMNS.POST_TEXT - 1],
      });
    } else if (setStarted) {
      // pending でない行に到達したらセット終了
      break;
    }
  }

  return pendingSet.length > 0 ? pendingSet : null;
}

/**
 * 投稿のステータスを更新する
 * @param {number} row - シートの行番号（1-indexed）
 * @param {string} status - 新しいステータス ('posted', 'error' 等)
 * @param {string} threadsId - Threads 投稿 ID
 * @param {string} parentThreadsId - 親投稿の Threads ID（リプライの場合）
 * @param {string} errorMsg - エラーメッセージ（エラー時のみ）
 */
function updatePostStatus(row, status, threadsId, parentThreadsId, errorMsg) {
  const sheet = getOrCreateSheet(SHEET_NAME);

  sheet.getRange(row, SHEET_COLUMNS.STATUS).setValue(status);

  if (threadsId) {
    sheet.getRange(row, SHEET_COLUMNS.THREADS_ID).setValue(threadsId);
  }

  if (parentThreadsId) {
    sheet
      .getRange(row, SHEET_COLUMNS.PARENT_THREADS_ID)
      .setValue(parentThreadsId);
  }

  if (errorMsg) {
    sheet.getRange(row, SHEET_COLUMNS.ERROR_MSG).setValue(errorMsg);
  }

  // ステータスに応じて背景色を変更
  const cell = sheet.getRange(row, SHEET_COLUMNS.STATUS);
  if (status === "posted") {
    cell.setBackground("#d4edda"); // 薄緑
  } else if (status === "error") {
    cell.setBackground("#f8d7da"); // 薄赤
  } else if (status === "posting") {
    cell.setBackground("#fff3cd"); // 薄黄
  }
}

/**
 * 実行ログを記録する
 * @param {string} action - 実行したアクション
 * @param {string} result - 結果 ('success', 'error')
 * @param {string} detail - 詳細情報
 */
function writeLog(action, result, detail) {
  const sheet = getOrCreateSheet(LOG_SHEET_NAME);
  const now = Utilities.formatDate(
    new Date(),
    "Asia/Tokyo",
    "yyyy/MM/dd HH:mm:ss",
  );

  const lastRow = sheet.getLastRow();
  sheet
    .getRange(lastRow + 1, 1, 1, 4)
    .setValues([[now, action, result, detail]]);

  // 結果に応じて背景色
  const resultCell = sheet.getRange(lastRow + 1, 3);
  if (result === "success") {
    resultCell.setBackground("#d4edda");
  } else if (result === "error") {
    resultCell.setBackground("#f8d7da");
  }
}

/**
 * 統計情報を取得する
 * @returns {Object} {total, pending, posted, error}
 */
function getPostStats() {
  const sheet = getOrCreateSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) return { total: 0, pending: 0, posted: 0, error: 0 };

  const statuses = sheet
    .getRange(2, SHEET_COLUMNS.STATUS, lastRow - 1, 1)
    .getValues();

  let pending = 0,
    posted = 0,
    error = 0;
  statuses.forEach(function (row) {
    const s = row[0];
    if (s === "pending") pending++;
    else if (s === "posted") posted++;
    else if (s === "error") error++;
  });

  return {
    total: lastRow - 1,
    pending: pending,
    posted: posted,
    error: error,
  };
}

// ================================
// テスト用関数
// ================================
function testSheetsManager() {
  // テスト用の投稿を書き込み
  const testPosts = [
    { type: "normal", text: "テスト通常投稿1", scheduledTime: new Date() },
    {
      type: "normal",
      text: "テスト通常投稿2",
      scheduledTime: new Date(Date.now() + 60 * 60000),
    },
    {
      type: "normal",
      text: "テスト通常投稿3",
      scheduledTime: new Date(Date.now() + 120 * 60000),
    },
    {
      type: "affiliate",
      text: "テストアフィ投稿 #PR",
      scheduledTime: new Date(Date.now() + 180 * 60000),
    },
  ];

  writePendingPosts(testPosts);

  const stats = getPostStats();
  Logger.log(`統計: ${JSON.stringify(stats)}`);

  const next = getNextPendingPost();
  Logger.log(`次の投稿: ${next ? next.text.substring(0, 30) : "なし"}`);
}

/**
 * ============================================================
 * Scheduler.gs — スケジューラモジュール
 * ============================================================
 * 深夜休止・ゴールデンタイム対応の可変間隔スケジューリング。
 * 0:00〜6:59 休止、20:00〜23:00 は45〜60分間隔（アフィ優先）、
 * その他は90〜120分間隔。
 * ============================================================
 */

/**
 * 指定の時刻が休止時間かどうか判定
 * @param {number} hour - 時（0〜23）
 * @returns {boolean}
 */
function isQuietHours(hour) {
  return (
    hour >= SCHEDULE_CONFIG.QUIET_HOURS_START &&
    hour < SCHEDULE_CONFIG.QUIET_HOURS_END
  );
}

/**
 * 指定の時刻がゴールデンタイムかどうか判定
 * @param {number} hour - 時（0〜23）
 * @returns {boolean}
 */
function isGoldenTime(hour) {
  return (
    hour >= SCHEDULE_CONFIG.GOLDEN_TIME_START &&
    hour < SCHEDULE_CONFIG.GOLDEN_TIME_END
  );
}

/**
 * min〜max の範囲でランダムな整数を返す
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * 次の投稿可能時刻を計算する
 * @param {Date} lastPostTime - 直前の投稿時刻
 * @returns {Date} 次の投稿時刻
 */
function getNextPostTime(lastPostTime) {
  const lastHour = lastPostTime.getHours();
  let intervalMin;

  if (isGoldenTime(lastHour)) {
    intervalMin = randomInt(
      SCHEDULE_CONFIG.GOLDEN_INTERVAL_MIN,
      SCHEDULE_CONFIG.GOLDEN_INTERVAL_MAX,
    );
  } else {
    intervalMin = randomInt(
      SCHEDULE_CONFIG.NORMAL_INTERVAL_MIN,
      SCHEDULE_CONFIG.NORMAL_INTERVAL_MAX,
    );
  }

  const nextTime = new Date(lastPostTime.getTime() + intervalMin * 60 * 1000);

  // 休止時間に入ってしまう場合は翌朝 7:00 にスキップ
  if (isQuietHours(nextTime.getHours())) {
    nextTime.setDate(
      nextTime.getDate() +
        (nextTime.getHours() < SCHEDULE_CONFIG.QUIET_HOURS_END ? 0 : 1),
    );
    nextTime.setHours(SCHEDULE_CONFIG.QUIET_HOURS_END, 0, 0, 0);
  }

  return nextTime;
}

/**
 * 4件セットに対する投稿スケジュールを生成する
 * ゴールデンタイムにアフィリエイト投稿を優先配置
 * @param {Object[]} postSet - generatePostSet() の返却値
 * @param {Date} startTime - スケジュール開始時刻（省略時は現在時刻）
 * @returns {Object[]} スケジュール付きの postSet
 */
function generateSchedule(postSet, startTime) {
  startTime = startTime || new Date();

  // 初回投稿時刻が休止時間の場合は翌朝へ
  if (isQuietHours(startTime.getHours())) {
    startTime.setHours(SCHEDULE_CONFIG.QUIET_HOURS_END, 0, 0, 0);
    if (new Date() > startTime) {
      startTime.setDate(startTime.getDate() + 1);
    }
  }

  // スケジュール時刻を計算
  const scheduledPosts = [];
  let currentTime = new Date(startTime);

  postSet.forEach(function (post, index) {
    if (index > 0) {
      // 1件目以降は前の投稿から固定間隔を加える
      // (getNextPostTime は内部で休止時間を考慮してスキップする)
      currentTime = getNextPostTime(currentTime);
    }

    // 揺らぎ（jitter）を加える（0〜N分）
    const jitterMin = randomInt(0, SCHEDULE_CONFIG.JITTER_MAX_MIN || 0);
    const scheduledTime = new Date(
      currentTime.getTime() + jitterMin * 60 * 1000,
    );

    post.scheduledTime = scheduledTime;
    scheduledPosts.push(post);
  });

  Logger.log("[Scheduler] スケジュール生成完了（順序維持・揺らぎあり）:");
  scheduledPosts.forEach(function (post) {
    const timeStr = Utilities.formatDate(
      post.scheduledTime,
      "Asia/Tokyo",
      "yyyy/MM/dd HH:mm",
    );
    Logger.log(`  ${timeStr} — ${post.type}`);
  });

  return scheduledPosts;
}

/**
 * 現在の時刻で投稿すべきか判定する
 * @returns {boolean}
 */
function shouldPostNow() {
  const now = new Date();
  const hour = now.getHours();

  // 休止時間は投稿しない
  if (isQuietHours(hour)) {
    return false;
  }

  return true;
}

/**
 * 現在時刻がアフィリエイト投稿に適しているか判定
 * @returns {boolean}
 */
function isAffiliateOptimalTime() {
  const hour = new Date().getHours();
  return isGoldenTime(hour);
}

// ================================
// テスト用関数
// ================================
function testScheduler() {
  // テスト用の4件セットを模擬
  const mockPostSet = [
    { type: "normal", text: "通常投稿1", scheduledTime: null },
    { type: "normal", text: "通常投稿2", scheduledTime: null },
    { type: "normal", text: "通常投稿3", scheduledTime: null },
    { type: "affiliate", text: "アフィ投稿", scheduledTime: null },
  ];

  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0); // 朝8時開始を仮定

  const scheduled = generateSchedule(mockPostSet, startTime);
  Logger.log("=== スケジュール結果 ===");
  scheduled.forEach(function (post, i) {
    const timeStr = Utilities.formatDate(
      post.scheduledTime,
      "Asia/Tokyo",
      "HH:mm",
    );
    Logger.log(
      `${i + 1}. [${timeStr}] ${post.type}: ${post.text.substring(0, 30)}...`,
    );
  });

  Logger.log(`現在投稿可能: ${shouldPostNow()}`);
  Logger.log(`アフィリエイト最適時間: ${isAffiliateOptimalTime()}`);
}

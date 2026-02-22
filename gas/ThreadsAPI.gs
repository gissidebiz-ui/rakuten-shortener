/**
 * ============================================================
 * ThreadsAPI.gs — Threads Graph API 投稿モジュール
 * ============================================================
 * UrlFetchApp を使用して Threads Graph API にテキスト投稿、
 * リプライ投稿（親投稿＋リプライ形式）を実行します。
 * ============================================================
 */

/**
 * テキスト投稿用のメディアコンテナを作成する
 * @param {string} text - 投稿テキスト
 * @param {string} replyToId - リプライ先の投稿ID（オプション）
 * @returns {string} creation_id
 */
function createThreadsContainer(text, replyToId) {
  const userId = CONFIG.THREADS_USER_ID;
  const accessToken = CONFIG.THREADS_ACCESS_TOKEN;

  if (!userId || !accessToken) {
    throw new Error("THREADS_USER_ID または THREADS_ACCESS_TOKEN が未設定です");
  }

  const url = `${THREADS_API_CONFIG.BASE_URL}/${userId}/threads`;

  const payload = {
    media_type: "TEXT",
    text: text,
    access_token: accessToken,
  };

  // リプライの場合は reply_to_id を追加
  if (replyToId) {
    payload.reply_to_id = replyToId;
  }

  if (DRY_RUN) {
    Logger.log(
      `[ThreadsAPI][DRY_RUN] コンテナ作成: ${text.substring(0, 50)}...`,
    );
    return "dry_run_container_" + Date.now();
  }

  const options = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (statusCode !== 200 || !result.id) {
    throw new Error(
      `コンテナ作成失敗 (HTTP ${statusCode}): ${JSON.stringify(result)}`,
    );
  }

  Logger.log(`[ThreadsAPI] コンテナ作成成功: ${result.id}`);
  return result.id;
}

/**
 * メディアコンテナを公開する
 * @param {string} creationId - createThreadsContainer() で取得した creation_id
 * @returns {string} 公開された投稿の ID
 */
function publishThreadsContainer(creationId) {
  const userId = CONFIG.THREADS_USER_ID;
  const accessToken = CONFIG.THREADS_ACCESS_TOKEN;

  const url = `${THREADS_API_CONFIG.BASE_URL}/${userId}/threads_publish`;

  if (DRY_RUN) {
    Logger.log(`[ThreadsAPI][DRY_RUN] 公開: ${creationId}`);
    return "dry_run_post_" + Date.now();
  }

  const payload = {
    creation_id: creationId,
    access_token: accessToken,
  };

  const options = {
    method: "post",
    payload: payload,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(url, options);
  const statusCode = response.getResponseCode();
  const result = JSON.parse(response.getContentText());

  if (statusCode !== 200 || !result.id) {
    throw new Error(`公開失敗 (HTTP ${statusCode}): ${JSON.stringify(result)}`);
  }

  Logger.log(`[ThreadsAPI] 公開成功: ${result.id}`);
  return result.id;
}

/**
 * テキスト投稿を実行する（コンテナ作成 → 公開）
 * @param {string} text - 投稿テキスト
 * @returns {string} 投稿 ID
 */
function publishTextPost(text) {
  Logger.log(`[ThreadsAPI] テキスト投稿開始 (${text.length}文字)`);

  // Step 1: コンテナ作成
  const containerId = createThreadsContainer(text);

  // Step 2: コンテナが処理されるまで待機
  Logger.log(
    `[ThreadsAPI] 公開待機中 (${THREADS_API_CONFIG.PUBLISH_WAIT_MS}ms)...`,
  );
  Utilities.sleep(THREADS_API_CONFIG.PUBLISH_WAIT_MS);

  // Step 3: 公開
  const postId = publishThreadsContainer(containerId);

  return postId;
}

/**
 * リプライ投稿を実行する
 * @param {string} parentId - 親投稿の ID
 * @param {string} text - リプライテキスト
 * @returns {string} 投稿 ID
 */
function publishReply(parentId, text) {
  Logger.log(`[ThreadsAPI] リプライ投稿開始 (親: ${parentId})`);

  // Step 1: リプライコンテナ作成（reply_to_id を指定）
  const containerId = createThreadsContainer(text, parentId);

  // Step 2: 待機
  Utilities.sleep(THREADS_API_CONFIG.PUBLISH_WAIT_MS);

  // Step 3: 公開
  const replyId = publishThreadsContainer(containerId);

  return replyId;
}

/**
 * 4件セットを「親投稿 + リプライ」形式で投稿する
 * 1件目を親投稿として、2〜4件目をリプライとしてスレッド形式で投稿
 * @param {Object[]} postSet - スケジュール済みの投稿セット
 * @returns {Object[]} 投稿結果 [{postId, type, success, error}]
 */
function publishPostSetAsThread(postSet) {
  Logger.log(`[ThreadsAPI] スレッド形式で ${postSet.length}件の投稿を開始...`);

  const results = [];
  let parentId = null;

  for (let i = 0; i < postSet.length; i++) {
    const post = postSet[i];

    try {
      let postId;

      if (i === 0) {
        // 1件目は親投稿
        postId = publishTextPost(post.text);
        parentId = postId;
      } else {
        // 2件目以降はリプライ
        Utilities.sleep(THREADS_API_CONFIG.REPLY_DELAY_MS);
        postId = publishReply(parentId, post.text);
      }

      results.push({
        postId: postId,
        type: post.type,
        success: true,
        error: null,
      });

      Logger.log(
        `[ThreadsAPI] 投稿 ${i + 1}/${postSet.length} 成功: ${postId}`,
      );
    } catch (e) {
      Logger.log(
        `[ThreadsAPI] 投稿 ${i + 1}/${postSet.length} 失敗: ${e.message}`,
      );
      results.push({
        postId: null,
        type: post.type,
        success: false,
        error: e.message,
      });
    }
  }

  const successCount = results.filter(function (r) {
    return r.success;
  }).length;
  Logger.log(
    `[ThreadsAPI] スレッド投稿完了 — 成功: ${successCount}/${postSet.length}`,
  );

  return results;
}

// ================================
// テスト用関数
// ================================
function testThreadsPost() {
  // ドライランモードで実行（Config.gs の DRY_RUN を true に設定）
  const testText =
    "GAS から Threads API テスト投稿です 🔧\n\nこれはテスト投稿なので無視してください。";
  const postId = publishTextPost(testText);
  Logger.log(`テスト投稿 ID: ${postId}`);
}

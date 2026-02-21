import os
# カレントディレクトリをスクリプトが存在する場所に固定
os.chdir(os.path.dirname(os.path.abspath(__file__)))
import time
import subprocess
import yaml  # type: ignore
from datetime import datetime, timedelta
from merge_posts import PostMerger
from di_container import get_container

# ================================
# 日別ログファイルのパス生成
# ================================
def get_log_path():
    """実行日の日付に基づいたログファイルのパスを返します。"""
    today = datetime.now().strftime("%Y-%m-%d")
    return f"../logs/log_{today}.txt"

# ================================
# ログ書き込み関数（ターミナル + ファイル）
# ================================
def log(message):
    """メッセージをターミナルに表示し、同時にログファイルへ追記します。"""
    os.makedirs("../logs", exist_ok=True)

    log_path = get_log_path()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {message}\n")

    print(message)

# ================================
# 古いログ（30日以上前）を削除
# ================================
def cleanup_old_logs():
    """30 日以上経過した古いログファイルを削除してディレクトリを整理します。"""
    log_dir = "../logs"
    if not os.path.exists(log_dir):
        return

    threshold = datetime.now() - timedelta(days=30)

    for filename in os.listdir(log_dir):
        if filename.startswith("log_") and filename.endswith(".txt"):
            date_str = filename.replace("log_", "").replace(".txt", "")
            try:
                file_date = datetime.strptime(date_str, "%Y-%m-%d")
                if file_date < threshold:
                    os.remove(os.path.join(log_dir, filename))
                    print(f"古いログを削除しました: {filename}")
            except ValueError:
                continue

# ================================
# secrets.yaml の存在チェック
# ================================
def check_secrets():
    """API キー等の機密情報ファイルが存在するか確認します。欠けている場合はプログラムを終了します。"""
    secrets_path = "../config/secrets.yaml"
    if not os.path.exists(secrets_path):
        log("⚠ エラー: secrets.yaml が見つかりません。処理を停止します。")
        log("テンプレート生成スクリプトを実行してください: python secrets_template_generator.py")
        exit(1)

# ================================
# accounts.yaml 読み込み
# ================================
def load_accounts():
    """運用対象のアカウント設定を読み込み、アカウント名のリストを返します。"""
    accounts_path = "../config/accounts.yaml"
    if not os.path.exists(accounts_path):
        log("⚠ エラー: accounts.yaml が見つかりません。処理を停止します。")
        exit(1)

    with open(accounts_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    return list(data.keys())  # アカウント名（トップレベルキー）のみ取得

# ================================
# サブスクリプトの実行処理
# ================================
def run_script(script_name):
    """別の Python スクリプトを子プロセスとして実行し、結果をログに記録します。"""
    log(f"=== {script_name} の実行を開始します ===")
    result = subprocess.run(["python", script_name])
    if result.returncode != 0:
        log(f"ERROR: {script_name} の実行中にエラーが発生しました。")
        exit(1)
    log(f"=== {script_name} が正常に完了しました ===")

# ================================
# メイン処理フロー
# ================================
def main():
    """各ステージ（CSV 生成、通常ポスト、アフィポスト、マージ）を順番に実行する全体制御関数。"""
    cleanup_old_logs()
    log("★ 自動生成パイプラインを開始します ★")

    start_time = time.time()

    check_secrets()

    # 前回のメトリクスログをクリア（今回の実行分のみを正確に集計するため）
    try:
        os.makedirs("../logs", exist_ok=True)
        metrics_path = os.path.join("..", "logs", "ai_metrics.jsonl")
        if os.path.exists(metrics_path):
            os.remove(metrics_path)
    except Exception:
        pass

    # 1. 楽天 API から商品情報を取得して CSV 作成
    run_script("make_input_csv.py")
    # 2. AI を用いた通常ポストの生成
    run_script("normal_post_generator.py")
    # 3. AI を用いたアフィリエイトポストの生成
    run_script("affiliate_post_generator.py")

    # 4. 生成された 2 種類のポストをマージ（DI コンテナを利用）
    merger = PostMerger()
    merger.merge()
    log("すべての投稿文のマージ処理が完了しました。")

    # AI 実行メトリクス（リクエスト数、成功率、再試行回数等）の集計と報告
    try:
        metrics_path = os.path.join("..", "logs", "ai_metrics.jsonl")
        if os.path.exists(metrics_path):
            import json
            counts = {}
            attempts_list = []
            with open(metrics_path, "r", encoding="utf-8") as mf:
                for line in mf:
                    try:
                        obj = json.loads(line)
                        ev = obj.get("event")
                        counts[ev] = counts.get(ev, 0) + 1
                        info = obj.get("info") or {}
                        if ev == "ai_success":
                            attempts_list.append(info.get("attempts", 1))
                    except Exception:
                        continue

            log("--- AI 実行統計サマリ ---")
            log(f"リクエスト合計イベント: {sum(counts.values())}")
            log(f"成功数 (ai_success): {counts.get('ai_success', 0)}")
            log(f"開始数 (ai_request_start): {counts.get('ai_request_start', 0)}")
            log(f"エラー数 (ai_error): {counts.get('ai_error', 0)}")
            log(f"レート制限回避 (ai_rate_limit): {counts.get('ai_rate_limit', 0)}")
            log(f"最終失敗数 (ai_final_failure): {counts.get('ai_final_failure', 0)}")
            if attempts_list:
                avg_attempts = sum(attempts_list) / len(attempts_list)
                log(f"1 成功あたりの平均試行回数: {avg_attempts:.2f}")
            log("--- 統計サマリ 終了 ---")
        else:
            log("AI メトリクスファイル (ai_metrics.jsonl) が無いため集計をスキップします。")
    except Exception as e:
        log(f"AI メトリクスの集計中にエラーが発生しました: {e}")

    end_time = time.time()
    elapsed = end_time - start_time

    minutes = int(elapsed // 60)
    seconds = int(elapsed % 60)

    log(f"★ 全工程が完了しました（総実行時間: {minutes}分 {seconds}秒） ★")
    log("配送準備が整った投稿文が data/output に出力されています。")

    print("\n★ パイプラインが正常に終了しました！ ★")
    print(f"総実行時間: {minutes}分 {seconds}秒")
    print("data/output フォルダ内のファイルを確認してください。")

if __name__ == "__main__":
    main()

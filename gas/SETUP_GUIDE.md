# GAS版 Threads×楽天アフィリエイト 全自動運用システム

## 📌 概要

Google Apps Script (GAS) のみで完結する、Threads 自動投稿システムです。
外部ライブラリ不要。スプレッドシートから投稿予約を管理し、Threads Graph API で自動投稿します。

### 主な機能

| 機能                                | 説明                                                           |
| ----------------------------------- | -------------------------------------------------------------- |
| 🔍 トレンド解析                     | Gemini AI が30代・事務職・ライフハック界隈の最新トレンドを分析 |
| 📝 25%ルール投稿生成                | 通常投稿3件 + アフィリエイト1件の「4件セット」を自動生成       |
| ⏰ インテリジェントスケジューリング | 深夜休止（0-7時）、ゴールデンタイム優先（20-23時）             |
| 🚀 Threads API 直接投稿             | スレッド形式（親 + リプライ）で自動投稿                        |
| 📊 スプレッドシート管理             | 予約管理、ステータス追跡、実行ログ                             |

---

## 🛠️ セットアップ手順

### Step 1: スプレッドシート作成

1. [Google Sheets](https://sheets.google.com) で新しいスプレッドシートを作成
2. 名前を「Threads自動投稿管理」などに設定

### Step 2: GAS プロジェクト作成

1. スプレッドシートのメニュー → **拡張機能** → **Apps Script**
2. GAS エディタが開きます

### Step 3: ファイルを作成

GAS エディタで以下の7つのファイルを作成し、`gas/` フォルダ内の対応するコードを貼り付けてください：

```text
📁 GAS プロジェクト
├── Config.gs          ← 設定管理
├── TrendAnalyzer.gs   ← トレンド解析
├── PostGenerator.gs   ← 投稿生成（25%ルール）
├── Scheduler.gs       ← スケジューラ
├── ThreadsAPI.gs      ← Threads API 投稿
├── SheetsManager.gs   ← スプレッドシート管理
└── Main.gs            ← メイン制御（トリガー関数）
```

> **Note:** GAS エディタでは「+」ボタン → 「スクリプト」を選択して新しいファイルを追加します。ファイル名は `.gs` 拡張子なしで入力してください（例: `Config`）。

### Step 4: API キーの設定

GAS エディタの左側メニュー → **⚙️ プロジェクトの設定** → **スクリプト プロパティ**

以下のキーと値を追加：

| プロパティ名           | 説明                         | 取得方法                                               |
| ---------------------- | ---------------------------- | ------------------------------------------------------ |
| `GEMINI_API_KEY`       | Google AI Studio の API キー | [AI Studio](https://aistudio.google.com/apikey)        |
| `THREADS_ACCESS_TOKEN` | Threads API アクセストークン | [Meta Developers](https://developers.facebook.com/)    |
| `THREADS_USER_ID`      | Threads ユーザー ID          | Meta Developers の API Explorer                        |
| `RAKUTEN_APP_ID`       | 楽天 API アプリケーション ID | [楽天WebService](https://webservice.rakuten.co.jp/)    |
| `RAKUTEN_AFFILIATE_ID` | 楽天アフィリエイト ID        | [楽天アフィリエイト](https://affiliate.rakuten.co.jp/) |

### Step 5: 初回セットアップ実行

1. GAS エディタで `Main.gs` を開く
2. 上部のドロップダウンから `initialSetup` を選択
3. ▶️ 実行ボタンをクリック
4. Google アカウントの権限承認ダイアログが表示されたら「許可」

これにより：

- 「投稿予約」「実行ログ」シートが自動作成されます
- 日次トリガー（7時）と1分間隔トリガーが自動登録されます

---

## 📖 使い方

### 自動運用（トリガー実行）

セットアップ完了後は以下が自動実行されます：

1. **毎朝7時** — `generateAndSchedule` がトレンド解析 → 4件セット生成 → スケジュール書き込みを実行
2. **1分ごと** — `processScheduledPosts` が予定時刻を過ぎた投稿を検出 → Threads に投稿

### 手動運用（スプレッドシートメニュー）

スプレッドシートを開くと、メニューバーに **🧵 Threads 自動投稿** が表示されます：

| メニュー                      | 説明                                         |
| ----------------------------- | -------------------------------------------- |
| 📝 セット生成（トレンド自動） | トレンドキーワードで楽天検索 → 4件セット生成 |
| 🔗 セット生成（楽天URL指定）  | 楽天URLを指定して4件セット生成               |
| 🚀 スレッド一括投稿           | pending の投稿をスレッド形式で一括投稿       |
| 📊 統計表示                   | 投稿統計をダイアログ表示                     |

### テスト実行

GAS エディタから以下の関数を個別実行できます：

```text
testTrendAnalysis()   — トレンド解析テスト
testPostGeneration()  — 投稿生成テスト
testScheduler()       — スケジューラテスト
testSheetsManager()   — スプレッドシートテスト
testThreadsPost()     — Threads API テスト（DRY_RUN推奨）
runFullTest()         — 全モジュール一括テスト
```

> **⚠️ 初回テスト時は `Config.gs` の `DRY_RUN` を `true` に設定してください。** これにより、Threads への実際の投稿がスキップされ、ログ出力のみ行われます。

---

## 📋 スプレッドシート構成

### 「投稿予約」シート

| 列  | 内容         | 例                                 |
| --- | ------------ | ---------------------------------- |
| A   | 予定時刻     | 2026/02/22 08:30                   |
| B   | 投稿タイプ   | normal / affiliate                 |
| C   | 投稿本文     | 朝の時短術...                      |
| D   | ステータス   | pending / posting / posted / error |
| E   | Threads ID   | 12345678                           |
| F   | 親Threads ID | 12345678 (リプライの場合)          |
| G   | 作成日時     | 2026/02/22 07:00:05                |
| H   | エラー       | (エラー時のみ)                     |

### 「実行ログ」シート

| 列  | 内容                   |
| --- | ---------------------- |
| A   | 実行日時               |
| B   | アクション             |
| C   | 結果 (success / error) |
| D   | 詳細                   |

---

## ⚙️ カスタマイズ

### スケジュール調整

`Config.gs` の `SCHEDULE_CONFIG` を変更：

```javascript
const SCHEDULE_CONFIG = {
  QUIET_HOURS_START: 0, // 休止開始
  QUIET_HOURS_END: 7, // 休止終了
  GOLDEN_TIME_START: 20, // ゴールデンタイム開始
  GOLDEN_TIME_END: 23, // ゴールデンタイム終了
  GOLDEN_INTERVAL_MIN: 45, // ゴールデンタイム最短間隔（分）
  GOLDEN_INTERVAL_MAX: 60, // ゴールデンタイム最長間隔（分）
  NORMAL_INTERVAL_MIN: 90, // 通常時間最短間隔（分）
  NORMAL_INTERVAL_MAX: 120, // 通常時間最長間隔（分）
};
```

### ターゲット層の変更

`Config.gs` の `TREND_CONFIG.TARGET_DEMO` を変更：

```javascript
const TREND_CONFIG = {
  TARGET_DEMO: "30代 事務職 ライフハック", // ← ここを変更
  // ...
};
```

---

## 🔐 セキュリティ注意事項

- API キーはすべて **スクリプトプロパティ** に格納（コードにハードコードしない）
- Threads アクセストークンには有効期限があります（長期トークンの取得を推奨）
- スプレッドシートの共有設定に注意（API キーが含まれるスクリプトプロパティはシート共有しても見えません）

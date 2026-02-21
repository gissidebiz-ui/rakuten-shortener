# セキュリティ設定ガイド

## ⚠️ 重要な注意事項

このプロジェクトは Google Generative AI API と楽天 API を使用します。**API キーは絶対に GitHub にアップロードしてはいけません。**

## 1. シークレット管理

### ローカル開発環境での設定

```bash
# 1. テンプレートからシークレットファイルを作成
cp config/secrets.yaml.template config/secrets.yaml

# 2. config/secrets.yaml を編集してAPI キーを設定
# 注意: config/secrets.yaml は .gitignore に登録されています
# Git にアップロードされません
```

### 必要な API キーの取得

#### Google Generative AI API
- **URL**: https://makersuite.google.com/app/apikey
- **手順**：
  1. Google Account でログイン
  2. "Create API Key" をクリック
  3. 生成されたキーをコピー
  4. `config/secrets.yaml` の `google_api_key` に貼り付け

#### 楽天 API (Books & Ichiba)
- **URL**: https://webservice.rakuten.co.jp/app/
- **手順**：
  1. 楽天デベロッパーアカウントでログイン
  2. Application ID を取得
  3. `config/secrets.yaml` の `rakuten_application_id` に設定

#### 楽天アフィリエイト ID
- **URL**: https://affiliate.rakuten.co.jp/
- **手順**：
  1. 楽天アフィリエイトアカウントでログイン
  2. 自分のアフィリエイト ID を確認
  3. `config/secrets.yaml` の `rakuten_affiliate_id` に設定

## 2. GitHub Actions での使用

### リポジトリシークレットの設定

```bash
# 1. GitHub リポジトリ設定ページへ
# Settings → Secrets and variables → Actions

# 2. 以下のシークレットを登録
#    - GOOGLE_API_KEY
#    - RAKUTEN_APPLICATION_ID
#    - RAKUTEN_AFFILIATE_ID
#    - BASE_URL

# 3. ワークフロー内で参照
# example: ${{ secrets.GOOGLE_API_KEY }}
```

### .github/workflows での使用例

```yaml
- name: Set up secrets
  run: |
    cat > config/secrets.yaml << EOF
    google_api_key: "${{ secrets.GOOGLE_API_KEY }}"
    rakuten_application_id: ${{ secrets.RAKUTEN_APPLICATION_ID }}
    rakuten_affiliate_id: "${{ secrets.RAKUTEN_AFFILIATE_ID }}"
    base_url: "${{ secrets.BASE_URL }}"
    EOF
```

## 3. .gitignore セキュリティ設定

現在のプロジェクトの `.gitignore` には以下が含まれています：

```ignore
# 絶対に追跡しないファイル
config/secrets.yaml
config/.env
config/.env.local
.env
.env.local
.env.*.local

# AWS, Google, その他クラウド認証ファイル
*.pem
*.key
*.p12
*.pfx
~/.aws/
~/.gcloud/
```

## 4. Git コミット前のセキュリティチェック

```bash
# ローカル開発環境での確認
git status

# config/secrets.yaml が表示されないことを確認
# 表示される場合は以下を実行
git rm --cached config/secrets.yaml
git add .gitignore
git commit -m "security: remove secrets from tracking"
```

## 5. 既にコミットされたシークレット削除手順

誤ってシークレットが commit された場合は、以下の手順で削除します：

### 方法 1: 直近のコミットの場合

```bash
# 最後のコミットを修正（ローカルのみ）
git reset HEAD~1
git rm --cached config/secrets.yaml
git add .gitignore
git commit -m "security: remove secrets from git history"
git push --force-with-lease  # 注意: リモートを上書き
```

### 方法 2: 過去のコミットの場合（BFG使用）

```bash
# BFG を使用してすべての履歴からファイルを削除
# インストール: https://rtyley.github.io/bfg-repo-cleaner/

bfg --delete-files config/secrets.yaml
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force-with-lease
```

## 6. セキュリティベストプラクティス

- ✅ **DO**: GitHub Actions でのシークレット設定
- ✅ **DO**: `.env.template` など テンプレートファイルを git トラッキング
- ✅ **DO**: 定期的に .gitignore をレビュー
- ❌ **DON'T**: API キーをハードコード
- ❌ **DON'T**: シークレットをログ出力
- ❌ **DON'T**: シークレットを README に含める

## 7. トラブルシューティング

### シークレットが誤ってアップロードされた場合

1. **即座に API キーをリセット**（最優先）
   - Google Cloud Console で API キーを削除
   - 楽天デベロッパーサイトで Application ID を再発行
   - 楽天アフィリエイトでアフィリエイト ID を更新

2. **GitHub リポジトリから削除**
   - git filter-branch または BFG で履歴から削除
   - git push --force-with-lease で強制反映

3. **Git 履歴全体を削除**
   ```bash
   git log --all --full-history -- config/secrets.yaml
   # 上記で削除対象のコミットを確認してから削除
   ```

## 参考リンク

- [GitHub - Securely storing secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OWASP - Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [BFG Repo Cleaner](https://rtyley.github.io/bfg-repo-cleaner/)

---

**最後に**: このアプリケーションを本番環境にデプロイする前に、セキュリティレビューを実施してください。

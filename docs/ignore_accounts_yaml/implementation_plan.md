# 実装計画 - accounts.yamlをGitHubから削除

`config/accounts.yaml` に含まれる認証情報などを保護するため、GitHub の管理対象から除外します。

## 変更内容

### Git 設定

- `.gitignore` に `config/accounts.yaml` を追跡対象外として追記。
- `git rm --cached` コマンドを使用して、GitHub（リモートリポジトリ）上のみから削除。

## 検証計画

- `git status` を実行し、対象ファイルが変更対象（および削除対象）としてマークされているか確認。
- `git push` 後にリモートでの削除を確認。

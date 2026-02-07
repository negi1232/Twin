---
description: hotfix ブランチを main と develop の両方にマージして完了する
---

# ホットフィックスブランチ完了

現在の hotfix ブランチを main と develop の両方にマージします。

## 手順

1. 現在のブランチが `hotfix/*` であることを確認
2. `npm test` を実行し、全テストがパスすることを確認
3. `npm run lint` を実行し、エラーがないことを確認
4. `main` をチェックアウトし、`--no-ff` で hotfix をマージ
5. main のマージコミットにタグを付与（例: `hotfix-<名前>`）
6. `develop` をチェックアウト（なければ main から作成）し、`--no-ff` で hotfix をマージ
7. hotfix ブランチをローカルで削除
8. 完了を報告し、両ブランチとタグの push をリマインドする

## ルール
- `hotfix/*` ブランチでのみ実行可能
- テストが通らなければマージしない
- 必ず `--no-ff` マージ戦略を使用
- main と develop の**両方**にマージする
- 自動で push はしない

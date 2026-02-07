---
description: release ブランチの PR を main に作成して完了する
---

# リリースブランチ完了

release ブランチを origin に push し、main への Pull Request を作成します。

## 手順

1. 現在のブランチが `release/*` であることを確認
2. 未コミットの変更がないか確認（あれば警告して中断）
3. ブランチ名からバージョンを取得（例: `release/1.0.0` → `1.0.0`）
4. `npm test` を実行し、全テストがパスすることを確認
5. `npm run lint` を実行し、エラーがないことを確認
6. 現在のブランチを origin に push（`git push -u origin <branch>`）
7. `gh pr create` で main へのプルリクエストを作成:
   - ベース: `main`
   - タイトル: `Release v<バージョン>`
   - 本文: 以下を含む
     - main からの差分コミットログの変更概要
     - テスト計画セクション
     - 「PR マージ後の手順」セクション:
       - `/release-complete <バージョン>` を実行してタグ作成と develop 同期を行う
8. PR の URL をユーザーに報告
9. PR マージ後に `/release-complete` コマンドの実行が必要であることをリマインドする

## ルール
- `release/*` ブランチでのみ実行可能
- テストが通らなければ PR を作成しない
- lint エラーがあれば PR を作成しない
- PR の本文に post-merge 手順を必ず含める
- ローカルのマージやブランチ削除は行わない

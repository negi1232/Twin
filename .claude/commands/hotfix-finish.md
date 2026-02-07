---
description: hotfix ブランチの PR を main に作成して完了する
---

# ホットフィックスブランチ完了

現在の hotfix ブランチを origin に push し、main への Pull Request を作成します。

## 手順

1. 現在のブランチが `hotfix/*` であることを確認
2. 未コミットの変更がないか確認（あれば警告して中断）
3. `npm test` を実行し、全テストがパスすることを確認
4. `npm run lint` を実行し、エラーがないことを確認
5. 現在のブランチを origin に push（`git push -u origin <branch>`）
6. `gh pr create` で main へのプルリクエストを作成:
   - ベース: `main`
   - タイトル: `Hotfix: <名前>`（ブランチ名から `hotfix/` を除去、ハイフンをスペースに、先頭大文字）
   - 本文: 以下を含む
     - main からの差分コミットログの変更概要
     - テスト計画セクション
     - 「PR マージ後の手順」セクション:
       - `/hotfix-complete <バージョン>` を実行してタグ作成と develop 同期を行う
7. PR の URL をユーザーに報告
8. PR マージ後に `/hotfix-complete` コマンドの実行が必要であることをリマインドする

## ルール
- `hotfix/*` ブランチでのみ実行可能
- テストが通らなければ PR を作成しない
- lint エラーがあれば PR を作成しない
- PR の本文に post-merge 手順を必ず含める
- ローカルのマージやブランチ削除は行わない

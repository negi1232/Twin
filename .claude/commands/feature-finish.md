---
description: feature ブランチの PR を develop に作成して完了する
---

# フィーチャーブランチ完了

現在の feature ブランチを origin に push し、develop への Pull Request を作成します。

## 手順

1. 現在のブランチが `feature/*` であることを確認
2. 未コミットの変更がないか確認（あれば警告して中断）
3. `npm test` を実行し、全テストがパスすることを確認
4. `npm run lint` を実行し、エラーがないことを確認
5. 現在のブランチを origin に push（`git push -u origin <branch>`）
6. `gh pr create` で develop へのプルリクエストを作成:
   - ベース: `develop`
   - タイトル: ブランチ名から生成（`feature/` プレフィックスを除去、ハイフンをスペースに、先頭大文字）
   - 本文: develop からの差分コミットログの変更概要 + テスト計画セクション
7. PR の URL をユーザーに報告

## ルール
- `feature/*` ブランチでのみ実行可能
- テストが通らなければ PR を作成しない
- lint エラーがあれば PR を作成しない
- PR の本文に「テスト計画」セクションを含める
- ローカルのマージやブランチ削除は行わない（GitHub 上でマージする前提）

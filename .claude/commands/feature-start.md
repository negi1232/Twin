---
description: develop から新しい feature ブランチを作成する
argument: フィーチャー名（例: "12-dual-viewer"）
---

# フィーチャーブランチ開始

Git Flow に従い、develop から新しい feature ブランチを作成します。

## 手順

1. ワーキングツリーがクリーンか確認（未コミットの変更があれば中断）
2. origin から最新を fetch
3. `develop` ブランチが存在しなければ `main` から作成
4. `develop` をチェックアウトし、最新を pull
5. `feature/$ARGUMENTS` ブランチを作成してチェックアウト
6. 作成したブランチ名をユーザーに報告

## ルール
- ブランチ名の形式: `feature/<引数>`
- 必ず最新の `develop` から分岐する
- 未コミットの変更がある場合は警告して中断する

---
description: develop からリリース準備用の release ブランチを作成する
argument: バージョン番号（例: "1.0.0"）
---

# リリースブランチ開始

リリース準備のため、develop から新しい release ブランチを作成します。

## 手順

1. ワーキングツリーがクリーンか確認
2. origin から最新を fetch
3. `develop` をチェックアウトし、最新を pull
4. `release/$ARGUMENTS` ブランチを作成してチェックアウト
5. `package.json` のバージョンを指定されたバージョンに更新
6. バージョン更新をコミット
7. 作成したブランチ名をユーザーに報告し、完了時のフローを案内する:
   - `/release-finish` で main への PR を作成
   - PR マージ後に `/release-complete <バージョン>` でタグ作成と develop 同期

## ルール
- ブランチ名の形式: `release/<バージョン>`
- 必ず最新の `develop` から分岐する
- 未コミットの変更がある場合は中断する
- package.json のバージョンを自動更新する

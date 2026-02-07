---
description: リリース PR マージ後にタグ作成と develop 同期を行う
argument: バージョン番号（例: "1.6.1"）
---

# リリース完了（PR マージ後）

main にマージされたリリースのタグを作成し、変更を develop に同期します。

## 手順

1. 引数としてバージョン番号が指定されていることを確認（なければ中断）
2. origin から最新を fetch
3. `main` をチェックアウトし、最新を pull
4. `gh pr list --state merged --head release/$ARGUMENTS` で該当リリース PR がマージ済みであることを確認
   - マージ済みでなければ中断し、先に PR をマージするよう案内する
5. main の HEAD にタグを付与: `v<バージョン>`（例: `v1.6.1`）
6. タグを origin に push: `git push origin v<バージョン>`（release.yml がトリガーされる）
7. `develop` をチェックアウトし、最新を pull
8. main を develop に `--no-ff` でマージ（develop への同期）
9. develop を origin に push: `git push origin develop`
10. release ブランチをローカルとリモートから削除（存在する場合のみ、エラーは無視）
11. 完了を報告:
    - タグ `v<バージョン>` が push されたこと
    - release.yml ワークフローがトリガーされること
    - develop が同期されたこと

## ルール
- バージョン引数は必須
- PR がマージ済みであることを確認してから実行する
- タグの形式: `v<バージョン>`
- develop への同期は `--no-ff` マージで行う
- タグ push により release.yml が自動トリガーされる

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.10.0] - 2026-02-11

### Added
- アプリアイコン（モダンダークテーマ）を追加
- BrowserView のズームイン・ズームアウト操作に対応

### Fixed
- Sync 座標をズームファクターでスケーリングし、正確なクリック・ホバー位置を実現
- reg-cli の del 依存関係による ESM 互換性エラーを修正
- クリック同期によるページ遷移時の二重ナビゲーションを防止
- `<textarea>` 要素に対する正しいネイティブセッターの使用
- リプレイスクリプト内のバッククォート・テンプレート式のエスケープ処理を修正
- モーダルや水平コンテナ内の要素レベルスクロール同期を追加

### Changed
- macOS ビルドで `.icns` アイコン形式を使用、開発モードで Dock アイコンを設定

## [1.9.1] - 2026-01-15

### Fixed
- BrowserView の sandbox 有効化・権限制御・スクロール値検証を追加（セキュリティ強化）

## [1.9.0] - 2026-01-14

### Fixed
- OSS 公開前セキュリティ修正 6 件（URL スキーム検証、パストラバーサル防止、ファイルサイズ制限など）

## [1.8.1] - 2026-01-12

### Changed
- README 全面リニューアル + スクリーンショット追加

## [1.8.0] - 2026-01-10

### Added
- フォーカス喪失時にスクロール同期を一時停止する機能

### Fixed
- `globalShortcut` を `Menu` accelerator に置き換え（他アプリとのショートカット競合を解消）

## [1.7.1] - 2026-01-08

### Fixed
- electron-store v10 の ESM default export に対応
- `BrowserView` → `WebContentsView` 移行（Electron 40 対応）

## [1.7.0] - 2026-01-06

### Changed
- Git Flow を PR ベースのワークフローに変更

### Fixed
- Jest 30 の `--testPathPatterns` に更新
- Node.js を v22 に更新、CI のカバレッジアップロードを修正

### Dependencies
- Electron 28 → 40
- Jest 29 → 30
- ESLint 9 → 10
- electron-builder 24 → 26
- electron-store 8 → 10

## [1.6.1] - 2025-12-20

### Fixed
- 未使用 catch バインディング変数の lint エラーを修正

## [1.6.0] - 2025-12-18

### Added
- OSS 公開準備（セキュリティ・ドキュメント整備）
- SECURITY.md、CONTRIBUTING.md、LICENSE を追加

### Fixed
- GitHub Actions SHA をフル 40 文字に修正

## [1.5.0] - 2025-12-15

### Added
- ファイルプレビュー機能
- セレクタベースの Sync（要素単位で同期対象を特定）
- UI 改善

## [1.4.0] - 2025-12-10

### Added
- サイドバーにファイルブラウザを追加
- ソート select・フィルタ radio・キーボード操作に対応

## [1.3.0] - 2025-12-05

### Added
- テスト 3 層充実化（Unit / Integration / E2E）

### Fixed
- バグ修正複数件

## [1.2.0] - 2025-11-28

### Changed
- ドキュメントを現状の実装に合わせて整備

## [1.1.0] - 2025-11-20

### Fixed
- 日本語入力（IME）の同期を値ベースに変更
- フォームへの文字入力同期を修正

## [1.0.0] - 2025-11-15

### Added
- 左右 2 画面で Web ページを同時表示する Dual Viewer
- スクロール・クリック・キー入力の同期機能
- スクリーンショット撮影 & reg-cli による画像差分比較
- デバイスプリセット（iPhone SE / 14 Pro / iPad / Desktop / Full HD）
- reg-cli の HTML レポート表示
- electron-store による設定の永続化
- プロジェクト初期構築（Electron + Jest + ESLint + Husky）

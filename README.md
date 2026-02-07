# Twin

**Visual Regression Testing Desktop App**

2つの Web ページを左右に並べて同時に表示・操作し、スクリーンショット比較で視覚的な差分を検出する Electron 製デスクトップアプリ。localhost でもリモート URL でも使えます。

```
┌─────────────────────────────────────────────────────────────────┐
│ Toolbar                                                         │
│ [Expected URL ↻]  SE 14P iPad DT FHD  Sync  New  📷  📋  ⚙  [Actual URL ↻] │
├────────────────────────────┬────────────────────────────────────┤
│                            │                                    │
│   BrowserView #1           │   BrowserView #2                   │
│   Expected (Base Branch)   │   Actual (Feature Branch)          │
│   localhost:3000           │   localhost:3001                    │
│                            │                                    │
├────────────────────────────┴────────────────────────────────────┤
│ Status Bar: 375 x 667  │  Sync: ON  │  Passed: 3 / Failed: 1  │
└─────────────────────────────────────────────────────────────────┘
```

## 特徴

- **デュアルビューア** — BrowserView 2枚で新旧ブランチを左右同時表示
- **操作同期** — スクロール・クリック・キー入力・ページ遷移を左→右に自動同期
- **IME対応** — 日本語入力（変換確定）を値ベースで正確に同期
- **ワンクリック比較** — スクリーンショット撮影 → reg-cli で差分検出 → HTML レポート生成
- **デバイスプリセット** — iPhone SE / iPhone 14 Pro / iPad / Desktop / Full HD をワンクリック切替
- **レポート表示** — reg-cli のリッチな HTML レポート（透明度スライダー・スワイプ比較・差分ハイライト）
- **設定永続化** — URL・閾値・スナップショット保存先を electron-store で永続化

## 必要環境

- **Node.js** 18 以上
- **OS** macOS 12+ / Windows 10+

## セットアップ

```bash
git clone <repository-url>
cd twin
npm install
```

## 使い方

### 起動

```bash
npm start          # アプリを起動
npm run dev        # DevTools 付きで起動
```

### 基本フロー

1. Expected（左）と Actual（右）の URL を入力して Enter
2. デバイスプリセット（SE / 14P / iPad / DT / FHD）でビューサイズを選択
3. **Capture** ボタンでスクリーンショット撮影 & reg-cli 比較を実行
4. ステータスバーに結果サマリが表示される
5. **Report** ボタンで reg-cli の HTML レポートを別ウィンドウで確認

### New Report

**New** ボタンからテスト名を付けてキャプチャ。ページ単位で名前を分けて管理できます。

### 同期

**Sync ON/OFF** トグルで操作同期を切替。ON の状態では左画面のスクロール・クリック・キー入力・フォーム入力・ページ遷移が右画面に自動反映されます。

## キーボードショートカット

| ショートカット | 機能 |
|---|---|
| `Cmd/Ctrl + R` | 左右両方をリロード |
| `Cmd/Ctrl + Shift + R` | アクティブ側のみリロード |
| `Cmd/Ctrl + Shift + S` | スクリーンショット撮影 & 比較 |
| `Cmd/Ctrl + Shift + O` | 最新レポートを開く |
| `Cmd/Ctrl + 1〜5` | デバイスプリセット切替 |
| `Cmd/Ctrl + ,` | 設定モーダルを開く |

## 設定

設定モーダル（`Cmd/Ctrl + ,`）から変更可能:

| 項目 | 説明 | デフォルト |
|---|---|---|
| Matching Threshold | ピクセル差分感度（0〜1, 小さいほど厳密） | 0 |
| Threshold Rate | 変更検知率しきい値（0〜1） | 0 |
| Snapshot Directory | スクリーンショット保存先 | ./snapshots |

## 開発

### コマンド

```bash
npm test           # ユニット・統合テスト + カバレッジ
npm run test:watch # ウォッチモード
npm run test:e2e   # E2E テスト (Playwright + Electron)
npm run lint       # ESLint
npm run build:mac  # macOS 向けビルド
npm run build:win  # Windows 向けビルド
```

### テスト構成

```
__tests__/
├── unit/           # ユニットテスト (Jest)
├── integration/    # 統合テスト (Jest)
├── e2e/            # E2E テスト (Playwright)
└── fixtures/       # テスト用モックサーバー・画像
```

### カバレッジ閾値

| 指標 | 閾値 |
|---|---|
| Statements | 95% |
| Branches | 85% |
| Functions | 85% |
| Lines | 95% |

### 技術スタック

| 技術 | 用途 |
|---|---|
| Electron 28 | デスクトップアプリ基盤 (Chromium + Node.js) |
| reg-cli | 画像比較・差分検出・HTML レポート生成 |
| electron-store | 設定の JSON 永続化 |
| Jest | ユニット・統合テスト |
| Playwright | E2E テスト（Electron モード） |
| ESLint 9 | リンター（flat config） |
| Husky | Git フック（pre-commit, pre-push） |
| electron-builder | Win/Mac パッケージング |
| GitHub Actions | CI/CD |

### プロジェクト構成

```
src/
├── main/              # Electron メインプロセス
│   ├── index.js       # エントリポイント, BrowserWindow/View 生成
│   ├── ipc-handlers.js # IPC ハンドラ
│   ├── sync-manager.js # 操作同期（スクロール・クリック・キー・フォーム入力）
│   ├── screenshot.js   # capturePage() ラッパー
│   ├── reg-runner.js   # reg-cli 実行・結果パース
│   ├── preload.js      # contextBridge API 公開
│   └── store.js        # electron-store 設定管理
├── renderer/          # レンダラープロセス
│   ├── index.html
│   ├── styles/main.css
│   └── scripts/
│       ├── app.js
│       ├── ui-controls.js
│       ├── sync.js
│       └── device-presets.js
└── shared/
    └── constants.js
```

### Git ワークフロー

[Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) を採用:

- `main` — プロダクションリリース
- `develop` — 開発統合ブランチ
- `feature/*` — 新機能
- `release/*` — リリース準備
- `hotfix/*` — 緊急修正

## ライセンス

MIT

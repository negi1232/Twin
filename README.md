<p align="center">
  <img src="docs/screenshots/app-overview.png" alt="Twin - CSS Comparison Tool" width="800" />
</p>

<h1 align="center">Twin</h1>

<p align="center">
  <strong>CSS Comparison Tool for Web Development</strong><br />
  2つの Web ページを左右に並べて表示し、CSS Computed Style をリアルタイムに比較・差分検出する Electron 製デスクトップアプリ。スクリーンショット比較（reg-cli）による Visual Regression Testing も搭載。
</p>

<p align="center">
  <a href="https://github.com/negi1232/Twin/actions/workflows/ci.yml"><img src="https://github.com/negi1232/Twin/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/version-1.13.2-blue" alt="Version 1.13.2" />
  <img src="https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white" alt="Electron 40" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform" />
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT" /></a>
</p>

---

## Overview

Twin は、**Expected（期待値）** と **Actual（実際）** の2つの Web ページを左右に並べて同時に表示・操作し、**CSS プロパティレベルの差分** をリアルタイムに検出できるデスクトップアプリです。

CSS Computed Style の自動比較エンジンにより、レイアウト・テキスト・装飾などのカテゴリ別に変更箇所を特定します。補助機能としてスクリーンショット比較（reg-cli）によるピクセル差分検出も利用できます。

localhost の開発サーバーでもリモート URL でも使えるため、ブランチ間のリグレッションテストに最適です。

## Features

| 機能 | 説明 |
|---|---|
| **CSS Full Scan** | 左右ページの全要素の CSS Computed Style を自動収集・比較し、カテゴリ別レポートを生成 |
| **CSS Inspect Mode** | 要素を個別にクリックして CSS 差分をリアルタイムに確認（ホバーハイライト付き） |
| **Dual Viewer** | 左右2画面で Expected / Actual ページを同時表示 |
| **Sync Mode** | スクロール・クリック・キー入力・フォーム入力・ページ遷移を左から右に自動同期 |
| **Screenshot Capture** | スクリーンショット撮影 + reg-cli で差分検出 + HTML レポート生成 |
| **Device Presets** | iPhone SE / 14 Pro / iPad / Desktop / Full HD をワンクリック切替 |
| **Zoom Control** | ビューのズームイン・アウト・リセット |
| **File Browser** | サイドバーでフォルダをツリー表示。ソート・フィルタ・キーボード操作対応 |
| **IME Support** | 日本語入力（変換確定）を値ベースで正確に同期 |
| **Persistent Settings** | URL・閾値・スナップショット保存先を electron-store で自動保存 |

## Screenshots

<table>
  <tr>
    <td align="center"><strong>メイン画面</strong></td>
    <td align="center"><strong>キャプチャ結果</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/main-window.png" alt="メイン画面" width="400" /></td>
    <td><img src="docs/screenshots/capture-result.png" alt="キャプチャ結果" width="400" /></td>
  </tr>
  <tr>
    <td align="center"><strong>サイドバー</strong></td>
    <td align="center"><strong>設定モーダル</strong></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/sidebar.png" alt="サイドバー" width="400" /></td>
    <td><img src="docs/screenshots/settings-modal.png" alt="設定モーダル" width="400" /></td>
  </tr>
  <tr>
    <td align="center" colspan="2"><strong>reg-cli レポート</strong></td>
  </tr>
  <tr>
    <td colspan="2" align="center"><img src="docs/screenshots/report.png" alt="レポート画面" width="600" /></td>
  </tr>
</table>

## Getting Started

### Prerequisites

- **Node.js** 18+
- **macOS** 12+ / **Windows** 10+ / **Linux**

### Install

```bash
git clone https://github.com/negi1232/Twin.git
cd Twin
npm install
```

### Launch

```bash
npm start          # TypeScript ビルド & アプリ起動
npm run dev        # TypeScript ビルド & DevTools 付きで起動
```

## Usage

### 基本フロー

```
1. URL を入力        2. プリセット選択      3. Capture で比較
+----------------+  +----------------+  +----------------+
| Expected URL   |  | SE 14P iPad    |  |   Capture      |
| Actual   URL   |  | DT FHD         |  |                |
+----------------+  +----------------+  +----------------+
                                              |
4. 結果をステータスバーで確認          5. Report で詳細表示
+---------------------------+  +----------------+
| Passed: 3 | Failed: 1    |  |   Report       |
+---------------------------+  +----------------+
```

1. **Expected**（左）と **Actual**（右）の URL を入力して Enter
2. デバイスプリセット（**SE** / **14P** / **iPad** / **DT** / **FHD**）でビューサイズを選択
3. **Capture** ボタンでスクリーンショット撮影 & reg-cli 比較を実行
4. ステータスバーに **Passed / Failed / New / Deleted** の結果サマリが表示される
5. **Report** ボタンで reg-cli の HTML レポートを別ウィンドウで確認

### CSS Full Scan

全要素の CSS プロパティを一括比較するモードです。

1. 左右のビューにページを表示した状態で **CSS Scan** ボタンをクリック（または `Cmd/Ctrl + Shift + C`）
2. 全要素の computed style を自動収集・比較
3. レポートウィンドウが開き、差分を確認:
   - **フィルタ**: Changed / Added / Deleted で絞り込み
   - **カテゴリ**: Layout / Text / Visual / Other でプロパティを分類
   - **検索**: 要素名やプロパティ名で検索
   - **エクスポート**: JSON エクスポートやクリップボードコピー

### CSS Inspect Mode

要素を個別に選択して CSS 差分をリアルタイム確認するモードです。

1. **Inspect** ボタンをクリック（または `Cmd/Ctrl + I`）
2. 左パネルで要素をホバーすると青枠でハイライト
3. クリックすると右パネルの対応要素（オレンジ枠）と CSS を比較
4. 画面下部のドロワーに差分テーブルを表示
   - **Diff Only / All Props** で表示切替
   - **Layout / Text / Visual / Other** でカテゴリフィルタ
5. `Esc` キーで終了

### New Report

**+ New** ボタンからテスト名を付けてキャプチャ。ページごとに名前を分けて管理できます。

<img src="docs/screenshots/new-report-modal.png" alt="New Report モーダル" width="400" />

### File Browser (Sidebar)

ツールバー左端の **&#x2630;** ボタンでサイドバーを開閉。

- **Open Folder** -- ネイティブダイアログでフォルダを選択し、ツリー表示
- **New Folder** -- サイドバー内で新規フォルダを作成
- **Sort** -- 名前昇順・降順・タイプ別でソート
- **Filter** -- 全て / ディレクトリのみ / ファイルのみ
- **Keyboard** -- Tab でフォーカス移動、Enter / Space でフォルダ展開・折りたたみ
- フォルダ選択時にスナップショット保存先が自動設定されます

### Sync Mode

**Sync ON/OFF** トグルで操作同期を切替。ON の状態では左画面の操作が右画面に自動反映されます。

| 同期される操作 |
|---|
| スクロール（垂直・水平） |
| マウスクリック |
| キーボード入力 |
| フォーム入力（IME 対応） |
| ページ遷移 |

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + R` | 左右両方をリロード |
| `Cmd/Ctrl + Shift + R` | アクティブ側のみリロード |
| `Cmd/Ctrl + Shift + S` | スクリーンショット撮影 & 比較 |
| `Cmd/Ctrl + Shift + O` | 最新レポートを開く |
| `Cmd/Ctrl + Shift + C` | CSS Full Scan |
| `Cmd/Ctrl + I` | CSS Inspect Mode ON/OFF |
| `Cmd/Ctrl + 1` ~ `5` | デバイスプリセット切替 (SE / 14P / iPad / DT / FHD) |
| `Cmd/Ctrl + +` | ズームイン |
| `Cmd/Ctrl + -` | ズームアウト |
| `Cmd/Ctrl + 0` | ズームリセット (100%) |
| `Cmd/Ctrl + ,` | 設定モーダルを開く |

## Settings

設定モーダル（`Cmd/Ctrl + ,`）から変更可能。値は electron-store で自動保存されます。

| Setting | Description | Default |
|---|---|---|
| **Matching Threshold** | ピクセル差分の感度 (0--1, 小さいほど厳密) | `0` |
| **Threshold Rate** | 変更検知率のしきい値 (0--1) | `0` |
| **Snapshot Directory** | スクリーンショットの保存先パス | `./snapshots` |

## Development

### Commands

```bash
# Build & Launch
npm start              # TypeScript ビルド & アプリ起動
npm run dev            # TypeScript ビルド & DevTools 付きで起動
npm run build:ts       # TypeScript コンパイルのみ

# Test
npm test               # Unit / Integration テスト + カバレッジ
npm run test:watch     # ウォッチモード
npm run test:e2e       # E2E テスト (Playwright + Electron)

# Code Quality
npm run typecheck      # 型チェック (tsc --noEmit)
npm run lint           # Biome lint チェック
npm run lint:fix       # Biome lint 自動修正
npm run format         # Biome フォーマット

# Package
npm run build:mac      # macOS ビルド (.dmg)
npm run build:win      # Windows ビルド (.exe)
npm run build:linux    # Linux ビルド
```

### Test Coverage

テストカバレッジの閾値は CI で強制されます。

| Metric | Threshold |
|---|---|
| Statements | 95% |
| Branches | 85% |
| Functions | 85% |
| Lines | 95% |

```
__tests__/
├── unit/           # ユニットテスト (Jest + ts-jest)
├── integration/    # 統合テスト (Jest + mocked Electron IPC)
├── e2e/            # E2E テスト (Playwright + Electron)
└── fixtures/       # テスト用モックサーバー・画像
```

### Architecture

Twin は Electron のマルチプロセスアーキテクチャに従い、Main Process / Renderer Process / Preload の3層で構成されています。IPC 通信は `contextBridge` 経由のみで行い、`contextIsolation: true` / `nodeIntegration: false` のセキュリティ設定を適用しています。

```
src/
├── main/                    # Electron Main Process (Node.js)
│   ├── index.ts             # エントリポイント — BrowserWindow / WebContentsView 管理
│   ├── ipc-handlers.ts      # IPC メッセージハンドラ
│   ├── sync-manager.ts      # スクロール / クリック / キー / フォーム同期
│   ├── css-compare.ts       # CSS Computed Style 収集・比較エンジン
│   ├── screenshot.ts        # capturePage() ラッパー
│   ├── reg-runner.ts        # reg-cli 実行 & 結果パース
│   ├── preload.ts           # contextBridge API 定義
│   └── store.ts             # electron-store 設定管理
├── renderer/                # Renderer Process (ブラウザ互換コードのみ)
│   ├── index.html           # メイン UI
│   ├── styles/main.css      # スタイルシート
│   └── scripts/
│       ├── app.ts           # メインアプリコントローラ
│       ├── ui-controls.ts   # ツールバー・モーダル操作
│       ├── css-compare.ts   # CSS 比較 UI（Inspect ドロワー等）
│       ├── sync.ts          # Sync トグル UI
│       └── device-presets.ts # デバイスサイズプリセット
├── shared/                  # Main / Renderer 共有モジュール
│   ├── constants.ts         # 定数 (ズーム、サイドバー幅等)
│   └── utils.ts             # ユーティリティ (escapeHtml, classifyProperty等)
└── types/
    └── global.d.ts          # グローバル型定義
```

TypeScript ソースは `dist/` にコンパイルされ、Electron はコンパイル済み JS を実行します。

### Tech Stack

| Technology | Purpose |
|---|---|
| [Electron](https://www.electronjs.org/) 40 | デスクトップアプリフレームワーク (Chromium + Node.js) |
| [TypeScript](https://www.typescriptlang.org/) 5.9 | 型安全な開発言語 |
| [reg-cli](https://github.com/reg-viz/reg-cli) | 画像差分検出 & HTML レポート生成 |
| [electron-store](https://github.com/sindresorhus/electron-store) | 永続的な JSON 設定ストア |
| [Jest](https://jestjs.io/) + [ts-jest](https://kulshekhar.github.io/ts-jest/) | ユニット & 統合テスト |
| [Playwright](https://playwright.dev/) | E2E テスト (Electron モード) |
| [Biome](https://biomejs.dev/) | Linter & Formatter |
| [Husky](https://typicode.github.io/husky/) | Git hooks (pre-commit, pre-push) |
| [electron-builder](https://www.electron.build/) | クロスプラットフォームパッケージング |
| [GitHub Actions](https://github.com/features/actions) | CI/CD |

### Git Workflow

[Git Flow](https://nvie.com/posts/a-successful-git-branching-model/) ベースの PR 駆動ワークフロー:

```
main ──────●──────────●──────────●──── (production releases)
           |          |          |
           |  hotfix/* | release/*|
           |          |          |
develop ───+──────────+──────────+──── (integration)
            |   |   |
     feature/*  feature/*  feature/*
```

| Branch | Purpose |
|---|---|
| `main` | Production-ready releases |
| `develop` | Integration branch |
| `feature/*` | New features (from develop) |
| `release/*` | Release preparation (from develop) |
| `hotfix/*` | Emergency fixes (from main) |

## Contributing

1. `develop` ブランチから `feature/<issue-number>-<description>` ブランチを作成
2. [Conventional Commits](https://www.conventionalcommits.org/) 形式でコミット: `<type>(<scope>): <subject>`
   - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`
   - Scopes: `main`, `renderer`, `shared`, `test`, `build`, `ci`
3. テスト・lint を通過させた上で PR を作成
4. PR は `develop` ブランチへマージ

## License

[MIT](LICENSE)

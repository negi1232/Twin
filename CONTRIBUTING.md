# Contributing to Twin

Twin へのコントリビューションに感謝します！

## Development Setup

```bash
git clone https://github.com/negi1232/Twin.git
cd Twin
npm install
npm run dev    # DevTools 付きで起動
```

## Architecture Overview

Twin は Electron の **Main プロセス**と **Renderer プロセス**で構成されています。

```
src/
├── main/                # Main Process (Node.js)
│   ├── index.js         # エントリーポイント — ウィンドウ・ビュー管理
│   ├── ipc-handlers.js  # IPC メッセージハンドラ（全 API の中核）
│   ├── sync-manager.js  # 左→右ビューの操作同期エンジン
│   ├── screenshot.js    # capturePage() によるスクリーンショット撮影
│   ├── reg-runner.js    # reg-cli 実行 & 結果パース
│   ├── preload.js       # contextBridge で Renderer に公開する API
│   └── store.js         # electron-store による設定の永続化
├── renderer/            # Renderer Process (Browser)
│   ├── index.html       # メイン HTML
│   ├── styles/main.css  # スタイルシート
│   └── scripts/
│       ├── app.js              # エントリーポイント
│       ├── ui-controls.js      # ツールバー・モーダル・サイドバー
│       ├── sync.js             # 同期 UI トグル
│       └── device-presets.js   # デバイスサイズプリセット
└── shared/
    └── constants.js     # プロセス間共有定数
```

### データフロー

```
Renderer (ui-controls.js)
    ↓ window.electronAPI.xxx()
    ↓ (contextBridge / preload.js)
Main Process (ipc-handlers.js)
    ↓ captureScreenshots() / runRegCli() / syncManager
    ↓ 結果を send() で Renderer に通知
Renderer (onCaptureResult 等のコールバック)
```

### 同期の仕組み

1. `sync-manager.js` が左ビューに **インジェクションスクリプト** を挿入
2. スクリプトはスクロール・クリック・入力等のイベントを `console.log` で送信
3. Main プロセスが `console-message` イベントでキャッチ
4. 右ビューに `executeJavaScript` / `sendInputEvent` で再現

## Git Workflow

このプロジェクトは **Git Flow** + **PR ベース**のワークフローを採用しています。

- `main` - 本番リリース用（直接 push 禁止）
- `develop` - 統合ブランチ
- `feature/*` - 新機能（`develop` から分岐）
- `hotfix/*` - 緊急修正（`main` から分岐）
- `release/*` - リリース準備（`develop` から分岐）

### ブランチ命名規則

```
feature/<issue-number>-<short-description>
hotfix/<issue-number>-<short-description>
release/<version>
```

## Pull Request Process

1. `develop` ブランチから feature ブランチを作成
2. 変更を実装し、テストを追加
3. `npm test` と `npm run lint` が通ることを確認
4. `develop` に向けて PR を作成
5. レビュー後にマージ

### PR テンプレート

PR の説明には以下の情報を含めてください:

```markdown
## 概要
<!-- 変更内容の要約（1〜3 行） -->

## 変更の種類
- [ ] 新機能 (feat)
- [ ] バグ修正 (fix)
- [ ] リファクタリング (refactor)
- [ ] テスト追加 (test)
- [ ] ドキュメント (docs)

## テスト方法
<!-- どのようにテストしたか、または確認手順 -->

## 関連 Issue
<!-- closes #XX -->
```

## Commit Message Convention

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`
**Scopes**: `main`, `renderer`, `shared`, `test`, `build`, `ci`

### 例

```
feat(main): ズームイン・ズームアウト操作に対応
fix(main): textarea 要素のネイティブセッター使用を修正
test(main): モーダル内スクロール同期のテストを追加
docs(readme): キーボードショートカット一覧を更新
```

## Testing

```bash
npm test           # Unit + Integration tests with coverage
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # ESLint
```

### テスト構成

| 種類 | ディレクトリ | ツール | 対象 |
|------|-------------|--------|------|
| Unit | `__tests__/unit/` | Jest | 純粋なロジック・関数 |
| Integration | `__tests__/integration/` | Jest + mocked IPC | IPC ハンドラの結合テスト |
| E2E | `__tests__/e2e/` | Playwright + Electron | クリティカルパスのみ |

### カバレッジ閾値

| Metric | Threshold |
|--------|-----------|
| Statements | 95% |
| Branches | 85% |
| Functions | 85% |
| Lines | 95% |

## Coding Guidelines

- CommonJS (`require` / `module.exports`) を使用
- Electron セキュリティベストプラクティスに従う（`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`）
- Renderer プロセスでは Node.js API を使用しない
- IPC 通信は `preload.js` の `contextBridge` 経由のみ
- URL スキームは `http:` / `https:` のみ許可（`isAllowedUrl` で検証）
- ファイルシステムアクセスはユーザーが選択したディレクトリ配下のみ（`isPathUnderBase` で検証）

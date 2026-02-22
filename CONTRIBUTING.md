# Contributing to Twin

Twin へのコントリビューションに感謝します！このドキュメントでは、開発環境のセットアップからプルリクエストの作成まで、コントリビューションに必要な情報をまとめています。

---

## 目次

1. [開発環境のセットアップ](#開発環境のセットアップ)
2. [プロジェクト構成](#プロジェクト構成)
3. [Git ワークフロー](#git-ワークフロー)
4. [コミットメッセージ規約](#コミットメッセージ規約)
5. [テスト](#テスト)
6. [リント・フォーマット](#リントフォーマット)
7. [ビルドとパッケージング](#ビルドとパッケージング)
8. [プルリクエスト](#プルリクエスト)
9. [コーディングガイドライン](#コーディングガイドライン)

---

## 開発環境のセットアップ

### 前提条件

- **Node.js** v22 以上
- **npm** v10 以上
- **Git**

### インストール手順

```bash
# リポジトリのクローン
git clone https://github.com/negi1232/Twin.git
cd Twin

# 依存パッケージのインストール
npm install

# DevTools 付きでアプリを起動
npm run dev
```

### 主要コマンド一覧

| コマンド | 説明 |
|---------|------|
| `npm start` | TypeScript をビルドしてアプリを起動 |
| `npm run dev` | TypeScript をビルドして DevTools 付きで起動 |
| `npm run build:ts` | TypeScript を `dist/` にコンパイル |
| `npm test` | Jest による Unit / Integration テスト（カバレッジ付き） |
| `npm run test:watch` | Jest のウォッチモード |
| `npm run test:e2e` | Playwright による E2E テスト |
| `npm run typecheck` | 型チェック（`tsc --noEmit`） |
| `npm run lint` | Biome によるリントチェック |
| `npm run lint:fix` | Biome による自動修正 |
| `npm run format` | Biome によるフォーマット |

---

## プロジェクト構成

Twin は **TypeScript** で記述され、`dist/` にコンパイルされた JavaScript を Electron が実行します。

```
src/
├── main/                   # Main Process (Node.js)
│   ├── index.ts            # エントリーポイント -- ウィンドウ・ビュー管理
│   ├── ipc-handlers.ts     # IPC メッセージハンドラ（全 API の中核）
│   ├── sync-manager.ts     # 左→右ビューの操作同期エンジン
│   ├── css-compare.ts      # CSS Computed Style の比較エンジン
│   ├── screenshot.ts       # capturePage() によるスクリーンショット撮影
│   ├── reg-runner.ts       # reg-cli 実行 & 結果パース
│   ├── preload.ts          # contextBridge で Renderer に公開する API
│   └── store.ts            # electron-store による設定の永続化
├── renderer/               # Renderer Process (Browser)
│   ├── index.html          # メイン HTML
│   ├── styles/main.css     # スタイルシート
│   └── scripts/
│       ├── app.ts              # エントリーポイント
│       ├── ui-controls.ts      # ツールバー・モーダル・サイドバー
│       ├── css-compare.ts      # CSS 比較の UI 側ロジック
│       ├── sync.ts             # 同期 UI トグル
│       └── device-presets.ts   # デバイスサイズプリセット
├── shared/
│   ├── constants.ts        # プロセス間共有定数
│   └── utils.ts            # 共有ユーティリティ
└── types/
    └── global.d.ts         # TypeScript 型定義
```

### データフロー

```
Renderer (ui-controls.ts)
    | window.electronAPI.xxx()
    | (contextBridge / preload.ts)
Main Process (ipc-handlers.ts)
    | captureScreenshots() / runRegCli() / cssCompare / syncManager
    | 結果を send() で Renderer に通知
Renderer (onCaptureResult 等のコールバック)
```

### 同期の仕組み

1. `sync-manager.ts` が左ビューに **インジェクションスクリプト** を挿入
2. スクリプトはスクロール・クリック・入力等のイベントを `console.log` で送信
3. Main プロセスが `console-message` イベントでキャッチ
4. 右ビューに `executeJavaScript` / `sendInputEvent` で再現

---

## Git ワークフロー

このプロジェクトは **Git Flow** + **PR ベース**のワークフローを採用しています。ブランチへの直接マージではなく、必ず GitHub 上の Pull Request を通じてマージします。

### ブランチ戦略

| ブランチ | 用途 | 分岐元 |
|---------|------|--------|
| `main` | 本番リリース用（直接 push 禁止） | - |
| `develop` | 統合ブランチ | - |
| `feature/*` | 新機能開発 | `develop` |
| `release/*` | リリース準備 | `develop` |
| `hotfix/*` | 緊急修正 | `main` |

### ブランチ命名規則

```
feature/<issue-number>-<short-description>   例: feature/12-dual-viewer
hotfix/<issue-number>-<short-description>    例: hotfix/45-crash-on-capture
release/<version>                            例: release/1.0.0
```

### Feature ワークフロー

1. `develop` ブランチから feature ブランチを作成
2. 機能を開発し、コミットを積む
3. `npm test` と `npm run lint` が通ることを確認
4. ブランチを push し、`develop` に向けて PR を作成
5. レビュー後に GitHub 上でマージ

### Release ワークフロー

1. `develop` から release ブランチを作成し、バージョンを更新
2. 最終テスト、バグ修正を実施
3. `main` に向けて PR を作成
4. レビュー後に GitHub 上でマージ
5. マージコミットにタグを付与し push（GitHub Actions によるリリースビルドがトリガーされる）
6. `develop` へ同期

### Hotfix ワークフロー

1. `main` から hotfix ブランチを作成
2. 問題を修正し、コミット
3. `main` に向けて PR を作成
4. レビュー後に GitHub 上でマージ
5. マージコミットにタグを付与し push（リリースビルドがトリガーされる）
6. `develop` へ同期

---

## コミットメッセージ規約

以下の形式に従ってください。

```
<type>(<scope>): <subject>

<body>
```

### Type 一覧

| Type | 説明 |
|------|------|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `refactor` | リファクタリング（機能変更なし） |
| `test` | テストの追加・修正 |
| `docs` | ドキュメントのみの変更 |
| `style` | コードの意味に影響しない変更（フォーマット等） |
| `chore` | ビルドプロセスやツールの変更 |
| `perf` | パフォーマンス改善 |

### Scope 一覧

| Scope | 対象 |
|-------|------|
| `main` | Main プロセス (`src/main/`) |
| `renderer` | Renderer プロセス (`src/renderer/`) |
| `shared` | 共有コード (`src/shared/`) |
| `test` | テストコード (`__tests__/`) |
| `build` | ビルド設定 |
| `ci` | CI/CD 設定 |

### コミットメッセージの例

```
feat(main): CSS Computed Style 比較機能を追加
fix(renderer): サイドバーのスクロール位置がリセットされる問題を修正
refactor(main): IPC ハンドラの共通処理を抽出
test(main): css-compare のエッジケースのテストを追加
docs(readme): キーボードショートカット一覧を更新
chore(build): electron-builder の設定を更新
```

---

## テスト

### テスト構成

| 種類 | ディレクトリ | ツール | 対象 |
|------|-------------|--------|------|
| Unit | `__tests__/unit/` | Jest | 純粋なロジック・関数 |
| Integration | `__tests__/integration/` | Jest + mocked IPC | IPC ハンドラの結合テスト |
| E2E | `__tests__/e2e/` | Playwright + Electron | クリティカルパスのみ |

### テストの実行

```bash
# Unit + Integration テスト（カバレッジレポート付き）
npm test

# ウォッチモード（開発中に継続的にテスト）
npm run test:watch

# E2E テスト
npm run test:e2e
```

### カバレッジ閾値

`jest.config.js` で以下の閾値が設定されており、CI でも強制されます。これを下回るとテストが失敗します。

| メトリクス | 閾値 |
|-----------|------|
| Statements | 95% |
| Branches | 85% |
| Functions | 85% |
| Lines | 95% |

カバレッジ収集の対象は `src/**/*.ts` です。ただし以下は除外されます:

- `src/main/preload.ts` -- contextBridge 定義のため
- `src/renderer/scripts/app.ts` -- エントリーポイントのため
- `src/types/**` -- 型定義ファイル

### Unit テスト

Jest を使用し、純粋なロジック・関数を対象とします。Renderer プロセスのコードをテストする場合は `jsdom` 環境を使用します。

```typescript
// テストファイルの先頭で jsdom 環境を指定する例
/**
 * @jest-environment jsdom
 */
```

### Integration テスト

Electron の IPC 通信をモックし、Main プロセスのハンドラを結合テストします。実際の Electron ランタイムは不要です。

### E2E テスト

Playwright + Electron を使用して、アプリケーション全体のクリティカルパスをテストします。

設定（`playwright.config.js`）:
- タイムアウト: 60 秒
- リトライ: なし
- トレース・スクリーンショット・動画: 有効

### テストの方針

- **Unit テスト**: すべての純粋なロジック・ユーティリティ関数に対して記述
- **Integration テスト**: IPC フロー（Main - Renderer 間のやり取り）に対して記述
- **E2E テスト**: ユーザーにとってクリティカルなパスのみに限定（実行コストが高いため）

---

## リント・フォーマット

このプロジェクトでは **Biome** を使用してリントとフォーマットを行います。

### コマンド

```bash
# リントチェック（エラーの検出のみ）
npm run lint

# リントの自動修正
npm run lint:fix

# コードフォーマット
npm run format
```

### フォーマット設定

| 設定 | 値 |
|------|-----|
| インデント | スペース（幅 2） |
| 行幅 | 120 文字 |
| クォート | シングルクォート |
| セミコロン | あり |
| 末尾カンマ | あり |

### 主要なリントルール

- `useConst`: `let` の代わりに `const` を使用（error）
- `noVar`: `var` の使用禁止（error）
- `noUnusedVariables`: 未使用変数の検出（warn）
- `noUnusedImports`: 未使用インポートの検出（warn）
- `noExplicitAny`: 明示的な `any` 型の使用を警告（warn）
- `useTemplate`: テンプレートリテラルの使用を推奨（warn）

### Git Hooks（Husky）

以下の Git フックが設定されており、自動的に実行されます。

| フック | 実行内容 |
|--------|---------|
| `pre-commit` | `npm run lint` -- コミット前にリントチェック |
| `pre-push` | `npm run lint && npm test` -- プッシュ前にリント + テスト |

---

## ビルドとパッケージング

### TypeScript のコンパイル

```bash
npm run build:ts
```

TypeScript ソース（`src/`）を JavaScript（`dist/`）にコンパイルします。コンパイル設定（`tsconfig.json`）:
- ターゲット: ES2022
- モジュール: CommonJS
- strict モード有効
- ソースマップ・型宣言ファイル出力あり

### アプリケーションのパッケージング

electron-builder を使用して、各プラットフォーム向けの配布パッケージをビルドします。

```bash
# macOS 向けビルド
npm run build:mac

# Windows 向けビルド
npm run build:win

# Linux 向けビルド
npm run build:linux
```

### CI/CD

GitHub Actions により以下が自動実行されます:

- **ci.yml**: プルリクエスト・push 時に型チェック、リント、テストを実行
- **release.yml**: タグの push 時にリリースビルドを実行し、配布パッケージを作成

---

## プルリクエスト

### PR 作成の手順

1. 対象ブランチ（通常は `develop`）から feature ブランチを作成
2. 変更を実装し、テストを追加
3. 以下が通ることを確認:
   - `npm run typecheck` -- 型チェック
   - `npm run lint` -- リントチェック
   - `npm test` -- テスト（カバレッジ閾値を満たすこと）
4. ブランチを push し、対象ブランチに向けて PR を作成
5. レビュー後にマージ

### PR テンプレート

PR の説明には以下の情報を含めてください:

```markdown
## 概要
<!-- 変更内容の要約（1~3 行） -->

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

### PR のチェックリスト

PR を作成する前に、以下を確認してください:

- [ ] コミットメッセージが[規約](#コミットメッセージ規約)に従っている
- [ ] `npm run typecheck` が通る
- [ ] `npm run lint` が通る
- [ ] `npm test` が通り、カバレッジ閾値を満たしている
- [ ] 新しいコードに対するテストを追加している
- [ ] 変更が Electron セキュリティベストプラクティスに準拠している

---

## コーディングガイドライン

- **言語**: TypeScript を使用（`src/**/*.ts`、`dist/` にコンパイル）
- **Electron セキュリティ**: `contextIsolation: true`、`nodeIntegration: false` を厳守
- **IPC 通信**: `preload.ts` の `contextBridge` 経由のみ（直接の `ipcRenderer` アクセス禁止）
- **Renderer プロセス**: ブラウザ互換コードのみ（Node.js API の使用禁止）
- **URL スキーム**: `http:` / `https:` のみ許可（`isAllowedUrl` で検証）
- **ファイルアクセス**: ユーザーが選択したディレクトリ配下のみ（`isPathUnderBase` で検証）
- **テスト方針**: 純粋ロジックには Unit テスト、IPC フローには Integration テスト、クリティカルパスのみ E2E テスト

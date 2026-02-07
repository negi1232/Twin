# Contributing to Twin

Twin へのコントリビューションに感謝します！

## Development Setup

```bash
git clone https://github.com/negi1232/Twin.git
cd Twin
npm install
npm run dev    # DevTools 付きで起動
```

## Git Workflow

このプロジェクトは **Git Flow** を採用しています。

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

## Commit Message Convention

```
<type>(<scope>): <subject>
```

**Types**: `feat`, `fix`, `refactor`, `test`, `docs`, `style`, `chore`, `perf`
**Scopes**: `main`, `renderer`, `shared`, `test`, `build`, `ci`

## Testing

```bash
npm test           # Unit + Integration tests with coverage
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # ESLint
```

カバレッジ閾値:
- Statements: 95%
- Branches: 85%
- Functions: 85%
- Lines: 95%

## Coding Guidelines

- CommonJS (`require` / `module.exports`) を使用
- Electron セキュリティベストプラクティスに従う
- Renderer プロセスでは Node.js API を使用しない
- IPC 通信は preload.js の contextBridge 経由のみ

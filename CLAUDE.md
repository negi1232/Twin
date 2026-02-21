# Twin - CSS Comparison Tool

## Project Overview
Electron-based desktop app that compares CSS Computed Styles across two localhost views in real time, identifying what changed at the property level. Visual regression testing (screenshot + reg-cli) is available as a supplementary feature.

## Tech Stack
- **Language**: TypeScript (compiled to `dist/`)
- **Runtime**: Electron 40 (Chromium + Node.js)
- **CSS Comparison**: Custom engine (css-compare.ts) — Computed Style collection, element matching, diff categorization
- **Image Comparison**: reg-cli (reg-viz/reg-cli) — supplementary pixel-diff
- **Settings Storage**: electron-store
- **Testing**: Jest + ts-jest (unit/integration), Playwright (E2E)
- **Linting/Formatting**: Biome
- **Git Hooks**: Husky (pre-commit, pre-push)
- **Build**: TypeScript compiler + electron-builder
- **CI/CD**: GitHub Actions

## Project Structure
```
src/main/         - Electron main process (index.ts, ipc-handlers, sync-manager, css-compare, screenshot, reg-runner, preload, store)
src/renderer/     - Renderer process (HTML, CSS, TS for UI)
src/shared/       - Shared constants
src/types/        - TypeScript type definitions (global.d.ts)
dist/             - Compiled JS output (gitignored)
__tests__/unit/   - Unit tests (Jest)
__tests__/integration/ - Integration tests (Jest)
__tests__/e2e/    - E2E tests (Playwright)
.github/workflows/ - CI/CD (ci.yml, release.yml)
.husky/           - Git hooks (pre-commit, pre-push)
snapshots/        - Screenshot output (gitignored)
```

## Commands
```bash
npm start            # Build TS & launch the app
npm run dev          # Build TS & launch with DevTools
npm run build:ts     # Compile TypeScript to dist/
npm test             # Run tests with coverage
npm run test:watch   # Watch mode
npm run test:e2e     # E2E tests (Playwright)
npm run typecheck    # Type check (tsc --noEmit)
npm run lint         # Biome lint check
npm run lint:fix     # Biome lint auto-fix
npm run format       # Biome format
npm run build:mac    # Build for macOS
npm run build:win    # Build for Windows
npm run build:linux  # Build for Linux
```

## Git Workflow (Git Flow + PR-Based)
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features (branch from develop)
- `release/*` - Release preparation (branch from develop)
- `hotfix/*` - Emergency fixes (branch from main)

All branch merges are done via Pull Requests on GitHub, not local merges.

### Workflow Commands

**Feature workflow:**
1. `/feature-start <name>` - Create feature branch from develop
2. (develop the feature, commit changes)
3. `/feature-finish` - Run tests/lint, push branch, create PR to develop
4. (merge PR on GitHub)

**Release workflow:**
1. `/release-start <version>` - Create release branch from develop, bump version
2. (final testing, bug fixes on release branch)
3. `/release-finish` - Run tests/lint, push branch, create PR to main
4. (merge PR on GitHub)
5. `/release-complete <version>` - Tag merge commit, push tag (triggers release build), sync to develop

**Hotfix workflow:**
1. `/hotfix-start <name>` - Create hotfix branch from main
2. (fix the issue, commit changes)
3. `/hotfix-finish` - Run tests/lint, push branch, create PR to main
4. (merge PR on GitHub)
5. `/hotfix-complete <version>` - Tag merge commit, push tag (triggers release build), sync to develop

### Branch Naming Convention
- `feature/<issue-number>-<short-description>` (e.g., `feature/12-dual-viewer`)
- `hotfix/<issue-number>-<short-description>` (e.g., `hotfix/45-crash-on-capture`)
- `release/<version>` (e.g., `release/1.0.0`)

### Commit Message Convention
```
<type>(<scope>): <subject>

<body>
```
Types: feat, fix, refactor, test, docs, style, chore, perf
Scopes: main, renderer, shared, test, build, ci

## Test Coverage Policy
Coverage thresholds (enforced in `jest.config.js`):
- **Statements**: 95%
- **Branches**: 85%
- **Functions**: 85%
- **Lines**: 95%

Test structure:
- `__tests__/unit/` - Unit tests (Jest, jsdom for renderer code)
- `__tests__/integration/` - Integration tests (Jest, mocked Electron IPC)
- `__tests__/e2e/` - E2E tests (Playwright + Electron)

## Coding Guidelines
- Use TypeScript throughout (`src/**/*.ts`, compiled to `dist/`)
- Follow Electron security best practices: contextIsolation: true, nodeIntegration: false
- IPC communication via preload.ts contextBridge only
- Keep renderer code browser-compatible (no Node.js APIs)
- Test: unit tests for pure logic, integration for IPC flows, E2E for critical paths only

# Twin - Visual Regression Testing Desktop App

## Project Overview
Electron-based desktop app for comparing Git branches side by side with visual regression testing using reg-cli.

## Tech Stack
- **Runtime**: Electron 28 (Chromium + Node.js)
- **Image Comparison**: reg-cli (reg-viz/reg-cli)
- **Settings Storage**: electron-store
- **Testing**: Jest (unit/integration), Playwright (E2E)
- **Linting**: ESLint 9 (flat config)
- **Build**: electron-builder

## Project Structure
```
src/main/         - Electron main process (index.js, ipc-handlers, screenshot, reg-runner, preload, store)
src/renderer/     - Renderer process (HTML, CSS, JS for UI)
src/shared/       - Shared constants
__tests__/unit/   - Unit tests (Jest)
__tests__/integration/ - Integration tests (Jest)
__tests__/e2e/    - E2E tests (Playwright)
snapshots/        - Screenshot output (gitignored)
```

## Commands
```bash
npm start          # Launch the app
npm run dev        # Launch with DevTools
npm test           # Run tests with coverage
npm run test:watch # Watch mode
npm run test:e2e   # E2E tests (Playwright)
npm run lint       # ESLint check
npm run build:mac  # Build for macOS
npm run build:win  # Build for Windows
```

## Git Workflow (Git Flow)
- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features (branch from develop)
- `release/*` - Release preparation (branch from develop)
- `hotfix/*` - Emergency fixes (branch from main)

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

## Coding Guidelines
- Use CommonJS (`require`/`module.exports`) throughout
- Follow Electron security best practices: contextIsolation: true, nodeIntegration: false
- IPC communication via preload.js contextBridge only
- Keep renderer code browser-compatible (no Node.js APIs)
- Test: unit tests for pure logic, integration for IPC flows, E2E for critical paths only

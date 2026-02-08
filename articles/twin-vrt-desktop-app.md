---
title: "UIを変えずに機能を変えたい。でもVRTがない。だから作った。"
emoji: "👯"
type: "tech"
topics: ["electron", "vrt", "visualregression", "regcli", "テスト"]
published: false
---

## はじめに

「UIは変えないで、中の機能だけ変えてほしい」

仕事でこういう依頼を受けたことはありませんか？

リファクタリング、ライブラリのアップデート、API の差し替え――見た目はそのままで中身だけ変える。よくある話です。でも、「本当に見た目が変わっていないこと」をどうやって保証しますか？

目視確認？ 全ページ、全デバイスサイズを？ 人間の目は信用できません。

Visual Regression Testing（VRT）を使えばいい。でも、自分のプロジェクトには VRT の仕組みがなかった。CI に組み込まれた Chromatic のような SaaS もなければ、Storybook すらない。そんな現場は珍しくないと思います。

**「じゃあ作るか」** と思って作ったのが **Twin** です。

https://github.com/negi1232/Twin

## Twin とは

Twin は、2つの Web ページを左右に並べて表示し、同期操作しながらスクリーンショットを撮影・比較できる **Electron 製のデスクトップアプリ** です。

```
┌─────────────────────────────────────────┐
│  Expected (左)      │  Actual (右)       │
│  本番環境 / main    │  開発環境 / feature │
│                     │                     │
│   同じ操作が        │   ← 自動で同期      │
│   両方に反映        │                     │
└─────────────────────────────────────────┘
         ↓ Capture ボタン
   スクリーンショット撮影 → reg-cli で差分検出
         ↓
   HTML レポートで差分を確認
```

## なぜ既存ツールではダメだったのか

VRT ツールは世の中にたくさんあります。ざっと挙げると：

| ツール | 特徴 |
|---|---|
| **Chromatic** | Storybook 連携の SaaS。CI に組み込める |
| **Percy** | BrowserStack 系の VRT SaaS |
| **BackstopJS** | ヘッドレスブラウザでシナリオベースの VRT |
| **Playwright** のスクリーンショット比較 | テストコード内でスクリーンショットを取得・比較 |

どれも素晴らしいツールですが、自分の状況には合いませんでした：

- **Storybook がない** → Chromatic は使えない
- **テストコードを書く余裕がない** → Playwright のスクリーンショット比較やBackstopJS はシナリオを書く必要がある
- **SaaS の導入には承認が必要** → Percy や Chromatic は契約が必要
- **今すぐ、手軽に、ローカルで使いたい** → 大掛かりなセットアップは避けたい

ほしかったのは、**URL を2つ入れてボタンを押すだけで差分がわかるツール** でした。

## Twin の特徴

### 1. URL を入れるだけで始められる

Storybook も、テストコードも、CI の設定もいりません。

左に本番環境（または main ブランチの localhost）、右に開発環境（feature ブランチの localhost）の URL を入れるだけ。

### 2. 操作が同期される

Twin の最大の特徴は **Sync Mode** です。左画面での操作が右画面に自動で反映されます。

- スクロール（垂直・水平）
- マウスクリック
- キーボード入力
- フォーム入力（日本語 IME 対応）
- ページ遷移

これにより、「同じ操作をした結果」のスクリーンショットを正確に撮影できます。

### 3. デバイスプリセット

ワンクリックでビューサイズを切り替えられます。

- iPhone SE（375×667）
- iPhone 14 Pro（393×852）
- iPad（768×1024）
- Desktop（1280×800）
- Full HD（1920×1080）

レスポンシブ対応のチェックも簡単です。

### 4. reg-cli による差分検出

画像比較には [reg-cli](https://github.com/reg-viz/reg-cli) を使っています。reg-cli は、ピクセル単位で画像を比較し、差分を視覚的にハイライトしてくれるツールです。

Twin では Capture ボタンを押すと：

1. 左右それぞれのスクリーンショットを撮影
2. reg-cli で比較
3. HTML レポートを生成

レポートでは透明度スライダー、スワイプ比較、差分ハイライトなどリッチな UI で差分を確認できます。

### 5. 閾値の調整

ピクセル単位の厳密な比較だと、フォントレンダリングの微妙な差異などでノイズが出ることがあります。設定モーダルから **Matching Threshold** と **Threshold Rate** を調整することで、許容範囲を設定できます。

## 技術スタック

```
Electron (Chromium + Node.js)
├── Main Process
│   ├── BrowserWindow / WebContentsView（左右2画面）
│   ├── IPC Handlers（レンダラーとの通信）
│   ├── Sync Manager（操作同期ロジック）
│   ├── Screenshot（capturePage API）
│   ├── reg-cli Runner（差分検出）
│   └── electron-store（設定永続化）
└── Renderer Process
    ├── UI Controls（ツールバー・モーダル）
    ├── Sync Toggle
    └── Device Presets
```

### なぜ Electron か

「ブラウザ拡張でいいのでは？」と思われるかもしれません。Electron を選んだ理由：

- **WebContentsView** で2つの独立した Web ページを同時にレンダリングできる
- `capturePage()` API でスクリーンショットを簡単に撮影できる
- ファイルシステムへの自由なアクセス（スナップショットの保存・管理）
- reg-cli を Node.js の子プロセスとして直接実行できる
- クロスプラットフォーム（macOS / Windows）

ブラウザ拡張では iframe の制限や CORS の問題があり、自由度が足りませんでした。

## 使い方

### インストール

```bash
git clone https://github.com/negi1232/Twin.git
cd Twin
npm install
npm start
```

### 基本フロー

1. **Expected URL**（左）に比較元の URL を入力
2. **Actual URL**（右）に比較先の URL を入力
3. **Sync** を ON にして、ページを操作（スクロール、フォーム入力など）
4. 確認したい状態になったら **Capture** ボタンをクリック
5. ステータスバーに結果が表示される（Passed / Failed / New / Deleted）
6. **Report** ボタンで詳細な差分レポートを確認

### よくある使い方

**リファクタリングの検証:**
```
左: http://localhost:3000  （main ブランチ）
右: http://localhost:3001  （feature ブランチ）
```

**本番 vs ステージング:**
```
左: https://example.com          （本番）
右: https://staging.example.com  （ステージング）
```

## 開発で工夫したこと

### 操作同期の難しさ

左画面の操作を右画面に同期させるのは、思ったより難しいです。

特に **日本語入力（IME）** の同期は厄介でした。IME の変換中はキーイベントだけでは正しく同期できません。Twin では `compositionend` イベントと値ベースの同期を組み合わせて、変換確定後の値を正確に反映するようにしています。

### テストカバレッジ

Twin は Jest と Playwright でテストしています。カバレッジの閾値は厳しめに設定しています：

| メトリクス | 閾値 |
|---|---|
| Statements | 95% |
| Branches | 85% |
| Functions | 85% |
| Lines | 95% |

VRT ツール自身のコード品質が低かったら本末転倒ですからね。

## まとめ

「UIを変えずに機能を変えたい。でも VRT がない。」

この課題に対する自分なりの答えが Twin です。

- テストコードを書かなくていい
- SaaS の契約もいらない
- URL を2つ入れてボタンを押すだけ

「VRT をやりたいけど、導入のハードルが高い」と感じている方の選択肢のひとつになれば幸いです。

リポジトリはこちらです。Issue や PR も歓迎しています。

https://github.com/negi1232/Twin

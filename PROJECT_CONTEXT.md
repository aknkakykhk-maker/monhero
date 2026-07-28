# プロジェクトコンテキスト

新しいチャットや開発者が、モンスターヒーローの目的と技術的な前提を短時間で把握するための文書です。
作業手順は [`DEVELOPMENT.md`](DEVELOPMENT.md)、既知の課題は [`KNOWN_ISSUES.md`](KNOWN_ISSUES.md) を参照してください。

## プロジェクト概要

| 項目 | 内容 |
| --- | --- |
| 名称 | モンスターヒーロー（モンヒロ） |
| 種別 | モンスターと絆を深めながら戦う、ブラウザ向けカードバトルゲーム |
| 主対象 | スマートフォン、縦画面、タッチ操作 |
| 配信方式 | 静的サイト / PWA、GitHub Pages |
| 本番 URL | <https://aknkakykhk-maker.github.io/monhero/> |
| UI | React / ReactDOM、JSX |
| 開発言語 | JavaScript、JSX、HTML、CSS |
| ビルド | Babel による JSX の事前変換（`tools/build.js`） |

## ゲームの文脈

- モンスター、技・ガード・カード、ブリーダー、マーケット、強化、融合、ランキングなどで構成される。
- 戦闘は WAVE と難易度を持ち、BGM/SE、勝利演出、スコア送信などが連動する。
- モンスターとの絆、育成結果、ランキングなど、継続プレイのデータを扱うため互換性を重視する。
- 詳細な挙動はコードとデータが現行仕様の正本であり、この文書から推測して変更しない。

## アーキテクチャ

ゲーム本体はサーバー側ビルドを必要としない静的サイトです。React / ReactDOM はリポジトリ内に同梱され、
開発用 JSX は Babel で配信用 JavaScript に変換されます。Tailwind は現在 CDN から実行時に読み込まれます。
BGM は必要な画面で読み込み、SE の一部は Tone.js で生成します。

```text
利用者のブラウザ
  └─ monster-hero/index.html
       ├─ vendor/                 React / ReactDOM
       ├─ data/*.js               ゲーム定義・画像参照・更新履歴
       ├─ game-system.compiled.js 配信用ゲームロジック（生成物）
       ├─ audio/                   BGM
       └─ local/remote services    保存データ・ランキング等

開発時
  monster-hero/src/game-system.jsx
       └─ node tools/build.js
            └─ monster-hero/game-system.compiled.js
```

## ディレクトリ構成

```text
./
├─ index.html                         複数アプリへのハブ
├─ CLAUDE.md                          Claude 固有の会話・公開運用
├─ DEVELOPMENT.md                     AI 共通の開発ルール
├─ PROJECT_CONTEXT.md                 本文書（概要・構成）
├─ KNOWN_ISSUES.md                    未解決事項と技術的負債
├─ PROMPT_TEMPLATE.md                 作業依頼テンプレート
├─ START_NEW_CODEX_CHAT.md            Codex 新規チャット開始手順
├─ monster-hero/
│  ├─ index.html                      配信エントリ
│  ├─ src/game-system.jsx             ゲーム本体の編集元
│  ├─ game-system.compiled.js         自動生成される配信用コード
│  ├─ data/                           ゲーム定義、画像、更新履歴
│  ├─ audio/                          BGM
│  ├─ vendor/                         配信用ライブラリ
│  └─ manifest.json / version.json    PWA・リリース情報
├─ tools/                              ビルド・自動検証ツール
└─ docs/                               補助資料
```

## 重要な判断基準

1. **モバイル優先:** 縦画面、タッチ、狭い表示領域、端末性能、モバイル回線を優先する。
2. **データ保護:** 保存済みの育成・進行データを壊す変更を避け、変更時は移行方法を設計する。
3. **起動性能:** 巨大画像や音声を初回表示へ不用意に追加せず、遅延読み込みを維持する。
4. **音声制約:** iOS などのユーザー操作前の自動再生制限を前提にする。
5. **生成物の同期:** JSX と配信用 JavaScript の差異を残さない。
6. **検証可能性:** 修正に対応する `tools/` のチェックを利用し、必要なら回帰チェックを追加する。

## 情報の正本

| 情報 | 正本 |
| --- | --- |
| AI 共通の開発・検証・Git 手順 | `DEVELOPMENT.md` |
| プロジェクト概要・構成 | `PROJECT_CONTEXT.md` |
| 未解決事項・回避策 | `KNOWN_ISSUES.md` |
| 検証スクリプトの詳細 | `tools/README.md` |
| Claude 固有の会話・公開フロー | `CLAUDE.md` |
| 現行ゲーム仕様 | `monster-hero/src/game-system.jsx` と `monster-hero/data/` |
| 利用者向け更新履歴 | `monster-hero/data/changelog.js` |

## 更新ルール

構成、配信方式、対象端末、主要機能が変わった場合は、実装と同じ PR でこの文書を更新してください。
将来構想は現状と混ぜず、「検討中」と明記するか GitHub Issue で管理します。

```markdown
### コンテキスト追記候補

- 変更日: YYYY-MM-DD
- 対象: <!-- 機能 / 構成 / 配信 -->
- 変更前: <!-- 以前の前提 -->
- 変更後: <!-- 新しい事実 -->
- 関連 Issue / PR: #番号
```

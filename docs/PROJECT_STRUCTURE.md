# プロジェクト構造設計書

## 1. 全体像

サーバーアプリを持たない静的ブラウザゲームである。開発元JSXをNode/Babelで事前変換し、GitHub PagesからHTML・JS・画像・音声を配信する。ゲーム実行時の外部依存はTailwind CDN、Tone.jsの動的読込、Supabaseランキングである。React / ReactDOMはリポジトリに同梱する。

```text
ブラウザ
  monster-hero/index.html
    ├─ vendor/react*.js
    ├─ Tailwind CDN
    ├─ data/images/*.js
    ├─ data/{ally-monsters,breeder,enemy-monsters,skills,changelog}.js
    └─ game-system.compiled.js
          ├─ localStorage / window.storage
          ├─ audio/*.mp3 + Tone.js生成SE
          └─ Supabase RESTランキング

開発
  monster-hero/src/game-system.jsx
    └─ node tools/build.js
         └─ monster-hero/game-system.compiled.js
```

## 2. リポジトリ直下

| パス | 役割 |
| --- | --- |
| `index.html` | LF Appsハブ。ゲームへリンクし、独自のversion更新通知を持つ |
| `CLAUDE.md` | Claude向け会話・コミット・公開運用 |
| `DEVELOPMENT.md` | AI共通の開発、検証、出荷手順 |
| `PROJECT_CONTEXT.md` | 短いプロジェクト概要と正本案内 |
| `KNOWN_ISSUES.md` | 確認済みの未解決課題 |
| `PROMPT_TEMPLATE.md` | 作業依頼テンプレート |
| `START_NEW_CODEX_CHAT.md` | Codexチャット開始用文面 |
| `version.json` | ハブのbuild日時 |
| `docs/` | 設計・補助資料。本書群は現行コードの理解用 |
| `tools/` | ビルド、静的検査、実ブラウザ回帰、画像解析 |

## 3. `monster-hero/`

| パス | 所有する責務 | 編集規則 |
| --- | --- | --- |
| `index.html` | PWAメタ情報、safe area、依存読込順、本体再試行 | 起動経路変更時のみ編集 |
| `src/game-system.jsx` | React UI、ゲームロジック、音声、保存、ランキング、染色 | ゲーム本体の編集元 |
| `game-system.compiled.js` | Babel変換済み配信物 | 直接編集せず `node tools/build.js` で生成 |
| `game-v4.html` | 旧URLから `index.html` へのリダイレクト | 互換入口として維持 |
| `manifest.json` | PWA名、start URL、縦画面、アイコン | PWA仕様変更時に編集 |
| `version.json` | ゲームbuild日時 | `node tools/stamp-version.js` で更新 |
| `data/ally-monsters.js` | 味方種、通常技名、初期解放種 | モンスター定義の正本 |
| `data/enemy-monsters.js` | 敵基礎値、技名、WAVE順 | 敵定義の正本 |
| `data/skills.js` | 通常技・ガード・距離技段階、カード色 | 共通カード定義の正本 |
| `data/breeder.js` | 教えカード、効果段階、マーケット商品、関連画像 | ブリーダー系データの正本 |
| `data/changelog.js` | 利用者向け更新・不具合履歴 | 機能出荷時に先頭へ追記 |
| `data/images/images-ally.js` | 味方の画像のパス表 | 実体は `monster-hero/images/monsters` ほか。通常ロジック変更で触らない |
| `data/images/images-enemy.js` | 敵の画像のパス表 | 実体は `monster-hero/images/enemies`。同上 |
| `audio/` | 画面別BGM、勝利ジングル | `preload='none'` で遅延読込 |
| `vendor/` | React 18 / ReactDOM 18 production UMD | バージョン更新時のみ差替え |
| `icons/` | favicon、Apple touch、PWAアイコン | manifest/HTML参照と同期 |

データファイルはES moduleではなく、HTMLのclassic scriptとして順番に読み、トップレベル定数を本体から参照する。本体もexportを持たない単一ファイルで、最後に `ReactDOM.createRoot` して描画する。

## 4. 本体ソース内の責務配置

`game-system.jsx` は約6,750行の単一ファイルで、概ね次の順序で並ぶ。

1. 内蔵SVGアイコン、待機、build日時、経験値曲線。
2. `Audio_`（BGM、ジングル、Tone.js SE、モバイル音声解除）。
3. 染色色定義、画像解析、再着色、画像・色選択コンポーネント。
4. 距離適性、難易度、保存、Supabase、汎用リザルト部品。
5. `MonsterHeroGame` の全state、ランキング、BGMマッピング、起動、保存読込。
6. マーケット、編成、個体育成・融合、報酬。
7. カード操作、ダメージ、敵ターン、プレイヤーターン、デッキ、WAVE進行。
8. 各 `gameState` のJSXとモーダル。
9. CSS文字列注入、React root作成、HTMLローディング非表示。

コンポーネント分割やモジュールexportはない。検査ツールはBabel変換後のコードへ必要な値のexportを追記し、VMスタブまたはPlaywrightで検証する。

## 5. ツール構造

- **生成・整合:** `build.js`, `check-syntax.js`, `stamp-version.js`。
- **主要回帰:** `feature-check.js`, `battle-check.js`, `boot-check.js`, `ranking-check.js`, `ranking-finish-check.js`, `difficulty-item-check.js`, `bulk-enhance-check.js`。
- **音声:** `bgm-check.js`, `title-bgm-check.js`, `tap-sound-trace.js`。
- **画像・染色:** `harness.js`, `dye-report.js`, `region-map.js`, `grid-overlay.js`, `make-face-icons.js`, `face-render-check.js`, `image-report.js`, `extract-images.js`, `image-asset-check.js`。
- **配信・性能:** `serve.py`, `smoke.js`, `perf-check.js`。

Node依存は `tools/package.json` / `package-lock.json` に閉じ、ゲーム配信物へバンドルしない。ブラウザ検査はリポジトリルートを `python3 tools/serve.py` でポート8899に配信する前提である。

## 6. 変更フローと境界

1. ルール文書と関連コード・データを確認する。
2. 本体は `src/game-system.jsx`、定義は対応する `data/*.js` を編集する。
3. 本体変更時は `node tools/build.js` で生成物を同期する。
4. `node tools/check-syntax.js` と `node tools/build.js --check`、変更領域の個別検査を実行する。
5. 機能公開時だけversionとchangelogを更新する。文書だけなら更新しない。

責務境界上の注意:

- `traitDesc` / `effectDesc` は説明であり、効果実装は本体にも存在する。
- `game-system.compiled.js` はレビュー対象になる生成物だが編集元ではない。
- 画像(`monster-hero/images/`)と音声は通信・差分コストが大きく、不要な移動や再エンコードをしない。
- Tailwindは実行時CDN生成のため、動的クラスだけに重要色を依存させない。
- ランキング以外のゲーム進行は端末保存。ランキングのサーバースキーマ管理ファイル、CI設定、service workerはリポジトリ内に**未確認**。

## 7. 文書間の正本

- 開発手順: `DEVELOPMENT.md`
- Claude固有運用: `CLAUDE.md`
- 概要: `PROJECT_CONTEXT.md`
- 未解決事項: `KNOWN_ISSUES.md`
- 現行仕様: `monster-hero/src/game-system.jsx` と `monster-hero/data/`
- 本書群: 現行仕様への案内と解析結果。実装と食い違う場合はコードを確認し、同じ変更で文書を更新する。


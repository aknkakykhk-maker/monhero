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

文書がどこにあるか分からなくならないよう、**ルート直下に置く `.md` は4つだけ**と決めている。
`AGENTS.md`（Codex）と `CLAUDE.md`（Claude）はツールが読む場所が固定されているためルートに残し、
残りはすべて `docs/` 以下へ入れる。

| パス | 役割 |
| --- | --- |
| `index.html` | `monster-hero/` へ転送するだけの入口 |
| `version.json` | 入口ページのbuild日時 |
| `README.md` | リポジトリの入口。主なフォルダの案内 |
| `AGENTS.md` | AI共通の作業ルール（Codexが起動時に読む） |
| `CLAUDE.md` | Claude向け会話・コミット・公開運用 |
| `DEVELOPMENT.md` | AI共通の開発、検証、出荷手順 |
| `monster-hero/` | 公開ゲーム本体。**ここに置いたものはすべて配信される** |
| `tools/` | ビルド、静的検査、実ブラウザ回帰、画像解析。配信しない画像も `tools/art-sources/` に置く |
| `docs/` | 仕様・SQL・調査記録。案内は `docs/README.md` |
| `supabase/migrations/` | 再現可能なDB構造変更の正本 |
| `.github/workflows/compiled-check.yml` | 生成物の一致検査 → 必須検査 → GitHub Pagesへのデプロイ |

### `docs/` の中

| パス | 役割 |
| --- | --- |
| `docs/README.md` | どこに何があるかの案内 |
| `docs/PROJECT_CONTEXT.md` | 短いプロジェクト概要と正本案内 |
| `docs/PROJECT_STRUCTURE.md` | 本書。フォルダ構成の詳細 |
| `docs/KNOWN_ISSUES.md` | 確認済みの未解決課題 |
| `docs/spec/` | 現行のゲーム仕様（バトル、モンスター、セーブデータ、UI規則） |
| `docs/sql/rankings/` `docs/sql/bond-levels/` `docs/sql/run-stats/` | Supabaseへ流すSQLと、iPhoneからの実行手順 |
| `docs/history/` | 過去の調査・移行の記録（当時の判断を残すためのもの） |
| `docs/codex/` | Codex用のチャット開始手順・作業依頼テンプレート |
| `docs/references/` | 参考資料（制作ルールの図、試作HTML） |
| `docs/archive/` | 本番で実行済みの単発SQL。**再実行しない** |

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
| `data/assistants.js` | 助手（みゅあ・きき）の定義、場面別セリフ、仲良し度 | 助手データの正本 |
| `data/help.js` | プレイヤー向けヘルプ本文 | 機能追加・変更時に必ず更新（`CLAUDE.md` ⑤） |
| `data/images/images-ally.js` | 味方の画像のパス表 | 実体は `monster-hero/images/monsters` ほか。通常ロジック変更で触らない |
| `data/images/images-enemy.js` | 敵の画像のパス表 | 実体は `monster-hero/images/enemies`。同上 |
| `images/` | ゲームが実際に読む画像だけ | 検査用の見本・差し替え前の原本は置かない（`tools/art-sources/` へ） |
| `audio/` | 画面別BGM、勝利ジングル | `preload='none'` で遅延読込 |
| `vendor/` | React 18 / ReactDOM 18 production UMD | バージョン更新時のみ差替え |
| `icons/` | favicon、Apple touch、PWAアイコン | manifest/HTML参照と同期 |

`monster-hero/` の下は**そのまま GitHub Pages で配信される**。ゲームが一度も読まない
ファイルをここへ置くと、閲覧できてしまううえ `tools/image-asset-check.js` の
「使われていない画像が残っていない」検査に例外を足すことになり、本当の消し忘れを
見逃す原因になる。配信しない画像は `tools/art-sources/` に置く。

データファイルはES moduleではなく、HTMLのclassic scriptとして順番に読み、トップレベル定数を本体から参照する。本体もexportを持たない単一ファイルで、最後に `ReactDOM.createRoot` して描画する。

## 4. 本体ソース内の責務配置

`game-system.jsx` は16,000行を超える単一ファイルで、概ね次の順序で並ぶ。

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

`tools/` は162本ある。置き場所の決め方は2つだけ。

- **`tools/` 直下(21本)** … `CLAUDE.md` の必須手順と CI ワークフローが名指しする定番と、
  その裏方(`build.js` / `harness.js` / `stamp-*.js`)。**ここは動かさない。**
  動かすと `CLAUDE.md` と `.github/workflows/compiled-check.yml` の書き換えが必要になり、
  CI は1つでも落ちるとデプロイを黙って飛ばすため、事故がいちばん起きやすい。
- **`tools/<分類>/`(141本)** … 場面ごとの検査。`boot` `battle` `mode` `run` `masu`
  `monster` `ranking` `assistant` `audio` `image` `browser` の11フォルダ。

分類フォルダのスクリプトは1つ下の階層にあるので、`__dirname` の代わりに
`TOOLS_DIR`(= `tools/` 直下)を使い、共通ヘルパーは `require('../harness')` で読む。
何がどれかは [`tools/README.md`](../tools/README.md) の一覧を正本とする。

- **生成・整合:** `build.js`, `harness.js`, `check-syntax.js`, `stamp-version.js`, `stamp-boot-sizes.js`。
- **CIが必ず通す6本:** `build.js --check`, `compiled-runtime-check.js`, `check-syntax.js`, `undefined-reference-check.js`, `boot-flow-check.js`, `update-notice-check.js`。ここが1つでも落ちるとデプロイが黙って飛ばされる。
- **主要回帰:** `browser/feature-check.js`, `battle/battle-check.js`, `boot/boot-check.js`, `ranking/ranking-check.js`, `run/ranking-finish-check.js`, `mode/difficulty-item-check.js`, `masu/bulk-enhance-check.js`。
- **音声:** `audio/bgm-check.js`, `audio/title-bgm-check.js`, `audio/tap-sound-trace.js`。
- **画像・染色:** `image/dye-report.js`, `image/region-map.js`, `image/grid-overlay.js`, `image/make-face-icons.js`, `image/face-render-check.js`, `image/image-report.js`, 直下の `image-asset-check.js`。
- **配信・性能:** `serve.py`, `browser/smoke.js`, `browser/perf-check.js`。
- **配信しない素材:** `art-sources/monsters/`（顔アイコン用の高解像度原本）、`art-sources/dye-masks/`（染色の正解見本）。
- **出力先:** `tools/out/` は検査が書き出すPNG等の置き場で、`tools/.gitignore` によりGit管理外。

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
- ランキング以外のゲーム進行は端末保存。ランキングのサーバースキーマは `supabase/migrations/` と `docs/sql/` が正本で、CI設定は `.github/workflows/compiled-check.yml`。service workerはリポジトリ内に無い。

## 7. 文書間の正本

- 開発手順: `DEVELOPMENT.md`
- Claude固有運用: `CLAUDE.md`
- 概要: `docs/PROJECT_CONTEXT.md`
- 未解決事項: `docs/KNOWN_ISSUES.md`
- 検証スクリプト: `tools/README.md`
- 現行仕様: `monster-hero/src/game-system.jsx` と `monster-hero/data/`
- 本書群: 現行仕様への案内と解析結果。実装と食い違う場合はコードを確認し、同じ変更で文書を更新する。


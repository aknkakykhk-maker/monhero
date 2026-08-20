# モンスターヒーロー

スマートフォン向けカードバトルゲーム「モンスターヒーロー」のソースリポジトリです。
GitHub Pages で配信する静的サイトで、開発元の JSX を Babel で事前変換しています。

作業を始める前に、共通の開発・検証手順である [`DEVELOPMENT.md`](DEVELOPMENT.md) と、
プロジェクトの前提をまとめた [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) を確認してください。
Claude 固有の運用ルールは [`CLAUDE.md`](CLAUDE.md) にあります。

## 主なフォルダ

| パス | 役割 |
| --- | --- |
| [`monster-hero/`](monster-hero/) | 公開ゲーム本体。`src/game-system.jsx` が編集元、`game-system.compiled.js` が配信用生成物です。`data/`、`audio/`、`icons/`、`images/`、`vendor/` も公開時に参照されます。**ここに置いたものはすべて配信されます。** |
| [`tools/`](tools/) | ビルド、構文確認、ブラウザテスト、画像検証などの開発用ツールです。実行方法は [`tools/README.md`](tools/README.md) を参照してください。配信しない原本・見本画像は [`tools/art-sources/`](tools/art-sources/) に置きます。 |
| [`docs/`](docs/) | ゲーム仕様、Supabase の SQL と手順、過去の調査記録です。案内は [`docs/README.md`](docs/README.md) にあります。 |
| [`supabase/migrations/`](supabase/migrations/) | 再現可能なデータベース構造変更の正本です。単発の本番データ操作 SQL とは区別します。 |

ルート直下に置く文書は、README・[`AGENTS.md`](AGENTS.md)・[`CLAUDE.md`](CLAUDE.md)・
[`DEVELOPMENT.md`](DEVELOPMENT.md) の4つだけです(前の2つはツールが読む場所が決まっているため)。
それ以外の文書は `docs/` 以下にまとめています。

## ビルドと基本確認

リポジトリルートから実行します。

```bash
node tools/check-syntax.js
node tools/build.js --check
```

ゲーム本体を変更した場合は `node tools/build.js` で配信用生成物を更新してから、関連する
自動チェックを実行してください。依存関係と全チェックの説明は [`tools/README.md`](tools/README.md) にあります。

## ファイル整理の原則

- `monster-hero/index.html` やコードから静的・動的に参照されるゲーム資産は移動・削除しません。
- 現行のビルド、テスト、デプロイ、再発防止に使うファイルは残します。
- 実行済みの単発 SQL や完了済みの調査資料は、再実行防止の説明とともに `docs/archive/` へ移します。
- 参照有無だけで用途を断定できないファイルは削除しません。

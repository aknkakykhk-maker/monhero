# モンスター部(図鑑・絵・染色・新モンスター)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: ズカンくん / 受け持ち: モンスターの絵と染色マスク・図鑑・新しい味方モンスターの追加

## 最初に打つもの

```
node tools/ctx.js decisions monster     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/15-dye-and-art.jsx`
- `monster-hero/src/parts/57-screen-monster-dex.jsx`
- `monster-hero/src/parts/74-screen-monster-check-debug.jsx`
- `monster-hero/data/ally-monsters.js`
- `monster-hero/data/lineages.js`
- `monster-hero/data/images/*`
- `monster-hero/images/*`
- `tools/monster/*`
- `tools/image/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`MonsterDexScreen` / `MonsterDexDetailScreen` / `DyeTabbedSheet`

## 回す検査

- node tools/build.js のあと node tools/image-asset-check.js(絵を足した・差し替えたとき)
- node tools/run-checks.js --changed(tools/monster・tools/image から選ばれる)
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 新しい味方モンスターは monster-add スキルを開く(数字は聞いてから決める)
- 受け取った画像はそのまま入れない(軽くする)。絵はパスだけ書く
- 顔アイコンは1案で決めず、A〜D の案を1枚にして窓口へ

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`monster-hero/images/CLAUDE.md`](../../monster-hero/images/CLAUDE.md)
- [`docs/rules/ASSETS.md`](../../docs/rules/ASSETS.md)
- [`docs/spec/MONSTER_SYSTEM.md`](../../docs/spec/MONSTER_SYSTEM.md)

## 仕事の板・残りの仕事

- [`docs/progress/monster-board.md`](../../docs/progress/monster-board.md)
- [`docs/progress/zukan-backlog.md`](../../docs/progress/zukan-backlog.md)

会話が長くなったら: `node tools/ctx.js handoff monster --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))

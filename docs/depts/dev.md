# 開発部(HOME・マーケット・育成・設定・ヘルプ・土台)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: クラフトくん / 受け持ち: HOME・マーケット・マスモンの育成・ミッション・プロフィール・設定・ヘルプと更新履歴の仕組み・保存と通信の土台・デバッグ・検査の道具・速さ

## 最初に打つもの

```
node tools/ctx.js decisions dev     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/10-core.jsx`
- `monster-hero/src/parts/11-masu-progression.jsx`
- `monster-hero/src/parts/12-training.jsx`
- `monster-hero/src/parts/16-*`
- `monster-hero/src/parts/17-*`
- `monster-hero/src/parts/18-*`
- `monster-hero/src/parts/20-market-notices-help.jsx`
- `monster-hero/src/parts/23-rpg-debug.jsx`
- `monster-hero/src/parts/25-*`
- `monster-hero/src/parts/26-supabase.jsx`
- `monster-hero/src/parts/27-result-widgets.jsx`
- `monster-hero/src/parts/31-debug-ui.jsx`
- `monster-hero/src/parts/40-*`
- `monster-hero/src/parts/41-*`
- `monster-hero/src/parts/42-*`
- `monster-hero/src/parts/43-*`
- `monster-hero/src/parts/44-*`
- `monster-hero/src/parts/50-*`
- `monster-hero/src/parts/51-*`
- `monster-hero/src/parts/52-screen-missions.jsx`
- `monster-hero/src/parts/53-*`
- `monster-hero/src/parts/54-*`
- `monster-hero/src/parts/55-*`
- `monster-hero/src/parts/56-quick-guide.jsx`
- `monster-hero/src/parts/56-screen-profile.jsx`
- `monster-hero/src/parts/56-monhero-success-*.jsx`
- `monster-hero/src/parts/56-monsuc-*.jsx`
- `monster-hero/src/parts/59-*`
- `monster-hero/src/parts/60-app.jsx`(2.3MB・開かない)
- `monster-hero/src/parts/61-*`
- `monster-hero/src/parts/62-*`
- `monster-hero/src/parts/63-*`
- `monster-hero/src/parts/64-*`
- `monster-hero/src/parts/65-*`
- `monster-hero/src/parts/66-*`
- `monster-hero/src/parts/69-screen-home.jsx`
- `monster-hero/src/parts/70-bootstrap.jsx`(0.6MB・開かない)
- `monster-hero/src/parts/72-*`
- `monster-hero/src/parts/76-*`
- `monster-hero/src/parts/81-*`
- `monster-hero/data/breeder.js`
- `monster-hero/data/help.js`(0.8MB・開かない)
- `monster-hero/data/changelog.js`(1.7MB・開かない)
- `monster-hero/data/mhsave-backup.js`
- `tools/boot/*`
- `tools/market/*`
- `tools/masu/*`
- `tools/ui/*`
- `tools/ranking/*`
- `tools/changelog/*`
- `tools/run/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`HomeScreen` / `MarketModal` / `MarketPurchaseSheet`

## 回す検査

- node tools/run-checks.js --changed
- HOME の配置を触ったら node tools/home-layout-check.js
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- P/60-app.jsx(2MB超)・P/70-bootstrap.jsx は全部の部が通る場所。開かずに node tools/ctx.js read <名前> で切り出す。ほかの部の場所を触るときは先に窓口へ
- P/25-storage.jsx・P/26-supabase.jsx は保存データとランキングの土台。変えたら ミハリ確認が要る
- はじめての人だけに書く印(!wasOnboarded の分岐・finishOnboarding)を足したら、復元で片づける一覧 MH_FIRST_TIMER_MARK_KEYS(data/mhsave-backup.js)にも足す。見張り: node tools/boot/restore-first-timer-marks-check.js
- デバッグ専用の変更は更新履歴にもヘルプにも載せない
- モンサクの画面を作る・直す前に docs/reference/line-mf/REF-MAP.md でその画面の行を引き、参考の実物(画像・動画のコマ)を自分の目で見てから作る(要約のメモだけで作らない)

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`docs/spec/SAVE_DATA.md`](../../docs/spec/SAVE_DATA.md)
- [`docs/rules/SAVE_DATA_RULES.md`](../../docs/rules/SAVE_DATA_RULES.md)
- [`docs/rules/BUILD_CHECKS.md`](../../docs/rules/BUILD_CHECKS.md)
- [`docs/spec/UI_RULES.md`](../../docs/spec/UI_RULES.md)
- [`docs/spec/SOUL_RANK_SYSTEM.md`](../../docs/spec/SOUL_RANK_SYSTEM.md)

## 仕事の板・残りの仕事

- [`docs/progress/dev-board.md`](../../docs/progress/dev-board.md)
- [`docs/progress/craft-backlog.md`](../../docs/progress/craft-backlog.md)
- [`docs/progress/tsugihagi-backlog.md`](../../docs/progress/tsugihagi-backlog.md)
- [`docs/progress/speed-backlog.md`](../../docs/progress/speed-backlog.md)

会話が長くなったら: `node tools/ctx.js handoff dev --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))

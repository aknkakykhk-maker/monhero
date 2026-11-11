# ビート部(モンヒロビート)の手引き

<!-- このファイルは tools/team/depts.json から作っている。直すのは depts.json。作り直し: node tools/team/dept-guide.js --write -->

部長: テンポくん / 受け持ち: モンヒロビート(曲えらび・演奏・判定・マルチ・ランキング・相棒・助手とのセッション)、譜面生成ツール、曲の音源

## 最初に打つもの

```
node tools/ctx.js decisions beat     社長の決めごと(進め方 + この部に関わる行だけ)
node tools/ctx.js brief               いまの状態
```

## 受け持つファイル

- `monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx`
- `monster-hero/src/parts/14-audio.jsx`
- `monster-hero/src/parts/28-rhythm-*`
- `monster-hero/src/parts/29-rhythm-*`
- `monster-hero/src/parts/30-rhythm-*`
- `monster-hero/src/parts/33-rhythm-*`
- `monster-hero/src/parts/39-*`
- `monster-hero/src/parts/58-screen-rhythm.jsx`
- `monster-hero/src/parts/73-screen-rhythm-history.jsx`
- `monster-hero/src/parts/77-screen-rhythm-multi.jsx`
- `monster-hero/src/parts/80-screen-rhythm-*`
- `monster-hero/data/rhythm-*`
- `monster-hero/audio/*`
- `tools/mode/*`
- `tools/audio/*`
- `supabase/functions/rhythm-anomaly-report/*`

## 入口の関数

本体だけ読む: `node tools/ctx.js read <名前>` / 使っている場所: `node tools/ctx.js refs <名前>`

`RhythmSongSelectScreen` / `RhythmMultiScreen` / `RhythmRankingScreen` / `RhythmInfoScreen`

## 回す検査

- node tools/run-checks.js --changed(tools/mode・tools/audio から選ばれる)
- 新曲: rhythm-song-add スキルの検査の並び
- 公開の前: `node tools/ctx.js gate`(ミハリ確認が要るかを機械が判定。`run-checks.js --changed` の最後にも出る)

## 関係する決まり

- 配信中の曲の譜面を作り直さない・既存の解析を作り直さない(CLAUDE.md ⑩-2)。イベント対象曲の譜面は開催中に触らない
- 新曲は rhythm-song-add スキルを最後まで通す。聞き返すのは難易度だけ
- D/rhythm-mode.js(1.3MB)・docs/spec/RHYTHM_MODE.md(0.5MB)・tools/mode/authoring/*.json は開かない。node tools/ctx.js doc / read で切り出す
- 受け取った音源はそのまま入れない(音量をそろえる)

## 資料(要る節だけ `node tools/ctx.js doc <ファイル> <見出し>`)

- [`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md)
- [`monster-hero/data/CLAUDE.md`](../../monster-hero/data/CLAUDE.md)
- [`monster-hero/audio/CLAUDE.md`](../../monster-hero/audio/CLAUDE.md)
- [`docs/rules/RHYTHM_SONG.md`](../../docs/rules/RHYTHM_SONG.md)
- [`docs/rules/RHYTHM_EVENT.md`](../../docs/rules/RHYTHM_EVENT.md)
- [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)
- [`docs/spec/RHYTHM_EVENT_PLAYBOOK.md`](../../docs/spec/RHYTHM_EVENT_PLAYBOOK.md)
- [`docs/spec/RHYTHM_MULTI.md`](../../docs/spec/RHYTHM_MULTI.md)
- [`docs/spec/RHYTHM_RANKING.md`](../../docs/spec/RHYTHM_RANKING.md)

## 仕事の板・残りの仕事

- [`docs/progress/beat-board.md`](../../docs/progress/beat-board.md)
- [`docs/progress/beat-backlog.md`](../../docs/progress/beat-backlog.md)

会話が長くなったら: `node tools/ctx.js handoff beat --write`(引き継ぎメモ → 新しい会話。[`SESSION_HANDOFF.md`](../rules/SESSION_HANDOFF.md))

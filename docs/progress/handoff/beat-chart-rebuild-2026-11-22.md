# 引き継ぎメモ: ビート部・Beyond the Same Sky の HELL・MASTER の組み直し(2026-11-22)

次の会話は、CLAUDE.md → `docs/depts/beat.md` → `tools/mode/CLAUDE.md` → このメモ、の順に読んで始める。前の会話の中身は読みに行かない。
台帳は `node tools/ctx.js decisions --grep r1119-096`(追記3つ)。

## 社長の答え(窓口経由・2026-11-22)

- 「あつみゅあはもとのよりヘルがひどいことになってる。音楽にもあってない感じ」。#7187(押さえ中の交差を消すための位置だけの手直し)で、HELL の手の流れが音楽から外れた。
  本番は今のまま。**作り直しを急ぐ**(歌い分けの作り直しを最優先)
- HELL(原曲・short)は**位置の手直しではなく、音楽(歌の拍・言葉の頭・歌い分け・サビの盛り上がり)に合わせて組み直す**。
  交差を消すために位置をずらすのではなく、**歌い分けの手の割り当てで交差がそもそも出ない形**にする。MASTER も同じ考えで
- 写し方: 女声=片側の手・男声=反対の手・2人/ハモり=両手の同時押しやスライド・交互の所は左右の受け渡し。押さえ中の交差0件の決まりは守る。short も同じ区切りで
- 組み直したら、**どの区間をどう作ったかの一覧**と、**#7187 の前・#7187・新しい版の3つを並べた数か所の絵**を `docs/progress/beat/chart-fix-2026-11-22/` に置き、
  最後の発言で窓口へ(社長に見せてから公開する。勝手にマージしない)。Lv. が大きく変わるなら知らせる

## 使えるもの(済み)

- 歌い分けの区間の表: `docs/progress/beat/chart-fix-2026-11-22/vocal-split/parts-table.json`(full 41区間・short 25区間。秒・女声/男声/女声(男声の低い重ね)/2人/間奏・歌詞)。
  作り方は同じフォルダの README。歌詞の札は `lyrics-parts.txt`(社長から・そのまま)
- 声だけの音源は会話の中で作った(audio-separator `UVR-MDX-NET-Voc_FT.onnx`。重みは GitHub のリリースから取れる・`pip install "audio-separator[cpu]" audioread`)。
  言葉の頭(歌の拍)が要るなら、声だけの音源から立ち上がりを取る(既存の解析ファイル `tools/mode/authoring/*-v3-audio.json` は**作り直さない**。読むのはよい)
- 道具: `tools/audio/vocal-split-speaker.py`(声の主で0.5秒ごとに2人へ)・`tools/audio/vocal-parts-table.py`(表を作る)
- #7187 の前の譜面は git の記録にある(#7187 のマージより前の `monster-hero/data/rhythm-mode.js` のマーカー
  `beyond-the-same-sky(-short)-v3-{master,hell}-notes`)。今の本番 = #7187 の版
- 位置だけ裏返す写し方(`rhythm-vocal-hands.js`)は試したが、社長の評価を受けてやめた(譜面に入れていない・道具も消した)

## 組み直しの決まり(tools/mode/CLAUDE.md より)

- 配信中の曲の譜面を変えるのは社長の頼みなので例外として可。記録は消さない。ノーツの数・時刻が変わるならランキング・自己ベストの扱いを窓口に確かめる
  (#7187 は時刻・数を変えずに記録を残した。組み直しは時刻・数が変わりうる)
- HELL は `rhythm-chart-v3-generate.js --difficulty HELL` で骨組み・`rhythm-hell-mix.js`(`source:'audio'`・`precision:true`)で空中。
  手の流れを狙う配置は `flowPlacement:true`。作ったら `rhythm-chart-review.js`、手の決まり(`rhythm-chart-hand-rules-check.js`・8番=押さえ中の交差)・
  `rhythm-overlap-reach-check.js`・`rhythm-released-chart-lock-check.js --update --reason`・Lv.(`rhythm-chart-level.js`・表示を固定するなら `LEVEL_OVERRIDES`)
- 歌い分けを生成器へ渡す口は無い。区間の表から「この区間は右手側・左手側・両手」を生成器の手の割り当てへ渡す口を足すのが筋(生成器の強化は可)

## 同時に済んだこと(別 PR)

- 空中ノーツが横持ちで遅れて上から急に出る件(台帳 r1119-096 追記2): 空中の持ち上げを画面の上端で0にした(`rhythmSkyLiftRatio`)。
  調べと直しは `docs/progress/beat/chart-fix-2026-11-22/note-appear/README.md`。測る道具 `tools/mode/rhythm-note-appear-scan.js`

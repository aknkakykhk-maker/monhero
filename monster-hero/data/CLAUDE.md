# `monster-hero/data/` を触るときの決まり

ルートの [`CLAUDE.md`](../../CLAUDE.md) から、**この場所のファイルを触るときだけ要る決まり**を移したもの
(Claude Code はこのフォルダのファイルを読んだときにこのファイルを読み込む)。決まりの重さはルートと同じ。
移した一覧: [`docs/rules/README.md`](../../docs/rules/README.md)「節の置き場所」。

- 更新履歴(`changelog.js`)・ヘルプ(`help.js`)・助手の告知を書くときは、先に `changelog-help-update` スキルを開く(ルートの ⑤ の本文はスキルにある)
- モンヒロビートの新曲(`rhythm-mode.js` へ譜面を足す)は `rhythm-song-add` スキル。譜面生成ツールの決まりは [`tools/mode/CLAUDE.md`](../../tools/mode/CLAUDE.md)(⑩-2)

### ⑥-4 モンヒロビートのイベントは、決まった手順で開く

**必ず [`docs/spec/RHYTHM_EVENT_PLAYBOOK.md`](../../docs/spec/RHYTHM_EVENT_PLAYBOOK.md) を開いてから始める。**
経緯: [`docs/rules/RHYTHM_EVENT.md`](../../docs/rules/RHYTHM_EVENT.md)

- **足すのは `data/rhythm-event.js` へ1件だけ。** 画面のコードもSQLも触らない。
  順位ごとの個数は共通の決めごとなので、イベントごとに変えない
- **終わりは週の区切り(月曜5:00)に合わせる。** 週間ランキングはイベント中もずっと動いている
- **時刻で出し入れするものに、読み込み時に1回だけ決まる値を使わない**(判定は見るたびに数え直す)
- 開始時刻より前に公開してよい。`visibleFrom` と `notifyFrom` を**同じ時刻にそろえる**
- **イベント対象曲の譜面は開催中に触らない。** 作り直すなら新旧どちらも持ち(`-v3-` と `-v4-`)、
  `RHYTHM_SWITCHING_CHARTS` が `endAt` と**同じ時刻**で選ぶ。`difficulties` は **getter** にし、
  演奏のあいだは固定する(`rhythmChartSwitchHold`)。旧譜面は消さない。
  `node tools/mode/rhythm-chart-switch-check.js` を通す

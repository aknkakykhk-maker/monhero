# `tools/mode/`(譜面生成ツール MHB CHART ENGINE など)を触るときの決まり

ルートの [`CLAUDE.md`](../../CLAUDE.md) から、**この場所のファイルを触るときだけ要る決まり**を移したもの
(Claude Code はこのフォルダのファイルを読んだときにこのファイルを読み込む)。決まりの重さはルートと同じ。
移した一覧: [`docs/rules/README.md`](../../docs/rules/README.md)「節の置き場所」。

- モンヒロビートの新曲を足すときは `rhythm-song-add` スキルを開く(⑥-3 の本文はスキルにある)
- モンヒロビートのイベント対象曲の譜面を入れ替えるときの決まりは [`monster-hero/data/CLAUDE.md`](../../monster-hero/data/CLAUDE.md)(⑥-4)

### ⑩-2 譜面生成ツール(MHB CHART ENGINE)は強化してよいが、既存曲の譜面は変えない

**やってよい**: `tools/mode/rhythm-chart-v3-*.js`(生成器・検査・解析)の強化。難易度ごとの設定を
足す・形の語彙を増やす・解析で拾える音を増やす。それらが**次に曲を足すとき・作り直すときに効く**
状態にしておくこと。

**やってはいけない**: 配信中の曲の譜面を作り直して `monster-hero/data/rhythm-mode.js` へ書き戻す
(`--release`)。既存の解析ファイル(`tools/mode/authoring/*-v3-audio.json`)を作り直す(`--reanalyze`)。
公開中の譜面は `rhythm-released-chart-lock-check.js` が指紋で見張る(CI でも回る)。決まった直しで変えるときだけ
`--update --reason "<理由>"` で控えを更新する。

**作るのは最新リビジョンだけ**(2026-10-12)。生成器などは最新の作り方しか持たず、古い版へ分ける分かれ道は作らない。
古い作り方は git の記録(コミット **c2094ad53**)から取り出す。曲の一覧の `chartRevision` の数字と、既に作った譜面を読む読み方は残す。
作る譜面が変わる強化は `CHART_REVISION_CODE_LATEST` を最新リビジョンの次にし、変更前のワークツリーと出力を突き合わせる。
本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)。呼び名は「MHB CHART ENGINE Rev.30」(「版30」とは書かない)。

**空中のノーツがある譜面(HELL)の Lv.** は、空中を地上と見なした Lv. の1.2倍(2026-10-11 社長「空中あるだけで難易度2割増し」→
10/12 朝「3割増し」→ 同日夕方「マスターの2割増しぐらいをベース難易度に」で2割へ戻した・`rhythm-chart-level.js` の `SKY_LEVEL_FACTOR`)。空中の無い譜面(地上の5難易度・公開中の曲)の Lv. はこれで1つも変わらない。
HELL は `rhythm-hell-mix.js --song <曲> --write` で作る(MASTER を土台に、空と地上が混ざって行き来する形・交差する両手の長押し)。

**手の決まり**(同じ側で地上⇔空中は **150ms 以上**・空中は地上から250ms以上が目安・押さえている帯と同じ側は反対の手が空いているときだけ・
同じ側の押し始めは90ms未満にしない)は `rhythm-chart-hand-rules-check.js` が見張る。**公開中の譜面のノーツを動かす・戻すとき**は
`rhythm-overlap-reach-check.js` と手の決まりの検査も回す(#2808→#2821)。本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)

> ⚠️ 譜面もゲーム本体も変わらない強化は、**更新履歴とヘルプへ載せない**(プレイヤーには何も
> 起きていない)。効くのは次に曲を足したときなので、そのときの曲の告知に含まれる。

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

**空中のノーツがある譜面(HELL)の Lv.** は、空中の難しさ(地上⇔空中の速い切り替え・上下の交差・片手が空中で片手が地上の時間)を1ノーツの重さに足して**測って出す**
(2026-10-13 社長「今後作るものは測る形で。今あるものは変えなくていい」・`rhythm-chart-level.js`)。一律の1.2倍(`SKY_LEVEL_FACTOR`)はやめた。
公開中の HELL 3曲の表示は前の値のまま(`LEVEL_OVERRIDES`)。空中の無い譜面(地上の5難易度・公開中の曲)の Lv. はこれで1つも変わらない。
HELL は `rhythm-hell-mix.js --song <曲> --write` で作る(MASTER を土台に、空と地上が混ざって行き来する形・交差する両手の長押し)。
(2026-10-13〜 参考動画の無い曲は曲の設定に `source:'audio'` を書き、MASTER を土台にせず曲の解析から一から作る。Against My Own Shadow から)

**手の決まり**(同じ側で地上⇔空中は **150ms 以上**・空中は地上から250ms以上が目安・押さえている帯と同じ側は反対の手が空いているときだけ・
同じ側の押し始めは90ms未満にしない)は `rhythm-chart-hand-rules-check.js` が見張る。**公開中の譜面のノーツを動かす・戻すとき**は
`rhythm-overlap-reach-check.js` と手の決まりの検査も回す(#2808→#2821)。本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)
**HELL の交差は上下に分ける**(同じ高さのまま左右が入れ替わる「水平クロス」は作らない・2026-10-13)。同じ検査が HELL で0を見張る

**参考動画がない限り、各難易度は難易度ごとに作る**(2026-10-13 社長の決定)。上の難易度を下の難易度の写し+割増しで作らない。
HELL は `rhythm-chart-v3-generate.js --difficulty HELL` で曲の解析から骨組みを作り、`rhythm-hell-mix.js` の `source:'audio'` で空中を付ける。本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)

> ⚠️ 譜面もゲーム本体も変わらない強化は、**更新履歴とヘルプへ載せない**(プレイヤーには何も
> 起きていない)。効くのは次に曲を足したときなので、そのときの曲の告知に含まれる。

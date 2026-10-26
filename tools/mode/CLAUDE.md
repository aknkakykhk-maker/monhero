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
公開中の譜面は `rhythm-released-chart-lock-check.js` が指紋で見張る(HELL も)。決まった直しで変えるときだけ
`--update --reason "<理由>"` で控えを更新する。

**作るのは最新リビジョンだけ**(2026-10-12)。生成器などは最新の作り方しか持たず、古い版へ分ける分かれ道は作らない。
古い作り方は git の記録(コミット **c2094ad53**)から取り出す。曲の一覧の `chartRevision` の数字と、既に作った譜面を読む読み方は残す。
作る譜面が変わる強化は `CHART_REVISION_CODE_LATEST` を最新リビジョンの次にし、変更前のワークツリーと出力を突き合わせる。
本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)。呼び名は「MHB CHART ENGINE Rev.31」(「版31」とは書かない)。

**HELL の Lv.** は空中の難しさを1ノーツの重さに足して**測って出す**(2026-10-13・`rhythm-chart-level.js`。一律1.2倍はやめた)。
公開中の HELL の表示は公開したときの値のまま(`LEVEL_OVERRIDES`)。空中の無い譜面の Lv. は変わらない。本文: `docs/rules/CHART_ENGINE.md`

**手の決まり**(同じ側で地上⇔空中は **150ms 以上**・空中は地上から250ms以上が目安・押さえている帯と同じ側は反対の手が空いているときだけ・
同じ側の押し始めは90ms未満にしない)は `rhythm-chart-hand-rules-check.js` が見張る。**公開中の譜面のノーツを動かす・戻すとき**は
`rhythm-overlap-reach-check.js` と手の決まりの検査も回す(#2808→#2821)。本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)
**HELL の交差は上下に分ける**(同じ高さのまま左右が入れ替わる「水平クロス」は作らない・2026-10-13)。同じ検査が HELL で0を見張る
**押さえている帯の中にノーツを置かない**(2026-10-13): 同じ高さで重なる・幅1が絡む半レーンの重なりは不可(地上と空中なら同じ位置でもよい)。
HELL と新曲の5難易度の道具が直し、同じ検査が止める(前からある譜面の上限は `rhythm-held-band-existing.json`)

**新曲は `flowPlacement:true`**(手の流れを狙う配置・既定は切・2026-10-21)。本文: `CHART_ENGINE.md`「手の流れを狙う配置」

**参考動画がない限り、各難易度は難易度ごとに作る**(2026-10-13 社長の決定)。上の難易度を下の難易度の写し+割増しで作らない。
HELL は `rhythm-chart-v3-generate.js --difficulty HELL` で曲の解析から骨組みを作り、`rhythm-hell-mix.js` の `source:'audio'` で空中を付ける。本文: [`docs/rules/CHART_ENGINE.md`](../../docs/rules/CHART_ENGINE.md)

> ⚠️ 譜面もゲーム本体も変わらない強化は、**更新履歴とヘルプへ載せない**(プレイヤーには何も
> 起きていない)。効くのは次に曲を足したときなので、そのときの曲の告知に含まれる。

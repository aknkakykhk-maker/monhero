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

生成器を変えたら、**変更前のワークツリーを別に立てて生成結果を突き合わせ、ノーツ数が一致すること
を確かめてから**コミットする。手順: [`docs/rules/SCOPE.md`](../../docs/rules/SCOPE.md)
ノーツ数が動く強化は**譜面の作り方のリビジョン**(`chartRevision`・`tools/mode/rhythm-chart-v3-revision.js`)を
1つ上げてその中へ入れる。書いていない既存曲は Rev.1 のまま、新しく解析した曲だけが最新リビジョンになる。
呼び名は「MHB CHART ENGINE Rev.7」(「版7」とは書かない)。

> ⚠️ 譜面もゲーム本体も変わらない強化は、**更新履歴とヘルプへ載せない**(プレイヤーには何も
> 起きていない)。効くのは次に曲を足したときなので、そのときの曲の告知に含まれる。

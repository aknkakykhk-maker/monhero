// 自動譜面制作V3の「譜面の作り方の版」(chartRevision)。
//
// 【なぜ要るか】(2026-09-24)
// 運用ルール ⑩-2 で「生成器は強化してよいが、既存曲の生成結果(ノーツ数)は変えない」と決めている。
// これまでは「古い解析ファイルに無い項目が入口を閉じる」(bassSustains)ように、
// たまたま閉じられる形の強化しか入れられなかった。拾う音の選び方そのものを良くすると、
// 既存曲のノーツ数も少しずつ動いてしまう。
//
// そこで曲ごとに「どの版の作り方で作るか」を曲の一覧(rhythm-song-registry.json)へ持たせる。
//   ・書いていない曲(= 2026-09-24 までに入った曲)は版1。今までと1音も変わらない
//   ・解析器(rhythm-audio-analyze-v3.js)は、**まだ解析していない曲**を登録するときに最新版を書く
//     (新しく足す曲だけが、自動で新しい作り方になる)
//   ・既存曲を作り直すと決めたときは、その曲へ手で `"chartRevision": <版>` を書く
//   ・試しに別の版で作るだけなら、生成器へ `--chart-revision <版>` を渡す(一覧は書き換えない)
//
// 版の中身(上の版は下の版を全部含む)
//   1 … 2026-09-24 までの作り方
//   2 … フレーズの写し。繰り返しの区切りでは、元の小節と同じ位置の音を拾い、
//        同じレーン(区切りの出現ごとに左右反転)へ置く(docs/spec/RHYTHM_CHART_DESIGN.md 3.1.19)
//        ＋ 押さえているHOLDが端に寄っていてクロス(指の交差)が置けないときは、HOLDを内側へ寄せて置く
'use strict';

const CHART_REVISION_LEGACY=1;
const CHART_REVISION_LATEST=2;

// 曲の一覧の1件から版を読む。無い・壊れている・範囲外なら版1(今までの作り方)。
const chartRevisionOf=entry=>{
  const value=Number(entry&&entry.chartRevision);
  if(!Number.isInteger(value)||value<CHART_REVISION_LEGACY||value>CHART_REVISION_LATEST)return CHART_REVISION_LEGACY;
  return value;
};

// 解析器が曲の一覧へ書くときに付ける版。
//   ・すでに版が書いてある … そのまま(人が決めた版を解析のやり直しで消さない)
//   ・一度でも解析した曲(audioSha256 がある) … 付けない(= 版1。既存曲を黙って新しい作り方にしない)
//   ・まだ解析していない曲(音源のパスだけ手で足した直後など) … 最新版
const chartRevisionForRegistry=previousEntry=>{
  if(previousEntry&&previousEntry.chartRevision!=null)return {chartRevision:previousEntry.chartRevision};
  if(previousEntry&&typeof previousEntry.audioSha256==='string'&&previousEntry.audioSha256)return {};
  return {chartRevision:CHART_REVISION_LATEST};
};

module.exports={CHART_REVISION_LEGACY,CHART_REVISION_LATEST,chartRevisionOf,chartRevisionForRegistry};

// ランキング検査の既存本体をそのまま使い、ランキング報酬名の重複検査だけを
// 「イベント定義ファイル全体」ではなく「ランキング報酬セクション」へ限定する。
// STEP3でイベントP交換所の商品名が同じデータファイルへ追加されたため、
// 旧検査の全体検索では正しい交換所商品までランキング報酬の二重定義と誤検知していた。
const checkerCorePath=require('path').join(__dirname,'rhythm-event-window-check-core.js');
const checkerCore=require('fs').readFileSync(checkerCorePath,'utf8');
const checkerBefore="  &&!/['\"`](勇者の証|超越の実|虹のプシュケー)/.test(eventData));";
const checkerAfter="  &&!/['\"`](勇者の証|超越の実|虹のプシュケー)/.test(eventData.slice(eventData.indexOf('// ===== 報酬(docs/spec/RHYTHM_RANKING.md §9) ====='))));";
if(!checkerCore.includes(checkerBefore)){
  console.error('NG: ランキング報酬名チェックの既存位置を特定できません');
  process.exit(1);
}
// eslint-disable-next-line no-eval
eval(checkerCore.replace(checkerBefore,checkerAfter));

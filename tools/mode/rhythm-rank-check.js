// 音ゲーのスコアランク(暫定値: G→F→E→D→C→B→A→S→SS→M)を確認する。
//
// 難易度ごとの割合(%)ではなく絶対スコアのしきい値で判定する。%基準だとEASYで100%を
// 出してもMASTERで100%を出しても同じ最上位ランクになってしまうが、絶対値にすることで
// EASYの最大60万点はどれだけ極めてもAが上限になり、MASTERの100万点だけがMへ届く。
//
//   node tools/mode/rhythm-rank-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const docs=read('docs/spec/RHYTHM_MODE.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const block=data.match(/const RHYTHM_RANKS = Object\.freeze\(\[[\s\S]*?const rhythmRankForScore = score => \{[\s\S]*?\n\};/)?.[0];
check('ランクのデータ層を抽出できる',!!block);
if(!block){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
const context={};
vm.createContext(context);
vm.runInContext(`${block}\nthis.out={RHYTHM_RANKS,rhythmRankForScore};`,context);
const {RHYTHM_RANKS,rhythmRankForScore}=context.out;

check('ランクは10段階、G→F→E→D→C→B→A→S→SS→Mの並び',
  RHYTHM_RANKS.map(r=>r.id).join(',')==='M,SS,S,A,B,C,D,E,F,G');
check('しきい値は降順で重複が無い',
  RHYTHM_RANKS.every((rank,index)=>index===0||rank.min<RHYTHM_RANKS[index-1].min));
check('最低ランクGのしきい値は0',RHYTHM_RANKS[RHYTHM_RANKS.length-1].min===0);

check('0点はG',rhythmRankForScore(0)==='G');
check('マイナスや壊れた値もGへ落ちる(下振れしない)',
  rhythmRankForScore(-100)==='G'&&rhythmRankForScore(undefined)==='G'&&rhythmRankForScore('x')==='G'&&rhythmRankForScore(null)==='G');
check('100万点(MASTER満点)はM',rhythmRankForScore(1000000)==='M');
check('境界値ちょうどは上のランクに含める(以上判定)',
  rhythmRankForScore(900000)==='M'&&rhythmRankForScore(899999)==='SS'
  &&rhythmRankForScore(800000)==='SS'&&rhythmRankForScore(799999)==='S');

// 難易度が低いほど最大ランクも低いこと(絶対値しきい値による自然な帰結)
const maxScoreByDifficulty={EASY:600000,NORMAL:700000,HARD:800000,EXPERT:900000,MASTER:1000000};
check('EASY満点(60万)の上限ランクはA',rhythmRankForScore(maxScoreByDifficulty.EASY)==='A');
check('NORMAL満点(70万)の上限ランクはS',rhythmRankForScore(maxScoreByDifficulty.NORMAL)==='S');
check('HARD満点(80万)の上限ランクはSS',rhythmRankForScore(maxScoreByDifficulty.HARD)==='SS');
check('EXPERT満点(90万)の上限ランクはM',rhythmRankForScore(maxScoreByDifficulty.EXPERT)==='M');
const order=['EASY','NORMAL','HARD','EXPERT','MASTER'],rankOrder=RHYTHM_RANKS.map(r=>r.id).reverse();
let monotonic=true;
for(let i=1;i<order.length;i++){
  const prevRank=rhythmRankForScore(maxScoreByDifficulty[order[i-1]]),curRank=rhythmRankForScore(maxScoreByDifficulty[order[i]]);
  if(rankOrder.indexOf(curRank)<rankOrder.indexOf(prevRank))monotonic=false;
}
check('難易度が上がるほど、その満点で届く上限ランクも下がらない',monotonic);

// --- 画面側の結線 ---
check('ランク色マップを持つ',
  game.includes('const RHYTHM_RANK_COLORS = Object.freeze({')&&game.includes("G:'text-slate-500'")&&game.includes("M:'text-yellow-200'"));
check('HUDのSCORE横にライブランクを表示',
  game.includes('data-rhythm-rank')&&game.includes('RHYTHM_RANK_COLORS[rhythmRankForScore(view.score)]'));
check('リザルト画面にも大きくランクを表示',
  game.includes('data-rhythm-result-rank')&&game.includes('rank=rhythmRankForScore(view.score)'));
check('ランクはスコアから毎回計算するだけで、保存形式(BEST)を増やしていない',
  !/normalizeRhythmBestRecord[\s\S]{0,600}rank/.test(data)&&!/mergeRhythmBestRecord[\s\S]{0,400}rank/.test(data)
  &&game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';"));
check('保存キーを増やしていない',!game.includes('mh_rhythm_rank'));

check('仕様書にランクの暫定値と並びを記載',
  docs.includes('RHYTHM_RANKS')&&docs.includes('G')&&docs.includes('SS')&&docs.includes('M'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

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
const docs=read('docs/spec/RHYTHM_MODE.md'),indexHtml=read('monster-hero/index.html');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const block=data.match(/const RHYTHM_RANKS = Object\.freeze\(\[[\s\S]*?const rhythmNextRankId = score => \{[\s\S]*?\n\};/)?.[0];
check('ランクのデータ層を抽出できる',!!block);
if(!block){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
const context={};
vm.createContext(context);
vm.runInContext(`${block}\nthis.out={RHYTHM_RANKS,rhythmRankForScore,rhythmNextRankId};`,context);
const {RHYTHM_RANKS,rhythmRankForScore,rhythmNextRankId}=context.out;

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

// --- 次のランク(rhythmNextRankId) ---
check('0点の次はF',rhythmNextRankId(0)==='F');
check('最上位(M、100万点)の次は無い(null)',rhythmNextRankId(1000000)===null&&rhythmNextRankId(900000)===null);
check('境界値ちょうどでは、そのランクの1つ上を返す(以上判定と矛盾しない)',
  rhythmNextRankId(800000)==='M'&&rhythmNextRankId(799999)==='SS');
check('マイナスや壊れた値もG扱いの次(F)になる',
  rhythmNextRankId(-100)==='F'&&rhythmNextRankId(undefined)==='F'&&rhythmNextRankId('x')==='F');

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

// --- ランクゲージ(2026-09-04、ただ伸びるだけの帯だと「ゲージ」に見えないという指摘を反映) ---
check('丸バッジ横のバーがランクゲージとして目盛りを持つ',
  game.includes('data-rhythm-rank-gauge')&&indexHtml.includes('[data-rhythm-rank-gauge]{'));
check('バーの伸び自体はrhythmRankProgressのまま(判定を増やしていない)',
  /data-rhythm-rank-gauge[\s\S]{0,260}rhythmRankProgress\(view\.score\)/.test(game));
check('バーの横に次のランクを文字でも示す(rhythmNextRankIdを使う)',
  game.includes('data-rhythm-rank-next')&&game.includes('const rankNextId=rhythmNextRankId(view.score);')
  &&game.includes("const rankNextLabel=rankNextId?`→${rankNextId}`:'★MAX';"));
check('目盛りは見た目だけの背景画像で、判定・スコアには関与しない',
  /\[data-rhythm-rank-gauge\]\{\s*background-image:/.test(indexHtml));

check('仕様書にランクの暫定値と並びを記載',
  docs.includes('RHYTHM_RANKS')&&docs.includes('G')&&docs.includes('SS')&&docs.includes('M'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

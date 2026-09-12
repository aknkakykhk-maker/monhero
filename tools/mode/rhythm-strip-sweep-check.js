// 装飾の巡回(デバッグ限定)を、実機での演奏なしで確かめる。
//
//   node tools/mode/rhythm-strip-sweep-check.js
//
// 【なぜ要るか】
// 2026-09-12の実機計測で、演奏画面の装飾4つをまとめて切ると 25ms超 448→214 /
// 33ms超 124→62 と半分になった。ただし「どれが効いたか」は分からないまま。
// 1つずつ測ると演奏が4回要るうえ、端末の温度が回ごとに違う(同じ条件でもフレーム数が
// 17%ぶれる)ので比べにくい。そこで1回の演奏の中で4秒ごとに条件を切り替え、
// 条件ごとに数える形にした。この道具はその仕組みが壊れていないかを見る。
//
// 実機での演奏は要らない。曲の位置から段を決める計算と、段ごとの集計は
// どちらもブラウザに依らないので、vm の中で動かせば確かめられる。
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/30-rhythm-play.jsx'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/60-app.jsx'),'utf8');
let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

const take=(head,label)=>{
  const block=data.match(new RegExp(`const ${head}=[\\s\\S]*?\\n\\}\\)\\(\\);`))?.[0];
  if(!block){console.log(`✗ ${label} を切り出せません(${head} から })(); まで)`);process.exit(1);}
  return block;
};
const stripBlock=take('RHYTHM_STRIP_SWEEP_KEY','装飾の巡回');
const perfBlock=take('RHYTHM_PERF_KEY','性能計測');
const ctx={};vm.createContext(ctx);
vm.runInContext(`const RHYTHM_STRIP_KEY='mh_rhythm_strip_v1';\n${stripBlock}\n${perfBlock}\n`
  +'this.out={RHYTHM_STRIP,RHYTHM_STRIP_SWEEP_STEPS,RHYTHM_STRIP_SWEEP_MS,RHYTHM_STRIP_SWEEP_SETTLE_MS,RHYTHM_STRIP_SWEEP_KEY,RHYTHM_PERF};',ctx);
const {RHYTHM_STRIP:STRIP,RHYTHM_STRIP_SWEEP_STEPS:STEPS,RHYTHM_STRIP_SWEEP_MS:PERIOD,
  RHYTHM_STRIP_SWEEP_SETTLE_MS:SETTLE,RHYTHM_STRIP_SWEEP_KEY:SWEEP_KEY,RHYTHM_PERF:PERF}=ctx.out;

// --- 段の並び -------------------------------------------------------------
check('段は「そのまま」で始まり「ぜんぶ切る」で終わる',
  STEPS.length>=3&&STEPS[0].strip===''&&STEPS[STEPS.length-1].strip.split(' ').length>=4,
  `${STEPS.length}段 / ${STEPS.map(s=>s.label).join(' → ')}`);
// 1つずつ切る段が、装飾トグルの4つを漏れなく含む。ここが欠けると「測ったつもりで測っていない」
const singles=STEPS.slice(1,-1).map(s=>s.strip);
check('4つの装飾を1つずつ切る段がそろっている',
  ['glow','grid','bg','lane'].every(id=>singles.includes(id)),singles.join(' / '));
check('同じ条件の段が2つない',new Set(STEPS.map(s=>s.strip)).size===STEPS.length);

// --- 曲の位置から段を決める ------------------------------------------------
check(`切り替えは ${PERIOD/1000} 秒ごと`,PERIOD>=2000&&PERIOD<=10000,`${PERIOD}ms`);
check('段は曲の位置だけで決まる(時計を見ない)',
  !/Date\.now|performance\.now/.test(stripBlock),'stepAt に時計が出てこない');
const seen=[];
for(let i=0;i<STEPS.length*2;i++)seen.push(STRIP.stepAt(i*PERIOD));
check('段は順に進み、一巡して戻る',
  seen.join(',')===[...STEPS.keys(),...STEPS.keys()].join(','),seen.join(','));
check('区切りの手前は前の段のまま',STRIP.stepAt(PERIOD-1)===0&&STRIP.stepAt(PERIOD)===1);
check('曲の頭・負の値でも1段目から始まる',STRIP.stepAt(0)===0&&STRIP.stepAt(-500)===0&&STRIP.stepAt(NaN)===0);
check('段に入ってからの経過を返す',
  STRIP.stepElapsedMs(PERIOD+500)===500&&STRIP.stepElapsedMs(0)===0);
check(`切り替え直後の ${SETTLE}ms は数えない決まりがある`,SETTLE>0&&SETTLE<PERIOD/2,`${SETTLE}ms`);

// --- 保存キー --------------------------------------------------------------
check('巡回のON/OFFは新しい保存キーへ分けてある',
  SWEEP_KEY==='mh_rhythm_strip_sweep_v1'&&SWEEP_KEY!=='mh_rhythm_strip_v1',SWEEP_KEY);
check('巡回は既定でOFF',STRIP.sweep===false);
check('ON/OFFを切り替えられる',STRIP.setSweep(true)===true&&STRIP.sweep===true&&STRIP.setSweep(false)===false);

// --- 段ごとの集計 ----------------------------------------------------------
PERF.setEnabled(true);PERF.reset();
let t=0;const tickAt=ms=>{t+=ms;PERF.frame(t);};
PERF.lane(0);for(let i=0;i<10;i++)tickAt(16);tickAt(40);           // 段0: 33ms超 1回
PERF.lane(-1);tickAt(120);tickAt(90);                              // 落ち着き待ち: どこにも入らない
PERF.lane(1);for(let i=0;i<10;i++)tickAt(16);                      // 段1: 飛びなし
const snap=PERF.snapshot();
check('段ごとに数えられる',
  snap.lanes[0]&&snap.lanes[1]&&snap.lanes[0].over33===1&&snap.lanes[1].over33===0,
  `段0 ${snap.lanes[0]?.frames}frame/33超${snap.lanes[0]?.over33} 段1 ${snap.lanes[1]?.frames}frame/33超${snap.lanes[1]?.over33}`);
// frame() は1回目では間隔が測れないので数えない。段0の11回は10frameになる。
check('段を -1 にしたあいだは、どの段にも入らない',
  snap.lanes[0].frames===10&&snap.lanes[1].frames===10&&snap.frames===22,
  `合計 ${snap.frames}frame のうち段へ入ったのは ${snap.lanes[0].frames+snap.lanes[1].frames}frame(残り2frameは落ち着き待ち)`);
check('全体の集計は段と別に続いている',snap.frames===22&&snap.over33===3,
  `全体 ${snap.frames}frame / 33超 ${snap.over33}(段へ入ったのは1回だけ)`);
check('測っていない段は穴として残る(埋めるのは読む側)',
  snap.lanes.length<=STEPS.length&&snap.lanes[2]===undefined);
PERF.reset();
check('リセットで段ごとの記録も消える',(PERF.snapshot().lanes||[]).length===0);
PERF.setEnabled(false);
check('計測OFFのあいだは段を切り替えても何も起きない',
  (PERF.lane(3),PERF.frame(1),PERF.frame(20),PERF.snapshot().frames===0));

// --- 画面側 ----------------------------------------------------------------
// 巡回中は毎フレーム DOM の目印を書き替えるので、React が同じ属性を持っていると
// 再描画のたびに元へ戻されてしまう。巡回中は React 側を undefined にしておくこと。
check('巡回中は React が data-rhythm-strip を持たない',
  game.includes("data-rhythm-strip={RHYTHM_STRIP.sweep?undefined:(RHYTHM_STRIP.value||undefined)}"));
check('毎フレーム、曲の位置から段を決めて目印を書き替える',
  /RHYTHM_STRIP\.sweep&&RHYTHM_PERF\.enabled/.test(game)
  &&/RHYTHM_STRIP\.stepAt\(songTimeMs\)/.test(game)
  &&/dataset\.rhythmStrip=/.test(game));
check('切り替えた直後は段を -1 にして落ち着きを待つ',
  /RHYTHM_PERF\.lane\(-1\)/.test(game)
  &&/stepElapsedMs\(songTimeMs\)>=RHYTHM_STRIP_SWEEP_SETTLE_MS/.test(game));
check('rAFを増やしていない',
  (game.match(/requestAnimationFrame/g)||[]).length===(game.match(/frameRef\.current=requestAnimationFrame/g)||[]).length
  ||!/RHYTHM_STRIP[\s\S]{0,200}requestAnimationFrame/.test(game));
check('デバッグ画面に巡回のトグルと結果の表がある',
  app.includes('data-rhythm-strip-sweep ')&&app.includes('data-rhythm-strip-sweep-result'));
check('結果の表は段の一覧から作る(手で書き写さない)',
  /RHYTHM_STRIP_SWEEP_STEPS\.map\(/.test(app));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

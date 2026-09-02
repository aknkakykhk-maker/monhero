// 音ゲーのライフ(暫定値)を確認する。
//
// モンスターノーツの「回復 / バリア / 丈夫さ」はライフの数値が決まっていないと設計できないため、
// まず数値の管理と表示だけを固定した段階の検査。
//
// この段階で守ること:
//   ・ライフが0になっても曲を止めない(失敗終了はまだ入れない)
//   ・スコア・コンボ・BEST・ランキングへ一切関与しない
//   ・BESTの保存形式(mh_rhythm_best_v1)を変えない
//
//   node tools/mode/rhythm-life-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js'),game=read('monster-hero/src/game-system.jsx');
const docs=read('docs/spec/RHYTHM_MODE.md');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 実装を取り出して実際に動かす ---
const block=data.match(/const RHYTHM_LIFE_MAX = 1000;[\s\S]*?const rhythmLifeRatio = [^\n]*;/)?.[0];
check('ライフのデータ層を抽出できる',!!block);
if(!block){console.log(`\n${failed}件のNGがあります`);process.exit(1);}
const context={};
vm.createContext(context);
vm.runInContext(`${block}\nthis.out={RHYTHM_LIFE_MAX,RHYTHM_LIFE_DELTA,rhythmLifeAfter,rhythmLifeRatio};`,context);
const {RHYTHM_LIFE_MAX,RHYTHM_LIFE_DELTA,rhythmLifeAfter,rhythmLifeRatio}=context.out;

check('最大ライフは暫定1000',RHYTHM_LIFE_MAX===1000);
check('判定ごとの増減が暫定値どおり',
  RHYTHM_LIFE_DELTA.MARVELOUS===2&&RHYTHM_LIFE_DELTA.EXCELLENT===2&&RHYTHM_LIFE_DELTA.GREAT===1
  &&RHYTHM_LIFE_DELTA.GOOD===0&&RHYTHM_LIFE_DELTA.BAD===-20&&RHYTHM_LIFE_DELTA.MISS===-50,
  JSON.stringify(RHYTHM_LIFE_DELTA));
check('良い判定は増え、BAD/MISSだけ減る',
  ['MARVELOUS','EXCELLENT','GREAT'].every(id=>RHYTHM_LIFE_DELTA[id]>0)
  &&RHYTHM_LIFE_DELTA.GOOD===0&&RHYTHM_LIFE_DELTA.BAD<0&&RHYTHM_LIFE_DELTA.MISS<RHYTHM_LIFE_DELTA.BAD);

check('満タンからは増えない(上限で頭打ち)',rhythmLifeAfter(RHYTHM_LIFE_MAX,'MARVELOUS')===RHYTHM_LIFE_MAX);
check('0より下へは落ちない',rhythmLifeAfter(10,'MISS')===0&&rhythmLifeAfter(0,'MISS')===0);
check('MISSは-50、BADは-20',rhythmLifeAfter(500,'MISS')===450&&rhythmLifeAfter(500,'BAD')===480);
check('GOODは増減しない',rhythmLifeAfter(500,'GOOD')===500);
check('壊れた値・未知の判定でも落ちない',
  rhythmLifeAfter(undefined,'MISS')===RHYTHM_LIFE_MAX-50&&rhythmLifeAfter('x','MISS')===RHYTHM_LIFE_MAX-50
  &&rhythmLifeAfter(500,'UNKNOWN')===500&&rhythmLifeAfter(null,'MARVELOUS')===RHYTHM_LIFE_MAX);
check('表示用の比率は0〜1へ収める',
  rhythmLifeRatio(RHYTHM_LIFE_MAX)===1&&rhythmLifeRatio(0)===0&&rhythmLifeRatio(500)===.5
  &&rhythmLifeRatio(-100)===0&&rhythmLifeRatio(99999)===1&&rhythmLifeRatio('x')===1);

// 20回MISSで0になる(暫定バランスの目安)
let life=RHYTHM_LIFE_MAX,misses=0;
while(life>0&&misses<200){life=rhythmLifeAfter(life,'MISS');misses++;}
check('満タンからMISS20回で0になる(暫定バランス)',misses===20,`${misses}回`);

// --- 画面側の結線 ---
check('runとviewの両方でライフを持つ',
  game.includes('life:RHYTHM_LIFE_MAX,result:null')&&game.includes('life:RHYTHM_LIFE_MAX,finished:false'));
check('判定確定のたびにライフを更新する',
  game.includes('run.life=rhythmLifeAfter(run.life,judgment);')&&game.includes('life:run.life}));'));
check('HUDへライフバーと数値を表示する',
  game.includes('data-rhythm-life className=')&&game.includes('data-rhythm-life-bar')&&game.includes('data-rhythm-life-value'));
check('ライフバーの幅は共通のratio helperから出す',
  game.includes('width:`${(rhythmLifeRatio(view.life)*100).toFixed(1)}%`'));
check('軽量モードではライフバーのtransitionを止める',
  game.includes("transition:settings.lightweightMode?'none':'width 140ms linear'"));

// --- この段階で「やらないこと」を守っているか ---
check('ライフ0で曲を止めたり中断したりしない',
  !game.includes('run.life<=0')&&!game.includes('view.life<=0')&&!game.includes('life===0'));
check('スコア計算へライフを持ち込まない',
  !/rhythmCalculateScore\([^)]*life/.test(game)&&!/const rhythmCalculateScore[\s\S]{0,400}life/.test(data));
check('BESTの保存形式へライフを足していない',
  !game.includes('bestLife')&&!game.includes('life:run.life,bestScore')
  &&game.includes("const RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1';"));
check('保存キーを増やしていない',!game.includes('mh_rhythm_life'));

check('仕様書にライフの暫定値と未確定事項を記載',
  docs.includes('RHYTHM_LIFE_MAX')&&docs.includes('暫定')&&docs.includes('ライフ'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

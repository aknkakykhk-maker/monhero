// 端末を回した(画面の大きさが変わった)ときに、見た目のgeometryだけを測り直し、
// プレイ中の状態は一切壊さないことを確かめる。
//
// 設計方針(RHYTHM_FUTURE_IMPLEMENTATION_PLAN §6.3):
//   ・端末回転 / resize を検知する
//   ・プレイ中でも audio clock / run / スコア / コンボ / 判定状態をリセットしない
//   ・geometry だけ再計測・再配置する
//   ・HOLD / SLIDE 操作中も可能な限り現在のrunを維持する
//
// 以前は「プレイエリアの要素が入れ替わったときだけ」静的形状を組み直していたため、
// 回転しても古い縦横比のまま残っていた。
//
//   node tools/mode/rhythm-orientation-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 再配置の入口を取り出して、擬似DOM上で回転させる ────────────────────────
const block=source.match(/const installRhythmPerspectiveNoteVisuals=\(\)=>\{[\s\S]*?\n\};/)?.[0];
check('回転時の再配置の実装を抽出できる',!!block);
if(!block)process.exit(1);

let layoutCalls=0,lastLayoutSize=null;
const RECT={width:390,height:743};
const playArea={
  getBoundingClientRect:()=>({left:0,top:0,right:RECT.width,bottom:RECT.height,...RECT}),
  querySelectorAll:()=>[],
  querySelector:()=>null,
};
const listeners=new Map();
const context={
  requestAnimationFrame:()=>{throw new Error('回転の再配置でrAFを増やしてはいけない');},
  MutationObserver:class{observe(){}disconnect(){}},
  rhythmLayoutPlayArea:node=>{layoutCalls++;lastLayoutSize=node?{...RECT}:null;},
  document:{
    readyState:'complete',
    documentElement:{dataset:{}},
    querySelector:sel=>sel.includes('play-area')?playArea:null,
    body:{},
    addEventListener(){},
  },
  window:{
    addEventListener(type,fn){(listeners.get(type)||listeners.set(type,[]).get(type)).push(fn);},
    visualViewport:null,
  },
};
// Map#set は Map を返すので、上の書き方だと push 先が取れない。素直に用意し直す
context.window.addEventListener=(type,fn)=>{
  if(!listeners.has(type))listeners.set(type,[]);
  listeners.get(type).push(fn);
};
vm.createContext(context);
vm.runInContext(`${block}\ninstallRhythmPerspectiveNoteVisuals();`,context);

check('初回に一度だけ組み立てる',layoutCalls===1,`${layoutCalls}回`);
check('回転・リサイズを購読している',listeners.has('resize')&&listeners.has('orientationchange'),
  [...listeners.keys()].join(', '));

const fire=type=>(listeners.get(type)||[]).forEach(fn=>fn());

// 大きさが変わっていないなら何もしない(回転中に何度も飛んでくる resize で無駄働きしない)
layoutCalls=0;
fire('resize');fire('resize');fire('resize');
check('大きさが変わっていなければ組み直さない',layoutCalls===0,`${layoutCalls}回`);

// 縦 → 横
RECT.width=844;RECT.height=290;
layoutCalls=0;
fire('orientationchange');
check('回転して大きさが変わったら組み直す',layoutCalls===1,`${layoutCalls}回`);
check('組み直しは新しい寸法で行う',lastLayoutSize&&lastLayoutSize.width===844&&lastLayoutSize.height===290,
  lastLayoutSize?`${lastLayoutSize.width}x${lastLayoutSize.height}`:'なし');

// 回転直後の連続 resize では、もう組み直さない
layoutCalls=0;
fire('resize');fire('resize');
check('回転後の連続resizeでは組み直さない',layoutCalls===0,`${layoutCalls}回`);

// 横 → 縦へ戻す
RECT.width=390;RECT.height=743;
layoutCalls=0;
fire('resize');
check('縦へ戻したときも組み直す',layoutCalls===1,`${layoutCalls}回`);

check('回転の再配置でrAFを増やしていない(本体の1本を保つ)',
  !/const relayout=[\s\S]*?requestAnimationFrame/.test(block));

// ── プレイ中の状態を触らないこと ────────────────────────────────────────
// 再配置がやるのは見た目のstyleだけ。run / audio / スコア / コンボ / 判定へは触らない。
const forbidden=['runRef','beginRun','setView','applyJudgment','audio.','songTimeMs','holdJudgment','score','combo'];
const touched=forbidden.filter(word=>block.includes(word));
check('再配置はrun・audio・スコア・コンボ・判定に触らない',touched.length===0,touched.join(', '));
check('再配置が触るのはプレイエリアの見た目だけ',
  /rhythmLayoutPlayArea\(next\)/.test(block)&&!/\.remove\(\)|innerHTML/.test(block));

// 画面の向きが変わってもノーツの座標は毎フレーム測り直す本体の経路を使う
check('ノーツの位置は本体のrAFが毎フレーム測り直す(回転しても追従する)',
  /travel=measureTravel\(\)/.test(game));
// 入力側のrectキャッシュも回転で捨てる(PR #992で入れた仕組み)
check('入力側のrectキャッシュも回転で捨てる',
  /\['resize','orientationchange','scroll'\]\.forEach\(type=>window\.addEventListener\(type,invalidateAreaRect/.test(source));

// ── 縦横で分けないもの(§6.1) ────────────────────────────────────────────
check('譜面・判定窓・スコア式を画面の向きで分けていない',
  !/portrait|landscape/i.test(source.replace(/\/\/[^\n]*/g,'')),
  '実装側に向き別の分岐が入っていないこと');

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

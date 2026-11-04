#!/usr/bin/env node
// 自前の回転(RHYTHM_VIEW_ROTATION)が、器の大きさと押した点の直しを「同じ時に測った画面の大きさ」で計算するか(2026-11-02 社長の決定 B)。
// iPhone は回転のあと画面の大きさを少し遅れて直すことがある。そのあいだ器(描いたときの大きさ)と押した点の直し(押したときの大きさ)が
// 食い違うと、押した点が回転の分だけずれていた(社長「押した所と反応する所がたまにずれる。横向きにしたあとになる気がする」)。
//   node tools/mode/rhythm-rotation-size-snapshot-check.js
// あわせて、全画面の「見えないページのずれを戻す」見張り(A・10-core.jsx)が入っていることも見る。
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');
const block=source.match(/const RHYTHM_VIEW_ROTATION=\(\(\)=>\{[\s\S]*?\n\}\)\(\);/)?.[0];
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
ok('RHYTHM_VIEW_ROTATION を切り出せる',!!block);
if(!block){console.log(`\n${failed}件のNGがあります`);process.exit(1);}

const timers=[];let resizeFired=0;
const listeners={};
const win={innerWidth:390,innerHeight:844,screen:{orientation:{angle:0}},
  addEventListener:(type,fn)=>{(listeners[type]=listeners[type]||[]).push(fn);},
  dispatchEvent:ev=>{if(ev.type==='resize')resizeFired++;(listeners[ev.type]||[]).forEach(fn=>fn(ev));return true;}};
const ctx={window:win,Event:class{constructor(type){this.type=type;}},setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},clearTimeout:()=>{},console};
vm.createContext(ctx);
vm.runInContext(`${block}\nthis.R=RHYTHM_VIEW_ROTATION;`,ctx);
const R=ctx.R;
R.set(90);
const frame=()=>{const f=R.frameStyle();return {w:parseFloat(f.width),h:parseFloat(f.height)};};
const before=frame(),pBefore=R.point(100,200);
ok('回した直後: 器は画面の縦横を入れ替えた大きさ',before.w===844&&before.h===390,JSON.stringify(before));
// iPhone の遅れ: 画面の大きさだけが合図なしに変わる(まだ描き直していない)
win.innerWidth=375;win.innerHeight=812;
const pStale=R.point(100,200),fStale=frame();
ok('合図の前は、押した点の直しも器も前に測った大きさのまま(2つが食い違わない)',pStale.x===pBefore.x&&pStale.y===pBefore.y&&fStale.w===before.w,JSON.stringify({pStale,fStale}));
// 少しあとの測り直し
const firedBefore=resizeFired;
timers.splice(0).forEach(t=>t.fn());
const after=frame(),pAfter=R.point(100,200);
ok('0.1〜0.8秒あとの測り直しで、器と押した点の直しが同じ新しい大きさになる',after.w===812&&after.h===375&&pAfter.y===375-100,JSON.stringify({after,pAfter}));
ok('大きさが変わったら resize を鳴らして描き直させる',resizeFired>firedBefore,`resize ${resizeFired-firedBefore}回`);
const firedStill=resizeFired;
timers.splice(0).forEach(t=>t.fn());
ok('大きさが同じなら鳴らさない(回り続けない)',resizeFired===firedStill);

const core=fs.readFileSync(path.join(ROOT,'monster-hero/src/parts/10-core.jsx'),'utf8');
const guard=core.slice(core.indexOf('見えないページのずれを戻す'),core.indexOf('見えないページのずれを戻す')+4000);
ok('全画面の見張り(A)がある',core.includes('見えないページのずれを戻す'));
ok('A: 画面の大きさ・回転・visualViewport・入力欄から離れたとき・全画面の終わりで戻す',
  ['resize','orientationchange',"visualViewport.addEventListener('resize'","visualViewport.addEventListener('scroll'",'focusout','webkitendfullscreen','fullscreenchange'].every(k=>guard.includes(k)));
ok('A: 文字を入力している間は戻さない',/const reset=\(\)=>\{\s*if\(editing\(\)\)return;/.test(guard));
console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

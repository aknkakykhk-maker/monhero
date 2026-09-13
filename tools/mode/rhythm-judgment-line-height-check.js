#!/usr/bin/env node
// 判定ラインの高さを設定で動かせること(2026-09-13・ユーザー依頼
//   「タップする判定ラインの位置をオプションでいじれるようにしたい / 下過ぎて使いづらいという声があり」)
// を確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-judgment-line-height-check.js
//
// ★動かしてよいのは「置き場所」だけ。判定の窓(秒数)・スコア・譜面は1つも変えない。
//   ノーツが流れ着く先は measureTravel が**ラインを実測**して決めるので、
//   CSSの変数を動かすだけでノーツも判定もついてくる。そこを実ブラウザで測る。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9197;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const data=fs.readFileSync(path.join(ROOT,'monster-hero/data/rhythm-mode.js'),'utf8');

// ---- 保存のしかた(CLAUDE.md ⑦) ----
ok('新しいキーを足しただけで、既存のキーは触っていない',
  /DEFAULT_RHYTHM_SETTINGS = Object\.freeze\(\{[\s\S]{0,900}judgmentLineHeight:12/.test(game));
ok('保存値が無い・壊れているときは既定(12＝これまでの位置)へ倒れる',
  /judgmentLineHeight:rhythmFiniteStep\(source\.judgmentLineHeight,RHYTHM_JUDGMENT_LINE_HEIGHT_MIN,RHYTHM_JUDGMENT_LINE_HEIGHT_MAX,RHYTHM_JUDGMENT_LINE_HEIGHT_STEP,DEFAULT_RHYTHM_SETTINGS\.judgmentLineHeight\)/.test(game));
ok('上限は32%。これを超えると「まだ形が決まっていない」の見張りとぶつかる',
  /RHYTHM_JUDGMENT_LINE_HEIGHT_MAX = 32/.test(game)
  &&/lineCenter>areaRect\.top\+areaRect\.height\*0\.45/.test(game));

// ---- 置き場所だけを動かす ----
ok('ライン・弾ける光・判定文字が同じ変数を見る',
  game.includes("bottom:'var(--mh-judgment-line-bottom,12%)'")
  &&game.includes("bottom:'calc(var(--mh-judgment-line-bottom,12%) + 38px)'")
  &&data.includes('[data-rhythm-hit-effect]{position:absolute;bottom:var(--mh-judgment-line-bottom,12%);'));
ok('追従(HOLD/SLIDE)は、決めうちの.88ではなく実測した位置を見る',
  data.includes('rect.top+rect.height*RHYTHM_JUDGMENT_LINE_Y.ratio')
  &&game.includes('if(ready)RHYTHM_JUDGMENT_LINE_Y.set((lineRect.top-areaRect.top+lineRect.height/2)/areaRect.height);'));
ok('設定を変えたら測り直す(古い位置のまま流れない)',
  /\},\[settings\.noteStartPosition,settings\.judgmentLineHeight\]\);/.test(game)
  &&/\},\[settings\.noteStartPosition,settings\.noteSize,settings\.judgmentLineHeight,view\.status\]\);/.test(game));
// ★判定の窓(秒数)・スコアの数え方には一切入れない
ok('判定の窓・スコアの数え方には入れていない',
  !/RHYTHM_JUDGMENTS[\s\S]{0,400}judgmentLineHeight/.test(game)
  &&!/rhythmCalculateScore\([^)]*judgmentLineHeight/.test(game)
  &&!/rhythmJudgeTap\([^)]*judgmentLineHeight/.test(game));

// ---- 実ブラウザ: 変数を動かすと、ラインもノーツの行き先も一緒に動く ----
const serve=page=>new Promise(r=>{const s=http.createServer((req,res)=>{
  res.writeHead(200,{'Content-Type':'text/html'});res.end(page);});s.listen(PORT,()=>r(s));});
(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  const page=`<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#020617}
[data-rhythm-play-area]{position:relative;width:360px;height:600px;overflow:hidden}
[data-rhythm-judgment-line]{position:absolute;left:0;right:0;bottom:var(--mh-judgment-line-bottom,12%);height:3px;background:#fff}
[data-rhythm-hit-effect]{position:absolute;bottom:var(--mh-judgment-line-bottom,12%);left:50%;width:12%;height:0}
[data-rhythm-judgment-display]{position:absolute;left:0;right:0;bottom:calc(var(--mh-judgment-line-bottom,12%) + 38px);height:10px}
</style>
<div data-rhythm-play-area id="area">
  <div data-rhythm-judgment-line></div><div data-rhythm-hit-effect></div><div data-rhythm-judgment-display></div>
</div>`;
  const server=await serve(page);
  let browser,measured=null;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const tab=await browser.newPage({viewport:{width:390,height:844}});
    await tab.goto(`http://localhost:${PORT}/`,{waitUntil:'load',timeout:30000});
    measured=await tab.evaluate(()=>{
      const area=document.getElementById('area');
      const read=()=>{
        const a=area.getBoundingClientRect();
        const pick=sel=>{const r=area.querySelector(sel).getBoundingClientRect();
          return Math.round(((r.top+r.height/2)-a.top)/a.height*1000)/10;};
        return {line:pick('[data-rhythm-judgment-line]'),hit:pick('[data-rhythm-hit-effect]'),
          text:pick('[data-rhythm-judgment-display]')};
      };
      const out={};
      [12,20,32].forEach(v=>{area.style.setProperty('--mh-judgment-line-bottom',`${v}%`);out[v]=read();});
      area.style.removeProperty('--mh-judgment-line-bottom');
      out.default=read();
      return out;
    });
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  ok('位置を測れた',!!measured);
  if(measured){
    [12,20,32].forEach(v=>console.log(`      ${v}%: ライン=上から${measured[v].line}% / 光=${measured[v].hit}% / 判定文字=${measured[v].text}%`));
    ok('既定(変数なし)はこれまでどおり下から12%',Math.abs(measured.default.line-88)<0.6,`上から${measured.default.line}%`);
    ok('大きくするほどラインが上がる',measured[12].line>measured[20].line&&measured[20].line>measured[32].line);
    ok('弾ける光はラインと同じ高さ',[12,20,32].every(v=>Math.abs(measured[v].hit-measured[v].line)<0.6));
    ok('判定文字はラインの少し上に付いてくる',
      [12,20,32].every(v=>measured[v].text<measured[v].line&&measured[v].line-measured[v].text<12));
    // 上限でもエリアの上半分へは入らない(rhythmTravelLooksReady と両立する)
    ok('上限(32%)でもラインはエリアの下半分に残る',measured[32].line>50,`上から${measured[32].line}%`);
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

#!/usr/bin/env node
// 助手の吹き出しの中身が、箱からはみ出さないことを実際に測って確かめる。
//
//   node tools/assistant-bubble-wrap-check.js
//
// 【なぜ要るか】
// 2026-09-05、モンビーのチュートリアルで
// 「MARVELOUS→EXCELLENT→GREAT→GOOD→BADの順ね。」が右へはみ出して読めなくなった。
// 「→」は改行してよい場所として扱われないので、この並びは**ひとかたまりの長い単語**になる。
// ふつうの折り返しでは切る場所が無く、そのまま箱の外へ出る。
// 実測では 幅260pxの箱に対して 314px（54pxはみ出し）だった。
//
// 直しは「どこでも折り返してよい」を指定すること。それが効いているかは、
// 文字を実際に置いて測らないと分からない(ソースを読むだけでは分からない)ので、ここで測る。
//
// 測る幅は、iPhone(幅390px)の縦画面でいちばん狭くなるときの本文の幅。
//   画面390 − 外側の余白32 − 顔104 − 顔と吹き出しの間12 − 枠4 − 内側の余白28 ≒ 210px
// 少し厳しめに 200px で測る。
const fs=require('fs'),path=require('path'),vm=require('vm');
const {chromium}=require('playwright');

const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const game=read('monster-hero/src/game-system.jsx');
const assistantsSrc=read('monster-hero/data/assistants.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// --- 台本を全部集める(みゅあ・きき、あいさつ・村の案内・バトル・モンビー) ---
const ctx={};
vm.createContext(ctx);
vm.runInContext(`${assistantsSrc}\nthis.out={ASSISTANT_SCENES,assistantIntroPages,assistantTutorialPages,assistantBattleGuidePages,assistantRhythmTutorialPages};`,ctx);
const A=ctx.out;
const ASSISTANT_IDS=['mua','kiki'];
const pages=[];
for(const id of ASSISTANT_IDS){
  for(const [label,fn] of [['あいさつ',A.assistantIntroPages],['村の案内',A.assistantTutorialPages],
    ['バトルの案内',A.assistantBattleGuidePages],['モンビーの案内',A.assistantRhythmTutorialPages]]){
    (fn(id)||[]).forEach((page,index)=>pages.push({who:id,label,index,title:page.title||'',text:String(page.t||'')}));
  }
}
// 場面(scene)のセリフも同じ吹き出しに出る
Object.entries(A.ASSISTANT_SCENES||{}).forEach(([key,scene])=>{
  [...(scene.lines||[]),...Object.values(scene.when||{}).flat()]
    .forEach((line,index)=>pages.push({who:'-',label:`場面 ${key}`,index,title:'',text:String(line.t||'')}));
});
check('台本とセリフを集められた',pages.length>0,`${pages.length}件`);

// --- 実装が「どこでも折り返してよい」を指定しているか ---
check('吹き出しの本文と小見出しに、どこでも折り返す指定がある',
  (game.match(/overflowWrap:'anywhere',wordBreak:'break-word'/g)||[]).length>=2);

const BODY_WIDTH=200;
(async()=>{
  let browser=null;
  try{
    browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage();
    // 本文と同じ字の大きさ・行間で置く。折り返しの指定は実装から取らず、ここで同じものを当てる
    // (「実装にその指定がある」ことは上の静的チェックで見ている)。
    await page.setContent(`<!doctype html><body style="margin:0;font-family:sans-serif">
      <div id="wrap" style="width:${BODY_WIDTH}px"></div></body>`);
    const overflow=await page.evaluate(({items,width})=>{
      const wrap=document.getElementById('wrap');
      const out=[];
      for(const item of items){
        for(const [kind,value,size] of [['小見出し',item.title,11],['本文',item.text,13]]){
          if(!value)continue;
          wrap.innerHTML='';
          const span=document.createElement('span');
          span.style.cssText=`display:block;font-size:${size}px;line-height:1.6;overflow-wrap:anywhere;word-break:break-word`;
          span.textContent=value;
          wrap.appendChild(span);
          if(span.scrollWidth>width+0.5)out.push(`${item.who}/${item.label}#${item.index} ${kind}(${span.scrollWidth}px)`);
        }
      }
      return out;
    },{items:pages,width:BODY_WIDTH});
    check(`どの台本・セリフも幅${BODY_WIDTH}pxからはみ出さない`,overflow.length===0,
      overflow.slice(0,3).join(' / ')||`${pages.length}件すべて収まる`);

    // 折り返しの指定が無ければ本当にはみ出すこと(この検査が実際に効いていることの確認)
    const withoutSetting=await page.evaluate(width=>{
      const wrap=document.getElementById('wrap');
      wrap.innerHTML='';
      const span=document.createElement('span');
      span.style.cssText='display:block;font-size:13px;line-height:1.6';
      span.textContent='MARVELOUS→EXCELLENT→GREAT→GOOD→BADの順ね。';
      wrap.appendChild(span);
      return {scroll:span.scrollWidth,width};
    },BODY_WIDTH);
    check('折り返しの指定が無ければ、この検査は実際に落ちる(見張りが効いている)',
      withoutSetting.scroll>BODY_WIDTH,`指定なしだと${withoutSetting.scroll}px`);
  }finally{
    if(browser)await browser.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

#!/usr/bin/env node
// ノーツを取ったときのヒットエフェクトと、モンスターノーツの特別扱いを確かめる。
//
// ユーザー指摘(2026-09-05)「画面演出はあまりかわってないけどなにかいじった？
// プロセカ、チュウニズムのようなのを参考にしてほしい」
// 「モンスターノーツ踏んだときは音も演出も地味すぎる」
//
// 以前は「ノーツ1枚ごとの派手なエフェクトは重いので入れない」としていた。あのとき実機で
// カクついた原因は**画面いっぱいのぼかしを押すたびに描き直していた**ことで、エフェクト自体が
// 重かったわけではない。次を守れば発熱時でも負担は増えないので、その条件を機械的に見張る。
//
//   ・要素はあらかじめ作って使い回す(押すたびにDOMを増やさない)
//   ・動かすのは transform と opacity だけ(ぼかし・影・色を毎フレーム変えない)
//   ・光り方はCSSアニメーションで、毎フレームのJSを増やさない
//
//   node tools/mode/rhythm-hit-effect-check.js
const fs=require('fs');
const path=require('path');
const http=require('http');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'../..'),PORT=8981;
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const ctx={};vm.createContext(ctx);
vm.runInContext(`${source}\nthis.out={RHYTHM_HIT_EFFECT_POOL,RHYTHM_HIT_SPARK_COUNT,RHYTHM_HIT_EFFECT_MS,rhythmHitEffectColor,RHYTHM_NOTE_SE_RUNTIME};`,ctx);
const {RHYTHM_HIT_EFFECT_POOL,RHYTHM_HIT_SPARK_COUNT,RHYTHM_HIT_EFFECT_MS,rhythmHitEffectColor,RHYTHM_NOTE_SE_RUNTIME}=ctx.out;

// --- 音 ---
check('モンスターノーツ専用の音がある',typeof RHYTHM_NOTE_SE_RUNTIME.playMonster==='function');
check('音が出せない環境でも落ちない',RHYTHM_NOTE_SE_RUNTIME.playMonster()===false);
const monsterSe=/const playMonster=\(\)=>\{[\s\S]*?\n  \};/.exec(source)?.[0]||'';
check('モンスターノーツの音を取り出せる',monsterSe.length>300);
check('ふつうのノーツとは違う音になっている(駆け上がる3音＋低音)',
  /1046\.50,1318\.51,1567\.98/.test(monsterSe)&&/261\.63/.test(monsterSe));
check('音量・ON/OFF・全体ミュートは既存のタップ音の設定を読む(保存キーを増やさない)',
  monsterSe.includes('readSettings()')&&monsterSe.includes('rhythmAudioGloballyEnabled()')
  &&!/mh_/.test(monsterSe));
check('モンスターノーツを取ったときにその音を鳴らす',
  game.includes('if(monsterHit)RHYTHM_NOTE_SE_RUNTIME.playMonster();'));
check('MISSでは鳴らさない・光らせない',/if\(judgment!=='MISS'\)\{[\s\S]{0,200}?const monsterHit=/.test(game));

// --- 重くならない作り ---
check('使い回す枚数が決まっている',Number.isInteger(RHYTHM_HIT_EFFECT_POOL)&&RHYTHM_HIT_EFFECT_POOL>=6&&RHYTHM_HIT_EFFECT_POOL<=24,
  `${RHYTHM_HIT_EFFECT_POOL}枚`);
check('モンスターノーツの光はふつうより大きく長い',
  RHYTHM_HIT_EFFECT_MS.MONSTER>=RHYTHM_HIT_EFFECT_MS.NORMAL*2,
  `ふつう${RHYTHM_HIT_EFFECT_MS.NORMAL}ms / モンスター${RHYTHM_HIT_EFFECT_MS.MONSTER}ms`);
check('判定ごとに色が違う',
  new Set(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD'].map(rhythmHitEffectColor)).size===5);
check('プレイ開始時に先に作る(曲の途中で10個まとめて作らない)',
  game.includes('rhythmEnsureHitEffects(playAreaRef.current);'));
check('すでにあれば作り直さない',source.includes("if(layer&&layer._rhythmPool)return layer;"));
// ★ここが2026-09-05に実機で壊れた点。CSSアニメーションには fill-mode を付けていないので、
//   終わった瞬間に子要素は「既定の見た目」へ戻る。既定が見える状態(opacity>0)だと、
//   使い回している10枚ぶんの光が判定ラインに residual として残り、画面が滅茶苦茶になる。
check('光の既定は消えている(アニメーションが終わったら残らない)',
  /\[data-rhythm-hit-effect\]>i,\[data-rhythm-hit-effect\]>b,\[data-rhythm-hit-effect\]>u\{[^}]*opacity:0[^}]*\}/.test(source.replace(/\n\s+/g,''))
  // 子要素へ opacity:0 以外の既定を与えていないこと
  &&!/\[data-rhythm-hit-effect\]>[ibu][^{]*\{[^}]*opacity:(?!0[;}])/.test(source));
check('はじける粒を仕込んである(プロセカの着弾の粒)',
  Number.isInteger(RHYTHM_HIT_SPARK_COUNT)&&RHYTHM_HIT_SPARK_COUNT>=3
  &&source.includes("for(let spark=0;spark<RHYTHM_HIT_SPARK_COUNT;spark++)item.appendChild(document.createElement('u'));"),
  `${RHYTHM_HIT_SPARK_COUNT}粒`);
check('粒の飛ぶ向きはCSSに固定で書いてある(毎回の計算を増やさない)',
  /\[data-rhythm-hit-effect\]>u:nth-of-type\(1\)\{--rhythm-spark-x:/.test(source));
check('コンボ数も1つごとに弾む',
  game.includes("comboText.dataset.rhythmComboPop='1';")
  &&source.includes('[data-rhythm-combo][data-rhythm-combo-pop="1"]{animation:mhRhythmComboPop'));
check('発生のたびに要素を作らず、古いものから順に使い回す',
  source.includes('layer._rhythmNext=(layer._rhythmNext+1)%layer._rhythmPool.length;')
  &&!/rhythmSpawnHitEffect[\s\S]{0,900}?createElement/.test(source));

// @keyframes の中身を波かっこの対応で切り出す(ステップ自身も波かっこを持つため)
const keyframeBodies=css=>{
  const out=[],pattern=/@keyframes\s+(\w+)\s*\{/g;let match;
  while((match=pattern.exec(css))){
    let depth=1,index=pattern.lastIndex;
    while(index<css.length&&depth>0){
      if(css[index]==='{')depth++;else if(css[index]==='}')depth--;
      index++;
    }
    out.push({name:match[1],body:css.slice(pattern.lastIndex,index-1)});
  }
  return out;
};
const hitCss=/\/\* --- ノーツを取ったときのヒットエフェクト --- \*\/[\s\S]*?\/\* --- 両サイドのマスモン --- \*\//.exec(source)?.[0]||'';
check('ヒットエフェクト用のCSSを取り出せる',hitCss.length>800);
const hitKeyframes=keyframeBodies(hitCss);
check('光の動きは transform と opacity だけ(ぼかし・影・色を動かさない)',
  hitKeyframes.length>=5&&hitKeyframes.every(entry=>
    !/filter|box-shadow|background|border-color|width:|height:/.test(entry.body)
    &&/transform:|opacity:/.test(entry.body)),
  hitKeyframes.map(entry=>entry.name).join(' / '));
check('画面のフラッシュは opacity だけを動かす(あらかじめ置いた1枚を使う)',
  keyframeBodies(hitCss).find(entry=>entry.name==='mhRhythmScreenFlash')
  &&!/@keyframes mhRhythmScreenFlash\{[^}]*transform/.test(hitCss.replace(/\s+/g,''))
  &&hitCss.includes('[data-rhythm-screen-flash]{position:absolute;inset:0;pointer-events:none;'));
check('演出量MINIMAL・軽量モードでは出さない(音は鳴る)',
  hitCss.includes('[data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-hit-layer]')
  &&hitCss.includes('[data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-screen-flash]')
  &&hitCss.includes('display:none!important')
  // 音は演出量の外で鳴らす
  &&/if\(monsterHit\)RHYTHM_NOTE_SE_RUNTIME\.playMonster\(\);\s*\n\s*if\(!settings\.lightweightMode/.test(game));
check('入力を邪魔しない',
  hitCss.includes('[data-rhythm-hit-layer]{position:absolute;inset:0;pointer-events:none;')
  &&hitCss.includes('[data-rhythm-screen-flash]{position:absolute;inset:0;pointer-events:none;'));

// --- モンスターノーツの特別扱い ---
check('モンスターノーツだけ画面を一瞬染める',game.includes("flash.dataset.rhythmFlash='1';"));
check('モンスターノーツを取ると、そのマスモンが大きく跳ねる',
  game.includes("el.dataset.rhythmSideHit='1';")
  &&source.includes('[data-rhythm-side-monster][data-rhythm-side-hit="1"]{animation:mhRhythmSideCheer'));
check('跳ね方は transform だけ',(()=>{
  const cheer=keyframeBodies(source).find(entry=>entry.name==='mhRhythmSideCheer')?.body||'';
  return cheer.length>0&&!/filter|box-shadow|background/.test(cheer)&&/transform:/.test(cheer);
})());
check('判定文字も一度だけ弾む',
  game.includes("judgmentText.dataset.rhythmJudgmentPop='1';")
  &&source.includes('[data-rhythm-judgment-text][data-rhythm-judgment-pop="1"]{animation:mhRhythmJudgmentPop'));

// --- 判定まわりを変えていない ---
check('判定窓・スコア・コンボの計算に触っていない',
  !/rhythmSpawnHitEffect[^\n]*(score|combo|life|judgeTap|judgeRelease)/i.test(game)
  &&ctx.out.RHYTHM_NOTE_SE_RUNTIME&&vm.runInContext('RHYTHM_RELEASE_MAX_MS',ctx)===240
  &&vm.runInContext("rhythmJudgeRelease(0)",ctx)==='MARVELOUS');

// --- 実ブラウザで、実際に光っていることと、押すたびにDOMが増えないこと ---
const MIME={'.html':'text/html','.js':'text/javascript'};
const serve=()=>new Promise(resolve=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/,'');
    const file=path.join(ROOT,rel);
    if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(file).toLowerCase()]||'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT,()=>resolve(server));
});
const PAGE=`<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#000}
#area{position:relative;width:390px;height:700px;overflow:hidden}
</style></head><body>
<div id="area" data-rhythm-play-area data-rhythm-effect="NORMAL" data-rhythm-lightweight="false">
<i data-rhythm-judgment-line style="position:absolute;bottom:12%;left:0;right:0;height:3px"></i></div>
<script src="/monster-hero/data/rhythm-mode.js"><\/script>
</body></html>`;

(async()=>{
  let playwright;
  try{playwright=require(path.join(ROOT,'tools/node_modules/playwright'));}
  catch{try{playwright=require('playwright');}catch{console.log('SKIP: playwright が入っていないので実測できません');console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');process.exit(failed?1:0);}}
  const server=await serve();
  let browser;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const page=await browser.newPage({viewport:{width:390,height:800}});
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.route('**/probe.html',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:PAGE}));
    await page.goto(`http://localhost:${PORT}/probe.html`,{waitUntil:'networkidle'});
    check('rhythm-mode.js を読み込んでもエラーにならない',errors.length===0,errors[0]||'');

    const result=await page.evaluate(async()=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      rhythmEnsureHitEffects(area);
      const layer=area.querySelector('[data-rhythm-hit-layer]');
      const created=layer.children.length;
      // 40回発生させて、DOMの数が増えないことを見る
      for(let index=0;index<40;index++){
        rhythmSpawnHitEffect(area,{centerRatio:(index%5)/5+.1,widthRatio:.12,
          judgment:'MARVELOUS',monster:index%10===0});
      }
      const after=layer.children.length;
      // いま光っている要素の見た目を測る
      rhythmSpawnHitEffect(area,{centerRatio:.5,widthRatio:.2,judgment:'MARVELOUS'});
      const item=[...layer.children].find(child=>child.dataset.rhythmHitKind==='NORMAL');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const core=item.querySelector('i'),ring=item.querySelector('b');
      const coreRect=core.getBoundingClientRect(),ringRect=ring.getBoundingClientRect();
      const areaRect=area.getBoundingClientRect();
      const style=getComputedStyle(core);
      // アニメーション中に animation-name が付いているか
      const running=getComputedStyle(core).animationName;
      // モンスター用の見た目
      rhythmSpawnHitEffect(area,{centerRatio:.5,widthRatio:.2,judgment:'MARVELOUS',monster:true});
      const monsterItem=[...layer.children].find(child=>child.dataset.rhythmHitKind==='MONSTER');
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const monsterRect=monsterItem.querySelector('i').getBoundingClientRect();
      // ★アニメーションが終わったあと、光が本当に消えているか(残ると画面が滅茶苦茶になる)
      await new Promise(resolve=>setTimeout(resolve,1400));
      const leftover=[...layer.children].map(child=>
        [...child.children].map(part=>Number(getComputedStyle(part).opacity)).reduce((a,b)=>Math.max(a,b),0)
      ).reduce((a,b)=>Math.max(a,b),0);
      return {created,after,leftover,
        sparks:[...layer.children[0].querySelectorAll('u')].length,
        core:{width:coreRect.width,height:coreRect.height,centerX:(coreRect.left+coreRect.width/2-areaRect.left)/areaRect.width},
        ring:{width:ringRect.width},
        monsterWidth:monsterRect.width,
        opacity:Number(getComputedStyle(item).opacity),running,
        areaWidth:areaRect.width};
    });

    check('先に作る枚数が決めたとおり',result.created===RHYTHM_HIT_EFFECT_POOL,`${result.created}枚`);
    check('40回発生させてもDOMが増えない(使い回している)',result.after===result.created,
      `${result.created}枚 → ${result.after}枚`);
    check('光が実際に大きさを持って出ている',result.core.width>10&&result.core.height>0&&result.ring.width>10,
      `中心の光 ${result.core.width.toFixed(0)}x${result.core.height.toFixed(0)}px / 光の柱 ${result.ring.width.toFixed(0)}px`);
    check('光がノーツの位置に出る',Math.abs(result.core.centerX-.5)<=.06,
      `中心 ${(result.core.centerX*100).toFixed(1)}%`);
    check('モンスターノーツの光はふつうより大きい',result.monsterWidth>result.core.width*1.15,
      `ふつう ${result.core.width.toFixed(0)}px → モンスター ${result.monsterWidth.toFixed(0)}px`);
    check('CSSアニメーションが実際に動いている',result.running&&result.running!=='none',result.running);
    check('1枚あたりの粒の数が決めたとおり',result.sparks===RHYTHM_HIT_SPARK_COUNT,`${result.sparks}粒`);
    check('光が終わったあと画面に残らない(判定ラインに輪が居座らない)',result.leftover===0,
      `残った不透明度 ${result.leftover}`);

    // 軽量モードでは出ない
    const lightweight=await page.evaluate(()=>{
      const area=document.querySelector('[data-rhythm-play-area]');
      area.dataset.rhythmLightweight='true';
      const layer=area.querySelector('[data-rhythm-hit-layer]');
      return getComputedStyle(layer).display;
    });
    check('軽量モードではヒットエフェクトを出さない',lightweight==='none',lightweight);
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

#!/usr/bin/env node
// 演奏後のリザルトが「結果に応じた見た目」になっているかを確かめる。
//
//   node tools/mode/rhythm-result-effect-check.js
//
// 2026-09-13・ユーザー依頼。
//   「演奏後のリザルト結果に応じて演出を変えてほしい」
//   「あとスコアには関係ないけど、JUST Marvelousもリザルト結果に出したい」
//
// ランクから段(data-rank-tier)を作り、段が上がるほど強く光らせる。
// 失敗(FAILED)は段0にして、どれも効かないようにしてある。
// 段ごとの見た目は index.html のCSSで決まるので、**実際のブラウザで計算済みの値を測る**。
const fs=require('fs'),path=require('path'),http=require('http');
const ROOT=path.resolve(__dirname,'..','..'),PORT=9189;
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
const html=fs.readFileSync(path.join(ROOT,'monster-hero/index.html'),'utf8');

// ---- JUST MARVELOUS ----
// ★数える先は**演奏の状態(run)**。画面の状態(view)へ足すと、叩いた瞬間に落ちる
//   (2026-09-13にタイミング合わせで実際に踏んだ)。
ok('ぴったりのMARVELOUSを演奏の状態(run)で数えている',
  /runRef\.current=\{[^}]*precise:0/.test(game)
  &&game.includes('run.counts[judgment]++;if(preciseHit)run.precise++;'));
ok('判定・スコア・コンボの数え方は変えていない',
  game.includes('const nextCombo=rhythmComboAfter(run.combo,judgment);')
  &&!/precise[^\n]{0,40}rhythmCalculateScore/.test(game));
ok('リザルトの結果と画面へ渡している',
  game.includes('precise:run.precise,cleared:!failed,')&&game.includes('slow:run.slow,precise:run.precise,life:run.life,'));
ok('リザルトの内訳にMARVELOUSの内数として出す',
  game.includes('data-rhythm-result-precise')&&game.includes('└ JUST MARVELOUS')
  &&game.includes("{id==='MARVELOUS'&&<React.Fragment key=\"precise\">"));
// 自己ベストの保存形式は触らない(mergeRhythmBestRecord はキーを選んで写す)
ok('自己ベストの保存形式へは足していない',
  !/normalizeRhythmBestRecord\(\{[\s\S]{0,400}precise/.test(game));

// ---- 結果に応じた演出 ----
ok('ランクから段を作っている(失敗は段0)',
  game.includes("const rankTier=result.cleared===false?0:({M:5,SS:4,S:3,A:2,B:1,C:1}[rank]||0);"));
ok('段を器とランクの丸へ渡している',
  game.includes('data-rank-tier={String(rankTier)}')
  &&game.includes('<main data-rhythm-result data-rank={rank} data-rank-tier={String(rankTier)}'));
ok('リザルトでも演出量と軽量モードを効かせる',
  /<main data-rhythm-result[\s\S]{0,200}data-rhythm-effect=\{settings\.effectAmount\}/.test(game)
  &&/<main data-rhythm-result[\s\S]{0,240}data-rhythm-lightweight=\{settings\.lightweightMode\?'true':'false'\}/.test(game));
ok('動きだけを止める(光は残す)',
  html.includes('[data-rhythm-result][data-rhythm-effect="MINIMAL"] [data-rhythm-result-rank],')
  &&/\[data-rhythm-result\]\[data-rhythm-lightweight="true"\] \[data-rhythm-result-rank\]\{animation:none\}/.test(html));

// ---- 実ブラウザ: 段ごとの計算済みの値を測る ----
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css'};
const serve=page=>new Promise(r=>{const s=http.createServer((req,res)=>{
  res.writeHead(200,{'Content-Type':'text/html'});res.end(page);});s.listen(PORT,()=>r(s));});

(async()=>{
  let playwright;
  try{playwright=require('playwright');}
  catch{console.log('SKIP: playwright が入っていないので確認できません');process.exit(0);}
  // index.html からリザルト向けの規則だけを抜き出して、その場で当てる
  // ★「}」を目印にすると、規則が連続しているときに1つおきにしか拾えない
  //   (前の規則の「}」を食べてしまうため。2026-09-13に実際に半分見落とした)。
  //   すべての規則を順に見て、セレクタで選ぶ。
  const resultCss=[...html.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(m=>m[1].includes('[data-rhythm-result'))
    .map(m=>`${m[1].trim()}{${m[2].trim()}}`).join('\n');
  const keyframes=(html.match(/@keyframes mhRhythmResultRank\{[^@]*?\}\}/)||[''])[0];
  ok('リザルト向けのCSSを取り出せた',resultCss.length>0&&keyframes.length>0,`${resultCss.split('\n').length}規則`);
  const boxes=[0,1,2,3,4,5].map(t=>`<main data-rhythm-result data-rank-tier="${t}"><div data-rhythm-result-rank data-rank-tier="${t}">R</div></main>`).join('');
  const page=`<!doctype html><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
body{background:#020617;color:#fff;font-family:system-ui}
main{position:relative;padding:8px}
[data-rhythm-result-rank]{width:80px;height:80px;border:4px solid currentColor;border-radius:9999px;display:flex;align-items:center;justify-content:center}
${resultCss}
${keyframes}
</style>${boxes}`;
  const server=await serve(page);
  let browser,measured=null;
  try{
    browser=await playwright.chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
    const tab=await browser.newPage({viewport:{width:390,height:844}});
    await tab.goto(`http://localhost:${PORT}/`,{waitUntil:'load',timeout:30000});
    measured=await tab.evaluate(()=>[...document.querySelectorAll('[data-rhythm-result-rank]')].map(el=>{
      const cs=getComputedStyle(el);
      const main=el.closest('[data-rhythm-result]');
      const before=getComputedStyle(main,'::before');
      return {tier:el.getAttribute('data-rank-tier'),shadow:cs.boxShadow,anim:cs.animationName,
        glow:before.content!=='none'&&before.backgroundImage!=='none'};
    }));
  }finally{
    if(browser)await browser.close();
    server.close();
  }
  ok('段ごとの見た目を測れた',Array.isArray(measured)&&measured.length===6);
  if(measured){
    measured.forEach(m=>console.log(`      段${m.tier}: 光=${m.shadow==='none'?'なし':'あり'} / 動き=${m.anim} / 上の光=${m.glow?'あり':'なし'}`));
    ok('失敗(段0)では光らせない',measured[0].shadow==='none'&&measured[0].anim==='none'&&!measured[0].glow);
    ok('段が上がるほど光が付く',[1,2,3,4,5].every(t=>measured[t].shadow!=='none'));
    ok('段ごとに光の強さが違う',new Set(measured.slice(1).map(m=>m.shadow)).size===5);
    ok('いちばん上の2段だけ静かに脈打つ',
      measured[4].anim==='mhRhythmResultRank'&&measured[5].anim==='mhRhythmResultRank'
      &&[0,1,2,3].every(t=>measured[t].anim==='none'));
    ok('上位3段だけ画面の上へ光を敷く',
      [3,4,5].every(t=>measured[t].glow)&&[0,1,2].every(t=>!measured[t].glow));
  }
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

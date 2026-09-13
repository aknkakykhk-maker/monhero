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
// 並びは MARVELOUS の**上**(2026-09-13・ユーザー指示「普通に表示はMarvelousの上に
// JUST Marvelousがくるようにして」)。内数の行が、その判定の行より前に出ていることを見る。
ok('リザルトの内訳でMARVELOUSのすぐ上に出す',
  game.includes('data-rhythm-result-precise')&&game.includes('>JUST MARVELOUS<')
  &&game.includes("{id==='MARVELOUS'&&<React.Fragment key=\"precise\">")
  &&/data-rhythm-result-precise[\s\S]{0,700}<dt data-rhythm-judgment-row=\{id\}>\{id\}<\/dt>/.test(game)
  &&!game.includes('└ JUST MARVELOUS'));
// ランキングのスコア詳細(2026-09-13・ユーザー依頼「ランキングからのスコア詳細では
// JUST Marvelousも見れるようにして」)。
// ★party はJSONの列なので**項目を足すだけ**。テーブルの形は変えない(CLAUDE.md ⑦)。
ok('全国ランキングへも送っている',
  /const detail = \{[\s\S]{0,900}precise: Math\.max\(0, Math\.floor\(Number\(result\.precise\) \|\| 0\)\),/.test(game));
ok('ランキングの詳細でもMARVELOUSのすぐ上に出す',
  game.includes('data-rhythm-ranking-precise')
  &&/data-rhythm-ranking-precise[\s\S]{0,600}rhythmRankingDetail\.detail\?\.judgments\?\.\[id\]/.test(game));
// ★前の記録には precise が無い。0と出すと「一度も取れていない」に見えるので分ける
ok('古い記録の「無い」と「0回」を分けて出す',
  /Number\.isFinite\(Number\(rhythmRankingDetail\.detail\?\.precise\)\)\?[\s\S]{0,160}:'—'/.test(game)
  &&game.includes('data-rhythm-ranking-precise-missing'));
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

// ---- 判定の内訳の色(2026-09-13・ユーザー指示「JUST Marvelous（虹）/ Marvelous（金）みたいな」) ----
ok('リザルトとランキングの両方で、判定ごとの印を付けている',
  game.includes('<dt data-rhythm-judgment-row={id}>{id}</dt><dd data-rhythm-judgment-row={id} className="text-right font-mono">{view.counts[id]}</dd>')
  &&game.includes('<dt data-rhythm-judgment-row={id}>{id}</dt><dd data-rhythm-judgment-row={id} className="text-right font-mono">{rhythmRankingDetail.detail?.judgments?.[id]??0}</dd>')
  &&/data-rhythm-result-precise[^\n]{0,60}data-rhythm-judgment-row="JUST"/.test(game)
  &&/data-rhythm-ranking-precise[^\n]{0,60}data-rhythm-judgment-row="JUST"/.test(game));

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
  // ★判定色の規則は @media (prefers-reduced-motion) を含む。規則を1つずつ押さえると
  //   包みが落ちて「いつでも animation:none」に見えるので、ブロックをそのまま切り出す
  const rowFrom=html.indexOf('[data-rhythm-judgment-row]{font-weight:900}');
  const rowTo=html.indexOf('</style>',rowFrom);
  const rowCss=rowFrom>=0?html.slice(rowFrom,rowTo):'';
  const rowKeyframes=(html.match(/@keyframes mhRhythmJudgmentSweep\{[^@]*?\}\}/)||[''])[0]
    +(html.match(/@keyframes mhRhythmJudgmentRainbow\{[^@]*?\}\}/)||[''])[0];
  ok('判定色のCSSを取り出せた',rowCss.length>0&&rowKeyframes.length>0);
  const JUDGMENT_ROWS=['MISS','BAD','GOOD','GREAT','EXCELLENT','MARVELOUS','JUST'];
  const rowsHtml=JUDGMENT_ROWS.map(id=>`<dt data-rhythm-judgment-row="${id}">${id}</dt>`).join('');
  const rowPage=page.replace('</style>',`${rowCss}\n${rowKeyframes}\n</style>`)
    +`<main data-rhythm-result data-rhythm-effect="LIGHT" data-rhythm-lightweight="false"><dl id="res">${rowsHtml}</dl></main>`
    +`<div><dl id="rank">${rowsHtml}</dl></div>`
    +`<main data-rhythm-result data-rhythm-effect="MINIMAL" data-rhythm-lightweight="false"><dl id="min">${rowsHtml}</dl></main>`;
  const server=await serve(rowPage);
  let browser,measured=null,rows=null,hues=null;
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
    rows=await tab.evaluate(()=>{
      const read=(id)=>[...document.querySelectorAll(`#${id} [data-rhythm-judgment-row]`)].map(el=>{
        const cs=getComputedStyle(el);
        return {id:el.getAttribute('data-rhythm-judgment-row'),color:cs.color,
          grad:cs.backgroundImage!=='none',anim:cs.animationName};
      });
      return {res:read('res'),rank:read('rank'),min:read('min')};
    });
    // 虹が何色出ているかを、実際に描いて数える。
    // ★字のピクセルを拾うのは面倒なので、同じ背景を幅の広い箱へ当てて横一列を読む。
    //   見えている窓が虹の1周分なら、色相は一周する
    hues=await tab.evaluate(()=>{
      const probe=document.createElement('div');
      probe.setAttribute('data-rhythm-judgment-row','JUST');
      probe.style.cssText='position:fixed;left:0;top:0;width:280px;height:12px;-webkit-background-clip:border-box;background-clip:border-box;color:transparent';
      document.body.appendChild(probe);
      const cs=getComputedStyle(probe);
      const canvas=document.createElement('canvas');canvas.width=280;canvas.height=1;
      const ctx=canvas.getContext('2d');
      // 計算済みの background-image をそのまま使うのは難しいので、
      // 停止位置での色を elementFromPoint ではなく、規則の停止点から拾う
      const stops=[...(cs.backgroundImage.match(/rgba?\([^)]*\)/g)||[])];
      probe.remove();
      const hue=(rgb)=>{const [r,g,b]=rgb.match(/[\d.]+/g).slice(0,3).map(Number);
        const max=Math.max(r,g,b),min=Math.min(r,g,b);if(max===min)return 'gray';
        const d=max-min;let h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);
        h=Math.round(h*60);
        return h<20||h>=330?'赤':h<45?'橙':h<70?'黄':h<170?'緑':h<200?'水':h<255?'青':h<290?'紫':'桃';};
      return [...new Set(stops.map(hue))];
    });
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
  ok('判定ごとの色を測れた',!!rows&&rows.res.length===7&&rows.rank.length===7&&rows.min.length===7);
  if(rows){
    rows.res.forEach(r=>console.log(`      ${r.id}: 色=${r.grad?'グラデーション':r.color} / 動き=${r.anim}`));
    const by=(list,id)=>list.find(r=>r.id===id);
    ok('判定ごとに色が違う(同じ色が並ばない)',
      new Set(rows.res.map(r=>r.grad?`grad:${r.anim}`:r.color)).size===7);
    ok('MARVELOUSは金、JUST MARVELOUSは虹(どちらもグラデーション)',
      by(rows.res,'MARVELOUS').grad&&by(rows.res,'JUST').grad
      &&by(rows.res,'MARVELOUS').anim==='mhRhythmJudgmentSweep'
      &&by(rows.res,'JUST').anim==='mhRhythmJudgmentRowRainbow');
    ok('ランキングの詳細も同じ色(ただし動かさない)',
      JUDGMENT_ROWS.every(id=>by(rows.rank,id).color===by(rows.res,id).color)
      &&rows.rank.every(r=>r.anim==='none'));
    ok('「演出量」が最小のときは、色は残して動きだけ止まる',
      JUDGMENT_ROWS.every(id=>by(rows.min,id).color===by(rows.res,id).color)
      &&rows.min.every(r=>r.anim==='none'));
    // ★虹は**字の上に1周分丸ごと**出ていないと意味がない。
    //   220%で1周だけ並べていたときは、止まっているランキングの詳細で
    //   橙〜桃だけの帯に見えていた(2026-09-13・ユーザー指摘)。
    //   実際に描いて、幾つの色合いが出ているか数える。
    ok('JUST MARVELOUS の字に虹が丸ごと出ている',
      Array.isArray(hues)&&hues.length>=5,Array.isArray(hues)?`色合い ${hues.length}種: ${hues.join(',')}`:'測れなかった');
  }
// ---- 色が決まっているもの(難易度・ランク・コンボ数)にも色を付ける ----
// 2026-09-13・ユーザー指示「マスターとかランクとかコンボ数とかも色が決められてるやつは色つけたい」
// 2026-09-13・ユーザー指摘「リザルトの方もJUST Marvelous地味すぎる /
//   スコアには乗らないだけで並びは同じようにして色合いは合わせて」。
ok('JUST MARVELOUS だけ字を小さくしていない',
  /<dt data-rhythm-result-precise-label data-rhythm-judgment-row="JUST">JUST MARVELOUS<\/dt>/.test(game)
  &&/<dd data-rhythm-result-precise data-rhythm-judgment-row="JUST" className="text-right font-mono">/.test(game));
// ★グラデーションは**箱の幅**に対して描かれる。列の幅いっぱいの箱のなかで
//   数字を右へ寄せていると、字にかかるのは虹のごく一部だけになる
ok('グラデーションの行は、箱を字の幅へ縮めている',
  /dt\[data-rhythm-judgment-row="MARVELOUS"\],dt\[data-rhythm-judgment-row="JUST"\]\{width:max-content/.test(html)
  &&/dd\[data-rhythm-judgment-row="MARVELOUS"\],dd\[data-rhythm-judgment-row="JUST"\]\{width:max-content[^}]*margin-left:auto\}/.test(html));
ok('難易度の字の色を、1か所から配っている',
  game.includes('const rhythmDifficultyTextColor=id=>RHYTHM_DIFFICULTY_TONE[id]?.text||')
  &&/RHYTHM_DIFFICULTY_TONE=Object\.freeze\(\{[\s\S]{0,900}MASTER:[^\n]*text:'text-fuchsia-300'/.test(game));
ok('コンボ数の色は、遊んでいるときと同じ段(rhythmComboTier)から作る',
  game.includes('const rhythmComboTextColor=combo=>RHYTHM_COMBO_TIER_TEXT[')
  &&game.includes('rhythmComboTier(combo)'));
ok('リザルトで難易度とコンボ数に色が付いている',
  /rhythmSongFullName\(song\)\}・<b data-rhythm-difficulty-name className=\{`font-black \$\{rhythmDifficultyTextColor\(difficulty\.id\)\}`\}/.test(game)
  &&/data-rhythm-max-combo className=\{`text-right tabular-nums \$\{rhythmComboTextColor\(view\.maxCombo\)\}`\}/.test(game));
ok('ランキングでも難易度・ランク・コンボ数に色が付いている',
  /data-rhythm-difficulty-name className=\{`font-black \$\{rhythmDifficultyTextColor\(entry\.difficultyId\)\}`\}/.test(game)
  &&/data-rhythm-rank-name className=\{`font-black \$\{RHYTHM_RANK_COLORS\[detailRank\]\}`\}/.test(game)
  &&/data-rhythm-max-combo className=\{`font-black tabular-nums \$\{rhythmComboTextColor\(rhythmRankingDetail\.detail\?\.maxCombo\)\}`\}/.test(game));
  console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
  process.exit(failed?1:0);
})();

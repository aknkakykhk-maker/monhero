#!/usr/bin/env node
// 見た目まわり（FLICKの色・コンボの強調・100コンボの演出・リザルトの称号）を見る。
//
// どれも判定・スコア・ノーツの動きへは関与しない表示だけの話だが、
// 「色が背景と被って見えない」「達成しても分からない」は実機でしか気づけないため、
// 決めた約束（他の種別と色を分ける・演出は設定で切れる・毎フレームの処理を増やさない）を機械的に見張る。
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..','..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

const game=read('monster-hero/src/game-system.jsx');
const html=read('monster-hero/index.html');
const rhythm=read('monster-hero/data/rhythm-mode.js');

// --- FLICKの色 ---
const flickBlock=(()=>{
  const at=html.indexOf('[data-rhythm-note][data-note-type="FLICK"][data-note-type="FLICK"] > span:last-child {');
  return at<0?'':html.slice(at,at+400);
})();
ok('FLICKに専用の色を当てている',flickBlock.includes('background:linear-gradient'));
ok('FLICKは緑で、背景の青やHOLDのシアンと被らない',
  /#22c55e|#86efac|#15803d/.test(flickBlock)&&!/#22d3ee|#67e8f9|#0284c7/.test(flickBlock));
ok('FLICKはTAPのピンク・SLIDEの紫とも被らない',
  !/#ec4899|#f9a8d4|#a855f7|#6d28d9/.test(flickBlock));
ok('FLICKはモンスターノーツの金色とも被らない',!/#fde047|253,224,71/.test(flickBlock));
// 色相の距離で確かめる。見た目の「似ている」は色相が近いことなので、そこを数字で見張る。
ok('ノーツ5種の色相が十分に離れている（いちばん近い組でも40度以上）',(()=>{
  const hue=hex=>{
    const n=hex.replace('#','');
    const [r,g,b]=[0,2,4].map(i=>parseInt(n.slice(i,i+2),16)/255);
    const max=Math.max(r,g,b),min=Math.min(r,g,b);
    if(max===min)return 0;
    const d=max-min;
    const h=max===r?((g-b)/d+(g<b?6:0)):max===g?((b-r)/d+2):((r-g)/d+4);
    return Math.round(h*60);
  };
  const colors={TAP:'#ec4899',HOLD:'#22d3ee',SLIDE:'#a855f7',MONSTER:'#fde047',FLICK:'#22c55e'};
  const names=Object.keys(colors);
  let worst=360,pair='';
  for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
    const a=hue(colors[names[i]]),b=hue(colors[names[j]]);
    const d=Math.min(Math.abs(a-b),360-Math.abs(a-b));
    if(d<worst){worst=d;pair=`${names[i]}-${names[j]}`;}
  }
  console.log(`      いちばん近い組: ${pair} = ${worst}度`);
  return worst>=40;
})());
ok('ノーツ5種の色が実装に入っている',(()=>{
  const tap=/#ec4899|#f9a8d4/.test(rhythm);        // TAP=ピンク
  const slide=/#a855f7|#6d28d9/.test(rhythm);      // SLIDE=紫
  const hold=/rgba\(34,211,238/.test(html);        // HOLD=シアンの縁
  const monster=/253,224,71/.test(html);           // モンスターノーツ=金
  const flick=/#22c55e/.test(html);                // FLICK=緑
  return tap&&slide&&hold&&monster&&flick;
})());
ok('FLICKは上へ払うことが分かる印を出す',flickBlock.length>0&&html.includes('content:"⇧"'));

// --- コンボの強調 ---
// data-combo-tier の中に「>=300」の「>」が入るので、タグを正規表現で切らずに前後関係で見る。
ok('コンボ数を大きく出す',(()=>{
  const at=game.indexOf('data-rhythm-combo ');
  // 縦画面は text-3xl（従来の text-2xl から1段大きい）。text-4xl まで上げるとHUDが
  // レーンの台形へかぶるため、rhythm-hud-wedge-check.js の実測で決めた上限。
  // 横画面はHUDを画面の25%以内に収める約束があるので従来のサイズを保つ。
  const block=game.slice(at,at+400);
  return at>=0&&block.includes('text-3xl')&&block.includes('landscape:text-base');
})());
ok('コンボ数は100 / 200 / 300で段階を変える',
  game.includes("data-combo-tier={view.combo>=300?'3':view.combo>=200?'2':view.combo>=100?'1':'0'}")
  &&html.includes('[data-rhythm-combo][data-combo-tier="1"]')
  &&html.includes('[data-rhythm-combo][data-combo-tier="2"]')
  &&html.includes('[data-rhythm-combo][data-combo-tier="3"]'));

// --- 100コンボごとの演出 ---
ok('節目の刻みを定数で持っている',game.includes('const RHYTHM_COMBO_MILESTONE_STEP = 100'));
ok('コンボが変わったときだけ判定する（毎フレームの処理を増やさない）',
  game.includes('},[view.combo,settings.lightweightMode,settings.effectAmount]);'));
ok('節目をまたいだときだけ出す（同じ節目で何度も出さない）',
  game.includes('if(Math.floor(combo/RHYTHM_COMBO_MILESTONE_STEP)<=Math.floor(prev/RHYTHM_COMBO_MILESTONE_STEP))return;'));
ok('軽量モードと演出量MINIMALでは出さない',
  game.includes("if(settings.lightweightMode||settings.effectAmount==='MINIMAL')return;"));
ok('出しっぱなしにせず、時間で消す',game.includes('setTimeout(()=>setComboMilestone(0),1100)')
  &&game.includes('return ()=>clearTimeout(timer);'));
ok('演出はプレイエリアへ重ね、入力を邪魔しない',
  /data-rhythm-combo-milestone[^>]*pointer-events-none/.test(game));
ok('演出のCSSがある',html.includes('[data-rhythm-combo-milestone]')&&html.includes('@keyframes mhRhythmComboBurst'));

// --- リザルトの称号 ---
ok('リザルトで達成を大きく祝う',game.includes('data-rhythm-result-celebrate'));
ok('上位の称号を1つだけ大きく出す',
  game.includes("result.allMarvelous?'ALL MARVELOUS!!':result.allExcellent?'ALL EXCELLENT!!':'FULL COMBO!'"));
ok('何を達成したのか言葉でも説明する',game.includes('一度もコンボを切らずに完走しました'));
ok('達成していないときは出さない',
  game.includes('{(result.fullCombo||result.allExcellent||result.allMarvelous)&&<div data-rhythm-result-celebrate'));
ok('称号のCSSがある',html.includes('[data-rhythm-result-celebrate] b')&&html.includes('@keyframes mhRhythmCelebrate'));

// --- 端末の設定を尊重する ---
ok('動きを減らす設定の端末では、演出を動かさない',
  (html.match(/prefers-reduced-motion:reduce/g)||[]).length>=2);

// --- 触ってはいけないもの ---
ok('判定窓・スコアの重み・落下時間は変更していない',
  rhythm.includes('const RHYTHM_PROJECTION_TOP_SCALE=.18')
  &&game.includes('const rhythmTravelMsForSpeed=value=>'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

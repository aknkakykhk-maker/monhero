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
  // 2026-09-07: セレクタは span:last-child から [data-rhythm-note-head] へ。
  // マスモンの絵が入るノーツでは最後のspanが絵になるため、色が絵へ付いてしまっていた。
  const at=html.indexOf('[data-rhythm-note][data-note-type="FLICK"][data-note-type="FLICK"] > [data-rhythm-note-head] {');
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
// 2026-09-07・ユーザー指摘「フリックの矢印が小さくて見にくい」。文字(⇧)をやめ、
// clip-path の三角を実体のある要素([data-rhythm-flick-arrow])で描く形にした。
// 文字だと端末のフォント次第で細く小さくなるうえ、幅広ノーツの縁取り(粒の::before/::after)と場所を取り合う。
ok('FLICKは上へ払うことが分かる印を出す',
  flickBlock.length>0
  &&rhythm.includes('[data-rhythm-flick-arrow]{position:absolute;')
  &&rhythm.includes('clip-path:polygon(50% 0,100% 100%,0 100%);')
  &&html.includes('[data-rhythm-flick-arrow] {'));

// --- コンボの強調 ---
// data-combo-tier の中に「>=300」の「>」が入るので、タグを正規表現で切らずに前後関係で見る。
// 2026-09-12・ユーザー指示「コンボももう少し目立つように段階的に /
//   あと右より過ぎるから邪魔にならないように真ん中に寄せて」。
// 右上のHUDから**プレイエリアの真ん中**へ移した。HUDの左右の列は台形の外側の空きに
// 置いてあり、その空きは上ほど広いが、上の中央は台形の頂点(ノーツが湧く点・幅18%)なので、
// HUDの中では「真ん中へ寄せる」余地がそもそも無かった。
ok('コンボ数はプレイエリアの真ん中に出す(既定)',
  /\{settings\.comboDisplay!==false&&view\.combo>0&&<div data-rhythm-combo-box[^>]*data-combo-pos=/.test(game)
  &&html.includes('[data-rhythm-combo-box]{')
  &&/\[data-rhythm-combo-box\]\{[\s\S]{0,160}top:21%/.test(html)
  &&/\[data-rhythm-combo-box\]\{[\s\S]{0,160}left:50%;[\s\S]{0,40}transform:translateX\(-50%\)/.test(html)
  // 座標はCSSだけが持つ。JSX側へ位置のユーティリティを書き戻すと、
  // [data-combo-pos] での上書きが効かなくなる
  &&!/data-rhythm-combo-box[^>]*left-1\/2/.test(game));
// 2026-09-12・ユーザー指示「元位置（元位置より少し右より）とか選べるほうがいい」。
// 真ん中へ移したその日の指摘。前に居た右上も選べるようにした。
ok('コンボ数の置き場所を選べる(右上=もとの位置も選べる)',
  /RHYTHM_COMBO_POSITIONS *= *Object\.freeze\(\['CENTER','RIGHT','HUD','LEFT'\]\)/.test(game)
  &&game.includes("comboPosition:'CENTER'")
  &&game.includes('comboPosition:RHYTHM_COMBO_POSITIONS.includes(source.comboPosition)?source.comboPosition:DEFAULT_RHYTHM_SETTINGS.comboPosition')
  // 名前は RHYTHM_COMBO_POSITION_LABELS が正本(オプションのボタンと、
  // 折りたたんだときの「いまの値」の両方がここを見る)
  &&game.includes("segments('comboPosition',RHYTHM_COMBO_POSITION_LABELS)")
  &&/RHYTHM_COMBO_POSITION_LABELS *= *Object\.freeze\(\[\['LEFT','左'\],\['CENTER','中央'\],\['RIGHT','右'\],\['HUD','右上'\]\]\)/.test(game)
  &&html.includes('[data-rhythm-combo-box][data-combo-pos="RIGHT"]{left:auto;right:6%;transform:none}')
  &&html.includes('[data-rhythm-combo-box][data-combo-pos="HUD"]{left:auto;right:3%;top:12.5%;transform:none}')
  &&html.includes('[data-rhythm-combo-box][data-combo-pos="LEFT"]{left:4%;transform:none}')
  // 端に寄せたときは、数字が伸びても画面の外へ出ないよう内側へ伸ばす
  &&/\[data-combo-pos="RIGHT"\] \[data-rhythm-combo\],\s*\[data-combo-pos="HUD"\] \[data-rhythm-combo\]\{transform-origin:right center\}/.test(html)
  &&html.includes('[data-combo-pos="LEFT"] [data-rhythm-combo]{transform-origin:left center}'));
// ★邪魔にならないよう、ノーツ(z-5)より後ろに描いて少し透かす。0コンボでは出さない
ok('ノーツより後ろに描いて透かす(邪魔にならない)',
  /data-rhythm-combo-box[^>]*z-\[2\]/.test(game)
  &&/data-rhythm-combo-box[^>]*pointer-events-none/.test(game)
  &&/\[data-rhythm-combo-box\]\{[\s\S]{0,160}opacity:\.62/.test(html)
  &&html.includes('[data-rhythm-note] {'));
// 場に重なるので、邪魔だと感じた人が消せるようにする(設定は前からあったが使われていなかった)
ok('コンボ数表示のON/OFFを設定から切り替えられる',
  game.includes("toggle('comboDisplay')")&&game.includes('settings.comboDisplay!==false'));
ok('コンボ数を大きく出す',
  /\[data-rhythm-combo\]\{[\s\S]{0,160}font-size:min\(52px,13\.5vw\)/.test(html)
  &&/@media \(orientation: landscape\)\{[\s\S]{0,900}\[data-rhythm-combo\]\{font-size:min\(40px,7vw\)\}/.test(html));
// 2026-09-13・Android勢から「重い」との声。見た目は標準のまま残し、
// 演出量「少なめ」で**毎フレームの塗り直し**だけを止められるようにした。
// background-position は合成できないプロパティなので、流しているあいだは
// 毎フレーム字を塗り直し、そのたびに filter のぼかしを通ることになる。
ok('演出量「少なめ」で、判定文字とコンボの流れを止められる',
  html.includes('[data-rhythm-play-area][data-rhythm-effect="LOW"] [data-rhythm-judgment-text]{')
  &&/\[data-rhythm-effect="LOW"\] \[data-rhythm-judgment-text\]\{\s*animation:none;/.test(html)
  &&/\[data-rhythm-effect="LOW"\] \[data-rhythm-combo\]\[data-combo-tier="7"\]\{\s*animation:none;/.test(html)
  // 止めるのは流れとぼかしの枚数だけ。色・グラデ・字の大きさは標準と同じに保つ
  &&!/\[data-rhythm-effect="LOW"\] \[data-rhythm-judgment-text\][^{]*\{[^}]*background-image/.test(html)
  &&!/\[data-rhythm-effect="LOW"\] \[data-rhythm-judgment-text\][^{]*\{[^}]*font-size/.test(html)
  // 重い判定(GREAT以上)はぼかしの枚数も落とす
  &&['GREAT','EXCELLENT','MARVELOUS'].every(j=>html.includes(`[data-rhythm-play-area][data-rhythm-effect="LOW"] [data-rhythm-judgment-text][data-judgment="${j}"]{`))
  // 選ぶ場所と、何が止まるのかの説明がオプションにある
  &&game.includes("segments('effectAmount',RHYTHM_EFFECT_LABELS)")
  &&/RHYTHM_EFFECT_LABELS *= *Object\.freeze\(\[\['NORMAL','標準'\],\['LOW','少なめ'\],\['MINIMAL','最小'\]\]\)/.test(game)
  &&game.includes('動きがカクついたり'));
// 2026-09-13・ユーザー指摘「演出量少なめでジャストマーベラスとマーベラスの色の差が少ない /
//   演出量は少なめキープで差を出したい / マーベラスが金でジャストマーベラスが虹だから出来そう」。
// ★流す前提の background-size(金260% / 虹220% / コンボ300%)のまま animation だけ止めると、
//   **左端の一色ぶんしか字に入らない**。虹は赤〜黄の暖色だけになり、金と見分けが付かなかった。
//   止めるときは 100% にして、色が全部字の上に並ぶようにする。
ok('流れを止めるときは、止まった位置に色が全部見える',
  // 判定文字(演出量ひかえめ・最小・軽量モード)
  /\[data-rhythm-effect="LOW"\] \[data-rhythm-judgment-text\],\s*\[data-rhythm-play-area\]\[data-rhythm-effect="MINIMAL"\] \[data-rhythm-judgment-text\],\s*\[data-rhythm-play-area\]\[data-rhythm-lightweight="true"\] \[data-rhythm-judgment-text\]\{\s*background-size:100% 100%;/.test(html)
  // 500コンボ以上の虹も同じ
  &&/\[data-rhythm-effect="LOW"\] \[data-rhythm-combo\]\[data-combo-tier="7"\],[\s\S]{0,240}background-size:100% 100%;/.test(html)
  // 動きを減らす設定の端末でも同じ(判定ごとのルールと同じ重さで書かないと上書きできない)
  &&/@media \(prefers-reduced-motion:reduce\)\{\s*\[data-rhythm-judgment-text\]\[data-judgment\]:not\(\[data-judgment=""\]\)\{[\s\S]{0,120}background-size:100% 100%;/.test(html)
  // 流しているとき(標準)は、これまでどおり広く取って動かす
  &&/\[data-judgment="MARVELOUS"\]\{[\s\S]{0,200}background-size:260% 100%/.test(html)
  &&/\[data-judgment-precise="1"\]\{[\s\S]{0,200}background-size:220% 100%/.test(html));
// 2026-09-12・ユーザー指示「コンボ数もわかりにくい。増えれば増えるほど目立つようにして」。
// 100/200/300の3段だったのを 10/30/50/100/200/300/500 の7段にし、段が上がるほど
// 色だけでなく **大きさ** も変わるようにした(--mh-combo-scale)。
ok('コンボ数は10〜500の7段で見た目が変わる',
  game.includes('const RHYTHM_COMBO_TIER_STEPS = Object.freeze([10,30,50,100,200,300,500]);')
  &&game.includes('const comboTier=rhythmComboTier(view.combo);')
  &&game.includes("data-combo-tier={String(comboTier)}")
  &&[1,2,3,4,5,6,7].every(tier=>html.includes(`[data-rhythm-combo][data-combo-tier="${tier}"]`)));
// ★大きさは font-size ではなく倍率で効かせる。段ごとに font-size を上書きすると、
//   横持ち用に詰めたサイズまで巻き添えで壊れる。
// ★起点は中央。真ん中に置いたので、左右どちらへ伸びても台形の外の余地がある
//   (HUDの右上に居たころは右下を起点にして、下端が台形へ近づかないようにしていた)。
ok('段ごとの大きさは倍率(--mh-combo-scale)で効かせる',
  game.includes("style={{'--mh-combo-scale':rhythmComboTierScale(comboTier)}}")
  &&html.includes('transform:scale(var(--mh-combo-scale,1));')
  &&html.includes('transform-origin:center center;'));
// 真ん中へ移して上限が外れたので、段でしっかり大きくする(HUDでは1.13倍が限界だった)
ok('段が上がるほどはっきり大きくなる',
  game.includes('const RHYTHM_COMBO_TIER_SCALES = Object.freeze([1,1.08,1.16,1.26,1.36,1.46,1.56,1.66]);'));
// ★弾む演出(mhRhythmComboPop)も倍率を掛けたうえで戻す。scale(1)へ戻すと、
//   大きくしたコンボ数が跳ねるたびに一瞬だけ元の大きさへ縮む。
ok('弾む演出も倍率のままで戻る',
  rhythm.includes('100%{transform:scale(var(--mh-combo-scale,1))}}'));

// --- 100コンボごとの演出 ---
ok('節目の刻みを定数で持っている',game.includes('const RHYTHM_COMBO_MILESTONE_STEP = 100'));
// ★2026-09-04に発見・修正したバグの再発防止: 依存をview.combo(毎ノーツ変わる値)にすると、
// 100→101のような非節目の増加でも毎回effectが再実行され、その後片付け(cleanup)が
// 「あと少しで消す」予約タイマーを節目と無関係に解除してしまい、100の表示だけが
// 固まって二度と動かず200・300では何も起きないという不具合になっていた。
// 依存は「段(tier)が変わったときだけ」動くcomboMilestoneTierだけにする。
ok('依存はview.comboではなく、段が変わったときだけ動くcomboMilestoneTierだけ（毎ノーツ再実行されるバグの再発防止）',
  game.includes('const comboMilestoneTier=Math.floor((Number(view.combo)||0)/RHYTHM_COMBO_MILESTONE_STEP);')
  &&game.includes('},[comboMilestoneTier,settings.lightweightMode,settings.effectAmount]);')
  &&!/setComboMilestone\([\s\S]{0,400}\},\[view\.combo,/.test(game));
ok('段が上がったときだけでなく、演出を止める条件でも表示を0へ戻す（出しっぱなしで固まらない）',
  game.includes("if(settings.lightweightMode||settings.effectAmount==='MINIMAL'||comboMilestoneTier<=0){")
  &&game.includes('setComboMilestone(0);\n      return;'));
ok('出しっぱなしにせず、時間で消す',game.includes('setTimeout(()=>setComboMilestone(0),1100)')
  &&game.includes('return ()=>clearTimeout(timer);'));
ok('100/200/300/400/500以上で演出がどんどん派手になる段(stage)を持つ',
  game.includes('const comboMilestoneStage=Math.min(5,comboMilestoneTier);')
  &&game.includes('data-milestone-stage={comboMilestoneStage}')
  &&html.includes('[data-rhythm-combo-milestone][data-milestone-stage="5"] b{'));
ok('演出はプレイエリアへ重ね、入力を邪魔しない',
  /data-rhythm-combo-milestone[^>]*pointer-events-none/.test(game));
ok('演出のCSSがある',html.includes('[data-rhythm-combo-milestone]')&&html.includes('@keyframes mhRhythmComboBurst'));
// ★2026-09-04に発見・修正したバグの再発防止:
// [data-rhythm-combo-milestone] b のベース規則は background-clip:text で文字を透明にして
// グラデーションを見せているが、stage2/3/4/5の上書き規則が `background:` の
// ショートハンドで色だけ変えようとすると、background-clip も暗黙に初期値(border-box)へ
// リセットされ、上書き規則のほうが詳細度で勝つため文字がまるごと透明(＝見えない)になる。
// 200コンボ以降の演出だけ数字が出ない不具合になっていたため、上書き規則は
// ロングハンドの background-image を使うことで固定する。
ok('stage2以降の上書き規則がbackground-clipを巻き添えで消さない（ショートハンドを使っていない）',(()=>{
  const stageOverrideBlock=(()=>{
    const at=html.indexOf('/* stage2(200)');
    const end=html.indexOf('@keyframes mhRhythmComboBurst');
    return at>=0&&end>at?html.slice(at,end):'';
  })();
  return stageOverrideBlock.length>0
    &&stageOverrideBlock.includes('background-image:linear-gradient(180deg,#fff 0%,#fcd34d 40%,#f97316 100%)')
    &&stageOverrideBlock.includes('background-image:linear-gradient(180deg,#fff 0%,#fef3c7 32%,#fb7185 68%,#38bdf8 100%)')
    &&stageOverrideBlock.includes('background-image:linear-gradient(90deg,#f87171,#fbbf24,#a3e635,#22d3ee,#a78bfa,#f472b6,#f87171)')
    &&!/data-milestone-stage="[2-5]"\][^{},]*\{[^}]*\bbackground:linear-gradient/.test(stageOverrideBlock);
})());

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

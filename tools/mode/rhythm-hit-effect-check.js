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
vm.runInContext(`${source}\nthis.out={RHYTHM_HIT_EFFECT_POOL,RHYTHM_HIT_SPARK_COUNT,RHYTHM_HIT_EFFECT_MS,rhythmHitEffectColor,RHYTHM_NOTE_SE_RUNTIME,RHYTHM_JUDGMENT_COLORS,rhythmJudgmentColor,RHYTHM_JUDGMENT_RAINBOW,RHYTHM_JUDGMENT_PRECISE_MS,rhythmJudgmentIsPrecise,RHYTHM_JUDGMENTS};`,ctx);
const {RHYTHM_HIT_EFFECT_POOL,RHYTHM_HIT_SPARK_COUNT,RHYTHM_HIT_EFFECT_MS,rhythmHitEffectColor,RHYTHM_NOTE_SE_RUNTIME,RHYTHM_JUDGMENT_COLORS,rhythmJudgmentColor,RHYTHM_JUDGMENT_RAINBOW,RHYTHM_JUDGMENT_PRECISE_MS,rhythmJudgmentIsPrecise,RHYTHM_JUDGMENTS}=ctx.out;

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
// ★monsterHit は 2026-09-13 に「演出量のブロックの外」へ出した(振動をそこへまとめたため)。
//   MISSでは false になるので、鳴らす・光らせるところへは入らない。
check('MISSでは鳴らさない・光らせない',
  game.includes("const monsterHit=judgment!=='MISS'&&!!monsterForNote(note);")
  &&/if\(judgment!=='MISS'\)\{\s*if\(monsterHit\)RHYTHM_NOTE_SE_RUNTIME\.playMonster\(\);/.test(game));

// --- 重くならない作り ---
check('使い回す枚数が決まっている',Number.isInteger(RHYTHM_HIT_EFFECT_POOL)&&RHYTHM_HIT_EFFECT_POOL>=6&&RHYTHM_HIT_EFFECT_POOL<=24,
  `${RHYTHM_HIT_EFFECT_POOL}枚`);
check('モンスターノーツの光はふつうより大きく長い',
  RHYTHM_HIT_EFFECT_MS.MONSTER>=RHYTHM_HIT_EFFECT_MS.NORMAL*2,
  `ふつう${RHYTHM_HIT_EFFECT_MS.NORMAL}ms / モンスター${RHYTHM_HIT_EFFECT_MS.MONSTER}ms`);
check('判定ごとに色が違う',
  new Set(['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD'].map(rhythmHitEffectColor)).size===5);

// ===== 判定の色分け(2026-09-12・ユーザー指示) =====
// 「もっと色分けをして良い判定ならそれだけ派手にしたい / マーベラスは虹など」。
// ★文字と光が別々に色を持っていたのをやめ、1つの表から取るようにした。
//   2か所に分けると、片方だけ直して色がズレる(実際にズレていた)。
const html=read('monster-hero/index.html');
const JUDGMENTS=['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS'];
check('判定の色は1つの表(RHYTHM_JUDGMENT_COLORS)にまとまっている',
  JUDGMENTS.every(id=>/^#[0-9a-f]{6}$/i.test(RHYTHM_JUDGMENT_COLORS[id])));
check('MISSを入れた6判定がすべて違う色',new Set(JUDGMENTS.map(rhythmJudgmentColor)).size===6);
check('判定ラインの光も同じ表から取る',
  JUDGMENTS.every(id=>rhythmHitEffectColor(id)===rhythmJudgmentColor(id)));
// 判定ごとのCSSを切り出す。以降はこの中身だけを見る
const judgmentRule=id=>{
  const head=`[data-rhythm-judgment-text][data-judgment="${id}"]{`;
  const at=html.indexOf(head);
  return at<0?'':html.slice(at,html.indexOf('}',at));
};
check('判定文字の見た目はCSSが持ち、JSXはどの判定かだけを渡す',
  game.includes("data-judgment={view.last||''}")
  && !/data-rhythm-judgment-text[\s\S]{0,400}rhythmJudgmentColor\(view\.last\)/.test(game)
  && !/data-rhythm-judgment-text[\s\S]{0,400}text-fuchsia-100/.test(game));
// ★どれも文字を透かしてグラデーションを敷く(単色＋影だけだと平たく見える、という指摘)
check('どの判定もグラデーションで描く(MISSも含む)',
  JUDGMENTS.every(id=>/background-image:linear-gradient/.test(judgmentRule(id))));
check('透かした文字に text-shadow を使わない(字の形の影が塊で出るため)',
  JUDGMENTS.every(id=>!/text-shadow/.test(judgmentRule(id))));
// ★判定ラインの光の単色(正本)が、文字のグラデーションにも入っていること。
//   ここがズレると「文字と光で色が違う」に逆戻りする
check('文字のグラデーションに、その判定の色がそのまま入っている',
  JUDGMENTS.every(id=>judgmentRule(id).includes(rhythmJudgmentColor(id))),
  JUDGMENTS.filter(id=>!judgmentRule(id).includes(rhythmJudgmentColor(id))).join(',')||'全部そろっている');
// ★上の判定ほど「字が大きい・光の層が多い」
const fontOf=id=>Number(/font-size:(\d+)px/.exec(judgmentRule(id))?.[1]||0);
const glowOf=id=>(judgmentRule(id).match(/drop-shadow\(0 0 /g)||[]).length;
check('上の判定ほど字が大きい',
  fontOf('MARVELOUS')>fontOf('EXCELLENT')&&fontOf('EXCELLENT')>fontOf('GREAT')
  &&fontOf('GREAT')>=fontOf('GOOD')&&fontOf('GOOD')>fontOf('BAD')&&fontOf('BAD')>=fontOf('MISS'),
  JUDGMENTS.map(id=>`${id} ${fontOf(id)}px`).join(' / '));
check('上の判定ほど光の層が多い',
  glowOf('MARVELOUS')>glowOf('EXCELLENT')&&glowOf('EXCELLENT')>glowOf('GREAT')
  &&glowOf('GREAT')>glowOf('GOOD')&&glowOf('GOOD')>glowOf('BAD')&&glowOf('BAD')>glowOf('MISS')
  &&glowOf('MISS')===0,
  JUDGMENTS.map(id=>`${id} ${glowOf(id)}層`).join(' / '));
// ★ふつうのMARVELOUSは金。虹にすると流れる途中の金がEXCELLENTと見分けられなくなる
//   (2026-09-12・ユーザー指摘「普通のマーベラスとエクセレントの色の違いがあまりわからない」)
check('ふつうのMARVELOUSは金で、虹ではない',
  rhythmJudgmentColor('MARVELOUS')==='#fbbf24'
  && !/linear-gradient\(90deg,#f87171/.test(judgmentRule('MARVELOUS'))
  && html.includes('@keyframes mhRhythmJudgmentSweep'));
check('EXCELLENTはピンク紫',rhythmJudgmentColor('EXCELLENT')==='#e879f9');
check('虹はぴったりのMARVELOUSだけ',
  html.includes('[data-rhythm-judgment-text][data-judgment="MARVELOUS"][data-judgment-precise="1"]{')
  && html.includes('@keyframes mhRhythmJudgmentRainbow')
  && RHYTHM_JUDGMENT_RAINBOW.length>=5
  && source.includes("const rainbowHit=!monster&&precise&&judgment==='MARVELOUS';")
  && source.includes('--rhythm-spark-color-1'));
check('演出を減らしても色と大きさは残す(止めるのは動きと強い光だけ)',
  /\[data-rhythm-effect="MINIMAL"\] \[data-rhythm-judgment-text\]\{[\s\S]{0,200}animation:none/.test(html));
// ===== ぴったりのMARVELOUS(2026-09-12・ユーザー指示) =====
// 「マーベラスをさらに完璧なタイミングで踏んだマーベラスを判定の見ためだけさらによくしたい /
//   scoreはかわらず」。
// ★ここがいちばん大事: **見た目だけで、数えるもの・記録には一切入らない。**
const marvelousWindow=RHYTHM_JUDGMENTS.find(item=>item.id==='MARVELOUS').windowMs;
check('ぴったりの幅はMARVELOUSの窓の内側',
  RHYTHM_JUDGMENT_PRECISE_MS>0&&RHYTHM_JUDGMENT_PRECISE_MS<marvelousWindow,
  `±${RHYTHM_JUDGMENT_PRECISE_MS}ms / MARVELOUSは±${marvelousWindow}ms`);
check('ぴったりになるのはMARVELOUSだけ',
  rhythmJudgmentIsPrecise('MARVELOUS',0)===true
  &&rhythmJudgmentIsPrecise('MARVELOUS',RHYTHM_JUDGMENT_PRECISE_MS)===true
  &&rhythmJudgmentIsPrecise('MARVELOUS',-RHYTHM_JUDGMENT_PRECISE_MS)===true
  &&rhythmJudgmentIsPrecise('MARVELOUS',RHYTHM_JUDGMENT_PRECISE_MS+1)===false
  &&['EXCELLENT','GREAT','GOOD','BAD','MISS'].every(id=>rhythmJudgmentIsPrecise(id,0)===false));
check('壊れたズレ・値なしはぴったりにしない',
  rhythmJudgmentIsPrecise('MARVELOUS',NaN)===false&&rhythmJudgmentIsPrecise('MARVELOUS',null)===false
  &&rhythmJudgmentIsPrecise('MARVELOUS',undefined)===false);
// ★スコア・コンボ・ライフ・判定数・FAST/SLOWの数え方へ入れていないこと。
//   2026-09-13にユーザー依頼でリザルトへ**回数だけ**出すようにしたので、
//   「run と result に持たせない」ではなく「**計算と保存へ混ぜない**」を見る。
//   数えるだけなら run に持ってよい(むしろ view へ持たせると叩いた瞬間に落ちる)。
check('ぴったりはスコア・判定数・コンボ・ライフの計算へ混ぜない',
  game.includes('const preciseHit=rhythmJudgmentIsPrecise(judgment,deltaMs);')
  // 判定数(counts)はそのまま。ぴったりは別の数として持つ
  &&game.includes('run.counts[judgment]++;if(preciseHit)run.precise++;')
  &&!/counts\[[^\]]*precise/i.test(game)
  // スコア・コンボ・ライフの計算へは渡らない
  &&!/rhythmCalculateScore\(\{[^}]*precise/i.test(game)
  &&!/rhythmComboAfter\([^)]*precise/i.test(game)
  &&!/rhythmLifeAfterWithMonsterAbilities\([^)]*precise/i.test(game));
check('ぴったりは自己ベストの保存へ入れない(保存形式を変えない)',
  !/normalizeRhythmBestRecord\(\{[\s\S]{0,400}precise/.test(game)
  // mergeRhythmBestRecord はキーを選んで写す。ここへ precise が増えていないこと
  &&!/const mergeRhythmBestRecord[\s\S]{0,700}precise/.test(game));
check('ぴったりは表示だけへ渡す(viewと演出)',
  game.includes('lastPrecise:preciseHit')
  &&game.includes("data-judgment-precise={view.lastPrecise?'1':''}")
  &&game.includes('precise:preciseHit'));
// 印は次の判定へ持ち越さない(消すときも一緒に落とす)
check('判定表示を消すときに、ぴったりの印も落とす',
  game.includes("setView(v=>({...v,last:'',lastPrecise:false,fastSlow:''}))")
  &&game.includes("const initialView=()=>({status:'loading',score:0,combo:0,maxCombo:0,last:'',lastPrecise:false,"));
check('ぴったりのときだけ見た目が強くなる(文字と光)',
  html.includes('[data-rhythm-judgment-text][data-judgment="MARVELOUS"][data-judgment-precise="1"]{')
  &&html.includes('[data-rhythm-hit-effect][data-hit-precise="1"]>i{')
  &&source.includes("item.dataset.hitPrecise=rainbowHit?'1':''")
  &&source.includes("(rainbowHit?'1.45':'1')"));

// モンスターノーツは金色が特別扱い。虹で上書きしない
check('モンスターノーツは金色のまま(虹で上書きしない)',
  source.includes("monster?'#fde047':rhythmHitEffectColor(judgment)")
  && source.includes("rainbowHit?color:'var(--rhythm-hit-color,#fff)'")
  && source.includes("item.dataset.hitJudgment=monster?'':String(judgment||'')"));
// 判定ラインの光も、上の判定ほど明るくする
check('判定ラインの光も上の判定ほど明るい',
  source.includes('[data-rhythm-hit-effect][data-hit-judgment="MARVELOUS"]>i,')
  && source.includes('[data-rhythm-hit-effect][data-hit-judgment="EXCELLENT"]>i,'));
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
  game.includes("restarts.push({el:comboText,attr:'rhythmComboPop'})")
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
check('モンスターノーツだけ画面を一瞬染める',game.includes("restarts.push({el:screenFlashRef.current,attr:'rhythmFlash'})"));
check('モンスターノーツを取ると、そのマスモンが大きく跳ねる',
  game.includes("restarts.push({el,attr:'rhythmSideHit'})")
  &&source.includes('[data-rhythm-side-monster][data-rhythm-side-hit="1"]{animation:mhRhythmSideCheer'));
check('跳ね方は transform だけ',(()=>{
  const cheer=keyframeBodies(source).find(entry=>entry.name==='mhRhythmSideCheer')?.body||'';
  return cheer.length>0&&!/filter|box-shadow|background/.test(cheer)&&/transform:/.test(cheer);
})());
check('判定文字も一度だけ弾む',
  game.includes("restarts.push({el:judgmentText,attr:'rhythmJudgmentPop'})")
  &&source.includes('[data-rhythm-judgment-text][data-rhythm-judgment-pop="1"]{animation:mhRhythmJudgmentPop'));

// --- 2026-09-12 強制レイアウト(void offsetWidth)の回数 ---
// 【ユーザー指摘】「モンスターノーツでかくつきがまた出てきた」
//
// 印を付け直してCSSアニメーションを流し直すために void el.offsetWidth を読むと、
// その場でページ全体のレイアウトが計算し直される(強制同期レイアウト)。
// 直す前は箇所ごとに書いていたので、モンスターノーツを取った1フレームで**5回**走っていた
// (ヒット演出 / 画面フラッシュ / マスモンの歓声 / 判定文字 / コンボ数)。
// いまは rhythmRestartAnimations がまとめて1回にする。箇所ごとに書き足すと元へ戻るので見張る。
check('印の付け直しは1か所へまとめる(rhythmRestartAnimations を呼ぶ)',
  game.includes('rhythmRestartAnimations(restarts)')
  &&source.includes('const rhythmRestartAnimations=entries=>{'));
// 2026-09-25: 読むものを offsetWidth(レイアウトまで計算させる)から getComputedStyle の
// animationName(スタイルだけ)へ替えた。アニメーションの付け外しはスタイルの計算だけで決まる。
check('まとめ処理はスタイルを1回だけ確定させ、レイアウトは読まない',(()=>{
  const start=source.indexOf('const rhythmRestartAnimations=entries=>{');
  if(start<0)return false;
  const body=source.slice(start,source.indexOf('\n};',start));
  return (body.match(/getComputedStyle\(/g)||[]).length===1&&!/offsetWidth|offsetHeight|getBoundingClientRect/.test(body.replace(/\/\/[^\n]*/g,''));
})());
check('演奏中の判定処理に offsetWidth の読み取りを残さない',
  !/void\s+[A-Za-z_$][\w$.]*\.offsetWidth/.test(game.slice(game.indexOf('const applyJudgment'),game.indexOf('const applyJudgment')+9000)),
  'applyJudgment の中');
// --- 2026-09-26 判定文字の光を焼いた絵で出す ---
// 判定文字の光(drop-shadow を最大6枚)を、判定のたびにぼかし直していた(演出量「多め」「最大」で弾むたびに
// 大きなレイヤーを作り直すので、実測で描画が20倍以上になっていた)。光は演奏前に1枚の絵へ焼き、
// 字は ::after に重ね直す。ここが崩れると、また毎回ぼかしを計算し直す。
check('判定文字の光を焼いて出す(焼いた判定だけ目印を付け、本体のぼかしを外す)',
  game.includes('const rhythmBakeJudgmentHalos=async(textEl,maxScale=2)=>{')
  &&game.includes("haloKeys.has(`${view.last}|${view.lastPrecise?'1':''}`)?'1':undefined}")
  &&html.includes('[data-rhythm-judgment-text][data-halo="1"]{position:relative;z-index:0;filter:none!important}'));
check('重ね直した字は模様の位置を本体から受け継ぐ(金・虹の流れがそのまま動く)',
  /\[data-rhythm-judgment-text\]\[data-halo="1"\]::after\{[\s\S]{0,200}content:attr\(data-judgment\)[\s\S]{0,300}background-position:inherit/.test(html));
check('焼くときの影の読み取りは drop-shadow 以外が混ざれば焼かない',
  game.includes('const rhythmParseDropShadows=filter=>{')&&game.includes('return rest?null:list;'));
check('ヒット演出は呼び出し側のまとめへ譲れる(defer)',
  source.includes("if(defer)return {el:item,attr:'rhythmHitKind',value:kind};")
  // 2026-09-12: ぴったりのMARVELOUS(precise)を渡すようになったので、その間へ入る
  &&game.includes('monster:bigMonsterEffect,precise:preciseHit,defer:true')
  // 段は順位でくらべる(2026-09-13。名前を並べてくらべていたせいで、あとから足した
  // 「最小」が素通りし、いちばん軽い段でモンスターノーツの大きな光が出ていた)
  &&game.includes("const bigMonsterEffect=monsterHit&&!rhythmMonsterEffectAtMost(monsterEffect,'OFF');"));

// --- 判定まわりを変えていない ---
check('判定窓・スコア・コンボの計算に触っていない',
  !/rhythmSpawnHitEffect[^\n]*(score|combo|life|judgeTap|judgeRelease)/i.test(game)
  &&ctx.out.RHYTHM_NOTE_SE_RUNTIME&&vm.runInContext('RHYTHM_RELEASE_MAX_MS',ctx)===185
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
// ---- WebGL で描くときの光(2026-09-26)。canvas 側の動きが CSS と同じ数字のままか ----
// 検証用に WebGL で描くときだけ、叩いたときの光を部品ではなく canvas で描く(RHYTHM_CANVAS_RENDERER の HIT_KEYS)。
// CSS の @keyframes だけ直すと、WebGL のときだけ見た目がずれる。キーフレームの位置・不透明度・拡大・回転と、
// 粒の飛ぶ向き・タイミング関数が一致しているかを見る。
{
  const keysText=(source.match(/const HIT_KEYS=(\{[\s\S]*?\n  \});/)||[])[1];
  let hitKeys=null;try{hitKeys=keysText?vm.runInNewContext(`(${keysText})`):null;}catch(e){hitKeys=null;}
  check('canvas 側の光の動き(HIT_KEYS)を読めた',!!hitKeys);
  const cssFrames=name=>{
    const m=source.match(new RegExp(`@keyframes ${name}\\{([\\s\\S]*?)\\}\\}`));if(!m)return null;
    return [...(m[1]+'}').matchAll(/([\d.]+)%\{([^}]*)\}/g)].map(([,pct,body])=>{
      const out={t:Number(pct)/100,o:Number((body.match(/opacity:([\d.]+)/)||[])[1])};
      const sc=body.match(/scale\(([-\d.]+)(?:,([-\d.]+))?\)/);if(sc){out.sx=Number(sc[1]);out.sy=sc[2]!==undefined?Number(sc[2]):Number(sc[1]);}
      const rot=body.match(/rotate\(([-\d.]+)deg\)/);if(rot)out.r=Number(rot[1]);
      return out;});
  };
  const same=(a,b)=>Math.abs(a-b)<1e-9;
  const compare=(name,key,fields)=>{
    const css=cssFrames(name),canvasKeys=hitKeys&&hitKeys[key];
    const ok=!!css&&!!canvasKeys&&css.length===canvasKeys.length&&css.every((frame,i)=>same(frame.t,canvasKeys[i][0])&&fields.every(field=>{
      const cssValue=field==='s'?frame.sx:frame[field];return cssValue===undefined?canvasKeys[i][1][field]===undefined||same(canvasKeys[i][1][field],0):same(cssValue,canvasKeys[i][1][field]);}));
    check(`光の動きが CSS と同じ: ${name}`,ok);
  };
  compare('mhRhythmHitCore','core',['o','sx','sy']);
  compare('mhRhythmHitBeam','beam',['o','sx','sy']);
  compare('mhRhythmHitCoreBig','coreBig',['o','sx','sy']);
  compare('mhRhythmHitBeamBig','beamBig',['o','sx','sy']);
  compare('mhRhythmHitFlare','flare',['o','sx','sy','r']);
  compare('mhRhythmHitSpark','spark',['o','s']);
  const cssSparks=[1,2,3,4,5].map(n=>{const m=source.match(new RegExp(`\\[data-rhythm-hit-effect\\]>u:nth-of-type\\(${n}\\)\\{--rhythm-spark-x:([-\\d.]+)px;--rhythm-spark-y:([-\\d.]+)px\\}`));return m?[Number(m[1]),Number(m[2])]:null;});
  const canvasSparks=(source.match(/const HIT_SPARK_OFFSETS=(\[[^;]*\]);/)||[])[1];
  check('粒の飛ぶ向きが CSS と同じ',!!canvasSparks&&JSON.stringify(cssSparks)===JSON.stringify(JSON.parse(canvasSparks)));
  check('タイミング関数が CSS と同じ(cubic-bezier(.16,.9,.3,1))',
    source.includes('cubic-bezier(.16,.9,.3,1)')&&/const hitEase=\(\(\)=>\{const x1=\.16,y1=\.9,x2=\.3,y2=1,/.test(source));
  check('WebGL で描けたときだけ光を canvas へ回す(2D の canvas・DOM 版は部品のまま)',
    game.includes("RHYTHM_CANVAS_RENDERER.enableHits(RHYTHM_CANVAS_RENDERER.backend==='webgl'?playAreaRef.current:null);")
    &&/const rhythmSpawnHitEffect=[^\n]*\n[\s\S]{0,400}RHYTHM_CANVAS_RENDERER\.hitsFor\(area\)/.test(source));
  // 描き始め(begin) → 叩いたときの光(drawHits) → ノーツ(drawNote) の順。間に道の演出(drawRoadFx。光より下)が入ってよい
  {const begin=game.indexOf('RHYTHM_CANVAS_RENDERER.begin('),hits=game.indexOf('if(canvasReady)RHYTHM_CANVAS_RENDERER.drawHits(travel.hitY);'),note=game.indexOf('RHYTHM_CANVAS_RENDERER.drawNote(');
  check('光はノーツより先に描く(光の層はノーツの canvas の下)',begin>=0&&hits>begin&&note>hits);}
}

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

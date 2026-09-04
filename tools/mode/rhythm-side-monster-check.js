#!/usr/bin/env node
// プレイ画面の両サイドへ出すマスモンを確かめる。
//
// ユーザー指示(2026-09-05)「画面の空いてる両サイドに設定してるマスモンを出して
// 音にあわせてピョンピョンするとか可能？ これも重くなる原因になる？
// あとはモンスターノーツを踏んで効果が聞いてる間はそのマスモンで画面的にわかるようにするとか」
// 「オプションで表示なしとか薄くするとか動かないとかそういうのを色々設定できるようにすればいい」
//
// カクつきは**発熱の影響がいちばん大きい**という前提で作っている。発熱時に効くのは
// 「毎フレームの塗り直しを増やさない」ことなので、次を機械的に見張る。
//
//   ・動かすのは transform と opacity だけ(影・ぼかし・色を毎フレーム変えない)
//   ・跳ねるのはCSSアニメーションで、毎フレームのJSを増やさない
//   ・能力中の強調は「変わった瞬間だけ」属性を書く
//   ・置き場所と大きさは、プレイエリアの大きさが変わったときだけ測り直す
//
//   node tools/mode/rhythm-side-monster-check.js
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'../..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const source=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const timing=read('monster-hero/data/rhythm-timing.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` (${detail})`:''}`);if(!ok)failed++;};

const ctx={};vm.createContext(ctx);
vm.runInContext(`${source}\nthis.out={rhythmSideMonsterBox,rhythmSideMonsterPlacement,rhythmSideMonsterBeatMs,rhythmSideMonsterOpacityValue,rhythmProjectBoundary,RHYTHM_TRACK_BEAT_MS,RHYTHM_SIDE_MONSTER_ANCHORS,RHYTHM_SIDE_MONSTER_MOTIONS,RHYTHM_SIDE_MONSTER_OPACITIES,RHYTHM_SIDE_MONSTER_FLASH_MS};`,ctx);
const {rhythmSideMonsterBox,rhythmSideMonsterPlacement,rhythmSideMonsterBeatMs,rhythmSideMonsterOpacityValue,
  rhythmProjectBoundary,RHYTHM_TRACK_BEAT_MS,RHYTHM_SIDE_MONSTER_ANCHORS,
  RHYTHM_SIDE_MONSTER_MOTIONS,RHYTHM_SIDE_MONSTER_OPACITIES,RHYTHM_SIDE_MONSTER_FLASH_MS}=ctx.out;

// --- 置き場所: レーンの台形へ食い込まない ---
// 空きは「上が広く下が狭い三角形」。真ん中の高さで大きさを決めると、箱の下の角が
// レーンへ食い込む。実際の画面の大きさをいくつか試して、どれでも収まることを見る。
const SCREENS=[[390,700],[320,560],[430,900],[820,380]];
let worstMargin=Infinity,worstDetail='';
for(const [width,height] of SCREENS){
  for(const slot of [1,2,3,4]){
    const box=rhythmSideMonsterBox(slot,width,height);
    for(const y of [box.top,box.top+box.size/2,box.top+box.size]){
      const edge=rhythmProjectBoundary(0,Math.max(0,Math.min(1,y/height)))*width;
      // 左は「箱の右端がレーンの左境界より左」、右は「箱の左端がレーンの右境界より右」。
      // レーンの右境界は boundary(5) = 幅 - boundary(0)。
      const margin=box.side==='left'?edge-(box.left+box.size):box.left-(width-edge);
      if(margin<worstMargin){worstMargin=margin;worstDetail=`${width}x${height} 枠${slot}`;}
    }
  }
}
check('どの画面の大きさでもレーンの台形へ食い込まない',worstMargin>=0,
  `いちばん近いところで${worstMargin.toFixed(1)}px（${worstDetail}）`);
check('左右へ2体ずつ、登場順が交互に並ぶ',
  [1,2,3,4].map(slot=>rhythmSideMonsterPlacement(slot).side).join(',')==='left,right,left,right'
  &&[1,2,3,4].map(slot=>rhythmSideMonsterPlacement(slot).row).join(',')==='0,0,1,1');
check('縦の置き場所はHUDの下・判定ラインの上',
  RHYTHM_SIDE_MONSTER_ANCHORS.every(anchor=>anchor>=.22&&anchor<=.62),
  RHYTHM_SIDE_MONSTER_ANCHORS.join(' / '));
check('大きさは指で押す邪魔にならない程度(プレイエリア幅の2割以下)',
  [1,2,3,4].every(slot=>rhythmSideMonsterBox(slot,390,700).size/390<=.2),
  [1,2,3,4].map(slot=>`${(rhythmSideMonsterBox(slot,390,700).size/390*100).toFixed(0)}%`).join('/'));
check('画面が小さくても消えるほど縮まない(最低24px)',
  [1,2,3,4].every(slot=>rhythmSideMonsterBox(slot,320,560).size>=24));

// --- 跳ねる速さ: 曲の1拍に合う ---
const timingCtx={Object,Number,Math};vm.createContext(timingCtx);
vm.runInContext(`${timing}\nthis.out=RHYTHM_TIMING_DATA;`,timingCtx);
const realBeats=timingCtx.out;
check('跳ねる速さの写しが rhythm-timing.js とずれていない',
  Object.entries(RHYTHM_TRACK_BEAT_MS).every(([trackId,beatMs])=>{
    const real=Number(realBeats[trackId]?.beatMs);
    return Number.isFinite(real)&&Math.abs(real-beatMs)<=1;
  }),
  Object.entries(RHYTHM_TRACK_BEAT_MS).map(([id,ms])=>`${id}=${ms}ms(実${Math.round(Number(realBeats[id]?.beatMs))}ms)`).join(' / '));
check('曲ごとの1拍を持っている曲は、その長さで跳ねる',
  rhythmSideMonsterBeatMs('monster_hero_theme')===RHYTHM_TRACK_BEAT_MS.monster_hero_theme
  &&rhythmSideMonsterBeatMs('atsu_cup_theme')===RHYTHM_TRACK_BEAT_MS.atsu_cup_theme);
check('知らない曲・壊れた値でも止まらない(既定500ms)',
  rhythmSideMonsterBeatMs('unknown')===500&&rhythmSideMonsterBeatMs(null)===500&&rhythmSideMonsterBeatMs('')===500);
check('跳ねる速さはプレイ開始時に一度だけ書く(毎フレームではない)',
  game.includes("const sideBeatMs=rhythmSideMonsterBeatMs(song.bgmTrackId);")
  &&game.includes("el.style.setProperty('--rhythm-side-beat',`${sideBeatMs}ms`)")
  // 書いている場所が1か所だけ = 毎フレームのtickからは書いていない
  &&(game.match(/--rhythm-side-beat/g)||[]).length===1
  &&(game.match(/rhythmSideMonsterBeatMs\(/g)||[]).length===1);

// --- 発熱に効く作り: 毎フレームの塗り直しを増やさない ---
const sideCss=/\/\* --- 両サイドのマスモン --- \*\/[\s\S]*?\[data-rhythm-judgment-line\]/.exec(source)?.[0]||'';
check('両サイドのマスモン用のCSSを取り出せる',sideCss.length>200);
// @keyframes の中身を波かっこの対応で切り出す(ステップ自身も波かっこを持つため、正規表現だけでは切れない)
const keyframeBodies=(css,namePattern=/@keyframes\s+(\w+)\s*\{/g)=>{
  const out=[];let match;
  while((match=namePattern.exec(css))){
    let depth=1,index=namePattern.lastIndex;
    while(index<css.length&&depth>0){
      if(css[index]==='{')depth++;
      else if(css[index]==='}')depth--;
      index++;
    }
    out.push({name:match[1],body:css.slice(namePattern.lastIndex,index-1)});
  }
  return out;
};
const keyframes=keyframeBodies(sideCss).map(entry=>entry.body);
check('跳ねる動きは transform だけを動かす(影・ぼかし・色を動かさない)',
  keyframes.length>=2&&keyframes.every(body=>
    !/filter|box-shadow|background|border-color/.test(body)
    &&/transform:/.test(body)),
  `${keyframes.length}個のkeyframes`);
const ringBody=keyframeBodies(sideCss).find(entry=>entry.name==='mhRhythmSideRing')?.body||'';
check('強調の輪も transform と opacity だけで動かす',
  ringBody.length>0&&!/filter|box-shadow|background|border-color/.test(ringBody)
  &&/transform:/.test(ringBody)&&/opacity:/.test(ringBody));
check('輪はあらかじめ用意して出し入れするだけ(押すたびに作らない)',
  sideCss.includes('[data-rhythm-side-monster]::after{content:"";')&&sideCss.includes('opacity:0;transform:scale(.9)'));
check('跳ねるのはCSSアニメーション(毎フレームのJSを増やさない)',
  sideCss.includes('animation:mhRhythmSideHop var(--rhythm-side-beat')
  &&!/requestAnimationFrame[\s\S]{0,200}rhythm-side/.test(game));
check('軽量モード・演出量MINIMALでは動きを止める',
  sideCss.includes('[data-rhythm-play-area][data-rhythm-lightweight="true"] [data-rhythm-side-monster]')
  &&sideCss.includes('[data-rhythm-play-area][data-rhythm-effect="MINIMAL"] [data-rhythm-side-monster]')
  &&sideCss.includes('animation:none!important'));
check('置き場所と大きさは変わったときだけ書く',
  source.includes('if(el._rhythmSideBox===next)return;'));
check('置き直しはプレイエリアの形を組み直すときにだけ走る',
  source.includes('rhythmLayoutSideMonsters(area);')
  &&/const rhythmLayoutPlayArea=area=>\{[\s\S]*?rhythmLayoutSideMonsters\(area\);/.test(source));
check('能力中の強調は「変わった瞬間だけ」属性を書く',
  game.includes('run.sideMonsterActiveSignature!==signature')
  &&game.includes("if(el.dataset.rhythmSideActive!==want)el.dataset.rhythmSideActive=want;"));
check('能力が1つも効いていないときは文字列も作らない',
  game.includes("if(settings.sideMonsterAbilityHighlight&&sideMonsterRefs.current.length){"));

// --- 能力が効いているあいだ、どのマスモンかが分かる ---
check('能力の持ち主を枠ごとに覚える',
  game.includes('run.abilityOwners=run.abilityOwners||{};')
  &&game.includes("if(monster.ability.id==='MUTEKI'||monster.ability.id==='GAMAN')run.abilityOwners[monster.ability.id]=slot;")
  &&game.includes('run.abilityOwners.KONJO=slot;'));
check('無敵・我慢は残り時間があるあいだだけ光る',
  game.includes("rhythmMonsterAbilityRemainingMs(run.abilities,'MUTEKI',songTimeMs)>0&&owners.MUTEKI")
  &&game.includes("rhythmMonsterAbilityRemainingMs(run.abilities,'GAMAN',songTimeMs)>0&&owners.GAMAN"));
check('根性はストックを持っているあいだ光る',game.includes("Number(run.abilities?.konjoStock)>0&&owners.KONJO"));
check('元気のように一瞬で終わる能力も少しのあいだ光る',
  Number.isFinite(RHYTHM_SIDE_MONSTER_FLASH_MS)&&RHYTHM_SIDE_MONSTER_FLASH_MS>=600
  &&game.includes('run.abilityFlashUntilMs=songTimeMs+RHYTHM_SIDE_MONSTER_FLASH_MS;'),
  `${RHYTHM_SIDE_MONSTER_FLASH_MS}ms`);
check('持ち主の控えは見た目だけで、判定・スコア・ライフに関係しない',
  /見た目だけの控え[\s\S]{0,400}?run\.abilityOwners/.test(game)
  &&!/abilityOwners[^\n]*(score|life|judgment|combo)/i.test(game)
  // 光らせる枠を決める処理が、ライフやスコアへ書き戻していないこと
  &&!/sideMonsterActiveSignature[\s\S]{0,800}?run\.(life|score|combo|counts)\s*=/.test(game));

// --- オプション ---
check('濃さは4段階(はっきり/ふつう/うっすら/出さない)',
  RHYTHM_SIDE_MONSTER_OPACITIES.join(',')==='OFF,FAINT,SOFT,NORMAL'
  &&rhythmSideMonsterOpacityValue('OFF')===0
  &&rhythmSideMonsterOpacityValue('FAINT')<rhythmSideMonsterOpacityValue('SOFT')
  &&rhythmSideMonsterOpacityValue('SOFT')<rhythmSideMonsterOpacityValue('NORMAL'));
check('動きは3段階(跳ねる/小さく跳ねる/動かない)',RHYTHM_SIDE_MONSTER_MOTIONS.join(',')==='NONE,SMALL,NORMAL');
check('「出さない」を選ぶと要素そのものを作らない(隠すだけにしない)',
  game.includes("if(settings.sideMonsterOpacity==='OFF')return null;"));
check('オプション画面に濃さ・動き・能力中に光らせるの3つがある',
  game.includes('両サイドのマスモン')&&game.includes("segments('sideMonsterOpacity'")
  &&game.includes("segments('sideMonsterMotion'")&&game.includes("toggle('sideMonsterAbilityHighlight'"));
check('保存値に無い既存ユーザーでも既定で補われる',
  game.includes("sideMonsterOpacity:RHYTHM_SIDE_MONSTER_OPACITIES.includes(source.sideMonsterOpacity)?source.sideMonsterOpacity:DEFAULT_RHYTHM_SETTINGS.sideMonsterOpacity,")
  &&game.includes("sideMonsterMotion:RHYTHM_SIDE_MONSTER_MOTIONS.includes(source.sideMonsterMotion)?source.sideMonsterMotion:DEFAULT_RHYTHM_SETTINGS.sideMonsterMotion,")
  &&game.includes("sideMonsterAbilityHighlight:bool('sideMonsterAbilityHighlight'),"));
check('音ゲーの設定キー(mh_*)を増やしていない',
  !/mh_[a-z_]*side[a-z_]*/i.test(game));

// --- 判定まわりを変えていない ---
check('入力を邪魔しない(pointer-eventsを持たない)',
  game.includes('data-rhythm-side-monsters aria-hidden="true" className="pointer-events-none absolute inset-0"')
  &&source.includes('[data-rhythm-side-monster]{position:absolute;pointer-events:none;'));
check('ノーツより後ろに置く(ノーツを隠さない)',
  /\[data-rhythm-side-monster\]\{[^}]*z-index:1/.test(source)&&/\[data-rhythm-note\]\{z-index:2\}/.test(source));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

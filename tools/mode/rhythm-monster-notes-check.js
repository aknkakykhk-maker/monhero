// モンスターノーツ（RHYTHM_MODE §3.3〜3.5 / §4）を、実際にNode上で動かして確かめる。
//
// 確定している仕様:
//   ・譜面には通常のTAPノーツへ monsterSlot:1〜4 を1行足すだけで書く（初期実装はTAP専用）
//   ・1枠目→1個目、2枠目→2個目…と対応し、1曲あたり設定した体数ぶん・最大4回
//   ・能力発動は GREAT 以上。判定窓はモンスターノーツ専用に甘くしない
//   ・能力は **主血統** で決まる（副血統では変えない）
//   ・元気=ライフ+200 / 無敵=6秒ダメージ0 / 我慢=15秒50%軽減 / 根性=復活ライフ50
//   ・DOWNから復帰できるのは根性だけ
//   ・DOWN中に根性で蘇生したら、**その蘇生ノーツ自身は加算せず次のノーツから** 再開する
//
//   node tools/mode/rhythm-monster-notes-check.js
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..'),read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const data=read('monster-hero/data/rhythm-mode.js');
const game=read('monster-hero/src/game-system.jsx');
const lineages=read('monster-hero/data/lineages.js');

let failed=0;
const check=(name,ok,detail='')=>{console.log(`${ok?'✓':'✗'} ${name}${detail?` — ${detail}`:''}`);if(!ok)failed++;};

// ── 実装を取り出して動かす ──────────────────────────────────────────────────
const slots=data.match(/const RHYTHM_MONSTER_SLOT_KEY=[\s\S]*?const rhythmMonsterNoteBaseRatios=[\s\S]*?\n\};/)?.[0];
const life=data.match(/const RHYTHM_JUDGMENTS = [\s\S]*?const rhythmLifeRatio = [^\n]*;/)?.[0];
const notes=data.match(/const rhythmNoteMonsterSlot=[\s\S]*?const rhythmScoreOffsetAfterRevive=[\s\S]*?\n\s+Math\.max[^\n]*;/)?.[0];
const score=game.match(/const rhythmCalculateScore = \([\s\S]*?\n\};/)?.[0];
check('実装を抽出できる',!!slots&&!!life&&!!notes&&!!score,
  [slots?'':'slots',life?'':'life',notes?'':'notes',score?'':'score'].filter(Boolean).join(', '));
if(!(slots&&life&&notes&&score))process.exit(1);
const context={};vm.createContext(context);
vm.runInContext(`${slots}\n${life}\nconst RHYTHM_JUDGMENT_IDS=RHYTHM_JUDGMENTS.map(item=>item.id);\n${notes}\n${score}\nthis.out={RHYTHM_MONSTER_SLOT_MAX,RHYTHM_LIFE_MAX,RHYTHM_LIFE_DELTA,rhythmNoteMonsterSlot,rhythmChartMonsterNotes,rhythmChartMonsterNoteIssues,RHYTHM_MONSTER_ABILITIES,RHYTHM_MONSTER_ABILITY_BY_LINEAGE,rhythmMonsterAbilityForLineage,RHYTHM_MONSTER_ABILITY_JUDGMENTS,rhythmMonsterAbilityTriggers,createRhythmMonsterAbilityState,rhythmMonsterAbilityRemainingMs,rhythmMonsterAbilityActive,rhythmApplyMonsterAbilityToLifeDelta,rhythmLifeAfterWithMonsterAbilities,rhythmConsumeKonjoStock,rhythmActivateMonsterAbility,rhythmScoreOffsetAfterRevive,rhythmCalculateScore};`,context);
const M=context.out;

// ── 譜面での書き方（TAPへ1行足すだけ） ──────────────────────────────────────
const tap=(timeMs,extra={})=>({type:'TAP',timeMs,lane:2,subLane:4,subLaneWidth:2,...extra});
check('TAPへ monsterSlot を足すとモンスターノーツになる',M.rhythmNoteMonsterSlot(tap(1000,{monsterSlot:2}))===2);
check('印の無いTAPは通常ノーツのまま',M.rhythmNoteMonsterSlot(tap(1000))===0);
check('初期実装はTAP専用（HOLD/FLICK/SLIDEには付かない）',
  ['HOLD','FLICK','SLIDE'].every(type=>M.rhythmNoteMonsterSlot({type,timeMs:1,monsterSlot:1})===0));
check('枠の範囲外・整数でない印は受け付けない',
  [0,5,-1,1.5,'1',null].every(value=>M.rhythmNoteMonsterSlot(tap(1,{monsterSlot:value}))===0));
check('モンスターノーツだけを取り出せる',
  M.rhythmChartMonsterNotes([tap(1),tap(2,{monsterSlot:1}),tap(3),tap(4,{monsterSlot:2})]).length===2);

// 譜面の書き間違いを機械的に拾う
const issueIds=list=>M.rhythmChartMonsterNoteIssues(list).map(item=>item.issue).sort();
check('正しく書けていれば指摘なし',
  issueIds([tap(1),tap(1000,{monsterSlot:1}),tap(2000,{monsterSlot:2})]).length===0);
check('同じ枠を2回使ったら拾う',
  issueIds([tap(1000,{monsterSlot:1}),tap(2000,{monsterSlot:1})]).includes('duplicate-slot'));
check('時刻の順と枠の順がずれていたら拾う（1枠目→1個目）',
  issueIds([tap(1000,{monsterSlot:2}),tap(2000,{monsterSlot:1})]).includes('order-mismatch'));
check('TAP以外へ印を付けたら拾う',
  issueIds([{type:'HOLD',timeMs:1000,endTimeMs:2000,lane:0,monsterSlot:1}]).includes('not-tap'));
check('枠の範囲外を書いたら拾う',issueIds([tap(1000,{monsterSlot:7})]).includes('out-of-range'));

// ── 確認用譜面（MONSTER NOTE TEST） ─────────────────────────────────────────
const testNotes=data.match(/const monsterNoteTestNotes=Object\.freeze\(\[[\s\S]*?\n\]\);/)?.[0];
check('確認用の譜面を抽出できる',!!testNotes);
if(testNotes){
  const ctx={};vm.createContext(ctx);
  vm.runInContext(`${data.match(/const monsterNoteTestTap=[\s\S]*?\n\}\);/)[0]}\n${testNotes}\nthis.out=monsterNoteTestNotes;`,ctx);
  const list=ctx.out,mons=M.rhythmChartMonsterNotes(list);
  check('確認用譜面のモンスターノーツは4個',mons.length===4,`${mons.length}個`);
  check('確認用譜面に書き間違いがない',M.rhythmChartMonsterNoteIssues(list).length===0,
    JSON.stringify(M.rhythmChartMonsterNoteIssues(list)));
  const ratios=mons.map(note=>note.timeMs/40000);
  check('出現位置は20 / 40 / 60 / 80%付近',
    ratios.every((ratio,index)=>Math.abs(ratio-(index+1)*.2)<.03),ratios.map(r=>`${(r*100).toFixed(0)}%`).join(' / '));
  check('曲開始直後・終了直前は避けている',ratios[0]>.1&&ratios[ratios.length-1]<.9);
  check('モンスターノーツの前後は空けて狙って取れるようにしている',
    mons.every(mon=>list.filter(note=>note!==mon&&Math.abs(note.timeMs-mon.timeMs)<1500).length===0));
}

// ── 能力は主血統で決まる（§4.5） ────────────────────────────────────────────
const mapCtx={};vm.createContext(mapCtx);
vm.runInContext(`${lineages.match(/const MONSTER_LINEAGE_MAP = \{[\s\S]*?\n\};/)[0]}\nthis.out=MONSTER_LINEAGE_MAP;`,mapCtx);
const LINEAGE=mapCtx.out;
const abilityOf=baseId=>M.rhythmMonsterAbilityForLineage(LINEAGE[baseId]?.main)?.id||null;
check('元気は ピクシー / ウンディーネ / プラント / スエゾー / ライガー',
  ['pixie','undine','plant','suezo','tiger'].every(id=>M.rhythmMonsterAbilityForLineage(id)?.id==='GENKI'));
check('無敵は モノリス / アーク',['monol','ark'].every(id=>M.rhythmMonsterAbilityForLineage(id)?.id==='MUTEKI'));
check('我慢は ゴーレム / モッチー',['golem','mocchi'].every(id=>M.rhythmMonsterAbilityForLineage(id)?.id==='GAMAN'));
check('根性は ハム / ザン',['ham','zan'].every(id=>M.rhythmMonsterAbilityForLineage(id)?.id==='KONJO'));
check('未実装血統（ドラゴン / ジョーカー / ゲル）と「？？？」には能力を割り当てない',
  ['dragon','joker','gel','unknown'].every(id=>M.rhythmMonsterAbilityForLineage(id)===null));
// 仕様書の例がそのまま通ること（派生種は主血統で決まる）
check('ミーア / パンドラ → 元気',abilityOf('Mia')==='GENKI'&&abilityOf('Pandora')==='GENKI');
check('イヴリース → 無敵（副血統ジョーカーに引きずられない）',abilityOf('Iblis')==='MUTEKI');
check('オボロ → 元気（副血統ゲルに引きずられない）',abilityOf('Oboro')==='GENKI');
check('エイキ → 根性',abilityOf('Eiki')==='KONJO');
check('みたらし → 我慢（副血統ドラゴンに引きずられない）',abilityOf('Mitarashi')==='GAMAN');
check('血統カタログの全モンスターに能力が決まっている（未実装血統を除く）',
  Object.keys(LINEAGE).every(id=>abilityOf(id)!==null||['dragon','joker','gel','unknown'].includes(LINEAGE[id].main)),
  Object.keys(LINEAGE).filter(id=>abilityOf(id)===null).join(', ')||'なし');

// ── 発動条件はGREAT以上（§3.4） ─────────────────────────────────────────────
check('MARVELOUS / EXCELLENT / GREAT で発動',
  ['MARVELOUS','EXCELLENT','GREAT'].every(M.rhythmMonsterAbilityTriggers));
check('GOOD / BAD / MISS では不発',
  ['GOOD','BAD','MISS'].every(judgment=>M.rhythmMonsterAbilityTriggers(judgment)===false));

// ── 各能力の効き方（§4） ────────────────────────────────────────────────────
const A=M.RHYTHM_MONSTER_ABILITIES,fresh=()=>M.createRhythmMonsterAbilityState();
check('元気はライフ+200',
  M.rhythmActivateMonsterAbility({ability:A.GENKI,state:fresh(),life:500,songTimeMs:0}).life===700);
check('元気は最大ライフを超えない',
  M.rhythmActivateMonsterAbility({ability:A.GENKI,state:fresh(),life:900,songTimeMs:0}).life===M.RHYTHM_LIFE_MAX);
check('元気はDOWNから復帰させない',
  M.rhythmActivateMonsterAbility({ability:A.GENKI,state:fresh(),life:0,songTimeMs:0}).life===0);

const muteki=M.rhythmActivateMonsterAbility({ability:A.MUTEKI,state:fresh(),life:500,songTimeMs:1000}).state;
check('無敵は6秒',M.rhythmMonsterAbilityRemainingMs(muteki,'MUTEKI',1000)===6000);
check('無敵中はライフダメージ0',
  M.rhythmLifeAfterWithMonsterAbilities(500,'MISS',muteki,2000)===500
  &&M.rhythmLifeAfterWithMonsterAbilities(500,'BAD',muteki,2000)===500);
check('無敵が切れたらまた減る',M.rhythmLifeAfterWithMonsterAbilities(500,'MISS',muteki,7500)===450);
check('無敵は回復まで消さない',M.rhythmLifeAfterWithMonsterAbilities(500,'MARVELOUS',muteki,2000)===502);

const gaman=M.rhythmActivateMonsterAbility({ability:A.GAMAN,state:fresh(),life:500,songTimeMs:0}).state;
check('我慢は15秒',M.rhythmMonsterAbilityRemainingMs(gaman,'GAMAN',0)===15000);
check('我慢中は50%軽減（MISS -50→-25 / BAD -20→-10）',
  M.rhythmLifeAfterWithMonsterAbilities(500,'MISS',gaman,1000)===475
  &&M.rhythmLifeAfterWithMonsterAbilities(500,'BAD',gaman,1000)===490);
const both={...muteki,...gaman,mutekiUntilMs:muteki.mutekiUntilMs,gamanUntilMs:gaman.gamanUntilMs};
check('無敵と我慢が同時なら無敵が勝つ',M.rhythmApplyMonsterAbilityToLifeDelta(both,-50,1500)===0);

const stocked=M.rhythmActivateMonsterAbility({ability:A.KONJO,state:fresh(),life:500,songTimeMs:0});
check('根性は生存中ならストックする（ライフは動かない）',stocked.state.konjoStock===1&&stocked.life===500);
check('ストックを持ったまま根性をもう一度取ったら ライフ+50 へ変える',
  M.rhythmActivateMonsterAbility({ability:A.KONJO,state:stocked.state,life:500,songTimeMs:0}).life===550);
check('ストックは2個へ増えない',
  M.rhythmActivateMonsterAbility({ability:A.KONJO,state:stocked.state,life:500,songTimeMs:0}).state.konjoStock===1);
const autoRevive=M.rhythmConsumeKonjoStock(stocked.state,0);
check('ストックを持ったままライフ0になったら、自動でライフ50へ復活',
  autoRevive.revived&&autoRevive.life===50&&autoRevive.state.konjoStock===0);
check('ストックが無ければ自動復活しない',M.rhythmConsumeKonjoStock(fresh(),0).revived===false);
const downRevive=M.rhythmActivateMonsterAbility({ability:A.KONJO,state:fresh(),life:0,songTimeMs:0});
check('DOWN中に根性を取ったらその場でライフ50へ復活',downRevive.revived&&downRevive.life===50);

// ── DOWN → 蘇生後のスコア（2026-09-03 ユーザー判断） ────────────────────────
// 蘇生ノーツ自身は加算せず、次のノーツから再開する。DOWN中のぶんは遡って足さない。
const ids=['MARVELOUS','EXCELLENT','GREAT','GOOD','BAD','MISS'];
const run={life:60,lifeDepleted:false,score:0,lockedScore:0,scoreOffset:0,combo:0,maxCombo:0,
  counts:Object.fromEntries(ids.map(id=>[id,0])),abilities:fresh()};
const apply=(judgment,{revive=false}={})=>{
  run.combo=['MARVELOUS','EXCELLENT','GREAT','GOOD'].includes(judgment)?run.combo+1:0;
  run.maxCombo=Math.max(run.maxCombo,run.combo);run.counts[judgment]++;
  run.life=M.rhythmLifeAfterWithMonsterAbilities(run.life,judgment,run.abilities,0);
  let revived=false;
  if(revive){const activated=M.rhythmActivateMonsterAbility({ability:A.KONJO,state:run.abilities,life:run.life,songTimeMs:0});
    run.abilities=activated.state;run.life=activated.life;revived=activated.revived;}
  const calculated=M.rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:8,maxScore:1000000});
  if(!run.lifeDepleted)run.score=calculated-run.scoreOffset;
  if(!run.lifeDepleted&&run.life===0){run.lifeDepleted=true;run.lockedScore=run.score;}
  if(revived&&run.lifeDepleted&&run.life>0){run.scoreOffset=M.rhythmScoreOffsetAfterRevive(calculated,run.lockedScore);run.score=run.lockedScore;run.lifeDepleted=false;}
  return run.lifeDepleted?run.lockedScore:run.score;
};
apply('MARVELOUS');
const atDown=apply('MISS');       // 62 -> 12 ... まだ生きている
apply('MISS');                    // 12 -> 0 でDOWN
const lockedScore=run.lockedScore;
check('DOWNでスコアが固定される',run.lifeDepleted&&lockedScore>=0&&atDown>=0);
const duringDown=apply('MARVELOUS');
check('DOWN中は成功してもスコアが増えない',duringDown===lockedScore);
const onRevive=apply('MARVELOUS',{revive:true});
check('蘇生した',run.life===50&&!run.lifeDepleted);
check('蘇生ノーツ自身のスコアは加算しない',onRevive===lockedScore,`${onRevive} / ${lockedScore}`);
const afterRevive=apply('MARVELOUS');
check('次のノーツからスコア加算を再開する',afterRevive>lockedScore,`${afterRevive} > ${lockedScore}`);
check('DOWN中に止まっていた分を遡って加算しない',
  afterRevive<M.rhythmCalculateScore({judgments:run.counts,maxCombo:run.maxCombo,totalNotes:8,maxScore:1000000}));

// ── 本体への結線 ────────────────────────────────────────────────────────────
check('ライフ計算を能力経由に通している',
  /run\.life=rhythmLifeAfterWithMonsterAbilities\(run\.life,judgment,run\.abilities,songTimeMs\);/.test(game));
check('根性ストックの自動復活を判定のたびに見ている',
  /const stockRevive=rhythmConsumeKonjoStock\(run\.abilities,run\.life\);/.test(game));
check('モンスターノーツはGREAT以上のときだけ能力を出す',
  /if\(monster&&monster\.ability&&rhythmMonsterAbilityTriggers\(judgment\)\)\{/.test(game));
check('能力は主血統から引く',
  /ability:rhythmMonsterAbilityForLineage\(monsterLineageOf\(masu\.baseId\)\.main\.id\)/.test(game));
check('ノーツ中央にマスモンの染色済みの絵を出す',
  /data-rhythm-monster-face[\s\S]{0,400}<DyedMonsterImage baseId=\{monster\.baseId\} src=\{monster\.imageUrl\}[\s\S]{0,120}masuColors=\{monster\.colors\}/.test(game));
// 毎フレーム走るtickの中身だけを取り出して、染色や絵の組み立てが混ざっていないか見る
const tickBody=game.match(/const tick=\(frameNowMs\)=>\{[\s\S]*?frameRef\.current=requestAnimationFrame\(tick\);\};/)?.[0]||'';
check('毎フレームの処理を抽出できる',!!tickBody);
check('絵はプレイ中に作り直さない（毎フレームの処理に染色・画像生成が入っていない）',
  !!tickBody&&!/DyedMonsterImage|getRecoloredImage|getDyeRegionMasks|createElement\('canvas'\)/.test(tickBody));
check('奥行きはレーンと同じ депth scaleへ乗せる（毎フレームJSで書き換えない）'.replace('депth','depth'),
  /data-rhythm-monster-face[\s\S]{0,400}scale\(var\(--rhythm-note-depth-scale, 1\)\)/.test(game));
check('発動したモンスター名と能力名を短時間出す',
  game.includes('data-rhythm-ability-flash')&&/\$\{view\.ability\.monster\}　/.test(game));
check('無敵・我慢の残り時間と根性ストックが分かるUIがある',
  game.includes('data-rhythm-ability-badge')&&game.includes("'根性 ストック'"));
check('残り時間の更新でsetStateを増やしていない（DOMへ直接書く）',
  /const badge=abilityBadgeRef\.current;/.test(game)&&!/badge[\s\S]{0,200}setView/.test(game));

// ── 守るもの ────────────────────────────────────────────────────────────────
const judgments=data.match(/const RHYTHM_JUDGMENTS = [\s\S]*?\n\]\);/)?.[0]||'';
check('判定窓はモンスターノーツ専用に甘くしていない',
  ['windowMs:25','windowMs:50','windowMs:100','windowMs:150','windowMs:200'].every(w=>judgments.replace(/\s/g,'').includes(w)));
check('スコアの重み（判定90% / コンボ10%）は変更していない',
  /RHYTHM_SCORE_WEIGHTS\s*=\s*Object\.freeze\(\{\s*judgment:\s*\.9\s*,\s*combo:\s*\.1\s*\}\)/.test(data.replace(/\n/g,'')));
check('ライフの最大値と判定ごとの増減は変更していない',
  M.RHYTHM_LIFE_MAX===1000&&JSON.stringify(M.RHYTHM_LIFE_DELTA)===JSON.stringify({MARVELOUS:2,EXCELLENT:2,GREAT:1,GOOD:0,BAD:-20,MISS:-50}));
check('既存の rhythmLifeAfter を書き換えず、別入口として足している',
  data.includes('const rhythmLifeAfter = (life, judgment) => {')&&data.includes('const rhythmLifeAfterWithMonsterAbilities='));
check('保存キーを増やしていない（設定はマスモンの枠だけ）',
  !/mh_rhythm_(ability|monster_note)/.test(game)&&game.includes("RHYTHM_BEST_RECORDS_KEY = 'mh_rhythm_best_v1'"));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

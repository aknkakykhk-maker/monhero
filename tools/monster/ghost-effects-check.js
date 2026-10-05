#!/usr/bin/env node
// ゴースト種(ゴースト・スプーキー)の「効き目」を見張る(2026-10-05 ユーザー指示「新しい要素が多いから何回も確認して不具合のないように」)。
//
//   node tools/monster/ghost-effects-check.js
//
// 数値の正本: docs/spec/GHOST_SKILLS.md。説明文(traitDesc・effectDesc)を書いただけでは何も起きず、
// 効き目は本体のあちこちの分岐が作る。どれか1か所書き忘れても画面はふつうに動いてしまうので、ここで1本ずつ確かめる。
//   ① 勇者特性「トリックスタート」: 1・4・7…ターン目に、ちから+20%・丈夫さ+20%・毎ターンライフ5%回復をそれぞれ50%で積む
//      (重複あり・WAVEのあいだ)。攻撃が当たると消費ガッツの半分を回復
//   ② 固有技「運命のコイン」(ゴースト): 表50%=この技4倍＋この子の連撃+10% / 裏=0.5倍＋ゴーストの固有技の消費ガッツ+20%
//      固有技「運命の輪」(スプーキー): 当てるたびに6つから1つ(敵与ダメ−30%・敵被ダメ+30%は2ターン / 3倍 / 2倍 / 連撃+10% / ちから+15%)
//   ③ モンヒロビートの能力「いたずら」(ゴースト血統): 6秒のあいだライフが減らず、BAD・MISSでもコンボが切れない
//   ④ 技ごとの攻撃モーション(2体×通常9・固有9)。中身の決まりは tools/battle/skill-motion-check.js が見る
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };

const allies = read('monster-hero/data/ally-monsters.js');
const lineages = read('monster-hero/data/lineages.js');
const bond = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const app = read('monster-hero/src/parts/60-app.jsx');
const rhythm = read('monster-hero/data/rhythm-mode.js');
const play = read('monster-hero/src/parts/30-rhythm-play.jsx');
const fxSrc = read('monster-hero/src/parts/24-battle-fx.jsx');

// --- 本体の登録 ---
const sandboxData = {};
vm.createContext(sandboxData);
vm.runInContext(`${allies.replace(/\b[A-Z_]+_(IMG|ICON|FACE_ICON)\b/g, "'img'")}\nglobalThis.M=ALL_PLAYER_MONSTERS;globalThis.N=HERO_ATK_NAMES;`, sandboxData);
const M = sandboxData.M, N = sandboxData.N;
check('ゴーストとスプーキーが本体の一覧にいる', !!M.Ghost && !!M.Spooky);
check('能力値がユーザーの決めた値(ゴースト 450/150/130/50・スプーキー 510/160/150/55)',
  M.Ghost && M.Ghost.baseHp === 450 && M.Ghost.baseGuts === 150 && M.Ghost.baseAtk === 130 && M.Ghost.baseDef === 50
  && M.Spooky && M.Spooky.baseHp === 510 && M.Spooky.baseGuts === 160 && M.Spooky.baseAtk === 150 && M.Spooky.baseDef === 55);
check('固有技の倍率と消費(ゴースト2.0・40 / スプーキー2.4・48)',
  M.Ghost?.unique?.baseMult === 2.0 && M.Ghost?.unique?.baseGuts === 40 && M.Spooky?.unique?.baseMult === 2.4 && M.Spooky?.unique?.baseGuts === 48);
check('通常技・固有技が9段階ずつ', N.Ghost?.length === 9 && N.Spooky?.length === 9 && M.Ghost?.unique?.names?.length === 9 && M.Spooky?.unique?.names?.length === 9);
check('スプーキーのオリジナル技(カード・クラブ / グリンネーション)が入っている',
  N.Spooky?.[5] === 'カード・クラブ' && N.Spooky?.[8] === 'グリンネーション' && N.Ghost?.[5] === 'カード' && N.Ghost?.[8] === 'コンビネーション');
check('血統: ゴースト=純血 / スプーキー=ゴースト×？？？',
  /Ghost:\s*\{ main:'ghost', sub:'ghost' \}/.test(lineages) && /Spooky:\s*\{ main:'ghost', sub:'unknown' \}/.test(lineages)
  && /ghost:\s*\{ id:'ghost',\s*name:'ゴースト',\s*monId:'Ghost' \}/.test(lineages));

// --- ① トリックスタート ---
const trickSrc = slice(bond, '// ==== 勇者特性「トリックスタート」', '// ★タクティクスバトルは敵の並びが別');
check('トリックスタートの決めごとを本体から切り出せる', trickSrc.length > 0);
const sb = {};
vm.createContext(sb);
vm.runInContext(`${trickSrc}\nglobalThis.t={hasTrickStartTrait,trickStartRollTurn,rollTrickStart,trickStartAtkMult,trickStartDefMult,trickStartRegenRate,trickStartGutsRefund,trickStartGainText};`, sb);
const t = sb.t;
check('持っているのはゴーストとスプーキーだけ', t.hasTrickStartTrait('Ghost') && t.hasTrickStartTrait('Spooky') && !t.hasTrickStartTrait('Yggdrasil'));
check('抽選は1・4・7・10…ターン目だけ', [1, 4, 7, 10, 19].every(n => t.trickStartRollTurn(n)) && ![0, 2, 3, 5, 6, 8, 9, 20].some(n => t.trickStartRollTurn(n)));
{
  const seq = (vals) => { let i = 0; return () => vals[i++]; };
  const all = t.rollTrickStart(null, seq([0.1, 0.2, 0.3]));
  const none = t.rollTrickStart(null, seq([0.6, 0.9, 0.5]));
  const half = t.rollTrickStart({ atk: 2, def: 1, regen: 0 }, seq([0.49, 0.5, 0.01]));
  check('3つをそれぞれ50%で当てる(0.5未満で当たり)', all.stacks.atk === 1 && all.stacks.def === 1 && all.stacks.regen === 1
    && none.stacks.atk === 0 && none.stacks.def === 0 && none.stacks.regen === 0);
  check('当たったぶんを積む(重複あり)', half.stacks.atk === 3 && half.stacks.def === 1 && half.stacks.regen === 1 && half.gained.def === 0);
  check('ちから・丈夫さは1つにつき+20%、回復は1つにつき5%', Math.abs(t.trickStartAtkMult({ atk: 2 }) - 1.4) < 1e-9
    && Math.abs(t.trickStartDefMult({ def: 3 }) - 1.6) < 1e-9 && Math.abs(t.trickStartRegenRate({ regen: 2 }) - 0.1) < 1e-9
    && t.trickStartAtkMult(null) === 1 && t.trickStartRegenRate(null) === 0);
  check('攻撃が当たったら消費ガッツの半分(切り捨て)', t.trickStartGutsRefund(40) === 20 && t.trickStartGutsRefund(13) === 6 && t.trickStartGutsRefund(0) === 0);
  check('当たったものを文で出す', t.trickStartGainText(all.gained) === 'ちから+20%・丈夫さ+20%・毎ターン回復+5%' && t.trickStartGainText(none.gained) === '');
}
check('積んだ数は ref に持ち、WAVEが変わると0から・ランの始めでも消す',
  /const trickStartRef = useRef\(\{ wave: null, turn: null, bySlot: \{\} \}\);/.test(app)
  && /if \(cur\.wave !== wave\) \{ cur\.wave = wave; cur\.turn = null; cur\.bySlot = \{\};/.test(app)
  && (app.match(/writeNextTurnBuffs\(\{\}\); resetTrickStart\(\);/g) || []).length === 3);
check('抽選はターン数が変わったときに1回だけ(同じターンに2回抽選しない)',
  /if \(cur\.turn === turnCount \|\| !trickStartRollTurn\(turnCount\)\) return;/.test(app) && /\}, \[gameState, wave, turnCount, runMode, mainHero\?\.id\]\);/.test(app));
check('持ち主: 既存5モードは勇者モン、タクティクスは立っている持ち主それぞれ',
  /tacticsAliveSlots\(units\)\.filter\(slotIdx => hasTrickStartTrait\(units\[slotIdx\]\?\.id\)\)/.test(app)
  && /hasTrickStartTrait\(mainHero\?\.id\) \? \[\{ key: 'party', name: '' \}\]/.test(app));
check('ちからは与ダメージの式に入る(攻撃した子のちからに掛ける)', /\*trickStartAtkMult\(trickStartStacksAt\(slotIdx\)\)\s*\*fateAtkMult\(livePermaBuff\('fateStacks',null\),slotIdx\);/.test(app));
check('丈夫さは被ダメージの式とガードの軽減量の両方に入る',
  /\* trickStartDefMult\(trickStartStacksAt\(isTacticsMode\(runMode\) \? targetSlot : null\)\);/.test(app)
  && /const trickMult = trickStartDefMult\(trickStartStacksAt\(isTacticsMode\(runMode\) \? slotIdx : null\)\);/.test(app)
  && /Math\.floor\(immediateEffects\.guardFlat \+ guardDefFor\(null\)\*immediateEffects\.guardMult\)/.test(app));
check('毎ターン終わりに、積んだ数ぶんライフを回復する',
  /const rate=trickStartRegenRate\(trickStartRef\.current\.bySlot\[String\(slotIdx\)\]\);/.test(app)
  && /const rate=trickStartRegenRate\(trickStartRef\.current\.bySlot\.party\);/.test(app));
check('攻撃が当たったら、払った消費ガッツの半分を攻撃した子へ戻す',
  /if \(hasTrickStartTrait\(trickOwnerId\) && finalD>0\) \{\s*const refund=trickStartGutsRefund\(cardCost\);/.test(app));

// --- ② 運命のコイン・運命の輪 ---
const fateSrc = slice(bond, '// ==== 固有技「運命のコイン」', '// ★タクティクスバトルは敵の並びが別');
check('運命のコイン・運命の輪の決めごとを本体から切り出せる', fateSrc.length > 0);
const fb = {};
vm.createContext(fb);
vm.runInContext(`${fateSrc}\nglobalThis.f={FATE_WHEEL_OUTCOMES,rollFateCoin,fateCoinDmgMult,rollFateWheel,fateSlotStacksOf,withFateSlotStack,withFateCoinGuts,fateComboOf,withFateCombo,fateAtkMult,fateCoinGutsMult,fateWheelEnemyAtkMult,fateWheelEnemyTakenBonus,tickFateWheelDebuff,fateWheelDebuffOf};`, fb);
const f = fb.f;
check('コインは0.5未満で表(4倍)・それ以外は裏(0.5倍)', f.rollFateCoin(() => 0.49) === 'heads' && f.rollFateCoin(() => 0.5) === 'tails'
  && f.fateCoinDmgMult('heads') === 4 && f.fateCoinDmgMult('tails') === 0.5);
{
  const ids = [0, 0.17, 0.34, 0.5, 0.67, 0.99].map(r => f.rollFateWheel(() => r).id);
  check('運命の輪は6つが同じ確率で出る(外れなし)', f.FATE_WHEEL_OUTCOMES.length === 6
    && JSON.stringify(ids) === JSON.stringify(['enemyAtkDown', 'enemyTakenUp', 'dmg3', 'dmg2', 'combo', 'atk'])
    && f.rollFateWheel(() => 0.9999999).id === 'atk', ids.join(','));
  check('運命の輪のダメージは3倍と2倍', f.FATE_WHEEL_OUTCOMES[2].dmgMult === 3 && f.FATE_WHEEL_OUTCOMES[3].dmgMult === 2
    && f.FATE_WHEEL_OUTCOMES.filter(o => o.dmgMult).length === 2);
}
{
  let st = null;
  st = f.withFateSlotStack(st, 2, 'combo'); st = f.withFateSlotStack(st, 2, 'combo'); st = f.withFateSlotStack(st, 2, 'atk');
  st = f.withFateCoinGuts(f.withFateCoinGuts(st));
  check('積んだぶんは枠ごとに重なる(上限なし)', f.fateSlotStacksOf(st, 2).combo === 2 && f.fateSlotStacksOf(st, 2).atk === 1
    && f.fateSlotStacksOf(st, 0).combo === 0);
  const combo = f.fateComboOf(st, 2);
  check('連撃+10%は「元ダメージ×連撃率」の追加ヒット1本(2つ積むと20%)', combo && combo.count === 1 && Math.abs(combo.rate - 0.2) < 1e-9
    && f.fateComboOf(st, 0) === null && f.fateComboOf(st, null) === null);
  const merged = f.withFateCombo({ count: 4, rate: 0.3 }, st, 2);
  check('タクティクスEXの連撃と並べて渡す(どちらも消さない)', Array.isArray(merged) && merged.length === 2 && merged[0].rate === 0.3
    && f.withFateCombo(null, st, 0) === null && f.withFateCombo({ count: 1, rate: 0.1 }, null, 2).rate === 0.1);
  check('ちから+15%はその枠の子だけ', Math.abs(f.fateAtkMult(st, 2) - 1.15) < 1e-9 && f.fateAtkMult(st, 1) === 1 && f.fateAtkMult(null, null) === 1);
  check('裏の消費ガッツ+20%は重なる(2回で1.4倍)', Math.abs(f.fateCoinGutsMult(st) - 1.4) < 1e-9 && f.fateCoinGutsMult(null) === 1);
}
{
  const d = { atkDown: 2, takenUp: 0 };
  const d1 = f.tickFateWheelDebuff(d), d2 = f.tickFateWheelDebuff(d1);
  check('弱体は使ったターンと次のターンの2ターン(次のターンへ進むたびに1減る)', d1.atkDown === 1 && d2.atkDown === 0 && d2.takenUp === 0);
  check('敵の与ダメ−30%・敵の被ダメ+30%', Math.abs(f.fateWheelEnemyAtkMult(d) - 0.7) < 1e-9 && f.fateWheelEnemyAtkMult(d2) === 1
    && Math.abs(f.fateWheelEnemyTakenBonus({ takenUp: 1 }) - 0.3) < 1e-9 && f.fateWheelEnemyTakenBonus(null) === 0);
}
{
  const pre = slice(app, "let fateDmgMult=1, fateWheelPick=null;", 'const d=getDmg(card,slotIdx,activeMon,localOryoAdd,localDmgModAdd,halved,attackStartDist,fateDmgMult);');
  check('コインは使うたびに投げ、この技のダメージへ倍率を渡す', /else if\(card\.monId===FATE_COIN_MONSTER_ID\)\{\s*const side=rollFateCoin\(\);\s*fateDmgMult=fateCoinDmgMult\(side\);/.test(pre)
    && /withFateSlotStack\(p\.fateStacks,slotIdx,'combo'\)/.test(pre) && /withFateCoinGuts\(p\.fateStacks\)/.test(pre));
  check('運命の輪は使う前に出目を決め、3倍・2倍だけこの技へ掛ける', /fateWheelPick=rollFateWheel\(\);\s*if\(fateWheelPick\.dmgMult\) fateDmgMult=fateWheelPick\.dmgMult;/.test(pre));
  check('ダメージの式は「この技のダメージ」の倍率を受け取る',
    /const getDmg = useCallback\(\(card, slotIdx, mon, additionalOryo=0, additionalDmgMod=0, isSecondOrLaterAtk=false, attackStartDist=enemyDist, skillDmgMult=1\) => \{/.test(app)
    && /baseDmgMult\*\(Number\(skillDmgMult\)>0\?Number\(skillDmgMult\):1\)\*totalBuffMult/.test(app));
  check('運命の輪の残りの出目は当たったときだけ効かせる', /else if\(card\.monId===FATE_WHEEL_MONSTER_ID\)\{\s*if\(fateWheelPick && finalD>0\)\{/.test(app)
    && /writeFateWheel\(\{\.\.\.fateWheelRef\.current,atkDown:FATE_WHEEL_DEBUFF_TURNS\}\)/.test(app)
    && /writeFateWheel\(\{\.\.\.fateWheelRef\.current,takenUp:FATE_WHEEL_DEBUFF_TURNS\}\)/.test(app));
  check('連撃は予測・あつの挑発・ふつうの攻撃の3か所すべてに付く',
    (app.match(/exCombos:withFateCombo\(tacticsExCombosAt\(slotIdx,(halved|true)\),(getPermaBuff|livePermaBuff)\('fateStacks',null\),slotIdx\)/g) || []).length === 3
    && !/exCombos:tacticsExCombosAt\(/.test(app));
  check('裏の消費ガッツ+20%はゴーストの固有技の消費に入る',
    /if \(card\.type === 'unique' && card\.monId===FATE_COIN_MONSTER_ID\) cost = Math\.floor\(cost \* fateCoinGutsMult\(livePermaBuff\('fateStacks',null\)\)\);/.test(app));
  check('敵の与ダメ−30%は敵の攻撃力へ、敵の被ダメ+30%は与ダメージの式へ',
    /intent\.value\*\(1\.0-getWaveBuff\('enemyAtkDebuffPct'\)\)\*fateWheelEnemyAtkMult\(fateWheelRef\.current\)/.test(app)
    && /getWaveBuff\('enemyTakenDmgBonus'\)\+fateWheelEnemyTakenBonus\(fateWheelRef\.current\)\+additionalDmgMod/.test(app));
  check('弱体はターンが進むと減り、WAVEが変わる・ランを始めると消える',
    /writeFateWheel\(tickFateWheelDebuff\(fateWheelRef\.current\)\)/.test(app)
    && /setWaveBuffs\(\{\}\); resetFateWheel\(\);/.test(app)
    && (app.match(/resetTrickStart\(\); resetFateWheel\(\);/g) || []).length === 3);
  check('積んだ強化はランを始めると消える(permaBuffs に入れている)', /writePermaBuffs\(\{autoHpRecovery:0\.1\}\)/.test(app) && !/fateStacks:\s*\{/.test(app.slice(0, app.indexOf('const resetAllState'))));
}

// --- ③ いたずら ---
{
  const abilitySrc = slice(rhythm, 'const RHYTHM_MONSTER_ABILITIES=', '// 能力を通したライフ計算。');
  const activateSrc = slice(rhythm, 'const rhythmActivateMonsterAbility=', '// 蘇生したときのスコアの続き方');
  check('能力の決めごとを切り出せる', abilitySrc.length > 0 && activateSrc.length > 0);
  const rs = { RHYTHM_LIFE_MAX: 1000, rhythmLifeValue: (v) => Number(v) || 0 };
  vm.createContext(rs);
  vm.runInContext(`${abilitySrc}\n${activateSrc}\nglobalThis.r={RHYTHM_MONSTER_ABILITIES,rhythmMonsterAbilityForLineage,createRhythmMonsterAbilityState,rhythmMonsterAbilityRemainingMs,rhythmApplyMonsterAbilityToLifeDelta,rhythmItazuraKeepsCombo,rhythmActivateMonsterAbility};`, rs);
  const r = rs.r;
  const ita = r.rhythmMonsterAbilityForLineage('ghost');
  check('主血統ゴーストの能力は「いたずら」(6秒)', !!ita && ita.id === 'ITAZURA' && ita.name === 'いたずら' && ita.durationMs === 6000);
  const on = r.rhythmActivateMonsterAbility({ ability: ita, state: r.createRhythmMonsterAbilityState(), life: 500, songTimeMs: 10000 });
  check('取ると6秒の終わりを持つ(ライフは変えない)', on.applied && on.life === 500 && on.state.itazuraUntilMs === 16000
    && r.rhythmMonsterAbilityRemainingMs(on.state, 'ITAZURA', 12000) === 4000);
  check('効いているあいだライフが減らない(増えるぶんはそのまま)', r.rhythmApplyMonsterAbilityToLifeDelta(on.state, -80, 15999) === 0
    && r.rhythmApplyMonsterAbilityToLifeDelta(on.state, 30, 12000) === 30 && r.rhythmApplyMonsterAbilityToLifeDelta(on.state, -80, 16000) === -80);
  check('効いているあいだ BAD・MISS でもコンボを守る(ほかの判定・切れたあと・取る前は守らない)',
    r.rhythmItazuraKeepsCombo(on.state, 'MISS', 12000) && r.rhythmItazuraKeepsCombo(on.state, 'BAD', 15999)
    && !r.rhythmItazuraKeepsCombo(on.state, 'GOOD', 12000) && !r.rhythmItazuraKeepsCombo(on.state, 'MISS', 16000)
    && !r.rhythmItazuraKeepsCombo(r.createRhythmMonsterAbilityState(), 'MISS', 12000));
  check('必死・無敵の残り時間とは別々に持つ',
    r.rhythmActivateMonsterAbility({ ability: r.RHYTHM_MONSTER_ABILITIES.MUTEKI, state: on.state, life: 500, songTimeMs: 11000 }).state.itazuraUntilMs === 16000);
  check('演奏: コンボはアシストのコンボガードより先に守る(守れたときはガードを使わない)',
    /if\(nextCombo===0&&run\.combo>0&&rhythmItazuraKeepsCombo\(run\.abilities,judgment,run\.audio\?\.songTimeMs\?\.\(\)\?\?0\)\)keptCombo=run\.combo;/.test(play)
    && play.indexOf('rhythmItazuraKeepsCombo(run.abilities') < play.indexOf('if(keptCombo===0&&nextCombo===0&&run.combo>0&&(judgment===\'BAD\'||judgment===\'MISS\')&&guard>0)'));
  check('演奏中の右上に残り時間を出し、持ち主の枠を光らせる',
    /itazuraMs>0\?`いたずら \$\{\(itazuraMs\/1000\)\.toFixed\(1\)\}s`/.test(play)
    && /'ITAZURA',songTimeMs\)>0&&owners\.ITAZURA\)active\.add\(owners\.ITAZURA\)/.test(play));
}

// --- ④ 技ごとの攻撃モーション ---
check('ゴースト・スプーキーの技ごとの動きを SKILL_MOTION_SETS へ入れた',
  /Ghost:SKM_GHOST, Spooky:SKM_SPOOKY \}\);/.test(fxSrc) && /const SKM_GHOST = Object\.freeze\(\{/.test(fxSrc) && /const SKM_SPOOKY = Object\.freeze\(\{/.test(fxSrc));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

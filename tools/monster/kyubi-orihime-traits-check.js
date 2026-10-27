#!/usr/bin/env node
// キュービ・オリヒメの勇者特性とEXの決めごとを見張る(2026-10-27 社長の決定。数字は案の「推奨」)。
//
//   node tools/monster/kyubi-orihime-traits-check.js
//
// 2体はまだ下書きで、効き目は 22-enemy-and-bond-entries.jsx の純関数だけにある(バトルへのつなぎ込みは正式公開のとき)。
// 数字を1つ書き違えても画面はふつうに動くので、社長が選んだ数字をここで1本ずつ確かめる。
// 本文: docs/progress/kyubi-orihime/hero-trait-ex-spec.md
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const bond = read('monster-hero/src/parts/22-enemy-and-bond-entries.jsx');
const start = bond.indexOf("const KYUBI_MONSTER_ID = 'Kyubi'");
const end = bond.indexOf('const reikonEvasionUp');
check('2体の決めごとを抜き出せる', start > 0 && end > start);
const endLine = bond.indexOf('\n// ', bond.indexOf('\n', end + 1));
const k = {};
vm.createContext(k);
vm.runInContext(`${bond.slice(start, endLine > end ? endLine : undefined)}
globalThis.x={KYUBI_PHASES,kyubiPhaseOfSlot,kyubiRengokuOf,kyubiPhaseEffectOf,kageroAfterAttack,kageroUseEvade,tickKagero,
  useKitsunebi,tickKitsunebi,kitsunebiOnHit,kitsunebiEffectOf,orihimeDiffOf,addOuse,orihimeBondEffectOf,shareOrihimeDamage,
  startHoshiai,rollKogare,KOGARE_TURNS,KOGARE_CHANCE,KOGARE_ROLLS_PER_TURN,hasReikon,startReikon,tickReikon,reikonGutsMult,reikonEvasionUp};`, k);
const x = k.x;

// ---------- キュービ 九尾四相 ----------
check('相は距離で決まる(零=煉獄・近=天翔・中=陽炎・遠=炸裂)',
  ['rengoku', 'tensho', 'kagero', 'sakuretsu'].every((id, slot) => x.kyubiPhaseOfSlot(slot)?.id === id) && x.kyubiPhaseOfSlot(4) === null);
const sak = x.kyubiPhaseEffectOf('sakuretsu');
check('遠=炸裂ノ相: 与ダメ40%の連撃×1', sak.combo?.count === 1 && near(sak.combo.rate, 0.4) && sak.dmgMult === 1);
const ten = x.kyubiPhaseEffectOf('tensho');
check('近=天翔ノ相: 連撃20%×1・与ダメ+15%・会心率+20%(命中の分を会心率へ)',
  ten.combo?.count === 1 && near(ten.combo.rate, 0.2) && near(ten.dmgMult, 1.15) && near(ten.critAdd, 0.2) && !('hitAdd' in ten));
check('中=陽炎ノ相: 攻撃したあと完全回避を持つ', x.kyubiPhaseEffectOf('kagero').evadeAfterAttack === true);
{
  let s = x.kageroAfterAttack(null);
  const got = s.ready;
  s = x.kageroUseEvade(s);
  const seq = [];
  for (let i = 0; i < 4; i++) { s = x.kageroAfterAttack(s); seq.push(s.ready ? 1 : 0); if (s.ready) break; s = x.tickKagero(s); }
  check('陽炎ノ相: 持てるのは1つ・使ったら3ターン待ち', got === true && JSON.stringify(seq) === '[0,0,0,1]', JSON.stringify(seq));
}
check('零=煉獄ノ相: 煉獄は上限10', x.kyubiRengokuOf(15) === 10 && x.kyubiRengokuOf(-2) === 0);
const ren0 = x.kyubiPhaseEffectOf('rengoku', { rengoku: 0, skillGuts: 0 });
const ren10 = x.kyubiPhaseEffectOf('rengoku', { rengoku: 10, skillGuts: 56 });
const renCap = x.kyubiPhaseEffectOf('rengoku', { rengoku: 3, skillGuts: 200 });
check('零=煉獄ノ相: 連撃は煉獄×5%(0なら出ない)・消費ガッツ1につき与ダメ+0.3%(上限+20%)',
  ren0.combo === null && near(ren10.combo.rate, 0.5) && near(ren10.dmgMult, 1 + 0.003 * 56) && near(renCap.dmgMult, 1.2) && near(renCap.combo.rate, 0.15));

// ---------- キュービ 九尾幻灯 ----------
{
  let s = x.useKitsunebi(null);
  check('九尾幻灯: 使うと狐火5個・幻灯強化3ターン', s.active && s.fires === 5 && s.buffTurns === 3);
  const e = x.kitsunebiEffectOf(s, 'attack');
  check('幻灯強化: 狐火1つにつき与ダメ+4%・被ダメ−3%(5個で+20%・−15%)', near(e.buffDmg, 0.2) && near(e.buffTaken, 0.15));
  check('ふだんの助け: 攻撃10%の追加・ガード被ダメ−20%・助けでガッツ5%',
    near(e.extraHit, 0.1) && near(x.kitsunebiEffectOf(s, 'guard').guardCut, 0.2) && near(x.kitsunebiEffectOf(s, 'assist').assistGuts, 0.05)
    && x.kitsunebiEffectOf(s, 'guard').extraHit === 0);
  const hit = x.kitsunebiOnHit(s);
  check('攻撃を受けたら狐火1つが盾(被ダメ−50%)になって消える', hit.next.fires === 4 && near(hit.takenMult, 0.5));
  let t = hit.next;
  for (let i = 0; i < 3; i++) t = x.tickKitsunebi(t);
  check('3ターンで狐火が1つ戻り、強化は3ターンで切れる', t.fires === 5 && t.buffTurns === 0);
  let empty = { active: true, fires: 0, regen: 0, buffTurns: 0 };
  check('狐火が0なら盾にならない', x.kitsunebiOnHit(empty).takenMult === 1 && x.kitsunebiEffectOf(empty, 'attack').extraHit === 0);
  const again = x.useKitsunebi({ active: true, fires: 2, regen: 1, buffTurns: 2 });
  check('2回目: 狐火満タン・強化はかけ直し(重ならない)', again.fires === 5 && again.buffTurns === 3);
  check('使う前は何も効かない', x.kitsunebiEffectOf(null).extraHit === 0 && x.kitsunebiOnHit(null).takenMult === 1);
}

// ---------- オリヒメ 天河の契り ----------
check('間合いの差は1〜3だけ(同じ距離はつながらない)', x.orihimeDiffOf(0, 3) === 3 && x.orihimeDiffOf(2, 1) === 1 && x.orihimeDiffOf(1, 1) === 0);
check('逢瀬の上限(差1=5・差2=8・差3=12)',
  x.addOuse(5, 1, true) === 5 && x.addOuse(8, 2, true) === 8 && x.addOuse(12, 3, true) === 12 && x.addOuse(4, 1, true) === 5);
check('違う種類の動き・相方が倒れたら増えない(溜まった数は残る)', x.addOuse(3, 2, false) === 3 && x.addOuse(3, 2, true, false) === 3);
const b1 = x.orihimeBondEffectOf(1, 5), b10 = x.orihimeBondEffectOf(1, 0);
check('差1: 最初から与ダメ+10%・逢瀬1つごとに+2%(5個で+20%)', near(b10.dmgAdd, 0.1) && near(b1.dmgAdd, 0.2) && !b1.share);
const b2a = x.orihimeBondEffectOf(2, 3), b2b = x.orihimeBondEffectOf(2, 8);
check('差2: 最初から被ダメ−10%・逢瀬4から与ダメ+逢瀬×2%(8個で+16%)',
  near(b2a.takenCut, 0.1) && b2a.dmgAdd === 0 && near(x.orihimeBondEffectOf(2, 4).dmgAdd, 0.08) && near(b2b.dmgAdd, 0.16));
const b3a = x.orihimeBondEffectOf(3, 5), b3b = x.orihimeBondEffectOf(3, 6), b3c = x.orihimeBondEffectOf(3, 12);
check('差3: 最初から分け合い・逢瀬6で被ダメ−15%・12で与ダメ+40%',
  b3a.share && b3a.takenCut === 0 && near(b3b.takenCut, 0.15) && b3b.dmgAdd === 0 && near(b3c.dmgAdd, 0.4));
const sh = x.shareOrihimeDamage(101);
check('分け合っても2体の合計は増えない', sh[0] + sh[1] === 101 && Math.abs(sh[0] - sh[1]) <= 1);
check('相方が倒れたらつながりは止まる', x.orihimeBondEffectOf(3, 12, false).dmgAdd === 0 && !x.orihimeBondEffectOf(3, 12, false).share);

// ---------- オリヒメ 星合の刻・焦がれ待つ天ノ河 ----------
const h0 = x.startHoshiai(0, 1), h12 = x.startHoshiai(12, 3), h8 = x.startHoshiai(8, 2);
check('星合の刻: 2ターン+逢瀬4つごとに1ターン(最大5)', h0.turns === 2 && h8.turns === 4 && h12.turns === 5);
check('星合の刻: 続く攻撃は30%+逢瀬×1.5%+差2で5%・差3で10%(上限50%)・1ターン2回まで',
  near(h0.rate, 0.3) && near(h8.rate, 0.3 + 0.12 + 0.05) && near(h12.rate, 0.5) && h0.perTurn === 2);
check('焦がれ待つ天ノ河: 3ターン・25%・1ターン2回まで', x.KOGARE_TURNS === 3 && near(x.KOGARE_CHANCE, 0.25) && x.KOGARE_ROLLS_PER_TURN === 2);
check('焦がれ待つ天ノ河: 振れる回数を使い切ったら振らない',
  x.rollKogare(2, 0.1).confused === true && x.rollKogare(2, 0.3).confused === false && x.rollKogare(0, 0).confused === false
  && x.rollKogare(2, 0.1).rollsLeft === 1);

// ---------- 固有技の効果「霊魂」(2体共通) ----------
check('霊魂は2体とも持つ', x.hasReikon('Kyubi') && x.hasReikon('Orihime') && !x.hasReikon('Dreamy'));
{
  let r = x.startReikon();
  const seq = [[x.reikonGutsMult(r), x.reikonEvasionUp(r)]];
  for (let i = 0; i < 4; i++) { r = x.tickReikon(r); seq.push([x.reikonGutsMult(r), x.reikonEvasionUp(r)]); }
  check('霊魂: 使ったターンは効かず、次のターンから3ターン 消費ガッツ×0.7・味方の回避率+10%',
    JSON.stringify(seq) === '[[1,0],[0.7,10],[0.7,10],[0.7,10],[1,0]]', JSON.stringify(seq));
  const again = x.startReikon();
  check('霊魂: 使い直したらかけ直し(重ならない)', again.turns === 3 && again.wait === 1);
}
check('煉獄ノ相のダメージは、軽くなる前の消費で数える(元の消費ガッツを渡す)',
  /煉獄ノ相のダメージは、軽くなる前の消費で数える/.test(bond));
const tactics = read('monster-hero/src/parts/32-tactics-units.jsx');
check('タイプ(キュービ アタッカー/シャドウ・オリヒメ サポーター/タンク)',
  /Kyubi: \{ main: 'attacker', sub: 'shadow' \}/.test(tactics) && /Orihime: \{ main: 'supporter', sub: 'tank' \}/.test(tactics));
const rhythm = read('monster-hero/data/rhythm-mode.js');
check('モンヒロビートの能力(キュービ 必死・オリヒメ 根性)', /Kyubi:'HISSHI', Orihime:'KONJO'/.test(rhythm));

// ---------- 固有技の段(社長 2026-10-27「Aで9段目に炸裂、8段目天翔、7に煉獄」)と、技ごとの動き ----------
const KYUBI_UNIQUE = ['ゆうわく','なめろう','超狐火','神狐蒼火','八嵐天衝','陽炎','煉獄九尾陣','天河天翔','炸裂気泡陣'];
const ORIHIME_UNIQUE = ['求愛','織姫のくちづけ','超狐火・星','陽炎','神狐星火','八鈴天衝','炸裂気泡陣','煉獄九尾陣','天河天翔'];
const allyAll = read('monster-hero/data/ally-monsters.js');
check('キュービの固有技は×2.4・消費48、段は社長の並び',
  allyAll.includes('monId:"Kyubi", baseMult:2.4, baseGuts:48') && allyAll.includes(`names:${JSON.stringify(KYUBI_UNIQUE)}`));
check('オリヒメの固有技は×2.3・消費46、名前は社長が選んだもの・並びは変えない',
  allyAll.includes('monId:"Orihime", baseMult:2.3, baseGuts:46') && allyAll.includes(`names:${JSON.stringify(ORIHIME_UNIQUE)}`));
{
  const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
  const kb = fx.slice(fx.indexOf('const SKM_KYUBI'), fx.indexOf('const SKM_ORIHIME'));
  const ob = fx.slice(fx.indexOf('const SKM_ORIHIME'), fx.indexOf('const SKILL_MOTION_SETS = '));
  const names = (b) => [...b.slice(b.indexOf('unique:[')).matchAll(/skm\([^\n]*\/\/ ([^\n]+)$/gm)].map((m) => m[1].trim());
  check('キュービの動き(SKM_KYUBI.unique)は名前と同じ順', JSON.stringify(names(kb)) === JSON.stringify(KYUBI_UNIQUE), names(kb).join('・'));
  // 名前を変えた3つは「(キュービの◯◯の動き)」と書いてあるので、その◯◯で突き合わせる
  const borrowed = [...ob.matchAll(/SKM_KYUBI\.unique\[(\d)\][^\n]*\/\/ ([^\n(]+)(?:\(キュービの([^\n]+)の動き\))?$/gm)].map((m) => [Number(m[1]), (m[3] || m[2]).trim()]);
  check('オリヒメの動きは、キュービの同じ名前の技の動きを借りる',
    borrowed.length === 7 && borrowed.every(([i, n]) => KYUBI_UNIQUE[i] === n), JSON.stringify(borrowed));
}

// ---------- 本体へのつなぎ込み(②キュービ「九尾四相」) ----------
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  check('相は始まりの距離で決まる(5つの遊びは勇者モンを置いた距離・タクティクスはその枠)',
    /kyubiPhaseOfSlot\(isTacticsMode\(runMode\) \? slotIdx : initialBattleDistanceRef\.current\)/.test(app));
  check('攻撃の与ダメ・連撃(2か所)・会心率に、キュービ本人の相の効き目が乗る',
    app.includes('blackNoteEffectAt(slotIdx,mon?.id).dmgMult*kyubiAttackAt(slotIdx,mon?.id,card).dmgMult*')
    && app.includes('kyubiAttackAt(slotIdx,mon?.id,card).combo])') && app.includes('kyubiAttackAt(slotIdx,activeMon?.id,card).combo])')
    && app.includes('+kyubiAttackAt(slotIdx,activeMon?.id,card).critAdd)'));
  check('煉獄ノ相のダメージは、軽くなる前の消費(getCardBaseGuts)で数える',
    /skillGuts: card \? getCardBaseGuts\(card\) : 0/.test(app) && /let cost = getCardBaseGuts\(card\);/.test(app));
  check('カードを使うと煉獄+1・陽炎の完全回避を持つ', /gainKyubiCard\(slotIdx,slots\[slotIdx\]\?\.id,card\)/.test(app));
  check('陽炎の完全回避は、抽選なしで回避して使い切る', /: kageroEvade \? 'evasion'/.test(app) && /kageroUseEvade\(kyubiRef\.current\.kagero/.test(app));
  check('陽炎の待ちはターンが進むと減り、相・煉獄・陽炎はランの片付けで消す',
    /tickKyubiKagero\(\); \/\/ ★陽炎ノ相/.test(app) && /resetKyubi\(\); \/\/ 九尾四相/.test(app));
}

// ---------- 下書きのあいだは本体に出さない ----------
const ally = read('monster-hero/data/ally-monsters.js');
check('基礎能力は社長が決めた値(キュービ 420/150/160/70・オリヒメ 440/140/145/85)',
  /baseHp:420, baseGuts:150, baseAtk:160, baseDef:70, plusStats:\{hp:120,atk:40,def:10,guts:45\}/.test(ally)
  && /baseHp:440, baseGuts:140, baseAtk:145, baseDef:85, plusStats:\{hp:140,atk:30,def:15,guts:40\}/.test(ally));
check('2体はまだ下書き(draft:true)のまま',
  /Kyubi: Object\.freeze\(\{[^\n]*\n[^\n]*draft:true/.test(ally) && /Orihime: Object\.freeze\(\{[^\n]*\n[^\n]*draft:true/.test(ally));

// ---------- 新モンスター確認(デバッグ)で動かして見られる ----------
const lab = read('monster-hero/src/parts/74-screen-monster-check-debug.jsx');
check('確認画面の技タブに、2体の「動かして見る」欄がある',
  /mon\.id === KYUBI_MONSTER_ID && <KyubiTraitLab\/>/.test(lab) && /mon\.id === ORIHIME_MONSTER_ID && <OrihimeTraitLab\/>/.test(lab));
check('欄は決めごとの関数をそのまま呼ぶ(数字を画面側で持たない)',
  ['kyubiPhaseEffectOf', 'kageroAfterAttack', 'useKitsunebi', 'kitsunebiOnHit', 'tickKitsunebi', 'addOuse', 'orihimeBondEffectOf', 'startHoshiai', 'rollKogare', 'shareOrihimeDamage', 'startReikon', 'tickReikon', 'reikonGutsMult', 'reikonEvasionUp']
    .every((f) => lab.includes(`${f}(`)));

console.log(failed ? `\nNG: ${failed}件` : '\nすべてOK');
process.exit(failed ? 1 : 0);

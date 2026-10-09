// 机上の計算: モンスターごとの「1発のダメージ」「ガッツ1あたりの火力」「敵の1発を何回受けられるか」などを、
// ゲームの式から数字にする(ブラウザで戦わずに、性能だけを比べる)。Tier 表の「机上」の列に使う。
//
//   node tools/playbot/sim/desk.js [--diff Expert,Master] [--md <file>]
//
// 式の出どころ(作り変えない。ゲームの式が変わったらここも合わせる):
// - 与ダメージ: 60-app.jsx getDmg … floor(ちから × 距離の倍率 × 技の倍率 × 特性 × (1 + 間合い適性の補正) × …)
//     距離の倍率は「立っている枠と敵の距離の差」で [1.5, 1.3, 1.1, 0.9]。特性はその技を出した子のもの
//     (ゴーレム「怪力」×1.2、ピクシー・ミーア「魔力開放」は固有技 ×2)
// - 会心: 22-enemy の buildAttackHits。会心率は札の crit(通常技 0.1)、会心は ×1.5
// - カードのガッツ: 60-app.jsx getCardGuts … 通常技は floor(16 × 倍率)、固有技は baseGuts
// - 被ダメージ: 60-app.jsx getIncomingDamageBeforeTurnReduction
//     max(30, (敵の攻撃 − 丈夫さ×0.5) × (1 − min(0.5, 丈夫さ×0.00015))) × もち肌(狙われた子がモッチー・ミタラシなら 0.8)
// - 敵: 22-enemy の createBattleEnemy(難易度・WAVE)。行動の倍率は TACTICS_ACTION_DEFINITIONS(必殺技 ×2.5 など)
// - ガッツ: 始めは上限の50%(TACTICS_START_GUTS_RATE)、毎ターン上限の5%戻る(60-app.jsx のターン終わり)
// - 1ターンに置ける枚数: 1体なら1枚。ハム・剣士モッチー(HERO_CARD_BONUS_MONSTER_IDS)は自分のぶん+1
//
// ここでは育成・アシストカード・EX・バフはすべて無し(素のベースモン)。比べるのは「生まれ持った性能」。
const fs = require('fs');
const path = require('path');
const { loadGame } = require('./load-game');

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const DIFFS = argOf('--diff', 'Expert,Master').split(',');
const mdFile = argOf('--md', '');

const G = loadGame();
const MONS = Object.values(G.ALL_PLAYER_MONSTERS).filter((m) => m && !m.debugOnly);
const DIST_MULT = [1.5, 1.3, 1.1, 0.9];
const CRIT_EXP = (crit) => 1 + crit * 0.5;
const aptPct = (g) => (G.DIST_APTITUDE_MULT[g] ?? 1) - 1;

// 与ダメージ(60-app.jsx getDmg を、バフ無し・同じ距離・いちばん得意な枠で)
function hitOf(m, card, slot) {
  const traitOwner = m.id;
  let trait = traitOwner === 'Golem' ? 1.2 : 1.0;
  if ((traitOwner === 'Pixie' || traitOwner === 'Mia') && card.type === 'unique') trait *= 2.0;
  const apt = 1 + aptPct((m.distAptitude || [])[slot] || 'C');
  return Math.floor(m.baseAtk * DIST_MULT[0] * card.mult * trait * apt);
}
// 被ダメージ(60-app.jsx getIncomingDamageBeforeTurnReduction を、バフ無しで)
function takenOf(m, enemyAtk, mult = 1) {
  const def = m.baseDef;
  const rate = Math.min(0.5, def * 0.00015);
  const base = Math.max(30, (enemyAtk * mult - def * 0.5) * (1 - rate)) * ((m.id === 'Mocchi' || m.id === 'Mitarashi') ? 0.8 : 1);
  return Math.max(1, Math.floor(base));
}

const rows = MONS.map((m) => {
  const apt = m.distAptitude || ['C', 'C', 'C', 'C'];
  const bestSlot = [0, 1, 2, 3].sort((a, b) => aptPct(apt[b]) - aptPct(apt[a]))[0];
  const normal = { type: 'atk', mult: G.BASE_ATK_EVOLUTION[0].mult, crit: G.BASE_ATK_EVOLUTION[0].crit, guts: Math.floor(G.BASE_ATK_EVOLUTION[0].baseGuts * G.BASE_ATK_EVOLUTION[0].mult / G.BASE_ATK_EVOLUTION[0].baseMult) };
  const u = m.unique || {};
  const unique = { type: 'unique', mult: u.baseMult || 0, crit: 0.1, guts: u.baseGuts || 0 };
  const nHit = hitOf(m, normal, bestSlot) * CRIT_EXP(normal.crit);
  const uHit = unique.mult ? hitOf(m, unique, bestSlot) * CRIT_EXP(unique.crit) : 0;
  const maxGuts = m.baseGuts;
  const cards = 1 + (G.HERO_CARD_BONUS_MONSTER_IDS.includes(m.id) ? 1 : 0);
  // 20ターンで使えるガッツ(始め50% + 毎ターン5%)。捨てて戻すぶんは数えない
  const gutsBudget20 = maxGuts * (G.TACTICS_START_GUTS_RATE + 0.05 * 20);
  // 20ターンで出せるダメージ: ガッツと枚数(1ターン cards 枚。同じ子の2枚目は半分)の小さいほう。通常技だけで撃つ
  const perTurnCards = cards === 1 ? 1 : 1.5;
  const atkCount = Math.min(20 * cards, Math.floor(gutsBudget20 / normal.guts));
  const dmg20 = Math.round(nHit * Math.min(atkCount, 20 * perTurnCards));
  const byDiff = {};
  for (const d of DIFFS) {
    const e1 = G.createBattleEnemy(1, d, null, null, 1, { mode: 'tacticsPro' });
    const e3 = G.createBattleEnemy(3, d, null, null, 1, { mode: 'tacticsPro' });
    const e5 = G.createBattleEnemy(5, d, null, null, 1, { mode: 'tacticsPro' });
    const hit1 = takenOf(m, e1.atk);
    // WAVE 1 を1体で倒すのに要るターン(通常技。ガッツが尽きたら、戻るのを待つ)
    let hp = e1.maxHp; let guts = maxGuts * G.TACTICS_START_GUTS_RATE; let t = 0;
    while (hp > 0 && t < 40) {
      t += 1;
      let used = 0;
      for (let c = 0; c < cards && guts >= normal.guts; c++) { hp -= nHit * (c === 0 ? 1 : 0.5); guts -= normal.guts; used++; }
      guts = Math.min(maxGuts, guts + maxGuts * 0.05);
    }
    byDiff[d] = {
      w1Turns: hp > 0 ? '40+' : t,
      w1Hits: Math.floor(m.baseHp / hit1),
      w1SpecialHits: Math.floor(m.baseHp / takenOf(m, e1.atk, 2.5)),
      w3Hits: Math.floor(m.baseHp / takenOf(m, e3.atk)),
      w5Hits: Math.floor(m.baseHp / takenOf(m, e5.atk)),
    };
  }
  return { m, apt, bestSlot, nHit, uHit, nPerGuts: nHit / normal.guts, uPerGuts: unique.guts ? uHit / unique.guts : 0, maxGuts, cards, atkCount, dmg20, byDiff, unique };
});

const DIST_JA = ['零', '近', '中', '遠'];
const lines = [];
const out = (t = '') => lines.push(t);
out(`# 机上の性能表(タクティクスプロ・素のベースモン・${DIFFS.join(' / ')})`);
out();
out('ゲームの式(60-app.jsx の getDmg・getCardGuts・被ダメージの式、22-enemy の createBattleEnemy)から計算した数字です。育成・アシストカード・EX・バフは入れていません。');
out('1発のダメージは「いちばん得意な枠に立ち、敵が同じ距離(×1.5)」のとき。会心(10%・×1.5)の平均を含みます。');
out();
out('| モンスター | 得意な枠 | 通常技1発 | ガッツ1あたり(通常) | 固有技1発(ガッツ) | ガッツ1あたり(固有) | ガッツ上限 | 1ターンの枚数 | 20ターンで撃てる通常技 | 20ターンのダメージ |');
out('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
for (const r of [...rows].sort((a, b) => b.dmg20 - a.dmg20)) {
  out(`| ${r.m.name} | ${DIST_JA[r.bestSlot]}${r.apt[r.bestSlot]} | ${Math.round(r.nHit)} | ${r.nPerGuts.toFixed(1)} | ${Math.round(r.uHit)}(${r.unique.guts}) | ${r.uPerGuts.toFixed(1)} | ${r.maxGuts} | ${r.cards} | ${r.atkCount} | ${r.dmg20.toLocaleString()} |`);
}
for (const d of DIFFS) {
  out();
  out(`## ${d}: 1体で戦う序盤`);
  out();
  const e1 = G.createBattleEnemy(1, d, null, null, 1, { mode: 'tacticsPro' });
  const e3 = G.createBattleEnemy(3, d, null, null, 1, { mode: 'tacticsPro' });
  const e5 = G.createBattleEnemy(5, d, null, null, 1, { mode: 'tacticsPro' });
  out(`WAVE 1 の敵: ${e1.name}(ライフ ${e1.maxHp.toLocaleString()}・攻撃 ${e1.atk})/ WAVE 3: ${e3.name}(攻撃 ${e3.atk})/ WAVE 5: ${e5.name}(攻撃 ${e5.atk})。編成の総合力による敵の伸びは入れていません。`);
  out();
  out('| モンスター | WAVE 1 を倒すターン | WAVE 1 の通常攻撃を何発受けられるか | 必殺技(×2.5)を何発 | WAVE 3 の通常攻撃 | WAVE 5 の通常攻撃 |');
  out('| --- | --- | --- | --- | --- | --- |');
  for (const r of [...rows].sort((a, b) => (Number(a.byDiff[d].w1Turns) || 99) - (Number(b.byDiff[d].w1Turns) || 99))) {
    const x = r.byDiff[d];
    out(`| ${r.m.name} | ${x.w1Turns} | ${x.w1Hits} | ${x.w1SpecialHits} | ${x.w3Hits} | ${x.w5Hits} |`);
  }
}
const text = `${lines.join('\n')}\n`;
if (mdFile) { fs.mkdirSync(path.dirname(path.resolve(mdFile)), { recursive: true }); fs.writeFileSync(path.resolve(mdFile), text); console.log(`書き出した: ${mdFile}`); } else process.stdout.write(text);

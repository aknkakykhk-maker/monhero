#!/usr/bin/env node
// タクティクスの「ヘイト」の基準表と試算(2026-10-17 社長「どっちにしろ基準の数値がほしい」「出来るだけ意図的に調整できるようにしたい」)。
// ゲーム本体には入れていない。前回の試算(hate-trial.js)の続き。
//
//   node tools/playbot/sim/hate-table.js [--runs 200] [--md <file>] [--diff Expert,Master] [--only base]
//
// 数字は下の TACTICS_HATE の1か所だけに置く(ゲームに入れるときも、この形のまま1つの定数にする)。
//   1) action … 行動ごとの基準値(全員に共通)
//   2) roles … 役割(盾・回復・補助・攻撃・ひそむ)ごとの既定値。mult = ヘイトの増え方の倍率、add = 行動ごとの上乗せ
//   3) monsters … 子ごとの役割。個別に mult・add・always(行動のたびの上乗せ = 特性の常時の印)で上書きできる
// ヘイトの1ターンの動き: ヘイト = 前のヘイト × decay + 倍率 ×(そのターンに増えたぶん)。上限 cap・倒れたら0・WAVE で0。
// 狙いの重み = 今の重み(1 + 2 ×(1 − 残りライフの割合))×(1 + ヘイト ÷ k)。
// シミュレーター(battle.js)の口: actHook(カードを使った子)・aimHook(狙いの決め方)。
const fs = require('fs');
const path = require('path');
const { simulateRun, G, MONS } = require('./battle');

// ===================== ここが基準の表(1か所) =====================
const TACTICS_HATE = {
  k: 25, // ヘイトが k たまると、狙われやすさが2倍
  decay: 0.7, // 毎ターン3割へる
  cap: 100,
  flames: [20, 50, 80], // 炎の段(🔥・🔥🔥・🔥🔥🔥)になるヘイト
  hero: { floor: 0 }, // 勇者のヘイトの下地(これより下がらない)。0 = 下地なし
  action: {
    atk: 2, // 通常攻撃(通常技・距離の技)を1枚使った
    unique: 4, // 固有技を1枚使った
    dmgShare: 30, // そのターンに味方が与えたダメージのうち、その子の割合 × 30(1人で全部なら+30)
    heal: 30, // 回復の量 1.0(ライフの上限の100%ぶん。ガッツは半分に数える)あたり
    buff: 5, // 強化のカード(ニコラオ・ドラ・かどみうむ・みゃる・きき・ポルツ)
    debuff: 8, // 弱体のカード
    guard: 6, // ガードのカード1枚
    taunt: 40, // 挑発(あつの挑発)
    ex: 10, // EX を使った(下の exByEffect に無いもの)
  },
  exByEffect: { coverAll: 60, partyGuard: 20, lifeSpring: 20, cookieBox: 15, partyBoost: 15, present: 10 },
  roles: {
    tank: { label: '盾', mult: 1.3, add: { guard: 6 } },
    healer: { label: '回復', mult: 1.2, add: {} },
    support: { label: '補助', mult: 1.1, add: {} },
    attacker: { label: '攻撃', mult: 1.0, add: {} },
    sneak: { label: 'ひそむ', mult: 0.8, add: {} },
  },
  monsters: {
    Mocchi: { role: 'attacker' }, Mitarashi: { role: 'attacker' }, Golem: { role: 'attacker' }, Suezo: { role: 'attacker' },
    Ham: { role: 'attacker' }, Pandora: { role: 'attacker' }, KenshiMocchi: { role: 'attacker' }, Eiki: { role: 'attacker' },
    Kuromy: { role: 'attacker' }, Spooky: { role: 'attacker' },
    Monol: { role: 'tank' }, Yggdrasil: { role: 'tank' }, MelWhip: { role: 'tank' }, Oboro: { role: 'tank' }, Plant: { role: 'tank' },
    Melody: { role: 'healer' }, Undine: { role: 'healer' },
    Pixie: { role: 'support' }, Mia: { role: 'support' }, Ark: { role: 'support' }, Iblis: { role: 'support' },
    Snegurochka: { role: 'support' }, Yaobikuni: { role: 'support' },
    Tiger: { role: 'sneak' }, Zan: { role: 'sneak' }, Ghost: { role: 'sneak' },
  },
};
// ================================================================

// 子ごとの値を1つにまとめる(役割の既定値 → 子の上書き)
const hateOf = (cfg, id) => {
  const m = cfg.monsters[id] || { role: 'attacker' };
  const r = cfg.roles[m.role] || cfg.roles.attacker;
  return { role: m.role, mult: Number.isFinite(m.mult) ? m.mult : r.mult, add: { ...r.add, ...(m.add || {}) }, always: m.always || 0 };
};
const BUFF_IDS = ['oryo', 'dra', 'cadmium', 'myaru', 'kiki', 'poltz'];
// 回復の量(ライフ + ガッツ×0.5)。段は 0〜2(battle.js playTeaching の数字)
const HEAL_AMOUNT = {
  mua: [0.5, 0.7 + 0.35, 0.9 + 0.45],
  momosuke: [0.25, 0.7 + 0.35, 0.9 + 0.45],
  meloso: [0.3 + 0.15, 0.3 + 0.15, 0.3 + 0.15],
};
const actKind = (card) => {
  if (!card) return null;
  if (card.teach) {
    if (card.subType === 'stun_atsu') return 'taunt';
    if (card.type === 'heal') return 'heal';
    if (card.type === 'debuff') return 'debuff';
    if (BUFF_IDS.includes(card.id) || card.type === 'buff') return 'buff';
    return null;
  }
  if (card.type === 'guard') return 'guard';
  if (card.type === 'unique') return 'unique';
  if (card.type === 'atk' || card.type === 'range_atk') return 'atk';
  return null;
};
const actGain = (cfg, st, id, card, effMul) => {
  const kind = actKind(card);
  if (!kind) return { kind: null, gain: 0 };
  const h = hateOf(cfg, id);
  let base = cfg.action[kind] || 0;
  if (kind === 'heal') {
    const lv = Math.min(2, ((st.teachings.find((t) => t.id === card.id) || {}).evoLevel) || 0);
    base = cfg.action.heal * ((HEAL_AMOUNT[card.id] || [0, 0, 0])[lv] || 0) * effMul;
  } else if (kind === 'taunt' || kind === 'buff' || kind === 'debuff') base *= effMul;
  return { kind, gain: base + (h.add[kind] || 0) + h.always };
};

const TARGETED = ['ATTACK', 'SPECIAL'];
const flameOf = (cfg, h) => cfg.flames.filter((x) => h >= x).length;

// cfg = null なら今の式(ヘイトなし)。rec に数を貯める
const makeHooks = (cfg, rec) => {
  const actHook = (st, slot, card, effMul) => {
    if (!cfg) return;
    const id = st.mons[slot] && st.mons[slot].id;
    if (!id) return;
    const { kind, gain } = actGain(cfg, st, id, card, effMul);
    if (!kind) return;
    st.hPend = st.hPend || [0, 0, 0, 0];
    st.hPend[slot] += gain;
    rec.acts[id] = rec.acts[id] || {};
    rec.acts[id][kind] = (rec.acts[id][kind] || 0) + 1;
  };
  const aimHook = (st, intent) => {
    const filled = G.tacticsFilledSlots(st.units);
    if (cfg) {
      if (st.hWave !== st.wave) {
        st.hWave = st.wave; st.hate = [0, 0, 0, 0]; st.hPend = [0, 0, 0, 0];
        if (Number.isInteger(st.heroSlot)) st.hate[st.heroSlot] = (cfg.hero && cfg.hero.floor) || 0;
        st.hSnap = { ...st.dmgBySlot }; st.hEx = { ...st.exUses };
      } else {
        const dealtOf = (i) => Math.max(0, (st.dmgBySlot[i] || 0) - (st.hSnap[i] || 0));
        const team = filled.reduce((a, i) => a + dealtOf(i), 0);
        for (const i of filled) {
          const id = st.mons[i].id;
          const h = hateOf(cfg, id);
          let gain = (st.hPend[i] || 0) + (team > 0 ? cfg.action.dmgShare * dealtOf(i) / team : 0);
          if ((st.exUses[id] || 0) - (st.hEx[id] || 0) > 0) {
            const eff = (G.tacticsExDefOf(id) || {}).effect;
            const g = (eff in cfg.exByEffect ? cfg.exByEffect[eff] : cfg.action.ex) + (h.add.ex || 0) + h.always;
            gain += g;
            rec.acts[id] = rec.acts[id] || {};
            const k = eff === 'coverAll' ? 'cover' : 'ex';
            rec.acts[id][k] = (rec.acts[id][k] || 0) + 1;
          }
          let v = (st.hate[i] || 0) * cfg.decay + h.mult * gain;
          if (i === st.heroSlot) v = Math.max(v, (cfg.hero && cfg.hero.floor) || 0);
          if (G.normalizeTacticsUnit(st.units[i]).downed) v = 0;
          st.hate[i] = Math.min(cfg.cap, v);
          // 炎の段の出方(立っている子のターンだけ数える)
          if (!G.normalizeTacticsUnit(st.units[i]).downed) {
            const f = rec.flames[id] || (rec.flames[id] = [0, 0, 0, 0]);
            f[flameOf(cfg, st.hate[i])] += 1;
            rec.hateSum[id] = (rec.hateSum[id] || 0) + st.hate[i];
          }
        }
        st.hPend = [0, 0, 0, 0];
        st.hSnap = { ...st.dmgBySlot }; st.hEx = { ...st.exUses };
      }
    }
    filled.forEach((i) => {
      const down = G.normalizeTacticsUnit(st.units[i]).downed;
      if (down && !(st.hDownBy || {})[i]) rec.downs[st.mons[i].id] = (rec.downs[st.mons[i].id] || 0) + 1;
      st.hDownBy = { ...(st.hDownBy || {}), [i]: down };
    });
    const sweep = intent && intent.variant === 'sweep' && Number.isInteger(intent.sweepDist) && G.tacticsAliveSlots(st.units).includes(intent.sweepDist);
    const choosable = intent && TARGETED.includes(intent.type) && !intent.targetsAll && !sweep;
    if (!choosable || !cfg) {
      const out = G.withTacticsTarget(intent, st.units, st.rng);
      if (out && Number.isInteger(out.targetSlot) && choosable) { rec.aimed[st.mons[out.targetSlot].id] = (rec.aimed[st.mons[out.targetSlot].id] || 0) + 1; rec.aimTotal += 1; }
      return out;
    }
    const ws = G.tacticsTargetWeights(st.units).map((w) => ({ index: w.index, weight: w.weight * (1 + (st.hate[w.index] || 0) / cfg.k) }));
    const total = ws.reduce((a, w) => a + w.weight, 0);
    let roll = Math.min(0.999999999, Math.max(0, Number(st.rng()) || 0)) * total, slot = ws[ws.length - 1].index;
    for (const w of ws) { roll -= w.weight; if (roll < 0) { slot = w.index; break; } }
    rec.aimed[st.mons[slot].id] = (rec.aimed[st.mons[slot].id] || 0) + 1; rec.aimTotal += 1;
    return { ...intent, targetSlot: slot, targetName: G.tacticsTargetName(st.units, slot) };
  };
  return { actHook, aimHook };
};

const runSet = (party, cfg, runs, diff) => {
  const rec = { aimed: {}, aimTotal: 0, downs: {}, acts: {}, flames: {}, hateSum: {} };
  let clear = 0, waves = 0;
  for (let s = 1; s <= runs; s += 1) {
    const r = simulateRun({ heroId: party.hero, allies: party.allies, difficulty: diff, seed: s, ...makeHooks(cfg, rec) });
    if (r.result === 'clear') clear += 1;
    waves += r.result === 'clear' ? 11 : r.wave;
  }
  return { clear: clear / runs, wave: waves / runs, runs, ...rec };
};

// ---- 試す形 ----
const clone = (o) => JSON.parse(JSON.stringify(o));
const withMonol = (m) => { const c = clone(TACTICS_HATE); Object.assign(c.monsters.Monol, m.monol); if (m.cover != null) c.exByEffect.coverAll = m.cover; return c; };
const edited = (f) => { const c = clone(TACTICS_HATE); f(c); return c; };
const VARIANTS = {
  now: { name: '今の式(ヘイトなし)', cfg: null },
  base: { name: '基準の表(モノリス = 盾の既定・かばう+60)', cfg: TACTICS_HATE },
  hero20: { name: '基準の表 + 勇者の下地20', cfg: edited((c) => { c.hero.floor = 20; }) },
  guard25: { name: '基準の表 + ガード+25(前回の調整案)', cfg: edited((c) => { c.action.guard = 25; }) },
  heroGuard: { name: '基準の表 + 勇者の下地20 + ガード+25', cfg: edited((c) => { c.hero.floor = 20; c.action.guard = 25; }) },
  trait: { name: 'モノリスの特性だけ(×1.5・行動のたび+3・かばうは+0)', cfg: withMonol({ monol: { mult: 1.5, always: 3 }, cover: 0 }) },
  both: { name: 'かばう+特性の両方(×1.5・行動のたび+3・かばう+60)', cfg: withMonol({ monol: { mult: 1.5, always: 3 } }) },
  strong: { name: '両方を強く(×2・行動のたび+6・かばう+60)', cfg: withMonol({ monol: { mult: 2, always: 6 } }) },
  rec: { name: '★おすすめ(勇者の下地20・与ダメージ×15・ガード+25・モノリス×1.5と+3)', cfg: edited((c) => { c.hero.floor = 20; c.action.dmgShare = 15; c.action.guard = 25; Object.assign(c.monsters.Monol, { mult: 1.5, always: 3 }); }) },
};
const PARTIES = [
  { key: 'top', name: '1位(モッチー + ゴースト・スプーキー・ハム)', hero: 'Mocchi', allies: ['Ghost', 'Spooky', 'Ham'] },
  { key: 'tank', name: '盾役入り(モッチー + モノリス・ゴースト・ハム)', hero: 'Mocchi', allies: ['Monol', 'Ghost', 'Ham'] },
  { key: 'ygg', name: '盾2(モッチー + ユグドラシル・ゴースト・ハム)', hero: 'Mocchi', allies: ['Yggdrasil', 'Ghost', 'Ham'] },
  { key: 'wall', name: '盾+回復(モッチー + モノリス・ユグドラシル・ウンディーネ)', hero: 'Mocchi', allies: ['Monol', 'Yggdrasil', 'Undine'] },
];
// 調整の手引き(Expert・盾役入りだけ。1つずつ動かす)
const KNOBS = [
  { name: 'k 25 → 20(ヘイトが効きやすい)', edit: (c) => { c.k = 20; } },
  { name: 'k 25 → 30(ヘイトが効きにくい)', edit: (c) => { c.k = 30; } },
  { name: 'かばう 60 → 80', edit: (c) => { c.exByEffect.coverAll = 80; } },
  { name: '盾の倍率 1.3 → 1.5', edit: (c) => { c.roles.tank.mult = 1.5; } },
  { name: '与ダメージの割合 30 → 40', edit: (c) => { c.action.dmgShare = 40; } },
  { name: '与ダメージの割合 30 → 15', edit: (c) => { c.action.dmgShare = 15; } },
  { name: 'ガード 6 → 25', edit: (c) => { c.action.guard = 25; } },
  { name: '回復 30 → 40', edit: (c) => { c.action.heal = 40; } },
];

const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const RUNS = Number(arg('--runs', 200));
const MD = arg('--md', null);
const DIFFS = String(arg('--diff', 'Expert,Master')).split(',');
const ONLY = arg('--only', null);
const NAME = Object.fromEntries(MONS.map((m) => [m.id, m.name]));
const pct = (x) => `${Math.round(x * 100)}%`;
const pct1 = (x) => `${(x * 100).toFixed(1)}%`;
const lines = [];
const out = (l = '') => { lines.push(l); console.log(l); };
const share = (r, ids) => ids.map((id) => `${NAME[id]} ${pct(r.aimTotal ? (r.aimed[id] || 0) / r.aimTotal : 0)}`).join('・');
const downs = (r, ids) => ids.map((id) => `${NAME[id]} ${((r.downs[id] || 0) / r.runs).toFixed(2)}`).join('・');
const ACT_NAME = { atk: '通常攻撃', unique: '固有技', heal: '回復', buff: '強化', debuff: '弱体', guard: 'ガード', taunt: '挑発', cover: 'かばう', ex: 'EX' };

// ---- 1. 基準の数値表(式だけで決まるもの) ----
const C = TACTICS_HATE;
out(`# タクティクス: ヘイトの基準表と試算(各 ${RUNS} 回)`);
out('');
out('作り直す: `node tools/playbot/sim/hate-table.js --runs ' + RUNS + ' --md <file>`(数字は道具の先頭の TACTICS_HATE の1か所だけ。ゲーム本体は変えていない)');
out('');
out('## A. 行動ごとの基準値(全員に共通)');
out('');
out('| 行動 | ヘイト | メモ |');
out('| --- | --- | --- |');
out(`| 通常攻撃(通常技・距離の技)1枚 | +${C.action.atk} | 当てたダメージのぶんは下の「与ダメージ」で別に足す |`);
out(`| 固有技 1枚 | +${C.action.unique} | 同上 |`);
out(`| 与ダメージ | そのターンの味方の与ダメージのうちの割合 × ${C.action.dmgShare} | 1人で全部与えたら +${C.action.dmgShare}、4人で等分なら +${C.action.dmgShare / 4} |`);
out(`| 回復 | 回復の量 × ${C.action.heal} | 量 = ライフの回復率 + ガッツの回復率 × 0.5(全員に50%なら +${C.action.heal * 0.5}) |`);
out(`| 強化のカード | +${C.action.buff} | ニコラオ・ドラ・かどみうむ・みゃる・きき・ポルツ |`);
out(`| 弱体のカード | +${C.action.debuff} | |`);
out(`| ガードのカード 1枚 | +${C.action.guard} | 盾の役割は +${C.roles.tank.add.guard} を上乗せ |`);
out(`| 挑発(あつの挑発) | +${C.action.taunt} | 攻撃のダメージぶんも足される |`);
out(`| かばう(モノリスの EX) | +${C.exByEffect.coverAll} | |`);
out(`| 味方を守る・癒やす EX | +${C.exByEffect.partyGuard}(世界樹の守り・生命の泉)/ +${C.exByEffect.cookieBox}(メロディボックス・緑のめぐみ)/ +${C.exByEffect.present}(プレゼント) | |`);
out(`| そのほかの EX | +${C.action.ex} | |`);
out(`| 毎ターン | ×${C.decay}(3割へる) | 何もしなければ 3ターンで約3分の1 |`);
out(`| 上限・戻るとき | ${C.cap}。倒れたら0、WAVE が変わったら0 | |`);
out(`| 炎の段 | ${C.flames.map((x, i) => `${'🔥'.repeat(i + 1)} ${x}以上`).join('・')} | |`);
out('');
out(`増え方: ヘイト = 前のヘイト × ${C.decay} + 役割の倍率 ×(そのターンに増えたぶん)。狙いの重み = 今の重み ×(1 + ヘイト ÷ ${C.k})`);
out('');
out('## B. 役割ごとの既定値');
out('');
out('| 役割 | 増え方の倍率 | 行動ごとの上乗せ | 入っている子 |');
out('| --- | --- | --- | --- |');
for (const [key, r] of Object.entries(C.roles)) {
  const who = Object.entries(C.monsters).filter(([, m]) => m.role === key).map(([id]) => NAME[id] || id).join('・');
  const add = Object.entries(r.add).map(([k, v]) => `${ACT_NAME[k] || k} +${v}`).join('・') || '—';
  out(`| ${r.label} | ×${r.mult} | ${add} | ${who} |`);
}
out('');
out('## C. 狙われる確率の目安(4人・ほかの3人はライフ満タンでヘイト0)');
out('');
const probOf = (hp, h, k, othersHate = 0) => {
  const w = (1 + 2 * (1 - hp)) * (1 + h / k);
  const o = 1 + othersHate / k;
  return w / (w + 3 * o);
};
out(`| その子のヘイト | 炎 | 満タンの子 | 半分の子 | 4分の1の子 |`);
out('| --- | --- | --- | --- | --- |');
for (const h of [0, 20, 50, 80, 100]) out(`| ${h} | ${['—', '🔥', '🔥🔥', '🔥🔥🔥'][flameOf(C, h)]} | ${pct(probOf(1, h, C.k))} | ${pct(probOf(0.5, h, C.k))} | ${pct(probOf(0.25, h, C.k))} |`);
out('');
out('ヘイト0のときが今の式と同じ(満タン25%・半分40%・4分の1 45%)。');
out('');
out('## D. 名前の出た子の具体値(1回あたり。役割の倍率を掛けたあと)');
out('');
out('| 行動 | 使う子 | 基準 | 倍率 | 1回で増えるヘイト | 炎 |');
out('| --- | --- | --- | --- | --- | --- |');
const named = (label, who, base) => {
  const h = hateOf(C, who);
  const v = Math.min(C.cap, base * h.mult);
  out(`| ${label} | ${NAME[who]}(${C.roles[h.role].label}) | ${Math.round(base * 10) / 10} | ×${h.mult} | ${Math.round(v)} | ${['—', '🔥', '🔥🔥', '🔥🔥🔥'][flameOf(C, v)]} |`);
};
named('あつの挑発(攻撃ぶんは別)', 'Mocchi', C.action.taunt);
named('あつの挑発(攻撃ぶんは別)', 'Monol', C.action.taunt);
for (const [lv, l] of [[0, '一段目'], [1, '二段目'], [2, '三段目']]) named(`みゅあの愛(${l})`, 'Mocchi', C.action.heal * HEAL_AMOUNT.mua[lv]);
for (const [lv, l] of [[0, '一段目'], [1, '二段目'], [2, '三段目']]) named(`ももすけのおねだり(${l})`, 'Mocchi', C.action.heal * HEAL_AMOUNT.momosuke[lv]);
named('みゅあの愛(三段目)', 'Undine', C.action.heal * HEAL_AMOUNT.mua[2]);
named('モノリスのかばう', 'Monol', C.exByEffect.coverAll);
named('ガード1枚', 'Monol', C.action.guard + C.roles.tank.add.guard);
named('ガード1枚', 'Mocchi', C.action.guard);
named('世界樹の守り', 'Yggdrasil', C.exByEffect.partyGuard);
out('');
out('みゅあ・ももすけ・あつは助手のカードなので、ヘイトは**そのカードを使った子**に付く(だれに使わせるかで受け役を作れる)。');

// ---- 2. 回した表 ----
const ids = (p) => [p.hero, ...p.allies];
const variantKeys = ONLY ? ONLY.split(',') : Object.keys(VARIANTS);
for (const diff of DIFFS) {
  out('');
  out(`## E. 代表のパーティを回した表(${diff}・同じ種で ${RUNS} 回)`);
  out('');
  out('狙われた割合 = 敵が1人を選んで撃った攻撃のうち、その子に来た割合。倒れた回数は1回あたり。');
  for (const p of PARTIES) {
    if (diff !== DIFFS[0] && p.key === 'ygg') continue;
    out('');
    out(`### ${p.name}`);
    out('');
    out('| 形 | クリア率 | 平均 WAVE | 狙われた割合 | 倒れた回数 |');
    out('| --- | --- | --- | --- | --- |');
    for (const vk of variantKeys) {
      if (p.key !== 'tank' && p.key !== 'wall' && ['trait', 'both', 'strong'].includes(vk)) continue;
      const v = VARIANTS[vk];
      const r = runSet(p, v.cfg, RUNS, diff);
      out(`| ${v.name} | ${pct(r.clear)} | ${r.wave.toFixed(2)} | ${share(r, ids(p))} | ${downs(r, ids(p))} |`);
      if (vk === 'base' && diff === DIFFS[0]) {
        p.flameRow = ids(p).map((id) => {
          const f = r.flames[id] || [0, 0, 0, 0]; const t = f.reduce((a, b) => a + b, 0) || 1;
          const acts = Object.entries(r.acts[id] || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, n]) => `${ACT_NAME[k] || k} ${(n / RUNS).toFixed(1)}`).join('・');
          return `| ${NAME[id]} | ${((r.hateSum[id] || 0) / t).toFixed(0)} | ${f.map((x) => pct(x / t)).join(' / ')} | ${acts} |`;
        });
      }
    }
  }
}
out('');
out(`## F. 基準の表で、だれがどれくらい燃えるか(${DIFFS[0]}・各ターンの終わり)`);
for (const p of PARTIES) {
  if (!p.flameRow) continue;
  out('');
  out(`### ${p.name}`);
  out('');
  out('| 子 | 平均ヘイト | 炎の段の割合(— / 🔥 / 🔥🔥 / 🔥🔥🔥) | 1回あたりの行動(多い順) |');
  out('| --- | --- | --- | --- |');
  p.flameRow.forEach((l) => out(l));
}

// ---- 3. 調整の手引き ----
out('');
out('## G. 調整の手引き');
out('');
out(`### 式だけで決まるもの(満タンの子・ほかの3人はヘイト0・k=${C.k})`);
out('');
out('| ヘイト | 狙われる確率 | ヘイトを+10すると |');
out('| --- | --- | --- |');
for (const h of [0, 20, 50, 80]) out(`| ${h} | ${pct1(probOf(1, h, C.k))} | ${pct1(probOf(1, Math.min(C.cap, h + 10), C.k))}(+${((probOf(1, Math.min(C.cap, h + 10), C.k) - probOf(1, h, C.k)) * 100).toFixed(1)}点) |`);
out('');
out('### 1つずつ動かしたとき(Expert・盾役入り。モノリスの狙われた割合とクリア率)');
out('');
out('| 動かしたもの | モノリスが狙われた割合 | モッチー | クリア率 |');
out('| --- | --- | --- | --- |');
const tankP = PARTIES.find((p) => p.key === 'tank');
const rBase = runSet(tankP, TACTICS_HATE, RUNS, 'Expert');
const sh = (r, id) => (r.aimTotal ? (r.aimed[id] || 0) / r.aimTotal : 0);
out(`| 基準の表のまま | ${pct1(sh(rBase, 'Monol'))} | ${pct1(sh(rBase, 'Mocchi'))} | ${pct(rBase.clear)} |`);
for (const kn of KNOBS) {
  const c = clone(TACTICS_HATE); kn.edit(c);
  const r = runSet(tankP, c, RUNS, 'Expert');
  out(`| ${kn.name} | ${pct1(sh(r, 'Monol'))}(${((sh(r, 'Monol') - sh(rBase, 'Monol')) * 100).toFixed(1)}点) | ${pct1(sh(r, 'Mocchi'))} | ${pct(r.clear)} |`);
}
if (MD) { fs.mkdirSync(path.dirname(MD), { recursive: true }); fs.writeFileSync(MD, lines.join('\n') + '\n'); }

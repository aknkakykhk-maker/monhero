// 助手のマスモンの完全オートバトルの「計算」(第③段階の芯・2026-11-11 タタカイ)。
// 設計: docs/spec/ASSISTANT_MASMON_BATTLE.md / 仕様書: docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md §9
//
// ★画面に頼らない純粋な計算。React・window・localStorage・Date・Math.random を使わない。
//   同じ(編成・種)なら、端末でもサーバ(Supabase Edge Function / Deno)でも同じ結果になる。
//   使ってよい計算は + − × ÷・Math.floor/round/min/max/abs/sqrt だけ(Math.exp/log/pow/sin は
//   エンジンで値がずれうるので使わない)。
// ★技は既存の技データだけを使う(未実装の技を足さない):
//   通常攻撃 = BASE_ATK_EVOLUTION + HERO_ATK_NAMES / 距離撃 = RANGE_EVOLUTION /
//   固有技 = ALL_PLAYER_MONSTERS[種].unique / ガード = GUARD_EVOLUTION / 距離の得意 = distAptitude
// ★好き嫌い・疲労・ストレスは入力に取らない(強さに効かせない)。プレイヤーのセーブ・ランキングに触れない。
//
// 使い方:
//   const catalog = ASSISTANT_MASMON_BATTLE.buildCatalog({ ALL_PLAYER_MONSTERS, HERO_ATK_NAMES,
//     BASE_ATK_EVOLUTION, RANGE_EVOLUTION, GUARD_EVOLUTION });   // 技データの写し(JSON にできる)
//   const r = ASSISTANT_MASMON_BATTLE.simulate({ seed:'abc', catalog,
//     teamA:{ assistantId:'mua', tactics:20, members:[{ species:'Mocchi', name:'もち', lv:12,
//       stats:{ life:400, pow:420, wise:150, hit:260, eva:180, tough:390 } }] },
//     teamB:{ ... } });
//   r.winner('A'|'B'|'draw')・r.reason('wipe'|'judge')・r.log(1手ずつ)・r.digest(結果の指紋)
(function (root) {
  'use strict';

  const VERSION = 1;
  const STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
  const STAT_MAX = 999;
  const DIST_NAMES = ['零', '近', '中', '遠'];
  const DIST_START = 2; // 中から始める
  const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const TEAM_MAX = 3;
  const GUTS_MAX = 100;
  const GUTS_START = 50;
  const GUTS_REGEN = 10;      // 毎ラウンドの自然回復
  const GUTS_CHARGE = 22;     // 「ためる」で足す分
  const GUTS_MOVE = 4;        // 移動・ガードで足す分
  const GUTS_SWAP_IN = 40;    // 交代で出てきたときの最低ガッツ
  const ROUND_LIMIT = 150;    // これを超えたら判定(無限に続かない)
  const SWAP_COOLDOWN = 2;    // 出てきてから自分の手番2回は交代しない(行ったり来たりを防ぐ)
  const CRIT_MULT = 1.5;

  // ── 種(シード)から決まる乱数。文字列でも数でもよい ──
  const hashSeed = (seed) => {
    const s = String(seed == null ? '' : seed);
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  };
  const makeRng = (seed) => {
    let a = hashSeed(seed);
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const toInt = (v, lo, hi, def) => {
    const n = (v == null || v === '' || typeof v === 'boolean') ? NaN : Number(v);
    return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : def;
  };

  // ── 助手の性格(仕様書 §7 の仮の傾向)。重みは 1 が普通 ──
  //   aggr 攻め / caution 守り(ガードと反撃の怖さ) / thrift ガッツの節約 / mobility 間合いを取りに行く
  //   swap 交代の好み / gamble 大技(固有技)と会心の好み / read 読みの良さ(戦術経験に足す)
  const STYLE_BASE = Object.freeze({ aggr: 1, caution: 1, thrift: 1, mobility: 1, swap: 1, gamble: 1, read: 0 });
  const STYLES = Object.freeze({
    mua:       Object.freeze({ label: '積極型', aggr: 1.3, caution: 0.75, thrift: 0.8, mobility: 1.0, swap: 0.7, gamble: 1.25, read: 0 }),
    kiki:      Object.freeze({ label: '分析型', aggr: 1.0, caution: 1.0, thrift: 1.1, mobility: 1.15, swap: 1.1, gamble: 0.85, read: 15 }),
    momosuke:  Object.freeze({ label: '安定型', aggr: 0.9, caution: 1.25, thrift: 1.25, mobility: 0.9, swap: 0.9, gamble: 0.75, read: 5 }),
    dra:       Object.freeze({ label: '大胆型', aggr: 1.4, caution: 0.6, thrift: 0.7, mobility: 1.2, swap: 0.5, gamble: 1.5, read: 0 }),
    atsu:      Object.freeze({ label: 'バランス型', aggr: 1.0, caution: 1.0, thrift: 1.0, mobility: 1.0, swap: 1.0, gamble: 1.0, read: 5 }),
    kyuko:     Object.freeze({ label: '研究型', aggr: 1.0, caution: 1.0, thrift: 1.05, mobility: 1.25, swap: 1.2, gamble: 1.0, read: 10 }),
    sorashido: Object.freeze({ label: '柔軟型', aggr: 1.05, caution: 1.0, thrift: 1.0, mobility: 1.3, swap: 1.4, gamble: 1.0, read: 5 }),
    erubin:    Object.freeze({ label: '防御型', aggr: 0.8, caution: 1.5, thrift: 1.15, mobility: 0.95, swap: 1.0, gamble: 0.8, read: 5 }),
  });
  const styleOf = (assistantId, override) => {
    const base = STYLES[assistantId] || STYLES.atsu;
    const out = {};
    for (const k of Object.keys(STYLE_BASE)) {
      const o = override && Number.isFinite(Number(override[k])) ? Number(override[k]) : null;
      out[k] = o != null ? o : (Number.isFinite(base[k]) ? base[k] : STYLE_BASE[k]);
    }
    return out;
  };

  // ── 技データの写し(画面の変数から一度だけ作る。JSON にしてサーバへ持っていける) ──
  const buildCatalog = (src) => {
    const s = src || {};
    const mons = s.ALL_PLAYER_MONSTERS || {};
    const names = s.HERO_ATK_NAMES || {};
    const pick = (arr) => (Array.isArray(arr) ? arr : []).map(e => ({
      name: e && typeof e.name === 'string' ? e.name : '',
      mult: Number(e && e.mult) || 1,
      crit: Number(e && e.crit) || 0,
      guts: Number(e && (e.baseGuts != null ? e.baseGuts : e.guts)) || 0,
    }));
    const species = {};
    for (const id of Object.keys(mons).sort()) {
      const m = mons[id];
      if (!m || !m.unique) continue;
      const apt = Array.isArray(m.distAptitude) && m.distAptitude.length === 4
        ? m.distAptitude.map(g => (GRADES.includes(g) ? g : 'C')) : ['C', 'C', 'C', 'C'];
      species[id] = {
        name: String(m.name || id),
        apt,
        atkNames: Array.isArray(names[id]) ? names[id].slice(0, 9).map(String) : [],
        unique: {
          names: Array.isArray(m.unique.names) ? m.unique.names.slice(0, 9).map(String) : [String(m.unique.name || '固有技')],
          mult: Number(m.unique.baseMult) || 2,
          guts: Number(m.unique.baseGuts) || 40,
        },
      };
    }
    return { version: VERSION, atk: pick(s.BASE_ATK_EVOLUTION), range: pick(s.RANGE_EVOLUTION), guard: pick(s.GUARD_EVOLUTION), species };
  };

  // Lv(育成の Lv 1〜99。キズナ4の AMG_LV_MAX)から技の段(0〜8)。段は技の名前と会心率だけに効く(強さは6能力が持つ)
  const LV_MAX = 99;
  const stageOf = (lv) => clamp(Math.floor((toInt(lv, 1, LV_MAX, 1) - 1) * 9 / LV_MAX), 0, 8);
  const aptMult = (grade) => {
    const i = GRADES.indexOf(grade);
    return clamp(1 + ((i < 0 ? 4 : i) - 4) * 0.08, 0.6, 1.5);
  };

  // 1体ぶんの技の表。威力は通常攻撃を 1 とした比(同じ段どうしの比)
  const buildMoves = (catalog, speciesId, lv, stats) => {
    const sp = catalog.species[speciesId];
    const st = stageOf(lv);
    const atk = catalog.atk[st] || catalog.atk[0] || { mult: 1, crit: 0.1, guts: 16, name: '' };
    const rng = catalog.range[st] || catalog.range[0] || { mult: 1.4, crit: 0.1, guts: 20, name: '距離撃' };
    const best = Math.max(...sp.apt.map(g => GRADES.indexOf(g)));
    const uniqueDist = [0, 1, 2, 3].filter(d => GRADES.indexOf(sp.apt[d]) === best);
    const uName = sp.unique.names[Math.min(st, sp.unique.names.length - 1)] || sp.unique.names[0];
    // 固有技は、ちからとかしこさの高い方で撃つ(同じならちから)
    const uKind = (stats.wise > stats.pow) ? 'wise' : 'pow';
    return [
      { key: 'atk', name: sp.atkNames[st] || '通常攻撃', kind: 'pow', power: 1, guts: atk.guts || 16, crit: atk.crit, hit: 0.05, dist: [0, 1] },
      { key: 'range', name: rng.name || '距離撃', kind: 'wise', power: (rng.mult || 1.4) / (atk.mult || 1), guts: rng.guts || 20, crit: rng.crit, hit: -0.03, dist: [2, 3] },
      { key: 'unique', name: uName, kind: uKind, power: sp.unique.mult, guts: sp.unique.guts, crit: atk.crit, hit: -0.1, dist: uniqueDist },
    ];
  };

  // 助手のマスモンの並び(mh_assistant_life_masmon_v1 の行: monster・nick・lv)と育成の入れ物
  // (mh_assistant_masmon_grow_v1 の amgEntryOf の戻り: st・lv)から、対戦の1体を作る。入れ物が無ければ行の Lv・能力は既定値
  const unitFromGrow = (row, entry) => {
    const r = row && typeof row === 'object' ? row : {};
    const e = entry && typeof entry === 'object' ? entry : null;
    return { species: r.monster, name: r.nick, lv: e && e.lv != null ? e.lv : r.lv, stats: e ? e.st : null };
  };

  // ── 入力の正規化(壊れた値は既定値で補う) ──
  const normalizeUnit = (u, catalog) => {
    const src = u && typeof u === 'object' ? u : {};
    const ids = Object.keys(catalog.species);
    const species = catalog.species[src.species] ? src.species : ids[0];
    const stats = {};
    // 能力は stats でも st(育成の入れ物 mh_assistant_masmon_grow_v1 の形)でもよい
    const raw = src.stats && typeof src.stats === 'object' ? src.stats : src.st;
    const ss = raw && typeof raw === 'object' ? raw : {};
    for (const k of STAT_KEYS) stats[k] = toInt(ss[k], 0, STAT_MAX, 100);
    const lv = toInt(src.lv, 1, LV_MAX, 1);
    return { species, name: typeof src.name === 'string' && src.name ? src.name.slice(0, 24) : catalog.species[species].name, lv, stats };
  };
  const normalizeTeam = (t, catalog) => {
    const src = t && typeof t === 'object' ? t : {};
    const list = (Array.isArray(src.members) ? src.members : []).slice(0, TEAM_MAX).map(u => normalizeUnit(u, catalog));
    if (!list.length) throw new Error('assistant-masmon-battle: members が空');
    return {
      assistantId: typeof src.assistantId === 'string' ? src.assistantId : 'atsu',
      tactics: toInt(src.tactics, 0, 100, 0),
      style: styleOf(src.assistantId, src.style),
      members: list,
    };
  };

  const maxHpOf = (stats) => 100 + Math.round(stats.life * 1.5);

  // ── 計算の部品(AI もこれで見積もる。実際の判定と同じ式) ──
  const hitChance = (atkU, defU, mv) => clamp(0.75 + (atkU.stats.hit - defU.stats.eva) / STAT_MAX * 0.5 + mv.hit, 0.15, 0.97);
  const rawDamage = (atkU, defU, mv, dist) => {
    const a = atkU.stats[mv.kind];
    const base = mv.power * (20 + a * 0.6) * aptMult(atkU.apt[dist]);
    return base * 300 / (300 + defU.stats.tough * 0.9);
  };
  const guardCut = (u) => clamp(0.35 + u.stats.tough / STAT_MAX * 0.25, 0.35, 0.6);
  const canUse = (u, mv, dist) => mv.dist.includes(dist) && u.guts >= mv.guts;
  const inRange = (mv, dist) => mv.dist.includes(dist);
  const expected = (atkU, defU, mv, dist, guarded) => {
    const p = hitChance(atkU, defU, mv);
    const crit = mv.crit;
    return p * rawDamage(atkU, defU, mv, dist) * (1 + crit * (CRIT_MULT - 1)) * (guarded ? 1 - guardCut(defU) : 1);
  };
  // 届く距離で一番よい技の期待ダメージ(ガッツが足りるかは gutsAvail で見る)
  const bestThreat = (atkU, defU, dist, gutsAvail) => {
    let best = 0;
    for (const mv of atkU.moves) {
      if (!inRange(mv, dist) || gutsAvail < mv.guts) continue;
      const e = expected(atkU, defU, mv, dist, false);
      if (e > best) best = e;
    }
    return best;
  };
  // 相性: この組み合わせで、どちらが何手で倒せそうか(大きいほど自分が有利)
  const matchup = (me, foe, dist) => {
    let myBest = 0, foeBest = 0;
    for (let d = 0; d < 4; d++) {
      const w = d === dist ? 1.2 : 1;
      myBest = Math.max(myBest, bestThreat(me, foe, d, GUTS_MAX) * w);
      foeBest = Math.max(foeBest, bestThreat(foe, me, d, GUTS_MAX) * w);
    }
    const myTurns = foe.hp / Math.max(1, myBest * 0.55);   // 0.55 = ガッツの都合で毎手は撃てない分
    const foeTurns = me.hp / Math.max(1, foeBest * 0.55);
    return foeTurns - myTurns;
  };

  // ── 助手の AI: 手の候補に点を付けて一番高いものを選ぶ ──
  //   期待ダメージ・命中率・ガッツ消費・残りライフ・反撃の怖さ・距離・交代の得 を比べ、性格の重みを掛ける。
  //   戦術経験(0〜100)が低いほど見積もりがぶれる(ゆらぎ)。ただし「明らかに損な手」は最初から候補に入れない。
  const chooseAction = (ctx, side) => {
    const st = ctx.state;
    const me = st.teams[side];
    const foeSide = side === 'A' ? 'B' : 'A';
    const foeT = st.teams[foeSide];
    const u = me.units[me.active];
    const f = foeT.units[foeT.active];
    const dist = st.dist;
    const sty = me.style;
    const skill = clamp((me.tactics + sty.read) / 100, 0, 1);
    const cands = [];
    const foeNextGuts = Math.min(GUTS_MAX, f.guts + GUTS_REGEN);
    const threatNow = bestThreat(f, u, dist, foeNextGuts);
    const hpFrac = u.hp / u.maxHp;
    const danger = threatNow / Math.max(1, u.hp);          // 次の一撃で失う割合

    // 技
    let bestTech = 0;
    for (const mv of u.moves) {
      if (!canUse(u, mv, dist)) continue;
      const e = expected(u, f, mv, dist, f.guarding);
      const p = hitChance(u, f, mv);
      let score = Math.min(e, f.hp) / f.maxHp * 100 * sty.aggr;
      if (e >= f.hp) score += 35 * p * sty.aggr;                    // 倒しきれそう
      // ガッツの節約: 使ったあと次の手で撃てなくなる分(危ないときは気にしない)
      score -= Math.max(0, mv.guts - GUTS_REGEN) * 0.12 * sty.thrift * (1 - Math.min(1, danger));
      if (mv.key === 'unique') score *= 1 + (sty.gamble - 1) * 0.8;
      if (score > bestTech) bestTech = score;
      cands.push({ type: 'tech', key: mv.key, score });
    }
    // 移動(1歩)。手番を1つ使う=いま撃てる技を捨てる。相手も動けるので、得は半分しか当てにしない
    const reachHere = u.moves.some(mv => inRange(mv, dist));
    for (const step of [-1, 1]) {
      const nd = dist + step;
      if (nd < 0 || nd > 3) continue;
      const myGuts = Math.min(GUTS_MAX, u.guts + GUTS_REGEN + GUTS_MOVE);
      const gain = bestThreat(u, f, nd, myGuts) - bestThreat(u, f, dist, myGuts);
      const risk = bestThreat(f, u, nd, foeNextGuts) - threatNow;
      // 読みが浅いうちは、相手の反撃(risk)を半分しか見ない
      let score = (gain / f.maxHp * 100 * sty.aggr - risk / u.maxHp * 100 * sty.caution * (0.5 + 0.5 * skill)) * 0.9 * sty.mobility;
      score -= bestTech * 0.7 + 2 + u.moveStreak * 5;   // 続けて動くほど損(行ったり来たりを防ぐ)
      // どの技も届かない距離にいるなら、届く方へ
      if (!reachHere && u.moves.some(mv => inRange(mv, nd))) score += 20;
      cands.push({ type: 'move', step, score });
    }
    // ガード(相手が撃ってこなければ無駄になるので、見込みは 6 割)
    if (threatNow > 0) {
      const saved = threatNow * guardCut(u) * 0.6;
      let score = saved / u.maxHp * 100 * (0.4 + 0.6 * sty.caution) * (0.8 + (1 - hpFrac) * 0.6) * (0.5 + 0.5 * skill);
      score -= bestTech * (0.45 - 0.15 * (sty.caution - 1));
      cands.push({ type: 'guard', score });
    }
    // ためる(ガッツが満タンなら候補に入れない)
    if (u.guts < GUTS_MAX) {
      const afterGuts = Math.min(GUTS_MAX, u.guts + GUTS_REGEN + GUTS_CHARGE);
      const nowBest = bestThreat(u, f, dist, u.guts);
      const laterBest = bestThreat(u, f, dist, afterGuts);
      let score = (laterBest - nowBest) / f.maxHp * 100 * 0.6 * (0.8 + 0.2 * sty.thrift);
      score -= danger * 20 * (0.8 + 0.2 * sty.caution);              // 危ないときにためるのは損
      if (nowBest === 0 && laterBest > 0) score += 8;
      cands.push({ type: 'charge', score });
    }
    // 交代
    if (u.swapCooldown <= 0) {
      const cur = matchup(u, f, dist);
      for (let i = 0; i < me.units.length; i++) {
        const b = me.units[i];
        if (i === me.active || b.hp <= 0) continue;
        const gain = matchup(b, f, dist) - cur;
        let score = gain * 6 * sty.swap * (0.4 + 0.6 * skill);
        if (danger >= 1 && hpFrac < 0.5) score += 10 * sty.swap * skill;  // このままだと倒される → 逃がす
        score -= 6;                                                       // 手番を使う分
        cands.push({ type: 'swap', to: i, score });
      }
    }
    if (!cands.length) cands.push({ type: 'charge', score: 0 });       // ガッツ満タンで何もできない時の保険(実際は起きない)

    // 最低限の判断(戦術経験に関係なく): 当たれば確実に倒せる技があれば、一番当たりやすいものを撃つ
    let sure = null;
    for (const mv of u.moves) {
      if (!canUse(u, mv, dist)) continue;
      const minDmg = rawDamage(u, f, mv, dist) * 0.9 * (f.guarding ? 1 - guardCut(f) : 1);
      if (minDmg < f.hp) continue;
      const p = hitChance(u, f, mv);
      if (!sure || p > sure.p || (p === sure.p && mv.guts < sure.guts)) sure = { key: mv.key, p, guts: mv.guts };
    }
    if (sure) {
      const pick = cands.find(c => c.type === 'tech' && c.key === sure.key);
      pick.eval = pick.score;
      if (ctx.trace) ctx.lastCands = cands.map(c => Object.assign({}, c, { score: Math.round(c.score * 10) / 10 }));
      return pick;
    }
    // 戦術経験が低いほど、見積もりがぶれる(最大 ±noise)
    const noise = 2 + (1 - skill) * 14;
    let best = null;
    for (const c of cands) {
      c.eval = c.score + (ctx.rng() * 2 - 1) * noise;
      if (!best || c.eval > best.eval) best = c;
    }
    if (ctx.trace) ctx.lastCands = cands.map(c => Object.assign({}, c, { score: Math.round(c.score * 10) / 10, eval: Math.round(c.eval * 10) / 10 }));
    return best;
  };

  // 倒れたときに次に出す1体(相性の一番よいもの)
  const chooseReplacement = (ctx, side) => {
    const st = ctx.state;
    const me = st.teams[side];
    const foeT = st.teams[side === 'A' ? 'B' : 'A'];
    const f = foeT.units[foeT.active];
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < me.units.length; i++) {
      const b = me.units[i];
      if (b.hp <= 0) continue;
      const skill = clamp((me.tactics + me.style.read) / 100, 0, 1);
      const s = (f && f.hp > 0 ? matchup(b, f, st.dist) : 0) + (ctx.rng() * 2 - 1) * (1 + (1 - skill) * 4) - i * 0.01;
      if (s > bestScore) { bestScore = s; best = i; }
    }
    return best;
  };

  // 対戦の初めの状態(検査からも使う)
  const setupState = (inp, catalog) => {
    const mkTeam = (t) => {
      const nt = normalizeTeam(t, catalog);
      return {
        assistantId: nt.assistantId, tactics: nt.tactics, style: nt.style, active: 0,
        units: nt.members.map(m => {
          const maxHp = maxHpOf(m.stats);
          return { species: m.species, name: m.name, lv: m.lv, stats: m.stats, apt: catalog.species[m.species].apt,
            moves: buildMoves(catalog, m.species, m.lv, m.stats), maxHp, hp: maxHp, guts: GUTS_START,
            guarding: false, swapCooldown: SWAP_COOLDOWN, moveStreak: 0 };
        }),
      };
    };
    return { teams: { A: mkTeam(inp.teamA), B: mkTeam(inp.teamB) }, dist: DIST_START, round: 0 };
  };

  // ── 本体 ──
  const simulate = (input) => {
    const inp = input && typeof input === 'object' ? input : {};
    const catalog = inp.catalog;
    if (!catalog || !catalog.species || !Object.keys(catalog.species).length) throw new Error('assistant-masmon-battle: catalog が無い');
    const rng = makeRng(inp.seed);
    const roundLimit = toInt(inp.roundLimit, 1, 1000, ROUND_LIMIT);
    const state = setupState(inp, catalog);
    const ctx = { state, rng, trace: !!inp.trace, lastCands: null };
    const log = [];
    const alive = (side) => state.teams[side].units.some(x => x.hp > 0);
    const unitOf = (side) => state.teams[side].units[state.teams[side].active];
    const push = (e) => {
      const row = Object.assign({ r: state.round, d: state.dist }, e);
      if (ctx.trace && ctx.lastCands && ['tech', 'move', 'guard', 'charge', 'swap'].includes(e.ev)) { row.cands = ctx.lastCands; ctx.lastCands = null; }
      log.push(row);
    };

    push({ ev: 'start', a: state.teams.A.units.map(x => x.name), b: state.teams.B.units.map(x => x.name),
      aHp: state.teams.A.units.map(x => x.maxHp), bHp: state.teams.B.units.map(x => x.maxHp) });
    push({ ev: 'enter', side: 'A', i: 0, name: unitOf('A').name });
    push({ ev: 'enter', side: 'B', i: 0, name: unitOf('B').name });

    let winner = null, reason = null;
    const act = (side) => {
      const foeSide = side === 'A' ? 'B' : 'A';
      const me = state.teams[side];
      const u = unitOf(side);
      const f = unitOf(foeSide);
      u.guarding = false;
      const c = chooseAction(ctx, side);
      if (c.type === 'tech') {
        const mv = u.moves.find(m => m.key === c.key);
        u.guts -= mv.guts;
        const p = hitChance(u, f, mv);
        const hit = rng() < p;
        let dmg = 0, crit = false;
        if (hit) {
          crit = rng() < mv.crit;
          const swing = 0.9 + rng() * 0.2;
          dmg = rawDamage(u, f, mv, state.dist) * swing * (crit ? CRIT_MULT : 1) * (f.guarding ? 1 - guardCut(f) : 1);
          dmg = Math.max(1, Math.round(dmg));
          f.hp = Math.max(0, f.hp - dmg);
        }
        push({ ev: 'tech', side, i: me.active, move: mv.key, name: mv.name, kind: mv.kind, hit, crit, dmg,
          guarded: !!(hit && f.guarding), guts: u.guts, foeHp: f.hp });
      } else if (c.type === 'move') {
        state.dist = clamp(state.dist + c.step, 0, 3);
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        push({ ev: 'move', side, i: me.active, step: c.step, to: state.dist, guts: u.guts });
      } else if (c.type === 'guard') {
        u.guarding = true;
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        const g = catalog.guard[stageOf(u.lv)] || catalog.guard[0];
        push({ ev: 'guard', side, i: me.active, name: (g && g.name) || 'ガード', guts: u.guts });
      } else if (c.type === 'charge') {
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_CHARGE);
        push({ ev: 'charge', side, i: me.active, guts: u.guts });
      } else if (c.type === 'swap') {
        const from = me.active;
        u.guarding = false;
        me.active = c.to;
        const n = unitOf(side);
        n.guts = Math.max(n.guts, GUTS_SWAP_IN);
        n.swapCooldown = SWAP_COOLDOWN;
        push({ ev: 'swap', side, from, i: c.to, name: n.name, guts: n.guts });
      }
      u.swapCooldown = Math.max(0, u.swapCooldown - 1);
      u.moveStreak = c.type === 'move' ? u.moveStreak + 1 : 0;
      // 倒れた → 次を出す / 全滅なら決着
      if (f.hp <= 0) {
        push({ ev: 'ko', side: foeSide, i: state.teams[foeSide].active, name: f.name });
        if (!alive(foeSide)) { winner = side; reason = 'wipe'; return; }
        const next = chooseReplacement(ctx, foeSide);
        state.teams[foeSide].active = next;
        const n = unitOf(foeSide);
        n.guts = Math.max(n.guts, GUTS_SWAP_IN);
        n.guarding = false;
        n.swapCooldown = SWAP_COOLDOWN;
        push({ ev: 'enter', side: foeSide, i: next, name: n.name, guts: n.guts });
      }
    };

    while (!winner && state.round < roundLimit) {
      state.round++;
      for (const side of ['A', 'B']) {
        const u = unitOf(side);
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_REGEN);
      }
      // 先に動く方: 回避+命中の半分が高い方(同じなら種で)
      const ua = unitOf('A'), ub = unitOf('B');
      const sa = ua.stats.eva + ua.stats.hit * 0.5 + rng() * 60;
      const sb = ub.stats.eva + ub.stats.hit * 0.5 + rng() * 60;
      const order = sa >= sb ? ['A', 'B'] : ['B', 'A'];
      for (const side of order) {
        if (winner) break;
        act(side);
      }
    }
    if (!winner) {
      // 判定: 残りライフの割合の合計(倒れた体は0)。同じなら引き分け
      const score = (side) => {
        const t = state.teams[side];
        return Math.round(t.units.reduce((s, x) => s + x.hp / x.maxHp, 0) / t.units.length * 10000);
      };
      const a = score('A'), b = score('B');
      winner = a > b ? 'A' : b > a ? 'B' : 'draw';
      reason = 'judge';
      push({ ev: 'judge', aScore: a, bScore: b });
    }
    push({ ev: 'end', winner, reason });
    const final = {};
    for (const side of ['A', 'B']) final[side] = state.teams[side].units.map(x => ({ name: x.name, hp: x.hp, maxHp: x.maxHp, guts: x.guts }));
    return { version: VERSION, winner, reason, rounds: state.round, log, final, digest: digestOf(log) };
  };

  // 結果の指紋(同じ種・同じ編成なら同じ値。端末とサーバの突き合わせ用)
  const digestOf = (log) => hashSeed(JSON.stringify(log)).toString(16).padStart(8, '0');

  const api = Object.freeze({
    VERSION, STAT_KEYS, STAT_MAX, DIST_NAMES, TEAM_MAX, GUTS_MAX, ROUND_LIMIT, STYLES,
    LV_MAX, buildCatalog, simulate, unitFromGrow, makeRng, hashSeed,
    // 検査用(計算の部品)
    _internal: Object.freeze({ setupState, stageOf, aptMult, buildMoves, normalizeUnit, normalizeTeam, styleOf, hitChance, rawDamage, chooseAction, maxHpOf }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ASSISTANT_MASMON_BATTLE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

// 自動で作った写し(tools/masmon-battle/build-masmon-pvp-bundle.js)。手で直さない。直すのは monster-hero/data/assistant-masmon-battle.js と技データ
// deno-lint-ignore-file
const __mod = { exports: {} };
(function (module) {
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
  const DIST_START = 2; // 種が無いときの始まりの距離(中)。ふつうは種で 近・中 のどちらか(得意な距離の有利を片寄らせない)
  const GRADES = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M'];
  const TEAM_MAX = 3;
  const GUTS_MAX = 100;
  const GUTS_START = 50;
  const GUTS_REGEN = 10;      // 毎ラウンドの自然回復の真ん中(種ごとに 9〜11。MF の「ガッツ回復」の考え方)
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
    // 種ごとのガッツのたまる速さ: モンヒロバトルの基礎ガッツ(baseGuts)の大きさで 9〜11(真ん中 10)
    const gs = Object.keys(species).map(id => Number(mons[id].baseGuts) || 0);
    const gMin = Math.min(...gs), gMax = Math.max(...gs);
    for (const id of Object.keys(species)) {
      const g = Number(mons[id].baseGuts) || 0;
      species[id].regen = gMax > gMin ? GUTS_REGEN - 1 + Math.round((g - gMin) / (gMax - gMin) * 2) : GUTS_REGEN;
    }
    return { version: VERSION, atk: pick(s.BASE_ATK_EVOLUTION), range: pick(s.RANGE_EVOLUTION), guard: pick(s.GUARD_EVOLUTION), species };
  };

  // Lv(育成の Lv 1〜99。キズナ4の AMG_LV_MAX)から技の段(0〜8)。段は技の名前と会心率だけに効く(強さは6能力が持つ)
  const LV_MAX = 99;
  const stageOf = (lv) => clamp(Math.floor((toInt(lv, 1, LV_MAX, 1) - 1) * 9 / LV_MAX), 0, 8);
  const aptMult = (grade) => {
    const i = GRADES.indexOf(grade);
    return clamp(1 + ((i < 0 ? 4 : i) - 4) * 0.05, 0.8, 1.25);
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
  // モンスターファームの考え方を参考に(docs/spec/ASSISTANT_MASMON_BATTLE.md「MF との対応」):
  //   撃つときのガッツが多いほど当たりやすく(±5%)・重い(×0.9〜1.1)。g は撃つ前のガッツ(省くといまのガッツ)
  const gutsHit = (g) => (clamp(g, 0, GUTS_MAX) - 50) / 50 * 0.05;
  const gutsPow = (g) => 0.9 + clamp(g, 0, GUTS_MAX) / GUTS_MAX * 0.2;
  const hitChance = (atkU, defU, mv, g) => clamp(0.75 + (atkU.stats.hit - defU.stats.eva) / STAT_MAX * 0.5 + mv.hit
    + gutsHit(g == null ? atkU.guts : g), 0.15, 0.97);
  const rawDamage = (atkU, defU, mv, dist, g) => {
    const a = atkU.stats[mv.kind];
    const base = mv.power * (20 + a * 0.6) * aptMult(atkU.apt[dist]) * gutsPow(g == null ? atkU.guts : g);
    return base * 300 / (300 + defU.stats.tough * 0.9);
  };
  const guardCut = (u) => clamp(0.35 + u.stats.tough / STAT_MAX * 0.25, 0.35, 0.6);
  const canUse = (u, mv, dist) => mv.dist.includes(dist) && u.guts >= mv.guts;
  const inRange = (mv, dist) => mv.dist.includes(dist);
  const expected = (atkU, defU, mv, dist, guarded, g) => {
    const p = hitChance(atkU, defU, mv, g);
    const crit = mv.crit;
    return p * rawDamage(atkU, defU, mv, dist, g) * (1 + crit * (CRIT_MULT - 1)) * (guarded ? 1 - guardCut(defU) : 1);
  };
  // 届く距離で一番よい技の期待ダメージ(ガッツが足りるかは gutsAvail で見る)
  const bestThreat = (atkU, defU, dist, gutsAvail) => {
    let best = 0;
    for (const mv of atkU.moves) {
      if (!inRange(mv, dist) || gutsAvail < mv.guts) continue;
      const e = expected(atkU, defU, mv, dist, false, gutsAvail);
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
    const foeNextGuts = Math.min(GUTS_MAX, f.guts + f.regen);
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
      score -= Math.max(0, mv.guts - u.regen) * 0.12 * sty.thrift * (1 - Math.min(1, danger));
      if (mv.key === 'unique') score *= 1 + (sty.gamble - 1) * 0.8;
      if (score > bestTech) bestTech = score;
      cands.push({ type: 'tech', key: mv.key, score });
    }
    // 移動(1歩)。手番を1つ使う=いま撃てる技を捨てる。相手も動けるので、得は半分しか当てにしない
    const reachHere = u.moves.some(mv => inRange(mv, dist));
    for (const step of [-1, 1]) {
      const nd = dist + step;
      if (nd < 0 || nd > 3) continue;
      const myGuts = Math.min(GUTS_MAX, u.guts + u.regen + GUTS_MOVE);
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
      const afterGuts = Math.min(GUTS_MAX, u.guts + u.regen + GUTS_CHARGE);
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
            moves: buildMoves(catalog, m.species, m.lv, m.stats), maxHp, hp: maxHp, guts: GUTS_START, regen: catalog.species[m.species].regen,
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
    state.dist = 1 + Math.floor(rng() * 2);
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
        const g0 = u.guts;                       // 撃つ前のガッツで当たり・重さを決める
        u.guts -= mv.guts;
        const p = hitChance(u, f, mv, g0);
        const hit = rng() < p;
        let dmg = 0, crit = false;
        if (hit) {
          crit = rng() < mv.crit;
          const swing = 0.9 + rng() * 0.2;
          dmg = rawDamage(u, f, mv, state.dist, g0) * swing * (crit ? CRIT_MULT : 1) * (f.guarding ? 1 - guardCut(f) : 1);
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
        u.guts = Math.min(GUTS_MAX, u.guts + u.regen);
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

})(__mod);
export const ASSISTANT_MASMON_BATTLE = __mod.exports;
export const MASMON_PVP_CATALOG = {"version":1,"atk":[{"name":"","mult":1,"crit":0.1,"guts":16},{"name":"","mult":1.2,"crit":0.125,"guts":16},{"name":"","mult":1.5,"crit":0.15,"guts":16},{"name":"","mult":1.8,"crit":0.175,"guts":16},{"name":"","mult":2.2,"crit":0.2,"guts":16},{"name":"","mult":2.6,"crit":0.225,"guts":16},{"name":"","mult":3.1,"crit":0.25,"guts":16},{"name":"","mult":3.7,"crit":0.275,"guts":16},{"name":"","mult":4.5,"crit":0.3,"guts":16}],"range":[{"name":"距離撃","mult":1.4,"crit":0.1,"guts":20},{"name":"強・距離撃","mult":1.6,"crit":0.125,"guts":20},{"name":"極・距離撃","mult":1.9,"crit":0.15,"guts":20},{"name":"真・距離撃","mult":2.2,"crit":0.175,"guts":20},{"name":"超・距離撃","mult":2.6,"crit":0.2,"guts":20},{"name":"銀河距離撃","mult":3.1,"crit":0.225,"guts":20},{"name":"次元距離撃","mult":3.7,"crit":0.25,"guts":20},{"name":"覇王距離撃","mult":4.4,"crit":0.275,"guts":20},{"name":"神罰距離撃","mult":5.3,"crit":0.3,"guts":20}],"guard":[{"name":"ガード","mult":2.65,"crit":0,"guts":0},{"name":"ハイガード","mult":2.85,"crit":0,"guts":0},{"name":"鉄壁ガード","mult":3.04,"crit":0,"guts":0},{"name":"金剛不壊","mult":3.24,"crit":0,"guts":0},{"name":"絶対防御","mult":3.64,"crit":0,"guts":0},{"name":"聖域展開","mult":3.93,"crit":0,"guts":0},{"name":"因果遮断","mult":4.68,"crit":0,"guts":0},{"name":"不変の真理","mult":5.57,"crit":0,"guts":0},{"name":"万象拒絶","mult":6.97,"crit":0,"guts":0}],"species":{"Ark":{"name":"アーク","apt":["E","B","C","B"],"atkNames":["我が瞳の真理を見よ","闇を裂く刃となれ","神剣よ断罪を下せ","星屑の記憶よ甦れ","世界を揺らせ","終わりなき祈りよ響け","白き誓い切なる願い","神光よ汚れを祓え","蒼き荊よ咎を穿て"],"unique":{"names":["祈れ輪廻の環よ","裁きの光よ下れ","今こそ真なる目醒め","聖夜の鐘を鳴響け","熾天の剣よ降り立て","聖光よ奇跡を灯せ","終焉に救いを与えよ","天の慈悲を示されよ","永劫の贖いを全うせよ"],"mult":2.8,"guts":56},"regen":10},"Dreamy":{"name":"ドリーミィ","apt":["B","D","D","A"],"atkNames":["プラズマ","ヴェノムエッジ","ドールバッシュ","ストレート","モーニングスター","キャットクロウ","ハートアロー","ドリームダンス","パステルソード"],"unique":{"names":["おもちゃの爆弾","エーテルアイス","アルカナフレア","アルスマグナ","ララバイノクターン","ミラージュクロウ","クリムゾンノヴァ","スウィートドリーム","ドリーミィパレード"],"mult":2.6,"guts":52},"regen":10},"Eiki":{"name":"エイキ","apt":["A","A","C","C"],"atkNames":["桜牙","花裂き","桜風刃","花霞斬","桜月輪","桜嵐刃","千花連刃","桜閃爪","桜華絶閃爪"],"unique":{"names":["華影緋閃","氷花一閃","桜月斬華","緋雪乱刃","花氷双牙","千華氷嵐","緋桜六華閃","絶影桜華乱舞","絶華緋閃・零桜"],"mult":2.8,"guts":56},"regen":10},"Ghost":{"name":"ゴースト","apt":["C","C","A","C"],"atkNames":["ピコピコハンマー","ソウルビーム","ハトのおとしもの","びっくり","体当たり","カード","すてきステッキ","大パンチ","コンビネーション"],"unique":{"names":["連続カード","ドクロビーム","大きなおとしもの","びっくりドクロ","スリーセブン","Woフォーチュン","RSF","運命のコイン","グランドイリュージョン"],"mult":2,"guts":40},"regen":10},"Golem":{"name":"ゴーレム","apt":["A","E","G","G"],"atkNames":["でこぴん","パンチ","キック","チョップ","ハエタタキ","大でこぴん","大パンチ","大キック","大ハエタタキ"],"unique":{"names":["合掌","フライングプレス","竜巻アタック","ぐるぐるアタック","大岩落とし","隕石落とし","超竜巻アタック","超ぐるぐるアタック","銀河破壊"],"mult":3.2,"guts":68},"regen":9},"Ham":{"name":"ハム","apt":["B","B","D","D"],"atkNames":["ワンツー","飛び蹴り","バックナックル","正拳","後ろ蹴り","回し蹴り","ドラゴンパンチ","超飛び蹴り","ドラゴンキック"],"unique":{"names":["おなら","瞬撃","大放屁","暗けい","フラフラダンス","超放屁","超暗けい","デンプシーロール","マジワンツー"],"mult":2,"guts":40},"regen":10},"Iblis":{"name":"イブリース","apt":["D","B","E","B"],"atkNames":["我が瞳の真理を見よ","闇を裂く刃となれ","神剣よ断罪を下せ","星屑の記憶よ甦れ","世界を揺らせ","終わりなき祈りよ響け","白き誓い切なる願い","神光よ汚れを祓え","蒼き荊よ咎を穿て"],"unique":{"names":["祈れ輪廻の環よ","裁きの光よ下れ","今こそ真なる目醒め","聖夜の鐘を鳴響け","熾天の剣よ降り立て","聖光よ奇跡を灯せ","終焉に救いを与えよ","天の慈悲を示されよ","永劫の贖いを全うせよ"],"mult":2.8,"guts":56},"regen":10},"Illumine":{"name":"イルミネ","apt":["B","C","A","E"],"atkNames":["プラズマ","ヴェノムエッジ","シールドバッシュ","ストレート","モーニングスター","アサシンクロウ","アサルトアロー","ブレードダンス","バスターソード"],"unique":{"names":["エーテルアイス","アルカナフレア","アルスマグナ","ノクターン","ミラージュクロウ","クリムゾンノヴァ","ムーンライトヴェール","ルミナスオーロラ","レクイエムエンド"],"mult":2.3,"guts":46},"regen":10},"KenshiMocchi":{"name":"剣士モッチー","apt":["A","A","C","D"],"atkNames":["エッジもんた","もちき・リープ","ガッチョスラント","エアリアルもっちゃん","ガッチャー・クロス","黒桜吹雪","もっさんスピン","枝垂れクロス","バーストもっさま"],"unique":{"names":["ソニック・リープ","ホリゾンタル・スクエア","ヴォーパル・ストライク","デュアル・サーキュラー","ブラック・テンペスト","ブラック・チェイン","ナイトメア・レイド","ジ・エクリプス","スターバースト・ストリーム"],"mult":2.4,"guts":48},"regen":10},"Kuromy":{"name":"クロミー","apt":["C","A","B","D"],"atkNames":["バク頭突き","バク空中落下プレス","ブラックノートライト","バクパタパタ耳","巨大雪だるま転がし","KUROMI'S5アタック","ナイトメアらっきょうボム","バコ・ベリースプラッシュ","ダークパワー"],"unique":{"names":["ドクロボム","クロミーズ5突撃","夢くいウィング","恨み帳メテオ","黒音符バースト","らっきょう大雨","ナイトメアアーク","ダークオーロラ","悪夢フィナーレ"],"mult":3.2,"guts":64},"regen":10},"Kyubi":{"name":"キュービ","apt":["B","D","B","B"],"atkNames":["ひっかき","ひのこ","狐火","下駄蹴り","提灯投げ","提灯落とし","火炎車","神光石火","九重神眼"],"unique":{"names":["ゆうわく","なめろう","超狐火","神狐蒼火","八嵐天衝","陽炎","煉獄九尾陣","天河天翔","炸裂気泡陣"],"mult":2.4,"guts":48},"regen":10},"MelWhip":{"name":"メルホイップ","apt":["E","C","A","B"],"atkNames":["頭突き","空中脳天撃","グリーンライト","ぴろぴろ舌","大玉転がし","月面水爆","キャンディボム","ケーキ入刀","シャドウレギオン"],"unique":{"names":["スターボム","ワンダーブレイズ","ライスシャワー","メテオストーム","パピヨンバースト","ヘビーレイン","エターナルアーク","オーロラハック","コスモフルーツ"],"mult":3.2,"guts":64},"regen":10},"Melody":{"name":"メロディー","apt":["C","B","A","D"],"atkNames":["ぞうさん頭突き","ピアノパラソル脳天撃","メロディタクトライト","ぞうさんぴろぴろ鼻","マリーランド大玉転がし","ムーンサルトメロディー","メロディキャンディボム","メロディ苺クッキー","ドリームパワー"],"unique":{"names":["メロメロハート","ピアノワルツ","リボンウィング","パウンドメテオ","ピンクバースト","キャンディレイン","マリーランドアーチ","メロディタクト","スウィートパレード"],"mult":3.2,"guts":64},"regen":10},"Mia":{"name":"ミーア","apt":["G","C","A","B"],"atkNames":["ハミング","メロディレイ","サンダービート","ハイキック","ヒールソング","ライトニング","メガメロディ","なげキッス","アンコールキッス"],"unique":{"names":["ボイスバン","ギガメロディ","ギガサンダー","ビッグバンライブ","ギガライトニング","コズミックライブ","テラメロディ","テラボイスバン","ノヴァ・フィナーレ"],"mult":2.1,"guts":42},"regen":11},"Mitarashi":{"name":"ミタラシ","apt":["D","D","B","B"],"atkNames":["もんた","もちき","ガッチョ","もっちゃん","ガッチャー","火の粉吹雪","もっさん","枝垂れ炎","もっさま"],"unique":{"names":["モッチ砲","大モッチ砲","超モッチ砲","超モッチ砲2","超モッチ砲3","超炎モッチ砲ゴッド","超蒼炎モッチ砲","身勝手のモッチ砲 兆","身勝手のモッチ砲 極"],"mult":2.2,"guts":44},"regen":10},"Mocchi":{"name":"モッチー","apt":["C","C","C","C"],"atkNames":["もんた","もちき","ガッチョ","もっちゃん","ガッチャー","桜吹雪","もっさん","枝垂れ桜","もっさま"],"unique":{"names":["モッチ砲","大モッチ砲","超モッチ砲","超モッチ砲2","超モッチ砲3","超モッチ砲ゴッド","超モッチ砲ブルー","身勝手のモッチ砲 兆","身勝手のモッチ砲 極"],"mult":2.2,"guts":44},"regen":10},"Monol":{"name":"モノリス","apt":["B","C","D","C"],"atkNames":["たおれこみ","針ぶっ刺し","大たおれこみ","わらわら","針かみつき","2連アタック","超たおれこみ","超針ぶっ刺し","3連アタック"],"unique":{"names":["トリオビームX","サケビ声","トリオビームY","怪光線","超おんぱ","ファームアルファ","トリオビームZ","フォームガンマ","トリオビーム∞"],"mult":2.2,"guts":44},"regen":9},"Oboro":{"name":"オボロゲソウ","apt":["D","E","B","C"],"atkNames":["ビンタ","つっつき","根っこ","コンビネーション","捕食","雑草魂","フェイスドリル","超捕食","ドリルコンビネーション"],"unique":{"names":["種ガン","葉っぱブレード","花粉","キンプン","種マシンガン","フラワービーム","乱れ咲き","蒼花爆散","クリスマスツリー"],"mult":2,"guts":40},"regen":10},"Orihime":{"name":"オリヒメ","apt":["B","A","D","A"],"atkNames":["ひっかき","ひのこ","狐火","下駄蹴り","提灯投げ","提灯落とし","火炎車","神光石火","九重神眼"],"unique":{"names":["求愛","織姫のくちづけ","超狐火・星","陽炎","神狐星火","八鈴天衝","炸裂気泡陣","煉獄九尾陣","天河天翔"],"mult":2.3,"guts":46},"regen":10},"Pandora":{"name":"パンドラ","apt":["B","B","B","B"],"atkNames":["デュアルスラップ","ルミナスレイ","ナイトサンダー","セラフキック","アビスレイド","ホーリーライトニング","カオスメガレイ","エクリプスキッス","デュアルキッス"],"unique":{"names":["デュアルバン","セイクリッドレイ","アビスサンダー","ツインビッグバン","ダークライトニング","カオスコズミック","アストラルクロスレイ","エクリプスノヴァ","ダイスキライライ"],"mult":2.3,"guts":52},"regen":10},"Pixie":{"name":"ピクシー","apt":["G","F","B","A"],"atkNames":["はり手","レイ","サンダー","ハイキック","ヒールレイド","ライトニング","メガレイ","なげキッス","ディープキッス"],"unique":{"names":["バン","ギガレイ","ギガサンダー","ビッグバン","ギガライトニング","コズミッグバン","テラレイ","テラバン","ドラゴ・ノヴァ"],"mult":2.1,"guts":42},"regen":11},"Plant":{"name":"プラント","apt":["C","D","F","A"],"atkNames":["ビンタ","つっつき","根っこ","コンビネーション","捕食","雑草魂","フェイスドリル","超捕食","ドリルコンビネーション"],"unique":{"names":["種ガン","葉っぱブレード","花粉","キンプン","種マシンガン","フラワービーム","乱れ咲き","蒼花爆散","クリスマスツリー"],"mult":2,"guts":40},"regen":10},"Snegurochka":{"name":"スネグーラチカ","apt":["D","E","B","A"],"atkNames":["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","ジングルベル"],"unique":{"names":["アイスアロー","ダブルバレッド","アイスコフィン","プレゼントキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","メリークリスマス"],"mult":2.2,"guts":44},"regen":10},"Spooky":{"name":"スプーキー","apt":["B","D","B","A"],"atkNames":["ピコピコハンマー","ソウルビーム","ハトのおとしもの","びっくり","体当たり","カード・クラブ","すてきステッキ","大パンチ","グリンネーション"],"unique":{"names":["連続カード","ドクロビーム","大きなおとしもの","びっくりドクロ","スリーセブン","Woフォーチュン","RSF","運命のコイン","グランドイリュージョン"],"mult":2.4,"guts":48},"regen":11},"Suezo":{"name":"スエゾー","apt":["E","D","C","B"],"atkNames":["しっぽアタック","ツバはき","テレポート","なめる","キッス","かみつき","なめキッス","タンはき","ベロビンタ"],"unique":{"names":["サイコキネシス","熱視線","食う","クロノキネシス","歌う","超熱視線","超食う","超歌う","瞬間移動熱視線"],"mult":2.5,"guts":48},"regen":10},"Tiger":{"name":"ライガー","apt":["C","B","D","D"],"atkNames":["たいあたり","ひっかき","突進","つながるワンツー","影撃","空中回転アタック","無制限バースト","炎撃","コンビネーション"],"unique":{"names":["雷撃","冷気弾","超雷撃","ブリザード","突き刺し","落雷共鳴","かがやきいき","ライジングブースト","氷雷突殺"],"mult":2.3,"guts":46},"regen":10},"Undine":{"name":"ウンディーネ","apt":["G","D","C","C"],"atkNames":["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","アクアゲイザー"],"unique":{"names":["アイスアロー","ダブルバレッド","アイスコフィン","アクアキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","オーシャンノヴァ"],"mult":2.2,"guts":44},"regen":11},"Yaobikuni":{"name":"ヤオビクニ","apt":["D","B","E","C"],"atkNames":["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","アクアゲイザー"],"unique":{"names":["アイスアロー","ダブルバレッド","アイスコフィン","アクアキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","オーシャンノヴァ"],"mult":2.2,"guts":44},"regen":10},"Yggdrasil":{"name":"ユグドラシル","apt":["B","D","E","A"],"atkNames":["頭突き","空中脳天撃","グリーンライト","ぴろぴろ舌","大玉転がし","月面水爆","キャンディボム","苺大噴","シャドウレギオン"],"unique":{"names":["スターボム","ワンダーブレイズ","メニーウィング","メテオストーム","パピヨンバースト","ヘビーレイン","エターナルアーク","オーロラハック","コスモフルーツ"],"mult":3.2,"guts":64},"regen":10},"Zan":{"name":"ザン","apt":["C","A","B","E"],"atkNames":["シングルショット","ミラージュシフト","サマーソルト","レッグアーク","ソニックナイフ","ダブルサマー","ダブルショット","トリプルサマー","アサルトダンス"],"unique":{"names":["リバースレイド","ソニックレイヴ","メテオドライブ","アサルトレイド","ライジングレイヴ","アクシズバレット","ダークホウスト","アサルトライジング","ブラッディクロス"],"mult":2.5,"guts":50},"regen":10}}};

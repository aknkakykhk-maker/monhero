// 助手のマスモンの完全オートバトルの「計算」(第③段階の芯・2026-11-11 タタカイ)。
// 設計: docs/spec/ASSISTANT_MASMON_BATTLE.md / 仕様書: docs/progress/assistant-peer/ASSISTANT-MASMON-AUTOBATTLE-SPEC-v1.md §9
//
// ★画面に頼らない純粋な計算。React・window・localStorage・Date・Math.random を使わない。
//   同じ(編成・種)なら、端末でもサーバ(Supabase Edge Function / Deno)でも同じ結果になる。
//   使ってよい計算は + − × ÷・Math.floor/round/min/max/abs/sqrt だけ(Math.exp/log/pow/sin は
//   エンジンで値がずれうるので使わない)。
// ★技はモンスターファームのような助手のマスモン専用の技表(ASSISTANT_MASMON_TECHS・シュギョウ担当)を使う
//   (2026-11-11 社長「距離撃はなしにして、技の性能自体も一新して作ってほしい。モンファーみたいな感じで」)。
//   既存のモンヒロバトルの技(通常攻撃・距離撃・固有技・ガード)は使わない。種から使うのは 距離の得意(distAptitude)と
//   基礎ガッツ(baseGuts → ガッツのたまる速さ)だけ
// ★好き嫌い・疲労・ストレスは入力に取らない(強さに効かせない)。プレイヤーのセーブ・ランキングに触れない。
//
// 使い方:
//   const catalog = ASSISTANT_MASMON_BATTLE.buildCatalog({ ALL_PLAYER_MONSTERS, ASSISTANT_MASMON_TECHS });  // 写し(JSON にできる)
//   const r = ASSISTANT_MASMON_BATTLE.simulate({ seed:'abc', catalog,
//     teamA:{ assistantId:'mua', tactics:20, members:[{ species:'Mocchi', name:'もち', lv:12,
//       stats:{ life:400, pow:420, wise:150, hit:260, eva:180, tough:390 } }] },
//     teamB:{ ... } });
//   r.winner('A'|'B'|'draw')・r.reason('wipe'|'judge')・r.log(1手ずつ)・r.digest(結果の指紋)
(function (root) {
  'use strict';

  const VERSION = 3;           // 計算を変えたら上げる(サーバの試合の行に残る。2 = 技を MF のように一新・3 = 作戦と交代の早さ)
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
  // 技の熟練(0〜100。シュギョウの mh_assistant_masmon_train_v1)の効き。社長が「中」を選んだ(2026-11-11)
  const MASTERY_HIT_MAX = 0.06;    // 熟練100で命中 +6%
  const MASTERY_GUTS_CUT = 0.15;   // 熟練100でガッツ消費 −15%(四捨五入)
  const MASTERY_GUARD_ADD = 0.08;  // ガードの熟練100で受けるダメージがさらに −8%
  // 能力の差の効き方のつまみ(2026-11-11 社長「実際バトルをしてほしい。それを観戦できるようにしたい」。決めるのは観戦してから)。
  //   1体ごとの6能力の合計と、出る全員の平均の合計との差を k 倍にする(6能力の配分=個性はそのまま)。
  //   A=いまのまま(本番の技表で合計+10%の側が約75%勝つ)/B=差を半分に(約62%)/C=差を1.5倍に(約85%)
  const BALANCE = Object.freeze({ A: 1, B: 0.5, C: 1.5 });
  // 技の数字の幅(MF2 の技の幅。docs/spec/ASSISTANT_MASMON_BATTLE.md「MF との対応」)。外れた値は切る
  const TECH_LIMITS = Object.freeze({ power: [1, 70], hit: [-25, 22], guts: [5, 60], crit: [0, 30], gd: [0, 45] });

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
  //   swap 交代の好み / gamble 大技(威力30以上)の好み / read 読みの良さ(戦術経験に足す)
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
  // 作戦と交代の早さ(2026-11-11 社長「自分で決める」に 作戦・交代の早さ。数字はミセカタ2の案・鏡の対戦で勝率 47〜52%)。
  // 端末からは名前だけ受け、倍率は計算側の表で掛ける(フレンド対戦でサーバが同じ計算をし、数値の改ざんを通さない)
  const PLANS = Object.freeze({
    attack: Object.freeze({ label: '攻める', mul: Object.freeze({ aggr: 1.25, caution: 0.8, thrift: 0.85, gamble: 1.2 }) }),
    guard:  Object.freeze({ label: '守る',   mul: Object.freeze({ aggr: 0.85, caution: 1.3, thrift: 1.2, gamble: 0.8 }) }),
    range:  Object.freeze({ label: '間合い', mul: Object.freeze({ mobility: 1.35, thrift: 1.05 }) }),
    big:    Object.freeze({ label: '大技',   mul: Object.freeze({ gamble: 1.45, aggr: 1.1, thrift: 0.8 }) }),
  });
  const SWAP_PACES = Object.freeze({
    early: Object.freeze({ label: '早め',   mul: Object.freeze({ swap: 1.5 }) }),
    late:  Object.freeze({ label: 'ねばる', mul: Object.freeze({ swap: 0.55 }) }),
  });
  // 重みの範囲(作戦・上書きのあとに切る)。read(読み)は 0〜30
  const STYLE_RANGE = Object.freeze({ swap: [0.3, 2.0], read: [0, 30], other: [0.4, 1.8] });
  const styleOf = (assistantId, override, plan, swapPace) => {
    const base = STYLES[assistantId] || STYLES.atsu;
    const pm = (PLANS[plan] && PLANS[plan].mul) || {};
    const sm = (SWAP_PACES[swapPace] && SWAP_PACES[swapPace].mul) || {};
    const out = {};
    for (const k of Object.keys(STYLE_BASE)) {
      const o = override && Number.isFinite(Number(override[k])) ? Number(override[k]) : null;
      let v = o != null ? o : (Number.isFinite(base[k]) ? base[k] : STYLE_BASE[k]);
      v = v * (pm[k] || 1) * (sm[k] || 1);
      const [lo, hi] = STYLE_RANGE[k] || STYLE_RANGE.other;
      out[k] = clamp(v, lo, hi);
    }
    return out;
  };


  // ── 技表の写し(画面の変数から一度だけ作る。JSON にしてサーバへ持っていける) ──
  //   ASSISTANT_MASMON_TECHS = { version, species: { [種]: [ { id, name, kind:'pow'|'wise', dist:[0..3], power, hit, guts, crit, gd } ] } }
  const normTech = (t, idx) => {
    const x = t && typeof t === 'object' ? t : {};
    const num = (v, k, def) => { const n = Number(v); const [lo, hi] = TECH_LIMITS[k]; return Number.isFinite(n) ? clamp(Math.round(n), lo, hi) : def; };
    const dist = (Array.isArray(x.dist) ? x.dist : []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 3);
    return {
      id: typeof x.id === 'string' && x.id ? x.id : `t${idx}`,
      name: typeof x.name === 'string' && x.name ? x.name : `技${idx + 1}`,
      kind: x.kind === 'wise' ? 'wise' : 'pow',
      dist: dist.length ? [...new Set(dist)].sort() : [1],
      power: num(x.power, 'power', 10), hit: num(x.hit, 'hit', 0), guts: num(x.guts, 'guts', 20),
      crit: num(x.crit, 'crit', 5), gd: num(x.gd, 'gd', 0),
      start: !!(x.learn && x.learn.start),        // はじめから覚えている技(覚えた技の記録が無いときはこれだけ)
    };
  };
  const buildCatalog = (src) => {
    const s = src || {};
    const mons = s.ALL_PLAYER_MONSTERS || {};
    const table = (s.ASSISTANT_MASMON_TECHS && s.ASSISTANT_MASMON_TECHS.species) || {};
    const species = {};
    for (const id of Object.keys(mons).sort()) {
      const m = mons[id];
      const techs = Array.isArray(table[id]) ? table[id].map(normTech) : [];
      if (!m || !techs.length) continue;            // 技表に無い種は対戦に出られない
      const apt = Array.isArray(m.distAptitude) && m.distAptitude.length === 4
        ? m.distAptitude.map(g => (GRADES.includes(g) ? g : 'C')) : ['C', 'C', 'C', 'C'];
      species[id] = { name: String(m.name || id), apt, techs, baseGuts: Number(m.baseGuts) || 0 };
    }
    // 種ごとのガッツのたまる速さ: モンヒロバトルの基礎ガッツ(baseGuts)の大きさで 9〜11(真ん中 10)
    const gs = Object.values(species).map(v => v.baseGuts);
    const gMin = Math.min(...gs), gMax = Math.max(...gs);
    for (const v of Object.values(species)) {
      v.regen = gMax > gMin ? GUTS_REGEN - 1 + Math.round((v.baseGuts - gMin) / (gMax - gMin) * 2) : GUTS_REGEN;
      delete v.baseGuts;
    }
    const tv = s.ASSISTANT_MASMON_TECHS && Number(s.ASSISTANT_MASMON_TECHS.version);
    return { version: VERSION, techVersion: Number.isFinite(tv) ? tv : 0, species };
  };

  const LV_MAX = 99;   // 育成の Lv 1〜99(キズナ4の AMG_LV_MAX)。いまは強さに効かない(強さは6能力と熟練が持つ)
  const aptMult = (grade) => {
    const i = GRADES.indexOf(grade);
    return clamp(1 + ((i < 0 ? 4 : i) - 4) * 0.05, 0.8, 1.25);
  };

  // 1体ぶんの技の表。覚えている技(techs)だけ・熟練で命中とガッツ消費を直す。
  // 覚えた技の記録が無い(古い入れ物)ときは、はじめから覚えている技(learn.start)だけ。それも無い種は全部。
  // 記録があって1つも当てはまらなければ、はじめの技(無ければ最初の技)
  const startTechs = (sp) => { const st = sp.techs.filter(t => t.start); return st.length ? st : sp.techs.slice(); };
  const buildMoves = (catalog, speciesId, techIds, mastery) => {
    const sp = catalog.species[speciesId];
    const known = Array.isArray(techIds) ? sp.techs.filter(t => techIds.includes(t.id)) : startTechs(sp);
    const list = known.length ? known : (sp.techs.some(t => t.start) ? startTechs(sp) : [sp.techs[0]]);
    return list.map(t => {
      const m = clamp(Number(mastery && mastery[t.id]) || 0, 0, 100);
      return { key: t.id, name: t.name, kind: t.kind, dist: t.dist, power: t.power / 20,
        hit: t.hit / 100 + m / 100 * MASTERY_HIT_MAX, guts: Math.round(t.guts * (1 - m / 100 * MASTERY_GUTS_CUT)),
        crit: t.crit / 100, gd: t.gd, big: t.power >= 30 };
    });
  };

  // 助手のマスモンの並び(mh_assistant_life_masmon_v1 の行: monster・nick・lv)と育成の入れ物
  // (mh_assistant_masmon_grow_v1 の amgEntryOf の戻り: st・lv)と修行の入れ物(mh_assistant_masmon_train_v1 の
  // amgtEntryOf の戻り: m=熟練・learn=覚えた技。amgtBattleOf の { techs, mastery } でもよい)から、対戦の1体を作る。入れ物が無ければ既定値
  const unitFromGrow = (row, entry, train) => {
    const r = row && typeof row === 'object' ? row : {};
    const e = entry && typeof entry === 'object' ? entry : null;
    const t = train && typeof train === 'object' ? train : null;
    // 修行の入れ物 { m, learn } でも、受け渡し amgtBattleOf の { techs, mastery } でもよい
    const learn = t && (Array.isArray(t.techs) ? t.techs : t.learn);
    const techs = Array.isArray(learn) ? learn : (learn && typeof learn === 'object' ? Object.keys(learn).filter(k => learn[k]) : undefined);
    const mastery = t && (t.mastery && typeof t.mastery === 'object' ? t.mastery : (t.m && typeof t.m === 'object' ? t.m : undefined));
    return { species: r.monster, name: r.nick, lv: e && e.lv != null ? e.lv : r.lv, stats: e ? e.st : null,
      techs, mastery: mastery || undefined };
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
    // 覚えている技(無ければその種の全部)・熟練(技 id ごと+guard・dist・swap。無ければ 0)
    const techs = Array.isArray(src.techs) ? src.techs.filter(x => typeof x === 'string') : null;
    const mastery = {};
    const ms = src.mastery && typeof src.mastery === 'object' ? src.mastery : {};
    for (const k of [...catalog.species[species].techs.map(t => t.id), 'guard', 'dist', 'swap']) mastery[k] = toInt(ms[k], 0, 100, 0);
    return { species, name: typeof src.name === 'string' && src.name ? src.name.slice(0, 24) : catalog.species[species].name, lv, stats, techs, mastery };
  };
  const normalizeTeam = (t, catalog) => {
    const src = t && typeof t === 'object' ? t : {};
    const list = (Array.isArray(src.members) ? src.members : []).slice(0, TEAM_MAX).map(u => normalizeUnit(u, catalog));
    if (!list.length) throw new Error('assistant-masmon-battle: members が空');
    return {
      assistantId: typeof src.assistantId === 'string' ? src.assistantId : 'atsu',
      tactics: toInt(src.tactics, 0, 100, 0),
      plan: PLANS[src.plan] ? src.plan : null,
      swapPace: SWAP_PACES[src.swapPace] ? src.swapPace : null,
      style: styleOf(src.assistantId, src.style, src.plan, src.swapPace),
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
  const guardCut = (u) => clamp(0.35 + u.stats.tough / STAT_MAX * 0.25, 0.35, 0.6) + (u.mastery ? u.mastery.guard : 0) / 100 * MASTERY_GUARD_ADD;
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
      if (mv.big) score *= 1 + (sty.gamble - 1) * 0.8;               // 大技(威力30以上)の好み
      // ガッツダウン: 当たれば相手が次に撃てる技が減る(相手のガッツが少ないほど効く)
      if (mv.gd > 0) score += p * Math.min(mv.gd, f.guts) * 0.12 * (0.6 + 0.4 * skill);
      if (score > bestTech) bestTech = score;
      cands.push({ type: 'tech', key: mv.key, score, why: e >= f.hp ? 'finish' : (mv.gd > 0 && mv.gd >= 20 ? 'gutsDown' : (mv.big ? 'big' : 'attack')) });
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
      const toReach = !reachHere && u.moves.some(mv => inRange(mv, nd));
      if (toReach) score += 20;
      cands.push({ type: 'move', step, score, why: toReach ? 'reach' : (gain > 0 ? 'better' : 'safer') });
    }
    // ガード(相手が撃ってこなければ無駄になるので、見込みは 6 割)
    if (threatNow > 0) {
      const saved = threatNow * guardCut(u) * 0.6;
      let score = saved / u.maxHp * 100 * (0.4 + 0.6 * sty.caution) * (0.8 + (1 - hpFrac) * 0.6) * (0.5 + 0.5 * skill);
      score -= bestTech * (0.45 - 0.15 * (sty.caution - 1));
      cands.push({ type: 'guard', score, why: hpFrac < 0.5 ? 'lowHp' : 'block' });
    }
    // ためる(ガッツが満タンなら候補に入れない)
    if (u.guts < GUTS_MAX) {
      const afterGuts = Math.min(GUTS_MAX, u.guts + u.regen + GUTS_CHARGE);
      const nowBest = bestThreat(u, f, dist, u.guts);
      const laterBest = bestThreat(u, f, dist, afterGuts);
      let score = (laterBest - nowBest) / f.maxHp * 100 * 0.6 * (0.8 + 0.2 * sty.thrift);
      score -= danger * 20 * (0.8 + 0.2 * sty.caution);              // 危ないときにためるのは損
      if (nowBest === 0 && laterBest > 0) score += 8;
      cands.push({ type: 'charge', score, why: nowBest === 0 ? 'noGuts' : 'saveUp' });
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
        cands.push({ type: 'swap', to: i, score, why: danger >= 1 && hpFrac < 0.5 ? 'rescue' : 'matchup' });
      }
    }
    if (!cands.length) cands.push({ type: 'charge', score: 0, why: 'noGuts' });       // ガッツ満タンで何もできない時の保険(実際は起きない)

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
      pick.why = 'finish';
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
        assistantId: nt.assistantId, tactics: nt.tactics, plan: nt.plan, swapPace: nt.swapPace, style: nt.style, active: 0,
        units: nt.members.map(m => {
          const maxHp = maxHpOf(m.stats);
          return { species: m.species, name: m.name, lv: m.lv, stats: m.stats, apt: catalog.species[m.species].apt,
            moves: buildMoves(catalog, m.species, m.techs, m.mastery), mastery: m.mastery, maxHp, hp: maxHp, guts: GUTS_START, regen: catalog.species[m.species].regen,
            guarding: false, swapCooldown: SWAP_COOLDOWN, moveStreak: 0 };
        }),
      };
    };
    return { teams: { A: mkTeam(inp.teamA), B: mkTeam(inp.teamB) }, dist: DIST_START, round: 0 };
  };

  // 能力の差の効き方: 1体ごとの合計の差を k 倍(A は何もしない=結果は変わらない)
  const applyBalance = (state, k) => {
    if (k === 1) return;
    const all = [...state.teams.A.units, ...state.teams.B.units];
    const sum = (u) => STAT_KEYS.reduce((t, key) => t + u.stats[key], 0);
    const avg = all.reduce((t, u) => t + sum(u), 0) / all.length;
    for (const u of all) {
      const tot = sum(u);
      if (tot <= 0) continue;
      const f = (avg + (tot - avg) * k) / tot;
      const st = {};
      for (const key of STAT_KEYS) st[key] = clamp(Math.round(u.stats[key] * f), 0, STAT_MAX);
      u.stats = st;
      u.maxHp = maxHpOf(st); u.hp = u.maxHp;
    }
  };

  const ACTION_EVS = ['tech', 'move', 'guard', 'charge', 'swap'];

  // ── 本体 ──
  const simulate = (input) => {
    const inp = input && typeof input === 'object' ? input : {};
    const catalog = inp.catalog;
    if (!catalog || !catalog.species || !Object.keys(catalog.species).length) throw new Error('assistant-masmon-battle: catalog が無い');
    const rng = makeRng(inp.seed);
    const roundLimit = toInt(inp.roundLimit, 1, 1000, ROUND_LIMIT);
    const state = setupState(inp, catalog);
    const balance = BALANCE[inp.balance] != null ? inp.balance : 'A';
    applyBalance(state, BALANCE[balance]);
    state.dist = 1 + Math.floor(rng() * 2);
    const ctx = { state, rng, trace: !!inp.trace, lastCands: null };
    const log = [];
    const alive = (side) => state.teams[side].units.some(x => x.hp > 0);
    const unitOf = (side) => state.teams[side].units[state.teams[side].active];
    const push = (e) => {
      const row = Object.assign({ r: state.round, d: state.dist }, e);
      if (ACTION_EVS.includes(e.ev)) { row.ga = unitOf('A').guts; row.gb = unitOf('B').guts; }   // 手のあとの両方の場のガッツ
      if (ctx.trace && ctx.lastCands && ACTION_EVS.includes(e.ev)) { row.cands = ctx.lastCands; ctx.lastCands = null; }
      log.push(row);
    };

    const movesOf = (side) => state.teams[side].units.map(x => x.moves.map(m => ({ id: m.key, name: m.name, kind: m.kind, guts: m.guts, dist: m.dist })));
    push({ ev: 'start', v: VERSION, balance,
      plan: { A: state.teams.A.plan, B: state.teams.B.plan }, swapPace: { A: state.teams.A.swapPace, B: state.teams.B.swapPace }, a: state.teams.A.units.map(x => x.name), b: state.teams.B.units.map(x => x.name),
      aMoves: movesOf('A'), bMoves: movesOf('B'),
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
        const gd = hit && mv.gd > 0 ? Math.min(mv.gd, f.guts) : 0;   // ガッツダウン
        f.guts -= gd;
        push({ ev: 'tech', side, i: me.active, ti: state.teams[foeSide].active, p: Math.round(p * 1000) / 10, why: c.why, move: mv.key, name: mv.name, kind: mv.kind, hit, crit, dmg,
          guarded: !!(hit && f.guarding), guts: u.guts, foeHp: f.hp, gd, foeGuts: f.guts });
      } else if (c.type === 'move') {
        state.dist = clamp(state.dist + c.step, 0, 3);
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        push({ ev: 'move', side, i: me.active, why: c.why, step: c.step, to: state.dist, guts: u.guts });
      } else if (c.type === 'guard') {
        u.guarding = true;
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_MOVE);
        push({ ev: 'guard', side, i: me.active, why: c.why, name: 'ガード', guts: u.guts });
      } else if (c.type === 'charge') {
        u.guts = Math.min(GUTS_MAX, u.guts + GUTS_CHARGE);
        push({ ev: 'charge', side, i: me.active, why: c.why, guts: u.guts });
      } else if (c.type === 'swap') {
        const from = me.active;
        u.guarding = false;
        me.active = c.to;
        const n = unitOf(side);
        n.guts = Math.max(n.guts, GUTS_SWAP_IN);
        n.swapCooldown = SWAP_COOLDOWN;
        push({ ev: 'swap', side, from, why: c.why, i: c.to, name: n.name, guts: n.guts });
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
    return { version: VERSION, balance, winner, reason, rounds: state.round, log, final, digest: digestOf(log) };
  };

  // 結果の指紋(同じ種・同じ編成なら同じ値。端末とサーバの突き合わせ用)
  // AI の点の一覧(cands。trace:true のときだけ付く)は除く=trace のあり・なしで同じ指紋(trace なしの値はこれまでと同じ)
  const digestOf = (log) => hashSeed(JSON.stringify(log.map(e => {
    if (!e.cands) return e;
    const c = Object.assign({}, e);
    delete c.cands;
    return c;
  }))).toString(16).padStart(8, '0');

  const api = Object.freeze({
    VERSION, STAT_KEYS, STAT_MAX, DIST_NAMES, TEAM_MAX, GUTS_MAX, ROUND_LIMIT, STYLES, TECH_LIMITS,
    MASTERY_HIT_MAX, MASTERY_GUTS_CUT, MASTERY_GUARD_ADD, BALANCE, PLANS, SWAP_PACES, STYLE_RANGE,
    LV_MAX, buildCatalog, simulate, unitFromGrow, makeRng, hashSeed,
    WHY: Object.freeze({ finish: '倒しきれる', gutsDown: 'ガッツを削る', big: '大技', attack: '攻める', reach: '技が届く所へ', better: '有利な間合いへ',
      safer: '危ない間合いから離れる', lowHp: 'ライフが少ないので守る', block: '相手の大きい一撃にそなえる', noGuts: 'ガッツが足りない', saveUp: '大技のためにためる',
      rescue: '倒されそうなので下げる', matchup: '相性のよい仲間へ' }),
    // 検査用(計算の部品)
    _internal: Object.freeze({ setupState, aptMult, normTech, buildMoves, normalizeUnit, normalizeTeam, styleOf, hitChance, rawDamage, chooseAction, maxHpOf }),
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ASSISTANT_MASMON_BATTLE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

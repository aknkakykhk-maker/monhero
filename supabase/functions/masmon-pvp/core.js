// 助手のマスモンのフレンド対戦(非同期PvP・第④段階)の中身(2026-11-11 タイセン)。設計: docs/spec/MASMON_PVP_SERVER.md
// index.ts(Deno の入口)が、表の読み書き(db)・計算の本体(engine)・技データの写し(catalog)・いまの時刻・種の作り方を渡して handle を呼ぶ。
// 検査(tools/masmon-battle/masmon-pvp-check.js)は偽物の表を渡して、本番の表に触らずに確かめる。
//
// 頼み(body.action)
//   register   … 助手の編成を登録する。上限の見張り(日数 × 1日の成長上限・能力の合計・Lv・種・名前)を通ったものだけ
//   unregister … 登録をやめる(行は残す。みんなに見せない)
//   challenge  … フレンドの登録編成に挑む。**対戦はここ(サーバ)だけが回す。** 勝ち負けを端末から受け取らない
// ★記録に書くのは件数・エラーの種類だけ(名前や編成は書かない)

// ---- 決めた数字(仮の数字は 仮 と書く。変えるのはここだけ) ----
// 1体の6能力の合計が1日に伸びてよい量(社長「関わった最大=1日20」)
export const DAILY_GROWTH_CAP = 20;
// 初めて登録する1体の上限(移行で作る初めの値: ライフ・ちから・丈夫さ ≦ 600、かしこさ・命中・回避 ≦ 300 を Lv で少し上げる。GROW-BASE-PLAN)
export const INITIAL_STAT_CAP = Object.freeze({ life: 600, pow: 600, wise: 400, hit: 400, eva: 400, tough: 600 });
export const INITIAL_TOTAL_CAP = 3000;                       // 仮
// 育成(6能力)を始めた日。この日より前には育っていない(この日からの日数で上限を出す)。公開の日に合わせて直す(仮)
export const GROW_EPOCH = '2026-11-11';
export const STAT_ABS_MAX = 999;
export const LV_CAP = 30;                                    // いまのマスモンの Lv の上限(迎えたときに決まる 1〜30)
export const TACTICS_INITIAL_CAP = 20;                       // 仮。戦術経験(0〜100)の初めの上限
export const TACTICS_DAILY_CAP = 5;                          // 仮。戦術経験が1日に増えてよい量
export const NAME_MAX = 12;                                  // マスモンの名前(提案の決まり 1〜12字)
export const TEAM_MIN = 1;
export const TEAM_MAX = 3;
export const SLOT_MAX = 8;                                   // 持てるマスモンは8体(枠 0〜7)
// 公平の区分: 1体の6能力の合計をこの値にそろえる(比はそのまま)。Lv もそろえる
export const FAIR_TOTAL = 2400;                              // 仮
export const FAIR_LV = 30;
// 回数とランキング
export const CHALLENGE_DAILY_LIMIT = 20;                     // 仮。1人1日に挑める回数
export const PAIR_RATED_DAILY_LIMIT = 3;                     // 仮。同じ2人の試合をランキングに数えるのは1日3回まで(3対3だけ)
export const ELO_K = 32;
export const DIVISIONS = Object.freeze(['raw', 'fair']);
// 能力の差の効き方(計算の balance 'A'|'B'|'C')。社長が観戦してから決める。決まるまで A。試合の行に残す
export const BALANCE = 'A';
export const MASTERY_MAX = 100;
const MASTERY_EXTRA = ['guard', 'dist', 'swap'];

const MS_DAY = 86400000;
const OWNER_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ASSISTANT_RE = /^[a-z]{2,16}$/;
const SPECIES_RE = /^[A-Za-z0-9_]{1,40}$/;

// 朝4:00(JST)で区切った日(表の masmon_pvp_today と同じ)
export const dayOf = (ms) => new Date(ms + 9 * 3600000 - 4 * 3600000).toISOString().slice(0, 10);
const daysBetween = (fromDay, toDay) => Math.round((Date.parse(toDay) - Date.parse(fromDay)) / MS_DAY);

const isInt = (v) => typeof v === 'number' && Number.isInteger(v);
const sumStats = (st, keys) => keys.reduce((t, k) => t + st[k], 0);

// 名前: 1〜12字・制御文字なし・連絡先らしいもの(URL・メール・4けた以上の数字)ははじく
export const nameProblem = (s) => {
  if (typeof s !== 'string') return 'name';
  const t = s.trim();
  const len = [...t].length;
  if (len < 1 || len > NAME_MAX) return 'name';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>]/.test(t)) return 'name';
  if (/https?:|www\.|@|[0-9０-９]{4,}/i.test(t)) return 'name';
  return null;
};

// 登録の形を確かめる(数字の上限はまだ見ない)。返り値 { team } か { error }
export const parseTeam = (raw, engine, catalog, learn = {}) => {
  const keys = engine.STAT_KEYS;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.members)) return { error: 'shape' };
  const ms = raw.members;
  if (ms.length < TEAM_MIN || ms.length > TEAM_MAX) return { error: 'size' };
  if (!isInt(raw.tactics) || raw.tactics < 0 || raw.tactics > 100) return { error: 'tactics' };
  const members = [];
  const slots = new Set();
  for (const m of ms) {
    if (!m || typeof m !== 'object') return { error: 'shape' };
    if (!isInt(m.slot) || m.slot < 0 || m.slot >= SLOT_MAX || slots.has(m.slot)) return { error: 'slot' };
    slots.add(m.slot);
    if (typeof m.species !== 'string' || !SPECIES_RE.test(m.species) || !catalog.species[m.species]) return { error: 'species' };
    if (nameProblem(m.name)) return { error: 'name' };
    if (!isInt(m.lv) || m.lv < 1 || m.lv > Math.min(LV_CAP, engine.LV_MAX)) return { error: 'lv' };
    const st = m.stats && typeof m.stats === 'object' ? m.stats : null;
    if (!st) return { error: 'stats' };
    const stats = {};
    for (const k of keys) {
      if (!isInt(st[k]) || st[k] < 0 || st[k] > STAT_ABS_MAX) return { error: 'stats' };
      stats[k] = st[k];
    }
    // 覚えた技: 無ければ初めからの技。その種の技表にある id だけ・重ならない・習得条件(能力の下限・前の技の熟練)を満たすこと
    const spTechs = catalog.species[m.species].techs || [];
    const ids = new Set(spTechs.map((t) => t.id));
    const techs = m.techs == null ? spTechs.filter((t) => t.start).map((t) => t.id) : m.techs;
    if (!Array.isArray(techs) || techs.length < 1 || techs.length > spTechs.length || new Set(techs).size !== techs.length
      || !techs.every((id) => typeof id === 'string' && ids.has(id))) return { error: 'techs' };
    // 熟練: 技 id(覚えた技だけ)と guard・dist・swap。0〜100 の整数
    const rawM = m.mastery == null ? {} : m.mastery;
    if (!rawM || typeof rawM !== 'object' || Array.isArray(rawM)) return { error: 'mastery' };
    const mastery = {};
    for (const [k, v] of Object.entries(rawM)) {
      if (!(techs.includes(k) || MASTERY_EXTRA.includes(k)) || !isInt(v) || v < 0 || v > MASTERY_MAX) return { error: 'mastery' };
      if (v > 0) mastery[k] = v;
    }
    for (const id of techs) {
      const l = learn[id];
      if (!l || l.start) continue;
      if (l.st && Object.entries(l.st).some(([k, min]) => !(stats[k] >= min))) return { error: 'learn' };
      if (l.need && Object.entries(l.need).some(([tid, min]) => !techs.includes(tid) || !((mastery[tid] || 0) >= min))) return { error: 'learn' };
    }
    members.push({ slot: m.slot, species: m.species, name: m.name.trim(), lv: m.lv, stats, techs: [...techs], mastery });
  }
  return { team: { tactics: raw.tactics, members } };
};

export const unitKeyOf = (m) => `${m.slot}:${m.species}`;

// 上限の見張り。anchors = { unitKey: { first_day, first_stats, first_total, first_lv } }(無ければ初めての登録)
// 返り値: 問題の一覧(空なら通る)
export const capProblems = ({ team, anchors, entry, today, engine }) => {
  const keys = engine.STAT_KEYS;
  const out = [];
  const sinceEpoch = Math.max(0, daysBetween(GROW_EPOCH, today)) + 1;  // 今日の分も入れる
  for (const m of team.members) {
    const a = anchors[unitKeyOf(m)];
    const total = sumStats(m.stats, keys);
    if (!a) {
      const grow = DAILY_GROWTH_CAP * sinceEpoch;
      for (const k of keys) if (m.stats[k] > INITIAL_STAT_CAP[k] + grow) out.push({ slot: m.slot, what: 'stat', key: k });
      if (total > INITIAL_TOTAL_CAP + grow) out.push({ slot: m.slot, what: 'total' });
    } else {
      const grow = DAILY_GROWTH_CAP * (Math.max(0, daysBetween(a.first_day, today)) + 1);
      for (const k of keys) {
        const base = Number(a.first_stats && a.first_stats[k]) || 0;
        if (m.stats[k] > base + grow) out.push({ slot: m.slot, what: 'stat', key: k });
      }
      if (total > a.first_total + grow) out.push({ slot: m.slot, what: 'total' });
      // Lv はいまは迎えたときに決まって上がらない。上がる形になっても1日1つまで
      if (m.lv > a.first_lv + Math.max(0, daysBetween(a.first_day, today))) out.push({ slot: m.slot, what: 'lv' });
    }
  }
  const tFirst = entry ? entry.tactics_first : null;
  const tDay = entry ? entry.tactics_day : null;
  const tCap = tFirst == null
    ? TACTICS_INITIAL_CAP + TACTICS_DAILY_CAP * sinceEpoch
    : tFirst + TACTICS_DAILY_CAP * (Math.max(0, daysBetween(tDay, today)) + 1);
  if (team.tactics > Math.min(100, tCap)) out.push({ what: 'tactics' });
  return out;
};

// 公平の区分: 1体ごとに6能力の合計を FAIR_TOTAL にそろえる(比はそのまま・余りは大きい端数から1ずつ)。Lv も FAIR_LV に
export const fairUnit = (u, keys) => {
  const total = sumStats(u.stats, keys);
  const w = keys.map((k) => (total > 0 ? u.stats[k] / total : 1 / keys.length));
  const exact = w.map((x) => x * FAIR_TOTAL);
  const base = exact.map((x) => Math.min(STAT_ABS_MAX, Math.floor(x)));
  let left = FAIR_TOTAL - base.reduce((a, b) => a + b, 0);
  const order = keys.map((_, i) => i).sort((i, j) => (exact[j] - Math.floor(exact[j])) - (exact[i] - Math.floor(exact[i])) || i - j);
  for (let n = 0; left > 0 && n < order.length * 4; n++) {
    const i = order[n % order.length];
    if (base[i] < STAT_ABS_MAX) { base[i]++; left--; }
  }
  const stats = {};
  keys.forEach((k, i) => { stats[k] = base[i]; });
  // 覚えた技と熟練はそのまま(育てた戦い方で勝負)。能力と Lv だけそろえる
  return { species: u.species, name: u.name, lv: FAIR_LV, stats, techs: u.techs, mastery: u.mastery };
};

// 計算に渡す編成(区分と体数で作る)。登録の team はそのまま変えない
export const battleTeam = ({ assistantId, team, division, size, engine }) => {
  const list = team.members.slice(0, size).map((m) => ({ species: m.species, name: m.name, lv: m.lv, stats: { ...m.stats },
    techs: Array.isArray(m.techs) ? [...m.techs] : undefined, mastery: m.mastery ? { ...m.mastery } : undefined }));
  return {
    assistantId,
    tactics: team.tactics,
    members: division === 'fair' ? list.map((u) => fairUnit(u, engine.STAT_KEYS)) : list,
  };
};

const fail = (status, error, extra = {}) => ({ status, json: { ok: false, error, ...extra } });
const okRes = (json) => ({ status: 200, json: { ok: true, ...json } });

const ownerOk = async (db, owner, key) => {
  if (typeof owner !== 'string' || !OWNER_RE.test(owner)) return 'bad';
  if (typeof key !== 'string') return 'bad';
  return db.ownerCheck(owner, key);
};

const doRegister = async ({ body, db, engine, catalog, learn, nowMs, log }) => {
  const { owner, key, assistant } = body;
  if (typeof assistant !== 'string' || !ASSISTANT_RE.test(assistant) || !engine.STYLES[assistant]) return fail(400, 'assistant');
  const parsed = parseTeam(body.team, engine, catalog, learn);
  if (parsed.error) return fail(400, 'team', { detail: parsed.error });
  const who = await ownerOk(db, owner, key);
  if (who === 'bad') return fail(400, 'owner');
  if (who === 'locked') return fail(403, 'locked');
  const today = dayOf(nowMs);
  const team = parsed.team;
  const entry = await db.getEntry(owner, assistant);
  const anchors = await db.getAnchors(owner, assistant, team.members.map(unitKeyOf));
  const problems = capProblems({ team, anchors, entry, today, engine });
  if (problems.length) {
    log({ step: 'register', result: 'over_cap', n: problems.length });
    return fail(422, 'over_cap', { problems });
  }
  const fresh = team.members.filter((m) => !anchors[unitKeyOf(m)]).map((m) => ({
    owner_id: owner, assistant_id: assistant, unit_key: unitKeyOf(m), first_day: today,
    first_stats: m.stats, first_total: sumStats(m.stats, engine.STAT_KEYS), first_lv: m.lv,
  }));
  if (fresh.length) await db.insertAnchors(fresh);
  const total = team.members.reduce((t, m) => t + sumStats(m.stats, engine.STAT_KEYS), 0);
  await db.upsertEntry({
    owner_id: owner, assistant_id: assistant,
    user_name: typeof body.name === 'string' ? body.name.slice(0, 40) : '',
    icon: typeof body.icon === 'string' ? body.icon.slice(0, 64) : null,
    team, team_total: total,
    // 戦術経験の基準は初めの登録のときだけ決める
    tactics_first: entry ? entry.tactics_first : team.tactics,
    tactics_day: entry ? entry.tactics_day : today,
  });
  log({ step: 'register', result: 'ok', members: team.members.length, anchors: fresh.length });
  return okRes({ status: 'ok' });
};

const doUnregister = async ({ body, db, log }) => {
  const { owner, key, assistant } = body;
  if (typeof assistant !== 'string' || !ASSISTANT_RE.test(assistant)) return fail(400, 'assistant');
  const who = await ownerOk(db, owner, key);
  if (who === 'bad') return fail(400, 'owner');
  if (who === 'locked') return fail(403, 'locked');
  await db.deactivate(owner, assistant);
  log({ step: 'unregister' });
  return okRes({ status: 'ok' });
};

const doChallenge = async ({ body, db, engine, catalog, newSeed, log, limits, balance }) => {
  const { owner, key, assistant, opp_owner: oppOwner, opp_assistant: oppAssistant } = body;
  const division = body.division;
  const size = body.size == null ? 3 : body.size;
  if (!DIVISIONS.includes(division)) return fail(400, 'division');
  if (!isInt(size) || size < TEAM_MIN || size > TEAM_MAX) return fail(400, 'size');
  if (typeof assistant !== 'string' || !ASSISTANT_RE.test(assistant)) return fail(400, 'assistant');
  if (typeof oppOwner !== 'string' || !OWNER_RE.test(oppOwner) || typeof oppAssistant !== 'string' || !ASSISTANT_RE.test(oppAssistant)) return fail(400, 'opponent');
  if (oppOwner === owner) return fail(400, 'self');
  const who = await ownerOk(db, owner, key);
  if (who === 'bad') return fail(400, 'owner');
  if (who === 'locked') return fail(403, 'locked');
  if (!(await db.areFriends(owner, oppOwner))) return fail(403, 'not_friend');
  const mine = await db.getEntry(owner, assistant);
  const theirs = await db.getEntry(oppOwner, oppAssistant);
  if (!mine || !mine.active) return fail(409, 'no_entry');
  if (!theirs || !theirs.active) return fail(404, 'no_opponent');
  if (mine.team.members.length < size || theirs.team.members.length < size) return fail(409, 'size_short');
  const took = await db.take(owner, limits.challengeDaily);
  if (!took || !took.ok) return fail(429, 'limit', { remaining: 0 });
  const teamA = battleTeam({ assistantId: assistant, team: mine.team, division, size, engine });
  const teamB = battleTeam({ assistantId: oppAssistant, team: theirs.team, division, size, engine });
  const seed = newSeed();
  let r;
  try {
    r = engine.simulate({ seed, catalog, teamA, teamB, balance });
  } catch (e) {
    await db.refund(owner).catch(() => {});
    log({ step: 'challenge', result: 'engine_error' });
    return fail(500, 'engine');
  }
  const rec = await db.record({
    p_division: division, p_size: size,
    p_a_owner: owner, p_a_assistant: assistant, p_a_name: mine.user_name, p_a_icon: mine.icon,
    p_b_owner: oppOwner, p_b_assistant: oppAssistant, p_b_name: theirs.user_name, p_b_icon: theirs.icon,
    p_seed: seed, p_engine_version: r.version, p_tech_version: Number(catalog.techVersion) || 0, p_balance: r.balance || balance,
    p_team_a: teamA, p_team_b: teamB,
    p_winner: r.winner, p_reason: r.reason, p_rounds: r.rounds, p_digest: r.digest,
    p_pair_limit: limits.pairRated, p_k: ELO_K,
  });
  log({ step: 'challenge', result: 'ok', division, size, rated: !!(rec && rec.rated), rounds: r.rounds });
  // 端末へは「同じ計算で見返すのに要るもの」と結果を返す。端末は同じ種・同じ編成で simulate し、digest が合うかを見る
  return okRes({
    match: {
      id: rec && rec.id, division, size, rated: !!(rec && rec.rated), seed, version: r.version, techVersion: catalog.techVersion, balance: r.balance || balance,
      teamA, teamB, winner: r.winner, reason: r.reason, rounds: r.rounds, digest: r.digest,
      a: rec && rec.a, b: rec && rec.b, remaining: took.remaining,
    },
  });
};

export const handle = async ({ body, db, engine, catalog, learn = {}, nowMs, newSeed, log = (_entry) => {}, limits = {} }) => {
  const lim = { challengeDaily: limits.challengeDaily ?? CHALLENGE_DAILY_LIMIT, pairRated: limits.pairRated ?? PAIR_RATED_DAILY_LIMIT };
  const balance = ['A', 'B', 'C'].includes(limits.balance) ? limits.balance : BALANCE;
  if (!body || typeof body !== 'object') return fail(400, 'bad_request');
  try {
    switch (body.action) {
      case 'register': return await doRegister({ body, db, engine, catalog, learn, nowMs, log });
      case 'unregister': return await doUnregister({ body, db, log });
      case 'challenge': return await doChallenge({ body, db, engine, catalog, nowMs, newSeed, log, limits: lim, balance });
      default: return fail(400, 'action');
    }
  } catch (e) {
    log({ step: 'error', action: String(body.action).slice(0, 16), error: String(e && e.message || e).slice(0, 40) });
    return fail(500, 'server');
  }
};

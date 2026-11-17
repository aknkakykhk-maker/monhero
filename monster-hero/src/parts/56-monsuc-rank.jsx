// ===== モンヒロサクセス 育成完了時の総合力ランキング(2026-11-12 クラフト・設計 docs/progress/player-raise/RANKING.md) =====
// 送る口・読む口・画面(R1 全モンスター / R2 血統別・行を押すと6能力)をここに閉じる。
//   サーバ: supabase/migrations/202611120003_monsuc_rank.sql(表 monsuc_finishes・見え方 monsuc_rank_all / monsuc_rank_lineage・関数 monsuc_rank_submit)
//     技の表示用詳細(技ID・熟練)は 202611170001_monsuc_rank_v5_tech_detail.sql(列 tech_detail・表示専用で総合力には使わない)。未適用でも壊れない作り(下の tech_detail の注記)
//   ★総合力と評価はサーバが出し直す。端末の値は表示の目安だけ
//   ★持ち主の鍵は助手マスモン対戦の鍵(mh_masmon_pvp_owner_key_v1)をそのまま使う(56-assistant-masmon-pvp.jsx の masmonPvpSelf)
//   保存(新しいキーだけ・CLAUDE.md ⑦):
//     mh_monsuc_rank_sent_v1  … 送れた育成の id の一覧(新しい50件)。二重に送らない印
//     mh_monsuc_rank_queue_v1 … 送れなかった1件ずつの中身(5件まで)。昔の送り直しの列(消さない。pending へ写す移行の元)
//     mh_monsuc_rank_pending_v1 … 登録待ち。送る前に必ずここへ書くので、鍵が取れない・通信が落ちる・アプリを閉じても残る。run_id は送る瞬間に作る
//     mh_monsuc_rank_pending_migrated_v1 … queue_v1 から pending_v1 へ写す一度きりの移行が済んだ印
//   送らないもの: デビュー戦のゲームオーバー・まだ終わっていない育成・デバッグで進めた育成
//   公開の印: RELEASE_FLAGS.monheroSuccess(モンヒロサクセス本体と同じ印)が真のときだけ通信する
// 引退の画面からは  typeof monsucRankSubmit === 'function' && monsucRankSubmit({ run, ev, name, colors, debug })  で呼ぶ(待たなくてよい・落ちない)
const MONSUC_RANK_SENT_KEY = 'mh_monsuc_rank_sent_v1';
const MONSUC_RANK_QUEUE_KEY = 'mh_monsuc_rank_queue_v1';
const MONSUC_RANK_PENDING_KEY = 'mh_monsuc_rank_pending_v1';
const MONSUC_RANK_MIGRATED_KEY = 'mh_monsuc_rank_pending_migrated_v1';
const MONSUC_RANK_PENDING_MAX = 50;
const MONSUC_RANK_SENT_MAX = 50;
const MONSUC_RANK_QUEUE_MAX = 5;
const MONSUC_RANK_TIMEOUT_MS = 12000;
const MONSUC_RANK_LIMIT_ALL = 100;
const MONSUC_RANK_LIMIT_LINEAGE = 50;
const MONSUC_RANK_STAT_KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const MONSUC_RANK_STAT_LABEL = { life: '❤️ライフ', pow: '💪ちから', wise: '🧠かしこさ', hit: '🎯命中', eva: '💨回避', tough: '🛡️丈夫さ' };
const MONSUC_RANK_GRADE_COLOR = { M: '#f472b6', SSS: '#f472b6', SS: '#fb923c', S: '#fbbf24', A: '#f472b6', B: '#a78bfa', C: '#38bdf8', D: '#94a3b8', E: '#94a3b8', F: '#94a3b8', G: '#94a3b8' };
const MONSUC_RANK_REASON_TEXT = Object.freeze({
  off: 'ランキングは準備中です',
  network: 'つながりませんでした。次に開いたときにもう一度送ります',
  busy: '少し待ってから送り直します',
  bad: 'この記録はランキングに載せられませんでした',
  locked: 'この端末ではランキングに送れません',
  over_cap: 'この記録はランキングに載せられませんでした',
  skip: 'この育成はランキングの対象外です',
  no_id: 'この端末ではまだ送れません',
});
const monsucRankReasonText = (reason) => MONSUC_RANK_REASON_TEXT[reason] || MONSUC_RANK_REASON_TEXT.network;
const monsucRankOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.monheroSuccess === true;
const monsucRankNum = (v, d = 0) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
const monsucRankClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const monsucRankLineageOf = (species) => {
  const m = typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP[species] : null;
  return m && typeof m.main === 'string' ? m.main : 'unknown';
};
const monsucRankLineageName = (id) => {
  const l = typeof MONSTER_LINEAGES !== 'undefined' && MONSTER_LINEAGES ? MONSTER_LINEAGES[id] : null;
  return l && l.name ? l.name : '？？？';
};
// 計算の芯(data/monhero-success.js)の版。読み込まれていなければ 1
const monsucRankEngineVersion = () => { const S = typeof globalThis !== 'undefined' && globalThis ? globalThis['MONHERO_SUCCESS'] : null; return S && Number.isInteger(S.VERSION) ? S.VERSION : 1; };
// ALL_PLAYER_MONSTERS は種族名をキーにしたオブジェクト(data/ally-monsters.js)
const monsucRankMonOf = (species) => {
  if (typeof species !== 'string' || typeof ALL_PLAYER_MONSTERS === 'undefined' || !ALL_PLAYER_MONSTERS || typeof ALL_PLAYER_MONSTERS !== 'object') return null;
  const m = Object.prototype.hasOwnProperty.call(ALL_PLAYER_MONSTERS, species) ? ALL_PLAYER_MONSTERS[species] : null;
  return m && typeof m === 'object' ? m : null;
};
// 染めた色は「部位ごとの色の id の配列」(DyedMonsterImage の masuColors の形)だけ通す。ほかの人の行はだれでも入れられるので、読む側でも必ず整える
const monsucRankDyeOf = (dye) => (Array.isArray(dye) ? dye.slice(0, 6).map(c => (typeof c === 'string' && c.length <= 40 ? c : null)) : null);
// 技の表示用詳細([{ id: 技ID, m: 熟練 0〜100 }])を整える。送る側・読む側の両方で使う(ほかの人の行はだれでも入れられるので、読む側でも必ず整える)
//   ★表示専用。総合力の出し直しは今までどおり techs({ r, a })だけで、こちらは一切使わない(改ざん対策の設計を壊さない)
//   ★サーバ未適用(v5 の SQL を流す前)でも壊れない: 送る分はサーバが知らない項目として捨てられるだけ、読む分は付いていなければ null(詳細は段1表示に倒す)
const monsucRankTechDetailOf = (v) => {
  if (!Array.isArray(v)) return null;
  const out = []; const seen = new Set();
  for (const e of v.slice(0, 99)) {
    if (!e || typeof e !== 'object') continue;
    const id = typeof e.id === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(e.id) ? e.id : null;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, m: monsucRankClamp(Math.round(monsucRankNum(e.m)), 0, 100) });
  }
  return out.length ? out : null;
};
// 育成の id(英数字だけ・6〜32字)。計算の芯の s.id をもとに作り、持ち主の番号を前に付ける
const monsucRankTailOf = (rawId) => {
  let tail = String(rawId === undefined || rawId === null ? '' : rawId).replace(/[^A-Za-z0-9]/g, '').slice(-32);
  if (tail.length < 6) tail = (tail + '000000').slice(0, 6);
  return tail;
};
const monsucRankRunId = (owner, rawId) => `${owner}-${monsucRankTailOf(rawId)}`;
// 送れた印(持ち主の番号つきの id の一覧)に、その育成が入っているか。登録待ちは持ち主が決まる前に書くので、本体(tail)で付き合わせる
const monsucRankSentHas = (sentList, rawId) => { const t = monsucRankTailOf(rawId); return sentList.some(id => typeof id === 'string' && id.endsWith(`-${t}`)); };

// ---- 保存(新しいキーだけ。無い・壊れている → 空) ----
const monsucRankSentList = async () => {
  try { const v = await storeGet(MONSUC_RANK_SENT_KEY, [], false); return Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(-MONSUC_RANK_SENT_MAX) : []; } catch (_) { return []; }
};
const monsucRankMarkSent = async (runId) => {
  const list = await monsucRankSentList();
  if (list.includes(runId)) return;
  try { await storeSet(MONSUC_RANK_SENT_KEY, list.concat([runId]).slice(-MONSUC_RANK_SENT_MAX), false); } catch (_) {}
};
const monsucRankQueue = async () => {
  try {
    const v = await storeGet(MONSUC_RANK_QUEUE_KEY, [], false);
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && typeof x.run_id === 'string').slice(-MONSUC_RANK_QUEUE_MAX) : [];
  } catch (_) { return []; }
};
const monsucRankQueueSave = async (list) => { try { await storeSet(MONSUC_RANK_QUEUE_KEY, list.slice(-MONSUC_RANK_QUEUE_MAX), false); } catch (_) {} };

// ---- 登録待ち(送る前に必ず書く。鍵・IDが取れなくても、通信が落ちても、アプリを閉じても残る) ----
// 1件 = 送る中身(rowOf の形) + raw_id(育成の id そのもの)。run_id は持ち主が決まる送る瞬間に作るので、移行で来た分以外は null
const monsucRankPendingList = async () => {
  try {
    const v = await storeGet(MONSUC_RANK_PENDING_KEY, [], false);
    return Array.isArray(v) ? v.filter(x => x && typeof x === 'object' && typeof x.raw_id === 'string').slice(-MONSUC_RANK_PENDING_MAX) : [];
  } catch (_) { return []; }
};
const monsucRankPendingSave = async (list) => { try { await storeSet(MONSUC_RANK_PENDING_KEY, list.slice(-MONSUC_RANK_PENDING_MAX), false); } catch (_) {} };
const monsucRankPendingDrop = async (rawId) => {
  const t = monsucRankTailOf(rawId);
  const list = await monsucRankPendingList();
  const next = list.filter(x => monsucRankTailOf(x.raw_id) !== t);
  if (next.length !== list.length) await monsucRankPendingSave(next);
};
// 一度きりの移行: 昔の送り直しの列(queue_v1)を登録待ちへ写す。queue_v1 は消さない
let monsucRankMigratedCache = false;
const monsucRankMigrate = async () => {
  if (monsucRankMigratedCache) return;
  monsucRankMigratedCache = true;
  try {
    if (await storeGet(MONSUC_RANK_MIGRATED_KEY, false, false)) return;
    const queue = await monsucRankQueue();
    if (queue.length) {
      const sent = await monsucRankSentList();
      const pending = await monsucRankPendingList();
      const have = new Set(pending.map(x => monsucRankTailOf(x.raw_id)));
      for (const q of queue) {
        const tail = q.run_id.slice(q.run_id.lastIndexOf('-') + 1); // run_id は「持ち主-tail」。tail が育成の id の本体
        if (sent.includes(q.run_id) || have.has(tail)) continue;
        pending.push({ ...q, raw_id: tail });
        have.add(tail);
      }
      await monsucRankPendingSave(pending);
    }
    await storeSet(MONSUC_RANK_MIGRATED_KEY, true, false);
  } catch (_) {}
};
// 登録待ちの件数(ランキング画面の上に出す)
const monsucRankPendingCount = async () => { await monsucRankMigrate(); return (await monsucRankPendingList()).length; };
// 保存枠の詳細に出す、その子の登録の状態。'sent' 登録済み / 'pending' 登録待ち / null 対象外・まだ
const monsucRankStatusOf = async (rawId) => {
  if (monsucRankSentHas(await monsucRankSentList(), rawId)) return 'sent';
  await monsucRankMigrate();
  const t = monsucRankTailOf(rawId);
  return (await monsucRankPendingList()).some(x => monsucRankTailOf(x.raw_id) === t) ? 'pending' : null;
};

// 送る中身(サーバの monsuc_rank_submit の p_row の形)。送らない育成は null
const MONSUC_RANK_APT = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'S+', 'SS', 'SS+', 'M']; // 間合い適性の段(サーバの式と同じ並び)
const monsucRankRowOf = ({ owner, run, ev, name, colors, userName }) => {
  if (!run || typeof run !== 'object') return null;
  if (!['done', 'lost'].includes(run.over) && run.retired !== true) return null; // まだ終わっていない・デビュー戦のゲームオーバーは送らない
  if (run.over === 'gameover') return null;
  const st = run.stats && typeof run.stats === 'object' ? run.stats : {};
  const stats = {};
  MONSUC_RANK_STAT_KEYS.forEach(k => { stats[k] = monsucRankClamp(Math.round(monsucRankNum(st[k])), 0, 99999); }); // 能力の上限アップ(r1115-103): 999 を超えた分も送る(サーバ monsuc_rank_submit も 99,999 まで受ける)
  // 技(2026-11-13 社長): 技ごとに { r: ランク 1〜5, a: 届く間合いのいちばん高い適性の段 }。サーバが同じ式で総合力を出し直す(MONSUC_RANK_V2_TECHS.sql)。
  //   芯の evaluate が techRows を返さない古い形なら、今までどおり熟練の並び(8つまで)
  const rows = ev && Array.isArray(ev.techRows) ? ev.techRows : null;
  const techs = rows
    ? rows.slice(0, 99).map(x => ({ r: monsucRankClamp(Math.round(monsucRankNum(x && x.r, 1)), 1, 5), a: MONSUC_RANK_APT.includes(x && x.a) ? x.a : 'C' }))
    : (Array.isArray(run.techs) ? run.techs : []).slice(0, 8).map(t => monsucRankClamp(Math.round(monsucRankNum(run.mastery && run.mastery[t])), 0, 100));
  const species = typeof run.species === 'string' && /^[A-Za-z]{2,32}$/.test(run.species) ? run.species : null;
  if (!species) return null;
  const e = ev && typeof ev === 'object' ? ev : {};
  const dyeOk = monsucRankDyeOf(colors) || [];
  // 表示専用の技の詳細(覚えた技の ID と熟練)。techs({ r, a })とは分けて送る(サーバの総合力の出し直しには使わない・v5 の SQL が要る)
  const tech_detail = monsucRankTechDetailOf((Array.isArray(run.techs) ? run.techs : []).map(id => ({ id, m: run.mastery && run.mastery[id] })));
  return {
    run_id: monsucRankRunId(owner, run.id),
    user_name: String(userName || '').slice(0, 40),
    child_name: String(name || '').slice(0, 24),
    species, lineage: monsucRankLineageOf(species), dye: dyeOk, stats, techs, tech_detail,
    lv: monsucRankClamp(Math.round(monsucRankNum(e.lv !== undefined ? e.lv : run.lv, 1)), 1, 99),
    loyal: monsucRankClamp(Math.round(monsucRankNum(e.loyal)), 0, 100),
    pop: monsucRankClamp(Math.round(monsucRankNum(e.pop !== undefined ? e.pop : run.pop)), 0, 100),
    engine_version: monsucRankEngineVersion(),
  };
};

// サーバの関数を呼ぶ。落ちない(失敗は { ok:false, reason })
const monsucRankPost = async (owner, key, row) => {
  const ac = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), MONSUC_RANK_TIMEOUT_MS) : null;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/monsuc_rank_submit`, {
      method: 'POST', headers: SB_HEADERS, body: JSON.stringify({ p_owner: owner, p_key: key, p_row: row }), signal: ac ? ac.signal : undefined,
    });
    if (!r.ok) return { ok: false, reason: 'network' };
    let j = null;
    try { j = await r.json(); } catch (_) { j = null; }
    if (!j || typeof j !== 'object') return { ok: false, reason: 'network' };
    return j;
  } catch (_) {
    return { ok: false, reason: 'network' };
  } finally { if (timer) clearTimeout(timer); }
};
// サーバへ送る中身は決まった項目だけ(登録待ちに付いた印などは送らない)
const MONSUC_RANK_ROW_KEYS = ['run_id', 'user_name', 'child_name', 'species', 'lineage', 'dye', 'stats', 'techs', 'tech_detail', 'lv', 'loyal', 'pop', 'engine_version'];
const monsucRankCleanRow = (e) => { const r = {}; for (const k of MONSUC_RANK_ROW_KEYS) r[k] = e[k]; return r; };
// 登録待ちの1件を送る。run_id がまだ無ければ、いまの持ち主で作る(送る瞬間に作るのが決めごと)
//   送れたら: 送れた印を付けて登録待ちから外す。形・上限・鍵で断られたものは送り直しても通らないので外す。電波・混雑は残す
const monsucRankSendPending = async (me, entry) => {
  const row = monsucRankCleanRow(entry);
  if (!row.run_id) row.run_id = monsucRankRunId(me.owner, entry.raw_id);
  const r = await monsucRankPost(me.owner, me.key, row);
  if (r.ok) {
    await monsucRankMarkSent(row.run_id);
    await monsucRankPendingDrop(entry.raw_id);
    return { ok: true, power: r.power, grade: r.grade, placeAll: r.place_all || null, placeLineage: r.place_lineage || null, lineage: row.lineage };
  }
  if (['bad', 'over_cap', 'locked'].includes(r.reason)) await monsucRankPendingDrop(entry.raw_id);
  return { ok: false, reason: r.reason || 'network' };
};
const monsucRankUserName = async () => { try { return String((await storeGet('mh_breeder_name', '', false)) || ''); } catch (_) { return ''; } };

// 引退して育成が完了したとき1回だけ呼ぶ。run = 計算の芯の状態 s・ev = SUC.evaluate(s)・name = 育てた子の名前・colors = 染めた色・debug = デバッグで進めた育成なら真
//   返り値 { ok, placeAll, placeLineage, lineage, power, grade } か { ok:false, reason, pending }。pending が真なら登録待ちに残っている
const monsucRankSubmit = async ({ run, ev, name, colors, debug } = {}) => {
  try {
    if (!monsucRankOn()) return { ok: false, reason: 'off' };
    if (debug) return { ok: false, reason: 'skip' };
    // 送る中身は持ち主が分からなくても作れる(run_id だけ送る瞬間に作る)
    const draft = monsucRankRowOf({ owner: '', run, ev, name, colors, userName: await monsucRankUserName() });
    if (!draft) return { ok: false, reason: 'skip' };
    await monsucRankMigrate();
    const rawId = String(run.id);
    if (monsucRankSentHas(await monsucRankSentList(), rawId)) return { ok: false, reason: 'skip' }; // もう送った
    // ★送る前に必ず登録待ちへ書く。鍵が取れない・通信が落ちても、ここに残っていれば あとで送り直せる
    const pending = await monsucRankPendingList();
    let entry = pending.find(x => monsucRankTailOf(x.raw_id) === monsucRankTailOf(rawId));
    if (!entry) {
      entry = { ...draft, run_id: null, raw_id: rawId };
      await monsucRankPendingSave(pending.concat([entry]));
    }
    const me = typeof masmonPvpSelf === 'function' ? await masmonPvpSelf(true) : null;
    if (!me) return { ok: false, reason: 'no_id', pending: true };
    if (entry.run_id && !entry.run_id.startsWith(`${me.owner}-`)) return { ok: false, reason: 'no_id', pending: true }; // 別の持ち主の保留は送らない(消しもしない)
    const r = await monsucRankSendPending(me, entry);
    return r.ok ? r : { ...r, pending: !['bad', 'over_cap', 'locked'].includes(r.reason) };
  } catch (_) { return { ok: false, reason: 'network', pending: true }; }
};
// 登録待ちを1件だけ送り直す(サーバは1分に1回まで。モンサクを開いたとき・引退の結果・ランキング画面で呼ぶ。待たない・落ちない)
const monsucRankFlush = async () => {
  try {
    if (!monsucRankOn()) return { ok: false, reason: 'off' };
    await monsucRankMigrate();
    let pending = await monsucRankPendingList();
    if (pending.length === 0) return { ok: true, left: 0 };
    const sent = await monsucRankSentList();
    const rest = pending.filter(x => !(x.run_id && sent.includes(x.run_id)) && !monsucRankSentHas(sent, x.raw_id));
    if (rest.length !== pending.length) { await monsucRankPendingSave(rest); pending = rest; }
    if (pending.length === 0) return { ok: true, left: 0 };
    const me = typeof masmonPvpSelf === 'function' ? await masmonPvpSelf(true) : null; // 鍵の無い端末でも、送り直すときに鍵を作る
    if (!me) return { ok: false, reason: 'no_id', left: pending.length };
    // 持ち主の違う保留は消さず、印(held)を付けて飛ばす
    let target = null; let marked = false;
    for (const e of pending) {
      if (e.run_id && !e.run_id.startsWith(`${me.owner}-`)) { if (!e.held) { e.held = true; marked = true; } continue; }
      target = e; break;
    }
    if (marked) await monsucRankPendingSave(pending);
    if (!target) return { ok: false, reason: 'no_id', left: pending.length };
    const r = await monsucRankSendPending(me, target);
    return { ...r, left: (await monsucRankPendingList()).length };
  } catch (_) { return { ok: false, reason: 'network' }; }
};

// ---- 読む(読むだけ)。失敗は null ----
// 完全版の列(忠誠・人気・技の並び・技の表示用詳細)は v5 の SQL の見え方にだけある。未適用の間はこの読み方が失敗するので、
//   そのときは今までの列だけで読み直す(サーバ未適用でもランキング自体は壊れない・詳細は段1表示に倒れる)
const MONSUC_RANK_COLS = 'run_id,user_name,child_name,species,lineage,dye,stats,tech_count,lv,power,grade,place,loyal,pop,techs,tech_detail';
const MONSUC_RANK_COLS_LEGACY = 'run_id,user_name,child_name,species,lineage,dye,stats,tech_count,lv,power,grade,place';
const monsucRankGet = async (path, withCount) => {
  try {
    const headers = withCount ? { ...SB_HEADERS, Prefer: 'count=exact' } : SB_HEADERS;
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers, cache: 'no-store' });
    if (!r.ok) return null;
    const rows = await r.json();
    if (!Array.isArray(rows)) return null;
    let total = null;
    if (withCount) { const m = /\/(\d+)$/.exec(r.headers.get('content-range') || ''); total = m ? Number(m[1]) : null; }
    return { rows, total };
  } catch (_) { return null; }
};
// lineage を渡すと血統別。上位の一覧と自分の順位は分けて読む(2026-11-16 UI改修: 一覧が届き次第出し、自分の順位は後から足す)
const monsucRankViewOf = (lineage) => {
  const lin = typeof lineage === 'string' && /^[A-Za-z_]{1,32}$/.test(lineage) ? lineage : null;
  return { lin, view: lin ? 'monsuc_rank_lineage' : 'monsuc_rank_all', where: lin ? `&lineage=eq.${lin}` : '', limit: lin ? MONSUC_RANK_LIMIT_LINEAGE : MONSUC_RANK_LIMIT_ALL };
};
// 上位の一覧 { rows, total, sent }(失敗は null)
const monsucRankReadTop = async ({ lineage = null } = {}) => {
  const { view, where, limit } = monsucRankViewOf(lineage);
  let top = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS}${where}&order=place.asc,run_id.asc&limit=${limit}`, true);
  if (!top) top = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS_LEGACY}${where}&order=place.asc,run_id.asc&limit=${limit}`, true); // v5 未適用なら今までの列で読み直す
  if (!top) return null;
  const sent = (await monsucRankSentList()).filter(id => /^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$/.test(id));
  return { rows: top.rows, total: top.total, sent };
};
// 自分の順位(自分の子のいちばん上の行。無い・失敗は null)
const monsucRankReadMine = async ({ lineage = null, sent = [] } = {}) => {
  const ids = (Array.isArray(sent) ? sent : []).filter(id => /^[A-Za-z0-9_-]{1,64}-[A-Za-z0-9]{6,32}$/.test(id));
  if (ids.length === 0) return null;
  const { view, where } = monsucRankViewOf(lineage);
  let m = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS}${where}&run_id=in.(${ids.map(encodeURIComponent).join(',')})&order=place.asc&limit=1`, false);
  if (!m) m = await monsucRankGet(`${view}?select=${MONSUC_RANK_COLS_LEGACY}${where}&run_id=in.(${ids.map(encodeURIComponent).join(',')})&order=place.asc&limit=1`, false); // v5 未適用なら今までの列で読み直す
  return m && m.rows[0] ? m.rows[0] : null;
};
// { rows, total, mine, sent }(従来のまとめ読み)
const monsucRankRead = async ({ lineage = null } = {}) => {
  const top = await monsucRankReadTop({ lineage });
  if (!top) return null;
  const mine = await monsucRankReadMine({ lineage, sent: top.sent });
  return { rows: top.rows, total: top.total, mine, sent: top.sent };
};

// ---- 画面 ----
function MonsucRankMonImg({ species, dye, size = 36 }) {
  const mon = monsucRankMonOf(species);
  if (!mon) return <div style={{ width: size, height: size }} className="rounded-lg bg-slate-700/60 flex items-center justify-center text-slate-400 text-xs">？</div>;
  return <div style={{ width: size, height: size }} className="shrink-0 flex items-center justify-center">
    <DyedMonsterImage baseId={mon.id} src={mon.iconUrl || mon.imgUrl} alt={mon.name || ''} masuColors={monsucRankDyeOf(dye)} className="w-full h-full object-contain" draggable={false} />
  </div>;
}
function MonsucRankGrade({ grade }) {
  const g = typeof grade === 'string' && /^[A-Z]{1,3}[0-9]{0,3}$/.test(grade) ? grade : 'G'; // 評価は 500 ごとの数字つき(C2・M3 など)。色は字の部分で決める
  const letter = /^M/.test(g) ? 'M' : g.replace(/[0-9]+$/, ''); // M より上(M1・MG・MG3…)は M の色
  return <span className="inline-flex items-center justify-center min-w-[26px] h-[22px] px-1 rounded-md text-[12px] font-black text-slate-900" style={{ background: MONSUC_RANK_GRADE_COLOR[letter] || '#94a3b8' }}>{g}</span>;
}
function MonsucRankStats({ stats }) {
  const st = stats && typeof stats === 'object' ? stats : {};
  return <div className="grid grid-cols-6 gap-1 mt-2">
    {MONSUC_RANK_STAT_KEYS.map(k => <div key={k} className="rounded-md bg-slate-950/60 py-1 text-center">
      <div className="text-[9px] text-slate-300 whitespace-nowrap">{MONSUC_RANK_STAT_LABEL[k]}</div>
      <div className="text-[13px] font-black text-white">{Math.round(monsucRankNum(st[k]))}</div>
    </div>)}
  </div>;
}
function MonsucRankRow({ row, onOpen, mine, pinned }) {
  const top = row.place <= 3;
  const cls = pinned ? 'border-pink-400/80 bg-pink-900/40' : mine ? 'border-pink-400/60 bg-slate-800/80' : 'border-slate-600/60 bg-slate-800/70';
  return <button type="button" onClick={onOpen} className={`w-full text-left rounded-xl border px-3 py-2 ${cls}`}>
    <div className="flex items-center gap-2">
      <div className={`w-8 text-center font-black ${top ? 'text-yellow-300 text-lg' : 'text-slate-200 text-base'}`}>{row.place}</div>
      <MonsucRankMonImg species={row.species} dye={row.dye} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-black text-white truncate">{row.child_name || (monsucRankMonOf(row.species) || {}).name || '？？？'}</div>
        <div className="text-[10px] text-slate-300 truncate">育てた人: {pinned ? 'あなた' : (row.user_name || 'ななしのブリーダー')}</div>
      </div>
      <MonsucRankGrade grade={row.grade} />
      <div className="w-[64px] text-right text-[15px] font-black text-yellow-300">{Math.round(monsucRankNum(row.power)).toLocaleString()}</div>
    </div>
  </button>;
}
// ---- モンスター詳細(2026-11-17 作業H: 自分側と同じ詳細 MsxMonDetail ベースに作り替え): 一覧の行から開く。登録済みの育成完了データだけから出す ----
//   技ID・熟練が保存されている登録(v5 以後の登録分)は技グリッドまで完全表示。それ以外は段1表示(基礎/特徴/適性は種族の素の性質+保存済みの数値、
//   技は習得技数と { ランク, 適性 } の内訳まで。技の名前・熟練は保存が無いので出せない旨を育成情報に出す)
//   芯(SUC)や MsxMonDetail が引けないときは、今までの簡易表示に倒す(落とさない)
// ヘッダーと戻る位置は一覧とそろえ、「一覧へ」で元のタブ・スクロール位置に戻る(呼ぶ側が状態を保つ)
const monsucRankSuc = () => { try { return typeof msxSuc !== 'undefined' && msxSuc && msxSuc.SUC ? msxSuc.SUC : null; } catch (_) { return null; } };
function MonsucRankDetail({ row, pinned, onBack }) {
  const mon = monsucRankMonOf(row.species) || {};
  const [, setSucTick] = React.useState(0);
  React.useEffect(() => {
    if (monsucRankSuc() || typeof msxLoad !== 'function') return undefined;
    let alive = true;
    msxLoad().then(() => { if (alive) setSucTick(1); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const SUC = monsucRankSuc();
  if (SUC && typeof MsxMonDetail === 'function') {
    try {
      const detail = monsucRankTechDetailOf(row.tech_detail);
      const known = detail ? detail.map(d => d.id) : null;
      const mastery = detail ? Object.fromEntries(detail.map(d => [d.id, d.m])) : null;
      // 適性・伸びどき・成長の型は保存が無いので、種族の素の性質を仮の育成から聞く(保存しない・総合力は行の値を使う)
      let grades = null; let peak = ''; let type = null;
      const peek = typeof SUC.newRun === 'function' ? SUC.newRun({ id: 'peek', species: row.species }) : null;
      if (peek && typeof SUC.aptGradesOf === 'function') grades = SUC.aptGradesOf(peek);
      if (peek && typeof SUC.peakInfo === 'function' && typeof SUC.periodOf === 'function') {
        const pk = SUC.peakInfo(peek);
        if (pk && Number.isInteger(pk.from) && Number.isInteger(pk.to)) { const a = SUC.periodOf(pk.from).name; const b = SUC.periodOf(pk.to).name; peak = a === b ? a : `${a}〜${b}`; }
      }
      if (typeof SUC.speciesType === 'function') type = SUC.speciesType(row.species);
      const apt = typeof msxAptOf === 'function' ? msxAptOf(row.species) : ['C', 'C', 'C', 'C', 'C', 'C'];
      const info = [
        ['順位', `${Math.round(monsucRankNum(row.place))}位`],
        ['育てた人', pinned ? 'あなた' : (row.user_name || 'ななしのブリーダー')],
        ['Lv', String(Math.round(monsucRankNum(row.lv)))],
        ...(row.loyal != null ? [['忠誠度', String(Math.round(monsucRankNum(row.loyal)))]] : []),
        ...(row.pop != null ? [['人気', String(Math.round(monsucRankNum(row.pop)))]] : []),
        ['習得技数', String(Math.round(monsucRankNum(row.tech_count, detail ? detail.length : 0)))],
      ];
      if (!detail) {
        if (Array.isArray(row.techs) && row.techs.length) info.push(['技の内訳(ランク・適性)', row.techs.slice(0, 99).map(t => (t && typeof t === 'object' ? `ランク${monsucRankClamp(Math.round(monsucRankNum(t.r, 1)), 1, 5)}(${MONSUC_RANK_APT.includes(t.a) ? t.a : 'C'})` : `熟練${monsucRankClamp(Math.round(monsucRankNum(t)), 0, 100)}`)).join('・')]);
        info.push(['技の名前と熟練', 'この登録には技の名前が保存されていないため、出せません(新しい登録から出ます)']);
      }
      const art = mon.id ? <DyedMonsterImage baseId={mon.id} src={mon.iconUrl || mon.imgUrl} alt="" masuColors={monsucRankDyeOf(row.dye)} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : undefined;
      // MsxMonDetail の見た目(MSX_CSS)は .msx の中だけに効く決まりで、ランキング画面は Tailwind 組みのため
      // .msx の外に置かれている(56-monhero-success-main.jsx の注記)。詳細だけは .msx の入れ物で包んで、
      // はじめる画面・マスモンボックス・ベースモンと同じ表示にする(2026-11-17 実機で文字が暗色に沈み技の升が重なる崩れの修正)
      return <div className="msx" data-monsuc-rank-detail><MsxMonDetail species={row.species} name={row.child_name || mon.name || '？？？'} art={art} st={row.stats || {}} apt={apt} type={type} peak={peak} grades={grades}
        known={known} mastery={mastery} power={Math.round(monsucRankNum(row.power))} grade={row.grade || null}
        sub={`${mon.name || row.species}・${monsucRankLineageName(row.lineage)}系・Lv ${Math.round(monsucRankNum(row.lv))}`} info={info} onClose={onBack} SUC={SUC} /></div>;
    } catch (_) { /* 作れなければ簡易表示に倒す */ }
  }
  return <div className="fixed inset-0 z-[60] flex flex-col text-white" style={{ background: 'linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%)', paddingTop: 'var(--mh-sa-top)', paddingBottom: 'var(--mh-sa-bottom)' }}>
    <div className="flex items-center gap-2 px-3 pt-3">
      <button type="button" onClick={onBack} className="rounded-full bg-slate-700/80 px-3 py-1 text-[12px] font-bold">← 一覧へ</button>
      <div className="text-[13px] font-black text-pink-300">🌱 モンヒロサクセス</div>
    </div>
    <div className="px-3 pt-2">
      <div className="text-[18px] font-black">🏆 モンスター詳細</div>
    </div>
    <div className="flex-1 overflow-y-auto px-3 py-3">
      <div className="rounded-2xl border border-slate-600/60 bg-slate-800/70 px-4 py-4">
        <div className="flex items-start gap-3">
          <MonsucRankMonImg species={row.species} dye={row.dye} size={92} />
          <div className="flex-1 min-w-0">
            <div className="text-[19px] font-black text-white leading-tight">{row.child_name || mon.name || '？？？'}</div>
            <div className="text-[12px] text-slate-300 mt-0.5">育てた人: {pinned ? 'あなた' : (row.user_name || 'ななしのブリーダー')}</div>
            <div className="text-[12px] text-slate-300">{mon.name || row.species}・{monsucRankLineageName(row.lineage)}系</div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[12px] font-bold text-slate-200">Lv {Math.round(monsucRankNum(row.lv))}</span>
              <MonsucRankGrade grade={row.grade} />
              <span className="text-[12px] font-bold text-slate-200">{row.place}位</span>
            </div>
          </div>
        </div>
        <div className="flex items-baseline gap-2 mt-3">
          <span className="text-[12px] font-bold text-slate-300">総合力</span>
          <span className="text-[24px] font-black text-yellow-300">{Math.round(monsucRankNum(row.power)).toLocaleString()}</span>
        </div>
        <div className="text-[12px] font-bold text-slate-300 mt-3">6能力</div>
        <MonsucRankStats stats={row.stats} />
        <div className="text-[12px] text-slate-200 mt-3">習得技数: <span className="font-black text-white">{Math.round(monsucRankNum(row.tech_count))}</span></div>
        {row.loyal != null && <div className="text-[12px] text-slate-200 mt-1">忠誠度: <span className="font-black text-white">{Math.round(monsucRankNum(row.loyal))}</span> ・ 人気: <span className="font-black text-white">{Math.round(monsucRankNum(row.pop))}</span></div>}
      </div>
    </div>
    <div className="px-3 pb-3 pt-1">
      <button type="button" onClick={onBack} className="w-full rounded-full bg-slate-700/80 py-2 text-[13px] font-bold">← 一覧へ</button>
    </div>
  </div>;
}
// 血統の札(主血統のうち、遊べるモンスターがいるもの)
const monsucRankLineageTabs = () => {
  const map = typeof MONSTER_LINEAGE_MAP !== 'undefined' && MONSTER_LINEAGE_MAP ? MONSTER_LINEAGE_MAP : {};
  const out = [];
  Object.keys(map).forEach(sp => { const l = map[sp] && map[sp].main; if (typeof l === 'string' && l !== 'unknown' && !out.includes(l) && monsucRankMonOf(sp)) out.push(l); });
  return out;
};

// 血統を選ぶ窓。血統は数が増えていくので、横並びの札ではなく共通部品 PickerSheet の一覧(検索つき)から選ぶ
function MonsucRankLineageSheet({ lineages, tab, lineage, q, setQ, onPick, onClose }) {
  const match = (texts) => (typeof msxMatchQ === 'function' ? msxMatchQ(q, ...texts) : !q);
  const allShown = match(['全て', '全モンスター']);
  const shown = lineages.filter((l) => match([`${monsucRankLineageName(l)}系`, monsucRankLineageName(l)]));
  const allSel = tab === 'all';
  return <PickerSheet title="血統を選ぶ" note="血統は 種類のまとまりです。選ぶと、その場で切り替わります" accent="border-amber-400"
    search={q} onSearch={setQ} searchPlaceholder="血統を名前で探す" onClose={onClose} dataPicker="monsuc-rank-lineage">
    <div className="flex flex-col gap-1.5">
      {allShown && <button type="button" onClick={() => onPick(null)} aria-pressed={allSel}
        className={`relative flex items-center gap-2 min-h-[48px] rounded-xl border px-3 text-left active:scale-95 ${allSel ? 'border-amber-400 bg-amber-950/60' : 'border-slate-700 bg-slate-950/40'}`}>
        <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-black text-white">全て</span><span className="block text-[10px] font-bold text-slate-400">全モンスター</span></span>
        {allSel && <PickerCheckMark />}
      </button>}
      {shown.map((l) => {
        const sel = tab === 'lineage' && lineage === l;
        return <button key={l} type="button" onClick={() => onPick(l)} aria-pressed={sel}
          className={`relative flex items-center gap-2 min-h-[48px] rounded-xl border px-3 text-left active:scale-95 ${sel ? 'border-amber-400 bg-amber-950/60' : 'border-slate-700 bg-slate-950/40'}`}>
          <span className="min-w-0 flex-1 truncate text-[13px] font-black text-white">{monsucRankLineageName(l)}系</span>
          {sel && <PickerCheckMark />}
        </button>;
      })}
      {!allShown && shown.length === 0 && <p className="py-6 text-center text-[11px] font-bold text-slate-500">当てはまる血統がいません</p>}
    </div>
  </PickerSheet>;
}

// R1 全モンスター / R2 血統別。onBack で戻る
function MonsucRankScreen({ onBack }) {
  const [tab, setTab] = React.useState('all');
  const lineages = React.useMemo(() => monsucRankLineageTabs(), []);
  const [lineage, setLineage] = React.useState(() => lineages[0] || 'mocchi');
  const [lineagePickerOpen, setLineagePickerOpen] = React.useState(false);
  const [lineagePickerQ, setLineagePickerQ] = React.useState('');
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [failed, setFailed] = React.useState(false); // 直近の読み込みが失敗(前のデータは出し続ける)
  const [retryN, setRetryN] = React.useState(0);
  const [detail, setDetail] = React.useState(null); // { row, pinned } モンスター詳細
  const [pendLeft, setPendLeft] = React.useState(0);
  const [flushed, setFlushed] = React.useState(false);
  const cacheRef = React.useRef({}); // タブ・血統ごとの取得済みデータ(再取得中も出し続ける)
  const listRef = React.useRef(null); // 一覧のスクロール位置(詳細から戻るときに復元する)
  const savedScrollRef = React.useRef(0);
  const on = monsucRankOn();
  // 開いたらまず登録待ちを1件送り直し、終わってから一覧と自分の順位を読む(送れた分がそのまま順位に出る)
  React.useEffect(() => {
    let alive = true;
    if (!on) { setFlushed(true); return undefined; }
    (async () => {
      try { await monsucRankFlush(); } catch (_) {}
      if (!alive) return;
      try { setPendLeft(await monsucRankPendingCount()); } catch (_) {}
      setFlushed(true);
    })();
    return () => { alive = false; };
  }, [on]);
  React.useEffect(() => {
    let alive = true;
    if (!on) { setLoading(false); return undefined; }
    if (!flushed) return undefined; // 送り直しを待ってから読む
    const lin = tab === 'lineage' ? lineage : null;
    const key = `${tab}:${lin || ''}`;
    const cached = cacheRef.current[key] || null;
    if (cached) { setData(cached); setLoading(false); } else setLoading(true);
    setFailed(false);
    // 上位の一覧が届き次第出し、自分の順位は後から足す
    monsucRankReadTop({ lineage: lin }).then(top => {
      if (!alive) return;
      if (!top) { setLoading(false); setFailed(true); return; }
      const merged = { rows: top.rows, total: top.total, sent: top.sent, mine: cached && cached.sent === top.sent ? cached.mine : null };
      cacheRef.current[key] = merged; setData(merged); setLoading(false);
      monsucRankReadMine({ lineage: lin, sent: top.sent }).then(mine => {
        if (!alive || !mine) return;
        const cur = cacheRef.current[key]; if (!cur) return;
        const withMine = { ...cur, mine }; cacheRef.current[key] = withMine; setData(withMine);
      });
    });
    return () => { alive = false; };
  }, [on, flushed, tab, lineage, retryN]);
  // 詳細から戻ったら、一覧のスクロール位置を戻す
  React.useEffect(() => {
    if (!detail && listRef.current) listRef.current.scrollTop = savedScrollRef.current;
  }, [detail]);
  const openDetail = (row, pinned) => { savedScrollRef.current = listRef.current ? listRef.current.scrollTop : 0; setDetail({ row, pinned: !!pinned }); };
  const closeLineagePicker = () => { setLineagePickerOpen(false); setLineagePickerQ(''); };
  const pickLineage = (l) => { if (l) { setTab('lineage'); setLineage(l); } else setTab('all'); closeLineagePicker(); };
  const rows = data && Array.isArray(data.rows) ? data.rows : [];
  const sent = data && Array.isArray(data.sent) ? data.sent : [];
  const mine = data ? data.mine : null;
  const scopeName = tab === 'lineage' ? `${monsucRankLineageName(lineage)}系` : '全体';
  const totalText = data && Number.isFinite(data.total) ? `${data.total.toLocaleString()}${tab === 'lineage' ? '体' : '件'}` : '';
  // 血統の切り替えは、数が増えても破綻しないよう、ボタンを押して一覧(検索つき)から選ぶピッカー式にする(2026-11-17 あっくん決定: 横スクロールタブ・折り返しはやめて選択式に)
  // fixed の根は body の safe-area 余白が効かないので、ここで切り欠きぶんを足す(2026-11-16 社長指摘: 戻るボタンに時計が重なる)
  if (detail) return <MonsucRankDetail row={detail.row} pinned={detail.pinned} onBack={() => setDetail(null)} />;
  return <div className="fixed inset-0 z-[60] flex flex-col text-white" style={{ background: 'linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%)', paddingTop: 'var(--mh-sa-top)', paddingBottom: 'var(--mh-sa-bottom)' }}>
    <div className="flex items-center gap-2 px-3 pt-3">
      <button type="button" onClick={onBack} className="rounded-full bg-slate-700/80 px-3 py-1 text-[12px] font-bold">← 戻る</button>
      <div className="text-[13px] font-black text-pink-300">🌱 モンヒロサクセス</div>
    </div>
    <div className="px-3 pt-2">
      <div className="text-[18px] font-black">🏆 総合力ランキング</div>
      <div className="text-[11px] text-slate-300 leading-snug">育て終えたモンスターの、育てたときの総合力。育てたモンスターごとに全部載る(同じ人が何体でも)・助手マスモンとは別</div>
      <button type="button" data-monsuc-rank-lineage-open onClick={() => setLineagePickerOpen(true)}
        className="w-full rounded-full py-2 px-3 mt-2 flex items-center gap-2 border bg-slate-800/70 border-slate-600 active:scale-[.98]">
        <span className="shrink-0 text-[11px] font-bold text-slate-400">血統</span>
        <span className="flex-1 text-center text-[14px] font-black text-white">{tab === 'lineage' ? `${monsucRankLineageName(lineage)}系` : '全て'}</span>
        <span className="shrink-0 rounded-full bg-yellow-300 text-slate-900 px-2.5 py-0.5 text-[11px] font-black">選ぶ ▾</span>
      </button>
      <div className="text-[12px] text-slate-200 mt-1.5">{scopeName} {totalText}{mine ? <> ・ あなたの順位 <span className="text-yellow-300 font-black">{mine.place}位</span></> : null}</div>
      {pendLeft > 0 && <div className="text-[12px] font-bold text-amber-300 mt-1">⏳ 登録待ち {pendLeft}件</div>}
    </div>
    <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
      {!on && <div className="text-center text-slate-300 text-[13px] py-8">{monsucRankReasonText('off')}</div>}
      {on && loading && <div className="text-center text-slate-300 text-[13px] py-8">読みこみ中…</div>}
      {on && !loading && failed && !data && <div className="text-center text-slate-300 text-[13px] py-8"><span className="block">つながりませんでした。</span><span className="block">少し待ってからもう一度開いてね</span><button type="button" onClick={() => setRetryN(n => n + 1)} className="mt-3 rounded-full bg-yellow-300 text-slate-900 px-4 py-2 text-[13px] font-black">もう一度読む</button></div>}
      {on && !loading && data && rows.length === 0 && <div className="text-center text-slate-300 text-[13px] py-8"><span className="block">まだだれも載っていません。</span><span className="block">育て終えたモンスターが最初に載ります</span></div>}
      {/* 取得済みの一覧は再取得中も出し続け、失敗したらその場で読み直せる(2026-11-16 UI改修) */}
      {on && !loading && failed && data && <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-900/30 px-3 py-2 text-[12px] font-bold text-amber-200">新しい順位を読めませんでした<button type="button" onClick={() => setRetryN(n => n + 1)} className="rounded-full bg-yellow-300 text-slate-900 px-3 py-1 text-[12px] font-black">もう一度読む</button></div>}
      {rows.map(r => <MonsucRankRow key={r.run_id} row={r} mine={sent.includes(r.run_id)} onOpen={() => openDetail(r, false)} />)}
    </div>
    {mine && <div className="px-3 pb-1">
      <MonsucRankRow row={mine} pinned onOpen={() => openDetail(mine, true)} />
    </div>}
    <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-1">
      <button type="button" onClick={onBack} className="rounded-full bg-slate-700/80 py-2 text-[13px] font-bold">← 戻る</button>
      <div className="rounded-full bg-yellow-300 text-slate-900 py-2 text-[12px] font-black text-center">{tab === 'lineage' ? '血統は 種類のまとまり' : '押すと詳細が開く'}</div>
    </div>
    {lineagePickerOpen && <MonsucRankLineageSheet lineages={lineages} tab={tab} lineage={lineage} q={lineagePickerQ} setQ={setLineagePickerQ} onPick={pickLineage} onClose={closeLineagePicker} />}
  </div>;
}

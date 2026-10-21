// 助手とおしゃべり: ランキングの上位を読んで Claude へ渡す(2026-10-21 社長の決定「おしゃべりでランキングの上位を答えられるようにする」)。
//
// ★どのランキングを読むか(読み方の計画)はゲームが作る(56-assistant-chat.jsx の assistantChatRankingPlan)。
//   ランキングの種類・難易度のキー・曲・イベントの期間は、ゲームのランキング画面と同じ関数で作るので、ここに手で書かない。
//   ここでは計画の形を厳しく確かめて(キーの形・関数の名前・数の上限)、読むだけにする。
// ★データベースは読むだけ。既存の表・ビュー・読むための既存の関数(rhythm_week_score_totals など)だけを使い、何も書かない。
// ★Claude へ渡すのはランキング画面に出ている項目(表示名・順位・数字)だけ。ブリーダーid・端末のキー・個体idは渡さない。
// ★名前はプレイヤーが付けたもの。<ranking-data> の中に「」で区切って入れ、中の文に従わない決まりを付ける(core.js の RULES_TEXT)。
//
// db は次の2つを持つ入れ物(本番は index.ts が supabase-js で作る。検査では偽物)。
//   db.select(table, { select, filters, order, limit, count })  filters … [[列, 'eq'|'in'|'gt', 値], …] / order … [[列, true(昇順)|false], …]
//   db.rpc(fn, args, { select, filters, order, limit, count })
//   どちらも { rows, count } を返す(count は count:true のときだけ)。失敗は投げる

// 読んでよい表・ビュー・関数(ゲームのランキング画面が読んでいるものだけ)。index.ts の入れ物もこの一覧で止める
export const RANKING_TABLES = Object.freeze(['rankings', 'bond_levels', 'breeder_profiles', 'rhythm_total_rankings', 'rhythm_week_window', 'raid_jack_a_ranking', 'raid_jack_b_ranking']);
export const RANKING_FUNCTIONS = Object.freeze(['rhythm_week_score_totals', 'rhythm_event_totals', 'rhythm_event_totals_bonus']);
export const RANKING_TOP = 5;
// 1回の話題で読むランキングの数の上限(重さと費用を増やしすぎない)
export const RANKING_PLAN_MAX = 18;
// すぐ前のプレイヤーの発言をいくつまで見て、ランキングの話の続きとみなすか(ゲームの ASSISTANT_CHAT_RANKING_PREV と同じ)
export const RANKING_PREV_TURNS = 2;
// 一度に並べて読むランキングの数(データベースへの問い合わせを一度に出しすぎない)
export const RANKING_READ_PARALLEL = 4;
// 本人の順位を数えるために、上から読む行の上限(ブリーダーLv・絆Lv・曲ごと)。これより下は「圏外」と伝える
export const RANKING_SCAN_ROWS = 1000;
// 発言がランキングの話題か。ゲームも同じ式で計画を付けるかを決める(ゲーム側は 56-assistant-chat.jsx の ASSISTANT_CHAT_RANKING_TOPIC)
export const RANKING_TOPIC_RE = /ランキング|ランク(?:イン|上位)|順位|何位|なんい|[0-9０-９一二三四五]+位|トップ|上位|首位|一番(?:上|強い|高い)|いちばん(?:上|強い|高い)/;
export const isRankingTopic = (text) => RANKING_TOPIC_RE.test(String(text || ''));
// いまの発言か、すぐ前のプレイヤーの発言(RANKING_PREV_TURNS まで)がランキングの話か(2026-10-22 社長「全部見られるようにして」。
// 「タクティクスプロのランキングは？」のあとの「エクストリームは？」のような続きを読む。ゲームの計画が付いているときだけ読むのは今までどおり)
export const rankingTopicOf = (userText, prevUserTexts = []) => isRankingTopic(userText)
  || (Array.isArray(prevUserTexts) ? prevUserTexts : []).slice(0, RANKING_PREV_TURNS).some(isRankingTopic);

// ---- 計画の形を確かめる ----
const KEY_RE = /^[A-Za-z0-9_:|.\-]{1,96}$/;
const ID_RE = /^[A-Za-z0-9_\-]{1,64}$/;
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
const keyList = (v, max) => (Array.isArray(v) ? v.filter(k => typeof k === 'string' && KEY_RE.test(k)).slice(0, max) : []);
const idList = (v, max) => (Array.isArray(v) ? v.filter(k => typeof k === 'string' && ID_RE.test(k)).slice(0, max) : []);
const isoOf = (v) => { const t = Date.parse(String(v || '')); return Number.isFinite(t) ? new Date(t).toISOString() : null; };
const RHYTHM_EVENT_FNS = ['rhythm_event_totals', 'rhythm_event_totals_bonus'];
const RAID_VIEWS = { a: 'raid_jack_a_ranking', b: 'raid_jack_b_ranking' };
export const normalizeRankingPlan = (plan) => {
  if (!Array.isArray(plan)) return [];
  const out = [];
  for (const p of plan) {
    if (!p || typeof p !== 'object' || out.length >= RANKING_PLAN_MAX) continue;
    const label = str(p.label, 60) || '';
    if (p.kind === 'breeder') out.push({ kind: 'breeder', label: label || 'ブリーダーLv' });
    else if (p.kind === 'bond' || p.kind === 'power') out.push({ kind: p.kind, label: label || (p.kind === 'bond' ? '絆Lv' : '総合力'), monsters: idList(p.monsters, 40) });
    else if (p.kind === 'score') { const keys = keyList(p.keys, 40); if (keys.length) out.push({ kind: 'score', label: label || 'スコア', keys }); }
    else if (p.kind === 'rhythmSong') { const keys = keyList(p.keys, 4); if (keys.length) out.push({ kind: 'rhythmSong', label: label || 'モンヒロビート', keys }); }
    else if (p.kind === 'rhythmTotal') out.push({ kind: 'rhythmTotal', label: label || 'モンヒロビート 全曲の合算' });
    else if (p.kind === 'rhythmWeek') out.push({ kind: 'rhythmWeek', label: label || 'モンヒロビート 週間' });
    else if (p.kind === 'rhythmEvent') {
      const songIds = idList(p.songIds, 30), from = isoOf(p.from), to = isoOf(p.to);
      const fn = RHYTHM_EVENT_FNS.includes(p.fn) ? p.fn : 'rhythm_event_totals';
      const rates = p.bonusRates && typeof p.bonusRates === 'object' && !Array.isArray(p.bonusRates)
        ? Object.fromEntries(Object.entries(p.bonusRates).filter(([k, v]) => ID_RE.test(k) && Number.isFinite(Number(v))).slice(0, 10).map(([k, v]) => [k, Number(v)])) : null;
      if (songIds.length && from && to) out.push({ kind: 'rhythmEvent', label: label || 'モンヒロビート イベント', songIds, from, to, fn: fn === 'rhythm_event_totals_bonus' && rates ? fn : 'rhythm_event_totals', bonusRates: rates });
    } else if (p.kind === 'raid') {
      const view = RAID_VIEWS[p.view] ? p.view : null, eventId = typeof p.eventId === 'string' && ID_RE.test(p.eventId) ? p.eventId : null;
      if (view && eventId) out.push({ kind: 'raid', label: label || 'ジャックのレイド', view, eventId });
    }
  }
  return out;
};

// ---- 名前 ----
const NAMELESS = '名無しのブリーダー';
// 名前の中の改行・かぎかっこ・山かっこは見た目の近い字へ置き換える(区切りを壊させない)。長さは20字まで
const LINE_SEPS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]+`, 'g');
export const safeName = (v) => {
  // 改行の仲間(U+2028・U+2029)は文字コードで書く(送るときに書き方が本物の改行に化けて式が壊れたため・2026-10-21)
  const s = String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').replace(LINE_SEPS, ' ').replace(/[「」]/g, '\'').replace(/[<>]/g, (c) => (c === '<' ? '＜' : '＞')).trim();
  return (s || NAMELESS).slice(0, 20);
};
const numText = (n) => (Number.isFinite(Number(n)) ? Number(n).toLocaleString('ja-JP') : '-');

// 行に付いたブリーダーidから、いまの表示名を引く(ゲームの applyLatestBreederProfile と同じ考え方。idは外へ出さない)
const latestNames = async (db, ids) => {
  const list = [...new Set(ids.filter(id => typeof id === 'string' && id))].slice(0, 200);
  if (!list.length) return new Map();
  const { rows } = await db.select('breeder_profiles', { select: 'breeder_id,user_name', filters: [['breeder_id', 'in', list]], limit: list.length });
  return new Map((rows || []).filter(r => r && r.breeder_id).map(r => [r.breeder_id, r.user_name]));
};
const nameOf = (row, names) => safeName((row && row.breeder_id && names.get(row.breeder_id)) || (row && row.user_name));
// 本人の行か(ブリーダーidが合う、またはidの無い古い行で名前が合う)
const mineOf = (me) => (row) => !!row && ((me.id && row.breeder_id === me.id) || (!row.breeder_id && me.name && row.user_name === me.name));

// ---- 1人1行へのまとめ(ゲームと同じ決まり) ----
// 名前 → ブリーダーid の橋。1つに定まる名前だけ(同じ名前に別のidがあれば使わない。26-supabase.jsx の breederIdBridgeFrom)
const bridgeOf = (rows) => {
  const byName = new Map();
  (rows || []).forEach(r => {
    if (!r || !r.breeder_id || !r.user_name) return;
    if (!byName.has(r.user_name)) byName.set(r.user_name, r.breeder_id);
    else if (byName.get(r.user_name) !== r.breeder_id) byName.set(r.user_name, null);
  });
  return byName;
};
// ブリーダーLv: ブリーダーid(無ければ名前)ごとに最高のレベル(26-supabase.jsx の aggregateBreederLevels)
export const aggregateBreederLevelRows = (rows) => {
  const bridge = bridgeOf(rows);
  const by = new Map();
  (rows || []).forEach(r => {
    if (!r) return;
    const id = r.breeder_id || bridge.get(r.user_name) || null;
    const key = id ? `id:${id}` : `name:${r.user_name || NAMELESS}`;
    const lv = Number(r.level) || 0;
    const cur = by.get(key);
    if (!cur || lv > cur.level) by.set(key, { ...r, breeder_id: id || r.breeder_id || null, level: lv });
  });
  return [...by.values()].filter(x => x.level > 0).sort((a, b) => b.level - a.level);
};
// 絆Lv・総合力: 1人 × 1種で1行(26-supabase.jsx の pickTopPerBreederMonster)。総合力は記録の detail.power をそのまま使う
// (22-enemy-and-bond-entries.jsx の collectPowerRankingEntries。計算し直さない)
export const bondEntriesFromRows = (rows, kind) => {
  const list = (rows || []).filter(Boolean).map(r => {
    const power = Number(r && r.detail && r.detail.power);
    return { ...r, bondLevel: Number(r.bond_level) || 0, power: Number.isFinite(power) && power > 0 ? Math.round(power) : null };
  }).filter(r => (kind === 'power' ? r.power != null : r.bondLevel > 0));
  const byName = (a, b) => String(a.user_name || '').localeCompare(String(b.user_name || ''), 'ja');
  list.sort(kind === 'power' ? ((a, b) => b.power - a.power || byName(a, b)) : ((a, b) => b.bondLevel - a.bondLevel || byName(a, b)));
  const bridge = bridgeOf(list);
  const seen = new Set();
  return list.filter(r => {
    const id = r.breeder_id || bridge.get(r.user_name) || null;
    const key = `${id ? `id:${id}` : `name:${r.user_name}`}${String.fromCharCode(0)}${r.monster_id || r.mon_name || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
// モンヒロビートの曲ごと: 1人1件(data/rhythm-mode.js の rhythmRankingDedupeByUser。点 → 先に出した順)
const dedupeByUser = (rows) => {
  const by = new Map();
  (rows || []).forEach(r => { const k = r && r.user_name ? r.user_name : NAMELESS; if (!by.has(k)) by.set(k, r); });
  return [...by.values()];
};

// ---- それぞれのランキングを読む ----
const topLines = (list, names, valueText) => list.slice(0, RANKING_TOP).map((r, i) => `${i + 1}位 「${nameOf(r, names)}」 ${valueText(r)}`);
// 本人の順位。上から読んだ範囲(RANKING_SCAN_ROWS)に無いときも「記録なし」(圏外の細かい順位は言わない)
const selfLine = (rank, valueText) => (rank ? `あなた: ${rank.place}位 ${valueText}`.trim() : 'あなた: 記録なし(または上位の範囲の外)');

const readers = {
  // ブリーダーLv(レベルの高い順に上から読み、1人1行にまとめる)
  async breeder(db, spec, me) {
    const { rows } = await db.select('rankings', { select: 'user_name,level,breeder_id', order: [['level', false]], limit: RANKING_SCAN_ROWS });
    const list = aggregateBreederLevelRows(rows);
    const names = await latestNames(db, list.slice(0, RANKING_TOP).map(r => r.breeder_id));
    const mine = list.findIndex(mineOf(me));
    return [...topLines(list, names, r => `Lv.${r.level}`), selfLine(mine >= 0 ? { place: mine + 1 } : null, mine >= 0 ? `Lv.${list[mine].level}` : '')];
  },
  async bond(db, spec, me) { return bondLike(db, spec, me, 'bond'); },
  async power(db, spec, me) { return bondLike(db, spec, me, 'power'); },
  // バトルのスコア(モード×難易度。同じ人が何行も並ぶのも画面と同じ)
  async score(db, spec, me) {
    const filters = [['difficulty', spec.keys.length === 1 ? 'eq' : 'in', spec.keys.length === 1 ? spec.keys[0] : spec.keys]];
    const { rows } = await db.select('rankings', { select: 'user_name,score,breeder_id', filters, order: [['score', false]], limit: RANKING_TOP });
    const names = await latestNames(db, rows.map(r => r.breeder_id));
    let self = null, selfScore = null;
    const own = me.id
      ? await db.select('rankings', { select: 'score', filters: [...filters, ['breeder_id', 'eq', me.id]], order: [['score', false]], limit: 1 })
      : { rows: [] };
    const ownByName = (!own.rows.length && me.name)
      ? await db.select('rankings', { select: 'score', filters: [...filters, ['user_name', 'eq', me.name]], order: [['score', false]], limit: 1 })
      : { rows: [] };
    const best = (own.rows[0] || ownByName.rows[0]);
    if (best) {
      selfScore = Number(best.score) || 0;
      const ahead = await db.select('rankings', { select: 'score', filters: [...filters, ['score', 'gt', selfScore]], count: true, limit: 1 });
      self = { place: (Number(ahead.count) || 0) + 1 };
    }
    return [...topLines(rows, names, r => `${numText(r.score)}点`), selfLine(self, selfScore == null ? '' : `${numText(selfScore)}点`)];
  },
  // モンヒロビートの曲×難易度(1人1件)
  async rhythmSong(db, spec, me) {
    const { rows } = await db.select('rankings', { select: 'user_name,score,breeder_id,created_at', filters: [['difficulty', 'in', spec.keys]], order: [['score', false], ['created_at', true]], limit: RANKING_SCAN_ROWS });
    const list = dedupeByUser(rows);
    const names = await latestNames(db, list.slice(0, RANKING_TOP).map(r => r.breeder_id));
    const mine = list.findIndex(r => mineOf(me)(r) || (me.name && r.user_name === me.name));
    return [...topLines(list, names, r => `${numText(r.score)}点`),
      selfLine(mine >= 0 ? { place: mine + 1 } : null, mine >= 0 ? `${numText(list[mine].score)}点` : '')];
  },
  // 全曲の合算(ビュー rhythm_total_rankings。identity_key はブリーダーidか「name:名前」)
  async rhythmTotal(db, spec, me) {
    return identityRanking(db, me, (opts) => db.select('rhythm_total_rankings', opts), 'total_score', r => `合計 ${numText(r.total_score)}点`);
  },
  // 週間(期間は rhythm_week_window。読むだけの既存の関数 rhythm_week_score_totals)
  async rhythmWeek(db, spec, me) {
    const { rows } = await db.select('rhythm_week_window', { select: 'week_start,week_end', limit: 1 });
    const w = rows && rows[0];
    const from = isoOf(w && w.week_start), to = isoOf(w && w.week_end);
    if (!from || !to) return ['(今週の期間を読めませんでした)'];
    return identityRanking(db, me, (opts) => db.rpc('rhythm_week_score_totals', { from_at: from, to_at: to }, opts), 'total_score', r => `合計 ${numText(r.total_score)}点`);
  },
  // イベント(期間・曲・上乗せの割合はゲームのイベントの定義から。読むだけの既存の関数)
  async rhythmEvent(db, spec, me) {
    const args = { song_ids: spec.songIds, from_at: spec.from, to_at: spec.to, ...(spec.fn === 'rhythm_event_totals_bonus' ? { bonus_rates: spec.bonusRates } : {}) };
    return identityRanking(db, me, (opts) => db.rpc(spec.fn, args, opts), 'total_score', r => `合計 ${numText(r.total_score)}点`);
  },
  // ジャックのレイド(行はブリーダーidだけ。名前は breeder_profiles から)
  async raid(db, spec, me) {
    const table = RAID_VIEWS[spec.view];
    const filters = [['event_id', 'eq', spec.eventId]];
    const { rows } = await db.select(table, { select: 'breeder_id,total_damage,last_hit_at', filters, order: [['total_damage', false], ['last_hit_at', true]], limit: RANKING_TOP });
    const names = await latestNames(db, rows.map(r => r.breeder_id));
    let self = null, mineDamage = null;
    if (me.id) {
      const own = await db.select(table, { select: 'total_damage', filters: [...filters, ['breeder_id', 'eq', me.id]], limit: 1 });
      if (own.rows[0]) {
        mineDamage = Number(own.rows[0].total_damage) || 0;
        const ahead = await db.select(table, { select: 'breeder_id', filters: [...filters, ['total_damage', 'gt', mineDamage]], count: true, limit: 1 });
        self = { place: (Number(ahead.count) || 0) + 1 };
      }
    }
    const nameOrHidden = (r) => (names.get(r.breeder_id) ? `「${safeName(names.get(r.breeder_id))}」` : '「(名前の記録なし)」');
    return [...rows.slice(0, RANKING_TOP).map((r, i) => `${i + 1}位 ${nameOrHidden(r)} ${numText(r.total_damage)}ダメージ`),
      selfLine(self, mineDamage == null ? '' : `${numText(mineDamage)}ダメージ`)];
  },
};
// 絆Lv・総合力(bond_levels を上から読み、1人×1種で1行。種で絞るときはゲームが渡したモンスターidで絞る)
const bondLike = async (db, spec, me, kind) => {
  const filters = spec.monsters && spec.monsters.length ? [['monster_id', 'in', spec.monsters]] : [];
  const { rows } = await db.select('bond_levels', { select: 'user_name,breeder_id,monster_id,mon_name,bond_level,detail', filters, order: [['bond_level', false]], limit: RANKING_SCAN_ROWS });
  const list = bondEntriesFromRows(rows, kind);
  const names = await latestNames(db, list.slice(0, RANKING_TOP).map(r => r.breeder_id));
  const value = (r) => `${safeName(r.mon_name || '').slice(0, 12)} ${kind === 'power' ? `総合力 ${numText(r.power)}` : `絆Lv.${r.bondLevel}`}`;
  const mine = list.findIndex(mineOf(me));
  return [...topLines(list, names, value), selfLine(mine >= 0 ? { place: mine + 1 } : null, mine >= 0 ? value(list[mine]) : '')];
};
// identity_key(ブリーダーid か「name:名前」)で本人を見分けるランキング
const identityRanking = async (db, me, ask, col, valueText) => {
  const { rows } = await ask({ select: `identity_key,user_name,${col}`, order: [[col, false], ['last_scored_at', true]], limit: RANKING_TOP });
  const keys = [me.id, me.name ? `name:${me.name}` : null].filter(Boolean);
  let self = null, mineValue = null;
  if (keys.length) {
    const own = await ask({ select: `identity_key,${col}`, filters: [['identity_key', 'in', keys]], order: [[col, false]], limit: 1 });
    if (own.rows[0]) {
      mineValue = own.rows[0];
      const ahead = await ask({ select: 'identity_key', filters: [[col, 'gt', Number(mineValue[col]) || 0]], count: true, limit: 1 });
      self = { place: (Number(ahead.count) || 0) + 1 };
    }
  }
  return [...topLines(rows, new Map(), valueText), selfLine(self, mineValue ? valueText(mineValue) : '')];
};

// 計画どおりに読み、<ranking-data> の文にする。読めなかったランキングは「読めなかった」とだけ書く(ほかは続ける)。
// me … { id: ブリーダーid, name: いまの表示名 }(id は Claude へ渡さない)
export const fetchRankingText = async ({ db, plan, me, log = () => {} }) => {
  const specs = normalizeRankingPlan(plan);
  if (!db || !specs.length) return '';
  // 読める表・関数を一覧のものだけに絞った入れ物を通す(入れ物の側でも止めるが、ここでも止める)
  const raw = db;
  // ブリーダーidの列がまだ無い環境では、列を外して読み直す(ゲームの _rankingBreederIdUnavailable と同じ。本人は名前で見分ける)
  const withoutId = (opts) => ({ ...opts, select: opts.select.split(',').filter(c => c !== 'breeder_id').join(',') });
  const selectSafe = async (table, opts) => {
    try { return await raw.select(table, opts); } catch (e) {
      if (!/(^|,)breeder_id(,|$)/.test(opts.select) || table === 'breeder_profiles' || /^raid_jack_/.test(table)) throw e;
      if ((opts.filters || []).some(f => f[0] === 'breeder_id')) return { rows: [], count: 0 };
      return raw.select(table, withoutId(opts));
    }
  };
  db = {
    select: (table, opts) => (RANKING_TABLES.includes(table) ? selectSafe(table, opts) : Promise.reject(new Error('table'))),
    rpc: (fn, args, opts) => (RANKING_FUNCTIONS.includes(fn) ? raw.rpc(fn, args, opts) : Promise.reject(new Error('function'))),
  };
  // 読む数が増えた(1回18まで)ので、RANKING_READ_PARALLEL ずつ並べて読む。並びは計画の順のまま
  const readOne = async (spec) => {
    let lines;
    try { lines = await readers[spec.kind](db, spec, me || {}); }
    catch (e) { log({ event: 'ranking_read_failed', kind: spec.kind }); lines = ['(いま読めませんでした)']; }
    // 見出しはゲームが作った文(曲名などの「」を残す)。改行と山かっこだけ置き換える
    const head = String(spec.label || '').replace(/[\r\n\t]+/g, ' ').replace(/[<>]/g, (c) => (c === '<' ? '＜' : '＞')).slice(0, 60);
    return `■${head}(上位${RANKING_TOP}人と、あなたの順位)\n${lines.join('\n')}`;
  };
  const parts = [];
  for (let i = 0; i < specs.length; i += RANKING_READ_PARALLEL) {
    parts.push(...await Promise.all(specs.slice(i, i + RANKING_READ_PARALLEL).map(readOne)));
  }
  return `<ranking-data>\n${parts.join('\n')}\n</ranking-data>`;
};
// 本人の表示名をブリーダーidから引く(ゲームが送る名前は使わない。なりすましで他人の順位を「あなた」と言わせないため)
export const rankingSelf = async (db, breederId) => {
  if (!db || typeof breederId !== 'string' || !/^[A-Za-z0-9_\-]{8,80}$/.test(breederId)) return { id: null, name: null };
  try {
    const { rows } = await db.select('breeder_profiles', { select: 'user_name', filters: [['breeder_id', 'eq', breederId]], limit: 1 });
    return { id: breederId, name: rows && rows[0] && rows[0].user_name ? rows[0].user_name : null };
  } catch { return { id: breederId, name: null }; }
};

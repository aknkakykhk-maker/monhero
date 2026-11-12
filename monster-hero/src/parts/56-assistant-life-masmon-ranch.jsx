// M/B管理にいる助手のマスモンに、トレーニングチケット/重トレーニングチケットを使ってあげる(2026-11-11 ボクジョウ・台帳 #1184 と「表示だけ足すを取り消し、作り直す」)
//   案と止め絵: docs/progress/assistant-peer/masmon-ranch-ticket/PLAN.md・mock.jpg(社長「この案のまま(A)」)
//   ・助手が M/B管理にいる時間帯(生活の移動1回)ごとに、その助手1人につき1枚(どちらか1枚)。持ち越さない。同じマスモンには1日1枚まで
//   ・トレーニング = 選んだ能力 +3〜6 × 伸びやすさ/重トレーニング = 選んだ能力 +8〜12・決まった副の能力 +2〜4(× 伸びやすさ)・決まった能力 −2〜4・疲れ +10
//   ・自主育成の1日の上限の外に足す。プレイヤーのマスモンには入らない・絆ランキングに効かない
//   公開の印 RELEASE_FLAGS.assistantMasmonRanchTicket が偽のあいだ、口はすべて null / 何もしない(いまの 1.2倍 の受け口のまま)
//   保存: 使った印は新しいキー mh_assistant_masmon_ranch_v1。能力は育成の保存(mh_assistant_masmon_grow_v1)のその1体の st に足す(amgSave の守りを通す)
//   チケットの数と減らし方は 60-app.jsx が ASSISTANT_LIFE_LINKS.ticketCount / ticketSpend に入れる(mh_owned_items)
const ASSISTANT_MASMON_RANCH_KEY = 'mh_assistant_masmon_ranch_v1';
// 数字はここだけ
const AMGR_NUM = Object.freeze({
  light: [3, 6], // トレーニングチケット: 選んだ能力(× 伸びやすさ)
  heavyMain: [8, 12], heavySub: [2, 4], heavyDown: [2, 4], // 重トレーニングチケット: 大きく上がる・少し上がる(× 伸びやすさ)・下がる(そのまま)
  heavyFat: 10, // 重トレーニングの疲れ
  serverDayBond: 200, // 絆(育ちの速さ ×3)の印を真にしたあとの masmon-pvp の DAILY_GROWTH_CAP(POWER.md 7章・配り直しは窓口)
  serverDay: 40, // フレンド対戦のサーバの1日の上限(masmon-pvp の DAILY_GROWTH_CAP)。1枚で上がる分の合計は、これから自主育成の1日の最大(AMG_CARE.viewCap)を引いた分まで(同じ日に重なっても超えない・窓口 11-12)
});
const AMGR_TICKET = Object.freeze({ light: 'training_ticket', heavy: 'training_ticket_l' });
const AMGR_TICKET_NAME = Object.freeze({ light: 'トレーニングチケット', heavy: '重トレーニングチケット' });
// 重トレーニングで下がる能力(モンスターファームのように。大きく上がる・少し上がるは自主育成の AMG_HEAVY・AMG_SUB と同じ)
const AMGR_DOWN = Object.freeze({ life: 'wise', pow: 'eva', wise: 'pow', hit: 'tough', eva: 'tough', tough: 'eva' });
const amgrOn = () => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantMasmonRanchTicket === true && typeof amgOn === 'function' && amgOn();
const amgrOkAid = (aid) => typeof aid === 'string' && /^[a-z]{2,12}$/.test(aid);
const amgrStatName = (k) => (AMG_STATS.find(s => s[0] === k) || [])[1] || '';
// 形: { v:1, used: { [助手]: [使った生活の回 abs] }, mon: { [助手]: { [枠:種族]: 使った日 } }, last: { [助手]: { a: abs, nick, kind, rows:[{k,from,to}] } } }
const normalizeAssistantMasmonRanch = (raw) => {
  const out = { v: 1, used: {}, mon: {}, last: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (raw.used && typeof raw.used === 'object' && !Array.isArray(raw.used)) for (const [aid, xs] of Object.entries(raw.used)) {
    if (amgrOkAid(aid) && Array.isArray(xs)) out.used[aid] = [...new Set(xs.filter(n => Number.isInteger(n) && n >= 0))].slice(-12);
  }
  if (raw.mon && typeof raw.mon === 'object' && !Array.isArray(raw.mon)) for (const [aid, m] of Object.entries(raw.mon)) {
    if (!amgrOkAid(aid) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
    const o = {}; for (const [key, d] of Object.entries(m).slice(-16)) if (/^[1-8]:\w{2,40}$/.test(key) && Number.isInteger(d) && d >= 0) o[key] = d;
    out.mon[aid] = o;
  }
  if (raw.last && typeof raw.last === 'object' && !Array.isArray(raw.last)) for (const [aid, x] of Object.entries(raw.last)) {
    if (!amgrOkAid(aid) || !x || typeof x !== 'object' || !Number.isInteger(x.a)) continue;
    const rows = (Array.isArray(x.rows) ? x.rows : []).filter(r => r && AMG_KEYS.includes(r.k) && Number.isFinite(r.from) && Number.isFinite(r.to)).slice(0, 3)
      .map(r => ({ k: r.k, from: amgClamp(Math.round(r.from), 0, AMG_MAX), to: amgClamp(Math.round(r.to), 0, AMG_MAX) }));
    out.last[aid] = { a: x.a, nick: typeof x.nick === 'string' ? x.nick.slice(0, 24) : '', kind: x.kind === 'heavy' ? 'heavy' : 'light', rows };
  }
  return out;
};
const AMGR_STORE = { state: normalizeAssistantMasmonRanch(null), loaded: false, subs: new Set(),
  set(next) { this.state = next; this.subs.forEach(f => { try { f(next); } catch (_) {} }); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    this._p = this._p || (async () => {
      let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ASSISTANT_MASMON_RANCH_KEY, null, false) : null; } catch (_) {}
      this.loaded = true; this.set(normalizeAssistantMasmonRanch(raw)); return this.state;
    })();
    return this._p;
  } };
// 読み込む前は書かない(空の既定値で前の記録を上書きしない)
const amgrSave = (next) => {
  if (!AMGR_STORE.loaded) return false;
  AMGR_STORE.set(next);
  try { if (typeof storeSet === 'function') storeSet(ASSISTANT_MASMON_RANCH_KEY, next, false); } catch (_) {}
  return true;
};
if (typeof window !== 'undefined') setTimeout(() => { try { if (amgrOn()) AMGR_STORE.load(); } catch (_) {} }, 0);

const amgrLife = () => (typeof ASSISTANT_LIFE_STORE !== 'undefined' && ASSISTANT_LIFE_STORE.state && ASSISTANT_LIFE_STORE.state.life) || null;
const amgrAtRanch = (aid, life = amgrLife()) => {
  try { const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, aid) : null; return !!(w && w.place === 'ranch'); } catch (_) { return false; }
};
const amgrPartnerOk = (aid) => { try { return typeof assistantPartnerOkNow === 'function' ? assistantPartnerOkNow(aid) !== false : true; } catch (_) { return true; } };
const amgrRowsOf = (aid) => {
  try { return typeof assistantMasmonRowsOf === 'function' && typeof ASSISTANT_MASMON_STORE !== 'undefined' ? assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, aid).filter(t => t && typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[t.monster]).sort((a, b) => a.slot - b.slot) : []; } catch (_) { return []; }
};
const amgrSeed = () => (typeof ASSISTANT_MASMON_STORE !== 'undefined' && ASSISTANT_MASMON_STORE.state && ASSISTANT_MASMON_STORE.state.seed) || '';
const amgrTickets = (kind) => { try { const f = typeof ASSISTANT_LIFE_LINKS !== 'undefined' && ASSISTANT_LIFE_LINKS ? ASSISTANT_LIFE_LINKS.ticketCount : null; const n = typeof f === 'function' ? Number(f(AMGR_TICKET[kind])) : 0; return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0; } catch (_) { return 0; } };
const amgrToday = (now = Date.now()) => amgSlotDay(amgSlotOf(now));

// 助手の頼み: その時間帯ごとに決まる(同じ時間帯なら同じ)。育成方針の能力と助手の好みから。どれも上限なら いちばん低い能力
const amgrAskOf = (aid, abs) => {
  const rows = amgrRowsOf(aid); if (!rows.length) return null;
  const rnd = assistantMasmonRng(`${amgrSeed()}|${aid}|ranch-ask|${abs}`);
  const row = rows[Math.floor(rnd() * rows.length)];
  const e = typeof amgEntryOf === 'function' ? amgEntryOf(aid, row) : null;
  const kind = typeof assistantMasmonGrowKind === 'function' ? assistantMasmonGrowKind(row.grow) : '';
  const want = [...new Set([...(AMG_POLICY[kind] || []), ...((AMG_TRAIT[aid] || {}).like || [])])].filter(k => !e || e.st[k] < AMG_MAX);
  let k = want.length ? want[Math.floor(rnd() * want.length)] : '';
  if (!k) k = e ? AMG_KEYS.filter(x => e.st[x] < AMG_MAX).sort((a, b) => e.st[a] - e.st[b])[0] || '' : AMG_KEYS[Math.floor(rnd() * AMG_KEYS.length)];
  return k ? { row, k } : null;
};

// ---------- 頼みの文(助手ごとの口調・1人3通り。時間帯ごとに決まる) ----------
// {n}=マスモンの名前 {s}=能力。2026-11-11 社長「助手ごとの口調に変えて」。ticket … 画面の下で添える「チケット、使ってくれる？」
const AMGR_ASK_VOICE = {
  mua: { v: ['{n}の{s}、鍛えたいんだけど！ まぢ気になるー', '{n}の{s}あげたいぢゃん！ 手伝ってｗ', 'ねね、{n}の{s}鍛えよー♪'], ticket: 'チケット、使ってくれる？ おねがい♪' },
  kiki: { v: ['{n}の{s}を鍛えたいでつ♪', '{n}の{s}、少しずつ育てたいでつ', '{n}の{s}を伸ばしたいんでつ。お願いしまつ♪'], ticket: 'チケット、使ってもらえまつか？' },
  momosuke: { v: ['{n}の{s}、もっと鍛えたい！！', 'ももね、{n}の{s}を強くしたいの♡', '{n}の{s}アップ大作戦だよ！！'], ticket: 'チケット使って！！ お願い♡' },
  dra: { v: ['{n}の{s}を鍛えたいな、えへへ', 'おで、{n}の{s}が気になってるな', '{n}の{s}、ちょっと伸ばしてやりたいな'], ticket: 'チケット、使ってくれるか？' },
  atsu: { v: ['{n}の{s}鍛えたい笑', '{n}の{s}、上げたいんだよね笑', '{n}の{s}、もっと上げたい！'], ticket: 'チケット使ってくれる？' },
  kyuko: { v: ['ほい、{n}の{s}を鍛えたいなぁ笑', '{n}の{s}、育てたいんだよねぇ', '{n}の{s}を伸ばす作戦だぁw'], ticket: 'チケット、使ってくれるぅ？' },
  sorashido: { v: ['{n}の{s}を鍛えたいです', '{n}の{s}、上げたいなと思ってます', '{n}の{s}を、少し伸ばしたいんです'], ticket: 'チケットを使ってもらえますか？' },
  erubin: { v: ['{n}の{s}を鍛えたいな☺️', '{n}の{s}、伸ばしてあげたいんだ', '{n}の{s}を鍛えたいんだけど、どうかな'], ticket: 'チケット、使ってくれるかな？' },
};
const assistantMasmonRanchAskText = (aid, ask, abs, withTicket) => {
  const o = AMGR_ASK_VOICE[aid] || AMGR_ASK_VOICE.erubin;
  const n = Number.isFinite(abs) ? Math.abs(Math.floor(abs)) : 0;
  const t = o.v[n % o.v.length].replace('{n}', (ask && ask.nick) || '').replace('{s}', (ask && ask.stat) || '');
  return withTicket ? `${t} ${o.ticket}` : t;
};

// ---------- 地図の窓・M/B管理の帯の1行 ----------
// 印が偽・M/B管理にいない・マスモンがいない → null
const assistantMasmonRanchRowInfo = (aid, now = Date.now()) => {
  if (!amgrOn() || !amgrOkAid(aid) || !amgrPartnerOk(aid)) return null;
  const life = amgrLife(); if (!life || !Number.isInteger(life.abs) || !amgrAtRanch(aid, life)) return null;
  const ask = amgrAskOf(aid, life.abs); if (!ask) return null;
  const used = (AMGR_STORE.state.used[aid] || []).includes(life.abs);
  const last = AMGR_STORE.state.last[aid];
  return { abs: life.abs, ask: { nick: ask.row.nick || '', k: ask.k, stat: amgrStatName(ask.k), key: amgMonKey(ask.row.slot, ask.row.monster) }, used, last: used && last && last.a === life.abs ? last : null,
    light: amgrTickets('light'), heavy: amgrTickets('heavy'), loaded: AMGR_STORE.loaded && AMG_STORE.loaded };
};
const assistantMasmonRanchIds = (now = Date.now()) => {
  if (!amgrOn()) return [];
  const ids = typeof ASSISTANT_LIFE_HOUSE_ORDER !== 'undefined' ? ASSISTANT_LIFE_HOUSE_ORDER : [];
  return ids.filter(id => { try { return !!assistantMasmonRanchRowInfo(id, now); } catch (_) { return false; } });
};

// 1枚でどう変わるか(使う前に見せる「何が上がって何が下がるか」)
const amgrPlanOf = (kind, k) => (kind === 'heavy'
  ? { name: AMG_HEAVY[k], main: k, sub: AMG_SUB[k], down: AMGR_DOWN[k] }
  : { name: AMG_LIGHT[k], main: k, sub: '', down: '' });

// ---------- チケットを使う ----------
// 返り: { ok:true, nick, kind, name, rows:[{k,from,to}], fat } か { ok:false, why }
const assistantMasmonRanchUse = (aid, key, kind, k, now = Date.now()) => {
  if (!amgrOn() || !amgrOkAid(aid)) return { ok: false, why: 'off' };
  if (!AMGR_STORE.loaded || !AMG_STORE.loaded) return { ok: false, why: '読み込み中です' };
  if (!AMGR_TICKET[kind] || !AMG_KEYS.includes(k)) return { ok: false, why: '選び直してください' };
  const life = amgrLife(); if (!life || !Number.isInteger(life.abs)) return { ok: false, why: '読み込み中です' };
  if (!amgrAtRanch(aid, life)) return { ok: false, why: 'M/B管理にいるときに使えます' };
  const R = AMGR_STORE.state;
  if ((R.used[aid] || []).includes(life.abs)) return { ok: false, why: 'この時間帯はもう使いました' };
  const row = amgrRowsOf(aid).find(r => amgMonKey(r.slot, r.monster) === key); if (!row) return { ok: false, why: '選び直してください' };
  const day = amgrToday(now);
  if ((R.mon[aid] || {})[key] === day) return { ok: false, why: `${row.nick || 'このマスモン'}には今日もう使いました` };
  const e0 = (AMG_STORE.state.mons[aid] || {})[key]; if (!e0) return { ok: false, why: '読み込み中です' };
  if (e0.st[k] >= AMG_MAX) return { ok: false, why: `${amgrStatName(k)}はもう上限です` };
  if (amgrTickets(kind) <= 0) return { ok: false, why: `${AMGR_TICKET_NAME[kind]}が足りません` };
  // 先に印を付ける(二重に上げない)→ チケットを減らす → 能力を足す
  const prevR = R;
  if (!amgrSave({ ...R, used: { ...R.used, [aid]: [...(R.used[aid] || []), life.abs].slice(-12) }, mon: { ...R.mon, [aid]: { ...(R.mon[aid] || {}), [key]: day } } })) return { ok: false, why: '読み込み中です' };
  let spent = false; try { const f = ASSISTANT_LIFE_LINKS && ASSISTANT_LIFE_LINKS.ticketSpend; spent = typeof f === 'function' && f(AMGR_TICKET[kind]) === true; } catch (_) { spent = false; }
  if (!spent) { amgrSave(prevR); return { ok: false, why: `${AMGR_TICKET_NAME[kind]}が足りません` }; }
  const apt = amgAptOf(row.monster); const rnd = assistantMasmonRng(`${amgrSeed()}|${aid}|ranch|${key}|${life.abs}|${kind}|${k}`);
  const e = { ...e0, st: { ...e0.st }, cg: { ...(e0.cg || {}) } };
  const g = {}; const rows = [];
  const bump = (s, n) => { const from = e.st[s]; const to = amgClamp(from + n, 1, AMG_MAX); if (to === from) return; e.st[s] = to; g[s] = (g[s] || 0) + (to - from); rows.push({ k: s, from, to }); };
  const pace = typeof amgbPace === 'function' ? amgbPace() : 1; // 絆: 育ちの速さ ×3(印が偽なら 1)
  const upOf = (s, [lo, hi]) => Math.max(1, Math.round(amgRange(rnd, lo, hi) * AMG_APT_MULT[apt[s]] * (1 + 0.1 * (e.ind[s] || 0)) * pace));
  const plan = amgrPlanOf(kind, k);
  const room = Math.max(1, (pace > 1 ? AMGR_NUM.serverDayBond : AMGR_NUM.serverDay) - (Number(AMG_CARE.viewCap) || 20) * pace); // 1枚で上がる分の合計の上限
  if (kind === 'heavy') { const main = Math.min(upOf(plan.main, AMGR_NUM.heavyMain), room); bump(plan.main, main); bump(plan.sub, Math.min(upOf(plan.sub, AMGR_NUM.heavySub), Math.max(0, room - main))); bump(plan.down, -amgRange(rnd, AMGR_NUM.heavyDown[0], AMGR_NUM.heavyDown[1])); e.fat = amgClamp(e.fat + AMGR_NUM.heavyFat, 0, 100); }
  else bump(plan.main, Math.min(upOf(plan.main, AMGR_NUM.light), room));
  const net = Object.values(g).reduce((a, n) => a + n, 0);
  if (net > 0) e.cg.ranch = Math.round(((e.cg.ranch || 0) + net) * 100) / 100; // 関わって伸びた分(M/B管理)
  e.log = [...e.log, { s: amgSlotOf(now), a: kind === 'heavy' ? 'tktH' : 'tkt', k, g }].slice(-AMG_LOG);
  const S = AMG_STORE.state;
  amgSave({ ...S, mons: { ...S.mons, [aid]: { ...(S.mons[aid] || {}), [key]: e } } });
  const R2 = AMGR_STORE.state;
  amgrSave({ ...R2, last: { ...R2.last, [aid]: { a: life.abs, nick: row.nick || '', kind, rows } } });
  return { ok: true, nick: row.nick || '', kind, name: plan.name, rows, fat: kind === 'heavy' ? AMGR_NUM.heavyFat : 0 };
};

// ---------- 画面 ----------
const AMGR_HOST = { open: null, subs: new Set(), set(v) { this.open = v; this.subs.forEach(f => { try { f(v); } catch (_) {} }); } };
const assistantMasmonRanchOpen = (aid) => { if (!amgrOn() || !assistantMasmonRanchRowInfo(aid)) return false; AMGR_HOST.set({ assistantId: aid, at: Date.now() }); return true; };
// 地図・M/B管理の画面に1つずつ置く入れ物
function AssistantMasmonRanchHost() {
  const [open, setOpen] = useState(AMGR_HOST.open);
  useEffect(() => { const f = (v) => setOpen(v); AMGR_HOST.subs.add(f); return () => { AMGR_HOST.subs.delete(f); }; }, []);
  if (!open || !amgrOn()) return null;
  return <AssistantMasmonRanchSheet key={open.at} assistantId={open.assistantId} onClose={() => AMGR_HOST.set(null)}/>;
}
const amgrUseStores = () => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const f = () => setTick(n => n + 1);
    AMGR_STORE.subs.add(f); AMG_STORE.subs.add(f);
    void AMGR_STORE.load().then(f); void AMG_STORE.load().then(f);
    return () => { AMGR_STORE.subs.delete(f); AMG_STORE.subs.delete(f); };
  }, []);
};
const amgrSignText = (n) => (n >= 0 ? `+${n}` : `−${-n}`);
function AssistantMasmonRanchSheet({ assistantId, onClose }) {
  const aid = assistantId;
  amgrUseStores();
  const who = typeof assistantById === 'function' ? assistantById(aid) : null;
  const info0 = assistantMasmonRanchRowInfo(aid);
  const [key, setKey] = useState(info0 ? info0.ask.key : '');
  const [kind, setKind] = useState('light');
  const [k, setK] = useState(info0 ? info0.ask.k : 'life');
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => { let alive = true; (async () => { try { if (typeof amgTick === 'function') await amgTick(aid); } catch (_) {} if (alive) setReady(true); })(); return () => { alive = false; }; }, [aid]);
  const info = assistantMasmonRanchRowInfo(aid);
  const rows = amgrRowsOf(aid);
  const row = rows.find(r => amgMonKey(r.slot, r.monster) === key) || rows[0];
  const e = row && typeof amgEntryOf === 'function' ? amgEntryOf(aid, row) : null;
  const apt = row ? amgAptOf(row.monster) : {};
  const plan = amgrPlanOf(kind, k);
  const name = who ? who.name : aid;
  const monUsed = row && (AMGR_STORE.state.mon[aid] || {})[amgMonKey(row.slot, row.monster)] === amgrToday();
  const have = info ? info[kind] : 0;
  const block = !info ? `${name}はもうM/B管理にいません` : info.used && !res ? 'この時間帯はもう使いました(次は M/B管理に来たときに)' : !ready || !e ? '読み込み中です' : monUsed && !res ? `${row.nick || 'このマスモン'}には今日もう使いました` : e.st[k] >= AMG_MAX ? `${amgrStatName(k)}はもう上限です` : have <= 0 ? `${AMGR_TICKET_NAME[kind]}がありません` : '';
  const use = () => {
    if (!row) return;
    const r = assistantMasmonRanchUse(aid, amgMonKey(row.slot, row.monster), kind, k);
    if (r.ok) { setRes(r); setErr(''); try { if (typeof Audio_ !== 'undefined' && Audio_.se && Audio_.se.levelUp) Audio_.se.levelUp(); } catch (_) {} }
    else setErr(r.why === 'off' ? '' : r.why);
  };
  const btn = 'min-h-[44px] rounded-xl px-3 py-1 text-[12.5px] font-black text-white active:scale-95';
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60" onClick={onClose} data-amgr-sheet>
      <div className="w-full max-w-md rounded-t-3xl border-t-2 border-emerald-300/70 bg-slate-900 p-3 pb-6 text-white" onClick={ev => ev.stopPropagation()} style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
        <p className="text-[16px] font-black">🥚 {name}のマスモンにチケットを使う</p>
        <p className="text-[11px] font-bold text-slate-300">この時間帯に1枚。自分のモンスターには入りません・絆ランキングには効きません。上げた能力は、マスモン対戦の強さにも効きます</p>
        {info && <div className="mt-2 flex items-center gap-2">
          {who && typeof AssistantFace === 'function' && <span className="shrink-0"><AssistantFace who={who} size={40} accent={who.accent} expression={res ? 'happy' : null}/></span>}
          <p className="min-w-0 flex-1 rounded-xl bg-lime-100 px-3 py-2 text-[12.5px] font-black text-lime-950" data-amgr-say>{res ? `わあ、${res.nick}がんばったね！ ありがとう！` : assistantMasmonRanchAskText(aid, info.ask, info.abs, true)}</p>
        </div>}
        {res ? (
          <div className="mt-3 rounded-2xl border-2 border-emerald-300 bg-emerald-950 p-3" data-amgr-result>
            <p className="text-[13px] font-black">{res.kind === 'heavy' ? '🏋️' : '🎫'} {res.name}({AMGR_TICKET_NAME[res.kind]})</p>
            {res.rows.map(r => <p key={r.k} className="mt-1 flex justify-between text-[13px] font-black" data-amgr-row={r.k}><span>{amgrStatName(r.k)}</span><span className={r.to >= r.from ? 'text-emerald-300' : 'text-rose-300'}>{r.from} → {r.to}({amgrSignText(r.to - r.from)})</span></p>)}
            {res.fat > 0 && <p className="mt-1 flex justify-between text-[11px] font-bold text-slate-300"><span>疲れ</span><span>+{res.fat}</span></p>}
            <button type="button" onClick={onClose} data-mhl-sheet-close className={`${btn} mt-3 w-full bg-slate-700`}>閉じる</button>
          </div>
        ) : (<>
          {rows.length > 1 && <div className="mt-2 flex flex-wrap gap-1.5" data-amgr-mons>
            {rows.map(r => { const kk = amgMonKey(r.slot, r.monster); const m = ALL_PLAYER_MONSTERS[r.monster]; return (
              <button key={kk} type="button" onClick={() => setKey(kk)} className={`flex min-h-[44px] items-center gap-1 rounded-xl border px-2 text-[11.5px] font-black ${kk === (row && amgMonKey(row.slot, row.monster)) ? 'border-emerald-300 bg-emerald-900' : 'border-white/15 bg-slate-800'}`}>
                {m && m.iconUrl && <img src={m.iconUrl} alt="" className="h-7 w-7 object-contain"/>}{r.nick || (m && m.name) || ''}{info && kk === info.ask.key && <span className="rounded bg-amber-300 px-1 text-[9.5px] text-slate-900">頼み</span>}
              </button>); })}
          </div>}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {['light', 'heavy'].map(x => <button key={x} type="button" onClick={() => setKind(x)} data-amgr-kind={x} className={`min-h-[44px] rounded-xl border text-[12px] font-black ${kind === x ? (x === 'heavy' ? 'border-orange-300 bg-orange-800' : 'border-emerald-300 bg-emerald-800') : 'border-white/20 bg-slate-800'}`}>{x === 'heavy' ? '🎟️ 重トレーニング' : '🎫 トレーニング'}<small className="block text-[10px] font-bold text-slate-200">のこり {info ? info[x] : 0}枚</small></button>)}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5" data-amgr-stats>
            {AMG_KEYS.map(s => <button key={s} type="button" onClick={() => setK(s)} data-amgr-stat={s} className={`flex min-h-[52px] flex-col items-center justify-center rounded-xl border text-[12px] font-black ${k === s ? 'border-2 border-emerald-300 bg-emerald-900' : 'border-white/15 bg-slate-800'}`}>
              {info && row && s === info.ask.k && amgMonKey(row.slot, row.monster) === info.ask.key && <span className="rounded bg-amber-300 px-1 text-[9.5px] text-slate-900">頼み</span>}
              {amgrStatName(s)}<small className="text-[10.5px] font-bold text-slate-300">{e ? e.st[s] : '—'} ・{apt[s] || 'C'}</small></button>)}
          </div>
          <p className="mt-2 text-[11px] font-bold leading-relaxed text-amber-200" data-amgr-plan>{kind === 'heavy'
            ? `${plan.name}: ${amgrStatName(plan.main)}が大きく上がり、${amgrStatName(plan.sub)}も少し上がる。かわりに${amgrStatName(plan.down)}が少し下がる。疲れが少したまる`
            : `${plan.name}: ${amgrStatName(plan.main)}が上がる`}</p>
          {(err || block) && <p className="mt-1 text-[11px] font-bold text-rose-200" data-amgr-why>{err || block}</p>}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <button type="button" onClick={onClose} data-mhl-sheet-close className={`${btn} bg-slate-700`}>やめる</button>
            <button type="button" disabled={!!block} onClick={use} data-amgr-use className={`${btn} ${block ? 'bg-slate-700 text-slate-400' : kind === 'heavy' ? 'bg-orange-700' : 'bg-emerald-700'}`}>この1枚を使う<small className="block text-[10px] font-bold">{AMGR_TICKET_NAME[kind]} のこり {have} → {Math.max(0, have - 1)}枚</small></button>
          </div>
        </>)}
      </div>
    </div>);
}
// M/B管理の画面の帯(助手が来ているときだけ)
function AssistantMasmonRanchBand() {
  amgrUseStores();
  if (!amgrOn()) return null;
  const ids = assistantMasmonRanchIds();
  if (!ids.length) return null;
  const nm = (id) => (typeof assistantLifeName === 'function' ? assistantLifeName(id) : id);
  const open = ids.filter(id => { const x = assistantMasmonRanchRowInfo(id); return x && !x.used; });
  const first = open[0] ? assistantMasmonRanchRowInfo(open[0]) : null;
  return (<>
    <div className="w-full max-w-md mx-auto mb-2 rounded-2xl border border-emerald-300/70 bg-emerald-950/90 p-2.5 text-white" data-amgr-band>
      <p className="text-[12px] font-black">🥚 {ids.map(nm).join('・')}が来ています</p>
      {first && <p className="text-[11.5px] font-bold text-emerald-100">{nm(open[0])}「{assistantMasmonRanchAskText(open[0], first.ask, first.abs)}」</p>}
      {open.length ? <button type="button" onClick={() => assistantMasmonRanchOpen(open[0])} data-amgr-band-open className="mt-1.5 min-h-[44px] w-full rounded-xl bg-emerald-500 px-3 text-[12.5px] font-black text-emerald-950 active:scale-95">🎫 助手のマスモンにチケットを使う(あと{open.length}人)</button>
        : <p className="mt-1 text-[11px] font-bold text-slate-300">この時間帯はみんなに使いました</p>}
    </div>
    <AssistantMasmonRanchHost/>
  </>);
}

// ===== 助手ライフ: フレンドの家で「その人の助手のマスモン」をくわしく見せる(送る側・受け取りの形) =====
// 2026-11-12 社長「自分のと同じぐらい見れるようにして」「マスモンって助手ライフのほうね」(オトズレ・案 docs/progress/assistant-peer/FRIEND-SHOWCASE-PLAN.md)
// 社長の選択: 送り方は変わった分だけ/見せる設定ははじめは入/デッキは今の3つ(推し・好き・素顔)の中身だけ/6つの能力は数字まで/
//   見る専用の口はキズナ(助手マスモン)・ツナグ(カード部)に足してもらう。見る画面はキズナの計画育成のページの案が決まってから組む
//
// 表: alf_masmon_share(docs/sql/assistant-life/ALF_MASMON_SHARE_ADD.sql・足すだけ)。1人×助手で1行。
//   body = { v:1, ms:[マスモン], wt:まだの枠の数, dk:[デッキ] } か、見せない設定のときは { v:1, off:1 }
// 保存: mh_alf_masmon_share_sent_v1(助手ごとに前に送った中身の指紋と時刻。新しいキー)。見せる設定は今の設定(mh_*の行き来の設定)に項目 ms を足す
// 公開の印: RELEASE_FLAGS.alfMasmonShareSend(送る)。偽のあいだは何も送らない。表が無ければ、その回はそれ以後送らない・読まない
// 口(読むだけ。無ければ今ある口だけで送る):
//   キズナ  assistantLifeMasmonShareOf(aid) → { list:[{ monster, nick, colors, lead, slot, lv, grow, growMine, stats:{life,pow,wise,hit,eva,tough}, why }], waiting }
//   ツナグ  cardAssistantDeckShareOf(aid, face) → { name, line, monsters:[3], ace, cards:[[カードid, 枚数], …] } | null
// ほかのプレイヤーの名前・ブリーダーIDは中身に入れない(だれの行かは表の breeder_id だけ)

const ALF_MS_TABLE = 'alf_masmon_share';
const ALF_MS_SENT_KEY = 'mh_alf_masmon_share_sent_v1';
const ALF_MS_GAP_MS = 10 * 60 * 1000;      // 変わってから送るまでの最短の間隔(助手ごと)
// 中身が同じでも日が替わったら1回は送り直す(だれでも書ける表なので、ほかの人に書き換えられても1日で元に戻す・ミハリ4/最終確認で「24時間」から日替わりへ)
const ALF_MS_MAX_CHARS = 4800;             // 表の決まり(5000)より少し下
const ALF_MS_FACES = Object.freeze(['oshi', 'suki', 'sugao']);
const ALF_MS_STATS = Object.freeze(['life', 'pow', 'wise', 'hit', 'eva', 'tough']);
let _alfMsMissing = false;

const alfMsSendOn = () => typeof RELEASE_FLAGS !== 'undefined' && !!RELEASE_FLAGS && RELEASE_FLAGS.alfMasmonShareSend === true;
const alfMsMonOk = (mo) => typeof mo === 'string' && typeof ALL_PLAYER_MONSTERS !== 'undefined' && !!ALL_PLAYER_MONSTERS[mo];
// デッキの3体はカードのモンスター番号(例 C-001・C-001S)。マスモンの種類(ALL_PLAYER_MONSTERS のキー)とは別の形(2026-11-12 突き合わせで分かった)
const alfMsDeckMonOk = (no) => typeof no === 'string' && /^[A-Za-z0-9_-]{1,20}$/.test(no) && !(typeof CARD_BATTLE_DATA !== 'undefined' && CARD_BATTLE_DATA && CARD_BATTLE_DATA.monsters && !CARD_BATTLE_DATA.monsters[no]);
const alfMsCardOk = (id) => typeof id === 'string' && /^[A-Za-z0-9_:-]{1,40}$/.test(id);
const alfMsText = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f{}<>]/g, '').slice(0, max) : '');
// 型は知っている名前(AMG_POLICY のキー)だけ通す。だれでも書ける表なので、自由な字は出さない(ミハリ 最終確認)
const alfMsKind = (v) => { const t = alfMsText(v, 16); return t && typeof AMG_POLICY !== 'undefined' && AMG_POLICY && Object.prototype.hasOwnProperty.call(AMG_POLICY, t) ? t : ''; };
const alfMsDay = (t) => (typeof alfDay === 'function' ? alfDay(t) : new Date(Number(t) + 5 * 3600000).toISOString().slice(0, 10));
const alfMsWord = (v, max) => { const t = alfMsText(v, max); return t && typeof alfNoteShow === 'function' ? alfNoteShow(t) : ''; };

// 1体を送る形にする(壊れた値・知らないモンスターは null)
const alfMsPackMon = (t) => {
  if (!t || !alfMsMonOk(t.monster)) return null;
  const st = t.stats && typeof t.stats === 'object' ? t.stats : null;
  return {
    mo: t.monster, n: alfMsWord(t.nick, 16),
    c: (Array.isArray(t.colors) ? t.colors : []).slice(0, 5).map(x => (typeof x === 'string' && ALF_COLOR_RE.test(x) ? x : null)),
    ...(t.lead ? { l: 1 } : {}),
    ...(Number.isFinite(Number(t.slot)) ? { s: alfInt(t.slot, 0, 99) } : {}),
    ...(Number.isFinite(Number(t.lv)) ? { lv: alfInt(t.lv, 1, 999) } : {}),
    ...(alfMsKind(t.grow) ? { g: alfMsKind(t.grow) } : {}),
    ...(alfMsKind(t.growMine) ? { gm: alfMsKind(t.growMine) } : {}),
    ...(st ? { st: ALF_MS_STATS.map(k => alfInt(st[k], 0, 9999)) } : {}),
    ...(alfMsWord(t.why, 40) ? { w: alfMsWord(t.why, 40) } : {}),
  };
};
// デッキ1つを送る形にする
const alfMsPackDeck = (face, d) => {
  if (!d || typeof d !== 'object' || !ALF_MS_FACES.includes(face)) return null;
  const cards = (Array.isArray(d.cards) ? d.cards : []).map(x => (Array.isArray(x) && alfMsCardOk(x[0]) ? [x[0], alfInt(x[1], 1, 50, 1)] : null)).filter(Boolean).slice(0, 50);
  if (!cards.length) return null;
  return {
    f: face, nm: alfMsWord(d.name, 24),
    ...(alfMsWord(d.line, 40) ? { ln: alfMsWord(d.line, 40) } : {}),
    m: (Array.isArray(d.monsters) ? d.monsters : []).filter(alfMsDeckMonOk).slice(0, 3),
    ...(alfMsText(d.ace, 20) ? { a: alfMsText(d.ace, 20) } : {}),
    cd: cards,
  };
};
// 1人の助手ぶんの中身(口が無い・読めないときは、今ある口 assistantLifeMasmonTeamOf だけで作る)
const alfMsBuild = (aid) => {
  let list = []; let waiting = 0;
  try {
    const r = typeof assistantLifeMasmonShareOf === 'function' ? assistantLifeMasmonShareOf(aid) : null;
    if (r && Array.isArray(r.list)) { list = r.list; waiting = alfInt(r.waiting, 0, 20); }
    else if (Array.isArray(r)) list = r;
    else if (typeof assistantLifeMasmonTeamOf === 'function') list = assistantLifeMasmonTeamOf(aid);
  } catch (_) { list = []; }
  const ms = list.map(alfMsPackMon).filter(Boolean).slice(0, 8);
  const dk = [];
  for (const f of ALF_MS_FACES) {
    try { const d = typeof cardAssistantDeckShareOf === 'function' ? alfMsPackDeck(f, cardAssistantDeckShareOf(aid, f)) : null; if (d) dk.push(d); } catch (_) {}
  }
  let body = { v: 1, ms, ...(waiting ? { wt: waiting } : {}), ...(dk.length ? { dk } : {}) };
  // 大きすぎたら、カードの多いデッキから中身を減らす → それでも大きければデッキを外す
  const size = (o) => JSON.stringify(o).length;
  while (size(body) > ALF_MS_MAX_CHARS && body.dk && body.dk.length) {
    const dk2 = body.dk.slice(0, -1);
    body = { ...body, ...(dk2.length ? { dk: dk2 } : {}) }; if (!dk2.length) delete body.dk;
  }
  return size(body) > ALF_MS_MAX_CHARS ? { v: 1, ms: ms.slice(0, 5).map(({ w: _w, ...rest }) => rest) } : body;
};

// 受け取った中身を整える(型を確かめ、知らないモンスター・カード・壊れた値は捨てる)。見せていない人は { off:true }、無い・壊れていれば null
const alfMsNormalize = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.off === 1) return { off: true, ms: [], dk: [], wt: 0 };
  const ms = (Array.isArray(raw.ms) ? raw.ms : []).slice(0, 8).map(t => {
    if (!t || typeof t !== 'object' || !alfMsMonOk(t.mo)) return null;
    const st = Array.isArray(t.st) && t.st.length === ALF_MS_STATS.length ? Object.fromEntries(ALF_MS_STATS.map((k, i) => [k, alfInt(t.st[i], 0, 9999)])) : null;
    return {
      monster: t.mo, nick: alfMsWord(t.n, 16), colors: (Array.isArray(t.c) ? t.c : []).slice(0, 5).map(x => (typeof x === 'string' && ALF_COLOR_RE.test(x) ? x : null)),
      lead: t.l === 1, slot: Number.isFinite(Number(t.s)) ? alfInt(t.s, 0, 99) : null, lv: Number.isFinite(Number(t.lv)) ? alfInt(t.lv, 1, 999) : null,
      grow: alfMsKind(t.g), growMine: alfMsKind(t.gm), stats: st, why: alfMsWord(t.w, 40),
    };
  }).filter(Boolean);
  const dk = (Array.isArray(raw.dk) ? raw.dk : []).slice(0, 3).map(d => {
    if (!d || typeof d !== 'object' || !ALF_MS_FACES.includes(d.f)) return null;
    const cards = (Array.isArray(d.cd) ? d.cd : []).map(x => (Array.isArray(x) && alfMsCardOk(x[0]) ? [x[0], alfInt(x[1], 1, 50, 1)] : null)).filter(Boolean).slice(0, 50);
    return cards.length ? { face: d.f, name: alfMsWord(d.nm, 24), line: alfMsWord(d.ln, 40), monsters: (Array.isArray(d.m) ? d.m : []).filter(alfMsDeckMonOk).slice(0, 3), ace: alfMsText(d.a, 20), cards } : null;
  }).filter(Boolean);
  return { off: false, ms, dk, wt: alfInt(raw.wt, 0, 20) };
};

// 前に送った指紋 { v:1, at:{ aid: 時刻 }, sig:{ aid: 指紋 } }(壊れていれば空)
const normalizeAlfMsSent = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const at = {}; const sig = {};
  for (const id of ALF_IDS) {
    if (o.at && Number.isFinite(Number(o.at[id])) && Number(o.at[id]) > 0) at[id] = Number(o.at[id]);
    if (o.sig && typeof o.sig[id] === 'string' && /^[a-z0-9]{1,16}$/.test(o.sig[id])) sig[id] = o.sig[id];
  }
  return { v: 1, at, sig };
};
let _alfMsSent = null;
const alfMsLoadSent = async () => {
  if (_alfMsSent) return _alfMsSent;
  let raw = null; try { raw = typeof storeGet === 'function' ? await storeGet(ALF_MS_SENT_KEY, null, false) : null; } catch (_) { raw = null; }
  _alfMsSent = normalizeAlfMsSent(raw);
  return _alfMsSent;
};

// 送る(alfPublish の後ろから呼ぶ)。ids … 家にいる助手(迎えた助手)。show … 見せる設定。変わった助手の行だけ・助手ごとに10分あける
//   force … 見せる設定を変えたとき(間隔を見ない)。送った数を返す
const alfMsPublish = async (self, ids, show, now = Date.now(), { force = false } = {}) => {
  if (!alfMsSendOn() || _alfMsMissing || !alfSafeOther(self)) return 0;
  const sent = await alfMsLoadSent();
  let n = 0;
  for (const aid of (Array.isArray(ids) ? ids : []).filter(id => ALF_IDS.includes(id))) {
    const body = show ? alfMsBuild(aid) : { v: 1, off: 1 };
    if (!body.off && !body.ms.length) continue;
    const sig = alfSig(JSON.stringify(body));
    if (sig === sent.sig[aid] && sent.at[aid] && alfMsDay(sent.at[aid]) === alfMsDay(now)) continue;
    // 見せる/見せないを切り替えたぶんは間隔を待たない
    const flip = body.off || sent.sig[aid] === alfSig(JSON.stringify({ v: 1, off: 1 }));
    if (!force && !flip && sent.at[aid] && now - sent.at[aid] < ALF_MS_GAP_MS) continue;
    try {
      await alfRequest(`${ALF_MS_TABLE}?on_conflict=breeder_id,assistant_id`, { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: { breeder_id: self, assistant_id: aid, body }, soft: true });
      sent.at[aid] = now; sent.sig[aid] = sig; n += 1;
    } catch (e) { if (e && e.missing) { _alfMsMissing = true; break; } }
  }
  if (n) { _alfMsSent = sent; try { if (typeof storeSet === 'function') await storeSet(ALF_MS_SENT_KEY, sent, false); } catch (_) {} }
  return n;
};

// 訪ねた家の、1人の助手のマスモンを読む(開いたときの1行だけ)。無い・表が無い・読めないときは null(今までどおり絵と名前だけで出す)
const alfMsFetch = async (hostId, aid) => {
  if (_alfMsMissing || !alfSafeOther(hostId) || !ALF_IDS.includes(aid)) return null;
  try {
    const rows = await alfRequest(`${ALF_MS_TABLE}?select=body,updated_at&breeder_id=eq.${encodeURIComponent(hostId)}&assistant_id=eq.${aid}&limit=1`, { soft: true });
    return Array.isArray(rows) && rows[0] ? alfMsNormalize(rows[0].body) : null;
  } catch (e) { if (e && e.missing) _alfMsMissing = true; return null; }
};


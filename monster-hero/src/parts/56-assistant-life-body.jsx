// ===== 助手ライフ: 助手の疲れ・ストレス・けが・病気と 🏥 病院(ナカヨシ 2026-11-12)=====
// 社長 2026-11-12「どこに行っても意味があるように(寝る以外)」「助手にも疲れ・ストレス。けがとか」「助手専用の病院」。
//   答え(窓口経由): 呼び名は助手も「疲れ・ストレス」(たまると悪い・マスモンと同じ線)/けが・病気はいつでも起きる(おまかせの回は
//   助手が自分で休みを選びやすい)/病院は基本無料で予定の1マスを使う・重いと何回か通う(ビートPの上の治療は次の段)
//   案と止め絵 docs/progress/assistant-peer/life-places/PLAN.md。検査 tools/assistant/life-body-check.js
// 作り:
//   ・生活は「開いたときに今の回だけ決める」(assistantLifeNow)。ここはその2か所に差し込むだけ:
//     assistantLifeBodyOnDecide … 決めた様子を直す(けが・病気の助手は家か病院・サボった助手は家へ帰る・疲れた助手は自分で休む)
//     assistantLifeBodyOnSlot   … その回の場所で疲れ・ストレスを動かし、けが・病気を決めて保存する
//   ・サボり・けが・病気は「家にいる」で表す → ビート・カード・修行・M/B管理の得は、場所を見ている今の仕組みのまま自然に止まる
//   ・見ていない回(アプリを開いていない間)は「おまかせで休んでいた」として少しずつ戻す(さかのぼって疲れさせない)
//   ・決まり方は回ごとの決まった乱数(開き直しても変わらない)
// 保存(新しいキーだけ。既存のキーは読むだけ・CLAUDE.md ⑦):
//   mh_assistant_life_body_v1 = { v:1, at: 最後に進めた回(abs), s: { [助手id]: { fat, st, cond: { k:'hurt'|'sick', sev:'light'|'heavy', left: 自然に治るまでの回, visits: あと何回病院 } | null } },
//                                 log: { [助手id]: [{ abs, place, ev, why? }] }(最近36回) }
//     why … 体のせいで行き先が変わった回だけ: 'skip'(疲れてサボって家へ)/'cond'(けが・病気で家か病院へ)/'rest'(おまかせで自分で休んだ)
//   読めない・壊れている → はじめの値(疲れ20・ストレス20・何も起きていない)
// 公開の印 RELEASE_FLAGS.assistantLifeBody の後ろ。偽のあいだは何もしない・何も読まない・何も出さない

const ASSISTANT_LIFE_BODY_KEY = 'mh_assistant_life_body_v1';
// 場所ごとの1回(2時間)の動き。fat … 疲れ / st … ストレス(どちらも 0〜100・たまると悪い)/ hard … 体を使う(けがが起きうる)
const ASSISTANT_LIFE_BODY_PLACE = Object.freeze({
  battle:   { fat: 12,  st: 5,   hard: true },
  studio:   { fat: 10,  st: -5,  hard: true },
  ranch:    { fat: 10,  st: 5,   hard: true },
  plaza:    { fat: 3,   st: -8,  hard: true },
  cardroom: { fat: 5,   st: 3 },
  library:  { fat: 3,   st: 3 },
  cafe:     { fat: -5,  st: -15 },
  garden:   { fat: -5,  st: -10 },
  hill:     { fat: -10, st: -10 },
  home:     { fat: -10, st: -5 },
  clinic:   { fat: -15, st: 0 },
  temple:   { fat: 0,   st: -5 },
  market:   { fat: 3,   st: -3 },
});
const ASSISTANT_LIFE_BODY_SLEEP_FAT = -25; // 家で寝ている回
const ASSISTANT_LIFE_BODY_FAV_ST = -5;     // 好きな場所へ行くと、さらにストレスが下がる
const ASSISTANT_LIFE_BODY_START = Object.freeze({ fat: 20, st: 20 });
// 線はマスモン(育成ノートの疲れ・ストレス)と同じ: 疲れ60で黄・70で赤/ストレス50で黄・60で赤
const ASSISTANT_LIFE_BODY_LINE = Object.freeze({ fatWarn: 60, fatBad: 70, stWarn: 50, stBad: 60, sulky: 80 });
// けが・病気の重さ。slots … 自然に治るまでの回(12回=1日) / visits … 病院へ何回行けば治るか
const ASSISTANT_LIFE_BODY_COND = Object.freeze({
  hurt: { light: { slots: 24, visits: 1 }, heavy: { slots: 48, visits: 2 } },
  sick: { light: { slots: 36, visits: 2 }, heavy: { slots: 60, visits: 3 } },
});
const ASSISTANT_LIFE_BODY_GAP = Object.freeze({ fat: -8, st: -3, max: 84 }); // 見ていない1回ごと(7日まで)
const ASSISTANT_LIFE_BODY_REST = Object.freeze(['home', 'hill', 'cafe', 'garden', 'clinic']); // 休む場所(ここではサボらない)
const ASSISTANT_LIFE_BODY_LOG_MAX = 36;
const ASSISTANT_LIFE_BODY_WHY = Object.freeze(['skip', 'cond', 'rest']);
// 予定表で出す名前(施設の名前を先に。台詞の {place} は今の ASSISTANT_LIFE_PLACES のまま)
const ASSISTANT_LIFE_BODY_LABEL = Object.freeze({ studio: ['モンヒロビート', '練習スタジオ'], ranch: ['M/B管理', '育成場'], cardroom: ['MFバトルカード', 'カード部屋'] });
// 得の1行(町の場所・家・病院)。ビート・カード・M/B管理の文は assistantLifePlacePerkTail(56-assistant-life-ux.jsx)のまま。
//   そこの最後からここを呼ぶので、予定表・地図の場所の窓・家の帯の「いま行くと得」が同じ文になる
const ASSISTANT_LIFE_BODY_PERK = Object.freeze({
  cafe: 'ストレスが大きく下がる・一緒の助手となかよく',
  plaza: 'ほかの助手と会いやすい・なかよく',
  garden: 'マスモンが遊んでストレスが下がる',
  hill: 'ごきげんに(次のお願いが通りやすい)',
  library: 'マスモンの技が少し伸びる',
  home: '疲れがいちばん取れる(寝ると たくさん)',
  clinic: 'けが・病気を治す(マスモンも)',
});
// 一緒に過ごすと助手どうしのきずなが上がる場所(1回 +2・1日 4 まで。data/assistants.js の outing)
const ASSISTANT_LIFE_BODY_OUTING = Object.freeze(['cafe', 'plaza']);

const assistantLifeBodyOn = () => {
  try { return typeof assistantLifeEnabled === 'function' && assistantLifeEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeBody === true; } catch (_) { return false; }
};
const assistantLifeBodyClamp = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const assistantLifeBodyOkId = (id) => typeof id === 'string' && typeof ASSISTANT_LIFE_PREFS !== 'undefined' && !!ASSISTANT_LIFE_PREFS[id];
const assistantLifeBodyFresh = () => ({ fat: ASSISTANT_LIFE_BODY_START.fat, st: ASSISTANT_LIFE_BODY_START.st, cond: null });
const normalizeAssistantLifeBodyCond = (c) => {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  if (!ASSISTANT_LIFE_BODY_COND[c.k] || !ASSISTANT_LIFE_BODY_COND[c.k][c.sev]) return null;
  const left = Number(c.left), visits = Number(c.visits);
  if (!Number.isInteger(left) || left <= 0 || !Number.isInteger(visits) || visits <= 0) return null;
  return { k: c.k, sev: c.sev, left: Math.min(left, 120), visits: Math.min(visits, 5) };
};
// 保存の値を形へ(壊れている → 空)
const normalizeAssistantLifeBody = (raw) => {
  const out = { v: 1, at: null, s: {}, log: {} };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  if (Number.isInteger(raw.at) && raw.at >= 0) out.at = raw.at;
  if (raw.s && typeof raw.s === 'object' && !Array.isArray(raw.s)) {
    for (const [id, e] of Object.entries(raw.s)) {
      if (!assistantLifeBodyOkId(id) || !e || typeof e !== 'object' || Array.isArray(e)) continue;
      const fat = typeof e.fat === 'number' ? e.fat : NaN, st = typeof e.st === 'number' ? e.st : NaN;
      out.s[id] = { fat: Number.isFinite(fat) ? assistantLifeBodyClamp(fat) : ASSISTANT_LIFE_BODY_START.fat, st: Number.isFinite(st) ? assistantLifeBodyClamp(st) : ASSISTANT_LIFE_BODY_START.st, cond: normalizeAssistantLifeBodyCond(e.cond) };
    }
  }
  if (raw.log && typeof raw.log === 'object' && !Array.isArray(raw.log)) {
    for (const [id, list] of Object.entries(raw.log)) {
      if (!assistantLifeBodyOkId(id) || !Array.isArray(list)) continue;
      const ok = list.filter(r => r && Number.isInteger(r.abs) && typeof r.place === 'string').map(r => ({ abs: r.abs, place: r.place, ev: typeof r.ev === 'string' ? r.ev : '', ...(ASSISTANT_LIFE_BODY_WHY.includes(r.why) ? { why: r.why } : {}) }));
      if (ok.length) out.log[id] = ok.slice(-ASSISTANT_LIFE_BODY_LOG_MAX);
    }
  }
  return out;
};

// ---------- 計算(純粋な関数。検査が直接呼ぶ) ----------
// 1人の1回ぶん。place・doing … その回の居場所 / fav … 好きな場所 / rand … 0〜1 を返す関数(けが・病気を決める)
// 返す: { e: 次の値, ev: ''|'hurt'|'sick'|'healed'|'clinic' }
const assistantLifeBodyStepOne = (e0, place, doing, fav, rand) => {
  const e = { fat: e0.fat, st: e0.st, cond: e0.cond ? { ...e0.cond } : null };
  const P = ASSISTANT_LIFE_BODY_PLACE[place] || { fat: 0, st: 0 };
  e.fat = assistantLifeBodyClamp(e.fat + (place === 'home' && doing === 'sleep' ? ASSISTANT_LIFE_BODY_SLEEP_FAT : P.fat));
  e.st = assistantLifeBodyClamp(e.st + P.st + (place === fav && place !== 'home' ? ASSISTANT_LIFE_BODY_FAV_ST : 0));
  let ev = '';
  if (e.cond) {
    e.cond.left -= 1;
    if (place === 'clinic') { e.cond.visits -= 1; ev = 'clinic'; }
    if (e.cond.k === 'sick') e.st = assistantLifeBodyClamp(e.st - 5); // 病気の間はストレスが少しずつ下がる
    if (e.cond.left <= 0 || e.cond.visits <= 0) { e.cond = null; ev = 'healed'; }
    return { e, ev };
  }
  const L = ASSISTANT_LIFE_BODY_LINE;
  const r = rand();
  const pHurt = P.hard && e.fat >= L.fatBad ? Math.min(0.3, (e.fat - L.fatBad) * 0.015) : 0;
  const pSick = e.st >= L.stBad && place !== 'clinic' ? Math.min(0.3, (e.st - L.stBad) * 0.01) : 0;
  let k = null, over = 0;
  if (r < pHurt) { k = 'hurt'; over = e.fat - L.fatBad; }
  else if (r < pHurt + pSick) { k = 'sick'; over = e.st - L.stBad; }
  if (k) {
    const sev = rand() < Math.min(0.6, over * 0.03) ? 'heavy' : 'light';
    const c = ASSISTANT_LIFE_BODY_COND[k][sev];
    e.cond = { k, sev, left: c.slots, visits: c.visits };
    ev = k;
  }
  return { e, ev };
};
// 見ていない回(n回)。おまかせで休んでいたとして少しずつ戻し、けが・病気は自然に治っていく
const assistantLifeBodyGapOne = (e0, n) => {
  const m = Math.max(0, Math.min(ASSISTANT_LIFE_BODY_GAP.max, Math.floor(n)));
  if (!m) return e0;
  const e = { fat: assistantLifeBodyClamp(e0.fat + ASSISTANT_LIFE_BODY_GAP.fat * m), st: assistantLifeBodyClamp(e0.st + ASSISTANT_LIFE_BODY_GAP.st * m), cond: e0.cond ? { ...e0.cond } : null };
  if (e.cond) { e.cond.left -= m; if (e.cond.left <= 0) e.cond = null; }
  return e;
};
// サボる見込み(0〜0.35)。休む場所ではサボらない
const assistantLifeBodySkipChance = (e, place) => {
  if (!e || ASSISTANT_LIFE_BODY_REST.includes(place)) return 0;
  const L = ASSISTANT_LIFE_BODY_LINE;
  return Math.min(0.35, Math.max(0, e.fat - L.fatWarn) * 0.01 + Math.max(0, e.st - L.stWarn) * 0.01);
};
// けがの見込み(その場所の回の終わりの値で)
const assistantLifeBodyHurtChance = (fat, place) => {
  const P = ASSISTANT_LIFE_BODY_PLACE[place];
  return P && P.hard && fat >= ASSISTANT_LIFE_BODY_LINE.fatBad ? Math.min(0.3, (fat - ASSISTANT_LIFE_BODY_LINE.fatBad) * 0.015) : 0;
};
const assistantLifeBodySickChance = (st, place) => (st >= ASSISTANT_LIFE_BODY_LINE.stBad && place !== 'clinic' ? Math.min(0.3, (st - ASSISTANT_LIFE_BODY_LINE.stBad) * 0.01) : 0);
// 1つの場所へ行ったら値がどうなるか(見通し・乱数なし)。寝るかは時間で(夜・深夜の家は寝る)
const assistantLifeBodyPreview = (e, place, abs, fav) => {
  const s = typeof assistantLifeSlotOfAbs === 'function' ? assistantLifeSlotOfAbs(abs) : null;
  const sleep = place === 'home' && s && (s.id === 'late' || s.id === 'night');
  const P = ASSISTANT_LIFE_BODY_PLACE[place] || { fat: 0, st: 0 };
  const fat = assistantLifeBodyClamp(e.fat + (sleep ? ASSISTANT_LIFE_BODY_SLEEP_FAT : P.fat));
  const st = assistantLifeBodyClamp(e.st + P.st + (place === fav && place !== 'home' ? ASSISTANT_LIFE_BODY_FAV_ST : 0));
  return { fat, st, skip: assistantLifeBodySkipChance(e, place), hurt: assistantLifeBodyHurtChance(fat, place), sick: assistantLifeBodySickChance(st, place) };
};

// ---------- 保存 ----------
const ASSISTANT_LIFE_BODY_STORE = {
  state: { loaded: false, data: normalizeAssistantLifeBody(null) }, listeners: new Set(), loading: null,
  set(patch) { this.state = { ...this.state, ...patch }; for (const fn of this.listeners) { try { fn(this.state); } catch (_) {} } },
  load() {
    if (this.state.loaded) return Promise.resolve(this.state);
    if (this.loading) return this.loading;
    this.loading = (async () => {
      let raw = null; try { raw = await storeGet(ASSISTANT_LIFE_BODY_KEY, null, false); } catch (_) { raw = null; }
      this.set({ loaded: true, data: normalizeAssistantLifeBody(raw) });
      return this.state;
    })();
    return this.loading;
  },
};
const assistantLifeBodySave = (data) => { ASSISTANT_LIFE_BODY_STORE.set({ data }); try { storeSet(ASSISTANT_LIFE_BODY_KEY, data, false); } catch (_) {} };
// 今の値(印が偽・読み込み前 → null)
const assistantLifeBodyOf = (id) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded || !assistantLifeBodyOkId(id)) return null;
  return ASSISTANT_LIFE_BODY_STORE.state.data.s[id] || assistantLifeBodyFresh();
};
const assistantLifeBodyCondOf = (id) => { const e = assistantLifeBodyOf(id); return e ? e.cond : null; };

// ---------- 生活への差し込み ----------
const assistantLifeBodyWhere = (life, id) => {
  const g = (life.groups || []).find(x => x.ids.includes(id));
  if (g) return { place: g.place, doing: g.doing };
  const s = (life.solo || {})[id]; return s ? { place: s.place, doing: s.doing } : null;
};
// assistantLifeNow から: 決めた様子(予定を当てたあと)を体の状態で直す。印が偽なら decided のまま
const assistantLifeBodyOnDecide = (decided, salt = '') => {
  try {
    if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded || !decided || typeof assistantLifePlanApply !== 'function') return decided;
    const abs = decided.abs;
    const D = ASSISTANT_LIFE_BODY_STORE.state.data;
    const gap = Number.isInteger(D.at) && abs > D.at ? abs - D.at - 1 : 0;
    const ids = [...new Set([...(decided.groups || []).flatMap(g => g.ids), ...Object.keys(decided.solo || {})])].sort();
    const slot = assistantLifeSlotOfAbs(abs);
    const day = slot.id !== 'late' && slot.id !== 'night';
    const want = {}; const why = {};
    for (const id of ids) {
      const e = assistantLifeBodyGapOne(D.s[id] || assistantLifeBodyFresh(), gap);
      const w = assistantLifeBodyWhere(decided, id); if (!w) continue;
      const asked = typeof assistantLifePlanResultOf === 'function' && assistantLifePlanResultOf(abs, id) === 'ok';
      const rand = assistantLifeRng(`${salt}|body-go|${abs}|${id}`);
      if (e.cond) {
        // けが・病気: 予定で病院なら病院。おまかせでも昼のあいだはときどき自分で病院へ。それ以外は家で休む
        if (asked && w.place === 'clinic') continue;
        want[id] = day && rand() < 0.35 ? 'clinic' : 'home'; why[id] = 'cond';
        continue;
      }
      if (rand() < assistantLifeBodySkipChance(e, w.place)) { want[id] = 'home'; why[id] = 'skip'; continue; } // サボって家へ帰る
      if (!asked) { // おまかせの回は、疲れ・ストレスがたまっていれば自分で休む所を選びやすい
        // 休みたくなる見込み: 疲れ50・ストレス45から、高いほど強く(最大95%)
        const pf = e.fat >= 50 ? Math.min(0.95, 0.5 + (e.fat - 50) * 0.03) : 0;
        const ps = e.st >= 45 ? Math.min(0.95, 0.5 + (e.st - 45) * 0.03) : 0;
        if (ASSISTANT_LIFE_BODY_REST.includes(w.place)) { /* もう休んでいる */ }
        else if (pf && rand() < pf) { want[id] = 'home'; why[id] = 'rest'; }
        else if (ps && rand() < ps) { want[id] = rand() < 0.5 ? 'cafe' : 'hill'; why[id] = 'rest'; }
      }
    }
    for (const id of Object.keys(want)) if (assistantLifeBodyWhere(decided, id).place === want[id]) { delete want[id]; delete why[id]; }
    ASSISTANT_LIFE_BODY_STORE.why = { abs, m: why }; // 次の assistantLifeBodyOnSlot が記録に書く(予定の保存の形は変えない)
    if (!Object.keys(want).length) return decided;
    const trust = {}; for (const id of Object.keys(want)) trust[id] = 1;
    return assistantLifePlanApply(decided, want, trust, `${salt}|body`).life;
  } catch (_) { return decided; }
};
// assistantLifeNow から: その回の場所で値を進め、保存する(同じ回は二度進めない)
const assistantLifeBodyOnSlot = (life, slot) => {
  try {
    if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded || !life || !slot) return null;
    const D = ASSISTANT_LIFE_BODY_STORE.state.data;
    if (Number.isInteger(D.at) && D.at === slot.abs) return null; // 同じ回は二度進めない
    // 端末の時刻を先へ進めてから戻したとき(D.at が今より先)は、今の回に置き直して進める(育成の amgCatchUp と同じ守り・ミハリ5)
    const gap = Number.isInteger(D.at) && D.at < slot.abs ? slot.abs - D.at - 1 : 0; // はじめての回はさかのぼらない
    const ids = [...new Set([...(life.groups || []).flatMap(g => g.ids), ...Object.keys(life.solo || {})])].filter(assistantLifeBodyOkId).sort();
    const s = { ...D.s }; const log = { ...D.log }; const evs = {};
    for (const id of ids) {
      const w = assistantLifeBodyWhere(life, id); if (!w) continue;
      const fav = ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].fav;
      const r = assistantLifeBodyStepOne(assistantLifeBodyGapOne(s[id] || assistantLifeBodyFresh(), gap), w.place, w.doing, fav, assistantLifeRng(`${life.salt || ''}|body|${slot.abs}|${id}`));
      s[id] = r.e; evs[id] = r.ev;
      const W = ASSISTANT_LIFE_BODY_STORE.why; const why = W && W.abs === slot.abs && W.m[id];
      log[id] = [...(log[id] || []), { abs: slot.abs, place: w.place, ev: r.ev, ...(why ? { why } : {}) }].slice(-ASSISTANT_LIFE_BODY_LOG_MAX);
    }
    assistantLifeBodySave({ v: 1, at: slot.abs, s, log });
    // おやつ屋さん・広場で一緒にいた2人は、助手どうしのきずなが少し上がる(1日の上限は outing の dailyMax)
    if (typeof assistantPeerGain === 'function') {
      for (const g of life.groups || []) {
        if (!ASSISTANT_LIFE_BODY_OUTING.includes(g.place)) continue;
        for (let i = 0; i < g.ids.length; i++) for (let j = i + 1; j < g.ids.length; j++) { try { void assistantPeerGain(g.ids[i], g.ids[j], 'outing'); } catch (_) {} }
      }
    }
    return evs;
  } catch (_) { return null; }
};
// 予定のお願いの聞きやすさの足し引き(ひなたの丘の次の回 +10%・ストレス80以上 −30%)
const assistantLifeBodyTrustAdj = (id, abs) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded) return 0;
  const e = assistantLifeBodyOf(id); if (!e) return 0;
  const last = (ASSISTANT_LIFE_BODY_STORE.state.data.log[id] || []).slice(-1)[0];
  let n = 0;
  if (last && last.place === 'hill' && last.abs === abs - 1) n += 0.1;
  if (e.st >= ASSISTANT_LIFE_BODY_LINE.sulky) n -= 0.3;
  return n;
};
// マスモン(育成ノート・キズナ)が読む口: その助手が その場所にいた回(abs)の配列(最近36回)
const assistantLifePlaceSlotsOf = (aid, place) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded) return [];
  return (ASSISTANT_LIFE_BODY_STORE.state.data.log[aid] || []).filter(r => r.place === place).map(r => r.abs);
};
// その回、体のせいで行き先が変わったか(予定表の結果の札が読む)。{ why, place } か null
const assistantLifeBodyWhyOf = (abs, id) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded) return null;
  const r = (ASSISTANT_LIFE_BODY_STORE.state.data.log[id] || []).find(x => x.abs === abs);
  return r && r.why ? { why: r.why, place: r.place } : null;
};
const assistantLifeHospitalSlotsOf = (aid) => assistantLifePlaceSlotsOf(aid, 'clinic');
// 特別な治療(ビートPの品物)を使った回。記録の ev が 'cure' の回(キズナと合意: その回に助手のマスモンのけが・病気も残り0に)
const assistantLifeHospitalCureSlotsOf = (aid) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded) return [];
  return (ASSISTANT_LIFE_BODY_STORE.state.data.log[aid] || []).filter(r => r.place === 'clinic' && r.ev === 'cure').map(r => r.abs);
};

// ---------- 🏥 特別な治療(2026-11-12 社長・台帳: ビートP交換所 300P・病院の回に1枚でその場で治る) ----------
// 持ち物は既存の mh_owned_items に品物 life_cure を足すだけ(キーの意味は変えない)。減らすのは 60-app(cureAssistantLifeBody)。
// 60-app が持っている数と「使う」口をここへ置き、予定表の体の窓が読む(予定表まで何段も受け渡さないため)
const ASSISTANT_LIFE_BODY_CURE_ITEM = 'life_cure';
const ASSISTANT_LIFE_BODY_CURE_HOOK = {
  have: 0, use: null, listeners: new Set(),
  set(patch) { Object.assign(this, patch); for (const fn of this.listeners) { try { fn(this.have); } catch (_) {} } },
};
// 今この回(abs)に その助手が病院にいて、けが・病気が残っているか(使えるのはこのときだけ)
const assistantLifeBodyCanCure = (id, abs) => {
  if (!assistantLifeBodyOn() || !ASSISTANT_LIFE_BODY_STORE.state.loaded || !assistantLifeBodyOkId(id) || !Number.isInteger(abs)) return false;
  const D = ASSISTANT_LIFE_BODY_STORE.state.data;
  const e = D.s[id];
  if (!e || !e.cond || D.at !== abs) return false;
  const last = (D.log[id] || []).slice(-1)[0];
  return !!last && last.abs === abs && last.place === 'clinic';
};
// 治す(持ち物はもう1枚減らしてある)。けが・病気を消し、その回の記録を 'cure' にする。治せなければ false
const assistantLifeBodyCure = (id, abs) => {
  if (!assistantLifeBodyCanCure(id, abs)) return false;
  const D = ASSISTANT_LIFE_BODY_STORE.state.data;
  const list = [...D.log[id]];
  list[list.length - 1] = { ...list[list.length - 1], ev: 'cure' };
  assistantLifeBodySave({ ...D, s: { ...D.s, [id]: { ...D.s[id], cond: null } }, log: { ...D.log, [id]: list } });
  return true;
};
const assistantLifeBodyCureUse = () => {
  const [have, setHave] = React.useState(ASSISTANT_LIFE_BODY_CURE_HOOK.have);
  React.useEffect(() => { const fn = (n) => setHave(n); ASSISTANT_LIFE_BODY_CURE_HOOK.listeners.add(fn); setHave(ASSISTANT_LIFE_BODY_CURE_HOOK.have); return () => { ASSISTANT_LIFE_BODY_CURE_HOOK.listeners.delete(fn); }; }, []);
  return have;
};
// 体の窓の中の「特別な治療」の段(けが・病気のときだけ)
function AssistantLifeBodyCure({ id, cur, onCured }) {
  const have = assistantLifeBodyCureUse();
  const [busy, setBusy] = React.useState(false);
  const can = assistantLifeBodyCanCure(id, cur);
  if (!can) return <p className="mt-1 text-[10.5px] font-bold leading-snug text-slate-300" data-assistant-life-body-cure-hint={id}>🏥 病院にいる回なら「特別な治療」(ビートP交換所)で、その場で治せます{have > 0 ? `(持っている ${have}枚)` : ''}</p>;
  const use = ASSISTANT_LIFE_BODY_CURE_HOOK.use;
  return (
    <div className="mt-1 rounded-lg border border-emerald-300/50 bg-emerald-950/60 p-1.5" data-assistant-life-body-cure={id}>
      <p className="text-[11px] font-bold leading-snug text-emerald-100">いま病院にいます。特別な治療を1枚使うと、重くてもその場で治ります(助手のマスモンも)</p>
      <button type="button" disabled={busy || have <= 0 || typeof use !== 'function'} data-assistant-life-body-cure-use={id}
        onClick={async () => { setBusy(true); let ok = false; try { ok = await use(id, cur); } catch (_) { ok = false; } setBusy(false); if (ok && onCured) onCured(); }}
        className="mt-1 min-h-[44px] w-full rounded-xl bg-emerald-500 px-2 text-[12.5px] font-black text-slate-950 active:scale-95 disabled:opacity-40">
        🏥 特別な治療を使う({have > 0 ? `持っている ${have}枚` : 'ビートP交換所 300P'})
      </button>
    </div>);
}

// ---------- 予定表への口(56-assistant-life-plan.jsx から呼ぶ) ----------
const assistantLifeBodyPerk = (place) => (assistantLifeBodyOn() ? (ASSISTANT_LIFE_BODY_PERK[place] || '') : '');
const assistantLifeBodyPlaces = (list) => (assistantLifeBodyOn() ? [...list.filter(p => p !== 'clinic'), 'clinic'] : list.filter(p => p !== 'clinic'));
const assistantLifeBodyLabel = (place) => (assistantLifeBodyOn() && ASSISTANT_LIFE_BODY_LABEL[place]) || null;
// けが・病気の助手に選べる場所(家・病院だけ)
const assistantLifeBodyCanGo = (id, place) => { const c = assistantLifeBodyCondOf(id); return !c || place === 'home' || place === 'clinic'; };
const assistantLifeBodyUse = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_BODY_STORE.state);
  React.useEffect(() => { const fn = (s) => setSt(s); ASSISTANT_LIFE_BODY_STORE.listeners.add(fn); void ASSISTANT_LIFE_BODY_STORE.load(); return () => { ASSISTANT_LIFE_BODY_STORE.listeners.delete(fn); }; }, []);
  return st;
};
const ASSISTANT_LIFE_BODY_COND_NAME = Object.freeze({ hurt: '🤕 けが', sick: '🤒 病気' });
const assistantLifeBodyCondText = (c, atClinic = false) => {
  if (!c) return '';
  const d = Math.floor(c.left / 12), h = (c.left % 12) * 2;
  return `${ASSISTANT_LIFE_BODY_COND_NAME[c.k]}(${c.sev === 'heavy' ? '重い' : '軽い'})・${atClinic ? '病院で診てもらっています' : '家で休んでいます'}(あと${d ? `${d}日` : ''}${h ? `${h}時間` : ''})・🏥 病院へあと${c.visits}回で治ります`;
};
// 部屋のシート・町の名札の一言(けが・病気のときだけ。それ以外は '')
const assistantLifeBodyCondShort = (id) => {
  const c = assistantLifeBodyCondOf(id); if (!c) return '';
  return `${ASSISTANT_LIFE_BODY_COND_NAME[c.k]}(${c.sev === 'heavy' ? '重い' : '軽い'})・家か🏥病院で休んでいます`;
};
const assistantLifeBodyDelta = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
// 場所の小さな札(疲れ・ストレスの動き)。疲れ・ストレスは増えると悪いので、増える=赤・減る=緑
function AssistantLifeBodyPlaceStat({ place, abs }) {
  if (!assistantLifeBodyOn()) return null;
  const P = ASSISTANT_LIFE_BODY_PLACE[place]; if (!P) return null;
  const s = Number.isInteger(abs) && typeof assistantLifeSlotOfAbs === 'function' ? assistantLifeSlotOfAbs(abs) : null;
  const fat = place === 'home' && s && (s.id === 'late' || s.id === 'night') ? ASSISTANT_LIFE_BODY_SLEEP_FAT : P.fat;
  const cls = (n) => (n > 0 ? 'text-rose-300' : n < 0 ? 'text-emerald-300' : 'text-slate-400');
  return <span className="block text-[10px] font-bold leading-tight" data-assistant-life-body-place={place}><span className={cls(fat)}>疲れ{assistantLifeBodyDelta(fat)}</span> <span className={cls(P.st)}>ストレス{assistantLifeBodyDelta(P.st)}</span></span>;
}
// 1本の棒(線つき)
function AssistantLifeBodyBar({ label, v, warn, bad, color }) {
  const tone = v >= bad ? 'text-rose-300' : v >= warn ? 'text-amber-300' : 'text-slate-100';
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-black">
      <span className="w-[64px] shrink-0">{label}</span>
      <span className="relative block h-2.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <span className="block h-full rounded-full" style={{ width: `${v}%`, background: v >= bad ? '#f87171' : v >= warn ? '#fbbf24' : color }}/>
        <span className="absolute inset-y-0 w-0.5 bg-amber-300" style={{ left: `${warn}%` }}/>
        <span className="absolute inset-y-0 w-0.5 bg-rose-400" style={{ left: `${bad}%` }}/>
      </span>
      <span className={`w-[28px] shrink-0 text-right ${tone}`}>{v}</span>
    </div>);
}
// 予定表の上: その助手の疲れ・ストレス・けが・病気と、今日の予定どおりならの見通し
function AssistantLifeBodyPanel({ id, cur }) {
  assistantLifeBodyUse();
  const [cured, setCured] = React.useState(false);
  const e = assistantLifeBodyOf(id);
  if (!e) return null;
  const L = ASSISTANT_LIFE_BODY_LINE;
  const fav = ASSISTANT_LIFE_PREFS[id] && ASSISTANT_LIFE_PREFS[id].fav;
  const note = e.cond ? assistantLifeBodyCondText(e.cond, assistantLifeBodyCanCure(id, cur))
    : e.fat >= L.fatWarn || e.st >= L.stWarn ? `${e.fat >= L.fatWarn ? '疲れ' : 'ストレス'}がたまっています。休ませる回(家・ひなたの丘・おやつ屋さん)を入れましょう`
    : '元気です';
  // 見通し: 次の回から、予定のある回を順に当てる(おまかせの回は「?」で止める)
  const rows = [];
  if (!e.cond && Number.isInteger(cur) && typeof assistantLifePlanOf === 'function') {
    let v = { fat: e.fat, st: e.st };
    for (let a = cur + 1; a < Math.floor(cur / 12) * 12 + 12; a++) {
      const p = assistantLifePlanOf(a, id); if (!p) break;
      const pv = assistantLifeBodyPreview(v, p, a, fav);
      rows.push({ abs: a, place: p, fat: pv.fat, st: pv.st, risk: Math.max(pv.hurt, pv.sick, pv.skip), kind: pv.hurt >= pv.sick && pv.hurt >= pv.skip ? 'けが' : pv.sick >= pv.skip ? '病気' : 'サボり' });
      v = { fat: pv.fat, st: pv.st };
    }
  }
  return (
    <div className="mb-1.5 rounded-xl border border-white/15 bg-slate-900/80 p-1.5" data-assistant-life-body-panel={id}>
      <AssistantLifeBodyBar label="😮‍💨 疲れ" v={e.fat} warn={L.fatWarn} bad={L.fatBad} color="#38bdf8"/>
      <div className="mt-0.5"><AssistantLifeBodyBar label="💢 ストレス" v={e.st} warn={L.stWarn} bad={L.stBad} color="#c084fc"/></div>
      <p className={`mt-1 text-[11px] font-bold leading-snug ${e.cond ? 'text-rose-200' : 'text-indigo-200'}`} data-assistant-life-body-note>{note}</p>
      {cured && !e.cond ? <p className="mt-1 rounded-lg bg-emerald-900/70 px-1.5 py-1 text-[11px] font-black text-emerald-100" data-assistant-life-body-cured={id}>🏥 特別な治療で、すっかり治りました！</p>
        : e.cond && <AssistantLifeBodyCure id={id} cur={cur} onCured={() => setCured(true)}/>}
      {rows.length > 0 && <div className="mt-1 flex flex-col gap-0.5" data-assistant-life-body-forecast>
        {rows.map(r => { const s = assistantLifeSlotOfAbs(r.abs); return (
          <p key={r.abs} className="flex flex-wrap items-center gap-x-1 text-[10.5px] font-bold leading-tight text-slate-200" data-assistant-life-body-forecast-row={r.abs}>
            <span className="w-[58px] shrink-0 text-sky-200">{s.from}〜{(s.from + 2) % 24}時</span>
            <span className="min-w-0 flex-1 truncate">{ASSISTANT_LIFE_PLACES[r.place]}のあと</span>
            <span className="shrink-0 whitespace-nowrap">疲れ{r.fat}・ストレス{r.st}</span>
            {r.risk > 0 && <span className="shrink-0 whitespace-nowrap text-rose-300">⚠ {r.kind} {Math.round(r.risk * 100)}%</span>}
          </p>); })}
      </div>}
    </div>);
}
// 家の断面図・地図の名札に付ける小さな印(黄・赤・けが・病気のときだけ。それ以外は '')
const assistantLifeBodyBadge = (id) => {
  const e = assistantLifeBodyOf(id); if (!e) return '';
  if (e.cond) return e.cond.k === 'hurt' ? '🤕' : '🤒';
  const L = ASSISTANT_LIFE_BODY_LINE;
  return e.fat >= L.fatBad || e.st >= L.stBad ? '💤' : '';
};

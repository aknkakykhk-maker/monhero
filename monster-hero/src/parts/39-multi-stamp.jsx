// ---- マルチのスタンプ(モンヒロビートのマルチ・MFバトルカードのマルチ。2026-11-11 社長「チャットのほかにスタンプがほしい」) ----
// 決めごと(台帳 2026-11-11 の2行・案 docs/progress/multi-stamp/PLAN.md):
//   ・スタンプ = 顔 × 言葉。顔(助手の顔・モンスターの顔・あとで足す新しい絵)と言葉を自分で組み合わせ、「よく使う枠」に並べる
//   ・はじめは助手8顔(1人1表情)× 言葉8。ほかはビートP交換所の「スタンプ」で買い足す(値段は下の表1か所)
//   ・送るのは、いまのチャットの知らせに顔の番号(sf)と言葉の番号(sw)を足すだけ。古い版・知らない番号の人には言葉だけが出る
//   ・相手は、その顔や言葉を持っていなくても絵で見える(持っているかは送る側だけが確かめる)
//   ・続けて送るのは2秒に1回・同じスタンプは続けて3回まで。受け取る側も1人2秒に1個だけ出す
//   ・モンヒロビートの演奏中は出さない(演奏中に届いた知らせは今までどおり溜めて、結果画面で吹き出しに出る)
// 保存(新しいキーだけ。既存のキーは触らない):
//   mh_multi_stamps_v1 { v:1, owned:[買った品の id], slots:[{ f, w }] }(無い・壊れているときは、はじめの形)
//   mh_multi_stamp_prefs_v1 { pic:絵で出すか }(切ると届いたスタンプを言葉だけで出す)
// ★番号(顔・言葉・品の id)は一度出したら変えない・消さない。足すときは後ろへ

const MULTI_STAMP_KEY = 'mh_multi_stamps_v1';
const MULTI_STAMP_PREFS_KEY = 'mh_multi_stamp_prefs_v1';
const MULTI_STAMP_SEND_GAP_MS = 2000;
const MULTI_STAMP_SAME_MAX = 3;
const MULTI_STAMP_RECV_GAP_MS = 2000;
const MULTI_STAMP_SLOT_BASE = 8;
const MULTI_STAMP_SLOT_STEP = 4;
const MULTI_STAMP_SLOT_BUY_MAX = 2; // 8 → 12 → 16
// 助手(この並び)と表情。はじめに使えるのは各助手の happy
const MULTI_STAMP_ASSISTANT_IDS = Object.freeze(['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']);
const MULTI_STAMP_EXPRESSIONS = Object.freeze(['happy', 'excited', 'wink', 'surprise', 'troubled', 'crying', 'angry', 'normal']);
const MULTI_STAMP_START_EXPRESSION = 'happy';
// 言葉。id は変えない。pack … どの言葉パックで増えるか(base ははじめから)
const MULTI_STAMP_WORDS = Object.freeze([
  { id: 'w01', pack: 'base', text: 'よろしく！' }, { id: 'w02', pack: 'base', text: 'ナイス！' }, { id: 'w03', pack: 'base', text: 'すごい！' },
  { id: 'w04', pack: 'base', text: 'ありがとう！' }, { id: 'w05', pack: 'base', text: '待って！' }, { id: 'w06', pack: 'base', text: 'ドンマイ…' },
  { id: 'w07', pack: 'base', text: 'もう1回！' }, { id: 'w08', pack: 'base', text: 'またね！' },
  { id: 'g01', pack: 'greet', text: 'おつかれ！' }, { id: 'g02', pack: 'greet', text: 'GG！' }, { id: 'g03', pack: 'greet', text: 'がんばろ！' },
  { id: 'g04', pack: 'greet', text: '準備OK！' }, { id: 'g05', pack: 'greet', text: 'はじめまして！' }, { id: 'g06', pack: 'greet', text: 'おかえり！' },
  { id: 'g07', pack: 'greet', text: 'ただいま！' }, { id: 'g08', pack: 'greet', text: 'おはよう！' }, { id: 'g09', pack: 'greet', text: 'おやすみ！' },
  { id: 'g10', pack: 'greet', text: 'ごめんね！' },
  { id: 'f01', pack: 'feel', text: '天才！' }, { id: 'f02', pack: 'feel', text: 'くやしい！' }, { id: 'f03', pack: 'feel', text: '強すぎ！' },
  { id: 'f04', pack: 'feel', text: 'ほっとした…' }, { id: 'f05', pack: 'feel', text: 'うれしい！' }, { id: 'f06', pack: 'feel', text: 'びっくり！' },
  { id: 'f07', pack: 'feel', text: 'やったー！' }, { id: 'f08', pack: 'feel', text: 'たのしい！' }, { id: 'f09', pack: 'feel', text: 'えっ…' },
  { id: 'f10', pack: 'feel', text: 'さすが！' },
  { id: 'b01', pack: 'beat', text: 'いい曲！' }, { id: 'b02', pack: 'beat', text: 'FC！' }, { id: 'b03', pack: 'beat', text: 'もう1曲！' },
  { id: 'b04', pack: 'beat', text: '次いこう！' }, { id: 'b05', pack: 'beat', text: 'この曲好き！' }, { id: 'b06', pack: 'beat', text: 'むずかしい…' },
  { id: 'b07', pack: 'beat', text: 'HELLいく？' }, { id: 'b08', pack: 'beat', text: 'おまかせで！' }, { id: 'b09', pack: 'beat', text: 'ノーツ多い！' },
  { id: 'b10', pack: 'beat', text: 'ノリノリ！' },
  { id: 'c01', pack: 'card', text: '考え中…' }, { id: 'c02', pack: 'card', text: 'いい手！' }, { id: 'c03', pack: 'card', text: '引きが強い！' },
  { id: 'c04', pack: 'card', text: '逆転だ！' }, { id: 'c05', pack: 'card', text: '守りが固い！' }, { id: 'c06', pack: 'card', text: '切り札！' },
  { id: 'c07', pack: 'card', text: 'もう1戦！' }, { id: 'c08', pack: 'card', text: '計算どおり！' }, { id: 'c09', pack: 'card', text: 'あぶなかった…' },
  { id: 'c10', pack: 'card', text: 'ナイス判断！' },
]);
const MULTI_STAMP_WORD_PACKS = Object.freeze([
  { pack: 'greet', name: 'あいさつ' }, { pack: 'feel', name: '気持ち' }, { pack: 'beat', name: 'モンヒロビート' }, { pack: 'card', name: 'MFバトルカード' },
]);
// モンスターの顔は5体ずつのセット(この並びは変えない。新しいモンスターは新しいセットとして後ろへ)
const MULTI_STAMP_MONSTER_SETS = Object.freeze([
  ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Ham'],
  ['Pixie', 'Mia', 'Pandora', 'Monol', 'Oboro'],
  ['Plant', 'Zan', 'Eiki', 'KenshiMocchi', 'Mitarashi'],
  ['Ark', 'Iblis', 'Snegurochka', 'Undine', 'Yaobikuni'],
  ['Yggdrasil', 'MelWhip', 'Melody', 'Kuromy', 'Ghost'],
  ['Spooky', 'Illumine', 'Dreamy', 'Kyubi', 'Orihime'],
]);
// 値段(ビートP)。ここ1か所で変える。社長 2026-11-11「値段は倍(全部そろえて 8,000P)」:
//   表情セット 400×8人(まとめては1人300)= 3,200 / モンスター 400×6セット = 2,400 / 言葉 300×4パック = 1,200 / 枠 600×2回 = 1,200 → 合計 8,000
const MULTI_STAMP_PRICE = Object.freeze({ face: 400, faceAllPer: 300, monster: 400, words: 300, slot: 600 });

const multiStampAssistant = (id) => (typeof ASSISTANTS !== 'undefined' && Array.isArray(ASSISTANTS) ? ASSISTANTS.find((a) => a && a.id === id) : null) || null;
const multiStampMonster = (id) => { try { const m = ALL_PLAYER_MONSTERS[id]; return m && (m.faceIconUrl || m.iconUrl) ? m : null; } catch (_) { return null; } };
// 顔の id: 'a.<助手>.<表情>' / 'm.<モンスター>'。着替えの絵は使わない(送る人と見る人で同じ絵にするため)
const multiStampFaceSrc = (fid) => {
  const s = String(fid || '');
  let m = /^a\.([a-z]+)\.([a-z]+)$/.exec(s);
  if (m) {
    const who = multiStampAssistant(m[1]);
    if (!who || !who.imagePrefix || !who.imageDir || !MULTI_STAMP_EXPRESSIONS.includes(m[2]) || !MULTI_STAMP_ASSISTANT_IDS.includes(m[1])) return null;
    return `${who.imageDir}/face/${who.imagePrefix}_${m[2]}.PNG`;
  }
  m = /^m\.([A-Za-z]+)$/.exec(s);
  if (m && MULTI_STAMP_MONSTER_SETS.some((set) => set.includes(m[1]))) { const mon = multiStampMonster(m[1]); return mon ? (mon.faceIconUrl || mon.iconUrl) : null; }
  return null;
};
const multiStampFaceName = (fid) => {
  const s = String(fid || '');
  const a = /^a\.([a-z]+)\./.exec(s); if (a) { const who = multiStampAssistant(a[1]); return who ? who.name : ''; }
  const m = /^m\.([A-Za-z]+)$/.exec(s); if (m) { const mon = multiStampMonster(m[1]); return mon ? mon.name : ''; }
  return '';
};
const multiStampWord = (wid) => MULTI_STAMP_WORDS.find((w) => w.id === wid) || null;
// 受け取った番号を確かめる(知らない番号は null。古い版から来た・まだ無い顔は言葉だけで出す)
const multiStampCleanFace = (v) => (typeof v === 'string' && v.length <= 40 && multiStampFaceSrc(v) ? v : null);
const multiStampCleanWord = (v) => (typeof v === 'string' && multiStampWord(v) ? v : null);

// 売り場の品(id は変えない)
const MULTI_STAMP_SHOP_OFFERS = Object.freeze([
  ...MULTI_STAMP_ASSISTANT_IDS.map((id) => ({ id: `stamp_face_${id}`, kind: 'stamp', group: 'face', assistantId: id })),
  { id: 'stamp_face_all', kind: 'stamp', group: 'faceAll' },
  ...MULTI_STAMP_MONSTER_SETS.map((set, i) => ({ id: `stamp_mon_${i + 1}`, kind: 'stamp', group: 'monster', monsters: set })),
  ...MULTI_STAMP_WORD_PACKS.map((p) => ({ id: `stamp_words_${p.pack}`, kind: 'stamp', group: 'words', pack: p.pack })),
  { id: 'stamp_slot', kind: 'stamp', group: 'slot' },
]);
const multiStampOffer = (id) => MULTI_STAMP_SHOP_OFFERS.find((o) => o.id === id) || null;

// ---- 保存の形 ----
const multiStampDefaultSlots = () => MULTI_STAMP_ASSISTANT_IDS.map((id, i) => ({ f: `a.${id}.${MULTI_STAMP_START_EXPRESSION}`, w: MULTI_STAMP_WORDS[i].id }));
const multiStampOwnsFace = (owned, fid) => {
  const s = String(fid || '');
  const a = /^a\.([a-z]+)\.([a-z]+)$/.exec(s);
  if (a) return MULTI_STAMP_ASSISTANT_IDS.includes(a[1]) && MULTI_STAMP_EXPRESSIONS.includes(a[2]) && (a[2] === MULTI_STAMP_START_EXPRESSION || owned.includes(`stamp_face_${a[1]}`));
  const m = /^m\.([A-Za-z]+)$/.exec(s);
  if (m) return MULTI_STAMP_MONSTER_SETS.some((set, i) => set.includes(m[1]) && owned.includes(`stamp_mon_${i + 1}`)) && !!multiStampMonster(m[1]);
  return false;
};
const multiStampOwnsWord = (owned, wid) => { const w = multiStampWord(wid); return !!w && (w.pack === 'base' || owned.includes(`stamp_words_${w.pack}`)); };
const multiStampSlotMax = (owned) => MULTI_STAMP_SLOT_BASE + MULTI_STAMP_SLOT_STEP * Math.min(MULTI_STAMP_SLOT_BUY_MAX, owned.filter((x) => x === 'stamp_slot').length);
const normalizeMultiStamps = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  const owned = (o && Array.isArray(o.owned) ? o.owned : []).filter((x) => typeof x === 'string' && multiStampOffer(x) && x !== 'stamp_face_all').slice(0, 60);
  // 枠の品だけは同じ id を何回か持つ。ほかは1つにそろえる
  const ownedClean = [...new Set(owned.filter((x) => x !== 'stamp_slot')), ...owned.filter((x) => x === 'stamp_slot').slice(0, MULTI_STAMP_SLOT_BUY_MAX)];
  const max = multiStampSlotMax(ownedClean);
  const slots = o && Array.isArray(o.slots)
    ? o.slots.slice(0, max).map((x) => (x && typeof x === 'object' && multiStampOwnsFace(ownedClean, x.f) && multiStampOwnsWord(ownedClean, x.w) ? { f: x.f, w: x.w } : null))
    : multiStampDefaultSlots();
  while (slots.length < max) slots.push(null);
  return { owned: ownedClean, slots };
};
const multiStampToStore = (st) => ({ v: 1, owned: st.owned.slice(), slots: st.slots.map((x) => (x ? { f: x.f, w: x.w } : null)) });
const normalizeMultiStampPrefs = (v) => ({ pic: !(v && typeof v === 'object' && v.pic === false) });
// 品の値段(持っている・買えないときは null)。8人まとめては、まだ持っていない助手1人につき 400P
const multiStampOfferCost = (offer, st) => {
  if (!offer) return null;
  const owned = st.owned;
  if (offer.group === 'faceAll') { const miss = MULTI_STAMP_ASSISTANT_IDS.filter((id) => !owned.includes(`stamp_face_${id}`)).length; return miss > 0 ? miss * MULTI_STAMP_PRICE.faceAllPer : null; }
  if (offer.group === 'slot') return owned.filter((x) => x === 'stamp_slot').length < MULTI_STAMP_SLOT_BUY_MAX ? MULTI_STAMP_PRICE.slot : null;
  if (owned.includes(offer.id)) return null;
  if (offer.group === 'monster' && !offer.monsters.some((id) => multiStampMonster(id))) return null;
  return offer.group === 'face' ? MULTI_STAMP_PRICE.face : offer.group === 'monster' ? MULTI_STAMP_PRICE.monster : offer.group === 'words' ? MULTI_STAMP_PRICE.words : null;
};
const multiStampApplyOffer = (offer, st) => {
  const add = offer.group === 'faceAll' ? MULTI_STAMP_ASSISTANT_IDS.map((id) => `stamp_face_${id}`).filter((id) => !st.owned.includes(id)) : [offer.id];
  return normalizeMultiStamps({ owned: [...st.owned, ...add], slots: st.slots });
};
const multiStampOfferLabel = (offer) => {
  if (!offer) return { name: '', desc: '' };
  if (offer.group === 'face') { const who = multiStampAssistant(offer.assistantId); return { name: `${who ? who.name : ''}の表情`, desc: '顔が7つ増えます' }; }
  if (offer.group === 'faceAll') return { name: '助手みんなの表情', desc: '8人ぶんまとめて(持っていない人の分だけ)' };
  if (offer.group === 'monster') { const names = offer.monsters.map((id) => multiStampMonster(id)).filter(Boolean).map((m) => m.name); return { name: `${names[0] || ''}たちの顔`, desc: names.join('・') }; }
  if (offer.group === 'words') { const p = MULTI_STAMP_WORD_PACKS.find((x) => x.pack === offer.pack); const ws = MULTI_STAMP_WORDS.filter((w) => w.pack === offer.pack); return { name: `言葉「${p ? p.name : ''}」`, desc: `${ws.slice(0, 2).map((w) => w.text).join('・')}ほか${ws.length - 2}語` }; }
  if (offer.group === 'slot') return { name: 'よく使う枠+4', desc: `最大${MULTI_STAMP_SLOT_BASE + MULTI_STAMP_SLOT_STEP * MULTI_STAMP_SLOT_BUY_MAX}枠まで` };
  return { name: '', desc: '' };
};
const multiStampOfferIcons = (offer) => {
  if (!offer) return [];
  if (offer.group === 'face') return ['wink', 'surprise', 'crying'].map((e) => multiStampFaceSrc(`a.${offer.assistantId}.${e}`)).filter(Boolean);
  if (offer.group === 'faceAll') return ['mua', 'kiki', 'dra'].map((id) => multiStampFaceSrc(`a.${id}.wink`)).filter(Boolean);
  if (offer.group === 'monster') return offer.monsters.slice(0, 3).map((id) => multiStampFaceSrc(`m.${id}`)).filter(Boolean);
  return [];
};

// ---- いまの持ち物・設定・送る間隔(React の外。ビートの部屋とカードの対戦で同じものを見る) ----
const MULTI_STAMP = (() => {
  const listeners = new Set();
  let st = normalizeMultiStamps(null);
  let prefs = normalizeMultiStampPrefs(null);
  let loaded = false;
  let sentAt = 0;
  let lastKey = '';
  let sameCount = 0;
  const recvAt = new Map();
  const emit = () => listeners.forEach((fn) => { try { fn(st); } catch (_) { /* 画面の都合で落ちても続ける */ } });
  const load = () => {
    if (loaded || typeof storeGet !== 'function') return;
    loaded = true;
    Promise.all([storeGet(MULTI_STAMP_KEY, null, false), storeGet(MULTI_STAMP_PREFS_KEY, null, false)])
      .then(([raw, p]) => { st = normalizeMultiStamps(raw); prefs = normalizeMultiStampPrefs(p); emit(); }).catch(() => {});
  };
  return {
    get: () => { load(); return st; },
    prefs: () => { load(); return prefs; },
    subscribe: (fn) => { load(); listeners.add(fn); return () => listeners.delete(fn); },
    reload: () => { loaded = false; load(); },
    // 買ったあと(交換の保存が済んだ値)をそのまま使う
    replace: (next) => { st = normalizeMultiStamps(multiStampToStore(next)); emit(); },
    setSlot: (i, slot) => {
      if (!Number.isInteger(i) || i < 0 || i >= st.slots.length) return false;
      if (slot && !(multiStampOwnsFace(st.owned, slot.f) && multiStampOwnsWord(st.owned, slot.w))) return false;
      const slots = st.slots.slice(); slots[i] = slot ? { f: slot.f, w: slot.w } : null;
      st = { ...st, slots };
      try { void storeSet(MULTI_STAMP_KEY, multiStampToStore(st), false); } catch (_) { /* 保存できなくても、その場では使える */ }
      emit();
      return true;
    },
    move: (i, d) => {
      const j = i + d;
      if (!Number.isInteger(i) || j < 0 || j >= st.slots.length || i < 0 || i >= st.slots.length) return false;
      const slots = st.slots.slice(); [slots[i], slots[j]] = [slots[j], slots[i]];
      st = { ...st, slots };
      try { void storeSet(MULTI_STAMP_KEY, multiStampToStore(st), false); } catch (_) { /* 同上 */ }
      emit();
      return true;
    },
    setPic: (on) => { prefs = { pic: !!on }; try { void storeSet(MULTI_STAMP_PREFS_KEY, prefs, false); } catch (_) { /* 同上 */ } emit(); },
    // 送れるか(2秒に1回・同じのは続けて3回まで)。{ ok, why }
    check: (slot) => {
      if (!slot || !multiStampOwnsFace(st.owned, slot.f) || !multiStampOwnsWord(st.owned, slot.w)) return { ok: false, why: '' };
      if (Date.now() - sentAt < MULTI_STAMP_SEND_GAP_MS) return { ok: false, why: '少しあけてから送ってね' };
      if (lastKey === `${slot.f}|${slot.w}` && sameCount >= MULTI_STAMP_SAME_MAX) return { ok: false, why: '同じスタンプは続けて3回までです' };
      return { ok: true, why: '' };
    },
    sent: (slot) => { const k = `${slot.f}|${slot.w}`; sameCount = k === lastKey ? sameCount + 1 : 1; lastKey = k; sentAt = Date.now(); },
    // 受け取ったスタンプを出してよいか(1人2秒に1個)
    accept: (who) => { const k = String(who || ''); const now = Date.now(); if (now - (recvAt.get(k) || 0) < MULTI_STAMP_RECV_GAP_MS) return false; recvAt.set(k, now); if (recvAt.size > 50) recvAt.clear(); return true; },
  };
})();

// ビートP交換所の「スタンプ」の品を買う(本体の exchangeRhythmEventPoints から呼ぶ)。
// ★保存されている値を読み直してから計算し、ビートPとスタンプを1つの取引で保存する(失敗したら両方戻す)
const multiStampExchange = async (offerLike) => {
  const offer = multiStampOffer(offerLike && offerLike.id);
  if (!offer) return { ok: false, reason: 'unknown' };
  const beforePoints = await loadRhythmEventPoints();
  const stored = await storeGet(MULTI_STAMP_KEY, null, false);
  const cur = normalizeMultiStamps(stored);
  const cost = multiStampOfferCost(offer, cur);
  if (cost === null) return { ok: false, reason: 'owned' };
  if (!(beforePoints >= cost)) return { ok: false, reason: 'points' };
  const next = multiStampApplyOffer(offer, cur);
  const nextPoints = beforePoints - cost;
  const saved = await saveStoredValuesOrRollback([
    { key: RHYTHM_EVENT_POINTS_KEY, before: beforePoints, next: nextPoints },
    { key: MULTI_STAMP_KEY, before: stored, next: multiStampToStore(next) },
  ], storeGet, storeSet);
  if (!saved) return { ok: false, reason: 'save' };
  MULTI_STAMP.replace(next);
  return { ok: true, eventPoints: nextPoints, cost };
};

// ---- 画面の部品 ----
const useMultiStamp = () => {
  const [, setTick] = React.useState(0);
  React.useEffect(() => MULTI_STAMP.subscribe(() => setTick((n) => n + 1)), []);
  return MULTI_STAMP.get();
};
// 1つのスタンプ(顔+言葉)。size … 絵の大きさ(px)。絵で出さない設定・知らない顔のときは言葉だけ
function MultiStampView({ f, w, text = '', size = 64, className = '', forcePic = false }) {
  const word = multiStampWord(w);
  const label = word ? word.text : text;
  const src = (forcePic || MULTI_STAMP.prefs().pic) ? multiStampFaceSrc(f) : null;
  if (!src) return <span data-multi-stamp-text className={className}>{label}</span>;
  return (
    <span data-multi-stamp={`${f}|${w}`} className={`inline-flex flex-col items-center rounded-2xl bg-white p-1 text-slate-900 shadow ${className}`} style={{ width: size + 8 }}>
      <img src={src} alt="" draggable={false} loading="lazy" decoding="async" className="block rounded-xl object-cover" style={{ width: size, height: size }} />
      <b className="mt-0.5 block max-w-full truncate text-center text-[11px] font-black leading-tight">{label}</b>
    </span>
  );
}
// チャットの板の「よく使う」(押すとすぐ送る)。onSend({ f, w, text }) が送れたら true を返す
// 列の数はクラスで決める(横向きで増やせるように)。wide … 横向き・回転のときは8列
const MULTI_STAMP_COLS = Object.freeze({ 4: 'grid-cols-4', 5: 'grid-cols-5', 6: 'grid-cols-6', 8: 'grid-cols-8' });
function MultiStampPalette({ onSend, onEdit = null, cols = 4, wide = false, className = '' }) {
  const st = useMultiStamp();
  const [flash, setFlash] = React.useState(null);
  const [why, setWhy] = React.useState('');
  const press = (slot, i) => {
    const r = MULTI_STAMP.check(slot);
    if (!r.ok) { setWhy(r.why); setFlash({ i, ok: false }); return; }
    const word = multiStampWord(slot.w);
    const ok = onSend({ f: slot.f, w: slot.w, text: word ? word.text : '' }) !== false;
    if (ok) MULTI_STAMP.sent(slot);
    setWhy(ok ? '' : 'いまは送れません');
    setFlash({ i, ok });
  };
  React.useEffect(() => { if (!flash) return undefined; const t = setTimeout(() => setFlash(null), 900); return () => clearTimeout(t); }, [flash]);
  const list = st.slots.map((s, i) => ({ s, i })).filter((x) => x.s);
  return (
    <div data-multi-stamp-palette className={className}>
      <div className={`grid gap-1.5 ${MULTI_STAMP_COLS[cols] || 'grid-cols-4'} ${wide ? 'landscape:grid-cols-8 [[data-mh-view-rotation=true]_&]:grid-cols-8' : ''}`}>
        {list.map(({ s, i }) => {
          const word = multiStampWord(s.w);
          const src = multiStampFaceSrc(s.f);
          const hit = flash && flash.i === i;
          return (
            <button key={i} type="button" data-multi-stamp-send={i} onClick={() => press(s, i)}
              className={`relative min-w-0 rounded-xl border p-1 text-center active:scale-95 ${hit ? (flash.ok ? 'border-emerald-300 bg-emerald-500/20' : 'border-amber-300 bg-amber-500/15') : 'border-white/15 bg-white/10'}`}>
              {src && <img src={src} alt="" draggable={false} loading="lazy" decoding="async" className="mx-auto block aspect-square w-full rounded-lg object-cover" />}
              <b className="mt-0.5 block truncate text-[11px] font-black leading-tight text-white">{hit && flash.ok ? '✓ 送信' : (word ? word.text : '')}</b>
            </button>
          );
        })}
        {onEdit && (
          <button type="button" data-multi-stamp-edit-open onClick={onEdit}
            className="flex min-h-[64px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-cyan-300/60 bg-cyan-500/10 text-[11px] font-black text-cyan-100 active:scale-95">
            <span className="text-lg leading-none">✏️</span><span className="mt-1 whitespace-nowrap">並べる・作る</span>
          </button>
        )}
      </div>
      {why && <p data-multi-stamp-why className="mt-1 text-[11px] font-black text-amber-300">{why}</p>}
    </div>
  );
}
// マイスタンプ(よく使う枠に並べる・顔×言葉で作る)。onShop … 買い足す売り場へ(無ければボタンを出さない)
function MultiStampEditor({ onClose, onShop = null }) {
  const st = useMultiStamp();
  const prefs = MULTI_STAMP.prefs();
  const [sel, setSel] = React.useState(0);
  const cur = st.slots[sel] || null;
  const [tab, setTab] = React.useState(() => (cur && /^m\./.test(cur.f) ? 'monster' : 'assistant'));
  const [who, setWho] = React.useState(() => { const a = cur && /^a\.([a-z]+)\./.exec(cur.f); return a ? a[1] : MULTI_STAMP_ASSISTANT_IDS[0]; });
  const [face, setFace] = React.useState(cur ? cur.f : `a.${MULTI_STAMP_ASSISTANT_IDS[0]}.${MULTI_STAMP_START_EXPRESSION}`);
  const [word, setWord] = React.useState(cur ? cur.w : MULTI_STAMP_WORDS[0].id);
  const [lockNote, setLockNote] = React.useState('');
  const pickSlot = (i) => {
    setSel(i); setLockNote('');
    const s = st.slots[i];
    if (s) { setFace(s.f); setWord(s.w); const a = /^a\.([a-z]+)\./.exec(s.f); if (a) { setTab('assistant'); setWho(a[1]); } else setTab('monster'); }
  };
  const faces = tab === 'assistant'
    ? MULTI_STAMP_EXPRESSIONS.map((e) => `a.${who}.${e}`)
    : MULTI_STAMP_MONSTER_SETS.flat().filter((id) => multiStampMonster(id)).map((id) => `m.${id}`);
  const lockedBuy = (what) => setLockNote(`${what}は、ビートP交換所の「スタンプ」で買えます`);
  const canPut = multiStampOwnsFace(st.owned, face) && multiStampOwnsWord(st.owned, word);
  const max = st.slots.length;
  return (
    <div data-multi-stamp-editor className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 landscape:items-center" onClick={onClose}>
      <div className="flex max-h-[96dvh] [[data-mh-view-rotation=true]_&]:max-h-[94vw] w-full max-w-[880px] flex-col overflow-hidden rounded-t-2xl border-t-2 border-cyan-400 bg-slate-950 text-white landscape:rounded-2xl landscape:border-2" style={{ paddingBottom: 'max(8px, var(--mh-sa-bottom))' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
          <b className="flex-1 text-[15px] text-cyan-100">😊 マイスタンプ</b>
          {onShop && <button type="button" data-multi-stamp-shop onClick={onShop} className="min-h-[36px] rounded-xl bg-slate-800 px-2.5 text-[12px] font-black text-amber-100">🛒 買い足す</button>}
          <button type="button" data-multi-stamp-editor-close onClick={onClose} className="min-h-[36px] rounded-xl bg-slate-800 px-2.5 text-[12px] font-black text-slate-200">✕ 閉じる</button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 landscape:flex-row landscape:overflow-hidden">
          <div data-multi-stamp-editor-left className="flex min-w-0 flex-col gap-2 landscape:min-h-0 landscape:w-[46%] landscape:shrink-0 landscape:overflow-y-auto">
            <section className="rounded-xl border border-slate-700 bg-slate-900 p-2">
              <p className="mb-1.5 flex items-center gap-1 text-[12px] font-black">⭐ よく使う<small className="text-[11px] text-slate-400">(並べた順にチャットへ出ます・{st.slots.filter(Boolean).length}/{max}枠)</small></p>
              <div className="grid grid-cols-4 gap-1.5 landscape:grid-cols-5">
                {st.slots.map((s, i) => (
                  <button key={i} type="button" data-multi-stamp-slot={i} aria-pressed={sel === i} onClick={() => pickSlot(i)}
                    className={`relative min-w-0 rounded-xl border p-1 text-center ${sel === i ? 'border-cyan-300 bg-cyan-500/15 ring-2 ring-cyan-300/40' : s ? 'border-white/15 bg-white/10' : 'border-dashed border-slate-600 bg-transparent'}`}>
                    <span className="absolute left-1 top-0.5 text-[10px] font-black text-cyan-200">{i + 1}</span>
                    {s ? <>
                      <img src={multiStampFaceSrc(s.f) || undefined} alt="" draggable={false} loading="lazy" decoding="async" className="mx-auto block aspect-square w-full rounded-lg object-cover" />
                      <b className="mt-0.5 block truncate text-[10.5px] font-black leading-tight">{(multiStampWord(s.w) || {}).text}</b>
                    </> : <span className="flex aspect-[4/5] items-center justify-center text-xl text-slate-500">＋</span>}
                  </button>
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                <button type="button" data-multi-stamp-move="-1" disabled={sel <= 0} onClick={() => { if (MULTI_STAMP.move(sel, -1)) setSel(sel - 1); }} className="min-h-[36px] flex-1 rounded-lg bg-slate-800 text-[12px] font-black disabled:opacity-40">◀ 前へ</button>
                <button type="button" data-multi-stamp-move="1" disabled={sel >= max - 1} onClick={() => { if (MULTI_STAMP.move(sel, 1)) setSel(sel + 1); }} className="min-h-[36px] flex-1 rounded-lg bg-slate-800 text-[12px] font-black disabled:opacity-40">後ろへ ▶</button>
                <button type="button" data-multi-stamp-clear disabled={!cur} onClick={() => MULTI_STAMP.setSlot(sel, null)} className="min-h-[36px] flex-1 rounded-lg bg-slate-800 text-[12px] font-black text-rose-200 disabled:opacity-40">外す</button>
              </div>
            </section>
            <section data-multi-stamp-preview className="flex items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900 p-2 landscape:order-first">
              <MultiStampView f={face} w={word} size={76} forcePic />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <button type="button" data-multi-stamp-put disabled={!canPut} onClick={() => MULTI_STAMP.setSlot(sel, { f: face, w: word })}
                  className="min-h-[44px] rounded-xl bg-gradient-to-b from-cyan-500 to-cyan-700 px-2 text-[13px] font-black disabled:opacity-40">⭐ {sel + 1}番に入れる</button>
                {lockNote && <p data-multi-stamp-lock-note className="text-[11px] font-black leading-snug text-amber-200" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>🔒 {lockNote}</p>}
              </div>
            </section>
            <button type="button" data-multi-stamp-pic aria-pressed={prefs.pic} onClick={() => MULTI_STAMP.setPic(!prefs.pic)}
              className={`min-h-[38px] rounded-xl px-2 text-[12px] font-black ${prefs.pic ? 'bg-emerald-600 text-white' : 'border border-white/15 bg-slate-800 text-slate-300'}`}>
              届いたスタンプを絵で出す {prefs.pic ? 'ON' : 'OFF(言葉だけ)'}
            </button>
          </div>
          <section data-multi-stamp-editor-right className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-900 p-2 landscape:min-h-0 landscape:overflow-y-auto">
            <p className="mb-1.5 text-[12px] font-black">✏️ {sel + 1}番を作る:顔 × 言葉</p>
            <div className="mb-1.5 grid grid-cols-2 gap-1">
              {[['assistant', '助手'], ['monster', 'モンスター']].map(([k, label]) => (
                <button key={k} type="button" data-multi-stamp-tab={k} aria-pressed={tab === k} onClick={() => setTab(k)}
                  className={`min-h-[34px] rounded-lg text-[12px] font-black ${tab === k ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{label}</button>
              ))}
            </div>
            {tab === 'assistant' && (
              <div className="mb-1.5 grid grid-cols-8 gap-1">
                {MULTI_STAMP_ASSISTANT_IDS.map((id) => (
                  <button key={id} type="button" data-multi-stamp-who={id} aria-pressed={who === id} aria-label={multiStampFaceName(`a.${id}.normal`)} onClick={() => setWho(id)}
                    className={`min-w-0 rounded-lg p-0.5 ${who === id ? 'bg-cyan-600' : 'bg-slate-800'}`}>
                    <img src={multiStampFaceSrc(`a.${id}.${MULTI_STAMP_START_EXPRESSION}`) || undefined} alt="" draggable={false} loading="lazy" decoding="async" className="mx-auto block aspect-square w-full rounded-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="mb-2 grid grid-cols-8 gap-1">
              {faces.map((fid) => {
                const own = multiStampOwnsFace(st.owned, fid);
                return (
                  <button key={fid} type="button" data-multi-stamp-face={fid} aria-pressed={face === fid} onClick={() => { if (own) { setFace(fid); setLockNote(''); } else lockedBuy(tab === 'assistant' ? 'この表情' : 'このモンスターの顔'); }}
                    className={`relative min-w-0 rounded-lg border ${face === fid ? 'border-cyan-300 ring-2 ring-cyan-300/40' : 'border-white/10'} bg-white/5`}>
                    <img src={multiStampFaceSrc(fid) || undefined} alt="" draggable={false} loading="lazy" decoding="async" className={`block aspect-square w-full rounded-lg object-cover ${own ? '' : 'opacity-30'}`} />
                    {!own && <span aria-hidden="true" className="absolute right-0.5 top-0 text-[11px]">🔒</span>}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MULTI_STAMP_WORDS.map((wd) => {
                const own = multiStampOwnsWord(st.owned, wd.id);
                return (
                  <button key={wd.id} type="button" data-multi-stamp-word={wd.id} aria-pressed={word === wd.id} onClick={() => { if (own) { setWord(wd.id); setLockNote(''); } else lockedBuy('この言葉'); }}
                    className={`min-h-[34px] whitespace-nowrap rounded-full px-2.5 text-[12px] font-black ${word === wd.id ? 'bg-cyan-600 text-white' : own ? 'bg-slate-800 text-slate-100' : 'bg-slate-800/60 text-slate-500'}`}>
                    {own ? '' : '🔒'}{wd.text}
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
// ビートP交換所の「スタンプ」の売り場(55-screen-breeder-market.jsx の一覧の中に置く)。
// 買う処理は本体の交換(onExchange = exchangeRhythmEventPoints → multiStampExchange)。持っている品は「所持済み」
function MultiStampShopList({ points = 0, busy = false, disabled = false, openSheet, onExchange, onZoomIcon = null }) {
  const st = useMultiStamp();
  const [edit, setEdit] = React.useState(false);
  return <>
    <button type="button" data-multi-stamp-shop-edit onClick={() => setEdit(true)}
      className="col-span-full min-h-[44px] rounded-xl border border-cyan-300/50 bg-cyan-500/15 px-3 text-[13px] font-black text-cyan-100 active:scale-95">
      😊 マイスタンプを開く(並べる・作る)
    </button>
    <p data-multi-stamp-shop-note className="col-span-full -mt-1 text-[11px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>
      顔と言葉を組み合わせて、マルチのチャットで送れます。買った顔・言葉は、相手が持っていなくても絵で見えます
    </p>
    {MULTI_STAMP_SHOP_OFFERS.map((offer) => {
      const cost = multiStampOfferCost(offer, st);
      if (offer.group === 'monster' && !offer.monsters.some((id) => multiStampMonster(id))) return null;
      const label = multiStampOfferLabel(offer);
      const icons = multiStampOfferIcons(offer);
      const owned = cost === null;
      const shownCost = owned ? (offer.group === 'faceAll' ? MULTI_STAMP_PRICE.faceAllPer * MULTI_STAMP_ASSISTANT_IDS.length : offer.group === 'slot' ? MULTI_STAMP_PRICE.slot : (offer.group === 'face' ? MULTI_STAMP_PRICE.face : offer.group === 'monster' ? MULTI_STAMP_PRICE.monster : MULTI_STAMP_PRICE.words)) : cost;
      const item = { id: offer.id, name: label.name, emoji: offer.group === 'slot' ? '⭐' : offer.group === 'words' ? '💬' : '😊', icon: icons[0] || undefined, type: 'stamp', currency: 'beatPoint', cost: shownCost, desc: label.desc };
      return <MarketProductCard key={offer.id} dataAttrs={{ 'data-multi-stamp-offer': offer.id }}
        item={item} owned={owned} comingSoon={false}
        canBuy={!owned && points >= shownCost && !busy}
        disabled={disabled}
        onZoom={() => onZoomIcon && icons[0] && onZoomIcon(item)}
        onBuy={() => openSheet({ item, confirm: () => (onExchange ? onExchange(offer, 1) : false) })}
        middle={<span data-multi-stamp-offer-desc className="block px-1 text-center text-[10px] font-bold leading-tight text-slate-300" style={typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : undefined}>{typeof jaWrap === 'function' ? jaWrap(label.desc) : label.desc}</span>}
      />;
    })}
    {edit && <MultiStampEditor onClose={() => setEdit(false)} />}
  </>;
}

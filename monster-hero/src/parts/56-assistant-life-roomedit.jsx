// ===== 助手の部屋の模様替え(2026-11-11 社長「こっちのをこまかくいじれるように。サイズや位置や向きとか色とかも。位置は自分でそのまま指で持ってける」) =====
// 部屋を大きく見る画面(56-assistant-life-roomview.jsx の AssistantLifeRoomScene)の上で、家具を指でつまんで動かす。
//   位置(x・y)・大きさ(s)・向き(f 左右を返す・r 回す)・色(c)・前後(z 重なりの順・a 助手より前)。「◯◯におまかせ」で助手のくせの並べ方
// 公開の印 assistantLifeRoomEdit の後ろ(家具の印 assistantLifeFurniture も要る)。印がオフのあいだは何も読まない・何も書かない。
// 保存は新しいキーだけ(CLAUDE.md ⑦)。今の mh_assistant_life_room_v1(持っている家具 got・天井/壁/床 put・押し入れ kept)は読むだけで、書き換えない。
//   mh_assistant_life_room_layout_v1 … { [助手]: { items: [{ k 家具, x, y, s, r, f, c, a, z }] } }
//     x … 部屋の横幅に対する割合(0〜1・家具の真ん中)/ y … 0〜0.56 が壁(上の帯の下〜床の線)、0.56〜1 が床(床の線〜部屋の下)。縦・横で床の線の高さが違っても壁の物は壁に残る
//   mh_assistant_life_room_layout_migrated_v1 … 今の置き方(天井・壁・床の3つ)を一度だけ写した印
const ASSISTANT_LIFE_LAYOUT_KEY = 'mh_assistant_life_room_layout_v1';
const ASSISTANT_LIFE_LAYOUT_MIGRATED_KEY = 'mh_assistant_life_room_layout_migrated_v1';
const ASSISTANT_LIFE_LAYOUT_FLOOR = 0.56;
const ASSISTANT_LIFE_LAYOUT_MAX = 40;
const ASSISTANT_LIFE_LAYOUT_S = Object.freeze([0.5, 2.4]);
// 色(染色のように、いくつかから選ぶ)。絵文字の色を回す。0 はもとの色
const ASSISTANT_LIFE_LAYOUT_COLORS = Object.freeze([
  Object.freeze({ label: 'もとの色', dot: '#e5e7eb', filter: '' }),
  Object.freeze({ label: 'きいろ', dot: '#facc15', filter: 'hue-rotate(45deg)' }),
  Object.freeze({ label: 'みどり', dot: '#4ade80', filter: 'hue-rotate(100deg)' }),
  Object.freeze({ label: 'みずいろ', dot: '#38bdf8', filter: 'hue-rotate(170deg)' }),
  Object.freeze({ label: 'あお', dot: '#6366f1', filter: 'hue-rotate(220deg)' }),
  Object.freeze({ label: 'むらさき', dot: '#c084fc', filter: 'hue-rotate(270deg)' }),
  Object.freeze({ label: 'ピンク', dot: '#f472b6', filter: 'hue-rotate(320deg)' }),
  Object.freeze({ label: 'セピア', dot: '#b08968', filter: 'sepia(0.85)' }),
  Object.freeze({ label: 'しろくろ', dot: '#6b7280', filter: 'grayscale(1)' }),
]);
// 今の置き場所(天井・壁・床)に当たる位置。一度きりの写しと、新しく置くときの最初の位置
const ASSISTANT_LIFE_LAYOUT_SLOT_POS = Object.freeze({ ceil: Object.freeze({ x: 0.47, y: 0.05 }), wall: Object.freeze({ x: 0.13, y: 0.2 }), floor: Object.freeze({ x: 0.13, y: 0.5 }) });
const assistantLifeRoomEditEnabled = () => typeof assistantLifeFurnEnabled === 'function' && assistantLifeFurnEnabled() && typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantLifeRoomEdit === true;
const assistantLifeLayoutClamp = (v, lo, hi, def) => { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const normalizeAssistantLifeLayoutItem = (raw, keys) => {
  if (!raw || typeof raw !== 'object' || typeof raw.k !== 'string' || !keys.has(raw.k)) return null;
  return { k: raw.k, x: assistantLifeLayoutClamp(raw.x, 0, 1, 0.5), y: assistantLifeLayoutClamp(raw.y, 0, 1, 0.3),
    s: assistantLifeLayoutClamp(raw.s, ASSISTANT_LIFE_LAYOUT_S[0], ASSISTANT_LIFE_LAYOUT_S[1], 1), r: Math.round(assistantLifeLayoutClamp(raw.r, -180, 180, 0)),
    f: raw.f === true, c: Math.round(assistantLifeLayoutClamp(raw.c, 0, ASSISTANT_LIFE_LAYOUT_COLORS.length - 1, 0)), a: raw.a === true, z: Math.round(assistantLifeLayoutClamp(raw.z, -9999, 9999, 0)) };
};
const normalizeAssistantLifeLayoutOne = (raw) => {
  const keys = new Set((typeof assistantLifeFurnDefs === 'function' ? assistantLifeFurnDefs() : []).map(f => f.key));
  const seen = new Set(), items = [];
  for (const it of (raw && typeof raw === 'object' && Array.isArray(raw.items) ? raw.items : [])) {
    const n = normalizeAssistantLifeLayoutItem(it, keys);
    if (!n || seen.has(n.k) || items.length >= ASSISTANT_LIFE_LAYOUT_MAX) continue; // 同じ家具は1人に1つ
    seen.add(n.k); items.push(n);
  }
  return { items };
};
const normalizeAssistantLifeLayout = (raw) => {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const o = {};
  for (const [who, v] of Object.entries(r)) if (/^[a-z]+$/.test(who)) o[who] = normalizeAssistantLifeLayoutOne(v);
  return o;
};
// 今の置き方(天井・壁・床)を新しい並びへ写す(純粋な計算。もう並びがある助手は触らない)
const assistantLifeLayoutFromRoom = (room, layout) => {
  const out = { ...(layout || {}) };
  for (const [who, v] of Object.entries(room || {})) {
    if (out[who] && Array.isArray(out[who].items) && out[who].items.length) continue;
    const items = [];
    for (const slot of ['ceil', 'wall', 'floor']) { const k = v && v.put ? v.put[slot] : null; const p = ASSISTANT_LIFE_LAYOUT_SLOT_POS[slot]; if (typeof k === 'string' && k) items.push({ k, x: p.x, y: p.y, s: 1, r: 0, f: false, c: 0, a: false, z: items.length }); }
    if (items.length) out[who] = { items };
  }
  return out;
};
const ASSISTANT_LIFE_LAYOUT_STORE = {
  state: { layout: {} }, loaded: false, loading: null, listeners: new Set(),
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch {} } },
  set(layout) { this.state = { layout }; this.emit(); },
  load() {
    if (this.loaded) return Promise.resolve(this.state);
    if (!assistantLifeRoomEditEnabled()) return Promise.resolve(this.state); // 印がオフのあいだは読まない・写さない
    if (!this.loading) this.loading = (async () => {
      try {
        const [raw, migrated, gift] = await Promise.all([storeGet(ASSISTANT_LIFE_LAYOUT_KEY, null, false), storeGet(ASSISTANT_LIFE_LAYOUT_MIGRATED_KEY, null, false), ASSISTANT_LIFE_GIFT_STORE.load()]);
        let layout = normalizeAssistantLifeLayout(raw);
        if (migrated !== true && migrated !== 1) {
          // 一度だけ: 今の天井・壁・床の家具を、今と同じあたりへ写す。押し入れの家具は押し入れのまま
          layout = normalizeAssistantLifeLayout(assistantLifeLayoutFromRoom((gift && gift.room) || {}, layout));
          try { await storeSet(ASSISTANT_LIFE_LAYOUT_KEY, layout, false); await storeSet(ASSISTANT_LIFE_LAYOUT_MIGRATED_KEY, true, false); } catch {}
        }
        this.state = { layout };
      } catch {}
      this.loaded = true; this.emit(); return this.state;
    })();
    return this.loading;
  },
};
const useAssistantLifeLayoutState = () => {
  const [st, setSt] = React.useState(ASSISTANT_LIFE_LAYOUT_STORE.state);
  React.useEffect(() => {
    const fn = (s) => setSt(s);
    ASSISTANT_LIFE_LAYOUT_STORE.listeners.add(fn);
    void ASSISTANT_LIFE_LAYOUT_STORE.load().then(() => setSt(ASSISTANT_LIFE_LAYOUT_STORE.state));
    return () => { ASSISTANT_LIFE_LAYOUT_STORE.listeners.delete(fn); };
  }, []);
  return st;
};
// その助手の部屋に出ている家具(贈ってある物だけ。重なりの順に並べる)
const assistantLifeLayoutOf = (who, st = ASSISTANT_LIFE_LAYOUT_STORE.state, giftSt = ASSISTANT_LIFE_GIFT_STORE.state) => {
  const got = typeof assistantLifeRoomOf === 'function' ? assistantLifeRoomOf(who, giftSt).got : {};
  return normalizeAssistantLifeLayoutOne((st.layout || {})[who]).items.filter(it => got[it.k]).sort((a, b) => a.z - b.z);
};
const assistantLifeLayoutSave = (who, items) => {
  if (!assistantLifeRoomEditEnabled() || !ASSISTANT_LIFE_LAYOUT_STORE.loaded) return; // 読み終わる前に書くと、保存してある並びを空で上書きしてしまう
  const layout = { ...ASSISTANT_LIFE_LAYOUT_STORE.state.layout, [who]: normalizeAssistantLifeLayoutOne({ items }) };
  ASSISTANT_LIFE_LAYOUT_STORE.set(layout);
  try { storeSet(ASSISTANT_LIFE_LAYOUT_KEY, layout, false); } catch {}
};
// 新しく置くときの位置(その家具のもとの置き場所のあたり。先客がいたら少しずつ右へずらす)
const assistantLifeLayoutNewItem = (key, items) => {
  const f = typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(key) : null;
  const p = ASSISTANT_LIFE_LAYOUT_SLOT_POS[(f && f.slot) || 'floor'] || ASSISTANT_LIFE_LAYOUT_SLOT_POS.floor;
  let x = p.x, n = 0;
  while (n < 10 && items.some(it => Math.abs(it.x - x) < 0.06 && Math.abs(it.y - p.y) < 0.06)) { x = Math.min(0.94, x + 0.13); n++; }
  return { k: key, x, y: p.y, s: 1, r: 0, f: false, c: 0, a: false, z: items.reduce((m, it) => Math.max(m, it.z), 0) + 1 };
};
// 置く/しまう(家具のシートから。印がオンのときの行き先)
const assistantLifeLayoutPut = async (who, key, toPut) => {
  await ASSISTANT_LIFE_LAYOUT_STORE.load();
  const cur = assistantLifeLayoutOf(who);
  if (toPut) { if (!cur.some(it => it.k === key)) assistantLifeLayoutSave(who, [...cur, assistantLifeLayoutNewItem(key, cur)]); }
  else assistantLifeLayoutSave(who, cur.filter(it => it.k !== key));
};
// 贈った家具は、そのまま部屋に出す(56-assistant-life-gifts.jsx の assistantLifeFurnGive から)
const assistantLifeLayoutOnGive = (who, key) => { if (assistantLifeRoomEditEnabled()) void assistantLifeLayoutPut(who, key, true); };

// ----- ◯◯におまかせ(助手のくせ) -----
// hero … いちばん良い所へ大きく置く家具 / pull … 真ん中へ寄せる強さ / low … 下へ下げる / tilt … かたむき / gap … 好きな家具の大きさ
// 置き方の型と台詞は仮(台詞は台詞の担当へ頼む。ROOM-LAYOUT-PREP.md の2)
const ASSISTANT_LIFE_LAYOUT_HABITS = Object.freeze({
  mua:       Object.freeze({ hero: 'bear',      pull: 0.22, low: 0,    tilt: 0,  big: 1.15, line: 'できたー♪ くまさんは真ん中がいいのっ✨' }),
  kiki:      Object.freeze({ hero: 'bookshelf', pull: 0,    low: 0,    tilt: 0,  big: 1.05, line: '本は手の届く所、植物は窓のそば。きっちり並べたよ' }),
  momosuke:  Object.freeze({ hero: 'record',    pull: 0.12, low: 0,    tilt: 10, big: 1.25, line: 'にぎやかにしてみた！ ここで歌ったら最高ぢゃない？' }),
  dra:       Object.freeze({ hero: 'sofa',      pull: 0.05, low: 0.1,  tilt: 6,  big: 1.2,  line: 'ぜんぶ低い所に寄せた…ごろごろできる…' }),
  atsu:      Object.freeze({ hero: 'trophy',    pull: 0,    low: 0,    tilt: 0,  big: 1.2,  line: 'トロフィーはいちばん目立つとこ！ いい部屋になったっしょ笑' }),
  kyuko:     Object.freeze({ hero: 'starpic',   pull: -0.04, low: 0,   tilt: 0,  big: 1.05, line: 'ほい、できたよぉ。すっきりさせてみた笑' }),
  sorashido: Object.freeze({ hero: 'lantern',   pull: 0.08, low: -0.03, tilt: 0, big: 1.2,  line: '星のものは上に集めたぜ・・・！ でーじいい感じだぜ' }),
  erubin:    Object.freeze({ hero: 'plant',     pull: -0.06, low: 0,   tilt: 0,  big: 1.1,  line: '窓のそばに緑を置いたよ。落ち着く部屋になったと思う' }),
});
// 置き場所ごとの席(良い順)。窓(右上)と助手(真ん中)とマスモン(床の手前)を空ける。床の家具は助手の前の机・ソファに隠れないよう、助手より前の層に置く
const ASSISTANT_LIFE_LAYOUT_SEATS = Object.freeze({
  ceil: [[0.47, 0.05], [0.17, 0.04], [0.76, 0.03], [0.32, 0.03], [0.62, 0.04]],
  wall: [[0.13, 0.24], [0.34, 0.2], [0.12, 0.41], [0.9, 0.43], [0.53, 0.19]],
  floor: [[0.13, 0.57], [0.87, 0.57], [0.08, 0.72], [0.92, 0.72], [0.33, 0.6]],
});
// owned … その助手に贈ってある家具の key。苦手な家具は押し入れへ。席が足りない分も押し入れへ
const assistantLifeLayoutOmakase = (who, owned) => {
  const h = ASSISTANT_LIFE_LAYOUT_HABITS[who] || ASSISTANT_LIFE_LAYOUT_HABITS.mua;
  const like = (k) => (typeof assistantLifeFurnLike === 'function' ? assistantLifeFurnLike(who, k) : 'mid');
  const rank = (k) => (k === h.hero ? 0 : like(k) === 'like' ? 1 : 2);
  const keys = [...new Set(owned)].filter(k => like(k) !== 'bad').sort((a, b) => rank(a) - rank(b));
  const used = { ceil: 0, wall: 0, floor: 0 }, items = [];
  for (const k of keys) {
    const f = typeof assistantLifeFurnOf === 'function' ? assistantLifeFurnOf(k) : null;
    const slot = f && ASSISTANT_LIFE_LAYOUT_SEATS[f.slot] ? f.slot : 'floor';
    const seat = ASSISTANT_LIFE_LAYOUT_SEATS[slot][used[slot]++];
    if (!seat) continue;
    const i = items.length;
    const x = seat[0] + (0.5 - seat[0]) * h.pull, y = seat[1] + (slot === 'ceil' ? 0 : h.low);
    items.push({ k, x: Math.max(0.06, Math.min(0.94, x)), y: Math.max(0.03, Math.min(0.72, y)), s: k === h.hero ? h.big + 0.15 : like(k) === 'like' ? h.big : 0.95,
      r: h.tilt && slot !== 'ceil' ? (i % 2 ? -h.tilt : h.tilt) : 0, f: seat[0] > 0.5, c: 0, a: slot === 'floor', z: i });
  }
  return { items, line: h.line, kept: [...new Set(owned)].filter(k => !items.some(it => it.k === k)) };
};

// ----- 描く -----
// 部屋の中の位置(px)。geom … { W, top 壁の上, floorY 床の線, bottom 部屋の下 }
const assistantLifeLayoutPx = (it, g) => ({ left: it.x * g.W, top: it.y <= ASSISTANT_LIFE_LAYOUT_FLOOR ? g.top + (it.y / ASSISTANT_LIFE_LAYOUT_FLOOR) * (g.floorY - g.top) : g.floorY + ((it.y - ASSISTANT_LIFE_LAYOUT_FLOOR) / (1 - ASSISTANT_LIFE_LAYOUT_FLOOR)) * (g.bottom - g.floorY) });
const assistantLifeLayoutFromPx = (left, top, g) => ({ x: Math.max(0.02, Math.min(0.98, left / g.W)),
  y: Math.max(0.01, Math.min(0.99, top <= g.floorY ? ((top - g.top) / Math.max(1, g.floorY - g.top)) * ASSISTANT_LIFE_LAYOUT_FLOOR : ASSISTANT_LIFE_LAYOUT_FLOOR + ((top - g.floorY) / Math.max(1, g.bottom - g.floorY)) * (1 - ASSISTANT_LIFE_LAYOUT_FLOOR))) });
const assistantLifeLayoutBase = (g) => Math.round(Math.max(34, Math.min(56, g.W * 0.12)));
const assistantLifeLayoutStyle = (it, g) => {
  const p = assistantLifeLayoutPx(it, g), col = ASSISTANT_LIFE_LAYOUT_COLORS[it.c] || ASSISTANT_LIFE_LAYOUT_COLORS[0];
  return { position: 'absolute', left: p.left, top: p.top, fontSize: Math.round(assistantLifeLayoutBase(g) * it.s), lineHeight: 1, transform: `translate(-50%,-50%) rotate(${it.r}deg) scaleX(${it.f ? -1 : 1})`,
    filter: `${col.filter ? `${col.filter} ` : ''}drop-shadow(0 5px 4px #0005)` };
};
// 大きな部屋の家具。front … 助手より前の層か(a が真の家具)。items を渡さなければ、その助手の保存してある並び
//   edit … 模様替えの間だけ { sel, onSelect(k), onMove(k, x, y) }。つまむ所は AssistantLifeRoomLayoutHandles(いちばん前の層)
function AssistantLifeRoomLayoutLayer({ who, items = null, geom, front = false, onTip = null }) {
  const st = useAssistantLifeLayoutState();
  const giftSt = useAssistantLifeGiftState();
  const list = (items || assistantLifeLayoutOf(who, st, giftSt)).filter(it => !!it.a === front);
  return (<>{list.map(it => { const f = assistantLifeFurnOf(it.k); if (!f) return null; return (
    <button key={it.k} type="button" data-assistant-life-roomview-furn={it.k} data-assistant-life-layout-item={`${it.k}:${front ? 'front' : 'back'}`} aria-label={f.name}
      onClick={() => { if (onTip) onTip(`${f.emoji} ${f.name}`); }} style={assistantLifeLayoutStyle(it, geom)}>{f.emoji}</button>); })}</>);
}
// 模様替えの間、家具をつまむ所(見えない札を家具と同じ位置に、いちばん前の層へ置く。助手やマスモンの後ろの家具もつまめる)
function AssistantLifeRoomLayoutHandles({ items, geom, sel, onSelect, onMove, onDrop }) {
  const drag = React.useRef(null);
  const down = (e, it) => {
    e.preventDefault(); e.stopPropagation();
    onSelect(it.k);
    const p = assistantLifeLayoutPx(it, geom);
    drag.current = { k: it.k, id: e.pointerId, dx: p.left - e.clientX, dy: p.top - e.clientY, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
  };
  const move = (e) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    d.moved = true;
    const q = assistantLifeLayoutFromPx(e.clientX + d.dx, e.clientY + d.dy, geom);
    onMove(d.k, q.x, q.y);
  };
  const up = (e) => { const d = drag.current; if (!d || d.id !== e.pointerId) return; drag.current = null; if (d.moved && onDrop) onDrop(d.k); };
  return (<>{items.map(it => { const f = assistantLifeFurnOf(it.k); if (!f) return null; const p = assistantLifeLayoutPx(it, geom); const size = Math.max(44, Math.round(assistantLifeLayoutBase(geom) * it.s * 1.15)); return (
    <button key={it.k} type="button" data-assistant-life-layout-handle={it.k} aria-label={`${f.name}を動かす`} aria-pressed={sel === it.k}
      onPointerDown={(e) => down(e, it)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      style={{ position: 'absolute', left: p.left, top: p.top, width: size, height: size, transform: 'translate(-50%,-50%)', zIndex: 20 + (sel === it.k ? 1 : 0), touchAction: 'none', cursor: 'grab',
        borderRadius: 12, border: sel === it.k ? '2.5px dashed #f472b6' : '1.5px dashed #ffffff90', background: sel === it.k ? '#ffffff38' : 'transparent' }}/>); })}</>);
}
// 家の一覧の小さな部屋(印がオンのとき)。同じ並びを小さく写す。顔・吹き出し・札の後ろに描くので、重なりを測り直さない
function AssistantLifeRoomLayoutMini({ id, w, h }) {
  const st = useAssistantLifeLayoutState();
  const giftSt = useAssistantLifeGiftState();
  const items = assistantLifeLayoutOf(id, st, giftSt);
  const g = { W: w, top: 2, floorY: Math.round(h * 0.62), bottom: h - 4 };
  const base = Math.max(11, Math.min(20, h * 0.2, w * 0.13));
  return (<>{items.map(it => { const f = assistantLifeFurnOf(it.k); if (!f) return null; const p = assistantLifeLayoutPx(it, g); const col = ASSISTANT_LIFE_LAYOUT_COLORS[it.c] || ASSISTANT_LIFE_LAYOUT_COLORS[0]; return (
    <span key={it.k} aria-hidden="true" data-assistant-life-room-furn={`${id}:layout:${it.k}`} style={{ position: 'absolute', left: p.left, top: p.top, zIndex: 0, pointerEvents: 'none', lineHeight: 1,
      fontSize: Math.round(base * Math.min(1.6, it.s)), transform: `translate(-50%,-50%) rotate(${it.r}deg) scaleX(${it.f ? -1 : 1})`, filter: col.filter || undefined }}>{f.emoji}</span>); })}</>);
}

// ----- 模様替えの画面 -----
// scene … AssistantLifeRoomScene へそのまま渡す中身(people・team・look など)。onClose … 閉じる
function AssistantLifeRoomEditor({ id, land = false, scene = {}, onClose }) {
  const st = useAssistantLifeLayoutState();
  const giftSt = useAssistantLifeGiftState();
  const who = assistantById(id);
  const saved = assistantLifeLayoutOf(id, st, giftSt);
  const [items, setItems] = React.useState(null); // 動かしている間の並び(離したら保存)
  const first = React.useRef(null); // 開いたときの並び(「もとに戻す」)
  const [sel, setSel] = React.useState(null);
  const [colorOpen, setColorOpen] = React.useState(false);
  const [line, setLine] = React.useState('');
  const loaded = ASSISTANT_LIFE_LAYOUT_STORE.loaded;
  React.useEffect(() => { if (loaded && first.current === null) first.current = saved; }, [loaded]);
  React.useEffect(() => { if (!line) return undefined; const t = setTimeout(() => setLine(''), 5000); return () => clearTimeout(t); }, [line]);
  if (!who || !assistantLifeRoomEditEnabled()) return null;
  const cur = items || saved;
  const got = Object.keys(assistantLifeRoomOf(id, giftSt).got || {});
  const kept = got.filter(k => !cur.some(it => it.k === k));
  const commit = (next) => { setItems(null); assistantLifeLayoutSave(id, next); };
  const patch = (k, p) => commit(cur.map(it => (it.k === k ? { ...it, ...p } : it)));
  const selIt = cur.find(it => it.k === sel) || null;
  const zs = cur.map(it => it.z);
  const tool = (key, label, fn, dis = false, aria = null) => <button key={key} type="button" data-assistant-life-layout-tool={key} aria-label={aria || undefined} disabled={dis} onClick={fn}
    className="min-h-[40px] min-w-[44px] shrink-0 rounded-lg border border-slate-500 bg-slate-800 px-2 text-[12px] font-black text-white active:scale-95 disabled:opacity-35">{label}</button>;
  const chip = (k, placed) => { const f = assistantLifeFurnOf(k); if (!f) return null; return (
    <button key={k} type="button" data-assistant-life-layout-chip={`${k}:${placed ? 'put' : 'kept'}`} aria-label={placed ? `${f.name}を選ぶ` : `${f.name}を部屋に置く`} aria-pressed={sel === k}
      onClick={() => { if (placed) { setSel(sel === k ? null : k); } else { const it = { ...assistantLifeLayoutNewItem(k, cur), x: 0.5, y: 0.3, a: true }; commit([...cur, it]); setSel(k); } setColorOpen(false); }}
      className={`relative h-[44px] w-[44px] shrink-0 rounded-xl border-2 text-[22px] leading-none active:scale-95 ${sel === k ? 'border-pink-400 bg-pink-500/30' : placed ? 'border-slate-500 bg-slate-800' : 'border-dashed border-amber-300/80 bg-slate-900'}`}>
      <span style={{ opacity: placed ? 1 : 0.55 }}>{f.emoji}</span>{!placed && <span className="absolute -right-1 -top-1 rounded-full bg-amber-400 px-1 text-[10px] font-black leading-[14px] text-slate-900">＋</span>}
    </button>); };
  const omakase = () => { const r = assistantLifeLayoutOmakase(id, got); commit(r.items); setSel(null); setColorOpen(false); setLine(r.line); };
  const panel = (
    <div className="flex flex-col gap-1.5 bg-slate-950 px-3 pt-2" style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom))', ...(land ? { width: '44%', height: '100%', overflowY: 'auto', paddingTop: 8 } : {}) }} data-assistant-life-layout-panel>
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-[12px] font-black text-white">{selIt ? `${assistantLifeFurnOf(selIt.k).emoji} ${assistantLifeFurnOf(selIt.k).name}` : '家具を指でつまんで動かす'}</p>
        <span className="shrink-0 text-[10.5px] font-bold text-slate-300" data-assistant-life-layout-count>置いてある {cur.length} / {got.length}</span>
      </div>
      {/* 選んだ家具の道具 */}
      {colorOpen && selIt ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" data-assistant-life-layout-colors>
          {ASSISTANT_LIFE_LAYOUT_COLORS.map((c, i) => <button key={i} type="button" data-assistant-life-layout-color={i} aria-label={c.label} aria-pressed={selIt.c === i} onClick={() => patch(sel, { c: i })}
            className={`h-[40px] w-[40px] shrink-0 rounded-full border-[3px] active:scale-95 ${selIt.c === i ? 'border-white' : 'border-slate-600'}`} style={{ background: c.dot }}/>)}
          {tool('colorclose', '← 戻る', () => setColorOpen(false))}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5" data-assistant-life-layout-tools>
          {tool('small', '小', () => patch(sel, { s: Math.max(ASSISTANT_LIFE_LAYOUT_S[0], Math.round((selIt.s - 0.15) * 100) / 100) }), !selIt || selIt.s <= ASSISTANT_LIFE_LAYOUT_S[0], '小さくする')}
          {tool('big', '大', () => patch(sel, { s: Math.min(ASSISTANT_LIFE_LAYOUT_S[1], Math.round((selIt.s + 0.15) * 100) / 100) }), !selIt || selIt.s >= ASSISTANT_LIFE_LAYOUT_S[1], '大きくする')}
          {tool('flip', '↔', () => patch(sel, { f: !selIt.f }), !selIt, '左右を返す')}
          {tool('rotl', '↺', () => patch(sel, { r: ((selIt.r - 15 + 540) % 360) - 180 }), !selIt, '左へ回す')}
          {tool('rotr', '↻', () => patch(sel, { r: ((selIt.r + 15 + 540) % 360) - 180 }), !selIt, '右へ回す')}
          {tool('color', '🎨 色', () => setColorOpen(true), !selIt)}
          {tool('front', '前へ', () => patch(sel, { z: Math.max(...zs) + 1 }), !selIt)}
          {tool('back', '後ろへ', () => patch(sel, { z: Math.min(...zs) - 1 }), !selIt)}
          {tool('layer', selIt && selIt.a ? '助手の後ろへ' : '助手の前へ', () => patch(sel, { a: !selIt.a }), !selIt)}
          {tool('keep', 'しまう', () => { commit(cur.filter(it => it.k !== sel)); setSel(null); }, !selIt)}
        </div>)}
      {/* 置いてある家具(押すと選ぶ)と、押し入れの家具(押すと部屋に出す) */}
      <div className={`flex items-center gap-1.5 ${land ? 'flex-wrap' : 'overflow-x-auto'} pb-0.5`} data-assistant-life-layout-chips>
        {cur.map(it => chip(it.k, true))}{kept.map(k => chip(k, false))}
        {got.length === 0 && <p className="text-[11px] font-bold text-slate-300">まだ家具がありません。「🪑 家具」から贈ると、ここに並びます</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <button type="button" data-assistant-life-layout-omakase disabled={got.length === 0} onClick={omakase} className="min-h-[44px] flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-2 text-[12.5px] font-black text-white shadow active:scale-95 disabled:opacity-40">🎀 {who.name}におまかせ</button>
        <button type="button" data-assistant-life-layout-undo onClick={() => { if (first.current) commit(first.current); setSel(null); }} className="min-h-[44px] shrink-0 rounded-xl border border-slate-500 px-2.5 text-[12px] font-black text-slate-200 active:scale-95">もとに戻す</button>
        <button type="button" data-assistant-life-layout-done onClick={onClose} className="min-h-[44px] shrink-0 rounded-xl bg-emerald-600 px-3 text-[12.5px] font-black text-white shadow active:scale-95">✓ できた</button>
      </div>
    </div>);
  return (
    <div className={`absolute inset-0 flex ${land ? 'flex-row' : 'flex-col'} bg-slate-950`} style={{ zIndex: 34 }} data-assistant-life-layout-editor={id}>
      <div className="relative min-h-0 min-w-0 flex-1">
        <AssistantLifeRoomScene {...scene} id={id} land={land} title={`${who.name}の部屋の模様替え`} sub="家具をつまんで好きな所へ。下の道具で大きさ・向き・色" bubble="" padLeft={78} dock={null} onBack={null} onPerson={null} onMasmon={null}
          layoutWho={id} layoutEdit={{ items: cur, sel, onSelect: (k) => { setSel(k); setColorOpen(false); },
            onMove: (k, x, y) => setItems(cur.map(it => (it.k === k ? { ...it, x, y } : it))), onDrop: () => { if (items) commit(items); } }}/>
        {/* おまかせのひとこと(助手が留守でも出す) */}
        {line && <p className="pointer-events-none absolute left-1/2 max-w-[86%] -translate-x-1/2 rounded-2xl border-2 border-pink-400 bg-white px-3 py-1.5 text-center text-[12.5px] font-black leading-snug text-slate-900 shadow" style={{ bottom: 12, zIndex: 30, wordBreak: 'auto-phrase' }} data-assistant-life-layout-line>{who.name}「{line}」</p>}
      </div>
      {panel}
    </div>);
}

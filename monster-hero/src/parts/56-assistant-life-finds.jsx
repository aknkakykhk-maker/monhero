// ===== 助手ライフの拾い物・贈り物: モンヒロサクセスの「持ちこみアイテム」が手に入る =====
// 社長の依頼(2026-11-14「モンサクの持ちこみアイテムを、助手ライフの拾い物・贈り物でも手に入るように」)。案どおり:
//   ・助手が出かけ先から家へ帰ったとき 8%(拾い物)/ 家で誰かと過ごしている助手 4%(贈り物)/ モンヒロバトルにいた助手のマスモン 5%(拾い物)
//   ・1日2個まで。公開の印 monheroSuccess が偽のあいだは、抽選もしない・渡さない
//   ・出やすさ: 多め60%(ジュース・悪様散・オイリーパック・キビダンゴ・うけつぎ草)/ふつう30%(雑誌・ハチマキ・ミサンガ・お守り・ライセンス)/まれ10%(導き書・ルーペ)。砂時計・チケットは出さない
//   ・保存: モンサクの meta.items[id] に +1(msxNormMeta を通す)。1日の数と直前の居場所は新しいキー mh_msx_find_v1(既存のキーは触らない)
//   ・見せ方: 助手ライフの上に小さな札(AssistantLifeFindCard)。「閉じる」で消える
const ASSISTANT_LIFE_FIND_KEY = 'mh_msx_find_v1';
const ASSISTANT_LIFE_FIND_DAILY = 2;
const ASSISTANT_LIFE_FIND_CHANCE = Object.freeze({ trip: 0.08, gift: 0.04, masmon: 0.05 });
const ASSISTANT_LIFE_FIND_TABLE = Object.freeze([
  ['juice', 12], ['powder', 12], ['pack', 12], ['dango', 12], ['grass', 12],
  ['mag', 6], ['hachi', 6], ['band', 6], ['omamori', 6], ['license', 6],
  ['guide', 5], ['loupe', 5],
]);
const ASSISTANT_LIFE_FIND_LINES = Object.freeze({
  trip: ['これ、道で見つけたよ。使うかなって', '落ちてたの拾ってきたんだ。あげる'],
  gift: ['あなたに持っててほしいの', 'これ、きっと役に立つよ'],
  masmon: ['(マスモンが何かくわえて戻ってきた!)', '(マスモンが得意げに持ってきた!)'],
});
// 助手ごとのひとこと(2026-11-14 キズナ2と相談)。手で書き換えない: 行ファイル docs/progress/assistant-peer/lines/life-find-lines.txt → node tools/assistant/life-find-lines-import.js
const ASSISTANT_LIFE_FIND_LINES_BY = Object.freeze({"mua":{"trip":["これ道で見つけたんだけど、まぢ使えそうぢゃん？あげる！","帰りに拾ったー！あたしの分もがんばってｗ"],"gift":["これ、あたしからー！がんばってほしーから✨","はいっ、プレゼント！ぜったい役立つやつ！"],"masmon":["ねぇ見て、うちの子が何かくわえて戻ってきたｗ","うちの子えらすぎる…拾ってきたって！"]},"kiki":{"trip":["お散歩の途中で見つけたんでつ。よかったらどうぞ♪♪","帰り道に落ちてたので、使ってくだしゃいね(´ー`*)"],"gift":["私から、ささやかですけど…どうぞ( ˘ω˘)","これ、きっと役に立ちまつ♪♪"],"masmon":["あれま、うちの子がこれを持って戻ってきまつた","うちの子が見つけてきたみたいでつ。どうぞ♪♪"]},"momosuke":{"trip":["道で見つけたの、もものおみやげ♡","これ拾ったー！！えらくない？w"],"gift":["ももからのプレゼント♡ ちゃんと使ってよね？w","はい、あげる！もも優しすぎじゃない？w"],"masmon":["まって、うちの子なんかくわえてきたw かわいすぎ！！","うちの子が拾ってきたって！すご！！"]},"dra":{"trip":["えへへ、道で拾ったんだわ。使ってくれよな","帰りに見つけたからな。おでからのおみやげだ"],"gift":["おでからだ。何がとは言わんけど、役に立つからな","これ、持っててくれよな。えへへ"],"masmon":["ふむ、うちの子が何かくわえて帰ってきたわ","うちのマスモン、拾い物の才能あるよな"]},"atsu":{"trip":["てか道に落ちてたから拾ってきた笑 使って！","帰りに見つけたー笑 これいいやつだよ！"],"gift":["とりあえずこれ渡しとく笑","これ使ってよ。仲間だし笑"],"masmon":["うちの子がなんか持ってきた笑 えらいー笑","まじで？うちの子拾ってきたじゃん笑"]},"kyuko":{"trip":["帰りに見つけたぁ。あげる笑","ほい！道で拾ったやつ。無課金でもこれで戦えるよぉw"],"gift":["これ、俺から。使ってくれたらうれしいなぁ笑","おけ、これ渡しとくね。役に立つはずw"],"masmon":["うちの子がなんかくわえてきたぁw","うちの子えらすぎて泣ける😭"]},"sorashido":{"trip":["帰り道で見つけました。使えると思いますよ！","ほほー！道に落ちてたので拾ってきました"],"gift":["これ、自分からです。役に立つと思います","よかったらどうぞ。育成で効いてくると思います"],"masmon":["うちの子が何か持って戻ってきましたね","そうか・・・！うちの子、拾ってきてくれたんですね"]},"erubin":{"trip":["道で見つけたよ！使ってw","帰りに拾ったー！これいいね笑"],"gift":["俺からのプレゼント！受け取ってね笑","これ渡しとくね。さすがに役立つはずw"],"masmon":["うちの子がなんか持ってきたw さすが！","うちの子、拾ってきてくれたー！☺️"]}});
const assistantLifeFindNorm = (raw) => {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const last = {}; if (o.last && typeof o.last === 'object') for (const [k, v] of Object.entries(o.last)) if (typeof v === 'string' && v.length < 24) last[String(k).slice(0, 24)] = v;
  const pending = (Array.isArray(o.pending) ? o.pending : []).filter(p => p && typeof p.item === 'string' && typeof p.kind === 'string').slice(-5)
    .map(p => ({ item: p.item.slice(0, 24), kind: p.kind.slice(0, 12), who: typeof p.who === 'string' ? p.who.slice(0, 24) : '', line: Number.isFinite(p.line) ? p.line : 0 }));
  return { day: typeof o.day === 'string' ? o.day.slice(0, 12) : '', n: Math.max(0, Math.min(99, Math.floor(Number(o.n) || 0))), last, pending };
};
const assistantLifeFindPick = (rand = Math.random) => {
  const total = ASSISTANT_LIFE_FIND_TABLE.reduce((a, t) => a + t[1], 0); let x = rand() * total;
  for (const [id, w] of ASSISTANT_LIFE_FIND_TABLE) { x -= w; if (x < 0) return id; }
  return ASSISTANT_LIFE_FIND_TABLE[0][0];
};
// 1回の時間の切り替え(助手ライフの1回ごと)で呼ぶ。life … 新しい今の過ごし方。印が偽・保存が使えないときは何もしない
const assistantLifeFindOnSlot = async (life, slot, now = Date.now(), rand = Math.random) => {
  try {
    if (typeof msxReleased !== 'function' || !msxReleased() || typeof storeGet !== 'function' || typeof storeSet !== 'function' || !life) return null;
    const st = assistantLifeFindNorm(await storeGet(ASSISTANT_LIFE_FIND_KEY, null));
    const day = typeof assistantLifeDayKey === 'function' ? String(assistantLifeDayKey(now)) : '';
    if (st.day !== day) { st.day = day; st.n = 0; }
    const where = {}; // 助手 → { place, grouped }
    for (const [id, s] of Object.entries(life.solo || {})) if (s) where[id] = { place: s.place, grouped: false };
    for (const g of (life.groups || [])) for (const id of (g.ids || [])) where[id] = { place: g.place, grouped: (g.ids || []).length >= 2 };
    const found = [];
    for (const [id, w] of Object.entries(where)) {
      if (st.n + found.length >= ASSISTANT_LIFE_FIND_DAILY) break;
      const was = st.last[id];
      let kind = null;
      if (was && was !== 'home' && w.place === 'home') kind = 'trip';
      else if (w.place === 'home' && w.grouped) kind = 'gift';
      else if (w.place === 'battle') kind = 'masmon';
      if (kind && rand() < ASSISTANT_LIFE_FIND_CHANCE[kind]) found.push({ item: assistantLifeFindPick(rand), kind, who: id, line: Math.floor(rand() * 2) });
    }
    st.last = Object.fromEntries(Object.entries(where).map(([id, w]) => [id, w.place]));
    if (found.length) {
      const K = typeof MSX_KEYS !== 'undefined' ? MSX_KEYS.meta : 'mh_monsuc_meta_v1';
      const meta = msxNormMeta(await storeGet(K, null));
      const ok = [];
      for (const f of found) { if (typeof MSX_ITEM_BY_ID !== 'undefined' && !MSX_ITEM_BY_ID[f.item]) continue; meta.items[f.item] = Math.min(999, (meta.items[f.item] || 0) + 1); ok.push(f); }
      if (ok.length) { await storeSet(K, msxNormMeta(meta)); st.n += ok.length; st.pending = [...st.pending, ...ok].slice(-5); }
    }
    await storeSet(ASSISTANT_LIFE_FIND_KEY, st);
    if (found.length && typeof window !== 'undefined') { try { window.dispatchEvent(new Event('mh-life-find')); } catch (_) {} }
    return found;
  } catch (_) { return null; }
};
// 助手ライフの上に出す小さな札(もらった物を知らせる)。印が偽のあいだは何も出さない
function AssistantLifeFindCard() {
  const [st, setSt] = React.useState(null);
  const read = React.useCallback(async () => {
    try { if (typeof msxReleased !== 'function' || !msxReleased()) { setSt(null); return; } setSt(assistantLifeFindNorm(await storeGet(ASSISTANT_LIFE_FIND_KEY, null))); } catch (_) {}
  }, []);
  React.useEffect(() => { void read(); window.addEventListener('mh-life-find', read); return () => window.removeEventListener('mh-life-find', read); }, [read]);
  const p = st && st.pending[0];
  if (!p) return null;
  const item = typeof MSX_ITEM_BY_ID !== 'undefined' ? MSX_ITEM_BY_ID[p.item] : null;
  const who = typeof assistantById === 'function' && p.who ? assistantById(p.who) : null;
  const own = who && ASSISTANT_LIFE_FIND_LINES_BY[who.id] && ASSISTANT_LIFE_FIND_LINES_BY[who.id][p.kind];
  const lines = own && own.length ? own : (ASSISTANT_LIFE_FIND_LINES[p.kind] || ASSISTANT_LIFE_FIND_LINES.trip);
  const close = async () => { try { const n = assistantLifeFindNorm(await storeGet(ASSISTANT_LIFE_FIND_KEY, null)); n.pending = n.pending.slice(1); await storeSet(ASSISTANT_LIFE_FIND_KEY, n); setSt(n); } catch (_) {} };
  return (
    <div data-assistant-life-find className="mx-2 mb-1 flex items-center gap-2 rounded-xl border border-amber-300/70 bg-slate-950/90 px-2.5 py-1.5">
      <span className="text-[24px]" aria-hidden="true">{item ? item.e : '🎁'}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-black text-amber-100">🎁 {item ? item.name : '持ちこみアイテム'}をもらった</p>
        <p className="text-[10.5px] font-bold leading-snug text-slate-200">{who ? `${who.name}「${lines[p.line % lines.length]}」` : lines[p.line % lines.length]}(モンヒロサクセスで使えます)</p>
      </div>
      <button type="button" onClick={close} className="shrink-0 rounded-lg border border-amber-300/60 px-2 py-1 text-[11px] font-black text-amber-100 active:scale-95">閉じる</button>
    </div>);
}

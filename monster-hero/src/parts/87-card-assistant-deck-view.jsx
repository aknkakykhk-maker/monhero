// ==================== MFバトルカード: 助手のデッキの中身を見せる部品(2026-11-08 カード部ツナグ) ====================
// 社長「デッキは何パターンかあって中身も見れる方が良さそう。その何パターンかのデッキを対戦で出すみたいな」
//   → 決まり(2026-11-08): 助手ごとに3つ(攻め/守り/ふつう)・助手の気分で選ぶ・3つとも全部見せる・助手どうしでも同じ3つ
//
// 部品
//   CardAssistantDeckView({ who, styleId, land })  … 助手部(キズナ2)のマスモンのデッキのタブ(56 の AssistantMasmonSheet)へ差しこむ中身。
//       名前・助手のひとこと・3体・切り札・種類ごとのカードの一覧(同じカードは ×3 でまとめる・押すと大きく見る)・組み直した時刻。
//       3つの切りかえ(よく使うの印)はタブの側(キズナ2)。外枠は .mhm-card(56 の見た目・端にくっつかない検査がそのまま効く)
//   CardFoeDeckChip({ name, styleId, kind })      … 対戦で出したデッキの型の札(相手えらび・VS・結果・記録)。kind … 'foe' | 'vs' | 'result'
//
// 中身はルールの cardAssistantDeckPreview(82・読むだけ)。印 cardGrowStyle(84 の cardGrowStyleOn)が偽のあいだは何も出さない(null)
// ★82 は触らない(サーバの杯で同じ 82 が動くため)。画面の部品だけをここに置く

// 型の言い方と印(82 の CARD_AI_STYLE_IDS と同じ3つ)
const CARD_DECK_STYLE_LABEL = Object.freeze({ attack: '攻め', guard: '守り', normal: 'ふつう' });
const CARD_DECK_STYLE_ICON = Object.freeze({ attack: '⚔️', guard: '🛡️', normal: '⚖️' });
// 一覧の並び(種類ごと)。ちから技・かしこさ技は「技」にまとめる
const CARD_DECK_KIND_GROUPS = Object.freeze([['技', ['pow', 'int']], ['防御', ['blk']], ['回避', ['dge']], ['特殊', ['spe']], ['場', ['fld']]]);

const cardAssistantDeckViewOn = () => typeof cardGrowStyleOn === 'function' && cardGrowStyleOn();

// 見せるための形に直す(読むだけ)。who … 助手の id、styleId … 'attack' | 'guard' | 'normal'。読めなければ null
//   ace … 切り札(技のうちガッツがいちばん重いもの。同じならダメージの大きいもの)
//   groups … [[見出し, [カード…]], …](同じ番号は1つにまとめ、count に枚数)
//   at … 組み直した時刻(ルールの口が返せば。無ければ null)
const cardAssistantDeckSummary = (who, styleId) => {
  try {
    if (typeof cardAssistantDeckPreview !== 'function' || typeof CARD_BATTLE_DATA === 'undefined') return null;
    const sid = CARD_DECK_STYLE_LABEL[styleId] ? styleId : 'normal';
    const d = cardAssistantDeckPreview(who, sid, 'normal');
    if (!d || !Array.isArray(d.monsters) || !Array.isArray(d.cards)) return null;
    const db = CARD_BATTLE_DATA;
    const count = {};
    d.cards.forEach((no) => { count[no] = (count[no] || 0) + 1; });
    const uniq = [...new Set(d.cards)].map((no) => cardOf(db, no)).filter(Boolean);
    const byGuts = (a, b) => ((b.guts || 0) - (a.guts || 0)) || ((b.damage || 0) - (a.damage || 0)) || (a.no < b.no ? -1 : 1);
    const ace = uniq.filter((c) => c.kind === 'pow' || c.kind === 'int').sort(byGuts)[0] || null;
    const groups = CARD_DECK_KIND_GROUPS.map(([label, kinds]) => [label, uniq.filter((c) => kinds.includes(c.kind)).sort(byGuts)]).filter((g) => g[1].length);
    const monsters = d.monsters.map((no) => cardMonsterOf(db, no)).filter(Boolean);
    const name = typeof d.name === 'string' && d.name ? d.name : null;
    const line = typeof d.line === 'string' && d.line ? d.line : null;
    const at = Number.isFinite(d.at) ? d.at : null;
    return { styleId: sid, monsters, count, ace, groups, total: d.cards.length, name, line, at };
  } catch (_) { return null; }
};
// 組み直した時刻(4:00 など)。無ければ空
const cardAssistantDeckAtText = (at) => {
  if (!Number.isFinite(at)) return '';
  const t = new Date(at);
  return Number.isNaN(t.getTime()) ? '' : `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
};

function CardAssistantDeckView({ who, styleId, land = false }) {
  const [detail, setDetail] = React.useState(null);
  if (!cardAssistantDeckViewOn()) return null;
  const s = cardAssistantDeckSummary(who, styleId);
  const a = typeof assistantById === 'function' ? assistantById(who) : null;
  if (!s) return <div className="mhm-card" data-card-assistant-deck-view="none"><p className="text-[11.5px] font-bold text-slate-300">デッキを読めませんでした</p></div>;
  const db = CARD_BATTLE_DATA;
  const label = CARD_DECK_STYLE_LABEL[s.styleId];
  const tile = (c, big = false) => (
    <button key={c.no} type="button" data-card-assistant-deck-card={c.no} aria-label={`${c.name}を大きく見る`} onClick={() => { if (typeof Audio_ !== 'undefined') Audio_.fgSe.tap(); setDetail(c.no); }}
      className={`relative block ${big ? (land ? 'w-[70px]' : 'w-[96px]') : 'w-full'} active:scale-95`}>
      <img src={CARD_IMG(c.img)} alt={c.name} draggable={false} className="w-full rounded-[5px] shadow"/>
      {s.count[c.no] > 1 && <b className="absolute bottom-0.5 right-0.5 rounded bg-black/80 px-1 text-[11px] font-black text-amber-200">×{s.count[c.no]}</b>}
    </button>);
  const at = cardAssistantDeckAtText(s.at);
  const top = (
    <div className="mhm-card" data-card-assistant-deck-head={s.styleId}>
      <p className="text-[10px] font-black text-slate-400">MFバトルカード・{label}のデッキ</p>
      <p data-card-assistant-deck-name className="text-[18px] font-black leading-tight text-amber-200" style={JA_LABEL_STYLE}>{CARD_DECK_STYLE_ICON[s.styleId]} {s.name || `${label}のデッキ`}</p>
      {s.line && <p data-card-assistant-deck-line className="mt-1 rounded-lg bg-black/30 px-2 py-1 text-[11.5px] font-bold leading-snug text-slate-100" style={JA_WRAP_STYLE}>{a ? `${a.name}「${s.line}」` : s.line}</p>}
      <div className="mt-2 flex items-end gap-2">
        <div className={`grid flex-1 grid-cols-3 gap-1 ${land ? 'max-w-[190px]' : ''}`}>
          {s.monsters.map((m) => (
            <div key={m.no} className="min-w-0 text-center" data-card-assistant-deck-mon={m.no}>
              <img src={CARD_IMG(m.img)} alt={m.name} draggable={false} className="w-full rounded-[5px]"/>
              <p className="text-[10px] font-black leading-tight text-white" style={JA_LABEL_STYLE}>{m.name}</p>
            </div>))}
        </div>
        {s.ace && <div className={`${land ? 'w-[70px]' : 'w-[96px]'} shrink-0 text-center`} data-card-assistant-deck-ace={s.ace.no}><p className="text-[10px] font-black text-rose-200">切り札</p>{tile(s.ace, true)}</div>}
      </div>
    </div>);
  const list = (
    <div className="mhm-card" data-card-assistant-deck-list>
      {s.groups.map(([g, cs]) => (
        <div key={g} className="mt-1.5 first:mt-0" data-card-assistant-deck-group={g}>
          <p className="text-[11px] font-black text-slate-300">{g} <small className="text-slate-500">{cs.reduce((n, c) => n + s.count[c.no], 0)}枚</small></p>
          <div className={`mt-1 grid ${land ? 'grid-cols-10' : 'grid-cols-6'} gap-1`}>{cs.map((c) => tile(c))}</div>
        </div>))}
      <p className="mt-2 text-[10.5px] font-bold text-slate-400" style={JA_WRAP_STYLE}>{`🤖 ${at ? `AI が ${at} に組み直しました。` : ''}対戦では毎回少し入れかわります`}</p>
    </div>);
  return (
    <div data-card-assistant-deck-view={s.styleId} className={land ? 'grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start gap-2' : 'flex flex-col gap-2'}>
      {top}{list}
      {detail && typeof CardDetailModal === 'function' && <CardDetailModal db={db} no={detail} onClose={() => setDetail(null)}/>}
    </div>
  );
}

// 対戦で出したデッキの型の札。name … デッキの名前(無ければ型だけ)、styleId … 型。印が偽・型が分からなければ null
function CardFoeDeckChip({ name, styleId, kind = 'foe' }) {
  if (!cardAssistantDeckViewOn() || !CARD_DECK_STYLE_LABEL[styleId]) return null;
  const label = CARD_DECK_STYLE_LABEL[styleId];
  const deck = name ? `『${name}』(${label})` : `${label}のデッキ`;
  const text = kind === 'vs' ? `今日は${deck}でいくよ` : kind === 'result' ? `相手のデッキ: ${deck}` : `今日のデッキ: ${deck}`;
  return (
    <div data-card-foe-deck-chip={kind} data-card-foe-deck-style={styleId} className="mx-auto flex max-w-full items-center justify-center gap-1 rounded-full border border-amber-300/70 bg-slate-950/80 px-3 py-1 text-[12px] font-black leading-tight text-amber-100">
      <span aria-hidden="true">{CARD_DECK_STYLE_ICON[styleId]}</span><span className="min-w-0" style={JA_WRAP_STYLE}>{text}</span>
    </div>
  );
}

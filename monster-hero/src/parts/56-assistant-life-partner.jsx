// ===== 助手ライフの「町の人」(2026-11-11 社長の決め E・開発部カイホウの設計 docs/progress/assistant-unlock/DESIGN.md・止め絵④) =====
//   はじめての人は、最初に選んだ助手のほかは「町の人」から始まる(その助手のアシストカードをモンヒロバトルで40回使うと助手になる)。
//   町の人は、町・場所・家・掛け合いには出る(会った助手 metIds はそのまま)。押すと小窓(一言と「あと何回」)。話す・贈る・部屋は🔒
//   判定は開発部の口 assistantPartnerLockedNow(id)(会っているがまだ助手でないとき true)・assistantPartnerProgressNow(id)(18-assistant-partner.jsx)。
//   町に出す・出さないは今の metIds のまま(OkNow は公開前・お話の前でも false になるので使わない・カイホウ)。口が無いあいだは全員「関われる」扱い(今のまま)
//   今遊んでいる人は、開発部の判定で全員が助手(何も変わらない)。関われてしまうのを防ぐ止めなので旧UIでも同じに止める。何も保存しない

// 関われる助手か(町の人でなければ true。口が無い・壊れているときも true)
const assistantLifePartnerOk = (id) => {
  try { return !(typeof assistantPartnerLockedNow === 'function' && assistantPartnerLockedNow(id) === true); } catch (_) { return true; }
};
// 解放までの進み具合 { count, need, cardName, cardOwned } か null
const assistantLifePartnerProgress = (id) => {
  try {
    const p = typeof assistantPartnerProgressNow === 'function' ? assistantPartnerProgressNow(id) : null;
    if (!p || typeof p !== 'object') return null;
    const need = Number.isFinite(Number(p.need)) && Number(p.need) > 0 ? Math.floor(Number(p.need)) : 40;
    const count = Number.isFinite(Number(p.count)) ? Math.max(0, Math.min(need, Math.floor(Number(p.count)))) : 0;
    return { count, need, cardName: typeof p.cardName === 'string' ? p.cardName : '', cardOwned: p.cardOwned !== false };
  } catch (_) { return null; }
};
// 町の人の一言(助手ごと。届くまでは空 → 小窓は様子の1行だけ)
const ASSISTANT_LIFE_TOWN_PERSON_LINES = Object.freeze({});

// どこから押しても同じ小窓を出す(部屋・地図・家の札)
const ASSISTANT_LIFE_TOWN_PERSON = { id: null, subs: new Set() };
const assistantLifeShowTownPerson = (id) => { ASSISTANT_LIFE_TOWN_PERSON.id = id || null; for (const f of ASSISTANT_LIFE_TOWN_PERSON.subs) { try { f(ASSISTANT_LIFE_TOWN_PERSON.id); } catch (_) {} } };
// 関われない助手なら小窓を出して true を返す(呼んだ側はそこで止める)
const assistantLifeTownPersonGuard = (id) => { if (!id || assistantLifePartnerOk(id)) return false; assistantLifeShowTownPerson(id); return true; };

function AssistantLifeTownPersonCard({ life = null, land = false }) {
  const [id, setId] = React.useState(ASSISTANT_LIFE_TOWN_PERSON.id);
  React.useEffect(() => { const f = (v) => setId(v); ASSISTANT_LIFE_TOWN_PERSON.subs.add(f); return () => { ASSISTANT_LIFE_TOWN_PERSON.subs.delete(f); }; }, []);
  React.useEffect(() => () => { ASSISTANT_LIFE_TOWN_PERSON.id = null; }, []);
  const who = id && typeof assistantById === 'function' ? assistantById(id) : null;
  if (!who) return null;
  const close = () => assistantLifeShowTownPerson(null);
  const w = typeof assistantLifeWhereOf === 'function' ? assistantLifeWhereOf(life, id) : null;
  const d = w && typeof ASSISTANT_LIFE_DOINGS !== 'undefined' ? ASSISTANT_LIFE_DOINGS[w.doing] : null;
  const placeText = !w ? '' : w.place === 'home' ? `いまは 🏡 部屋で${d ? d.label : '過ごしています'}` : `いまは ${(typeof ASSISTANT_LIFE_PLACE_ICON !== 'undefined' && ASSISTANT_LIFE_PLACE_ICON[w.place]) || '🚶'} ${typeof assistantLifePlaceShow === 'function' ? assistantLifePlaceShow(w.place) : ''}にいます`;
  const line = ASSISTANT_LIFE_TOWN_PERSON_LINES[id] || '';
  const p = assistantLifePartnerProgress(id);
  const jw = (t) => (typeof jaWrap === 'function' ? jaWrap(t) : t);
  const ja = typeof JA_LABEL_STYLE !== 'undefined' ? JA_LABEL_STYLE : undefined;
  const lock = (k, label) => <button key={k} type="button" disabled data-assistant-life-town-lock={k} className="min-h-[44px] flex-1 rounded-xl border border-white/10 bg-slate-800/80 text-[12.5px] font-black text-slate-400">{label} 🔒</button>;
  return (
    <div className="absolute inset-0 z-[40] flex items-end justify-center bg-black/60" data-assistant-life-town-person={id} onClick={close}>
      <div className="w-full max-w-[480px] rounded-t-2xl border border-white/15 bg-slate-950 p-3" style={{ paddingBottom: land ? 12 : 'calc(12px + env(safe-area-inset-bottom))' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`${who.name}(町の人)`}>
        <div className="flex items-center gap-2.5">
          <span className="shrink-0" style={{ filter: 'grayscale(.55) brightness(.85)' }}>{typeof AssistantFace === 'function' && <AssistantFace who={who} size={52} accent="#64748b" expression="normal"/>}</span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-black" style={{ color: who.accent }}>{who.name}
              <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] font-black text-slate-100" data-assistant-life-town-tag>町の人・まだ助手ではありません</span></p>
            {placeText && <p className="text-[11px] font-bold text-slate-300">{placeText}</p>}
          </div>
          <button type="button" data-assistant-life-town-close onClick={close} aria-label="閉じる" className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-[18px] text-slate-200 active:bg-white/10">✕</button>
        </div>
        {line && <p data-assistant-life-town-line className="mt-2 rounded-xl bg-slate-800/90 px-3 py-2 text-[12.5px] font-bold leading-relaxed text-slate-100" style={ja}>{jw(`${who.name}「${line}」`)}</p>}
        {p && (
          <div className="mt-2" data-assistant-life-town-progress={`${p.count}/${p.need}`}>
            <p className="text-[11.5px] font-bold leading-snug text-slate-200" style={ja}>{jw(`${p.cardName ? `「${p.cardName}」` : `${who.name}のアシストカード`}をモンヒロバトルで ${p.need}回 使うと、助手として選べるようになります(いま ${p.count} / ${p.need}${p.cardOwned ? '' : '・カードはマーケットで手に入ります'})`)}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-700"><i className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-500" style={{ width: `${Math.round((p.count / p.need) * 100)}%` }}/></div>
          </div>)}
        <div className="mt-2.5 flex gap-1.5">{lock('talk', '💬 話す')}{lock('give', '🎁 贈る')}{lock('room', '🏠 部屋')}</div>
      </div>
    </div>);
}

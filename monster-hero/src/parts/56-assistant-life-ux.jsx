// ===== 助手ライフの作り直し(2026-11-11 社長・LIFE-UX-V3-PLAN.md)。新UI(mh_assistant_life_ui_v2 が入)のときだけ使う部品 =====
//   STEP1: 部屋は「その助手とできること」を1列に並べる(縦も横も同じ並び)。行ごとに、押すと何が上がるかを出す。
//          いちばん上に、あなたとの仲良し度の道のり(次の Lv まであといくつ・そこで何が開くか)。
//   何も保存しない。数字はどれも今ある決まり(仲良し度の段階・ごほうびの表・贈り物の好み)をそのまま読むだけ

// 仲良し度の道のり。points … その助手の仲良し度の点数(無ければ Lv だけ)
function AssistantLifeBondRoad({ id, points = null, level = null, land = false }) {
  const pts = Number.isFinite(points) ? points : null;
  const lv = pts != null && typeof assistantBondLevel === 'function' ? assistantBondLevel(pts) : level;
  if (lv == null) return null;
  const next = pts != null && typeof assistantBondNext === 'function' ? assistantBondNext(pts) : null;
  const from = pts != null && typeof assistantBondStage === 'function' ? (assistantBondStage(pts).need || 0) : 0;
  const pct = next ? Math.max(0, Math.min(100, Math.round(((pts - from) / Math.max(1, next.need - from)) * 100))) : 100;
  // 次の Lv で開くもの(プロフィールの「ごほうび一覧」と同じ表)
  let opens = [];
  if (next && typeof assistantBondRewardRows === 'function') {
    try {
      const row = (assistantBondRewardRows(id) || []).find(r => r.level === next.level);
      if (row) {
        if (row.title) opens.push(`「${row.title}」の話し方`);
        if (row.callStyle) opens.push('呼び方の相談');
        if (row.frames && row.frames.length) opens.push('飾り枠');
        opens = opens.concat((row.rewards || []).slice(0, 2));
      }
    } catch (_) { opens = []; }
  }
  return (
    <div className={`rounded-2xl border border-pink-300/70 bg-pink-950/60 px-3 py-2 ${land ? 'mt-1.5' : 'mt-2'}`} data-assistant-life-bond-road={lv}>
      <p className="flex items-baseline gap-2 text-[13px] font-black text-pink-50">💗 仲良し度 <b className="text-[16px]">Lv{lv}</b>
        {next && <span className="ml-auto text-[11.5px] font-bold text-pink-200" data-assistant-life-bond-road-remain={next.remain}>あと {next.remain} で Lv{next.level}</span>}
        {!next && <span className="ml-auto text-[11.5px] font-bold text-pink-200">いちばん上まで来ました</span>}
      </p>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"><i className="block h-full rounded-full bg-pink-400" style={{ width: `${pct}%` }}/></div>
      {next && opens.length > 0 && <p className="mt-1 text-[11.5px] font-bold leading-snug text-pink-100" style={{ wordBreak: 'auto-phrase' }} data-assistant-life-bond-road-opens>Lv{next.level} で: {opens.join('・')}</p>}
    </div>);
}

// 「その助手とできること」の1行。gain … 押すと上がるもの(右に出す)/why … 押せないわけ(押せないときだけ)
function AssistantLifeDoRow({ k, icon, label, sub = '', gain = '', on = null, disabled = false, why = '', tone = '' }) {
  const off = disabled || typeof on !== 'function';
  return (
    <button type="button" data-assistant-life-room-act={k} data-assistant-life-room-do={k} disabled={off} onClick={off ? undefined : on}
      className={`mt-1.5 flex w-full min-h-[48px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-left active:scale-[.98] ${off ? 'border-white/10 bg-white/5 opacity-55' : `border-white/20 bg-white/10 ${tone}`}`}>
      <span className="w-7 shrink-0 text-center text-[22px] leading-none" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <b className="block text-[14px] leading-tight text-white">{label}</b>
        {(off && why ? why : sub) && <small className="block text-[11.5px] font-bold leading-snug text-slate-300" style={{ wordBreak: 'auto-phrase' }}>{off && why ? why : sub}</small>}
      </span>
      {gain && !off && <span className="shrink-0 text-right text-[11.5px] font-black leading-tight text-emerald-300" data-assistant-life-room-do-gain>{gain}</span>}
    </button>);
}

// ===== STEP3: タブは4つ(🏡 家・🗺 町・🤝 きずな・🏘 フレンド)。道具は「🎁 贈る」の中、引き合わせるは「きずな」へ =====
// 新UIを既定にするか。保存(mh_assistant_life_ui_v2)が true/false ならそれに従い、無い人だけこの値になる(保存は消さない・書き換えない)
const ASSISTANT_LIFE_UI_V2_DEFAULT = false;
function assistantLifeUiV2Of(saved) { return saved === true ? true : saved === false ? false : ASSISTANT_LIFE_UI_V2_DEFAULT; }
// 新UIのタブ(下の列と、町の上の帯で同じ並び)
function assistantLifeUiV2Tabs() {
  return [['house', '🏡', '家'], ['where', '🗺', '町'], ['friends', '🤝', 'きずな'], ...(typeof alfEnabled === 'function' && alfEnabled() ? [['visit', '🏘', 'フレンド']] : [])];
}

// 引き合わせる(「きずな」の上)。2人を選ぶと、次の時間に一緒に過ごしやすくなる。決まりは今までと同じ(assistantLifeNudge('introduce'))
function AssistantLifeIntroduceCard({ ids, life }) {
  const [pick, setPick] = React.useState([]);
  const [done, setDone] = React.useState('');
  const list = (ids || []).filter(Boolean);
  if (list.length < 2) return null;
  const slot = assistantLifeSlotAt();
  const introNext = ((life && life.nudges && life.nudges.introduce) || []).find(n => n.abs === slot.abs + 1) || null;
  const nameOf = assistantLifeName;
  const go = async () => {
    if (pick.length !== 2) return;
    let ok = false; try { ok = await assistantLifeNudge('introduce', pick); } catch (_) { ok = false; }
    if (ok) { setDone(`${nameOf(pick[0])}と${nameOf(pick[1])}が、次の時間に一緒に過ごしやすくなりました`); setPick([]); }
  };
  return (
    <div data-assistant-life-introduce className="mb-2 rounded-2xl border border-sky-300/50 bg-slate-950/90 p-2.5">
      <p className="flex items-baseline gap-2 text-[14px] font-black text-sky-100">🤝 引き合わせる<span className="ml-auto text-[11px] font-bold text-emerald-300">無料</span></p>
      <p className="mb-1.5 text-[11.5px] font-bold leading-snug text-slate-200" style={{ wordBreak: 'auto-phrase' }}>2人を選ぶと、次の時間に一緒に過ごしやすくなります。言い合いのあとなら、仲直りのきっかけに。</p>
      <div className="flex flex-wrap gap-1.5">
        {list.map(id => { const on = pick.includes(id); return (
          <button key={id} type="button" data-assistant-life-pick={id} aria-pressed={on} onClick={() => { setDone(''); setPick(p => on ? p.filter(x => x !== id) : [...p, id].slice(-2)); }}
            className={`min-h-[44px] rounded-full border px-3 text-[12.5px] font-black active:scale-95 ${on ? 'border-sky-300 bg-sky-500/40 text-white' : 'border-white/25 bg-slate-800 text-slate-100'}`}>{nameOf(id)}</button>); })}
      </div>
      <button type="button" data-assistant-life-introduce-go disabled={pick.length !== 2 || !!introNext} onClick={go}
        className="mt-2 min-h-[44px] w-full rounded-xl border border-sky-300/60 bg-sky-500/25 px-2 text-[12.5px] font-black text-sky-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">
        {introNext ? `次の時間は ${String(introNext.pair).split('-').map(nameOf).join('と')} を引き合わせます` : pick.length === 2 ? `${nameOf(pick[0])}と${nameOf(pick[1])}に、次の時間に一緒に過ごしてもらう` : '2人を選んでください'}
      </button>
      {done && <p data-assistant-life-introduce-done className="mt-1.5 rounded-xl border border-sky-300/40 bg-slate-950/90 px-2 py-1.5 text-[11.5px] font-bold text-sky-100">{done}</p>}
    </div>);
}

// 「🎁 贈る」のシートの上: だれに贈るか。groups … いま一緒にいる組/soloIds … 1人に贈れる助手
function AssistantLifeGiveWho({ groups, soloIds, pairLeft = 0, soloLeft = 0, canPair = false, soloOn = false, onPair, onSolo }) {
  const nameOf = assistantLifeName;
  const gs = groups || [], ss = soloOn ? (soloIds || []) : [];
  return (
    <div data-assistant-life-give-who>
      <p className="mt-2 text-[13px] font-black text-amber-200">🤝 一緒にいる2人に贈る <span className="text-[11px] font-bold text-slate-200">今日あと {pairLeft}回</span></p>
      <p className="text-[11px] font-bold leading-snug text-slate-300">2人の友情Lv と、あなたとの仲良し度が上がります</p>
      {gs.length ? <div className="mt-1 flex flex-wrap gap-1.5">{gs.map(g => (
        <button key={g.ids.join('-')} type="button" data-assistant-life-give-who-pair={g.ids.join('-')} disabled={!canPair || pairLeft <= 0} onClick={() => onPair(g)}
          className="min-h-[44px] rounded-xl border border-amber-300/70 bg-amber-500/25 px-3 text-[12.5px] font-black text-amber-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">🎁 {g.ids.map(nameOf).join('・')} <span className="ml-1 whitespace-nowrap text-[11px] text-emerald-300">🤝💗 上がる</span></button>))}</div>
        : <p className="mt-1 rounded-xl bg-white/5 px-2 py-1.5 text-[11.5px] font-bold text-slate-300">いまは、一緒にいる組がありません(次の時間帯に)</p>}
      {soloOn && (<>
        <p className="mt-3 text-[13px] font-black text-pink-200">💗 1人に贈る <span className="text-[11px] font-bold text-slate-200">今日あと {soloLeft}回</span></p>
        <p className="text-[11px] font-bold leading-snug text-slate-300">その助手とあなたの仲良し度が上がります</p>
        <div className="mt-1 flex flex-wrap gap-1.5">{ss.map(id => (
          <button key={id} type="button" data-assistant-life-give-who-solo={id} disabled={soloLeft <= 0} onClick={() => onSolo(id)}
            className="min-h-[44px] rounded-xl border border-pink-300/70 bg-pink-500/25 px-3 text-[12.5px] font-black text-pink-50 active:scale-[.98] disabled:border-transparent disabled:bg-slate-800 disabled:text-slate-400">{nameOf(id)} <span className="ml-0.5 text-[11px] text-emerald-300">💗＋</span></button>))}</div>
      </>)}
    </div>);
}

// 「きずな」の組の行: 次の友情Lv で何が開くか(分かっているものだけ。無ければ空)
//   Lv3 … 関係図で線がつながる/特別なお話(Lv5・Lv10)/その Lv から流れる掛け合いがその2人にあるとき「新しい掛け合い」
function assistantLifePeerNextOpens(a, b, nextLv) {
  const out = [];
  try {
    const key = [a, b].sort().join('-');
    const all = [...(typeof assistantPeerTalkList === 'function' ? assistantPeerTalkList() : []), ...(typeof assistantPeerExtraTalks === 'function' ? assistantPeerExtraTalks() : [])]
      .filter(t => t && Array.isArray(t.pair) && t.pair.length === 2 && [...t.pair].sort().join('-') === key);
    if (nextLv === 3) out.push('関係図で線がつながる');
    if (all.some(t => t.special && (t.lv || 5) === nextLv)) out.push('✦ 特別なお話');
    if (all.some(t => !t.special && t.kind !== 'quarrel' && t.kind !== 'makeup' && (t.lv || 1) === nextLv)) out.push('新しい掛け合い');
  } catch (_) { return ''; }
  return out.join('・');
}

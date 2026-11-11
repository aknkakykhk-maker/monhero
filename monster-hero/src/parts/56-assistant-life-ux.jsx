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

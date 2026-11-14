// ===== 助手ライフ「やると何が得か」の見せ方(2026-11-11 社長が B+C と案1 を選んだ・docs/progress/assistant-life/BENEFIT-PLAN.md)。新UI(mh_assistant_life_ui_v2 が入)のときだけ使う =====
//   B  家のいちばん上の3行 …… ⏰ いま(STEP2 の得)/📅 今日(あと何回 → 何が上がる)/🌱 次のごほうび(いちばん近い1つ)
//   C  「きずな」の先頭の「ごほうびの道のり」 …… 💗 仲良し度・🐾 マスモン・🤝 友情Lv の次にもらえるもの(近い順)
//   案1 初めて開いた人への1枚 …… 1回だけ。最初に押す札(見守る)を光らせる。「見た」の印だけ新しいキーに保存する
//   新しい報酬は作らない。数字はどれも今ある決まり(仲良し度の段・友情Lv の段・マスモンを迎えるLv)を読むだけ

// 「見た」の印(boolean)。無い・壊れているときは「まだ見ていない」。既存のキーは触らない
const ASSISTANT_LIFE_GUIDE_KEY = 'mh_assistant_life_guide_seen_v1';

// 次の仲良し度 Lv で開くもの(プロフィールの「ごほうび一覧」と同じ表)
function assistantLifeBondOpens(id, nextLevel) {
  let opens = [];
  try {
    if (typeof assistantBondRewardRows !== 'function') return opens;
    const row = (assistantBondRewardRows(id) || []).find(r => r.level === nextLevel);
    if (row) {
      if (row.title) opens.push(`「${row.title}」の話し方`);
      if (row.callStyle) opens.push('呼び方の相談');
      if (row.frames && row.frames.length) opens.push('飾り枠');
      opens = opens.concat((row.rewards || []).slice(0, 2));
    }
  } catch (_) { opens = []; }
  return opens;
}

// 助手のマスモンを次に迎える仲良し度 Lv(Lv1 で1体・Lv3・5・7…と2つ上がるごとに1体。最大 ASSISTANT_MASMON_DRAW_MAX 体)。迎え終わっていれば null
function assistantLifeMasmonNextLv(lv) {
  try {
    if (typeof assistantMasmonWelcomeLv !== 'function' || !Number.isFinite(lv)) return null;
    const max = typeof ASSISTANT_MASMON_DRAW_MAX === 'number' ? ASSISTANT_MASMON_DRAW_MAX : 8;
    for (let slot = 1; slot <= max; slot++) { const w = assistantMasmonWelcomeLv(slot); if (w > lv) return w; }
  } catch (_) {}
  return null;
}

// ごほうびの一覧。bond … 💗 仲良し度(あと◯が小さい順)/masmon … 🐾 次のマスモン/peer … 🤝 友情Lv の組。どれも「あと◯」の小さい順
function assistantLifeRewardItems(ids, peerSt) {
  const bond = [], masmon = [];
  let maxed = 0;
  for (const id of ids || []) {
    const pts = typeof assistantLifeBondPointsOf === 'function' ? assistantLifeBondPointsOf(id) : null;
    if (!Number.isFinite(pts) || typeof assistantBondNext !== 'function' || typeof assistantBondLevel !== 'function') continue;
    const lv = assistantBondLevel(pts), next = assistantBondNext(pts);
    const mLv = assistantLifeMasmonNextLv(lv);
    if (next) {
      const opens = assistantLifeBondOpens(id, next.level);
      if (mLv === next.level) opens.push('新しいマスモン');
      bond.push({ k: `bond-${id}`, kind: 'bond', id, lv, nextLv: next.level, remain: next.remain, opens });
    } else maxed++;
    if (mLv != null && (!next || mLv !== next.level)) {
      const need = typeof assistantBondLevelsOf === 'function' ? ((assistantBondLevelsOf(id).find(s => s.level === mLv) || {}).need) : null;
      if (Number.isFinite(need) && need > pts) masmon.push({ k: `masmon-${id}`, kind: 'masmon', id, lv, nextLv: mLv, remain: need - pts, opens: ['新しいマスモン'] });
    }
  }
  const peer = [];
  const levels = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : [];
  if (peerSt && levels.length && typeof assistantPeerPoints === 'function' && typeof assistantPeerLevel === 'function') {
    const list = (ids || []).filter(Boolean);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const pts = assistantPeerPoints(peerSt, a, b), lv = assistantPeerLevel(peerSt, a, b);
      const nextStage = levels.find(s => s.level === lv + 1);
      if (!nextStage) continue;
      const opens = typeof assistantLifePeerNextOpens === 'function' ? assistantLifePeerNextOpens(a, b, nextStage.level) : '';
      peer.push({ k: `peer-${a}-${b}`, kind: 'peer', a, b, lv, nextLv: nextStage.level, remain: nextStage.min - pts, opens: opens ? opens.split('・') : [] });
    }
  }
  const byRemain = (x, y) => x.remain - y.remain;
  return { bond: bond.sort(byRemain), masmon: masmon.sort(byRemain), peer: peer.sort(byRemain), maxed };
}

// 「次のごほうび」でいちばん近い1つ(💗 仲良し度の次の Lv)
function assistantLifeNearestReward(ids) {
  const r = assistantLifeRewardItems(ids, null);
  return r.bond[0] || null;
}

// ---------- B: 家のいちばん上の3行 ----------
function AssistantLifeBenefitLine({ k, tag, children, sub = '', onClick = null, land = false, go = true }) {
  const inner = (<>
    <span className="w-[54px] shrink-0 text-center text-[11px] font-black leading-tight text-amber-200">{tag}</span>
    <span className="min-w-0 flex-1">
      <span className={`block ${land ? 'text-[11.5px]' : 'text-[12.5px]'} font-bold leading-snug text-white`} style={{ wordBreak: 'auto-phrase' }}>{children}</span>
      {sub && <span className="block text-[11px] font-bold leading-snug text-emerald-300" style={{ wordBreak: 'auto-phrase' }}>{sub}</span>}
    </span>
    {onClick && go && <span className="shrink-0 text-[11px] font-black text-amber-200" aria-hidden="true">▶</span>}
  </>);
  return onClick
    ? <button type="button" data-assistant-life-benefit-row={k} onClick={onClick} className="mt-1 flex min-h-[44px] w-full items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-1.5 py-1 text-left active:scale-[.98]">{inner}</button>
    : <div data-assistant-life-benefit-row={k} className="mt-1 flex min-h-[44px] w-full items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-1.5 py-1">{inner}</div>;
}

// fold … 開いたトップの家の場面の下に置くとき(2026-11-11 社長「今日・次のごほうびは▼でたたむ」)。⏰ いまの1行だけ出し、📅 今日・🌱 次のごほうびは ▼ で開く
function AssistantLifeBenefitBoard({ life, ids, nameOf, land = false, onGo, watchNow = 0, watchDone = false, giveLeft = 0, giveGroupLeft = null, giveSoloLeft = null, onWatch = null, onGive = null, onRoad = null, onGuide = null, fold = false, below = null }) {
  const [more, setMore] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const rows = typeof assistantLifePerkRows === 'function' ? assistantLifePerkRows(life, ids, nameOf) : [];
  const first = rows[0] || null;
  const rest = rows.length - 1;
  const near = assistantLifeNearestReward(ids);
  const slotTo = (() => { try { const s = assistantLifeSlotAt(); return s && Number.isFinite(s.to) ? s.to % 24 : null; } catch (_) { return null; } })();
  const todayClick = watchNow > 0 && onWatch ? onWatch : giveLeft > 0 && onGive ? onGive : null;
  const todayParts = [
    watchNow > 0 ? `👀 見守る 今${watchNow}組` : watchDone ? '👀 見守る ✓ 済み(次の時間帯に)' : '👀 見守る いまは無し',
    giveLeft > 0 ? (Number.isFinite(giveGroupLeft) && Number.isFinite(giveSoloLeft) ? `🎁 贈る 2人に${giveGroupLeft}・1人に${giveSoloLeft}回` : `🎁 贈る 今日あと${giveLeft}回`) : '🎁 贈る ✓ 今日は済み',
  ];
  const shown = more ? rows : rows.slice(0, 1);
  return (
    <section className={`mx-3 ${land ? 'mb-1' : 'mb-2'} rounded-2xl border border-amber-300/60 bg-slate-950/85 p-1.5 text-white`} data-assistant-life-benefit>
      <p className="flex items-center gap-2 px-1 text-[13px] font-black text-amber-200">✨ 助手ライフの得
        {onGuide && <button type="button" data-assistant-life-guide-open onClick={onGuide} className="ml-auto min-h-[44px] rounded-lg px-2 text-[11.5px] font-black text-amber-100 active:scale-95" style={{ marginTop: -8, marginBottom: -8 }}>❓ 見かた</button>}
      </p>
      {/* ⏰ いま(STEP2: 助手がいま居る場所の得) */}
      {rows.length > 0
        ? <div data-assistant-life-now-perks={rows.length}>
            {shown.map((r, i) => (
              <button key={r.k} type="button" data-assistant-life-now-perk={r.k} data-assistant-life-benefit-row={i === 0 ? 'now' : 'now-more'} disabled={typeof r.go !== 'function'} onClick={() => { if (typeof r.go === 'function') onGo(r.go); }}
                className="mt-1 flex min-h-[44px] w-full items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-1.5 py-1 text-left active:scale-[.98] disabled:opacity-60">
                <span className="w-[54px] shrink-0 text-center text-[11px] font-black leading-tight text-amber-200">{i === 0 ? '⏰ いま' : ''}</span>
                <span className="w-5 shrink-0 text-center text-[17px] leading-none" aria-hidden="true">{cardIconNode(r.icon, 17)}</span>
                <span className={`min-w-0 flex-1 ${land ? 'text-[11.5px]' : 'text-[12.5px]'} font-bold leading-snug`} style={{ wordBreak: 'auto-phrase' }}>{r.text}</span>
                {typeof r.go === 'function' && <span className="shrink-0 text-[11px] font-black text-amber-200" aria-hidden="true">▶</span>}
              </button>))}
            {rest > 0 && !more && <button type="button" data-assistant-life-now-perks-more className="min-h-[44px] w-full text-right text-[11.5px] font-black text-amber-200" onClick={() => setMore(true)}>ほか {rest} 件 ▼</button>}
          </div>
        : <AssistantLifeBenefitLine k="now" tag="⏰ いま" land={land}>いまは特別な得はありません{slotTo != null ? `(助手が動く ${slotTo}時に変わります)` : ''}</AssistantLifeBenefitLine>}
      {fold && <button type="button" data-assistant-life-benefit-fold={open ? 'open' : 'closed'} aria-expanded={open} onClick={() => setOpen(v => !v)} className="min-h-[44px] w-full text-right text-[11.5px] font-black text-amber-200">📅 今日 ・ 🌱 次のごほうび {open ? '▲' : '▼'}</button>}
      {(!fold || open) && <>
      {/* 📅 今日(あと何回 → 何が上がる) */}
      <AssistantLifeBenefitLine k="today" tag="📅 今日" land={land} onClick={todayClick} sub="→ 🤝 友情Lv・💗 仲良し度が上がる">{todayParts.join(' ・ ')}</AssistantLifeBenefitLine>
      {/* 🌱 次のごほうび(いちばん近い1つ) */}
      {near
        ? <AssistantLifeBenefitLine k="next" tag="🌱 次の ごほうび" land={land} onClick={onRoad} sub={near.opens.length ? `→ ${near.opens.join('・')}` : ''}>{nameOf(near.id)}の 💗 仲良し度 Lv{near.nextLv} まで <b className="text-amber-200">あと {near.remain}</b></AssistantLifeBenefitLine>
        : <AssistantLifeBenefitLine k="next" tag="🌱 次の ごほうび" land={land} onClick={onRoad}>見守る・贈る・おしゃべりで 💗 仲良し度が上がると、ごほうびが届きます</AssistantLifeBenefitLine>}
      </>}
      {/* 帯の下に足す1行(ナカヨシ19の「📅 今日の予定表」など。たたんでも残す) */}
      {below}
    </section>);
}

// ---------- C: 「きずな」の先頭「ごほうびの道のり」 ----------
function AssistantLifeRewardRow({ it, nameOf, onOpen = null }) {
  const isPeer = it.kind === 'peer';
  const who = (id) => (typeof assistantById === 'function' ? assistantById(id) : null);
  const w = isPeer ? who(it.a) : who(it.id);
  const title = isPeer ? `${nameOf(it.a)} × ${nameOf(it.b)}` : nameOf(it.id);
  const what = it.kind === 'bond' ? `💗 仲良し度 Lv${it.lv} → Lv${it.nextLv}` : it.kind === 'masmon' ? `🐾 新しいマスモン(💗 Lv${it.nextLv}で迎える)` : `🤝 友情Lv ${it.lv} → ${it.nextLv}`;
  const body = (<>
    {w && typeof AssistantFace === 'function' && <span className="shrink-0"><AssistantFace who={w} size={34} accent={w.accent}/></span>}
    <span className="min-w-0 flex-1">
      <span className="flex items-baseline gap-2"><b className="min-w-0 truncate text-[13px] text-white">{title}</b><span className="ml-auto shrink-0 text-[12px] font-black text-amber-200">あと {it.remain}</span></span>
      <span className="block text-[11.5px] font-bold leading-snug text-pink-100" style={{ wordBreak: 'auto-phrase' }}>{what}</span>
      {it.opens.length > 0 && it.kind !== 'masmon' && <span className="block text-[11.5px] font-bold leading-snug text-emerald-300" style={{ wordBreak: 'auto-phrase' }}>→ {it.opens.join('・')}</span>}
    </span>
  </>);
  const cls = 'mt-1 flex min-h-[48px] w-full items-center gap-2 rounded-xl border border-white/15 bg-slate-900/80 px-2 py-1 text-left';
  return onOpen
    ? <button type="button" data-assistant-life-reward-item={it.k} onClick={() => onOpen(it.id)} className={`${cls} active:scale-[.98]`}>{body}</button>
    : <div data-assistant-life-reward-item={it.k} className={cls}>{body}</div>;
}

function AssistantLifeRewardRoad({ ids, peerSt, nameOf, onRoom = null }) {
  const [all, setAll] = React.useState(false);
  const r = assistantLifeRewardItems(ids, peerSt);
  const total = r.bond.length + r.masmon.length; // 友情Lvは下の「助手どうしの友情Lv」に1つにまとめた(2026-11-14 社長 r1114-091)
  if (!total) return null;
  const cut = (list, n) => (all ? list : list.slice(0, n));
  const hidden = (r.bond.length - Math.min(3, r.bond.length)) + (r.masmon.length - Math.min(2, r.masmon.length));
  const sec = (title, list, n, open) => list.length > 0 && (<div key={title}>
    <p className="mt-2 text-[12px] font-black text-slate-200">{title}</p>
    {cut(list, n).map(it => <AssistantLifeRewardRow key={it.k} it={it} nameOf={nameOf} onOpen={open}/>)}
  </div>);
  return (
    <section className="mb-2 rounded-2xl border border-pink-300/60 bg-slate-950/90 p-2.5" data-assistant-life-reward-road={total}>
      <p className="text-[14px] font-black text-pink-100">🤝 きずな <span className="text-[12px] text-pink-200/90">・ 🎁 ごほうびの道のり</span></p>{/* 見出しを下のタブ「きずな」とそろえる(2026-11-11 ミヤスサ点検 ⑦) */}
      <p className="text-[11.5px] font-bold leading-snug text-slate-200" style={{ wordBreak: 'auto-phrase' }}>💗 仲良し度=あなたと助手。見守る・贈る・おしゃべりで上がります。「あと」が小さい順です。助手どうしの友情Lvは、下にあります。</p>
      {sec('💗 仲良し度(あなたと助手)', r.bond, 3, onRoom)}
      {sec('🐾 次に迎えるマスモン', r.masmon, 2, onRoom)}
      {r.maxed > 0 && <p className="mt-1.5 text-[11.5px] font-bold text-slate-300">💗 {r.maxed}人は、仲良し度がいちばん上まで来ました</p>}
      {hidden > 0 && <button type="button" data-assistant-life-reward-more aria-expanded={all} onClick={() => setAll(v => !v)} className="mt-1.5 min-h-[44px] w-full rounded-xl border border-white/20 text-[12px] font-black text-slate-100 active:scale-[.98]">{all ? '近い所だけにする ▲' : `全部見る(あと ${hidden} 件)▼`}</button>}
    </section>);
}

// ---------- 案1: 初めて開いた人への1枚 ----------
function AssistantLifeFirstGuide({ land = false, canWatch = false, onClose, onWatch = null }) {
  const Item = ({ n, head, text }) => (
    <li className="flex items-start gap-2">
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-300 text-[12px] font-black text-slate-900" aria-hidden="true">{n}</span>
      <span className="min-w-0 flex-1 text-[12px] font-bold leading-snug text-slate-100" style={{ wordBreak: 'auto-phrase' }}><b className="text-white">{head}</b>{text}</span>
    </li>);
  return (
    <section className={`mx-3 ${land ? 'mb-1' : 'mb-2'} rounded-2xl border-2 border-amber-300 bg-slate-950/95 p-2.5 text-white`} data-assistant-life-guide>
      <p className="text-[14px] font-black text-amber-200">🏡 助手ライフは、助手と過ごすと得する場所です</p>
      <ol className="mt-1.5 space-y-1.5">
        <Item n="1" head="👀 見守る・🎁 贈る・💬 おしゃべり" text=" で、助手たちと過ごす"/>
        <Item n="2" head="💗 仲良くなるとごほうび" text=" が届く(ダイヤ・飾り枠・話し方・マスモン)"/>
        <Item n="3" head="🎮 ほかの遊びも得に" text={` なる(モンヒロビートは券なし・カードはごほうび${typeof CARD_LIFE_UP_LABEL !== 'undefined' ? CARD_LIFE_UP_LABEL : 'アップ'})`}/>
      </ol>
      <p className="mt-1.5 text-[11.5px] font-bold text-amber-100">まずは 光っている「👀 見守る」を押してみよう</p>
      <div className="mt-1.5 flex gap-1.5">
        {canWatch && onWatch && <button type="button" data-assistant-life-guide-watch onClick={onWatch} className="min-h-[44px] flex-1 rounded-xl border border-amber-200 bg-amber-400/90 px-2 text-[12.5px] font-black text-slate-900 active:scale-[.98]">👀 見守ってみる</button>}
        <button type="button" data-assistant-life-guide-close onClick={onClose} className="min-h-[44px] flex-1 rounded-xl border border-white/25 bg-slate-800 px-2 text-[12.5px] font-black text-slate-100 active:scale-[.98]">分かった</button>
      </div>
    </section>);
}

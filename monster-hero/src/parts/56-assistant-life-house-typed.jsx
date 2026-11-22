// ===== 助手ライフの作り直し 段7: 家を型に載せる(docs/progress/assistant-life/step7-plan.md・2026-11-21 社長 r1119-075 は全部 案A) =====
// 新UI(mh_assistant_life_ui_v2)の「家」のタブだけ。旧UI・町・友情・フレンド・紹介は今のまま(段8〜13)。
// 型は 56-assistant-life-ui.jsx(AluFrame ほか・docs/spec/ASSISTANT_LIFE_UI.md)。中身の行動(見る・話す・贈る・誘う)は家の部品(AssistantLifeHouse)の関数をそのまま使う。
// 並び: 💗 次のごほうび → 家の絵 → 👀 見る(主なボタン) → 今日の目標(升を押すとその行動・下に 7日のごほうびを畳む) → 今日あったこと(3件+もっと見る)→ 予定・みんなの今を1行ずつ畳む
// 何も保存しない(今日の目標を数えるのは家の部品の行動から assistantLifeGoalNote)。

// 家の絵の幅を、使ってよい高さから決める(AssistantLifeHouseArt の大きさの式: 縦の4×2 は 126+0.56×(幅−30)・横の4×2 は 130+0.37×(幅−30))
//   横の画面(land)は横の4×2、それ以外(縦・PC)は縦と同じ背の高い4×2(PC で横の札を広げると名前と文が重なる)。縦は高さを画面の半分まで使う(幅320で札が言葉の途中で折れない幅にする)
const assistantLifeTypedArtWidth = ({ wide, w, h }, landArt) => {
  const hh = wide ? h : Math.round(h * 0.5 / 0.42);
  const byH = landArt ? (hh - 130) / 0.37 + 30 : (hh - 126) / 0.56 + 30;
  return Math.max(200, Math.floor(Math.min(w, landArt ? 760 : 640, byH)));
};
// 見る組の呼び名(2人は「◯◯と◯◯」、3人より多いと「◯◯たち3人」)
const assistantLifeTypedGroupName = (g, nameOf) => {
  const list = (g && g.ids) || [];
  if (list.length <= 2) return list.map(nameOf).join('と');
  return `${nameOf(list[0])}たち${list.length}人`;
};

function AssistantLifeHouseTyped({ land = false, life, ids, metSet, look, rooms, diary, peerSt, nameOf, tabs, tab = 'house', onTab, onBack,
  unwatched = [], onWatch, tier = null, note = '', top = null, guide = null, dailyCard = null, planBand = null,
  onTalk, onGive, onPlay, onRoom, onBoard, onRelView, result = null, onResultClose }) {
  const [goal, setGoal] = React.useState(() => (typeof assistantLifeGoalView === 'function' ? assistantLifeGoalView() : null));
  const [openDaily, setOpenDaily] = React.useState(false);
  const [openPlan, setOpenPlan] = React.useState(false);
  const [openNow, setOpenNow] = React.useState(false);
  React.useEffect(() => {
    if (typeof ASSISTANT_LIFE_GOAL_STORE === 'undefined') return undefined;
    const S = ASSISTANT_LIFE_GOAL_STORE;
    const f = () => { try { setGoal(assistantLifeGoalView()); } catch (_) {} };
    S.subs.add(f); S.load().then(f).catch(() => {});
    return () => { S.subs.delete(f); };
  }, []);
  const near = typeof assistantLifeNearestReward === 'function' ? assistantLifeNearestReward(ids) : null;
  const head = near
    ? <AluNextReward rest={near.remain} text={`${nameOf(near.id)}の 💗 仲良し度 Lv${near.nextLv}${near.opens.length ? ` → ${near.opens.join('・')}` : ''}`} />
    : <AluNextReward rest={null} text="見る・話す・贈るで 💗 仲良し度が上がると、ごほうびが届きます" />;
  const scene = (box) => {
    const landArt = box.wide && land;
    const width = assistantLifeTypedArtWidth(box, landArt);
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: box.wide ? '100%' : undefined, padding: '6px 0' }} data-assistant-life-top-house>
        <AssistantLifeHouseArt width={width} land={landArt} look={look} rooms={rooms} metSet={metSet} onOpen={onRoom} diary={diary} pop={false} onBoard={onBoard} life={life} peerSt={peerSt} v2 grid4={!landArt} />
      </div>);
  };
  const g0 = unwatched[0];
  const kindGo = { watch: onWatch, talk: onTalk, give: onGive, play: onPlay };
  const items = ((diary && diary.items) || []).slice(-3).reverse();
  const total = ((diary && diary.items) || []).length;
  const face = (id) => (id && typeof AssistantFace === 'function' && typeof assistantById === 'function' && assistantById(id) ? <AssistantFace who={assistantById(id)} size={44} /> : '📝');
  // 結果の1枚(見る・贈る・話すの後。r1119-075 ⑤)。上がった数は場面の前に控えた点との差(読むだけ)
  let resultNode = null;
  if (result) {
    const now = typeof assistantLifeSceneSnap === 'function' ? assistantLifeSceneSnap(result.ids) : { peer: 0, me: null };
    const b = result.before || { peer: 0, me: null };
    const dPeer = Math.max(0, Math.round(now.peer - b.peer));
    const dMe = now.me != null && b.me != null ? Math.max(0, Math.round(now.me - b.me)) : 0;
    const gains = [...(dMe > 0 ? [{ icon: '💗', label: '仲良し度', v: dMe }] : []), ...(dPeer > 0 ? [{ icon: '🤝', label: '友情', v: dPeer }] : [])];
    const labels = typeof ASSISTANT_LIFE_GOAL_LABEL !== 'undefined' ? ASSISTANT_LIFE_GOAL_LABEL : {};
    const nextKind = ['watch', 'talk', 'give', 'play'].find(k => !(goal && goal.done && goal.done[k]) && (k !== 'watch' || unwatched.length));
    const next = nextKind
      ? { label: `次は ${labels[nextKind] || nextKind}`, onClick: () => { onResultClose(); kindGo[nextKind] && kindGo[nextKind](); } }
      : { label: '🏡 家に戻る', onClick: onResultClose };
    resultNode = (
      <div data-assistant-life-house-result>
        <AluResult title={result.title || '結果'} line={`${(result.ids || []).map(nameOf).join('・')}${gains.length ? '' : ' · 今日はもう上がりきっています'}`}
          gains={gains} next={next} onClose={onResultClose} />
      </div>);
  }
  return (
    <AluFrame title="家" onBack={onBack} tab={tab} onTab={onTab} tabs={tabs} head={head} scene={scene} overlay={resultNode} data-assistant-life-typed-house="1">
      {top}
      {note ? <div className="alu-card alu-t" data-assistant-life-note>{note}</div> : null}
      {guide}
      <AluGo onClick={() => { if (g0 && onWatch) onWatch(); }} disabled={!g0} data-assistant-life-today-act="watch">
        {g0 ? `👀 見る — ${assistantLifeTypedGroupName(g0, nameOf)}の話` : '👀 見る話は、次の時間に'}
      </AluGo>
      <AluGoalCard view={goal} onKind={(k) => { const f = kindGo[k]; if (f) f(); }}
        extra={tier ? `🎉 ${tier.label} 🤝 ×${tier.mult}` : null}
        below={dailyCard ? (
          <div style={{ marginTop: 8 }} data-assistant-life-typed-daily>
            <AluBtn onClick={() => setOpenDaily(v => !v)} aria-expanded={openDaily}>🧺 7日のごほうび {openDaily ? '▲' : '▼'}</AluBtn>
            {openDaily ? <div style={{ marginTop: 8 }}>{dailyCard}</div> : null}
          </div>) : null} />
      <div className="alu-card" data-assistant-life-typed-diary>
        <div className="alu-h">今日あったこと</div>
        {items.length ? items.map((x, i) => (
          <AluRow key={`${x.t}-${i}`} pic={face(x.ids && x.ids[0])} text={x.text} note={x.t}
            action={x.tid && onRelView ? <AluBtn onClick={() => onRelView(x.tid, x.how || null)}>読む</AluBtn> : null} />))
          : <div className="alu-n" style={{ marginTop: 4 }}>まだありません。見る・話す・贈るをすると、ここに残ります</div>}
        {total > items.length ? <div style={{ marginTop: 6 }}><AluBtn onClick={onBoard}>もっと見る(全部で{total}件)</AluBtn></div> : null}
      </div>
      {planBand ? (
        <div className="alu-card" data-assistant-life-typed-plan>
          <AluBtn onClick={() => setOpenPlan(v => !v)} aria-expanded={openPlan}>📅 予定 {openPlan ? '▲' : '▼'}</AluBtn>
          {openPlan ? <div style={{ marginTop: 8 }}>{planBand}</div> : null}
        </div>) : null}
      <div className="alu-card" data-assistant-life-v2-status>
        <AluBtn onClick={() => setOpenNow(v => !v)} aria-expanded={openNow}>🏡 みんなの今({ids.length}人) {openNow ? '▲' : '▼'}</AluBtn>
        {openNow ? ASSISTANT_LIFE_HOUSE_ORDER.filter(id => metSet.has(id)).map(id => {
          const w = assistantLifeWhereOf(life, id);
          const place = w ? assistantLifePlaceShow(w.place) : '家';
          const doing = w && typeof ASSISTANT_LIFE_DOINGS !== 'undefined' ? (ASSISTANT_LIFE_DOINGS[w.doing] || {}).label : '';
          return <AluRow key={id} pic={face(id)} text={nameOf(id)} note={`${place}${doing ? ` · ${doing}` : ''}`}
            action={<AluBtn onClick={() => onRoom(id)} data-assistant-life-v2-status-id={id}>部屋へ</AluBtn>} />;
        }) : null}
      </div>
    </AluFrame>);
}

// ===== 助手ライフの作り直し 段8: 部屋を型に載せる(docs/spec/ASSISTANT_LIFE.md §5・配置図 overhaul-design/layout-room.png) =====
// 新UIの部屋(AssistantLifeRoomSheet の uiV2 の枝)だけ。中身の行動は部屋のシートの関数をそのまま使う(何も保存しない)。
// 並び: 💗 仲良し度(あと◯で次の Lv・🌡 調子・いまどこで何を)→ 部屋の絵 → 💬 話す(主なボタン)→ 🎁 贈る・🎉 誘う → その場所ならではの得 → もっと見る(見守る・おしゃべり・マスモン・予定・家具・詳しく)
// 部屋の絵(AssistantLifeRoomScene)とベッド・布団・寝顔(AssistantLifeRoomBed)の作りは変えない(11/20 の形・社長)。題は上の帯に出すので、絵の中の題は出さない。
// 目印は前の部屋と同じ名前(data-assistant-life-room-act・-room-do・-room-more・-roomview-close)。検査がそのまま押せる。
//   window.__mhAssistantLifeUntypedRoom … 検査だけが立てる印(段8 の前の部屋の並びを確かめる)。前の並びは段13 の片づけで消す
const assistantLifeTypedRoomOn = () => typeof AluFrame === 'function' && !(typeof window !== 'undefined' && window.__mhAssistantLifeUntypedRoom);

// 部屋の行: 左に絵・中に1行と注・右に押すボタン1つ。押せないときは注に「なぜ」を出す
// gain … 押すと上がる物(ボタンの字に添える。「💗+」「🤝💗+」)
const AssistantLifeRoomTypedRow = ({ k, icon, label, sub = '', go = '開く', gain = '', on = null, disabled = false, why = '' }) => {
  const off = disabled || typeof on !== 'function';
  return (
    <AluRow pic={icon} text={label} note={off && why ? why : sub}
      action={<AluBtn onClick={off ? undefined : on} disabled={off} data-assistant-life-room-act={k} data-assistant-life-room-do={k}>{go}{gain && !off ? ` ${gain}` : ''}</AluBtn>} />);
};

function AssistantLifeRoomTyped({ id, who, land = false, tabs, tab = 'house', onTab, onBack, scene, lv = null, sleeping = false, statusLine = '',
  talk, give, play = [], hot = null, follow = null, rel = null, more = [], details = null, moreOpen = false, onMore, overlay = null,
  result = null, onResultClose, nextAfter = null }) {
  const [playOpen, setPlayOpen] = React.useState(false);
  // PC(2段組で背の高い画面)は場所に余裕があるので「もっと見る」を開いたまま出す(配置図・下の空きを残さない)。閉じれば閉じる。
  //   横のスマホ(高さ 600 未満)は開くと縦に3画面を超えるので畳む
  const [wideOpen, setWideOpen] = React.useState(() => typeof window !== 'undefined' && window.innerWidth >= ALU_WIDE_MIN && window.innerWidth > window.innerHeight * 1.15 && window.innerHeight >= 600);
  const open = moreOpen || wideOpen;
  const toggleMore = () => { if (open) { setWideOpen(false); if (moreOpen) onMore(); } else onMore(); };
  const pts = typeof assistantLifeBondPointsOf === 'function' ? assistantLifeBondPointsOf(id) : null;
  const next = Number.isFinite(pts) && typeof assistantBondNext === 'function' ? assistantBondNext(pts) : null;
  const hour = typeof timeOfDayJstParts === 'function' ? timeOfDayJstParts(Date.now()).h : new Date().getHours();
  const head = (
    <div className="alu-card" data-assistant-life-room-head data-assistant-life-bond-road={lv != null ? lv : undefined}>
      <div className="alu-t" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 8px' }}>
        {lv != null ? <span className="alu-nw">💗 仲良し度 <b>Lv{lv}</b></span> : null}
        {lv != null ? <span className="alu-n alu-nw" data-assistant-life-bond-road-remain={next ? next.remain : undefined}>{next ? `あと ${next.remain} で Lv${next.level}` : '一番上まで来ました'}</span> : null}
        <AluCond id={id} sleeping={sleeping} hour={hour} />
      </div>
      {statusLine ? <div className="alu-n" style={{ marginTop: 2 }} data-assistant-life-room-where>{statusLine}</div> : null}
    </div>);
  const playable = play.filter(p => !p.disabled && typeof p.on === 'function');
  let resultNode = null;
  if (result) {
    const now = typeof assistantLifeSceneSnap === 'function' ? assistantLifeSceneSnap(result.ids) : { peer: 0, me: null };
    const b = result.before || { peer: 0, me: null };
    const dPeer = Math.max(0, Math.round(now.peer - b.peer));
    const dMe = now.me != null && b.me != null ? Math.max(0, Math.round(now.me - b.me)) : 0;
    const gains = [...(dMe > 0 ? [{ icon: '💗', label: '仲良し度', v: dMe }] : []), ...(dPeer > 0 ? [{ icon: '🤝', label: '友情', v: dPeer }] : [])];
    const nx = nextAfter ? { label: nextAfter.label, onClick: () => { onResultClose(); nextAfter.on(); } } : { label: '🏡 部屋に戻る', onClick: onResultClose };
    resultNode = (
      <div data-assistant-life-room-result>
        <AluResult title={result.title || '結果'} line={`${(result.ids || []).map(x => (typeof assistantLifeName === 'function' ? assistantLifeName(x) : x)).join('・')}${gains.length ? '' : ' · 今日はもう上がりきっています'}`}
          gains={gains} next={nx} onClose={onResultClose} />
      </div>);
  }
  const playSheet = playOpen ? (
    <AluSheet title={`🎉 ${who.name}を誘う`} gain="💗 仲良し度 · ごほうび" onClose={() => setPlayOpen(false)}>
      {play.map(p => <AssistantLifeRoomTypedRow key={p.k} {...p} on={p.on ? () => { setPlayOpen(false); p.on(); } : null} />)}
    </AluSheet>) : null;
  const sceneFn = (box) => (
    <div style={{ position: 'relative', height: box.wide ? '100%' : Math.max(260, Math.round(box.h / 0.42 * 0.5)) }} data-assistant-life-roomview-typed-scene>{scene}</div>);
  return (
    <AluFrame title={`${who.name}の部屋`} onBack={onBack} backProps={{ 'data-assistant-life-close': undefined, 'data-assistant-life-roomview-close': '', 'data-assistant-life-room-close': '' }}
      tab={tab} onTab={onTab} tabs={tabs} head={head} scene={sceneFn} overlay={resultNode || playSheet || overlay} data-assistant-life-typed-room={id}>
      {rel}
      {follow}
      <AluGo onClick={talk.on} disabled={!!talk.disabled} data-assistant-life-room-act="invite" data-assistant-life-room-do="invite">{talk.label}{talk.disabled ? '' : ' · 💗+'}</AluGo>
      {talk.disabled && talk.why ? <div className="alu-n" style={{ marginTop: -4 }}>{talk.why}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }} data-assistant-life-room-acts>
        <AluBtn onClick={give.on} disabled={!!give.disabled} data-assistant-life-room-act={give.k} data-assistant-life-room-do={give.k} style={{ width: '100%' }}>🎁 贈る{give.disabled ? '' : ' 💗+'}</AluBtn>
        <AluBtn onClick={() => setPlayOpen(true)} disabled={!playable.length} data-assistant-life-room-act="play" data-assistant-life-room-do="play" style={{ width: '100%' }}>🎉 誘う{playable.length ? ' ごほうび' : ''}</AluBtn>
      </div>
      {give.disabled && give.why ? <div className="alu-n" style={{ marginTop: -4 }}>🎁 {give.why}</div> : null}
      {hot ? <div className="alu-card" data-assistant-life-room-hot>{hot}</div> : null}
      <div className="alu-card" data-assistant-life-room-do-list>
        <AluBtn onClick={toggleMore} aria-expanded={open} data-assistant-life-room-more style={{ width: '100%' }}>{open ? 'もっと見る ▲' : `もっと見る ▼ ${more.map(m => m.short).filter(Boolean).join('・')}`}</AluBtn>
        {open ? <div data-assistant-life-room-more-list>{more.map(m => <AssistantLifeRoomTypedRow key={m.k} {...m} />)}{details}</div> : null}
      </div>
    </AluFrame>);
}

// 部屋の「詳しく」の行(型の字の段だけ)。中身は前の部品(AssistantLifeGiftLikesRow・AssistantMasmonNoteRoomLink・AssistantLifeChekiRow)と同じ数え方
function AssistantLifeRoomTypedLikes({ id }) {
  const st = typeof useAssistantLifeGiftState === 'function' ? useAssistantLifeGiftState() : null;
  if (!st || typeof assistantLifeEnabled !== 'function' || !assistantLifeEnabled()) return null;
  const gifts = [...assistantLifeGiftKinds(), ...(assistantLifeSoloOn() ? assistantLifeSoloDefs() : [])].filter(g => g.key !== 'monplush').map(g => assistantLifeGiftOf(g.kind)).filter(Boolean);
  const known = gifts.filter(g => assistantLifeGiftKnown(id, g.key, st)).length;
  const told = ((st.likes && st.likes.told) || []).filter(x => x.who === id).slice(-1)[0] || null;
  const hint = told ? assistantLifeGiftHintLine(id, told.key) : null;
  const mark = { like: '💗', bad: '💧', unknown: '?' };
  return (
    <div data-assistant-life-gift-likes={id}>
      <AluRow pic="🎁" text="贈り物の好み" note={`${gifts.length}種類のうち ${known} 分かった`}
        action={hint ? <AluBtn onClick={() => assistantLifeGiftToldSeen(id)} data-assistant-life-gift-told={told.key}>閉じる</AluBtn> : null} />
      {hint ? <div className="alu-n" style={{ marginBottom: 4 }}>💡 {hint.t}</div> : null}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {gifts.map(g => { const s = assistantLifeGiftShownLike(id, g.key, st); return (
          <span key={g.key} className={`alu-chip${s === 'like' ? ' ok' : ''}`} data-assistant-life-gift-like={`${g.key}:${s}`} title={`${g.name} ${ASSISTANT_LIFE_GIFT_LABEL[s]}`}>{g.emoji}{mark[s] || ''}</span>); })}
      </div>
    </div>);
}
function AssistantLifeRoomTypedCheki({ id }) {
  const st = typeof useAssistantLifeGiftState === 'function' ? useAssistantLifeGiftState() : null;
  const days = (st && st.cheki && st.cheki[String(id)]) || [];
  if (!days.length) return null;
  return <div data-assistant-life-cheki={id}><AluRow pic="📸" text={`チェキ ${days.length}枚`} note={`一番新しい日 ${String(days[days.length - 1]).slice(5).replace('-', '/')}`} /></div>;
}

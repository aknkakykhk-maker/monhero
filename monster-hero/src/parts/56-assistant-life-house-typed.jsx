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
  unwatched = [], onWatch, tier = null, note = '', top = null, guideOn = false, onGuide = null, onGuideClose = null, dailyCard = null, planBand = null,
  onTalk, onGive, onPlay, onRoom, onBoard, onRelView, result = null, onResultClose }) {
  const [goal, setGoal] = React.useState(() => (typeof assistantLifeGoalView === 'function' ? assistantLifeGoalView() : null));
  const [openDaily, setOpenDaily] = React.useState(false);
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
        <AssistantLifeHouseArt width={width} land={landArt} look={look} rooms={rooms} metSet={metSet} onOpen={onRoom} diary={diary} pop={false} onBoard={onBoard} life={life} peerSt={peerSt} v2 grid4={!landArt} typed />
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
  // 見かた(初めての1回は自動で開く・あとは家のいちばん下の「❓ 見かた」から。段7の残り・2026-11-22)。黄色い札ではなく型の窓
  const guideNode = guideOn && !resultNode ? (
    <div data-assistant-life-guide data-assistant-life-typed-guide>
      <AluSheet title="❓ 助手ライフの見かた" gain="💗 仲良し度 · 🤝 友情" onClose={onGuideClose}>
        <div className="alu-t" style={{ marginBottom: 4 }}>助手と過ごすと得する場所です</div>
        <AluRow pic="👀" text="見る・話す・贈る・誘う" note="家で助手たちと過ごします。今日の目標は4つのうち3つで達成" />
        <AluRow pic="💗" text="仲良くなるとごほうび" note="ダイヤ・飾り枠・話し方・マスモンが届きます" />
        <AluRow pic="🎮" text="ほかの遊びも得になる" note={`モンヒロビートは券なし・カードはごほうび${typeof CARD_LIFE_UP_LABEL !== 'undefined' ? CARD_LIFE_UP_LABEL : 'アップ'}`} />
        {g0 && onWatch ? <div style={{ marginTop: 10 }}><AluGo onClick={() => { if (onGuideClose) onGuideClose(); onWatch(); }} data-assistant-life-guide-watch>👀 見てみる — {assistantLifeTypedGroupName(g0, nameOf)}の話</AluGo></div> : null}
      </AluSheet>
    </div>) : null;
  const goBtn = (
    <AluGo onClick={() => { if (g0 && onWatch) onWatch(); }} disabled={!g0} data-assistant-life-today-act="watch">
      {g0 ? `👀 見る — ${assistantLifeTypedGroupName(g0, nameOf)}の話` : '👀 見る話は、次の時間に'}
    </AluGo>);
  // 背の低い縦(320×568 など)は、切り欠き(上47px・下34px)で帯とタブが太り、家の絵の下の主なボタンが最初の画面に入らない。
  //   主なボタンを「次のごほうび」のすぐ下(家の絵の上)へ(家の絵を小さくすると部屋の札が切れる・2026-11-22)
  const low = typeof window !== 'undefined' && window.innerHeight < 640 && window.innerWidth <= window.innerHeight;
  return (
    <AluFrame title="家" onBack={onBack} tab={tab} onTab={onTab} tabs={tabs} head={low ? <>{head}{goBtn}</> : head} scene={scene} overlay={resultNode || guideNode} data-assistant-life-typed-house="1">
      {top}
      {note ? <div className="alu-card alu-t" data-assistant-life-note>{note}</div> : null}
      {low ? null : goBtn}
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
      {planBand}
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
      {onGuide ? (
        <div className="alu-card" data-assistant-life-typed-guide-row>
          <AluRow pic="❓" text="助手ライフの見かた" note="何をすると何が上がるか" action={<AluBtn onClick={onGuide} data-assistant-life-guide-open>開く</AluBtn>} />
        </div>) : null}
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
      {/* 「· 」で区切った塊の途中では折らない(「気分: ご機 / 嫌」と折れていた・2026-11-22 r1119-098) */}
      {statusLine ? <div className="alu-n" style={{ marginTop: 2 }} data-assistant-life-room-where>{String(statusLine).split(' · ').map((x, i) => <React.Fragment key={i}>{i ? <>{' · '}<wbr/></> : null}<span className="alu-nw">{x}</span></React.Fragment>)}</div> : null}
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
    <div style={{ position: 'relative', height: box.wide ? '100%' : Math.max(240, Math.round(box.h / 0.42 * 0.36)) }} data-assistant-life-roomview-typed-scene>{scene}</div>);
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

// ===== 助手ライフの作り直し 段10: 友情を型に載せる(docs/progress/assistant-life/step10-friendship/・2026-11-22 社長 r1119-099 は案A 型どおり) =====
// 新UI の「🤝 友情」のタブだけ。旧UI は今のまま(段13 で片づけ)。何も保存しない(見る・引き合わせるは家の部品と同じ関数)。
// 並び: 関係図(場面の絵・画面の3割。線は Lv3 から・線を押すとその2人の思い出アルバム)→ 主なボタン(いちばん友情Lv が上がりそうな2人がいる組を 👀 見る)
//   → もうすぐ Lv が上がるペア(4組・あと◯の棒・いっしょにいて見ていない組は「見る」、ほかは「会わせる」= 引き合わせる)
//   → 🤝 引き合わせる(窓)→ 💗 ごほうびの道のり(窓)→ 🗺 全部のペアと思い出アルバム(窓・前の関係図の部品)
// 「見る」は組ごとに1回(assistantLifeWatch は組の印で覚える)。組の中の2人だけを別に見ると同じ組を2回見られるので、主なボタンは2人がいる組を見る
const ASSISTANT_LIFE_FRIEND_LINE = (lv) => (lv >= 9 ? '#fde68a' : lv >= 7 ? '#fcd34d' : lv >= 5 ? '#f9a8d4' : lv >= 4 ? '#c4b5fd' : '#93c5fd');
// 友情Lv の次の段まで(読むだけ)。{ pts, lv, stage, next, nextLv, nextName, need, rate }
const assistantLifeFriendStep = (st, a, b) => {
  const pts = typeof assistantPeerPoints === 'function' ? assistantPeerPoints(st, a, b) : 0;
  const lv = typeof assistantPeerLevelOf === 'function' ? assistantPeerLevelOf(pts) : 1;
  const levels = typeof ASSISTANT_PEER_BOND_LEVELS !== 'undefined' ? ASSISTANT_PEER_BOND_LEVELS : [];
  const cur = levels.find(s => s.level === lv) || null;
  const nx = levels.find(s => s.level === lv + 1) || null;
  const stageName = (s) => (s ? (typeof assistantPeerStageName === 'function' ? assistantPeerStageName(s) : s.name) : '');
  const from = cur ? cur.min : 0;
  return { a, b, pk: assistantLifePairKey(a, b), pts, lv, stage: stageName(cur), nextLv: nx ? nx.level : null, nextName: stageName(nx), need: nx ? Math.max(1, nx.min - pts) : 0,
    rate: nx ? Math.max(0, Math.min(1, (pts - from) / Math.max(1, nx.min - from))) : 1 };
};
// 関係図(場面の絵): 8人を輪に置き、Lv3 からの線(色・太さ = Lv)。hot の2人は黄色の縁。線を押すと onPair([a, b])
function AssistantLifeFriendGraph({ ids, st, hot = null, onPair }) {
  const n = ids.length;
  const pos = Object.fromEntries(ids.map((id, i) => { const t = -Math.PI / 2 + (2 * Math.PI * i) / n; return [id, [50 + 38 * Math.cos(t), 50 + 37 * Math.sin(t)]]; }));
  const lines = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = ids[i], b = ids[j]; const lv = assistantPeerLevel(st, a, b);
    if (lv >= 3) lines.push({ a, b, lv, hot: !!(hot && hot.includes(a) && hot.includes(b)) });
  }
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 14, background: 'radial-gradient(circle at 50% 45%,#2b2552,#151130)', overflow: 'hidden' }}>
    {/* 輪が横に伸びて顔が離れすぎないよう、図は 横:縦 = 1.4:1 までに収める(PC・横の広い枠) */}
    <div data-assistant-life-friend-graph style={{ position: 'relative', height: '100%', maxHeight: 420, aspectRatio: '1.4 / 1', maxWidth: '100%' }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {lines.map(l => { const [x1, y1] = pos[l.a], [x2, y2] = pos[l.b]; return (
          <g key={`${l.a}-${l.b}`} data-assistant-life-friend-line={assistantLifePairKey(l.a, l.b)} style={{ cursor: 'pointer' }} onClick={() => onPair && onPair([l.a, l.b])}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth="22" vectorEffect="non-scaling-stroke" />
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ASSISTANT_LIFE_FRIEND_LINE(l.lv)} strokeWidth={l.hot ? 5 : Math.min(5, 1.5 + (l.lv - 3) * 0.6)} strokeLinecap="round" vectorEffect="non-scaling-stroke" strokeDasharray={l.hot ? '2 6' : undefined} opacity={l.hot ? 1 : 0.85} />
          </g>); })}
      </svg>
      {ids.map(id => { const on = !!(hot && hot.includes(id)); return (
        <div key={id} aria-hidden="true" style={{ position: 'absolute', left: `${pos[id][0]}%`, top: `${pos[id][1]}%`, transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${on ? '#fde047' : '#fff'}`, boxShadow: on ? '0 0 0 3px #fde04766' : 'none', background: '#312e5a' }}>
            {typeof AssistantFace === 'function' && assistantById(id) ? <AssistantFace who={assistantById(id)} size={30} /> : null}
          </div>
          <b className="alu-nw" style={{ fontSize: 11, color: '#fff', background: '#151130e6', borderRadius: 999, padding: '0 6px', marginTop: 1 }}>{assistantLifeName(id)}</b>
        </div>); })}
    </div>
    </div>);
}

function AssistantLifeFriendsTyped({ life, ids, metIds, peerSt, nameOf, tabs, tab = 'friends', onTab, onBack, unwatched = [], onWatch, onReplay = null,
  peerItems = null, onUseItem = null, onGivePair = null, onRoom = null, result = null, onResultClose }) {
  const [albumPair, setAlbumPair] = React.useState(null);
  const [sheet, setSheet] = React.useState(null); // 'intro' | 'road' | 'all'
  const [note, setNote] = React.useState('');
  const st = peerSt || { bond: {} };
  const list = (metIds || []).filter(id => ids.includes(id));
  // 見ていない組(家の「見る」と同じ)の中の2人と、ほかの組の2人
  const groupOf = {};
  for (const g of unwatched || []) { const m = (g.ids || []).filter(id => list.includes(id)); for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) groupOf[assistantLifePairKey(m[i], m[j])] = g; }
  const steps = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) steps.push(assistantLifeFriendStep(st, list[i], list[j]));
  const open = steps.filter(s => s.nextLv);
  const best = open.filter(s => groupOf[s.pk]).sort((x, y) => x.need - y.need)[0] || null;
  const soon = open.filter(s => !best || s.pk !== best.pk).sort((x, y) => x.need - y.need).slice(0, 4);
  const introNext = (() => { try { const slot = assistantLifeSlotAt(); return ((life && life.nudges && life.nudges.introduce) || []).find(x => x.abs === slot.abs + 1) || null; } catch (_) { return null; } })();
  const introduce = async (s) => {
    let ok = false; try { ok = await assistantLifeNudge('introduce', [s.a, s.b]); } catch (_) { ok = false; }
    setNote(ok ? `${nameOf(s.a)}と${nameOf(s.b)}が、次の時間に一緒に過ごしやすくなりました` : '次の時間に会わせる2人は、もう決まっています');
  };
  const duo = (s) => (
    <div style={{ display: 'flex' }} aria-hidden="true">
      {[s.a, s.b].map((id, k) => <div key={id} style={{ width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', border: '2px solid #fff', background: '#312e5a', marginLeft: k ? -10 : 0 }}>{typeof AssistantFace === 'function' && assistantById(id) ? <AssistantFace who={assistantById(id)} size={26} /> : null}</div>)}
    </div>);
  const bar = (s) => <div style={{ height: 6, borderRadius: 3, background: '#3b3566', overflow: 'hidden', marginTop: 3 }}><i style={{ display: 'block', height: '100%', width: `${Math.round(s.rate * 100)}%`, background: 'linear-gradient(90deg,#f9a8d4,#fb923c)' }} /></div>;
  const pairRow = (s) => {
    const g = groupOf[s.pk];
    return (
      <div key={s.pk} data-assistant-life-friends-pair={s.pk}>
        <AluRow pic={duo(s)} text={<span className="alu-nw" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nameOf(s.a)}と{nameOf(s.b)}</span>}
          note={<><span className="alu-nw" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>あと{s.need}で Lv{s.nextLv}「{s.nextName}」</span>{bar(s)}</>}
          action={g ? <AluBtn onClick={() => onWatch && onWatch(g)}>見る</AluBtn> : <AluBtn disabled={!!introNext} onClick={() => introduce(s)}>会わせる</AluBtn>} />
      </div>);
  };
  const goLabel = best
    ? <span style={{ display: 'block' }}><span className="alu-nw">👀 {assistantLifeTypedGroupName(groupOf[best.pk], nameOf)}を見る</span><span className="alu-t alu-nw" style={{ display: 'block', color: 'inherit' }}>{nameOf(best.a)}と{nameOf(best.b)} あと{best.need}で Lv{best.nextLv}</span></span>
    : <>いま見られる組はありません</>;
  let resultNode = null;
  if (result) {
    const now = typeof assistantLifeSceneSnap === 'function' ? assistantLifeSceneSnap(result.ids) : { peer: 0, me: null };
    const b = result.before || { peer: 0, me: null };
    const dPeer = Math.max(0, Math.round(now.peer - b.peer));
    const dMe = now.me != null && b.me != null ? Math.max(0, Math.round(now.me - b.me)) : 0;
    const gains = [...(dMe > 0 ? [{ icon: '💗', label: '仲良し度', v: dMe }] : []), ...(dPeer > 0 ? [{ icon: '🤝', label: '友情', v: dPeer }] : [])];
    resultNode = (
      <div data-assistant-life-friends-result>
        <AluResult title={result.title || '結果'} line={`${(result.ids || []).map(nameOf).join('・')}${gains.length ? '' : ' · 今日はもう上がりきっています'}`}
          gains={gains} next={{ label: '🤝 友情に戻る', onClick: onResultClose }} onClose={onResultClose} />
      </div>);
  }
  const sheetNode = sheet === 'intro' ? (
    <AluSheet title="🤝 引き合わせる" gain="🤝 友情(一緒に過ごしやすくなる)" onClose={() => setSheet(null)}>
      {typeof AssistantLifeIntroduceCard === 'function' ? <AssistantLifeIntroduceCard ids={list} life={life} /> : null}
    </AluSheet>)
    : sheet === 'road' ? (
      <AluSheet title="💗 ごほうびの道のり" gain="💗 仲良し度(あなたと助手)" onClose={() => setSheet(null)}>
        {typeof AssistantLifeRewardRoad === 'function' ? <AssistantLifeRewardRoad ids={list} peerSt={peerSt} nameOf={nameOf} onRoom={(id) => { setSheet(null); onRoom && onRoom(id); }} /> : null}
      </AluSheet>)
    : sheet === 'all' ? (
      <AluSheet title="🗺 全部のペアと思い出アルバム" gain="🤝 友情Lv" onClose={() => setSheet(null)}>
        {typeof AssistantPeerMap === 'function' ? <AssistantPeerMap metIds={metIds} onReplay={(t) => { setSheet(null); onReplay && onReplay(t); }} peerItems={peerItems} onUseItem={onUseItem} v2 onGivePair={onGivePair} /> : null}
      </AluSheet>)
    : null;
  return (
    <AluFrame title="友情" onBack={onBack} tab={tab} onTab={onTab} tabs={tabs} data-assistant-life-typed-friends="1"
      scene={<AssistantLifeFriendGraph ids={list} st={st} hot={best ? [best.a, best.b] : null} onPair={setAlbumPair} />}
      overlay={<>{resultNode || sheetNode}{albumPair && typeof AssistantPeerAlbum === 'function' ? <AssistantPeerAlbum pair={albumPair} onClose={() => setAlbumPair(null)} onReplay={(t) => { setAlbumPair(null); onReplay && onReplay(t); }} peerItems={peerItems} onUseItem={onUseItem} onGivePair={onGivePair} /> : null}</>}>
      <AluGo data-assistant-life-friends-go disabled={!best} onClick={() => best && onWatch && onWatch(groupOf[best.pk])}>{goLabel}</AluGo>
      {note ? <div className="alu-card alu-n" data-assistant-life-friends-note>{note}</div> : null}
      {soon.length ? (
        <div className="alu-card" data-assistant-life-friends-soon>
          <div className="alu-h">もうすぐ Lv が上がるペア</div>
          {soon.map(pairRow)}
          <div className="alu-n alu-nw" style={{ marginTop: 4 }}>線の色・太さ = 友情Lv · 線を押すと思い出</div>
        </div>) : null}
      <div className="alu-card">
        <AluRow pic="🤝" text="引き合わせる" note={<span className="alu-nw">次の時間を2人で過ごしやすく</span>} action={<AluBtn data-assistant-life-friends-intro onClick={() => setSheet('intro')}>選ぶ</AluBtn>} />
        <AluRow pic="💗" text="ごほうびの道のり" note={<span className="alu-nw">あなたと助手の 💗 のごほうび</span>} action={<AluBtn data-assistant-life-friends-road onClick={() => setSheet('road')}>開く</AluBtn>} />
        <AluRow pic="🗺" text={<span className="alu-nw">全部のペアと思い出</span>} note={<span className="alu-nw">28組の友情Lv・見返し</span>} action={<AluBtn data-assistant-life-friends-all onClick={() => setSheet('all')}>開く</AluBtn>} />
      </div>
    </AluFrame>);
}

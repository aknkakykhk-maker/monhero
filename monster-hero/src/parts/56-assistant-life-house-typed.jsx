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
  return (
    <AluFrame title="家" onBack={onBack} tab={tab} onTab={onTab} tabs={tabs} head={head} scene={scene} overlay={resultNode || guideNode} data-assistant-life-typed-house="1">
      {top}
      {note ? <div className="alu-card alu-t" data-assistant-life-note>{note}</div> : null}
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

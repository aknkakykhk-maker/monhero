const {
  useState
} = React;
const FACE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const AssistantFace = ({
  who,
  size
}) => React.createElement('img', {
  src: FACE,
  style: {
    width: size,
    height: size,
    borderRadius: 8,
    background: '#334155'
  }
});
const ASSISTANT_LIST = ASSISTANTS;
// ★画面は「公開フラグでふるいにかけた一覧」(eventReplayList)を通す。
//   定義していないと ReferenceError で描画ごと落ち、スキップのボタンも出ない
const eventReplayList = () => EVENT_REPLAYS;
// ★台本に出てくる話し手は、助手に加えて登場人物(ジャックなど)もいる(2026-10-04)。
//   定義していないと ReferenceError で描画ごと落ち、スキップのボタンも出ない
//   (JACK_ICON_IMG は assistants.js 側で定義するので、ここでは宣言しない。二重にすると SyntaxError で画面が出ない)
const STORY_GUESTS = typeof STORY_GUEST_SPEAKERS !== 'undefined' ? STORY_GUEST_SPEAKERS : [];
const assistantById = id => ASSISTANTS.find(x => x.id === id) || STORY_GUESTS.find(x => x.id === id) || ASSISTANTS[0];
const storyCastOf = script => [...ASSISTANTS, ...STORY_GUESTS].filter(who => script.some(l => l.who === who.id));
const normalizeAssistantBond = () => ({
  points: 0
});
const assistantBonds = {},
  assistantCallStyles = {};
const assistantSpeakText = t => t;
const assistantBondLevelOf = () => 1;
const breederName = 'ブリーダー';
// あつの解放で台本の行を選ぶ(2026-10-23・eventScriptForPlayer は assistants.js にある)。ここでは見たお話なし
const rhythmEventStorySeen = [];
const RHYTHM_EVENT_STORY_IDS = ["symphony_2026_09_17"];
window.__seen = [];
const markRhythmEventStorySeen = id => {
  window.__seen.push(id);
};
const markMomosukeIntroSeen = () => {};
// ★難易度 HELL のお話(2026-10-11 #2749)。スキップ・最後まで見たときに event.id と比べるので、定義していないと
//   ReferenceError でスキップが効かなくなる(会話が閉じない)。ここでは比べられれば足りる
const RHYTHM_HELL_STORY_ID = 'rhythm_hell_story';
const markRhythmHellStorySeen = () => {};
const markTacticsIntroSeen = () => {};
const ASSISTANT_CHAT_STORY_ID = 'assistant_chat_story';
const markAssistantChatStorySeen = () => {};
const TACTICS_TYPES_STORY_ID = 'tactics_types';
const markTacticsTypesStorySeen = () => {};
const setRhythmHellGuide = () => {};
const setShowDebugStoryList = () => {};
const setShowEventReplayList = () => {};
// ★MFバトルカードのはじまり(2026-10-24 #3452)。スキップ・最後まで見たときに event.id と比べて「見た」にするので、
//   定義していないと ReferenceError でスキップが効かなくなる(会話が閉じない)。ここでは比べられれば足りる
const CARD_BATTLE_INTRO_STORY_ID = 'card_battle_intro';
const markCardBattleIntroSeen = () => {};
// ★お話の文は言葉の区切りの部品(21-assistant.jsx の bubbleWrap)を通して描く(2026-10-24)。定義していないと ReferenceError で描画ごと落ちる。
//   ここでは押せる場所を見るので、文はそのまま返せば足りる
const bubbleWrap = t => t;
const bubbleWrapStyle = () => undefined;
function Screen() {
  const [eventReplay, setEventReplay] = useState({
    id: "symphony_2026_09_17",
    step: 0,
    live: true
  });
  window.__state = eventReplay;
  return /*#__PURE__*/React.createElement(React.Fragment, null, eventReplay != null && (() => {
    const list = eventReplay.debug ? eventReplayAllList() : eventReplayList();
    const event = list.find(ev => ev.id === eventReplay.id);
    // あつを解放しているかで行を選んでから再生する(atsu:'with'/'without'・2026-10-23)。曲の切り替え(eventLineBgm)も同じ台本を見る
    const script = event ? eventScriptForPlayer(event.script, rhythmEventStorySeen) : [];
    if (script.length === 0) return null;
    const step = Math.max(0, Math.min(eventReplay.step, script.length - 1));
    const line = script[step];
    const speaker = assistantById(line.who);
    const last = step === script.length - 1;
    // ゲスト(ジャック・ぱんぷきん)は、下の助手の列には入れない。初めて話す行(か stage で呼ばれる行)から、画面の上部の「ステージ」に出る
    //  (2026-10-04・ユーザー指示「はじめからジャックやぱんぷきんが会話画面にいるのは違和感。出すタイミングをちゃんと」)
    const isGuestWho = id => {
      const w = assistantById(id);
      return !!w && w.role === 'ゲスト';
    };
    // hideUntilFirstLine に書いた助手は、初めて話す行までは下の列にも出さない(登場の場面で顔を伏せる。2026-10-22 社長「あつの顔は『呼んだ？』で登場するまで伏せる」)
    const hiddenUntil = Array.isArray(event && event.hideUntilFirstLine) ? event.hideUntilFirstLine : [];
    const cast = storyCastOf(script).filter(who => who.role !== 'ゲスト').filter(who => !hiddenUntil.includes(who.id) || script.slice(0, step + 1).some(l => l && l.who === who.id));
    let stageIdx = -1;
    for (let i = step; i >= 0; i--) {
      const l = script[i];
      if (l.stage === 'none') {
        stageIdx = -1;
        break;
      }
      if (l.stage || isGuestWho(l.who)) {
        stageIdx = i;
        break;
      }
    }
    const stageLine = stageIdx >= 0 ? script[stageIdx] : null;
    const stageGuest = stageLine ? assistantById(stageLine.stage || stageLine.who) : null;
    const stageName = stageLine ? (stageLine.stage ? stageLine.stageName : stageLine.name) || stageGuest.name : '';
    const stageTier = ['男爵', '子爵', '伯爵', '公爵', '大王'].findIndex(t => stageName.includes(t)) + 1;
    const speakingGuest = isGuestWho(line.who);
    let bubbleIdx = -1;
    for (let i = step; i >= 0; i--) {
      if (isGuestWho(script[i].who)) {
        bubbleIdx = i;
        break;
      }
    }
    const bubbleLine = bubbleIdx >= 0 && bubbleIdx >= stageIdx && stageGuest ? script[bubbleIdx] : null;
    let assistIdx = -1;
    for (let i = step; i >= 0; i--) {
      if (!isGuestWho(script[i].who)) {
        assistIdx = i;
        break;
      }
    }
    // ジャックが話しているあいだ、下の箱には直前の助手の台詞を薄く残す(流れが分かる)。まだ助手が話していなければ案内を出す
    const bottomLine = speakingGuest ? assistIdx >= 0 ? script[assistIdx] : null : line;
    const bottomSpeaker = bottomLine ? assistantById(bottomLine.who) : speaker;
    const fx = line.fx || null;
    const fxColors = {
      transform: '255,237,180',
      rankup: ['251,146,60', '251,191,36', '192,132,252', '248,113,113', '250,204,21'][Math.max(0, stageTier - 1)],
      shrink: '186,230,253'
    };
    const speakText = (l, w) => {
      // ★呼び方は normalizeAssistantBond には入っていない(別の入れ物 assistantCallStyles)。話している助手ごとのぶんを引く
      const bond = normalizeAssistantBond(assistantBonds[w.id]);
      return assistantSpeakText(l.t, breederName, assistantBondLevelOf(bond.points), assistantCallStyles[w.id] || null, w.id);
    };
    // 台詞の「\n」は、そこで改行する(2026-10-25。チーム名を3つ並べる台詞で「すばやく攻める／チーム」と名前の途中で折れた)。行ごとに jaWrap を通す
    const bubbleLines = text => typeof text === 'string' && text.includes('\n') ? text.split('\n').map((x, i) => /*#__PURE__*/React.createElement(React.Fragment, {
      key: i
    }, i > 0 && /*#__PURE__*/React.createElement("br", null), bubbleWrap(x))) : bubbleWrap(text);
    // 回想でも最後まで見たら「見たことがある」として扱う。
    // ももすけ登場を本編より先にここで見た人は、この時点でももすけが解放され、
    // あとから本編で同じ会話が重ねて流れることもなくなる
    // holdMs を書いた行は、出てからその時間はタップしても進まない(2026-10-22 社長「Toward the Stars が流れ出して数秒止まる」。きゅうこの加入のお話)。
    //   行が出た時刻は、次へ進めたときに eventReplay.shownAt へ入れる(最初の行には無いので止まらない)
    const next = () => {
      const holdMs = Number(line.holdMs);
      if (Number.isFinite(holdMs) && holdMs > 0 && Date.now() - (Number(eventReplay.shownAt) || 0) < holdMs) return;
      if (!last) {
        setEventReplay(r => r && {
          ...r,
          step: r.step + 1,
          shownAt: Date.now()
        });
        return;
      }
      if (event && event.id === 'momosuke_intro' && !eventReplay.debug) markMomosukeIntroSeen();
      if (event && event.id === 'tactics_intro' && !eventReplay.debug) markTacticsIntroSeen();
      // イベントの会話も、最後まで見たら「見た」にする(次の起動で重ねて流さない)
      if (event && RHYTHM_EVENT_STORY_IDS.includes(event.id) && !eventReplay.debug) void markRhythmEventStorySeen(event.id);
      // 順番は 第1部 → 第1.5部(ふくれあがる影) → レイドの遊び方。本編で見終えたら、次を続けて流す
      // (公開前・見たあと・回想からのときは流さない)
      if (event && event.id === RAID_JACK_HOWTO_AFTER_STORY_ID && eventReplay.live && !eventReplay.debug && RELEASE_FLAGS.raidJack === true && !normalizeRhythmEventRewardClaims(rhythmEventStorySeenRef.current).includes(RAID_JACK_STORY_START_ID)) setRhythmEventStoryPending(prev => prev || RAID_JACK_STORY_START_ID);
      if (event && event.id === RAID_JACK_STORY_START_ID && eventReplay.live && !eventReplay.debug && RELEASE_FLAGS.raidJack === true && !normalizeRhythmEventRewardClaims(rhythmEventStorySeenRef.current).includes(RAID_JACK_HOWTO_STORY_ID)) setRhythmEventStoryPending(prev => prev || RAID_JACK_HOWTO_STORY_ID);
      // 難易度 HELL のお話は、見終えたら続けて説明(RhythmHellGuide)を出す。一覧へ戻るのは説明を閉じたあと
      // 助手とおしゃべりのお話は、本編で流したときだけ「見た」にする(回想・デバッグでは立てない)
      if (event && event.id === ASSISTANT_CHAT_STORY_ID && eventReplay.live && !eventReplay.debug) markAssistantChatStorySeen();
      if (event && event.id === TACTICS_TYPES_STORY_ID && eventReplay.live && !eventReplay.debug) markTacticsTypesStorySeen();
      // MFバトルカードのはじまりは、本編で見終えたらそのままスターター選び(CARD_TOP。持っていない人にはスターター選びが出る)へ
      if (event && event.id === CARD_BATTLE_INTRO_STORY_ID && eventReplay.live && !eventReplay.debug) {
        markCardBattleIntroSeen();
        setEventReplay(null);
        setGameState('CARD_TOP');
        return;
      }
      if (event && event.id === RHYTHM_HELL_STORY_ID) {
        if (!eventReplay.debug) markRhythmHellStorySeen();
        setRhythmHellGuide({
          page: 0,
          debugList: !!eventReplay.debugList,
          fromList: !!eventReplay.fromList
        });
        setEventReplay(null);
        return;
      }
      if (eventReplay.debugList) setShowDebugStoryList(true);
      if (eventReplay.fromList) setShowEventReplayList(true);
      setEventReplay(null);
    };
    /* 途中でやめる。回想(あとから見返すぶん)は「見たことがある」を立てない
       (2026-09-05・ユーザー要望「イベント回想中でスキップで飛ばせるようにしてほしい」)。
       回想は何度でも開けるので、飛ばしても失うものはない。
       ★本編で流しているとき(live)だけは、飛ばしても「見た」にする。
         そうしないと、起動のたびに同じ会話がまた出てしまう。
         飛ばしたぶんはプロフィールの「イベント回想」からいつでも見られる */
    const skip = () => {
      if (eventReplay.live && !eventReplay.debug && event && RHYTHM_EVENT_STORY_IDS.includes(event.id)) void markRhythmEventStorySeen(event.id);
      if (eventReplay.live && !eventReplay.debug && event && event.id === 'tactics_intro') markTacticsIntroSeen();
      if (eventReplay.live && !eventReplay.debug && event && event.id === ASSISTANT_CHAT_STORY_ID) markAssistantChatStorySeen();
      if (eventReplay.live && !eventReplay.debug && event && event.id === TACTICS_TYPES_STORY_ID) markTacticsTypesStorySeen();
      // MFバトルカードのはじまりは、飛ばしたら HOME のまま(入口から入れる)
      if (eventReplay.live && !eventReplay.debug && event && event.id === CARD_BATTLE_INTRO_STORY_ID) markCardBattleIntroSeen();
      // HELL のお話は飛ばしても説明は出す(遊び方は飛ばさずに知ってほしい)。見たにするのは本編で流したときだけ
      if (event && event.id === RHYTHM_HELL_STORY_ID) {
        if (eventReplay.live && !eventReplay.debug) markRhythmHellStorySeen();
        setRhythmHellGuide({
          page: 0,
          debugList: !!eventReplay.debugList,
          fromList: !!eventReplay.fromList
        });
        setEventReplay(null);
        return;
      }
      if (eventReplay.debugList) setShowDebugStoryList(true);
      if (eventReplay.fromList) setShowEventReplayList(true);
      setEventReplay(null);
    };
    return /*#__PURE__*/React.createElement("div", {
      className: "fixed inset-0 flex items-end justify-center",
      style: {
        position: 'fixed',
        inset: 0,
        zIndex: 77000,
        backgroundColor: 'rgba(2,6,23,.95)'
      },
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `イベント回想: ${event?.title || ''}`
    }, /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: next,
      "aria-label": "\u6B21\u3078",
      className: "absolute inset-0 w-full h-full",
      style: {
        background: 'transparent'
      }
    }), stageGuest && /*#__PURE__*/React.createElement("div", {
      "data-story-stage": true,
      className: "pointer-events-none",
      "data-story-shake": fx === 'transform' || fx === 'rankup' ? step % 2 : undefined,
      style: {
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 13vh)',
        left: 0,
        right: 0,
        zIndex: 3
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mx-auto flex w-full max-w-md items-start gap-2 px-3"
    }, /*#__PURE__*/React.createElement("div", {
      key: `${stageGuest.id}:${stageName}`,
      "data-story-guest": stageGuest.id,
      "data-story-fx": fx || undefined,
      className: "shrink-0 text-center",
      style: {
        animation: fx === 'shrink' ? 'storyShrink .9s ease-out both' : fx === 'transform' || fx === 'rankup' ? 'storyGrow .9s ease-out both' : 'storyStageIn .45s ease-out both'
      }
    }, /*#__PURE__*/React.createElement("span", {
      "data-jack-aura": stageTier || undefined,
      style: {
        position: 'relative',
        display: 'block',
        width: 96,
        height: 96,
        filter: stageTier > 0 && typeof raidJackAuraGlowFilter === 'function' ? raidJackAuraGlowFilter(stageTier, .4) : undefined
      }
    }, stageTier > 0 && typeof JackAuraLayer === 'function' && /*#__PURE__*/React.createElement(JackAuraLayer, {
      tier: stageTier,
      limit: 8
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        zIndex: 1,
        display: 'block',
        opacity: speakingGuest ? 1 : .55,
        filter: speakingGuest ? `drop-shadow(0 0 10px ${stageGuest.accent})` : 'brightness(.7)',
        transition: 'opacity .2s, filter .2s'
      }
    }, /*#__PURE__*/React.createElement(AssistantFace, {
      who: stageGuest,
      size: 92,
      accent: stageGuest.accent,
      expression: speakingGuest ? line.e : 'normal'
    }))), /*#__PURE__*/React.createElement("span", {
      className: "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-black",
      style: {
        color: speakingGuest ? '#0f172a' : stageGuest.accent,
        background: speakingGuest ? stageGuest.accent : 'rgba(15,23,42,.8)',
        transition: 'background .2s, color .2s'
      }
    }, stageName)), bubbleLine && /*#__PURE__*/React.createElement("div", {
      key: `b${bubbleIdx}`,
      "data-story-guest-bubble": true,
      "data-story-pop": speakingGuest ? '1' : undefined,
      className: "relative min-w-0 flex-1 rounded-2xl border-2 bg-slate-900/95 px-3 py-2",
      style: {
        borderColor: stageGuest.accent,
        opacity: speakingGuest ? 1 : .4,
        boxShadow: speakingGuest ? `0 0 0 2px ${stageGuest.accent}55, 0 0 20px ${stageGuest.accent}88` : 'none',
        marginTop: 8,
        animation: speakingGuest ? 'storyPop .3s ease-out both' : undefined
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: 'absolute',
        left: -9,
        top: 22,
        width: 0,
        height: 0,
        borderTop: '8px solid transparent',
        borderBottom: '8px solid transparent',
        borderRight: `9px solid ${stageGuest.accent}`
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "inline-block rounded-full px-2 py-0.5 text-[10px] font-black",
      style: {
        color: '#0f172a',
        background: stageGuest.accent
      }
    }, bubbleLine.name || stageGuest.name), /*#__PURE__*/React.createElement("span", {
      className: "mt-1 block text-[14px] font-bold leading-relaxed text-white",
      style: bubbleWrapStyle()
    }, bubbleLines(speakText(bubbleLine, stageGuest)))))), fx && /*#__PURE__*/React.createElement("div", {
      key: `fx${step}`,
      "aria-hidden": "true",
      className: "pointer-events-none",
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      "data-story-fx-flash": fx,
      style: {
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(circle at 50% 22%, rgba(${fxColors[fx] || '255,255,255'},.95), rgba(${fxColors[fx] || '255,255,255'},.35) 45%, rgba(0,0,0,0) 75%)`,
        animation: 'storyFlash 1s ease-out both'
      }
    }), line.fxText && /*#__PURE__*/React.createElement("div", {
      "data-story-banner": true,
      className: "px-4 text-center text-[17px] font-black",
      style: {
        position: 'absolute',
        top: '42%',
        left: '50%',
        width: '100%',
        maxWidth: '28rem',
        color: '#fff',
        textShadow: `0 0 14px rgba(${fxColors[fx] || '255,255,255'},1), 0 2px 0 rgba(0,0,0,.6)`,
        animation: 'storyBanner 2.2s ease-out both'
      }
    }, line.fxText)), /*#__PURE__*/React.createElement("div", {
      onClick: next,
      "data-story-shake": fx === 'transform' || fx === 'rankup' ? step % 2 : undefined,
      className: "relative w-full max-w-md max-h-[calc(var(--mh-vh)-env(safe-area-inset-top))] overflow-y-auto mh-scroll rounded-t-3xl border-t-2 border-x-2 border-fuchsia-400 bg-slate-950 p-4",
      style: {
        paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))',
        pointerEvents: 'auto',
        zIndex: 1
      }
    }, /*#__PURE__*/React.createElement("p", {
      className: "mb-2 text-center text-[10px] font-black tracking-widest text-fuchsia-300"
    }, eventReplay.live ? '' : '回想・', event?.title || ''), (() => {
      const many = cast.length > 4;
      const big = many ? 60 : 84,
        small = many ? 48 : 64;
      return /*#__PURE__*/React.createElement("div", {
        "data-story-cast": cast.length,
        className: `mb-3 flex items-end justify-center ${many ? 'flex-wrap gap-x-1 gap-y-1.5' : 'gap-3'}`
      }, cast.map(who => {
        const talking = !speakingGuest && who.id === line.who;
        return /*#__PURE__*/React.createElement("div", {
          key: who.id,
          "data-story-cast-member": who.id,
          className: `flex min-w-0 flex-col items-center justify-end gap-1 ${talking ? '' : 'opacity-35'}`,
          style: {
            width: many ? 'calc(25% - 4px)' : undefined,
            height: many ? big + 16 : undefined,
            transform: talking || many ? 'scale(1)' : 'scale(.86)',
            transition: 'opacity .18s, transform .18s'
          }
        }, /*#__PURE__*/React.createElement("span", {
          style: {
            display: 'block',
            filter: talking ? `drop-shadow(0 0 10px ${who.accent})` : 'none',
            transition: 'filter .2s'
          }
        }, /*#__PURE__*/React.createElement(AssistantFace, {
          who: who,
          size: talking ? big : small,
          accent: who.accent,
          expression: talking ? line.e : 'normal'
        })), /*#__PURE__*/React.createElement("span", {
          className: "max-w-full truncate text-[9px] font-black leading-none",
          style: {
            color: talking ? who.accent : '#64748b'
          }
        }, talking && line.name ? line.name : who.name));
      }));
    })(), bottomLine ? /*#__PURE__*/React.createElement("div", {
      key: speakingGuest ? 'keep' : `x${step}`,
      "data-story-pop": speakingGuest ? undefined : '1',
      className: "rounded-2xl border-2 bg-slate-900 px-3 py-3",
      style: {
        borderColor: bottomSpeaker.accent,
        opacity: speakingGuest ? .4 : 1,
        boxShadow: speakingGuest ? 'none' : `0 0 16px ${bottomSpeaker.accent}55`,
        transition: 'opacity .18s',
        animation: speakingGuest ? undefined : 'storyPop .28s ease-out both'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "inline-block rounded-full px-2 py-0.5 text-[10px] font-black",
      style: {
        color: '#0f172a',
        background: bottomSpeaker.accent
      }
    }, bottomLine.name || bottomSpeaker.name), /*#__PURE__*/React.createElement("span", {
      className: "block text-[13px] font-bold leading-relaxed text-white mt-1",
      style: bubbleWrapStyle()
    }, bubbleLines(speakText(bottomLine, bottomSpeaker)))) : /*#__PURE__*/React.createElement("div", {
      className: "rounded-2xl border-2 border-slate-700 bg-slate-900 px-3 py-3 text-center text-[11px] font-bold text-slate-400"
    }, "\u25B2 \u4E0A\u306E\u3053\u3068\u3070\u3092\u8AAD\u3093\u3067\u306D"), /*#__PURE__*/React.createElement("p", {
      className: "mt-2 text-center text-[8px] text-slate-500"
    }, step + 1, " / ", script.length), /*#__PURE__*/React.createElement("div", {
      className: `relative mt-3 grid ${last ? 'grid-cols-1' : 'grid-cols-[1fr_2fr]'} gap-2`,
      style: {
        pointerEvents: 'auto',
        zIndex: 2
      }
    }, !last && /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => {
        e.stopPropagation();
        skip();
      },
      className: "min-h-[50px] rounded-2xl bg-slate-700 text-sm font-black text-white active:scale-[.98]"
    }, "\u30B9\u30AD\u30C3\u30D7"), /*#__PURE__*/React.createElement("button", {
      type: "button",
      onClick: e => {
        e.stopPropagation();
        next();
      },
      className: "min-h-[50px] rounded-2xl bg-fuchsia-500 text-sm font-black text-slate-950 active:scale-[.98]"
    }, last ? '閉じる' : '次へ'))));
  })());
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Screen));
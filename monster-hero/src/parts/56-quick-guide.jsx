// ==== クイック・AUTO設定・裏周回の案内(2026-11-07 社長「モンバトのオート設定や他コンテンツのクイックの誘導やチュートリアルや説明をつけたい」) ====
//
// 画面ごとに分けた一度きりの案内。台詞は data/assistants.js の ASSISTANT_QUICK_GUIDE_LINES(助手id → ページid → 文)。
//   g1a … バトルの選び方(クイックの札)                 クイックの難易度が1つでも開いた人
//   g1b … クイックの難易度えらび(難易度・報酬方針)      同上
//   g2  … AUTO設定(4つの欄)                            全員
//   g3a … クイックで∞にしたバトル画面(🎵 モンヒロビート)  全員
//   g3b … 裏周回のままの曲えらび(周回の帯)              全員
//   g3c … 裏周回のままのモードえらび(左上の ⏹ 終了)       全員
//   auto … ふつうのバトル(練習・台本のバトルでない)の AUTO ボタン
//   nudgeHome / nudgeBattle … クイックが開いているのに一度もクイックをクリアしていない人への誘導(1日1回・合計3回)
//
// 【決めごと】
// ・全員に一度(前から遊んでいる人にも)。最後のページまで見たら「見た」。途中で「あとで」を押したら、次にその画面を開いたとき最初から
// ・お話・おしゃべり・ほかの案内・演奏中・れんしゅう中は出さない(busy)。案内は画面を切り替えない(g1 の「AUTO設定を見に行く」は押したときだけ)
// ・ヘルプの「クイックのAUTO設定と裏周回」から、3つの案内(g1・g2・g3)をいつでも見返せる(光らせる所は無しで、ページだけ流す)
// ・保存は新しいキーだけ。mh_quick_guide_seen_v1 = { v:1, seen:[案内id] } / mh_quick_nudge_v1 = { v:1, n:出した回数, day:最後に出した日(jstDayKey4) }
//   MFバトルカードの🤖オートの吹き出しは、カードの画面が別に読むので mh_card_auto_intro_seen_v1(真偽値)に分ける
// ・検査: tools/assistant/quick-guide-check.js
const QUICK_GUIDE_SEEN_KEY = 'mh_quick_guide_seen_v1';
const QUICK_GUIDE_NUDGE_KEY = 'mh_quick_nudge_v1';
const CARD_AUTO_INTRO_SEEN_KEY = 'mh_card_auto_intro_seen_v1';
const QUICK_GUIDE_NUDGE_MAX = 3;
const QUICK_GUIDE_IDS = Object.freeze(['g1a', 'g1b', 'g2', 'g3a', 'g3b', 'g3c', 'auto']);
// 案内ごとのページ。spot … 光らせる所(CSS セレクタ。見えている最初の1つ)。無ければ光らせない
//   must … 文で言っている中身(スイッチ・ボタンなど)。画面に入り、光らせた枠の中にあり、窓に隠れないこと(検査 quick-guide-check が見る)
//   openDetail … そのページのあいだ、曲えらびの周回の帯を開く(中のボタンを見せるため。画面は移さない)
const QUICK_GUIDE_PAGES = Object.freeze({
  g1a: [{ id: 'g1.1', spot: '[data-battle-system-card="systemQuick"]', must: '[data-battle-system="systemQuick"]' }],
  g1b: [
    { id: 'g1.2', spot: '[data-difficulty-carousel]', must: '[data-difficulty-card]' },
    { id: 'g1.3', spot: '[data-quick-reward-policy]', must: '[data-quick-reward-policy] button' },
    { id: 'g1.4' },
    { id: 'g1.5', goAutoSettings: true },
  ],
  g2: [
    { id: 'g2.1' },
    { id: 'g2.2', spot: '[data-auto-settings-section="policy"]', must: '[data-auto-settings-section="policy"] h3' },
    { id: 'g2.3', spot: '[data-auto-settings-section="ally"]', must: '[data-auto-settings-section="ally"] h3' },
    // 文で言う「開いたら自動で始める」のスイッチを光らせる(欄ごとだと横画面でスイッチが画面の外に出る・2026-11-07 レフェリーくんの止め絵)
    { id: 'g2.4', spot: '[data-auto-quick-run-autostart]', must: '[data-auto-quick-run-autostart]' },
    { id: 'g2.5', spot: '[data-auto-settings-section="breakthrough"]', must: '[data-auto-settings-section="breakthrough"] h3' },
  ],
  g3a: [
    { id: 'g3.1' },
    // モンヒロビートへの入口(60-app.jsx の quickToRhythmButtonNode)。入口の目印は1か所だけにする決まりなので、ボタンの名前で探す
    { id: 'g3.2', spot: 'button[aria-label="周回を続けたままモンヒロビートへ"]', must: 'button[aria-label="周回を続けたままモンヒロビートへ"]' },
    { id: 'g3.3' },
  ],
  g3b: [
    { id: 'g3.4', spot: '[data-quick-run-band]', must: '[data-quick-run-band]' },
    // 帯を開いて、中のボタン(バトルへ戻る・ここで周回をやめる。負けたあとは「1周目から新しく始める」)を光らせる(2026-11-07 レフェリーくんの止め絵)
    { id: 'g3.5', spot: '[data-quick-run-progress-detail]', must: '[data-quick-run-progress-detail] button', openDetail: true },
  ],
  g3c: [{ id: 'g3.6', spot: '[data-rhythm-mode-select] [data-rhythm-back]', must: '[data-rhythm-mode-select] [data-rhythm-back]' }],
  auto: [{ id: 'auto.first', spot: '[data-battle-auto-button]', must: '[data-battle-auto-button]' }],
  nudgeHome: [{ id: 'nudge.home' }],
  nudgeBattle: [{ id: 'nudge.battle' }],
});
// ヘルプから見返すときのまとまり(光らせる所は無しで、ページを続けて流す)
const QUICK_GUIDE_REPLAYS = Object.freeze({ g1: ['g1a', 'g1b'], g2: ['g2'], g3: ['g3a', 'g3b', 'g3c'] });
const quickGuideReplayPages = (replayId) => (QUICK_GUIDE_REPLAYS[replayId] || []).flatMap((g) => QUICK_GUIDE_PAGES[g].map((p) => ({ id: p.id })));
// ページの文。その助手の文が無ければ、みゅあの文(なければ null)
const quickGuideLine = (assistantId, pageId) => {
  const all = typeof ASSISTANT_QUICK_GUIDE_LINES === 'object' && ASSISTANT_QUICK_GUIDE_LINES ? ASSISTANT_QUICK_GUIDE_LINES : {};
  const own = all[assistantId] && all[assistantId][pageId];
  const line = own && typeof own.t === 'string' && own.t ? own : (all.mua && all.mua[pageId]) || null;
  return line && typeof line.t === 'string' ? line : null;
};
const normalizeQuickGuideSeen = (v) => {
  const list = v && typeof v === 'object' && Array.isArray(v.seen) ? v.seen : [];
  return QUICK_GUIDE_IDS.filter((id) => list.includes(id));
};
const quickGuideSeenAfter = (seen, id) => ({ v: 1, seen: normalizeQuickGuideSeen({ seen: [...(Array.isArray(seen) ? seen : []), id] }) });
const normalizeQuickNudge = (v) => {
  const r = v && typeof v === 'object' ? v : {};
  const n = Number.isInteger(r.n) && r.n >= 0 ? Math.min(r.n, 1000) : 0;
  return { v: 1, n, day: typeof r.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.day) ? r.day : '' };
};
// 今日の誘導を出してよいか(1日1回・合計3回まで)
const quickNudgeAllowed = (nudge, today) => { const s = normalizeQuickNudge(nudge); return s.n < QUICK_GUIDE_NUDGE_MAX && s.day !== today; };
const quickNudgeAfter = (nudge, today) => { const s = normalizeQuickNudge(nudge); return { v: 1, n: s.n + 1, day: today }; };
// クイックの∞では、WAVE とWAVE のあいだに画面が一瞬だけ次の状態を通る(1 WAVE が3秒ほどなので、3秒ごと)。
//   ここで案内を消すと作り直されて1ページ目へ戻り、「あとで」も取り消される(2026-11-07 レフェリーくんの止め絵)。
//   出している ∞ の案内(g3a)は、このあいだも出したままにし、「あとで」もバトルの画面と同じに扱う
const QUICK_GUIDE_RUN_BETWEEN = Object.freeze(['WAVE_RESULT', 'QUICK_GROWTH', 'PICK_ALLY', 'QUICK_JOIN']);
// 案内がこれだけ見えていたら「見た」にする(閉じなくても、アプリを閉じても、二度と自動では出さない。2026-11-07 社長)
const QUICK_GUIDE_SEEN_AFTER_MS = 1200;
const quickGuideScreenKey = (gameState, quickRun, autoRepeat) => (quickRun === true && autoRepeat === true && QUICK_GUIDE_RUN_BETWEEN.includes(gameState) ? 'BATTLE' : gameState);
// いまの画面で出す案内。ctx … { gameState, busy, seen, quickUnlocked, quickEverCleared, quickSelect, quickRun, autoRepeat, battleTutorial, raidJack, backgroundRun, nudgeOk, showing }
//   showing … いま出している案内(WAVE のあいだも ∞ の案内を出したままにするため)
const quickGuidePick = (ctx) => {
  const c = ctx || {};
  if (c.busy || !Array.isArray(c.seen)) return null;
  const not = (id) => !c.seen.includes(id);
  if (c.showing === 'g3a' && c.quickRun === true && c.autoRepeat === true && QUICK_GUIDE_RUN_BETWEEN.includes(c.gameState) && not('g3a')) return 'g3a';
  const nudge = c.nudgeOk === true && c.quickUnlocked === true && c.quickEverCleared !== true;
  switch (c.gameState) {
    case 'BATTLE_SYSTEM_SELECT':
      if (c.quickUnlocked === true && not('g1a')) return 'g1a';
      return nudge ? 'nudgeBattle' : null;
    case 'BATTLE_DIFFICULTY_SELECT':
      return c.quickSelect === true && c.quickUnlocked === true && not('g1b') ? 'g1b' : null;
    case 'AUTO_SETTINGS':
      return not('g2') ? 'g2' : null;
    case 'BATTLE':
      // れんしゅう・台本のバトルと、ジャックとの戦い(レイドバトル・グランドスラム。特別な戦い)では出さない
      if (c.battleTutorial || c.raidJack === true) return null;
      if (c.quickRun === true && c.autoRepeat === true && not('g3a')) return 'g3a';
      return not('auto') ? 'auto' : null;
    case 'RHYTHM_DEMO_HOME':
      return c.backgroundRun === true && not('g3b') ? 'g3b' : null;
    case 'RHYTHM_MODE_SELECT':
      return c.backgroundRun === true && not('g3c') ? 'g3c' : null;
    case 'HOME':
      return nudge ? 'nudgeHome' : null;
    default:
      return null;
  }
};

// モンヒロビートの「🔄 横」で絵を回しているとき(端末は縦のまま)。案内は回した器の中へ出し、位置も器の中の座標で測る
//   (2026-11-07 レフェリーくん: body へ出していたので、回したときに案内の窓だけ縦のままだった)
const quickGuideRotated = () => typeof RHYTHM_VIEW_ROTATION === 'object' && !!RHYTHM_VIEW_ROTATION && typeof RHYTHM_VIEW_ROTATION.active === 'function' && RHYTHM_VIEW_ROTATION.active();
const quickGuideRectOf = (el) => (quickGuideRotated() && typeof RHYTHM_VIEW_ROTATION.rectOf === 'function' ? RHYTHM_VIEW_ROTATION.rectOf(el) : el.getBoundingClientRect());
// 案内を描く場所の大きさ。回しているときは幅と高さが入れ替わる
const quickGuideView = () => {
  if (typeof window === 'undefined') return { w: 0, h: 0 };
  return quickGuideRotated() ? { w: window.innerHeight || 0, h: window.innerWidth || 0 } : { w: window.innerWidth || 0, h: window.innerHeight || 0 };
};
// 案内を出す先。ふだんは body(バトルの技の札など body へ出る物より上に重ねるため)。回しているときは回した器
const quickGuidePortalTarget = () => {
  if (typeof document === 'undefined') return null;
  if (quickGuideRotated()) return document.querySelector('[data-mh-view-rotation="true"]') || document.body;
  return document.body;
};

// 光らせる所。見えている最初の1つの位置(画面の座標)。無ければ null
const quickGuideSpotRect = (selector) => {
  if (!selector || typeof document === 'undefined') return null;
  try {
    // 同じ目印が並ぶ物(横に並ぶ難易度の札など)は、いちばん画面に入っている1つ
    let best = null, bestArea = -1;
    for (const el of document.querySelectorAll(selector)) {
      const r = quickGuideRectOf(el), v = quickGuideView();
      if (!(r.width > 0 && r.height > 0)) continue;
      const area = Math.max(0, Math.min(r.bottom, v.h) - Math.max(r.top, 0)) * Math.max(0, Math.min(r.right, v.w) - Math.max(r.left, 0));
      if (area > bestArea) { bestArea = area; best = { el, top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom }; }
    }
    if (best) return best;
  } catch (_) { /* 書き方の違うセレクタは光らせないだけ */ }
  return null;
};

// 光らせる所を画面の中へ寄せる。縦にだけ動かす(scrollIntoView は横のカルーセルまで動かすので使わない決まり・viewport-height-check)
//   top … 先頭を上の端へ / それ以外 … 見えていなければ近い側へ
const quickGuideScrollTo = (el, top) => {
  if (!el || typeof window === 'undefined') return;
  let box = el.parentElement;
  while (box && box !== document.body) {
    const oy = getComputedStyle(box).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight + 1) break;
    box = box.parentElement;
  }
  if (!box || box === document.body) return;
  const r = quickGuideRectOf(el), b = quickGuideRectOf(box);
  if (top) box.scrollTop += r.top - b.top - 8;
  else if (r.top < b.top) box.scrollTop += r.top - b.top - 8;
  else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom + 8;
};

// ボタンの名前の記号(⚔ ⏩ ⏹ 🎵 など)のすぐあとで行が折れないよう、記号のあとの空白を折れない空白にする
const quickGuideNoBreak = (t) => String(t).replace(/(\p{Extended_Pictographic}\uFE0F?) /gu, '$1\u00a0');

// 案内の窓。pages … [{ id, spot?, goAutoSettings? }]。onDone(true) … 最後まで見た / onDone(false) … あとで
const QuickGuideOverlay = ({ guideId, pages, assistant, callName, onDone, onGoAutoSettings, onPage = null }) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState(null);
  const [panelH, setPanelH] = useState(150);
  const panelRef = useRef(null);
  useEffect(() => { setStep(0); }, [guideId]);
  const page = pages[Math.min(step, pages.length - 1)] || null;
  // 窓の高さを測る(光らせる所と重ならない置き方を決めるため)
  // ページが変わったら知らせる(帯を開く・閉じるなど、画面の側でする事のため)
  useEffect(() => { if (onPage && page) onPage(page); }, [guideId, step]);
  useEffect(() => { try { const h = panelRef.current && panelRef.current.offsetHeight; if (h > 0) setPanelH(Math.ceil(h)); } catch (_) { /* 既定のまま */ } });
  // 光らせる所を測る。初めに画面の中へ寄せ、あとは 300ms ごとと画面の大きさが変わったときに測り直す(バトルは動き続けるため)
  //   ★窓の分を引いた残りに入りきらない大きな所(AUTO設定の欄・横画面の難易度)は、先頭を上へ寄せ、窓に重ならない範囲だけ光らせる
  useEffect(() => {
    if (!page || !page.spot) { setRect(null); return undefined; }
    const first = quickGuideSpotRect(page.spot);
    const vh0 = quickGuideView().h;
    try {
      if (first && first.el) quickGuideScrollTo(first.el, first.height > vh0 - panelH - 40);
      // 文で言っている中身が画面の外なら、そこまで寄せる(大きな欄の下のほうにあるスイッチなど)
      const must = page.must ? quickGuideSpotRect(page.must) : null;
      if (must && must.el && (must.top < 0 || must.bottom > vh0 - panelH - 24)) quickGuideScrollTo(must.el, true);
    } catch (_) { /* 寄せられなくても測れる */ }
    // 光らせる所が大きすぎて窓と上下に並べられないときは、文で言っている中身(must)だけを光らせる(横画面の難易度の札など)
    const measure = () => {
      let r = quickGuideSpotRect(page.spot);
      const vh = quickGuideView().h;
      if (r && page.must && r.height > vh - panelH - 40) { const m = quickGuideSpotRect(page.must); if (m) r = m; }
      setRect(r ? { top: r.top, left: r.left, width: r.width, height: r.height, bottom: r.bottom } : null);
    };
    measure();
    const t = setInterval(measure, 300);
    window.addEventListener('resize', measure);
    return () => { clearInterval(t); window.removeEventListener('resize', measure); };
  }, [guideId, step, page && page.spot, panelH]);
  if (!page) return null;
  const line = quickGuideLine(assistant && assistant.id, page.id);
  if (!line) return null;
  const text = quickGuideNoBreak(String(line.t).split('{name}').join(callName || 'ブリーダー'));
  const last = step >= pages.length - 1;
  const vh = quickGuideView().h;
  // 小さいボタン(🎵 など)は枠を詰める(となりのボタンにかからないように)
  const pad = rect && Math.min(rect.width, rect.height) < 56 ? 3 : 6, gap = 12;
  // 窓は光らせた所と重ならない側へ。上に入るなら上・下に入るなら下・どちらにも入らなければ、下に置いて光らせる所を切り詰める
  const roomTop = rect ? rect.top - pad - gap : 0, roomBottom = rect ? vh - rect.bottom - pad - gap : 0;
  //   どちらにも入らないときは下に置く(大きな所は先頭へ寄せてあるので、見出しが窓の上に見える)
  const atTop = !!rect && vh > 0 && roomBottom < panelH && roomTop >= panelH;
  // 横画面で上下どちらにも入らないときは、左右の空きが十分なら窓を細くして横に置く(横画面の難易度の札など。切り詰めずに済む)
  const vw = quickGuideView().w;
  const roomLeft = rect ? rect.left - pad - gap : 0, roomRight = rect ? vw - (rect.left + rect.width) - pad - gap : 0;
  const side = !!rect && vh > 0 && vw > vh && !atTop && roomBottom < panelH && Math.max(roomLeft, roomRight) >= 170
    ? (roomRight >= roomLeft ? 'right' : 'left') : null;
  const sideWidth = side ? Math.min(300, Math.max(roomLeft, roomRight) - 4) : 0;
  const sideTop = side ? Math.max(8, Math.min(vh - panelH - 8, rect.top + rect.height / 2 - panelH / 2)) : 0;
  let ring = rect;
  if (rect && vh > 0 && !side) {
    if (atTop && roomTop < panelH) { const top = panelH + gap + pad + 10; ring = { ...rect, top, height: Math.max(0, rect.bottom - top) }; }
    if (!atTop && roomBottom < panelH) { const bottom = vh - panelH - gap - pad - 10; ring = { ...rect, height: Math.max(0, Math.min(rect.bottom, bottom) - rect.top) }; }
  }
  const face = assistant && typeof assistantFaceImage === 'function' ? assistantFaceImage(assistant, line.e || 'normal') : null;
  // 画面のいちばん外(document.body)へ出す。バトルの技の名前の札なども body へ出ているので、画面の中に描くと、
  //   重なり順の数字が大きくても札の下になる(横画面で窓の題に重なった・2026-11-07 レフェリーくんの止め絵)
  const overlay = (
    <div data-quick-guide={guideId} data-quick-guide-page={page.id} className="fixed inset-0 z-[100050]" style={{ pointerEvents: 'auto' }}>
      {/* 案内のあいだは、画面にもとからある助手の吹き出しを隠す(光らせた所と窓のすきまからのぞいて、ごちゃつく) */}
      <style>{'[data-assistant-bubble]{visibility:hidden !important}'}</style>
      {/* 光らせた所の外を暗くする(光らせる所が無いときは、全体を少し暗くするだけ) */}
      {ring && ring.height > 0
        ? <div data-quick-guide-spot aria-hidden="true" className="pointer-events-none fixed rounded-xl border-2 border-amber-300"
            style={{ top: ring.top - pad, left: ring.left - pad, width: ring.width + pad * 2, height: ring.height + pad * 2, boxShadow: '0 0 0 9999px rgba(2,6,23,0.62), 0 0 18px rgba(252,211,77,0.75)' }}/>
        : <div aria-hidden="true" className="pointer-events-none fixed inset-0 bg-slate-950/60"/>}
      <div ref={panelRef} data-quick-guide-panel data-quick-guide-side={side || undefined}
        className={`fixed rounded-2xl border-2 border-fuchsia-300/70 bg-slate-950/95 p-3 shadow-2xl landscape:max-[500px]:p-2 ${side ? '' : 'left-1/2 w-[min(560px,calc(100vw-24px))] -translate-x-1/2'}`}
        style={side ? { top: sideTop, width: sideWidth, ...(side === 'right' ? { right: 8 } : { left: 8 }) }
          : atTop ? { top: 'calc(10px + var(--mh-sa-top, 0px))' } : { bottom: 'calc(10px + var(--mh-sa-bottom, 0px))' }}>
        <div className="flex items-start gap-2.5">
          {face && <img src={face} alt="" aria-hidden="true" className="h-12 w-12 shrink-0 rounded-full border-2 border-fuchsia-300/70 bg-slate-900 object-cover object-top landscape:max-[500px]:h-9 landscape:max-[500px]:w-9"/>}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <b className={`min-w-0 flex-1 text-[13px] font-black text-amber-100 ${side ? 'leading-snug' : 'truncate'}`}>{line.title || ''}</b>
              {pages.length > 1 && <span className="shrink-0 text-[10px] font-black tabular-nums text-slate-400">{step + 1} / {pages.length}</span>}
            </div>
            <p data-quick-guide-text className="mt-1 text-[12px] font-bold leading-relaxed text-slate-100" style={typeof JA_WRAP_STYLE !== 'undefined' ? JA_WRAP_STYLE : undefined}>{text}</p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2 landscape:max-[500px]:mt-1">
          {!last && <button type="button" data-quick-guide-later onClick={() => onDone(false)} className="min-h-[40px] rounded-xl border border-slate-500/60 px-3 text-[11px] font-black text-slate-300 active:scale-[.97]">あとで</button>}
          {last && page.goAutoSettings && onGoAutoSettings && <button type="button" data-quick-guide-go-auto onClick={() => { onDone(true); onGoAutoSettings(); }} className="min-h-[40px] rounded-xl border border-cyan-300/70 bg-cyan-800/70 px-3 text-[11px] font-black text-cyan-50 active:scale-[.97]">AUTO設定を見に行く</button>}
          <button type="button" data-quick-guide-next onClick={() => (last ? onDone(true) : setStep(step + 1))} className="min-h-[40px] min-w-[84px] rounded-xl border border-fuchsia-300/70 bg-fuchsia-700/80 px-3 text-[12px] font-black text-white active:scale-[.97]">{last ? (pages.length > 1 ? 'わかった！' : 'OK') : '次へ'}</button>
        </div>
      </div>
    </div>
  );
  const target = quickGuidePortalTarget();
  return target && typeof ReactDOM === 'object' && ReactDOM.createPortal ? ReactDOM.createPortal(overlay, target) : overlay;
};

// モンヒロくんの「反応の点検」(2026-10-07)。モンヒロビートを、本物のタッチの合図で人の指のように演奏し、
// **自分が押した時刻・位置**とゲームが返した判定を1ノーツずつ見比べる。
// ユーザー指示「音ゲー班が自分で遊んで、操作性や反応の悪さを直す仕組み」(10/7 の「タップ抜けがひどくなった」
// 「ホールド近くのノーツを押すとホールドが切れる」のあと)。
//
// ボットは自分がいつ・どこを押したかを正確に知っているので、次がすぐ分かる:
//   押したのに取れない … 判定の受付時間内(±150ms)に帯の上を押したのにMISS
//   判定のずれ         … ゲームの判定のずれ − ボットが押したずれ。0から離れたら時刻の補正がおかしい(10/7 は -30ms 前後だった疑い)
//   ホールドが切れた   … 押し始めは取れ、終わりまで押さえていたのにMISS
// iPhone のくせも起こせる(mode 'ios'): ポインタの合図が抜けるタッチ(dropPointer)/ 遅れて届くタッチ(lateRate・lateMs)。
// 親指で遊ぶ人のように、判定ラインより手前(画面の下)を押し(thumb)、ホールド中に別の指で押すと押さえている指がつられて動く(nudge)。
//
// installFeelPlayer はページの中で動く(page.evaluate へ渡す。合図の部品 touchSrc は呼ぶ側が渡す)。analyzeFeel は Node 側で数える。

// ---- ページの中 ----
function installFeelPlayer(o) {
  let st = o.seed >>> 0;
  const rand = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const hooks = window.__mhTestHooks || {};
  const area = document.querySelector('[data-rhythm-play-area]');
  const notes = hooks.rhythmNotes ? hooks.rhythmNotes() : null;
  if (!area || !notes) return { ok: false, why: !area ? '演奏エリアが無い' : '演奏の参照が無い(30-rhythm-play.jsx)' };
  if (typeof hooks.rhythmNoteResults !== 'function') return { ok: false, why: '判定の参照(rhythmNoteResults)が無い。この版は反応の点検に対応していない' };
  // 終点フリック(HOLD/SLIDE の終わりで指を弾く)の印は判定の参照から読む(人は終わりで弾く)
  const endFlick = new Set((hooks.rhythmNoteResults() || []).filter((r) => r.endFlick).map((r) => r.index));
  const lineRatio = typeof RHYTHM_JUDGMENT_LINE_Y !== 'undefined' ? RHYTHM_JUDGMENT_LINE_Y.ratio : 0.88;
  const rect = () => (typeof RHYTHM_GESTURE_RUNTIME !== 'undefined' && RHYTHM_GESTURE_RUNTIME.areaRect(area)) || area.getBoundingClientRect();
  // 判定ラインの高さで見えているレーン座標 c の横位置へ、高さ yRatio で指を置く(親指は手前に置いたまま、見えている列を狙う)
  const pointAt = (c, yRatio) => {
    const left = rhythmProjectBoundary(0, lineRatio), right = rhythmProjectBoundary(RHYTHM_LANE_COUNT, lineRatio);
    const fx = left + (c + 0.5) * (right - left) / RHYTHM_LANE_COUNT, r = rect();
    return { x: r.left + r.width * fx, y: r.top + r.height * yRatio };
  };
  const centerOf = (n) => (Number.isFinite(n.subLane) ? (n.subLane + (Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2) / 2) / 2 - 0.5 : n.lane);
  // 押し始めの受付のいちばん外側(ゲームの式そのもの)を探す。そこを押さえ続けても途中で切れないかを確かめる(edgeProbe)。
  // 押し始めと押さえている最中の受付が食い違うと、ここで切れる(10/7 のホールドの切れはこの形だった)
  const acceptsStart = (n, x, y) => {
    const r = rect(), w = Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2, s0 = Number.isFinite(n.subLane) ? n.subLane : n.lane * 2;
    const tol = w <= 1 ? (typeof RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES !== 'undefined' ? RHYTHM_NARROW_TAP_TOLERANCE_SUB_LANES : 0.45) : (typeof RHYTHM_TAP_TOLERANCE_SUB_LANES !== 'undefined' ? RHYTHM_TAP_TOLERANCE_SUB_LANES : 0.6);
    const within = (c) => Number.isFinite(c) && c >= s0 - tol && c <= s0 + w + tol;
    const a = rhythmSubLaneCoordinateAtPoint(x, y, r);
    const b = typeof rhythmSubLaneCoordinateAtLineIfBelow === 'function' ? rhythmSubLaneCoordinateAtLineIfBelow(x, y, r) : undefined;
    return within(a) || within(b);
  };
  const edgeProbePoint = (n, yRatio, side) => {
    const base = pointAt(centerOf(n), yRatio);
    if (!acceptsStart(n, base.x, base.y)) return null;
    let x = base.x;
    for (let k = 0; k < 200 && acceptsStart(n, x + side, base.y); k++) x += side;
    return { x: x - side * 1.5, y: base.y };   // いちばん外側から 1.5px 内側
  };
  const songNow = () => (hooks.rhythmSongMs ? hooks.rhythmSongMs() : null);
  // ゲームが入力ごとに差し引いた「入力が起きてから処理されるまでの遅れ」(setInputAge に渡される値)を、曲の時刻つきで控える(読むだけ)。
  // 早取りの切り分け用: 遅れて届いたタッチ以外で大きな値が渡されていれば、時刻の補正が過剰ということ
  const ageLog = [];
  try {
    const rt = RHYTHM_GESTURE_RUNTIME, orig = rt.setInputAge;
    if (typeof orig === 'function') rt.setInputAge = function (a) { if (ageLog.length < 40000) ageLog.push({ t: Math.round(songNow() || 0), age: Math.round((Number(a) || 0) * 10) / 10 }); return orig.apply(this, arguments); };
  } catch { /* 控えられなければ、遅れの値は出ない */ }
  // フリックの向き(flickDir)は、ゲームの中のノーツ本体にしか無い(rhythmNotes は写し)。絵を描くときに渡される本体を番号で控える(読むだけ。scenarios/rhythm.js と同じ)
  const real = new Map();
  try {
    const renderer = typeof RHYTHM_CANVAS_RENDERER !== 'undefined' ? RHYTHM_CANVAS_RENDERER : null;
    if (renderer && typeof renderer.drawNote === 'function') {
      const draw = renderer.drawNote.bind(renderer);
      renderer.drawNote = (note, geo, opts) => { if (note && Number.isFinite(note.index) && !real.has(note.index)) real.set(note.index, note); return draw(note, geo, opts); };
    }
  } catch { /* 控えられなければ、向きのあるフリックは上へはじく */ }
  // はじく向き(画面の横か上)。向きが決まっているものは横へ、無ければ上へ。dir は -1(左)・1(右)・0(上)
  const flickDirOf = (index) => { const g = real.get(index); return g && g.flickDir === 'left' ? -1 : g && g.flickDir === 'right' ? 1 : 0; };
  const flickTo = (p, dir, d) => (dir ? { x: p.x + dir * d, y: p.y } : { x: p.x, y: p.y - d });

  // ---- 指の合図(共有の部品 lib/touch-input.js。毎晩の演奏 scenarios/rhythm.js と同じ作り方)----
  const { makeEvents, send } = (0, eval)('(' + o.touchSrc + ')')(area, o.mode);

  // ---- 予定 ----
  // 端のレーン(いちばん左・右)は、親指が外へはみ出しやすい(人は端ほど外を押す)。外向きへ edgeOutLanes ずらす
  const edgeShift = (n) => { const c = centerOf(n); if (!(o.edgeOutLanes > 0)) return 0; if (c <= 0.25) return -o.edgeOutLanes * (0.5 + rand()); if (c >= RHYTHM_LANE_COUNT - 1.25) return o.edgeOutLanes * (0.5 + rand()); return 0; };
  const plan = notes.map((n) => ({ n, at: n.timeMs + gauss() * o.sigma, c: centerOf(n) + edgeShift(n) + gauss() * o.xNoiseLanes,
    y: o.thumb ? 0.9 + rand() * 0.08 : lineRatio })).sort((a, b) => a.at - b.at);
  const presses = [];
  const holding = []; // { id, n, p, until, press }
  let i = 0, pid = 500;
  const state = { done: false, results: null, presses, planned: plan.length, ageLog };
  window.__feel = state;
  const lerpLane = (pts, t) => {
    if (!pts || pts.length < 2) return null;
    if (t <= pts[0].timeMs) return pts[0].lane;
    for (let k = 1; k < pts.length; k++) if (t <= pts[k].timeMs) { const a = pts[k - 1], b = pts[k]; return a.lane + (b.lane - a.lane) * ((t - a.timeMs) / Math.max(1, b.timeMs - a.timeMs)); }
    return pts[pts.length - 1].lane;
  };
  let lastResultsAt = 0;
  const tick = () => {
    const now = songNow();
    if (now === null) {
      if (!document.querySelector('[data-rhythm-play-area]') || /RESULT|リザルト/.test(document.body.innerText.slice(0, 300))) { state.done = true; return; }
      requestAnimationFrame(tick); return;
    }
    if (performance.now() - lastResultsAt > 400) { lastResultsAt = performance.now(); const r = hooks.rhythmNoteResults(); if (r) state.results = r; }
    while (i < plan.length && plan[i].at <= now) {
      const { n, c, y } = plan[i++];
      const id = pid++;
      // 向きは画面の中心寄り。判定ラインより手前ではレーンが広がって見えるので、「判定ラインの高さに直した位置」が受付を広げるのは
      // 中心寄りの側。押し始めがそれで通り、押さえている最中は指の高さだけで見ていた(10/7 の食い違い)のはこちらの端
      // 途中で帯が動く・細くなるホールド(holdPoints)は、人は帯を目で追って指を動かす。受付の端で動かさずに押さえると、帯のほうが先に離れて切れるのは当たり前(ボットの勘違い)なので、端の確かめには使わず、指は帯の中心を追う
      const gn = real.get(n.index), varying = !!(gn && Array.isArray(gn.holdPoints) && gn.holdPoints.some((q) => q.subLane !== gn.holdPoints[0].subLane || q.subLaneWidth !== gn.holdPoints[0].subLaneWidth));
      const probeSide = o.edgeProbe > 0 && (n.type === 'HOLD') && !varying && rand() < o.edgeProbe ? (centerOf(n) < (RHYTHM_LANE_COUNT - 1) / 2 ? 1 : -1) : 0;
      const p = (probeSide && edgeProbePoint(n, y, probeSide)) || pointAt(c, y);
      const dropPointer = o.mode === 'ios' && rand() < o.dropPointer;
      // 遅れの大きさ: 'real' は実機(iPhone)の記録の割合どおり(50ms以上遅れたもののうち 80ms超が73%・150ms超が35%・300ms超が22%。最大は 1秒まで)。ほかは lateMs の範囲で一様
      const drawLate = () => { if (o.lateDist !== 'real') return o.lateMs[0] + rand() * (o.lateMs[1] - o.lateMs[0]); const u = rand(); return u < 0.27 ? 50 + rand() * 30 : u < 0.65 ? 80 + rand() * 70 : u < 0.78 ? 150 + rand() * 150 : 300 + rand() * 700; };
      const lateMs = o.mode !== 'mouse' && rand() < o.lateRate ? drawLate() : 0;
      // 押した位置を、ゲームの見方のレーン座標(指の高さで測った位置・判定ラインの高さに直した位置)と、狙った帯の中心で覚える(早取り・隣に取られるの切り分け用)
      let fx = null, fl = null; try { const bx = rect(); fx = rhythmLaneCoordinateAtPoint(p.x, p.y, bx); const sb = typeof rhythmSubLaneCoordinateAtLineIfBelow === 'function' ? rhythmSubLaneCoordinateAtLineIfBelow(p.x, p.y, bx) : undefined; fl = Number.isFinite(sb) ? sb / 2 - 0.5 : null; } catch { /* 測れなくても点検は続ける */ }
      const press = { fx: fx == null ? null : Math.round(fx * 100) / 100, fl: fl == null ? null : Math.round(fl * 100) / 100, center: Math.round(centerOf(n) * 100) / 100, bandW: Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2, index: n.index, type: n.type, edgeProbe: !!probeSide, pressSong: now, dropPointer, lateMs: Math.round(lateMs), x: Math.round(p.x), y: Math.round(p.y), releaseSong: null };
      presses.push(press);
      send(makeEvents('down', id, p, { dropPointer }), lateMs);
      // ホールド中に別の指で押すと、押さえている指がつられて少し動く(10/7 の「ホールド近くを押すと切れる」)
      // ホールド中に押したノーツの数を、押さえている側にも押した側にも覚える(近くを押して切れたかを別に数えるため)
      if (holding.length) press.duringHold = true;
      holding.forEach((h) => {
        const dl = centerOf(n) - centerOf(h.n), half = Number.isFinite(h.n.subLaneWidth) ? h.n.subLaneWidth / 4 : 0.5;
        const kind = Math.abs(dl) <= half + 0.5 ? 'same' : Math.abs(dl) <= 1.5 ? 'adjacent' : 'far';   // 同じ帯の上 / 隣のレーン / 離れている
        h.press.nearPresses = (h.press.nearPresses || 0) + 1; h.press['near_' + kind] = (h.press['near_' + kind] || 0) + 1;
      });
      if (o.near) {
        // 近くを押したときの「つられ」を強める: 全部のホールド(受付の端のもの以外)が、押した拍子に押したほうへ(60%)かその逆へ、数px〜20px動き、少ししてほぼ戻る
        holding.forEach((h) => {
          if (h.press.edgeProbe) return;
          const dir = (centerOf(n) - centerOf(h.n) >= 0 ? 1 : -1) * (rand() < 0.6 ? 1 : -1);
          const base = h.base || (h.base = { x: h.p.x, y: h.p.y });
          const dx = dir * o.nudgePx * (0.4 + rand() * 1.2);
          h.p = { x: base.x + dx, y: base.y + (rand() - 0.5) * 4 }; send(makeEvents('move', h.id, h.p));
          h.press.nudges = (h.press.nudges || 0) + 1;
          setTimeout(() => { if (holding.includes(h)) { h.p = { x: base.x + dx * 0.2, y: base.y }; send(makeEvents('move', h.id, h.p)); } }, 150 + rand() * 250);
        });
      } else if (o.nudgePx > 0) holding.forEach((h) => { if (!h.press.edgeProbe && rand() < 0.6) { const hc = centerOf(h.n), out = hc <= 0.25 ? -1 : hc >= RHYTHM_LANE_COUNT - 1.25 ? 1 : (rand() < 0.5 ? -1 : 1); const dx = out * o.nudgePx * (0.5 + rand() * 0.5); h.p = { x: h.p.x + dx, y: h.p.y + (rand() - 0.5) * 4 }; send(makeEvents('move', h.id, h.p)); } });
      if (n.type === 'HOLD' || n.type === 'SLIDE') {
        holding.push({ id, n, p, yRatio: y, press, varying, off: c - centerOf(n), until: (Number(n.endTimeMs) || n.timeMs) + gauss() * o.sigma * 0.5 });
      } else if (n.type === 'FLICK') {
        setTimeout(() => { const fd = flickDirOf(n.index), q1 = flickTo(p, fd, 30), q2 = flickTo(p, fd, 70); send(makeEvents('move', id, q1)); send(makeEvents('move', id, q2)); send(makeEvents('up', id, q2)); }, 25 + lateMs);
      } else {
        setTimeout(() => send(makeEvents('up', id, p)), 45 + rand() * 30 + lateMs);
      }
    }
    for (let k = holding.length - 1; k >= 0; k--) {
      const h = holding[k];
      // 人の指は止めているつもりでも少し揺れる。ゲームは指が動いたときに外れを確かめるので、受付の端で押さえる指は 1px ほど揺らす
      // (10/7 の「近くを押すとホールドが切れる」は、近くを押した拍子に押さえている指が動き、その瞬間の確かめで外れになっていた)
      if (h.press.edgeProbe && (!h.lastWobble || now - h.lastWobble > 90)) { h.lastWobble = now; const w = { x: h.p.x + (rand() < 0.5 ? -1 : 1) * 0.8, y: h.p.y + (rand() - 0.5) * 1.2 }; send(makeEvents('move', h.id, w)); }
      // 受付の端で押さえているホールドは、ゲームがその指を「外れている」と見たことがあるかを覚えておく(原因の切り分け用)
      if ((h.press.edgeProbe || o.near) && typeof RHYTHM_GESTURE_RUNTIME !== 'undefined' && RHYTHM_GESTURE_RUNTIME._sessions) {
        for (const ses of RHYTHM_GESTURE_RUNTIME._sessions.values()) {
          if (ses && ses.note && ses.note.index === h.n.index) { h.press.sessionSeen = true; h.press.sessionKey = ses.key; h.press.myId = h.id; try { const box = RHYTHM_GESTURE_RUNTIME.areaRect(); const act = rhythmLaneCoordinateAtPoint(h.p.x, h.p.y, box); const tr = rhythmHoldTrackedLane(ses.note, now - (ses.offsetMs || 0)); const lim = tr.half + rhythmHoldTrackingMarginLanes(tr.half * 4); const slack = act == null ? -9 : lim - Math.abs(act - tr.center); const sub = typeof rhythmSubLaneCoordinateAtLineIfBelow === 'function' ? rhythmSubLaneCoordinateAtLineIfBelow(h.p.x, h.p.y, box) : undefined; const atLine = Number.isFinite(sub) ? sub / 2 - 0.5 : null; const slackLine = atLine == null ? -9 : lim - Math.abs(atLine - tr.center); const best = Math.max(slack, slackLine); if (h.press.minSlackBest == null || best < h.press.minSlackBest) h.press.minSlackBest = Math.round(best * 1000) / 1000; if (h.press.minSlack == null || slack < h.press.minSlack) { h.press.minSlack = Math.round(slack * 1000) / 1000; h.press.track = { act: act == null ? null : Math.round(act * 1000) / 1000, center: tr.center, half: tr.half, lim: Math.round(lim * 1000) / 1000 }; } } catch (e) { h.press.trackErr = String(e && e.message || e); } if (ses.trackingBadSincePerf != null) h.press.trackingBad = true; if (ses.failed) h.press.sessionFailed = true; }
        }
      }
      // 帯が動くホールドは、帯の中心を追って指を動かす(押し始めの位置の、帯の中心からのずれはそのまま)
      if (h.varying && typeof rhythmHoldTrackedLane === 'function') { const g = real.get(h.n.index); if (g) { const tr = rhythmHoldTrackedLane(g, now); const q = pointAt(tr.center + h.off, h.yRatio); if (Math.abs(q.x - h.p.x) >= 0.5) { h.p = q; h.base = null; send(makeEvents('move', h.id, q)); } } }
      if (h.n.type === 'SLIDE') { const cc = lerpLane(h.n.slidePoints, now); if (cc !== null) { const q = pointAt(cc, h.yRatio); h.p = q; send(makeEvents('move', h.id, q)); } }
      if (endFlick.has(h.n.index) && !h.flicked && now >= h.until - 40) {
        // 終わりの少し前から、上へ素早く弾いて離す
        h.flicked = true; h.press.releaseSong = now;
        const fd = flickDirOf(h.n.index), q1 = flickTo(h.p, fd, 30), q2 = flickTo(h.p, fd, 70);
        send(makeEvents('move', h.id, q1)); setTimeout(() => { send(makeEvents('move', h.id, q2)); send(makeEvents('up', h.id, q2)); }, 30);
        holding.splice(k, 1); continue;
      }
      if (now >= h.until) { h.press.releaseSong = now; send(makeEvents('up', h.id, h.p)); holding.splice(k, 1); }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return { ok: true, notes: notes.length, planned: plan.length, notesInfo: notes.map((n) => ({ index: n.index, type: n.type, timeMs: n.timeMs, endTimeMs: n.endTimeMs, endFlick: endFlick.has(n.index) })), endFlicks: endFlick.size };
}

// ---- Node の側: 1ノーツずつ見比べて数える ----
const HIT_WINDOW_MS = 150;   // この内側を押したのに MISS なら「押したのに取れない」(GREAT の窓。BAD の窓 185ms より内側にして、揺れで数えない)
const DRIFT_MS = 25;         // 判定のずれとボットのずれの差がこれを超えたら「判定のずれ」
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * q))]; };

function analyzeFeel({ notesInfo, presses, results }) {
  const infoType = (x) => ((notesInfo || []).find((n) => n.index === x.index) || {}).type;
  const byIndex = new Map((results || []).map((r) => [r.index, r]));
  const info = new Map((notesInfo || []).map((n) => [n.index, n]));
  const out = { notes: notesInfo.length, pressed: presses.length, judged: 0, tapMissed: [], drift: [], stolen: [], holdBroken: [], errors: [] };
  for (const p of presses) {
    const n = info.get(p.index), r = byIndex.get(p.index);
    if (!n || !r) continue;
    const botDelta = p.pressSong - n.timeMs;
    const isHold = n.type === 'HOLD' || n.type === 'SLIDE';
    const headJudgment = isHold ? (r.holdJudgment || r.judgment) : r.judgment;
    const headDelta = isHold ? (r.holdDeltaMs ?? r.deltaMs) : r.deltaMs;
    if (r.done || r.holdJudgment) out.judged++;
    // ホールドが途中で切れた: 押さえている途中で外れ扱いになると、ゲームは終わりの時刻を「いま」へ前倒しして MISS を確定する
    // (rhythm-mode.js の evaluatePosition)。終わりの時刻が元より 60ms 以上前へ動いていたら、途中で切れたもの
    const cutEarly = isHold && r.judgment === 'MISS' && Number.isFinite(r.endTimeMs) && Number.isFinite(n.endTimeMs) && r.endTimeMs < n.endTimeMs - 60;
    if (cutEarly) {
      out.holdBroken.push({ nearPresses: p.nearPresses || 0, nearSame: p.near_same || 0, nearAdjacent: p.near_adjacent || 0, nearFar: p.near_far || 0, acceptedAlways: p.minSlackBest != null && p.minSlackBest >= 0, minSlackBest: p.minSlackBest, nudges: p.nudges || 0, x: p.x, y: p.y, index: p.index, type: n.type, timeMs: Math.round(n.timeMs), endTimeMs: Math.round(n.endTimeMs || 0), edgeProbe: !!p.edgeProbe, cutAtMs: Math.round(r.endTimeMs + 50), releasedAtMs: Number.isFinite(p.releaseSong) ? Math.round(p.releaseSong) : null, judgment: r.judgment, holdJudgment: r.holdJudgment, botDelta: Math.round(botDelta), x: p.x, y: p.y, dropPointer: p.dropPointer, lateMs: p.lateMs });
      continue;
    }
    // 押したのに取れない(押し始め)
    if (Math.abs(botDelta) <= HIT_WINDOW_MS && (!headJudgment || headJudgment === 'MISS')) {
      out.tapMissed.push({ duringHold: !!p.duringHold, index: p.index, type: n.type, timeMs: Math.round(n.timeMs), botDelta: Math.round(botDelta), dropPointer: p.dropPointer, lateMs: p.lateMs, x: p.x, y: p.y });
      continue;
    }
    // 判定のずれ(取れたものだけ)
    if (headJudgment && headJudgment !== 'MISS' && Number.isFinite(headDelta)) {
      const err = headDelta - botDelta;
      out.errors.push(err);
      // ほかの押下に早取り(遅取り)された: 押したずれと判定のずれが60ms以上離れ、遅れて届いた分では説明がつかない
      if (Math.abs(err) >= 60 && !(p.lateMs > 0 && err > 0 && err <= p.lateMs)) {
        // どの押下が、この判定に使われたか: ゲームの判定のずれから逆算した押した時刻に、いちばん近い別の押下
        const judgedAt = n.timeMs + headDelta; let other = null, od = 1e9;
        for (const q of presses) { if (q === p) continue; const dd = Math.abs(q.pressSong - judgedAt); if (dd < od) { od = dd; other = q; } }
        const on = other ? info.get(other.index) : null;
        out.stolen.push({ index: p.index, type: n.type, timeMs: Math.round(n.timeMs), botDelta: Math.round(botDelta), gameDelta: Math.round(headDelta), lateMs: p.lateMs, dropPointer: p.dropPointer,
          mine: { center: p.center, fx: p.fx, fl: p.fl, w: p.bandW, gameAge: p.gameAge ?? null }, usedPress: other && od < 25 ? { index: other.index, type: on && on.type, timeMs: on && Math.round(on.timeMs), center: other.center, fx: other.fx, fl: other.fl, w: other.bandW, lateMs: other.lateMs } : null });
      }
      else if (Math.abs(err) > DRIFT_MS) out.drift.push({ index: p.index, type: n.type, timeMs: Math.round(n.timeMs), botDelta: Math.round(botDelta), gameDelta: Math.round(headDelta), dropPointer: p.dropPointer, lateMs: p.lateMs });
    }
  }
  const per1000 = (k) => (out.pressed ? Math.round(k / out.pressed * 10000) / 10 : 0);
  out.summary = {
    pressed: out.pressed,
    tapMissed: out.tapMissed.length, tapMissedPer1000: per1000(out.tapMissed.length),
    tapMissedDroppedPointer: out.tapMissed.filter((x) => x.dropPointer).length,
    tapMissedLate: out.tapMissed.filter((x) => x.lateMs > 0).length,
    driftCount: out.drift.length, driftPer1000: per1000(out.drift.length),
    stolen: out.stolen.length, stolenPer1000: per1000(out.stolen.length),
    errorMedianMs: median(out.errors) == null ? null : Math.round(median(out.errors) * 10) / 10,
    errorP90AbsMs: pct(out.errors.map(Math.abs), 0.9) == null ? null : Math.round(pct(out.errors.map(Math.abs), 0.9) * 10) / 10,
    holdBroken: out.holdBroken.length,
    edgeProbes: presses.filter((x) => x.edgeProbe).length,
    holdBrokenAtEdge: out.holdBroken.filter((x) => x.edgeProbe).length,
    // ホールド中に近くを押した数と、そのとき切れた数。切れたうち「指はずっとゲームの受付範囲の中(いまの規則で)だった」ものは、ボットのせいではないので別に数える
    holds: presses.filter((x) => (infoType(x) === 'HOLD')).length,
    pressedDuringHold: presses.filter((x) => x.duringHold).length,
    nearPresses: presses.reduce((a, x) => a + (x.nearPresses || 0), 0),
    nearSame: presses.reduce((a, x) => a + (x.near_same || 0), 0), nearAdjacent: presses.reduce((a, x) => a + (x.near_adjacent || 0), 0), nearFar: presses.reduce((a, x) => a + (x.near_far || 0), 0),
    holdsWithNear: presses.filter((x) => x.nearPresses > 0).length,
    holdBrokenWithNear: out.holdBroken.filter((x) => x.nearPresses > 0).length,
    holdBrokenAccepted: out.holdBroken.filter((x) => x.acceptedAlways).length,
    holdBrokenAcceptedWithNear: out.holdBroken.filter((x) => x.acceptedAlways && x.nearPresses > 0).length,
    tapMissedDuringHold: out.tapMissed.filter((x) => x.duringHold).length,
  };
  return out;
}

module.exports = { installFeelPlayer, analyzeFeel, HIT_WINDOW_MS, DRIFT_MS };

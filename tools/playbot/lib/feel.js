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
// installFeelPlayer はページの中で動く(page.evaluate へ渡す)。analyzeFeel は Node 側で数える。

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
  const songNow = () => (hooks.rhythmSongMs ? hooks.rhythmSongMs() : null);

  // ---- 指の合図。mouse はこれまでのモンヒロくんと同じ。touch / ios は本物のタッチの経路(touchstart と pointerType 'touch')を通す ----
  const live = new Map(); // 画面に触れている指 id → 位置
  const mkTouch = (id, p) => new Touch({ identifier: id, target: area, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y, radiusX: 11, radiusY: 11, force: 1 });
  const makeEvents = (type, id, p, { dropPointer = false } = {}) => {
    const out = [];
    if (o.mode === 'mouse') {
      out.push(new PointerEvent({ down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[type], { bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse', isPrimary: false, clientX: p.x, clientY: p.y, buttons: type === 'up' ? 0 : 1 }));
      return out;
    }
    if (type === 'up') live.delete(id); else live.set(id, p);
    const touches = [...live.entries()].map(([k, q]) => mkTouch(k, q));
    if (!dropPointer) out.push(new PointerEvent({ down: 'pointerdown', move: 'pointermove', up: 'pointerup' }[type], { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: p.x, clientY: p.y, width: 22, height: 22, pressure: type === 'up' ? 0 : 0.5, buttons: type === 'up' ? 0 : 1 }));
    out.push(new TouchEvent({ down: 'touchstart', move: 'touchmove', up: 'touchend' }[type], { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [mkTouch(id, p)] }));
    return out;
  };
  // 合図は作った時刻(timeStamp)のまま、lateMs あとに届ける(＝遅れて届くタッチ。ゲームは timeStamp から遅れを引く)
  const send = (events, lateMs = 0) => { const go = () => events.forEach((e) => area.dispatchEvent(e)); if (lateMs > 0) setTimeout(go, lateMs); else go(); };

  // ---- 予定 ----
  const plan = notes.map((n) => ({ n, at: n.timeMs + gauss() * o.sigma, c: centerOf(n) + gauss() * o.xNoiseLanes,
    y: o.thumb ? 0.9 + rand() * 0.08 : lineRatio })).sort((a, b) => a.at - b.at);
  const presses = [];
  const holding = []; // { id, n, p, until, press }
  let i = 0, pid = 500;
  const state = { done: false, results: null, presses, planned: plan.length };
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
      const id = pid++, p = pointAt(c, y);
      const dropPointer = o.mode === 'ios' && rand() < o.dropPointer;
      const lateMs = o.mode !== 'mouse' && rand() < o.lateRate ? o.lateMs[0] + rand() * (o.lateMs[1] - o.lateMs[0]) : 0;
      const press = { index: n.index, type: n.type, pressSong: now, dropPointer, lateMs: Math.round(lateMs), x: Math.round(p.x), y: Math.round(p.y), releaseSong: null };
      presses.push(press);
      send(makeEvents('down', id, p, { dropPointer }), lateMs);
      // ホールド中に別の指で押すと、押さえている指がつられて少し動く(10/7 の「ホールド近くを押すと切れる」)
      if (o.nudgePx > 0) holding.forEach((h) => { if (rand() < 0.6) { const dx = (rand() < 0.5 ? -1 : 1) * o.nudgePx * (0.5 + rand() * 0.5); h.p = { x: h.p.x + dx, y: h.p.y + (rand() - 0.5) * 4 }; send(makeEvents('move', h.id, h.p)); } });
      if (n.type === 'HOLD' || n.type === 'SLIDE') {
        holding.push({ id, n, p, yRatio: y, press, until: (Number(n.endTimeMs) || n.timeMs) + gauss() * o.sigma * 0.5 });
      } else if (n.type === 'FLICK') {
        setTimeout(() => { const q1 = { x: p.x, y: p.y - 30 }, q2 = { x: p.x, y: p.y - 70 }; send(makeEvents('move', id, q1)); send(makeEvents('move', id, q2)); send(makeEvents('up', id, q2)); }, 25 + lateMs);
      } else {
        setTimeout(() => send(makeEvents('up', id, p)), 45 + rand() * 30 + lateMs);
      }
    }
    for (let k = holding.length - 1; k >= 0; k--) {
      const h = holding[k];
      if (h.n.type === 'SLIDE') { const cc = lerpLane(h.n.slidePoints, now); if (cc !== null) { const q = pointAt(cc, h.yRatio); h.p = q; send(makeEvents('move', h.id, q)); } }
      if (endFlick.has(h.n.index) && !h.flicked && now >= h.until - 40) {
        // 終わりの少し前から、上へ素早く弾いて離す
        h.flicked = true; h.press.releaseSong = now;
        const q1 = { x: h.p.x, y: h.p.y - 30 }, q2 = { x: h.p.x, y: h.p.y - 70 };
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
      out.holdBroken.push({ index: p.index, type: n.type, timeMs: Math.round(n.timeMs), endTimeMs: Math.round(n.endTimeMs || 0), cutAtMs: Math.round(r.endTimeMs + 50), releasedAtMs: Number.isFinite(p.releaseSong) ? Math.round(p.releaseSong) : null, judgment: r.judgment, holdJudgment: r.holdJudgment, botDelta: Math.round(botDelta), x: p.x, y: p.y, dropPointer: p.dropPointer, lateMs: p.lateMs });
      continue;
    }
    // 押したのに取れない(押し始め)
    if (Math.abs(botDelta) <= HIT_WINDOW_MS && (!headJudgment || headJudgment === 'MISS')) {
      out.tapMissed.push({ index: p.index, type: n.type, timeMs: Math.round(n.timeMs), botDelta: Math.round(botDelta), dropPointer: p.dropPointer, lateMs: p.lateMs, x: p.x, y: p.y });
      continue;
    }
    // 判定のずれ(取れたものだけ)
    if (headJudgment && headJudgment !== 'MISS' && Number.isFinite(headDelta)) {
      const err = headDelta - botDelta;
      out.errors.push(err);
      // ほかの押下に早取り(遅取り)された: 押したずれと判定のずれが60ms以上離れ、遅れて届いた分では説明がつかない
      if (Math.abs(err) >= 60 && !(p.lateMs > 0 && err > 0 && err <= p.lateMs)) out.stolen.push({ index: p.index, type: n.type, timeMs: Math.round(n.timeMs), botDelta: Math.round(botDelta), gameDelta: Math.round(headDelta) });
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
  };
  return out;
}

module.exports = { installFeelPlayer, analyzeFeel, HIT_WINDOW_MS, DRIFT_MS };

// モンヒロビート: 曲を選んで、人のように最後まで演奏する。
//
// 押し方は、ふつうの指と同じ pointerdown / pointermove / pointerup を演奏エリアへ送るだけ。
// ゲームの判定には一切手を入れない。ボットが知っているのは
//   ・曲の再生位置とノーツの一覧(30-rhythm-play.jsx の window.__mhTestHooks.rhythmSongMs / rhythmNotes。読むだけ)
//   ・レーンの位置(本体の rhythmProjectBoundary と同じ式で、判定ラインの高さのレーンの真ん中を求める)
// だけ。人らしさのため、押す時刻はばらつかせ(標準偏差 SIGMA_MS)、ときどき押し損ねる(MISS_RATE)。
//
// 【人の指のくせ】(2026-10-07・「ホールド近くのノーツを押すとホールドが切れる」を見つけられなかったため足した)
// 判定ラインの真ん中ばかり押していると、画面の手前(判定ラインより下)で押さえる親指のくせで起きる不具合が見えない。
// 手ごとに「判定ラインよりどれだけ下を押すか」の癖を持ち、横にも少しばらつかせ、端のレーンは外側へはみ出し気味に押す。
// HOLDを押さえている最中に、同じ手で近くのノーツを押すと、押さえている指が数pxつられて動く(すぐ戻る)。
// 全部 installPlayer の中だけで決めるので、音ゲー係・マルチ係・レイド音ゲー係・横画面の演奏すべてに効く。
// 【見張り】次の2つは「不具合候補」として、指の位置の印つきで報告する(window.__playbotRhythm.suspects → collectFingerSuspects)。
//   ・押し始めは取れたのに、押さえているあいだにHOLDが切れた
//   ・指が押し始めの受付範囲(ノーツの帯)の中にあって、時刻もほぼ合っているのにMISSになった

const { touchInputSource } = require('../lib/touch-input');

const SIGMA_MS = 28;
const MISS_RATE = 0.03;

// 演奏係へ渡すもの。指の持ち主を決めたいとき(PLAYBOT_FINGER)は環境変数で
const installArgs = (s) => ({ sigma: SIGMA_MS, missRate: MISS_RATE, seed: Math.floor(s.rand() * 1e9), persona: process.env.PLAYBOT_FINGER || '', input: process.env.PLAYBOT_INPUT || 'ios', touchSrc: touchInputSource });

// ページの中で動く演奏係。requestAnimationFrame で再生位置を見ながら、予定の時刻に指を下ろす
function installPlayer({ sigma, missRate, seed, human = true, persona = '', input = 'ios', dropRate = 0.01, lateRate = 0.0204, lateMs = [30, 120], touchSrc = '' }) {
  let st = seed >>> 0;
  const rand = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const hooks = window.__mhTestHooks || {};
  const area = document.querySelector('[data-rhythm-play-area]');
  const notes = hooks.rhythmNotes ? hooks.rhythmNotes() : null;
  if (!area || !notes) return { ok: false, why: !area ? '演奏エリアが無い' : '演奏の参照が無い(30-rhythm-play.jsx)' };
  // 判定ラインの高さで、レーン座標 c(0 = いちばん左のレーンの真ん中)を画面の点へ
  // 演奏エリアの中の割合の位置(fx, fy)が、画面のどこに出ているかを測る。
  // ★横画面(絵を90度回す)のときは、エリアの横方向が画面の縦方向になる。エリアの角に目印を置いて実際の位置を測り、
  //   その向きに合わせて押す(縦画面のときは今までどおり)
  const probe = (fx, fy) => {
    const d = document.createElement('div');
    d.style.cssText = `position:absolute;left:${fx * 100}%;top:${fy * 100}%;width:1px;height:1px;pointer-events:none;`;
    area.appendChild(d);
    const r = d.getBoundingClientRect();
    d.remove();
    return { x: r.left, y: r.top };
  };
  const P00 = probe(0, 0), P10 = probe(1, 0), P01 = probe(0, 1);
  const rotated = Math.abs(P10.y - P00.y) > Math.abs(P10.x - P00.x);
  // エリアの「上」が画面のどちら向きか(はじく向き。縦画面なら真上)
  const upLen = Math.hypot(P01.x - P00.x, P01.y - P00.y) || 1;
  const up = { x: (P00.x - P01.x) / upLen, y: (P00.y - P01.y) / upLen };
  const pointOf = (c) => {
    const ratio = (typeof RHYTHM_JUDGMENT_LINE_Y !== 'undefined' ? RHYTHM_JUDGMENT_LINE_Y.ratio : 0.88);
    const left = rhythmProjectBoundary(0, ratio), right = rhythmProjectBoundary(RHYTHM_LANE_COUNT, ratio);
    const laneWidth = (right - left) / RHYTHM_LANE_COUNT;
    const fx = left + (c + 0.5) * laneWidth;
    if (rotated) return { x: P00.x + fx * (P10.x - P00.x) + ratio * (P01.x - P00.x), y: P00.y + fx * (P10.y - P00.y) + ratio * (P01.y - P00.y) };
    const rect = (typeof RHYTHM_GESTURE_RUNTIME !== 'undefined' && RHYTHM_GESTURE_RUNTIME.areaRect(area)) || area.getBoundingClientRect();
    return { x: rect.left + rect.width * fx, y: rect.top + rect.height * ratio };
  };
  // ── 人の指のくせ ──
  // 画面上の向き: 横(レーンが並ぶ向き)と下(画面の手前)。大きさは px
  const latLen = Math.hypot(P10.x - P00.x, P10.y - P00.y) || 1;
  const latU = { x: (P10.x - P00.x) / latLen, y: (P10.y - P00.y) / latLen };
  const downU = { x: -up.x, y: -up.y };
  const lineRatio = (typeof RHYTHM_JUDGMENT_LINE_Y !== 'undefined' ? RHYTHM_JUDGMENT_LINE_Y.ratio : 0.88);
  const roomPx = Math.max(0, (1 - lineRatio) * upLen);                 // 判定ラインから演奏エリアの下端までの高さ
  const laneWpx = (() => { const l = rhythmProjectBoundary(0, lineRatio), r = rhythmProjectBoundary(RHYTHM_LANE_COUNT, lineRatio); return latLen * (r - l) / RHYTHM_LANE_COUNT; })();
  // 指の持ち主(種から決まる。PLAYBOT_FINGER=thumb|lean|normal|center で決められる)
  //   thumb  … 親指で画面の手前を押す人。判定ラインよりかなり下で押さえ、横のばらつきも、近くのノーツへのつられ方も大きい
  //   lean   … 親指で画面の手前を押し、端のレーンは内側(隣のレーン寄り)に構える人。つられ方も大きい
  //   normal … ふつうの人。少し下を押し、数pxつられる(ときどき10px台〜30px台)
  //   center … 判定ラインの真ん中だけを押す(これまでのボットと同じ。比べるために残す)
  const who = ['thumb', 'lean', 'normal', 'center'].includes(persona) ? persona : (() => { const r = rand(); return r < 0.25 ? 'thumb' : r < 0.5 ? 'lean' : r < 0.85 ? 'normal' : 'center'; })();
  const P = { lean: { depth: [0.8, 1.0], latSd: 0.2, mag: [10, 16, 50], hold: [200, 500] }, thumb: { depth: [0.75, 1.0], latSd: 0.2, mag: [6, 14, 48], hold: [100, 320] }, normal: { depth: [0.2, 1.0], latSd: 0.16, mag: [4, 11, 44], hold: [80, 300] }, center: { depth: [0, 0], latSd: 0, mag: [0, 0, 0], hold: [80, 300] } }[who];
  // 手ごとの癖(0 = 左手、1 = 右手): 判定ラインより下を押す深さ(下の余白に対する割合)と、横のかたより(レーン幅に対する割合)
  const habit = [0, 1].map(() => ({ depth: human ? P.depth[0] + rand() * (P.depth[1] - P.depth[0]) : 0, lat: human ? (rand() - 0.5) * 0.16 * (who === 'center' ? 0 : 1) : 0,
    // 端のレーンを押すときの内外のかたより(レーン幅に対する割合。+ は内側=隣のレーン寄り、- は外側へはみ出し気味)。
    // 親指の人は、隣のレーンも押す手の都合で内側寄りに構えるか、外へはみ出すかのどちらか(手ごとに決まる)
    inward: !human || who === 'center' ? 0 : who === 'lean' ? 0.15 + rand() * 0.15 : who === 'thumb' ? (rand() < 0.6 ? 1 : -1) * (0.12 + rand() * 0.2) : -(0.04 + rand() * 0.1) }));
  const handOf = (c) => (c < (RHYTHM_LANE_COUNT - 1) / 2 ? 0 : 1);
  // 1回押すときの指の置きどころ(判定ラインの真ん中からのずれ。px)。押している間は同じ値を使う
  const fingerHabit = (c, second = false) => {
    if (!human) return { below: 0, lat: 0, hand: handOf(c) };
    const hand = handOf(c), h = habit[hand];
    const edge = c <= 0.25 ? -1 : c >= RHYTHM_LANE_COUNT - 1.25 ? 1 : 0;   // 端のレーンは外側へはみ出し気味
    const depth = Math.max(0, Math.min(0.95, h.depth + gauss() * 0.15));
    return { hand, below: depth * roomPx, lat: (h.lat - edge * h.inward + Math.max(-0.4, Math.min(0.4, gauss() * P.latSd * (second ? 1.5 : 1)))) * laneWpx };
  };
  // サブレーンを持つノーツは、その帯の真ん中を押す
  const centerOf = (n) => (Number.isFinite(n.subLane)
    ? (n.subLane + (Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2) / 2) / 2 - 0.5
    : n.lane);
  let pid = 100;
  // 指の合図は共有の部品(lib/touch-input.js。反応の点検 feel.js と同じ作り方)で送る。既定は本物のタッチの経路(touchstart と pointerType 'touch')。
  // 'ios' は、ときどきポインタの合図が抜け(dropRate)・遅れて届く(lateRate)iPhone のくせも入れる。割合と遅れの分布は、実機(iPhone)の診断の記録に合わせてある(feel.js と同じ)。
  // 'mouse' はこれまでのマウスの合図(PLAYBOT_INPUT=mouse)。起こした数は stats.input に数える(報告に出す)
  const ti = touchSrc ? (0, eval)('(' + touchSrc + ')')(area, input === 'mouse' ? 'mouse' : 'touch') : null;
  const lateOf = new Map();
  const inputStats = { mode: ti ? input : 'mouse', downs: 0, dropped: 0, late: 0 };
  const dropOf = new Map();
  const fire = (type, id, p) => {
    if (!ti) { area.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse', isPrimary: false, clientX: p.x, clientY: p.y, buttons: type === 'pointerup' ? 0 : 1 })); return; }
    const t = type === 'pointerdown' ? 'down' : type === 'pointermove' ? 'move' : 'up';
    let drop = false, late = lateOf.get(id) || 0;
    if (t === 'down') {
      drop = input === 'ios' && rand() < dropRate;
      late = input === 'ios' && rand() < lateRate ? (() => { const u = rand(); return u < 0.27 ? 50 + rand() * 30 : u < 0.65 ? 80 + rand() * 70 : u < 0.78 ? 150 + rand() * 150 : 300 + rand() * 700; })() : 0;   // 遅れた指は、そのあとの動き・離すのも同じだけ遅れて届く(順番が入れ替わらない)
      lateOf.set(id, late); dropOf.set(id, drop);
      inputStats.downs += 1; if (drop) inputStats.dropped += 1; if (late > 0) inputStats.late += 1;
    }
    ti.send(ti.makeEvents(t, id, p, { dropPointer: drop }), late);
    if (t === 'up') lateOf.delete(id);
  };
  // 予定表: { at: 押す時刻(ms), kind, note }
  const real = new Map();
  const skippedIdx = new Set();   // わざと見送った(押し損ねた)ノーツ。次の押下がそのノーツに取られたときの見分けに使う
  const plan = [];
  let skipped = 0;
  // 指の使い回し: 同じ手で続けて押すとき(160ms未満)は、2本目の指になる。押す時刻が遅れ気味でばらつき、位置も雑になり、押し損ねも増える
  // (連打・同時押しの多い高難易度で、タップの取りこぼしが増えるのを再現する)
  const lastOfHand = [null, null];
  [...notes].sort((a, b) => a.timeMs - b.timeMs).forEach((n) => {
    const hand = handOf(centerOf(n));
    const prev = lastOfHand[hand];
    const gap = prev ? n.timeMs - prev.timeMs : Infinity;
    const second = human && gap < 160;
    lastOfHand[hand] = n;
    if (rand() < missRate * (second ? 2.5 : 1)) { skipped += 1; skippedIdx.add(n.index); return; }
    const lateMs = second ? ((160 - gap) / 160) * (6 + Math.abs(gauss()) * 10) : 0;
    plan.push({ at: n.timeMs + gauss() * sigma * (second ? 1.4 : 1) + lateMs, n, id: pid++, second });
  });
  plan.sort((a, b) => a.at - b.at);
  const active = []; // 押さえ続けている指 { id, n, until, hab, drift }
  const pending = []; // 押した結果を見張る { n, plan, p, hab, startTaken }
  let i = 0, taps = 0;
  const suspects = [];
  const lateTimes = [];
  // ボット自身の1コマが長く止まった時刻(CPU を遅くした端末の再現で起きる)。止まっているあいだは、押す・指を動かすのが予定より遅れるので、
  // その前後の MISS や切れは、ゲームの判定ではなくボットの遅れ。指の見張りの不具合候補に数えない(2026-10-09 見回り部の小さい画面で出た3件)
  const stallTimes = []; let lastTickNow = null;
  const BOT_STALL_MS = 100, BOT_LAG_MS = 50;
  const nearStall = (from, to) => stallTimes.some((t) => t >= from && t <= to);
  // タップは、ボットが予定より遅れて押した(止まっていたあいだに押す時刻が来た)ものだけ。押したあとゲームが止まるのは実機でも起きるので、除かない。
  // ホールドは、切れる直前にボットが止まっていたものだけ(実機なら止まっていた間の指の動きはまとめて届くが、ボットは止まったあと1コマ遅れて指を動かす)
  const botLagged = (r) => r.lag >= BOT_LAG_MS || Math.abs(r.sentDelta) >= 70;
  const nearLate = (r) => r.lateMs > 0 || r.dropped || lateTimes.some((t) => Math.abs(r.at - t) <= 1000);
  const diag = { tap: { n: 0, miss: 0, crowdedN: 0, missCrowded: 0, missInBand: 0, missInBandCrowded: 0, secondN: 0, secondMiss: 0 }, fingerLeft: 0, edgeHolds: 0, overlaps: 0, holds: 0, driftEvents: 0, bigDrifts: 0, bandHolds: 0 };
  const stats = { planned: plan.length, skipped, taps: 0, done: false, human, who, input: inputStats, suspects, diag, habit: habit.map((h) => ({ depth: +h.depth.toFixed(2), lat: +h.lat.toFixed(2), inward: +h.inward.toFixed(2) })) };
  const lerpLane = (pts, t) => {
    if (!pts || pts.length < 2) return null;
    if (t <= pts[0].timeMs) return pts[0].lane;
    for (let k = 1; k < pts.length; k++) {
      if (t <= pts[k].timeMs) { const a = pts[k - 1], b = pts[k]; return a.lane + (b.lane - a.lane) * ((t - a.timeMs) / Math.max(1, b.timeMs - a.timeMs)); }
    }
    return pts[pts.length - 1].lane;
  };
  // 指の置きどころ: 判定ラインの真ん中 + 手の癖(下・横) + つられて動いた分(drift。時間とともに戻る)
  // つられて動いた指は、しばらくそのままで(drift.hold ms)、そのあとゆっくり元へ戻る
  const DRIFT_TAU_MS = 150;
  const driftK = (drift, now) => (drift ? (now - drift.at <= drift.hold ? 1 : Math.exp(-(now - drift.at - drift.hold) / DRIFT_TAU_MS)) : 0);
  const fingerAt = (c, hab, drift, now) => {
    const p = pointOf(c);
    const k = driftK(drift, now);
    return { x: p.x + latU.x * hab.lat + downU.x * hab.below + (drift ? drift.x * k : 0), y: p.y + latU.y * hab.lat + downU.y * hab.below + (drift ? drift.y * k : 0) };
  };
  // HOLD は途中で帯の位置・幅が変わることがある(holdPoints)。ゲームの中のノーツ本体の「その時刻の帯の中心」を目で追う
  const laneOfHold = (n, now) => (n.type === 'HOLD' && real.get(n.index) && typeof rhythmHoldTrackedLane === 'function' ? rhythmHoldTrackedLane(real.get(n.index), now).center : n.type === 'SLIDE' ? (lerpLane(n.slidePoints, now) ?? n.lane) : centerOf(n));
  // ゲームが「押し始めの受付範囲(ノーツの帯)の中」と見る位置か。指の高さで測った位置と、判定ラインの高さに直した位置のどちらか
  const bandInfo = (n, p) => {
    const rect = (typeof RHYTHM_GESTURE_RUNTIME !== 'undefined' && RHYTHM_GESTURE_RUNTIME.areaRect(area)) || area.getBoundingClientRect();
    const actual = typeof rhythmLaneCoordinateAtPoint === 'function' ? rhythmLaneCoordinateAtPoint(p.x, p.y, rect) : null;
    const sub = typeof rhythmSubLaneCoordinateAtLineIfBelow === 'function' ? rhythmSubLaneCoordinateAtLineIfBelow(p.x, p.y, rect) : undefined;
    const atLine = Number.isFinite(sub) ? sub / 2 - 0.5 : null;
    const center = centerOf(n), half = (Number.isFinite(n.subLane) ? (Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2) / 4 : 0.5) - 0.05;
    const inside = (v) => v !== null && Number.isFinite(v) && Math.abs(v - center) <= half;
    return { actual, atLine, center, half, inBand: inside(actual) || inside(atLine) };
  };
  // 不具合候補を1件記録し、そこに赤い印を5秒出す(報告の画像に指の位置が写る)
  const suspect = (kind, n, p, extra) => {
    if (suspects.length >= 12) return;
    const rec = { kind, type: n.type, lane: n.lane, timeMs: Math.round(n.timeMs), finger: { x: Math.round(p.x), y: Math.round(p.y) }, ...extra };
    suspects.push(rec);
    try {
      const m = document.createElement('div');
      m.style.cssText = `position:fixed;left:${p.x - 16}px;top:${p.y - 16}px;width:32px;height:32px;border:3px solid #ff2d55;border-radius:50%;background:rgba(255,45,85,.25);z-index:2147483647;pointer-events:none;`;
      m.setAttribute('data-playbot-finger', kind);
      document.body.appendChild(m);
      setTimeout(() => m.remove(), 5000);
    } catch { /* 印が出せなくても記録は残る */ }
  };
  // (real は上で作る)
  // ゲームが付けた判定(holdJudgment・_rhythmFinalJudgment)は、ゲームの中のノーツ本体にしか無い(rhythmNotes は写しを返す)。
  // 絵を描くときに渡されるノーツ本体を、番号(index)で控えておく。読むだけで、ゲームの判定には触れない(tools/mode/rhythm-robot-play.js と同じ控え方)
  try {
    const renderer = typeof RHYTHM_CANVAS_RENDERER !== 'undefined' ? RHYTHM_CANVAS_RENDERER : null;
    if (renderer && typeof renderer.drawNote === 'function') {
      const draw = renderer.drawNote.bind(renderer);
      renderer.drawNote = (note, geo, opts) => { if (note && Number.isFinite(note.index) && !real.has(note.index)) real.set(note.index, note); return draw(note, geo, opts); };
    }
  } catch { /* 控えられなければ、見張りは働かない(演奏はできる) */ }
  stats.watching = 0;
  // ノーツの種類ごとの数とMISS(ボットが押したかどうかによらず、ゲームが付けた最終の判定で数える)。どの種類で取りこぼしているかを見るため
  setInterval(() => {
    stats.watching = real.size;
    const by = {};
    real.forEach((g) => {
      if (!g._rhythmFinalJudgment) return;
      const t = g._rhythmOriginalType || g.type;
      const e = by[t] || (by[t] = { n: 0, miss: 0 });
      e.n += 1; if (g._rhythmFinalJudgment === 'MISS') e.miss += 1;
    });
    diag.byType = by;
  }, 1000);
  const tick = () => {
    const now = hooks.rhythmSongMs ? hooks.rhythmSongMs() : null;
    if (now === null) { if (!document.querySelector('[data-rhythm-play-area]')) { stats.done = true; return; } requestAnimationFrame(tick); return; }
    if (lastTickNow !== null && now - lastTickNow >= BOT_STALL_MS) { stallTimes.push(now); diag.botStalls = (diag.botStalls || 0) + 1; }
    lastTickNow = now;
    while (i < plan.length && plan[i].at <= now) {
      const pl = plan[i++];
      const { n, id } = pl;
      const c = centerOf(n);
      const hab = fingerHabit(c, pl.second);
      const p = fingerAt(c, hab, null, now);
      // 同じ手で押さえている指があれば、近くのノーツを押した勢いでつられて数px動く(すぐ戻る)。反対の手は2割だけ、半分の大きさで
      if (active.some((a) => a.n.type === 'HOLD')) diag.overlaps += 1;
      active.forEach((a) => {
        const same = a.hab.hand === hab.hand;
        if (!human || (!same && rand() > 0.2)) return;
        const toward = Math.sign(c - laneOfHold(a.n, now)) || (rand() < 0.5 ? -1 : 1);
        // つられ方は人によって・そのときによって違う: ふつうは数px、ときどき10px台〜30px台(指数分布で裾が長い)
        const mag = Math.min(P.mag[2], P.mag[0] + -Math.log(1 - rand()) * P.mag[1]) * (same ? 1 : 0.5);
        const cur = driftK(a.drift, now);
        diag.driftEvents += 1; if (mag >= 24) diag.bigDrifts += 1;
        a.drift = { at: now, hold: P.hold[0] + rand() * (P.hold[1] - P.hold[0]), x: (a.drift ? a.drift.x * cur : 0) + latU.x * toward * mag + downU.x * rand() * 6, y: (a.drift ? a.drift.y * cur : 0) + latU.y * toward * mag + downU.y * rand() * 6 };
      });
      fire('pointerdown', id, p);
      taps += 1;
      if (n.type === 'HOLD') { diag.holds += 1; if (c <= 0.5 || c >= RHYTHM_LANE_COUNT - 1.5) diag.edgeHolds += 1; }
      // 前後170ms以内に、2レーン以内で別のノーツが近くにあるときは、押す順番が入れ替わって取りこぼすのは人でも起きる(報告しない)
      const crowded = notes.some((m) => m !== n && Math.abs(m.timeMs - n.timeMs) < 170 && Math.abs(centerOf(m) - c) < 2.2);
      // 遅れて届いた・ポインタが抜けたタッチ(iPhone のくせの再現)は、わざと起こしたもの。その押下と、その前後1秒の押下は、指の見張りの不具合候補に数えない
      // (遅れて届く合図は、ほかの指の合図より後から届くので、ゲームが別の入力として拾い直し、前後のノーツの当たり方まで変わる。2026-10-09 に3つの部で「指が帯の上なのにMISS」として出た)
      const lateMs = lateOf.get(id) || 0, dropped = !!dropOf.get(id);
      if (lateMs > 0 || dropped) lateTimes.push(now);
      const rec = { n, second: !!pl.second, delta: pl.at - n.timeMs, sentDelta: now - n.timeMs, lag: now - pl.at, holding: active.some((a) => a.n.type === 'HOLD' || a.n.type === 'SLIDE'), p, hab, c, crowded, startTaken: false, held: n.type === 'HOLD', at: now, lateMs, dropped };
      if (n.type === 'HOLD' || n.type === 'SLIDE') {
        active.push({ id, n, hab, drift: null, rec, until: (Number(n.endTimeMs) || n.timeMs) + gauss() * sigma * 0.5 });
      } else if (n.type === 'FLICK') {
        // はじく: 少し上(エリアの上。横画面では回った向き)へ素早く動かしてから離す
        // 向きが決まっているフリックは横へ、無ければ上へ
        const fg = real.get(n.index), fdir = fg && fg.flickDir === 'left' ? -1 : fg && fg.flickDir === 'right' ? 1 : 0;
        const at = (d) => (fdir ? { x: p.x + latU.x * fdir * d, y: p.y + latU.y * fdir * d } : { x: p.x + up.x * d, y: p.y + up.y * d });
        setTimeout(() => { fire('pointermove', id, at(30)); fire('pointermove', id, at(70)); fire('pointerup', id, at(70)); }, 25);
      } else {
        setTimeout(() => fire('pointerup', id, p), 45 + rand() * 30);
      }
      if (n.type === 'TAP' || n.type === 'HOLD') pending.push(rec);
    }
    for (let k = active.length - 1; k >= 0; k--) {
      const a = active[k];
      const pos = fingerAt(laneOfHold(a.n, now), a.hab, a.drift, now);
      if (a.n.type === 'SLIDE' || (human && a.drift)) fire('pointermove', a.id, pos);
      a.rec.pos = pos;
      if (a.n.type === 'HOLD') { const bi = bandInfo(a.n, pos); (a.rec.trail = a.rec.trail || []).push({ t: Math.round(now), x: Math.round(pos.x), y: Math.round(pos.y), a: bi.actual === null ? null : +bi.actual.toFixed(2), l: bi.atLine === null ? null : +bi.atLine.toFixed(2) }); if (a.rec.trail.length > 14) a.rec.trail.shift(); }
      if (a.n.type === 'HOLD') {
        // 診断: 指が「押し始めの受付には入るが、指の高さで測ると外れる」帯に120ms以上いた押さえ(ゲームの結果とは別に、指の動きだけで数える)
        const b = bandInfo(a.n, pos);
        const t = typeof rhythmHoldTrackedLane === 'function' ? rhythmHoldTrackedLane(real.get(a.n.index) || a.n, now) : { center: b.center, half: 0.5 };
        const lim = t.half + (typeof rhythmHoldTrackingMarginLanes === 'function' ? rhythmHoldTrackingMarginLanes(t.half * 4) : 0.3);
        const offA = b.actual === null || Math.abs(b.actual - t.center) > lim, offL = b.atLine === null || Math.abs(b.atLine - t.center) > lim;
        if (offA && !offL) { a.bandSince = a.bandSince == null ? now : a.bandSince; if (now - a.bandSince >= 120 && !a.bandCounted) { a.bandCounted = true; a.rec.bandSeen = true; diag.bandHolds += 1; (diag.bandList = diag.bandList || []).push({ sess: (() => { try { const S = [...RHYTHM_GESTURE_RUNTIME._sessions.values()].find((x) => x.note && x.note.index === a.n.index); return S ? { bad: S.trackingBadSincePerf, fin: S.finished, failed: S.failed, kind: S.kind, key: S.key, sx: Math.round(S.startX), sy: Math.round(S.startY) } : null; } catch (e) { return String(e); } })(), pos: { x: Math.round(pos.x), y: Math.round(pos.y) }, lane: a.n.lane, sub: a.n.subLane, w: a.n.subLaneWidth, t: Math.round(a.n.timeMs), now: Math.round(now), started: a.rec.startTaken, hj: (real.get(a.n.index) || {}).holdJudgment, fin: (real.get(a.n.index) || {})._rhythmFinalJudgment, actual: b.actual, atLine: b.atLine, c: t.center, lim }); } } else a.bandSince = null;
      }
      // 終点フリックのあるHOLD/SLIDEは、終わりの少し前に指をはじく(向きが決まっていれば横、無ければ上へ)。はじかないと、指が帯の上でもMISSになる
      const g = real.get(a.n.index);
      let rel = pos;
      if (g && (g.endFlick === true || g.endFlick === 1) && now >= (Number(a.n.endTimeMs) || 0) - 90) {
        const dir = g.flickDir === 'left' ? -1 : g.flickDir === 'right' ? 1 : 0;
        const d = a.flickD = Math.min(60, (a.flickD || 0) + 20);
        rel = dir ? { x: pos.x + latU.x * dir * d, y: pos.y + latU.y * dir * d } : { x: pos.x + up.x * d, y: pos.y + up.y * d };
        fire('pointermove', a.id, rel);
      }
      if (now >= a.until) { fire('pointerup', a.id, rel); active.splice(k, 1); }
    }
    // 見張り: 押した結果をゲームの記録と突き合わせる
    for (let k = pending.length - 1; k >= 0; k--) {
      const r = pending[k], n = r.n, g = real.get(n.index);
      if (!g) continue;
      if (r.held && !r.startTaken && g.holdJudgment && g.holdJudgment !== 'MISS') r.startTaken = true;
      const info = () => bandInfo(n, r.p);
      const hab = { belowPx: Math.round(r.hab.below), latPx: Math.round(r.hab.lat) };
      if (r.held && r.startTaken && g.holdJudgment === 'MISS' && !r.cut && nearLate(r)) { r.cut = true; diag.lateRelated = (diag.lateRelated || 0) + 1; }
      if (r.held && r.startTaken && g.holdJudgment === 'MISS' && !r.cut && nearStall(now - 400, now)) { r.cut = true; diag.botLagged = (diag.botLagged || 0) + 1; }
      if (r.held && r.startTaken && g.holdJudgment === 'MISS' && !r.cut) {
        // 押し始めは取れたのに、押さえている間に切れた。ただし指が本当に帯から外れていたなら(ボットがつられすぎた)、ゲームの不具合ではない。
        // 切れた時点の指が、押し始めの受付と同じ範囲(指の高さの位置・判定ラインの高さに直した位置のどちらか)に入っているときだけ報告する
        r.cut = true;
        const at = r.pos || r.p, b = bandInfo(n, at);
        const t = typeof rhythmHoldTrackedLane === 'function' ? rhythmHoldTrackedLane(g, now) : { center: b.center, half: 0.5 };
        const lim = t.half + (typeof rhythmHoldTrackingMarginLanes === 'function' ? rhythmHoldTrackingMarginLanes(t.half * 4) : 0.3);
        const within = (v) => v !== null && Number.isFinite(v) && Math.abs(v - t.center) <= lim;
        if (within(b.actual) || within(b.atLine)) {
          suspect('HOLDが途中で切れた', n, at, { start: r.startJudgment, startFinger: { x: Math.round(r.p.x), y: Math.round(r.p.y) }, ...hab, band: { actual: b.actual, atLine: b.atLine, center: t.center, half: lim }, drift: !!(active.find((a) => a.rec === r) || {}).drift, trail: r.trail, nowMs: Math.round(now), g: { failed: !!g.failed, apid: g.activePointerId ?? null, rel: g.releasedAtMs ?? null, end: Math.round(g.endTimeMs) } });
        } else diag.fingerLeft += 1;
      }
      if (r.held && g.holdJudgment && g.holdJudgment !== 'MISS' && !r.startJudgment) r.startJudgment = g.holdJudgment;
      if (g.done && g._rhythmFinalJudgment) {
        if (r.bandSeen) (diag.bandResult = diag.bandResult || []).push({ t: Math.round(n.timeMs), hold: g.holdJudgment, fin: g._rhythmFinalJudgment, start: r.startJudgment, end: Math.round(g.endTimeMs), origEnd: Math.round(n.endTimeMs) });
        // タップの取りこぼしの集計(密集した場面も含める)。指が帯の中・時刻もほぼ合っているのにMISSになった数も、密集の有無を分けて数える
        if (n.type === 'TAP') {
          const T = diag.tap, miss = g._rhythmFinalJudgment === 'MISS';
          T.n += 1; if (r.crowded) T.crowdedN += 1; if (r.second) T.secondN += 1;
          if (miss) {
            T.miss += 1; if (r.crowded) T.missCrowded += 1; if (r.second) T.secondMiss += 1;
            const b0 = bandInfo(n, r.p);
            if (Math.abs(r.delta) < 70 && !botLagged(r) && b0.actual !== null && Math.abs(b0.actual - b0.center) <= b0.half) { if (r.crowded) T.missInBandCrowded += 1; else T.missInBand += 1; }
          }
        }
        if (g._rhythmFinalJudgment === 'MISS' && !r.cut && !r.startTaken && !r.crowded && nearLate(r)) diag.lateRelated = (diag.lateRelated || 0) + 1;
        else if (g._rhythmFinalJudgment === 'MISS' && !r.cut && !r.startTaken && !r.crowded && Math.abs(r.delta) < 70 && botLagged(r)) diag.botLagged = (diag.botLagged || 0) + 1;
        else if (g._rhythmFinalJudgment === 'MISS' && !r.cut && !r.startTaken && !r.crowded && Math.abs(r.delta) < 70) {
          const b = info();
          // 指のその場の高さで見て帯の中、と言い切れるときだけ報告する(判定ラインの高さに直した位置だけで入っているときは、受付の細かい決まりしだいなので数えない)
          // その押下でゲームがほかのノーツを取ったか(判定のずれ _rhythmDeltaMs から、当たった時刻が押した時刻に近いノーツを探す)。
          // 取られた先が分かれば「隣に取られた」、どれも無ければ「押下そのものが拾われなかった・控えの指になった」
          const takenBy = [...real.values()].filter((x) => x && x !== g && Number.isFinite(x._rhythmDeltaMs) && Math.abs(x.timeMs + x._rhythmDeltaMs - r.at) <= 40)
            .map((x) => ({ t: Math.round(x.timeMs), idx: x.index, skipped: skippedIdx.has(x.index), lane: x.lane, sub: x.subLane ?? null, type: x._rhythmOriginalType || x.type, d: Math.round(x._rhythmDeltaMs) })).slice(0, 3);
          // わざと見送ったノーツが、次のノーツを狙った押下を受け取った(ゲームの決まり rhythmChooseTapTarget: 前のノーツと次のノーツの間を前へ75%寄せて分ける)。
          // 前を押し損ねて次を少し早く押すと前に取られるのは決まりどおりで、どちらを取っても1つはMISSになる。不具合候補に数えない(2026-10-09 守り部の通信不良の演奏で出た件)
          if (takenBy.some((x) => x.skipped)) diag.skipTaken = (diag.skipTaken || 0) + 1;
          else if (b.actual !== null && Math.abs(b.actual - b.center) <= b.half) suspect('指が帯の上なのにMISS', n, r.p, { delta: Math.round(r.delta), sent: Math.round(r.sentDelta), holding: r.holding, takenBy, ...hab, band: { actual: b.actual, atLine: b.atLine, center: b.center, half: b.half } });
        }
        pending.splice(k, 1);
      }
    }
    stats.taps = taps;
    requestAnimationFrame(tick);
  };
  window.__playbotRhythm = stats;
  requestAnimationFrame(tick);
  return { ok: true, notes: notes.length, planned: plan.length };
}

// 演奏のあいだ、ときどき呼ぶ。ページの中で見つかった「指の不具合候補」を、印が出ているうちに画像つきで報告へ足す
// (1回の演奏で最大3件。final = true は演奏が終わったとき。印はもう消えているので、数字だけで報告する)
async function collectFingerSuspects(s, state, final = false) {
  const list = await s.page.evaluate(() => (window.__playbotRhythm && window.__playbotRhythm.suspects) || []).catch(() => []);
  for (let k = state.seen || 0; k < list.length; k++) {
    state.reported = state.reported || 0;
    if (state.reported >= 3) break;
    const r = list[k];
    state.reported += 1;
    const where = `押した位置(${r.finger.x},${r.finger.y}) 判定ラインより${r.belowPx}px下・横へ${r.latPx}px`;
    const detail = r.kind === 'HOLDが途中で切れた'
      ? `${r.timeMs}msの${r.lane + 1}番目のレーンのHOLDが、押し始め(${r.start})は取れたのに押さえている途中でMISSになった。切れたとき指は受付範囲の中(指の高さの位置 ${r.band.actual === null ? '範囲外' : r.band.actual.toFixed(2)} / 判定ラインの高さに直した位置 ${r.band.atLine === null ? '-' : r.band.atLine.toFixed(2)} / 中心 ${r.band.center.toFixed(2)} ±${r.band.half.toFixed(2)})。${where}${r.drift ? '、近くのノーツを押して指がつられていた' : ''}。押し始めの位置は(${r.startFinger.x},${r.startFinger.y})`
      : `${r.timeMs}msの${r.lane + 1}番目のレーンの${r.type}が、指が受付範囲の中(指の高さの位置 ${r.band.actual === null ? '範囲外' : r.band.actual.toFixed(2)} / 判定ラインの高さに直した位置 ${r.band.atLine === null ? '-' : r.band.atLine.toFixed(2)} / 中心 ${r.band.center.toFixed(2)} ±${r.band.half.toFixed(2)})で時刻も${r.delta}msのずれなのにMISSになった。${where}${r.holding ? '・ほかの指で押さえている最中' : ''}${r.takenBy ? (r.takenBy.length ? `・同じ押下で取れたノーツ ${r.takenBy.map((x) => `${x.t}ms ${x.lane + 1}レーン ${x.type}(ずれ${x.d}ms${x.skipped ? '・ボットがわざと見送ったノーツ' : ''})`).join(' / ')}` : '・同じ押下で取れたノーツは無い') : ''}`;
    await s.addIssue(r.kind, detail, { finger: r });
  }
  state.seen = list.length;
  if (final) state.seen = list.length;
}

// HOME → モンヒロビート → ソロライブ → 曲と難易度を選んだところまで。ランキング係も使う。
// songName / difficulty を渡せばその曲・難易度を、渡さなければ乱数で選ぶ。選べなければ null
// EXPERT は「同じ曲のHARDをクリアしている」(MASTER は EXPERT も)と開く。ボットのブラウザは毎回まっさらなので、HARDのクリアを全曲ぶん手元に書き入れてから起動し直す。
// 書くのは自己ベスト(mh_rhythm_best_v1)へ clear / played だけ。手元のブラウザの中だけの話で、ランキングへは何も送らない
async function unlockHarderCharts(s) {
  const done = await s.page.evaluate(() => {
    if (localStorage.getItem('__playbot_hard_unlocked')) return true;
    const best = {};
    RHYTHM_SONGS.forEach((song) => { best[song.songId] = { HARD: { bestScore: 1, maxCombo: 1, played: true, clear: true }, EXPERT: { bestScore: 1, maxCombo: 1, played: true, clear: true } }; });
    localStorage.setItem('mh_rhythm_best_v1', JSON.stringify(best));
    localStorage.setItem('__playbot_hard_unlocked', '1');
    return false;
  });
  if (!done) await s.boot();
}

async function openSoloLive(s, { songName = '', difficulty = '', harder = false, strict = false } = {}) {
  const { page, rand } = s;
  if (harder || /^(EXPERT|MASTER)$/.test(difficulty)) await unlockHarderCharts(s);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  await s.inspect();
  if (!(await s.tapLabel(/ソロライブ/, 2000))) { await s.addIssue('進めない', 'モンヒロビートの「ソロライブ」が見つからない'); return null; }
  await s.dismissOverlays(6);
  await s.inspect();
  // 一度きりの案内(6レーンになった など)は、人と同じく「×」で閉じてから曲を探す
  for (let k = 0; k < 3 && (await s.tapLabel(/^この案内を閉じる$/, 500)); k++);
  // 曲を1つ選ぶ(一覧のカードは「Lv.」を含む)。★小さい画面では一覧が下に隠れているので、見えるところまで送る
  let songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label));
  if (!songs.length) {
    await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /Lv\.\s*\d+/.test(x.innerText || '') && !/大きく見る/.test(x.getAttribute('aria-label') || '')); if (b) b.scrollIntoView({ block: 'center' }); });
    await s.wait(400);
    songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label));
  }
  let picked;
  if (!songs.length) {
    // 曲の一覧が見えない。決定が押せるなら、選ばれている曲のまま進める(人もそうするしかない)
    const vp = s.page.viewportSize();
    const canGo = (await s.listButtons()).some((b) => /^(▶\s*)?決定$/.test(b.label));
    await s.addIssue(canGo ? '曲の一覧が見えない' : '進めない', canGo
      ? `画面 ${vp.width}×${vp.height} の曲えらびで、曲の一覧が1行も見えない(上の吹き出しと下の曲の詳細で埋まる)。選ばれている曲か「ランダム」しか選べない`
      : '曲えらびに曲が出ていない');
    if (!canGo) return null;
    picked = { song: '(選ばれていた曲)', difficulty: '' };
  } else {
    // 曲名が決まっているのに、いまの画面に見えていなければ、その曲のカードまで送ってから探す(見えている曲だけから選ぶと、別の曲を遊んでしまう)
    if (songName && !songs.find((b) => b.label.startsWith(songName))) {
      const scrolled = await s.page.evaluate((name) => {
        const norm = (t) => (t || '').replace(/\s+/g, ' ').trim();
        const b = [...document.querySelectorAll('button')].find((x) => /Lv\.\s*\d+/.test(x.innerText || '') && !/大きく見る|お気に入り/.test(x.getAttribute('aria-label') || '') && norm(x.innerText).startsWith(name));
        if (!b) return false;
        b.scrollIntoView({ block: 'center' });
        return true;
      }, songName);
      if (scrolled) { await s.wait(400); songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label)); }
    }
    const named = songName && songs.find((b) => b.label.startsWith(songName));
    if (songName && !named && strict) { await s.addIssue('進めない', `曲えらびに「${songName}」が見つからない`); return null; }
    const song = named || songs[Math.floor(rand() * songs.length)];
    await s.tap(song, '曲を選ぶ');
    picked = { song: song.label.replace(/\s*Lv\..*$/, ''), difficulty: '' };
  }
  // 小さい画面では難易度と「決定」が下に隠れていることがある。見えるところまで送る
  await s.page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(▶\s*)?決定$/.test((x.innerText || '').trim())); if (b) b.scrollIntoView({ block: 'end' }); });
  await s.wait(300);
  // 難易度は EASY〜HARD から(人は最初から最難関を選ばない)
  // harder = true のときは、EXPERT・MASTER から選ぶ(HOLDの途中でほかのノーツを押す譜面も、タップの取りこぼしも、高難易度に多い。指のくせの見張り用)
  const allDiffs = (await s.listButtons()).filter((b) => /(EASY|NORMAL|HARD|EXPERT|MASTER)/.test(b.label) && b.h < 90);
  const pool = harder ? (allDiffs.some((x) => /(EXPERT|MASTER)/.test(x.label)) ? /(EXPERT|MASTER)/ : /(HARD)/) : /(EASY|NORMAL|HARD)/;
  const diffs = allDiffs.filter((b) => pool.test(b.label));
  const d = (difficulty && allDiffs.find((b) => b.label.includes(difficulty))) || diffs[Math.floor(rand() * diffs.length)] || allDiffs.find((b) => /(EASY|NORMAL|HARD)/.test(b.label));
  if (d) { await s.tap(d, '難易度を選ぶ'); picked.difficulty = (d.label.match(/EASY|NORMAL|HARD|EXPERT|MASTER/) || [''])[0]; }
  await s.inspect();
  return picked;
}

async function rhythmScenario(s, { maxSongMs = 330000 } = {}) {
  const { page, rand } = s;
  const stats = { song: '', difficulty: '', notes: 0, result: null };
  // 試すとき: PLAYBOT_SONG=曲名の先頭 PLAYBOT_DIFFICULTY=EXPERT のように決められる(指の見張りが見つけられるかの確認用)
  const picked = await openSoloLive(s, { songName: process.env.PLAYBOT_SONG || '', difficulty: process.env.PLAYBOT_DIFFICULTY || '', harder: true });
  if (!picked) return { ok: false, stats };
  Object.assign(stats, picked);
  const started = await s.tapLabel(/^(▶\s*)?(決定|START|スタート|演奏する|演奏開始|PLAY|はじめる)$/i, 2500);
  if (!started) { await s.addIssue('進めない', '曲えらびから演奏を始めるボタンが見つからない', { buttons: (await s.listButtons()).map((b) => b.label).slice(0, 30) }); return { ok: false, stats }; }
  await s.dismissOverlays(4);
  // 演奏画面が出て、参照が使えるまで待つ
  const ready = await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', '演奏画面が開かない'); return { ok: false, stats }; }
  await s.inspect();
  const installed = await page.evaluate(installPlayer, installArgs(s));
  if (!installed.ok) { await s.addIssue('進めない', `演奏できない: ${installed.why}`); return { ok: false, stats }; }
  stats.notes = installed.notes;
  // 終わるまで見守る。途中で1回だけスクショ
  const t0 = Date.now();
  let shotTaken = false;
  const fingers = {};
  while (Date.now() - t0 < maxSongMs) {
    await s.wait(2000);
    s.state.step += 1;
    await collectFingerSuspects(s, fingers);
    const inPlay = await page.evaluate(() => !!document.querySelector('[data-rhythm-play-area]') && !/RESULT|リザルト/.test(document.body.innerText.slice(0, 400)));
    if (!shotTaken && Date.now() - t0 > 20000) { await s.shot('rhythm-playing'); shotTaken = true; }
    const h = await s.health();
    if (h && /RESULT|SCORE|スコア/.test(h.text) && /MARVELOUS|EXCELLENT|GREAT|GOOD|MISS/.test(h.text) && !(await page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null)))) break;
    if (!inPlay) break;
  }
  await s.wait(2500);
  await collectFingerSuspects(s, fingers, true);
  const resultText = ((await s.health()) || {}).text || '';
  const pick = (re) => { const m = resultText.replace(/\s+/g, ' ').match(re); return m ? m[1] : null; };
  stats.result = {
    score: pick(/SCORE\s*([\d,]+)/i) || pick(/スコア\s*([\d,]+)/),
    justMarvelous: pick(/JUST MARVELOUS\s*(\d+)/), marvelous: pick(/(?<!JUST )MARVELOUS\s*(\d+)/), excellent: pick(/EXCELLENT\s*(\d+)/), great: pick(/GREAT\s*(\d+)/),
    good: pick(/GOOD\s*(\d+)/), bad: pick(/BAD\s*(\d+)/), miss: pick(/MISS\s*(\d+)/),
    maxCombo: pick(/MAX COMBO\s*(\d+)/), fast: pick(/FAST\s*(\d+)/), slow: pick(/SLOW\s*(\d+)/),
  };
  stats.bot = await page.evaluate(() => window.__playbotRhythm || null);
  // ゲーム側の数え(遅れすぎた入力を本当の遅れで選び直した回数など)。古い版のゲームには無いので null
  stats.timing = await page.evaluate(() => { try { const t = RHYTHM_TIMING_DIAG.snapshot(); return { matchByAge: t.matchByAge ?? null, ageCapped: t.ageCapped ?? null, ageBacked: t.ageBacked ?? null, ageUnbacked: t.ageUnbacked ?? null }; } catch { return null; } }).catch(() => null);
  await s.shot('rhythm-result');
  await s.inspect();
  if (Date.now() - t0 >= maxSongMs) await s.addIssue('進行停止', `演奏が${Math.round(maxSongMs / 1000)}秒たっても終わらない`);
  // 結果のあとは曲えらびへ戻るだけ。ランキングに自分が載って見えるかはランキング係が見る
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(曲えらびへ(戻る)?|曲選択へ|もどる|戻る|OK|閉じる|次へ)$/, 1500))) break; }
  const sent = s.supabase.writes.filter((w) => w.table === 'rankings').length;
  return { ok: true, stats, note: `${stats.song} ${stats.difficulty}・${stats.notes}ノーツ → スコア ${stats.result.score || '?'}(ランキングへ送った記録 ${sent}件・横取り済み)・指のくせ ${stats.bot && stats.bot.who}・左手${stats.bot && stats.bot.habit ? stats.bot.habit[0].depth : '?'}/右手${stats.bot && stats.bot.habit ? stats.bot.habit[1].depth : '?'}(下へ押す深さ)・MISS ${stats.result.miss || '?'}・押さえた${stats.bot && stats.bot.diag ? stats.bot.diag.holds : '?'}回(端のレーン${stats.bot && stats.bot.diag ? stats.bot.diag.edgeHolds : '?'}回)のうち指が帯の外へ出た${stats.bot && stats.bot.diag ? stats.bot.diag.bandHolds : '?'}回(指が本当に外れて切れた${stats.bot && stats.bot.diag ? stats.bot.diag.fingerLeft : '?'}回・同時押し${stats.bot && stats.bot.diag ? stats.bot.diag.overlaps : '?'}回・つられた${stats.bot && stats.bot.diag ? stats.bot.diag.driftEvents : '?'}回・24px以上${stats.bot && stats.bot.diag ? stats.bot.diag.bigDrifts : '?'}回)${process.env.PLAYBOT_DEBUG && stats.bot && stats.bot.diag ? ' ' + JSON.stringify({ b: stats.bot.diag.bandList || [] }) : ''}${stats.bot && stats.bot.diag && stats.bot.diag.byType ? '・種類別MISS ' + Object.entries(stats.bot.diag.byType).map(([t, e]) => `${t} ${e.miss}/${e.n}`).join(' ') : ''}・指の合図 ${stats.bot && stats.bot.input ? `${stats.bot.input.mode}(押した${stats.bot.input.downs}回・ポインタ抜け${stats.bot.input.dropped}・遅れて届いた${stats.bot.input.late}${stats.bot.diag && stats.bot.diag.botStalls ? `・ボットの1コマが100ms以上止まった${stats.bot.diag.botStalls}回・その巻き添え${stats.bot.diag.botLagged || 0}` : ''}${stats.bot.diag && stats.bot.diag.skipTaken ? `・わざと見送ったノーツに次の押下を取られた${stats.bot.diag.skipTaken}` : ''})` : '?'}・タップ${stats.bot && stats.bot.diag ? stats.bot.diag.tap.n : '?'}個のMISS ${stats.bot && stats.bot.diag ? stats.bot.diag.tap.miss : '?'}(密集 ${stats.bot && stats.bot.diag ? stats.bot.diag.tap.missCrowded + '/' + stats.bot.diag.tap.crowdedN : '?'}・指が帯の中なのに ${stats.bot && stats.bot.diag ? stats.bot.diag.tap.missInBand + stats.bot.diag.tap.missInBandCrowded : '?'})・指の不具合候補 ${stats.bot && stats.bot.suspects ? stats.bot.suspects.length : '?'}件${stats.timing ? `・ゲームの数え(遅れすぎて抑えた${stats.timing.ageCapped}・本当の遅れで選び直した${stats.timing.matchByAge})` : ''}` };
}

module.exports = { rhythmScenario, openSoloLive, unlockHarderCharts, installPlayer, installArgs, collectFingerSuspects, SIGMA_MS, MISS_RATE };

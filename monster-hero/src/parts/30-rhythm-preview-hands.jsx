// ===== オプションの「▶ 見てみる」で、見本の譜面を自動で叩く手(2026-11-11 社長「現在の設定での画面が分からないから見れるようにしたい」) =====
// 本物の演奏画面へ、ふつうの指と同じポインタの合図(pointerdown・pointermove・pointerup)を送るだけ。判定・譜面・音の同期には触らない
// (プレイボットの「理想の人の手」tools/playbot/rhythm-ideal-hands.js と同じ叩き方を、見本の短い譜面向けに小さくしたもの)。
//   タップ … 時刻ちょうどに押して 40ms で離す / フリック … 押して上(向きのあるものはその向き)へ払う
//   ホールド・スライド … 押さえたまま帯をなぞり、終わりで離す(終点フリックは終わりで上へ払う)
// 使うのは見本(from:'preview')の演奏だけ。曲の時刻は演奏画面の読み取り口(window.__mhTestHooks.rhythmSongMs)から読む。
// 返す stop() で止める(画面を閉じたとき・流し直すとき)。
const rhythmPreviewHandsStart = (area) => {
  if (typeof window === 'undefined' || !area) return () => {};
  const hooks = () => window.__mhTestHooks || {};
  let stopped = false, raf = 0, k = 0, ids = 900;
  const timers = new Set();
  const later = (ms, fn) => { const id = setTimeout(() => { timers.delete(id); if (!stopped) fn(); }, Math.max(0, ms)); timers.add(id); };
  const lineR = () => (typeof RHYTHM_JUDGMENT_LINE_Y !== 'undefined' ? RHYTHM_JUDGMENT_LINE_Y.ratio : 0.82);
  const rectOf = () => (typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.rectOf ? RHYTHM_VIEW_ROTATION.rectOf(area) : area.getBoundingClientRect());
  // 演奏画面が回してある(🔄横)ときは、回した器の中の座標を、画面の座標へ戻して送る
  const toClient = (x, y) => { if (typeof RHYTHM_VIEW_ROTATION !== 'undefined' && RHYTHM_VIEW_ROTATION.unpoint) { const c = RHYTHM_VIEW_ROTATION.unpoint(x, y); return { x: c.clientX, y: c.clientY }; } return { x, y }; };
  const pt = (c, sky) => { const r = rectOf(); const lr = lineR(); const lift = sky > 0 && typeof RHYTHM_SKY_LIFT !== 'undefined' ? RHYTHM_SKY_LIFT.ratio * sky : 0;
    return { x: r.left + r.width * rhythmProjectBoundary(c, lr), y: r.top + r.height * (lr - lift) }; }; // 器の中の座標(払う向きもこの座標で足す)
  const spanAt = (n, t) => {
    if (rhythmNoteIsSlide(n)) return { c: rhythmSlideExpectedLane(n, t) + 0.5, sky: rhythmSlideHasSky(n) ? rhythmSlideSkyAt(n, t) : 0 };
    const sky = rhythmNoteSkyHeight(n);
    if (n.subLane != null && Number.isFinite(Number(n.subLane))) {
      const sp = rhythmNoteHasHoldPoints(n) ? rhythmHoldSpanAt(n, t) : { subLane: Number(n.subLane), subLaneWidth: Number(n.subLaneWidth) || 2 };
      return { c: (sp.subLane + sp.subLaneWidth / 2) / 2, sky };
    }
    return { c: (Number(n.lane) || 0) + 0.5, sky };
  };
  const posOf = (n, t) => { const s = spanAt(n, t); return pt(s.c, s.sky); };
  const send = (type, id, p) => {
    const c = toClient(p.x, p.y);
    try { area.dispatchEvent(new window.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse', isPrimary: false, clientX: c.x, clientY: c.y, buttons: type === 'pointerup' ? 0 : 1 })); } catch (_) {}
  };
  const notes = (() => { try { return ((hooks().rhythmNotes && hooks().rhythmNotes()) || []).slice().sort((a, b) => a.timeMs - b.timeMs); } catch (_) { return []; } })();
  const isLong = n => (n.type === 'HOLD' || n.type === 'SLIDE') && Number(n.endTimeMs) > Number(n.timeMs);
  const flickVec = n => { const d = typeof rhythmFlickDir === 'function' ? rhythmFlickDir(n) : ''; return d === 'left' ? [-1, 0] : d === 'right' ? [1, 0] : [0, -1]; };
  const events = [], follows = [];
  for (const n of notes) {
    const t = Number(n.timeMs), id = ++ids;
    if (isLong(n)) {
      const e = Number(n.endTimeMs), fo = { id, n, from: t, until: n.endFlick === true ? e - 40 : e - 5, on: false };
      follows.push(fo);
      events.push({ at: t, f: () => { fo.on = true; send('pointerdown', id, posOf(n, t)); } });
      if (n.endFlick === true) {
        events.push({ at: e - 40, f: () => { fo.on = false; const q = posOf(n, e); send('pointermove', id, { x: q.x, y: q.y - 30 }); } });
        events.push({ at: e - 20, f: () => { const q = posOf(n, e); send('pointermove', id, { x: q.x, y: q.y - 70 }); } });
        events.push({ at: e, f: () => { const q = posOf(n, e); send('pointerup', id, { x: q.x, y: q.y - 70 }); } });
      } else events.push({ at: e - 5, f: () => { fo.on = false; send('pointerup', id, posOf(n, e)); } });
    } else if (n.type === 'FLICK') {
      const v = flickVec(n);
      events.push({ at: t, f: () => send('pointerdown', id, posOf(n, t)) });
      events.push({ at: t + 25, f: () => { const p = posOf(n, t); send('pointermove', id, { x: p.x + v[0] * 30, y: p.y + v[1] * 30 }); } });
      events.push({ at: t + 45, f: () => { const p = posOf(n, t); send('pointermove', id, { x: p.x + v[0] * 60, y: p.y + v[1] * 60 }); } });
      events.push({ at: t + 46, f: () => { const p = posOf(n, t); send('pointerup', id, { x: p.x + v[0] * 60, y: p.y + v[1] * 60 }); } });
    } else {
      events.push({ at: t, f: () => send('pointerdown', id, posOf(n, t)) });
      events.push({ at: t + 40, f: () => send('pointerup', id, posOf(n, t)) });
    }
  }
  events.sort((a, b) => a.at - b.at);
  const tick = () => {
    if (stopped) return;
    const ms = hooks().rhythmSongMs ? hooks().rhythmSongMs() : null;
    if (ms != null) {
      while (k < events.length && events[k].at <= ms + 17) { const ev = events[k++]; const wait = ev.at - ms; if (wait > 1) later(wait, ev.f); else ev.f(); }
      for (const f of follows) if (f.on && ms > f.from && ms < f.until) send('pointermove', f.id, posOf(f.n, ms));
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => { stopped = true; if (raf) cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.clear(); };
};

#!/usr/bin/env node
// iPhone 特有の「指の合図のくせ」を作り物として流し、空中スライドの最中に別の指で地上を叩いたとき、空中スライドが外れる形を総当たりで探す
// (2026-10-15・窓口「空スライド中に別の指で地上タップ/フリックをすると空スライドが外れる経路を洗い出す」・修理部とビート部の分担)。
//
//   node tools/playbot/rhythm-touch-quirk-fuzz.js --song sheriruth --diff HELL               全部のくせを流す(1回の演奏で、空中スライドごとに1つずつ)
//   node tools/playbot/rhythm-touch-quirk-fuzz.js --song sheriruth --diff HELL --list        対象にできる空中スライドと地上ノーツの組だけを出す
//   node tools/playbot/rhythm-touch-quirk-fuzz.js ... --only touches-drop,cancel-ground      流すくせを絞る(--repeat 2 で同じくせを2つの組に流す)
//   node tools/playbot/rhythm-touch-quirk-fuzz.js ... --out <結果.json>                       結果を書き出す
//
// 指1が空中スライドをなぞり(判定ラインの高さでの横の位置のまま、高さだけ上げる・rhythm-two-finger-sky-repro.js と同じ)、
// 指2が空中スライドの最中にある地上のノーツを叩く。そのとき、下のくせを1つだけ混ぜる。CDP のタッチは Chromium が辻褄の合った合図しか作らないので、
// 合図はページの中で TouchEvent / PointerEvent を組み立てて演奏面へ送る(tools/playbot/lib/touch-input.js と同じ作り方)。
// くせを混ぜない組(none)も必ず流し、その組で空中スライドが取れていることを「土台が正しい」ことの確かめにする。
//
// 結果は組ごとに: 空中スライドの判定(押し始め・離し)・暗くなった時間(切れていたコマ)・地上ノーツの判定。
// 「none では取れているのに、くせを混ぜると空中スライドが切れる」ものが、iPhone で外れる経路の候補。
const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '../..');
const arg = (name, fallback = null) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback; };
const SONG = arg('song', 'sheriruth'), DIFF = arg('diff', 'HELL'), OUT = arg('out');
const LIST = process.argv.includes('--list');
const REPEAT = Math.max(1, Number(arg('repeat', 1)) || 1);
const ONLY = String(arg('only', '')).split(',').filter(Boolean);
const TAPDX = Number(arg('tapdx', 0)) || 0;
const SKIP = Math.max(0, Number(arg('skip', 0)) || 0);   // くせの列の先頭からいくつ飛ばすか(組が足りないとき、2回目以降の演奏で残りを流す)
const VERBOSE = process.argv.includes('--verbose');

// ---- くせの一覧(名前 → 何をするか)。ページの中の runner が名前で分岐する ----
const QUIRKS = [
  ['none', 'くせなし(土台の確かめ)'],
  ['end-extra-changed', '地上の指を離す touchend の changedTouches に、離していない空中の指まで入っている(touches は正しい)'],
  ['touches-drop-on-end', '地上の指を離す touchend の touches から空中の指が抜けている(次の touchmove では戻る)'],
  ['touches-drop-on-start', '地上の指の touchstart の touches に空中の指が入っていない(次の touchmove では戻る)'],
  ['touches-drop-move', '空中の指の touchmove の途中で1回だけ touches が空(次では戻る)'],
  ['touches-dup', '地上の指の touchstart の touches に空中の指が2回入っている'],
  ['start-end-same-frame', '地上の指の touchstart と touchend が同じコマに続けて届く'],
  ['late-ground-start', '地上の指の touchstart が 80ms 遅れて届く(timeStamp は押した時刻)'],
  ['pointer-only-ground', '地上の指は pointer だけ届き、touch が届かない'],
  ['pointer-late-ground', '地上の指の pointerdown/up が touch より 60ms 遅れて届く'],
  ['pointer-up-sky', '空中の指の pointerup だけが地上の指を離したときに届く(touch は押したまま)'],
  ['cancel-ground', '地上の指だけ touchcancel(touches には空中の指が残る)'],
  ['cancel-all-resume', 'touchcancel で全部の指が消え、そのあとも空中の指の touchmove が同じ id で届く'],
  ['id-reuse-sky', '地上の指が、空中の指と同じ identifier で touchstart する'],
  ['id-reuse-recent', '地上の指が、直前に離した別の指の identifier で touchstart する'],
  ['move-changed-ground', '空中の指の touchmove の changedTouches に、動いていない地上の指まで入っている'],
  ['cancel-sky-restart', '空中の指だけ touchcancel され、30ms あとに同じ指が新しい identifier で押し直して続ける'],
  ['cancel-all-restart', '地上の指を離すとき touchcancel で全部の指が消え、30ms あとに空中の指が新しい identifier で押し直して続ける'],
  ['end-sky-restart', '空中の指に touchend が来て(押したまま)、30ms あとに新しい identifier で押し直して続ける'],
];
// --sweep: くせの代わりに「指の位置」をずらす(2026-10-15 窓口「地上の指を空中の帯の真下〜少し上まで・空中の指の高さを上下に」)。
//   pos:<gy>:<gx>:<sk> … 地上の指の高さ gy(0 = 判定ライン、1 = その時刻の空中スライドの高さ)、
//                        横 gx(0 = 地上ノーツの中心、1 = その時刻の空中スライドの真下)、空中の指の高さ sk(空中の段の何倍か)
const SWEEP = process.argv.includes('--sweep');
const SWEEP_NAMES = (() => {
  const out = [];
  for (const gy of [0, .15, .3, .45, .6, .8]) for (const gx of [0, .5, 1]) out.push(`pos:${gy}:${gx}:1`);
  for (const sk of [.6, .8, 1.2, 1.4]) for (const gx of [0, 1]) out.push(`pos:0:${gx}:${sk}`);
  return out;
})();
const QUIRK_NAMES = SWEEP ? ['none', ...SWEEP_NAMES] : QUIRKS.map(([n]) => n).filter((n) => !ONLY.length || n === 'none' || ONLY.includes(n));

const mime = f => ({ '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(f)] || 'application/octet-stream';
const seed = () => `(() => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_intro_done', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_quick_rhythm_intro_seen_v1', true); put('mh_quick_rhythm_bg_seen_v1', true);
  put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  localStorage.setItem('mh_rhythm_input_rec_v1', 'on');
})()`;

// ---- ページの中で動く本体。くせの名前ごとに合図を組み立てる ----
const runner = async ([songId, quirkNames, repeat, listOnly, tapdx, skip]) => {
  const area = document.querySelector('[data-rhythm-play-area]');
  const notes = window.__mhTestHooks.rhythmNotes();
  const chart = RHYTHM_HELL_CHARTS[songId];
  if (!chart) return { error: `HELL の譜面が無い: ${songId}` };
  const cn = (i) => chart.notes[i];
  const rect = () => RHYTHM_VIEW_ROTATION.rectOf(area);
  const lineR = () => RHYTHM_JUDGMENT_LINE_Y.ratio;
  const ptLane = (laneCenter, sky) => { const rr = rect(); const yR = lineR() - (sky > 0 ? RHYTHM_SKY_LIFT.ratio * sky : 0); return { x: rr.left + rr.width * rhythmProjectBoundary(laneCenter, lineR()), y: rr.top + rr.height * yR }; };
  const slidePos = (sc, t, mul = 1) => { const L = rhythmSlideExpectedLane(sc, t); const sky = rhythmSlideHasSky(sc) ? rhythmSlideSkyAt(sc, t) : 0; return ptLane(L + .5, sky * mul); };

  // 組: 空中スライド(600ms 以上)と、その最中(頭から 200ms あと〜終わりの 200ms 前)にある地上のタップ/フリック1つ。
  // 前の組の空中スライドが終わって 400ms 空いてから次の組(指が混ざらないように)
  const pairs = [];
  let freeAt = 0;
  notes.forEach((n, i) => {
    const sc = cn(i);
    if (!sc || n.type !== 'SLIDE' || !rhythmSlideHasSky(sc) || !(n.endTimeMs - n.timeMs >= 600) || n.timeMs < freeAt) return;
    const g = notes.find((m) => (m.type === 'TAP' || m.type === 'FLICK') && !(m.skyHeight > 0) && m.timeMs >= n.timeMs + 200 && m.timeMs <= n.endTimeMs - 200);
    if (!g) return;
    pairs.push({ slide: i, ground: g.index, start: n.timeMs, end: n.endTimeMs, groundType: g.type });
    freeAt = n.endTimeMs + 400;
  });
  if (listOnly) return { pairs };
  // くせを組へ割り当てる。none は最初と、くせ4つごとに1回はさむ(土台がずっと正しいかを見る)
  const plan = [];
  const queue = [];
  quirkNames.filter((q) => q !== 'none').forEach((q) => { for (let r = 0; r < repeat; r++) queue.push(q); });
  let k = skip;
  for (const p of pairs) {
    const q = (plan.length % 5 === 0) ? 'none' : queue[k++];
    if (!q) break;
    plan.push({ ...p, quirk: q });
  }
  const left = queue.slice(k);

  // ---- 浮き(押さえている指が離れたとみなされ、帯が暗くなる)を直接見張る。記録の出来事に出ない浮きも拾う ----
  const floats = [];
  const origAdd = RHYTHM_FLOATING_NOTES.add.bind(RHYTHM_FLOATING_NOTES);
  RHYTHM_FLOATING_NOTES.add = (note) => { try { floats.push({ index: note?.index, ms: Math.round(window.__mhTestHooks.rhythmSongMs() || 0) }); } catch (_) {} return origAdd(note); };
  // ---- 指の合図(touch-input.js と同じ作り方に、くせを入れられるようにしたもの) ----
  const live = new Map();
  const mkTouch = (id, p) => new Touch({ identifier: id, target: area, clientX: p.x, clientY: p.y, pageX: p.x, pageY: p.y, screenX: p.x, screenY: p.y, radiusX: 18, radiusY: 18, force: 1 });
  const touchList = (extra = {}) => { const m = new Map(live); if (extra.drop) extra.drop.forEach((id) => m.delete(id)); const list = [...m.entries()].map(([id, p]) => mkTouch(id, p)); if (extra.dup) extra.dup.forEach((id) => { if (live.has(id)) list.push(mkTouch(id, live.get(id))); }); return list; };
  const fire = (type, changed, opts = {}) => { const touches = touchList(opts); area.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: changed })); };
  const ptr = (type, id, p) => area.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: false, clientX: p.x, clientY: p.y, width: 36, height: 36, pressure: type === 'pointerup' || type === 'pointercancel' ? 0 : .5, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 }));
  const down = (id, p, o = {}) => { live.set(id, p); if (!o.noPointer) ptr('pointerdown', id, p); if (!o.noTouch) fire('touchstart', [mkTouch(id, p)], o); };
  const move = (id, p, o = {}) => { live.set(id, p); if (!o.noPointer) ptr('pointermove', id, p); const changed = [mkTouch(id, p), ...(o.extraChanged || []).filter((x) => live.has(x)).map((x) => mkTouch(x, live.get(x)))]; fire('touchmove', changed, o); };
  const up = (id, p, o = {}) => { live.delete(id); if (!o.noPointer) ptr('pointerup', id, p); if (!o.noTouch) { const changed = [mkTouch(id, p), ...(o.extraChanged || []).filter((x) => live.has(x)).map((x) => mkTouch(x, live.get(x)))]; fire(o.cancel ? 'touchcancel' : 'touchend', changed, o); } };

  // ---- 組ごとの出来事の列 ----
  const events = [];
  const at = (t, f) => events.push({ at: t, f });
  let idBase = 10;
  for (const p of plan) {
    const s = notes[p.slide], sc = cn(p.slide), g = notes[p.ground];
    const F1 = idBase++, F2 = idBase++, F3 = idBase++;
    p.ids = [F1, F2];
    let gp = ptLane((g.subLane + (g.subLaneWidth || 2) / 2) / 2 + tapdx, 0);
    if (String(p.quirk).startsWith('pos:')) {
      const [, gy, gx, sk] = p.quirk.split(':').map(Number);
      p.skMul = sk;
      const above = slidePos(sc, g.timeMs, 1);   // 空中スライドのその時刻の位置(高さはふつう)
      gp = { x: gp.x + (above.x - gp.x) * gx, y: gp.y + (above.y - gp.y) * gy };
      p.groundAt = { x: Math.round(gp.x), y: Math.round(gp.y) };
      const c = (g.subLane + (g.subLaneWidth || 2) / 2) / 2, rr = rect();
      const laneW = rr.width * (rhythmProjectBoundary(c + .5, lineR()) - rhythmProjectBoundary(c - .5, lineR()));
      p.offLanes = Math.round((gp.x - ptLane(c, 0).x) / laneW * 100) / 100;
      p.halfWidth = (g.subLaneWidth || 2) / 4;   // ノーツの幅の半分(レーン)
    }
    p.follow = { from: s.timeMs, to: s.endTimeMs - 5, id: F1, sc, cut: null };
    at(s.timeMs, () => down(F1, slidePos(sc, s.timeMs, p.skMul || 1)));
    const gDown = g.timeMs, gUp = g.timeMs + 60;
    const gFlick = g.type === 'FLICK';
    const gUpPos = gFlick ? { x: gp.x, y: gp.y - 60 } : gp;
    const groundMoves = () => { if (gFlick) { at(gDown + 25, () => move(F2, { x: gp.x, y: gp.y - 30 })); at(gDown + 45, () => move(F2, { x: gp.x, y: gp.y - 60 })); } };
    switch (p.quirk) {
      case 'none': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos)); break;
      default: if (String(p.quirk).startsWith('pos:')) { at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos)); } break;
      case 'end-extra-changed': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos, { extraChanged: [F1] })); break;
      case 'touches-drop-on-end': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos, { drop: [F1] })); break;
      case 'touches-drop-on-start': at(gDown, () => down(F2, gp, { drop: [F1] })); groundMoves(); at(gUp, () => up(F2, gUpPos)); break;
      case 'touches-drop-move': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos)); p.follow.dropAt = gDown + 30; break;
      case 'touches-dup': at(gDown, () => down(F2, gp, { dup: [F1] })); groundMoves(); at(gUp, () => up(F2, gUpPos)); break;
      case 'start-end-same-frame': at(gDown, () => { down(F2, gp); up(F2, gUpPos); }); break;
      case 'late-ground-start': {
        // timeStamp は作った時刻のまま、80ms あとに届ける
        at(gDown, () => { live.set(F2, gp); ptr('pointerdown', F2, gp); const touches = touchList(); const ev = new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [mkTouch(F2, gp)] }); setTimeout(() => area.dispatchEvent(ev), 80); });
        at(gUp + 90, () => up(F2, gUpPos)); break;
      }
      case 'pointer-only-ground': at(gDown, () => down(F2, gp, { noTouch: true })); at(gUp, () => up(F2, gUpPos, { noTouch: true })); break;
      case 'pointer-late-ground': at(gDown, () => down(F2, gp, { noPointer: true })); groundMoves(); at(gUp, () => up(F2, gUpPos, { noPointer: true })); at(gDown + 60, () => ptr('pointerdown', F2, gp)); at(gUp + 60, () => ptr('pointerup', F2, gUpPos)); break;
      case 'pointer-up-sky': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => { up(F2, gUpPos); ptr('pointerup', F1, live.get(F1)); }); break;
      case 'cancel-ground': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => up(F2, gUpPos, { cancel: true })); break;
      case 'cancel-all-resume': at(gDown, () => down(F2, gp)); groundMoves(); at(gUp, () => { const all = [...live.entries()].map(([id, q]) => mkTouch(id, q)); [...live.keys()].forEach((id) => ptr('pointercancel', id, live.get(id))); live.clear(); area.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: all })); live.set(F1, slidePos(sc, gUp)); }); break;
      case 'id-reuse-sky': at(gDown, () => { live.set(F1, live.get(F1)); ptr('pointerdown', F1 + 1000, gp); const touches = [...touchList(), mkTouch(F1, gp)]; area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [mkTouch(F1, gp)] })); });
        at(gUp, () => { ptr('pointerup', F1 + 1000, gp); const touches = touchList(); area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches, targetTouches: touches, changedTouches: [mkTouch(F1, gp)] })); }); break;
      case 'id-reuse-recent': {
        // 指3が地上(空いている所)を軽く叩いて離した直後に、地上の指が同じ id で押す
        const other = ptLane(g.lane < 3 ? 5.5 : .5, 0);
        at(gDown - 70, () => down(F3, other)); at(gDown - 20, () => up(F3, other));
        at(gDown, () => down(F3, gp)); groundMoves(); at(gUp, () => up(F3, gUpPos)); p.ids = [F1, F3]; break;
      }
      case 'cancel-sky-restart':
      case 'cancel-all-restart':
      case 'end-sky-restart': {
        const F4 = idBase++;
        at(gDown, () => down(F2, gp)); groundMoves();
        if (p.quirk === 'cancel-all-restart') {
          at(gUp, () => { const all = [...live.entries()].map(([id, q]) => mkTouch(id, q)); [...live.keys()].forEach((id) => ptr('pointercancel', id, live.get(id))); live.clear(); area.dispatchEvent(new TouchEvent('touchcancel', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: all })); p.follow.id = null; });
        } else {
          at(gUp, () => up(F2, gUpPos));
          at(gDown + 20, () => { const q = live.get(F1); p.follow.id = null; up(F1, q, { cancel: p.quirk === 'cancel-sky-restart' }); });
        }
        const back = p.quirk === 'cancel-all-restart' ? gUp + 30 : gDown + 50;
        at(back, () => { down(F4, slidePos(sc, back)); p.follow.id = F4; });
        p.ids = [F1, F2, F4]; p.restartId = F4;
        break;
      }
      case 'move-changed-ground': at(gDown, () => down(F2, gp)); groundMoves(); p.follow.extraChangedFrom = gDown + 5; p.follow.extraChangedTo = gUp - 5; p.follow.extra = F2; at(gUp, () => up(F2, gUpPos)); break;
    }
    const endFlick = !!(sc.endFlick || s.endFlick);
    if (endFlick) {
      at(s.endTimeMs - 40, () => { p.follow.flick = true; const q = slidePos(sc, s.endTimeMs); move(p.follow.id ?? F1, { x: q.x, y: q.y - 30 }); });
      at(s.endTimeMs - 20, () => { const q = slidePos(sc, s.endTimeMs); move(p.follow.id ?? F1, { x: q.x, y: q.y - 70 }); });
      at(s.endTimeMs, () => { const q = slidePos(sc, s.endTimeMs); up(p.follow.id ?? F1, { x: q.x, y: q.y - 70 }); });
    } else at(s.endTimeMs - 5, () => up(p.follow.id ?? F1, slidePos(sc, s.endTimeMs, p.skMul || 1)));
  }
  events.sort((a, b) => a.at - b.at);
  const lastAt = events.length ? events[events.length - 1].at : 0;

  // 空中の指は 16ms ごとになぞる(touches-drop-move / move-changed-ground はここでくせを入れる)
  let lastMove = 0;
  await new Promise((done) => {
    const tick = () => {
      const ms = window.__mhTestHooks.rhythmSongMs();
      if (ms == null) { setTimeout(done, 300); return; }
      while (events.length && ms >= events[0].at) events.shift().f();
      if (ms - lastMove > 16) {
        lastMove = ms;
        for (const p of plan) {
          const f = p.follow;
          if (!f || f.flick || ms < f.from || ms >= f.to || !live.has(f.id)) continue;
          const pos = slidePos(f.sc, ms, p.skMul || 1);
          const o = {};
          if (f.dropAt && ms >= f.dropAt && !f.dropped) { f.dropped = true; o.drop = [f.id, ...[...live.keys()].filter((x) => x !== f.id)]; }
          if (f.extra && ms >= f.extraChangedFrom && ms <= f.extraChangedTo) o.extraChanged = [f.extra];
          move(f.id, pos, o);
          if (RHYTHM_GESTURE_RUNTIME.slideOffForIndex(p.slide)) (f.off = f.off || []).push(Math.round(ms));
        }
      }
      if (events.length || ms < lastAt + 300) requestAnimationFrame(tick); else setTimeout(done, 700);
    };
    requestAnimationFrame(tick);
  });
  const rs = window.__mhTestHooks.rhythmNoteResults();
  let recJudges = [];
  try { RHYTHM_INPUT_REC.close(); recJudges = (RHYTHM_INPUT_REC.last()?.events || []).filter((e) => e.k === 'judge'); } catch (_) {}
  return {
    pairs: pairs.length, left,
    results: plan.map((p) => {
      const s = rs[p.slide], g = rs[p.ground], off = p.follow.off || [];
      const recAll = (() => { try { return RHYTHM_INPUT_REC.last()?.events || []; } catch (_) { return []; } })();
      const touchSeen = recAll.filter((e) => /^touch/.test(e.k) && e.ms >= p.start - 50 && e.ms <= p.end + 50 && (e.c || []).some((c) => p.ids.includes(c.id)) && e.k !== 'touchmove').map((e) => `${Math.round(e.ms)}:${e.k.replace('touch', 't')}[${(e.c || []).map((c) => c.id).join('+')}]n${e.n}`);
      const evs = recJudges.filter((e) => e.ms >= p.start - 50 && e.ms <= p.end + 300 && (e.d?.note === p.slide || ['track-cut', 'float', 'handover', 'standby', 'swap'].includes(e.type)))
        .map((e) => `${Math.round(e.ms)}:${e.type}${e.d?.note != null ? '#' + e.d.note : ''}${e.d?.kind ? '(' + e.d.kind + ')' : ''}`);
      return { quirk: p.quirk, slide: p.slide, ground: p.ground, groundType: p.groundType, startMs: Math.round(p.start), endMs: Math.round(p.end),
        slideJ: s?.judgment ?? null, holdJ: s?.holdJudgment ?? null, releaseJ: s?.releaseJudgment ?? null,
        offFrames: off.length, offFrom: off[0] ?? null, offTo: off[off.length - 1] ?? null,
        groundAt: p.groundAt || null, offLanes: p.offLanes ?? null, halfWidth: p.halfWidth ?? null, floats: floats.filter((f) => f.index === p.slide).map((f) => f.ms), groundJ: g?.judgment ?? null, events: evs.slice(0, 12), touches: touchSeen.slice(0, 10) };
    }),
  };
};

(async () => {
  const { chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'));
  const { createFakeSupabase } = require(path.join(ROOT, 'tools/playbot/lib/fake-supabase.js'));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, hasTouch: true });
  const sb = createFakeSupabase();
  await context.route('**/*', async (route) => {
    const req = route.request(), u = req.url();
    const m = u.match(/^https:\/\/fuzz\.test\/(.*)$/);
    if (m) {
      const f = path.join(ROOT, decodeURIComponent(m[1].split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ status: 200, body: fs.readFileSync(f), headers: { 'content-type': mime(f), 'access-control-allow-origin': '*' } });
    }
    if (/supabase\.co/.test(u)) {
      if (req.method() === 'POST' && /\/rest\/v1\/(rhythm_play_logs|rhythm_touch_diagnostics)/.test(u)) return route.fulfill({ status: 400, headers: { 'content-type': 'application/json' }, body: '{"code":"23514"}' });
      return sb.handle(route);
    }
    return route.abort();
  });
  await context.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await context.addInitScript(seed());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
  await page.goto('https://fuzz.test/monster-hero/index.html', { waitUntil: 'load', timeout: 90000 });
  const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button,summary')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
  const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
  const closeDialogs = async (n) => { for (let i = 0; i < n; i++) { if (!(await clickText('^(確認|受け取る|受け取|閉じる|OK|スキップ|あとで読む|あとで|この案内を閉じる)$'))) break; await page.waitForTimeout(500); } };
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), null, { timeout: 90000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' }); await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), null, { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' }); await page.waitForTimeout(2500);
  await closeDialogs(12);
  // デバッグの全解放の曲えらびから始める(鍵・記録に触らない)
  await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click()); await page.waitForTimeout(900);
  await clickText('^ヘルプ'); await page.waitForTimeout(900);
  await clickText('💊'); await page.waitForTimeout(1200);
  await page.evaluate(() => { const s = [...document.querySelectorAll('summary')].find(x => /モンヒロビート/.test(x.textContent)); if (s) s.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelector('[data-debug-rhythm-mode]')?.click()); await page.waitForTimeout(1500);
  const started = await page.evaluate(async ([song, diff]) => {
    document.querySelector('[data-rhythm-debug-select-open]')?.click();
    await new Promise(r => setTimeout(r, 1200));
    const target = [...RHYTHM_SONGS, ...RHYTHM_PROTO_SONGS].find(x => x.songId === song); if (!target) return false;
    const row = [...document.querySelectorAll('[data-rhythm-debug-select] [data-rhythm-song-row]')].find(r => r.textContent.includes(target.displayName) && (!target.subtitle || r.textContent.includes(target.subtitle)));
    if (!row) return false; row.click(); await new Promise(r => setTimeout(r, 500));
    document.querySelector('[data-rhythm-debug-select] [data-rhythm-difficulty="' + diff + '"]')?.click(); await new Promise(r => setTimeout(r, 400));
    const b = document.querySelector('[data-rhythm-debug-select] [data-rhythm-demo-start="' + diff + '"]'); if (b) b.click(); return !!b;
  }, [SONG, DIFF]);
  if (!started) throw new Error(`曲を始められなかった(${SONG} ${DIFF})`);
  await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks?.rhythmNotes?.(), null, { timeout: 30000, polling: 100 });
  const res = await page.evaluate(runner, [SONG, QUIRK_NAMES, REPEAT, LIST, TAPDX, SKIP]);
  if (res.error) throw new Error(res.error);
  if (LIST) {
    console.log(`空中スライドと地上ノーツの組: ${res.pairs.length}`);
    res.pairs.forEach((p) => console.log(`  スライド#${p.slide} ${Math.round(p.start)}〜${Math.round(p.end)}ms / 地上#${p.ground} ${p.groundType}`));
  } else {
    const label = Object.fromEntries(QUIRKS);
    console.log(`曲 ${SONG} ${DIFF} / 組 ${res.pairs}(流したくせ ${res.results.length - res.results.filter(r => r.quirk === 'none').length}・くせなし ${res.results.filter(r => r.quirk === 'none').length})`);
    if (res.left.length) console.log(`組が足りず流せなかったくせ: ${res.left.join(', ')}`);
    console.log('');
    console.log('くせ                      スライド  押し始め  離し        切れたコマ   地上');
    for (const r of res.results) {
      const cut = r.offFrames ? `${r.offFrames}(${r.offFrom}〜${r.offTo})` : '-';
      const bad = r.quirk !== 'none' && (r.offFrames > 0 || r.slideJ === 'MISS' || r.releaseJ === 'MISS' || r.floats.length > 0);
      console.log(`${(bad ? '★' : ' ') + r.quirk.padEnd(24)} #${String(r.slide).padEnd(5)} ${String(r.holdJ ?? r.slideJ ?? '-').padEnd(9)} ${String(r.releaseJ ?? '-').padEnd(11)} ${cut.padEnd(12)} #${r.ground} ${r.groundJ ?? '-'}${r.offLanes != null ? ` (ノーツから ${r.offLanes} レーン・幅の半分 ${r.halfWidth})` : ''}${r.floats.length ? ` 浮き ${r.floats.join(',')}` : ''}`);
      if (VERBOSE || bad || r.quirk === 'none' && (r.offFrames > 0 || r.releaseJ === 'MISS')) console.log(`     ${label[r.quirk]}\n     出来事: ${r.events.join(' ')}\n     指: ${r.touches.join(' ')}`);
    }
    const base = res.results.filter(r => r.quirk === 'none');
    const baseBad = base.filter(r => r.offFrames > 0 || r.releaseJ === 'MISS' || r.slideJ === 'MISS' || r.floats.length > 0);
    console.log(`\nくせなしの組: ${base.length} のうち空中スライドが切れたもの ${baseBad.length}${baseBad.length ? '(土台の指の動かし方がずれている。その組の結果は割り引いて読む)' : ''}`);
    console.log('★ = くせを混ぜた組で、空中スライドが切れた・MISS になった・浮いた(帯が暗くなった)もの');
    if (OUT) { fs.writeFileSync(OUT, JSON.stringify({ song: SONG, diff: DIFF, ...res }, null, 1)); console.log(`書き出し: ${OUT}`); }
  }
  if (errors.length) console.log(`ページのエラー: ${errors.join(' | ')}`);
  await context.close(); await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

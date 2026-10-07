// モンヒロビート: 曲を選んで、人のように最後まで演奏する。
//
// 押し方は、ふつうの指と同じ pointerdown / pointermove / pointerup を演奏エリアへ送るだけ。
// ゲームの判定には一切手を入れない。ボットが知っているのは
//   ・曲の再生位置とノーツの一覧(30-rhythm-play.jsx の window.__mhTestHooks.rhythmSongMs / rhythmNotes。読むだけ)
//   ・レーンの位置(本体の rhythmProjectBoundary と同じ式で、判定ラインの高さのレーンの真ん中を求める)
// だけ。人らしさのため、押す時刻はばらつかせ(標準偏差 SIGMA_MS)、ときどき押し損ねる(MISS_RATE)。

const SIGMA_MS = 28;
const MISS_RATE = 0.03;

// ページの中で動く演奏係。requestAnimationFrame で再生位置を見ながら、予定の時刻に指を下ろす
function installPlayer({ sigma, missRate, seed }) {
  let st = seed >>> 0;
  const rand = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, rand()), v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const hooks = window.__mhTestHooks || {};
  const area = document.querySelector('[data-rhythm-play-area]');
  const notes = hooks.rhythmNotes ? hooks.rhythmNotes() : null;
  if (!area || !notes) return { ok: false, why: !area ? '演奏エリアが無い' : '演奏の参照が無い(30-rhythm-play.jsx)' };
  // 判定ラインの高さで、レーン座標 c(0 = いちばん左のレーンの真ん中)を画面の点へ
  const pointOf = (c) => {
    const rect = (typeof RHYTHM_GESTURE_RUNTIME !== 'undefined' && RHYTHM_GESTURE_RUNTIME.areaRect(area)) || area.getBoundingClientRect();
    const ratio = (typeof RHYTHM_JUDGMENT_LINE_Y !== 'undefined' ? RHYTHM_JUDGMENT_LINE_Y.ratio : 0.88);
    const left = rhythmProjectBoundary(0, ratio), right = rhythmProjectBoundary(RHYTHM_LANE_COUNT, ratio);
    const laneWidth = (right - left) / RHYTHM_LANE_COUNT;
    return { x: rect.left + rect.width * (left + (c + 0.5) * laneWidth), y: rect.top + rect.height * ratio };
  };
  // サブレーンを持つノーツは、その帯の真ん中を押す
  const centerOf = (n) => (Number.isFinite(n.subLane)
    ? (n.subLane + (Number.isFinite(n.subLaneWidth) ? n.subLaneWidth : 2) / 2) / 2 - 0.5
    : n.lane);
  let pid = 100;
  const fire = (type, id, p) => area.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: id, pointerType: 'mouse', isPrimary: false,
    clientX: p.x, clientY: p.y, buttons: type === 'pointerup' ? 0 : 1,
  }));
  // 予定表: { at: 押す時刻(ms), kind, note }
  const plan = [];
  let skipped = 0;
  notes.forEach((n) => {
    if (rand() < missRate) { skipped += 1; return; }
    plan.push({ at: n.timeMs + gauss() * sigma, n, id: pid++ });
  });
  plan.sort((a, b) => a.at - b.at);
  const active = []; // 押さえ続けている指 { id, n, until }
  let i = 0, taps = 0;
  const stats = { planned: plan.length, skipped, taps: 0, done: false };
  const lerpLane = (pts, t) => {
    if (!pts || pts.length < 2) return null;
    if (t <= pts[0].timeMs) return pts[0].lane;
    for (let k = 1; k < pts.length; k++) {
      if (t <= pts[k].timeMs) { const a = pts[k - 1], b = pts[k]; return a.lane + (b.lane - a.lane) * ((t - a.timeMs) / Math.max(1, b.timeMs - a.timeMs)); }
    }
    return pts[pts.length - 1].lane;
  };
  const tick = () => {
    const now = hooks.rhythmSongMs ? hooks.rhythmSongMs() : null;
    if (now === null) { if (!document.querySelector('[data-rhythm-play-area]')) { stats.done = true; return; } requestAnimationFrame(tick); return; }
    while (i < plan.length && plan[i].at <= now) {
      const { n, id } = plan[i++];
      const p = pointOf(centerOf(n));
      fire('pointerdown', id, p);
      taps += 1;
      if (n.type === 'HOLD' || n.type === 'SLIDE') {
        active.push({ id, n, until: (Number(n.endTimeMs) || n.timeMs) + gauss() * sigma * 0.5 });
      } else if (n.type === 'FLICK') {
        // はじく: 少し上へ素早く動かしてから離す
        setTimeout(() => { fire('pointermove', id, { x: p.x, y: p.y - 30 }); fire('pointermove', id, { x: p.x, y: p.y - 70 }); fire('pointerup', id, { x: p.x, y: p.y - 70 }); }, 25);
      } else {
        setTimeout(() => fire('pointerup', id, p), 45 + rand() * 30);
      }
    }
    for (let k = active.length - 1; k >= 0; k--) {
      const a = active[k];
      if (a.n.type === 'SLIDE') {
        const c = lerpLane(a.n.slidePoints, now);
        if (c !== null) fire('pointermove', a.id, pointOf(c));
      }
      if (now >= a.until) { fire('pointerup', a.id, pointOf(a.n.type === 'SLIDE' ? (lerpLane(a.n.slidePoints, now) ?? a.n.lane) : centerOf(a.n))); active.splice(k, 1); }
    }
    stats.taps = taps;
    requestAnimationFrame(tick);
  };
  window.__playbotRhythm = stats;
  requestAnimationFrame(tick);
  return { ok: true, notes: notes.length, planned: plan.length };
}

async function rhythmScenario(s, { maxSongMs = 240000 } = {}) {
  const { page, rand } = s;
  const stats = { song: '', difficulty: '', notes: 0, result: null, rankingShowsBot: null };
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  await s.inspect();
  if (!(await s.tapLabel(/ソロライブ/, 2000))) { await s.addIssue('進めない', 'モンヒロビートの「ソロライブ」が見つからない'); return { ok: false, stats }; }
  await s.dismissOverlays(6);
  await s.inspect();
  // 曲を1つ選ぶ(一覧のカードは「Lv.」を含む)
  const songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label));
  if (!songs.length) { await s.addIssue('進めない', '曲えらびに曲が出ていない'); return { ok: false, stats }; }
  const song = songs[Math.floor(rand() * songs.length)];
  await s.tap(song, '曲を選ぶ');
  stats.song = song.label.replace(/\s*Lv\..*$/, '');
  // 難易度は EASY〜HARD から(人は最初から最難関を選ばない)
  const diffs = (await s.listButtons()).filter((b) => /^(\d+ )?(EASY|NORMAL|HARD)\b/.test(b.label) || /(EASY|NORMAL|HARD)/.test(b.label) && b.h < 90);
  if (diffs.length) { const d = diffs[Math.floor(rand() * diffs.length)]; await s.tap(d, '難易度を選ぶ'); stats.difficulty = (d.label.match(/EASY|NORMAL|HARD/) || [''])[0]; }
  await s.inspect();
  const started = await s.tapLabel(/^(▶\s*)?(決定|START|スタート|演奏する|演奏開始|PLAY|はじめる)$/i, 2500);
  if (!started) { await s.addIssue('進めない', '曲えらびから演奏を始めるボタンが見つからない', { buttons: (await s.listButtons()).map((b) => b.label).slice(0, 30) }); return { ok: false, stats }; }
  await s.dismissOverlays(4);
  // 演奏画面が出て、参照が使えるまで待つ
  const ready = await page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', '演奏画面が開かない'); return { ok: false, stats }; }
  await s.inspect();
  const installed = await page.evaluate(installPlayer, { sigma: SIGMA_MS, missRate: MISS_RATE, seed: Math.floor(rand() * 1e9) });
  if (!installed.ok) { await s.addIssue('進めない', `演奏できない: ${installed.why}`); return { ok: false, stats }; }
  stats.notes = installed.notes;
  // 終わるまで見守る。途中で1回だけスクショ
  const t0 = Date.now();
  let shotTaken = false;
  while (Date.now() - t0 < maxSongMs) {
    await s.wait(2000);
    s.state.step += 1;
    const inPlay = await page.evaluate(() => !!document.querySelector('[data-rhythm-play-area]') && !/RESULT|リザルト/.test(document.body.innerText.slice(0, 400)));
    if (!shotTaken && Date.now() - t0 > 20000) { await s.shot('rhythm-playing'); shotTaken = true; }
    const h = await s.health();
    if (h && /RESULT|SCORE|スコア/.test(h.text) && /MARVELOUS|EXCELLENT|GREAT|GOOD|MISS/.test(h.text) && !(await page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null)))) break;
    if (!inPlay) break;
  }
  await s.wait(2500);
  const resultText = ((await s.health()) || {}).text || '';
  const pick = (re) => { const m = resultText.replace(/\s+/g, ' ').match(re); return m ? m[1] : null; };
  stats.result = {
    score: pick(/SCORE\s*([\d,]+)/i) || pick(/スコア\s*([\d,]+)/),
    justMarvelous: pick(/JUST MARVELOUS\s*(\d+)/), marvelous: pick(/(?<!JUST )MARVELOUS\s*(\d+)/), excellent: pick(/EXCELLENT\s*(\d+)/), great: pick(/GREAT\s*(\d+)/),
    good: pick(/GOOD\s*(\d+)/), bad: pick(/BAD\s*(\d+)/), miss: pick(/MISS\s*(\d+)/),
    maxCombo: pick(/MAX COMBO\s*(\d+)/), fast: pick(/FAST\s*(\d+)/), slow: pick(/SLOW\s*(\d+)/),
  };
  stats.bot = await page.evaluate(() => window.__playbotRhythm || null);
  await s.shot('rhythm-result');
  await s.inspect();
  if (Date.now() - t0 >= maxSongMs) await s.addIssue('進行停止', `演奏が${Math.round(maxSongMs / 1000)}秒たっても終わらない`);
  // 結果のあと、曲えらびへ戻ってランキングに自分が載って見えるか(にせの Supabase が覚えている)
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(曲えらびへ(戻る)?|曲選択へ|もどる|戻る|OK|閉じる|次へ)$/, 1500))) break; }
  if (await s.tapLabel(/この曲の全国ランキング/, 2500)) {
    await s.dismissOverlays(4);
    const txt = ((await s.health()) || {}).text || '';
    stats.rankingShowsBot = txt.includes(s.BOT_NAME);
    await s.inspect();
  }
  const sent = s.supabase.writes.filter((w) => w.table === 'rankings').length;
  return { ok: true, stats, note: `${stats.song} ${stats.difficulty}・${stats.notes}ノーツ → スコア ${stats.result.score || '?'}(ランキングへ送った記録 ${sent}件・横取り済み)` };
}

module.exports = { rhythmScenario };

// 横画面: モンヒロビートの「横画面にする」(端末が回せないときは絵を90度回す)で横向きにして、
//   ・開いた画面や窓を、閉じる/戻るで本当に閉じられるか(ボタンが画面の外なら、人と同じくスクロールして探す)
//   ・横向きのまま1曲演奏して、押した位置がずれていないか(MISS が多すぎないか)
// を見る。2026-10-06 に、横画面のときだけイベント詳細の「閉じる」が押せない不具合があった(プレイボットが見つけた)。
const { installPlayer, SIGMA_MS, MISS_RATE } = require('./rhythm');

const CLOSE = /^(閉じる|とじる|×|✕|戻る|もどる|モードえらびへ戻る|ルームを出る|OK)$/;

// いまの画面の文字(閉じられたかを見る)
const textNow = async (s) => (((await s.health()) || {}).text || '').slice(0, 600);

// 開いた窓・画面を閉じる。見えていなければスクロールして探す。閉じられたら true
async function closeIt(s, what) {
  const before = await textNow(s);
  let b = (await s.listButtons()).find((x) => CLOSE.test(x.label) && x.overlay) || (await s.listButtons()).find((x) => CLOSE.test(x.label));
  let scrolled = false;
  if (!b) {
    scrolled = await s.page.evaluate((src) => {
      const re = new RegExp(src);
      const el = [...document.querySelectorAll('button')].reverse().find((x) => !x.disabled && x.offsetParent && re.test(((x.getAttribute('aria-label') || x.innerText || '').trim())));
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      return true;
    }, CLOSE.source);
    await s.wait(400);
    b = (await s.listButtons()).find((x) => CLOSE.test(x.label));
  }
  if (!b) {
    await s.addIssue('横画面で閉じられない', `横画面で「${what}」を開くと、閉じる・戻るのボタンが${scrolled ? 'スクロールしても押せる位置に来ない' : '見つからない'}`);
    return false;
  }
  await s.tap(b, `横画面で閉じる(${what})`);
  await s.wait(800);
  const after = await textNow(s);
  if (after === before) { await s.addIssue('横画面で閉じられない', `横画面で「${what}」の「${b.label}」を押しても閉じない`); return false; }
  return true;
}

async function openRhythmLandscape(s) {
  await s.backHome();
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  if (!(await s.tapLabel(/^横画面にする$/, 1500))) return false;
  await s.tapLabel(/タップで閉じる/, 600);
  await s.inspect();
  return true;
}

async function landscapeScenario(s) {
  const seen = [];
  const failed = [];
  if (!(await openRhythmLandscape(s))) { await s.addIssue('進めない', 'モンヒロビートに「横画面にする」が無い'); return { ok: false, note: '横画面にできない' }; }
  // モードえらびの下の窓(遊びかた・記録・ビートLv・オプション)
  for (const re of [/^📖 遊びかた$/, /^📜 記録$/, /^📈 ビートLv$/, /^⚙️ オプション$/]) {
    if (!(await s.tapLabel(re, 1200))) continue;
    const what = re.source.replace(/[\^$\\]/g, '');
    await s.inspect();
    seen.push(what);
    if (!(await closeIt(s, what))) { failed.push(what); await openRhythmLandscape(s); }
  }
  // 曲えらび → 全国ランキングの各タブ → イベント詳細
  if (await s.tapLabel(/ソロライブ/, 2000)) {
    await s.dismissOverlays(4);
    await s.tapLabel(/^この案内を閉じる$/, 500);
    await s.inspect();
    seen.push('曲えらび');
    if (await s.tapLabel(/この曲の全国ランキング/, 2000)) {
      await s.inspect();
      seen.push('全国ランキング');
      for (const tab of ['この曲', '総合', '週間', 'イベント']) { if (await s.tapLabel(new RegExp(`^${tab}$`), 1000)) await s.inspect(); }
      if (await s.tapLabel(/イベント詳細/, 1200)) {
        await s.inspect();
        seen.push('イベント詳細');
        if (!(await closeIt(s, 'イベント詳細'))) failed.push('イベント詳細');
      }
      if (!(await closeIt(s, '全国ランキング'))) failed.push('全国ランキング');
    }
    if (!(await closeIt(s, '曲えらび'))) failed.push('曲えらび');
  }
  // 部屋づくり → 部屋を出る
  await openRhythmLandscape(s);
  if (await s.tapLabel(/^＋ 作成$/, 2500)) {
    await s.inspect();
    seen.push('マルチの部屋');
    if (!(await closeIt(s, 'マルチの部屋'))) failed.push('マルチの部屋');
  }
  // 横向きのまま1曲演奏する
  const play = await playLandscape(s);
  // 縦に戻す
  await openRhythmLandscape(s).catch(() => {});
  await s.tapLabel(/^縦画面にする$/, 1200);
  await s.backHome();
  return { ok: !failed.length && play.ok, note: `横画面で ${seen.length}か所を開いた(${seen.join('・')})${failed.length ? `・閉じられない ${failed.join('・')}` : '・どれも閉じられた'}・${play.note}` };
}

async function playLandscape(s) {
  await openRhythmLandscape(s);
  if (!(await s.tapLabel(/ソロライブ/, 2000))) return { ok: true, note: '演奏はしなかった(ソロライブが無い)' };
  await s.dismissOverlays(4);
  await s.tapLabel(/^この案内を閉じる$/, 500);
  const songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label) && !/大きく見る|お気に入り/.test(b.label));
  if (!songs.length) return { ok: true, note: '演奏はしなかった(曲が見えない)' };
  await s.tap(songs[Math.floor(s.rand() * Math.min(4, songs.length))], '曲を選ぶ');
  const easy = (await s.listButtons()).find((b) => /^\d+ EASY\b/.test(b.label));
  if (easy) await s.tap(easy, 'EASY');
  if (!(await s.tapLabel(/^決定$/, 2500))) return { ok: true, note: '演奏はしなかった(決定が無い)' };
  await s.dismissOverlays(4);
  const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', '横画面で決定しても演奏が始まらない'); return { ok: false, note: '演奏が始まらない' }; }
  const installed = await s.page.evaluate(installPlayer, { sigma: SIGMA_MS, missRate: MISS_RATE, seed: Math.floor(s.rand() * 1e9) });
  if (!installed.ok) return { ok: true, note: `演奏はしなかった(${installed.why})` };
  const t0 = Date.now();
  while (Date.now() - t0 < 240000) {
    await s.wait(2000);
    const playing = await s.page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null) && !!document.querySelector('[data-rhythm-play-area]'));
    if (!playing) break;
  }
  await s.wait(3000);
  const text = (((await s.health()) || {}).text || '').replace(/\s+/g, ' ');
  const miss = Number((text.match(/MISS\s*(\d+)/) || [])[1]);
  await s.shot('landscape-result');
  await s.inspect();
  const rate = Number.isFinite(miss) && installed.notes ? miss / installed.notes : null;
  // ボットは3%だけわざと押し損ねる。3割を超えて MISS なら、押した位置が道とずれている
  if (rate !== null && rate > 0.3) await s.addIssue('横画面で押した位置がずれる', `横画面で ${installed.notes}ノーツ中 ${miss}ノーツが MISS(縦画面の音ゲー係と同じ押し方)`);
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(曲えらびへ(戻る)?|曲選択へ|もどる|戻る|OK|閉じる|次へ)$/, 1500))) break; }
  return { ok: rate === null || rate <= 0.3, note: `横向きで ${installed.notes}ノーツ演奏 → MISS ${Number.isFinite(miss) ? miss : '?'}` };
}

module.exports = { landscapeScenario };

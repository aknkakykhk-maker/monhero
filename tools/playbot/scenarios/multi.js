// マルチ: モンヒロビートのプライベートルームを作り、マスモンを CPU として呼んで、一緒に最後まで演奏する。
//   ・「マスモンを呼ぶ」を二度押ししても、今日の無料回数(あと◯回)は1回分しか減らない
//   ・呼んだマスモンがメンバーに入り、メンバー確定 → 選曲 → 演奏 → 結果まで進める
// 部屋づくりの通信は、にせの Supabase(lib/fake-supabase.js)が受け止める。本物の部屋は作らない(CLAUDE.md ⑦)。
// 押し方は音ゲー係と同じ(scenarios/rhythm.js の installPlayer)。同時に動かすと押すのが遅れるので、1人で動かす。
const { installPlayer, SIGMA_MS, MISS_RATE } = require('./rhythm');

const freeLeft = (s) => s.page.evaluate(() => { const m = document.body.innerText.match(/今日の無料\s*あと\s*(\d+)\s*回/); return m ? Number(m[1]) : null; });
// メンバー欄の「CPUモッチー Lv.1」だけを数える(★ボタンの説明「マスモンがCPUとして…」を数えない)
// 部屋では「CPUモッチー Lv.1」、曲えらびでは「CPU モッチー」の形で出る
const cpuCount = (s) => s.page.evaluate(() => new Set((document.body.innerText.replace(/\s+/g, ' ').match(/CPU ?(?!として)[^\s]+/g) || []).map((x) => x.replace(/^CPU ?/, ''))).size);

async function multiScenario(s, { maxSongMs = 330000 } = {}) {
  const stats = { called: 0, freeBefore: null, freeAfter: null, song: '', notes: 0, score: null };
  await s.backHome();
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  if (!(await s.tapLabel(/^＋ 作成$/, 2500))) { await s.addIssue('進めない', 'プライベートルームの「作成」が無い'); return { ok: false, note: '部屋を作れない' }; }
  await s.dismissOverlays(4);
  await s.inspect();

  // マスモンを呼ぶ(二度押し)
  if (!(await s.tapLabel(/^🎵 マスモンを呼ぶ/, 1200))) { await s.addIssue('進めない', '部屋に「マスモンを呼ぶ」が無い'); return { ok: false, note: '呼べない' }; }
  await s.inspect();
  stats.freeBefore = await freeLeft(s);
  const call = (await s.listButtons()).find((b) => /^呼ぶ$/.test(b.label));
  if (!call) { await s.addIssue('進めない', '「マスモンを呼ぶ」に呼べるマスモンがいない'); return { ok: false, note: '呼べるマスモンがいない' }; }
  await s.page.mouse.click(call.x, call.y); await s.wait(120);
  await s.tap(call, 'マスモンを呼ぶ(二度押し)');
  await s.wait(1200);
  stats.called = await cpuCount(s);
  // 呼んだあとの「あと◯回」を見るため、もう一度開く
  await s.dismissOverlays(4);
  if (await s.tapLabel(/^🎵 マスモンを呼ぶ/, 1000)) { stats.freeAfter = await freeLeft(s); await s.tapLabel(/^(閉じる|✕)$/, 800); await s.dismissOverlays(4); }
  if (stats.freeBefore !== null && stats.freeAfter !== null && stats.freeBefore - stats.freeAfter > 1) {
    await s.addIssue('二度押しで二重', `「マスモンを呼ぶ」の「呼ぶ」を二度押ししたら、今日の無料が ${stats.freeBefore} → ${stats.freeAfter} 回(1回分だけ減るはず)`);
  }
  if (stats.called < 1) { await s.addIssue('進めない', '「呼ぶ」を押してもメンバーに CPU が入らない'); return { ok: false, note: 'CPU が入らない' }; }
  await s.inspect();

  // メンバー確定 → 選曲 → 準備完了 → 演奏(相棒係も使う)
  const played = await playInRoom(s, stats, { maxSongMs });
  if (!played.ok) return played;
  // 結果から部屋へ戻り、部屋を出る
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(ルームへ戻る|ルームに戻る|部屋へ戻る|次へ|OK|閉じる)$/, 1500))) break; }
  await s.tapLabel(/^ルームを出る$/, 1500);
  await s.dismissOverlays(4);
  await s.backHome();
  return { ok: true, stats, note: `部屋を作り、マスモン ${stats.called}体を呼んだ(今日の無料 ${stats.freeBefore}→${stats.freeAfter}回・二度押し)・${stats.song || '?'} を ${stats.notes}ノーツ演奏 → スコア ${stats.score || '?'}` };
}


// 部屋の中: メンバー確定 → 選曲 → 準備完了 → 最後まで演奏して結果を読む。stats へ song / notes / score を入れる
// ★部屋では CPU の「おまかせ」も入れてシャッフルで1曲に決まるので、長い曲になることがある。上限は長めにとる
async function playInRoom(s, stats, { maxSongMs = 330000 } = {}) {
  // メンバー確定 → 選曲
  // ★5人そろうと、メンバー確定を押さなくても曲えらびへ進む。曲えらびが出ていなければ押す
  const inSelect = (await s.listButtons()).some((b) => /^この曲で決定$/.test(b.label));
  if (!inSelect && !(await s.tapLabel(/^メンバー確定$/, 2000))) { await s.addIssue('進めない', '「メンバー確定」が押せない'); return { ok: false, note: 'メンバー確定できない' }; }
  await s.dismissOverlays(4);
  const songs = (await s.listButtons()).filter((b) => /Lv\.\s*\d+/.test(b.label) && !/大きく見る|お気に入り/.test(b.label));
  if (songs.length) {
    const song = songs[Math.floor(s.rand() * Math.min(songs.length, 6))];
    await s.tap(song, '曲を選ぶ');
    stats.song = song.label.replace(/\s*Lv\..*$/, '');
  }
  const diffs = (await s.listButtons()).filter((b) => /^\d+ (EASY|NORMAL)$/.test(b.label));
  if (diffs.length) await s.tap(diffs[Math.floor(s.rand() * diffs.length)], '難易度を選ぶ');
  await s.inspect();
  if (!(await s.tapLabel(/^この曲で決定$/, 1500))) { await s.addIssue('進めない', 'マルチの選曲で「この曲で決定」が押せない'); return { ok: false, note: '選曲できない' }; }
  // 全員がえらぶと、シャッフルで1曲に決まる。そのあと難易度を選んで「準備完了」を押すと演奏が始まる
  let readied = false;
  for (let k = 0; k < 30 && !(await s.page.evaluate(() => !!document.querySelector('[data-rhythm-play-area]'))); k++) {
    await s.wait(1000);
    if (readied) continue;
    const list = await s.listButtons();
    const ready = list.find((b) => /^準備完了$/.test(b.label));
    if (!ready) continue;
    const diff = list.filter((b) => /^\d+ (EASY|NORMAL)$/.test(b.label));
    if (diff.length) await s.tap(diff[Math.floor(s.rand() * diff.length)], '難易度を選ぶ');
    await s.inspect();
    await s.tap(ready, '準備完了');
    readied = true;
  }
  const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!ready) { await s.addIssue('進めない', 'マルチでメンバー確定と選曲をしたのに、60秒たっても演奏が始まらない'); return { ok: false, note: '演奏が始まらない' }; }
  await s.inspect();
  const installed = await s.page.evaluate(installPlayer, { sigma: SIGMA_MS, missRate: MISS_RATE, seed: Math.floor(s.rand() * 1e9) });
  if (!installed.ok) { await s.addIssue('進めない', `マルチで演奏できない: ${installed.why}`); return { ok: false, note: '演奏できない' }; }
  stats.notes = installed.notes;
  const t0 = Date.now();
  let shot = false;
  while (Date.now() - t0 < maxSongMs) {
    await s.wait(2000);
    s.state.step += 1;
    if (!shot && Date.now() - t0 > 20000) { await s.shot('multi-playing'); shot = true; }
    const playing = await s.page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null) && !!document.querySelector('[data-rhythm-play-area]'));
    if (!playing) break;
  }
  if (Date.now() - t0 >= maxSongMs) await s.addIssue('進行停止', `マルチの演奏が${Math.round(maxSongMs / 1000)}秒たっても終わらない`);
  await s.wait(4000);
  const text = ((await s.health()) || {}).text || '';
  const m = text.replace(/\s+/g, ' ').match(/SCORE\s*([\d,]+)/i);
  stats.score = m ? m[1] : null;
  await s.shot('multi-result');
  await s.inspect();
  return { ok: true };
}

module.exports = { multiScenario, playInRoom, freeLeft, cpuCount };

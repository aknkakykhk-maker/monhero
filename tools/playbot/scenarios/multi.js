// マルチ: モンヒロビートのプライベートルームを作り、マスモンを CPU として呼んで、一緒に最後まで演奏する。
//   ・「マスモンを呼ぶ」を二度押ししても、今日の無料回数(あと◯回)は1回分しか減らない
//   ・呼んだマスモンがメンバーに入り、メンバー確定 → 選曲 → 演奏 → 結果まで進める
// 部屋づくりの通信は、にせの Supabase(lib/fake-supabase.js)が受け止める。本物の部屋は作らない(CLAUDE.md ⑦)。
// 押し方は音ゲー係と同じ(scenarios/rhythm.js の installPlayer)。同時に動かすと押すのが遅れるので、1人で動かす。
const { installPlayer, collectFingerSuspects, installArgs } = require('./rhythm');

const freeLeft = (s) => s.page.evaluate(() => { const m = document.body.innerText.match(/今日の無料\s*あと\s*(\d+)\s*回/); return m ? Number(m[1]) : null; });
// メンバー欄の「CPUモッチー Lv.1」だけを数える(★ボタンの説明「マスモンがCPUとして…」を数えない)
// 部屋では「CPUモッチー Lv.1」、曲えらびでは「CPU モッチー」の形で出る
const cpuCount = (s) => s.page.evaluate(() => new Set((document.body.innerText.replace(/\s+/g, ' ').match(/CPU ?(?!として)[^\s]+/g) || []).map((x) => x.replace(/^CPU ?/, ''))).size);

// プライベートルームを作る。2026-10-07 にモードえらびが2×2のタイルへ組み替わり、「＋ 作成」は「プライベート」の中の「＋ 部屋をつくる」になった。
// 古い画面(モードえらびに直接「＋ 作成」がある)でも動くよう、まず直接探し、無ければ「プライベート」を開いてから探す
// 「マスモンを呼ぶ」の「呼ぶ」ボタンを探す。1行の表示なら各行に「呼ぶ」がある。3列のカード表示(2026-10-07〜の既定)は、
// カード(絆と総合力が書いてある)を押すと選ばれて、下に「呼ぶ」が出る
async function pickCallButton(s) {
  const find = async () => (await s.listButtons()).find((b) => /^呼ぶ$/.test(b.label));
  let call = await find();
  if (call) return call;
  const card = (await s.listButtons()).find((b) => /絆\s*\d+/.test(b.label) && /総合力/.test(b.label));
  if (!card) return null;
  await s.tap(card, 'マスモンのカードを選ぶ');
  await s.wait(400);
  return find();
}
async function createPrivateRoom(s) {
  if (await s.tapLabel(/^＋ 作成$/, 800)) return true;
  if (!(await s.tapLabel(/プライベート/, 1500))) return false;
  await s.dismissOverlays(3);
  return s.tapLabel(/^[＋+] ?(部屋をつくる|部屋を作る|作成)$|^作成$/, 2500);
}
async function multiScenario(s, { maxSongMs = 330000 } = {}) {
  const stats = { called: 0, freeBefore: null, freeAfter: null, song: '', notes: 0, score: null };
  await s.backHome();
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  if (!(await createPrivateRoom(s))) { await s.addIssue('進めない', 'プライベートルームの「作成」が無い'); return { ok: false, note: '部屋を作れない' }; }
  await s.dismissOverlays(4);
  await s.inspect();

  // マスモンを呼ぶ(二度押し)
  if (!(await s.tapLabel(/^🎵 マスモンを呼ぶ/, 1200))) { await s.addIssue('進めない', '部屋に「マスモンを呼ぶ」が無い'); return { ok: false, note: '呼べない' }; }
  await s.inspect();
  stats.freeBefore = await freeLeft(s);
  const call = await pickCallButton(s);
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
  return { ok: true, stats, note: `部屋を作り、マスモン ${stats.called}体を呼んだ(今日の無料 ${stats.freeBefore}→${stats.freeAfter}回・二度押し)・${stats.song || '?'} を ${stats.notes}ノーツ演奏 → スコア ${stats.score || '?'}${s.state.resultOrientation ? `・結果の縦横 ${s.state.resultOrientation}` : ''}` };
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
  const installed = await s.page.evaluate(installPlayer, installArgs(s));
  if (!installed.ok) { await s.addIssue('進めない', `マルチで演奏できない: ${installed.why}`); return { ok: false, note: '演奏できない' }; }
  stats.notes = installed.notes;
  const t0 = Date.now();
  const fingers = {};
  let shot = false;
  while (Date.now() - t0 < maxSongMs) {
    await s.wait(2000);
    await collectFingerSuspects(s, fingers);
    s.state.step += 1;
    if (!shot && Date.now() - t0 > 20000) { await s.shot('multi-playing'); shot = true; }
    const playing = await s.page.evaluate(() => !!(window.__mhTestHooks && window.__mhTestHooks.rhythmSongMs && window.__mhTestHooks.rhythmSongMs() !== null) && !!document.querySelector('[data-rhythm-play-area]'));
    if (!playing) break;
  }
  if (Date.now() - t0 >= maxSongMs) await s.addIssue('進行停止', `マルチの演奏が${Math.round(maxSongMs / 1000)}秒たっても終わらない`);
  await s.wait(4000);
  await collectFingerSuspects(s, fingers, true);
  const text = ((await s.health()) || {}).text || '';
  const m = text.replace(/\s+/g, ' ').match(/SCORE\s*([\d,]+)/i);
  stats.score = m ? m[1] : null;
  await s.shot('multi-result');
  await s.inspect();
  await resultOrientation(s);
  return { ok: true };
}

// マルチの結果画面の縦横切り替え(2026-10-10・社長「マルチの演奏後の結果画面でも縦横切り替えボタンほしい」)。
// 演奏直後の自分の結果と、「みんなの結果を見る」のあとのチームの結果の両方で、縦横ボタンを押して横・縦を撮り、
// ボタンが画面からはみ出していないかを見る。どちらも最後は縦へ戻す(チームの結果は、自分の結果で選んだ向きのまま開くかも見る)
async function resultOrientation(s) {
  const fits = (sels) => s.page.evaluate((sels) => {
    const w = window.innerWidth, h = window.innerHeight;
    const out = sels.map((sel) => {
      const el = document.querySelector(sel);
      if (!el) return `${sel}: 無い`;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= w + 1 && r.bottom <= h + 1 ? '' : `${sel}: はみ出し(${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`;
    }).filter(Boolean);
    return { out, rotated: document.querySelector('[data-mh-view-rotation="true"]') ? '横' : '縦' };
  }, sels);
  const flip = async (where, toggle, sels, name) => {
    if (!(await s.page.$(toggle))) { await s.addIssue('入口がない', `マルチの${where}に縦横切り替えボタンが無い`); return '無い'; }
    const log = [];
    for (const step of ['1回目', '2回目']) {
      await s.page.click(toggle).catch(() => {});
      await s.wait(1500);
      const f = await fits(sels);
      await s.shot(`${name}-${f.rotated}`);
      if (f.out.length) await s.addIssue('はみ出し', `マルチの${where}を縦横ボタンで${f.rotated}にすると、ボタンが画面に収まらない: ${f.out.join(' / ')}`);
      log.push(`${f.rotated}${f.out.length ? `(はみ出し${f.out.length})` : ''}`);
    }
    return log.join('→');
  };
  const own = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-result]'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  const notes = [];
  if (own) {
    notes.push(`自分の結果 ${await flip('自分の結果の画面', '[data-rhythm-result-orientation] [data-rhythm-orientation-toggle]', ['[data-rhythm-result-orientation] button', '[data-rhythm-multi-result-back]'], 'multi-own-result')}`);
    // 横のままチームの結果へ進み、向きが続いているかを見る
    await s.page.click('[data-rhythm-result-orientation] [data-rhythm-orientation-toggle]').catch(() => {});
    await s.wait(1200);
    await s.page.click('[data-rhythm-multi-result-back]').catch(() => {});
  }
  const team = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-multi-step="result"]'), null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (team) {
    await s.wait(1500);
    const kept = await fits([]);
    await s.shot(`multi-team-result-${kept.rotated}`);
    if (own && kept.rotated !== '横') await s.addIssue('向きがずれる', '自分の結果で横にしてから「みんなの結果を見る」へ進むと、チームの結果が縦に戻っていた');
    notes.push(`チームの結果(開いたとき${kept.rotated}) ${await flip('チームの結果画面', '[data-rhythm-multi-result-orientation] [data-rhythm-orientation-toggle]', ['[data-rhythm-multi-result-orientation] button', '[data-rhythm-multi-member-stats]', '[data-rhythm-multi-result-next]'], 'multi-team-result')}`);
    // 最後は縦へ戻す
    if ((await fits([])).rotated === '横') { await s.page.click('[data-rhythm-multi-result-orientation] [data-rhythm-orientation-toggle]').catch(() => {}); await s.wait(1200); }
  }
  s.state.resultOrientation = notes.join(' / ') || '結果画面に着かなかった';
}

module.exports = { multiScenario, playInRoom, freeLeft, cpuCount };

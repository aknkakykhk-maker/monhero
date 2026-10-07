// 相棒(マルチに呼ぶマスモン)の決まりごとを、時計を動かしながら確かめる。
//   ① 1日に無料で呼べるのは3回。4体目はセッション券をちょうど1枚使う(券が多く減らない・無料が3回を超えない)
//   ② 一緒に1曲遊ぶと、呼んだマスモンの経験値が増える
//   ③ 朝5:00を過ぎて開き直すと、無料の回数が3回に戻る
// 保存の形は 33-rhythm-buddy.jsx(mh_rhythm_buddy_v1 = { day, used, mons })、券は mh_owned_items の session_ticket。
// 時計は context.clock で差し替える(時計係と同じ)。下準備でマスモン4体と券2枚を入れておく(相棒係の storage)。
const { playInRoom, freeLeft, cpuCount } = require('./multi');

const JST = 9 * 3600 * 1000;
const jstDate = (ms) => new Date(ms + JST).toISOString().slice(0, 10);
const at = (date, hm) => new Date(`${date}T${hm}:00+09:00`);

const readBuddy = (s) => s.page.evaluate(() => {
  const parse = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const b = parse('mh_rhythm_buddy_v1') || {};
  const items = parse('mh_owned_items') || {};
  const mons = b.mons || {};
  return { day: b.day || '', used: Number(b.used) || 0, tickets: Number(items.session_ticket) || 0,
    xp: Object.fromEntries(Object.entries(mons).map(([id, m]) => [id, (Number(m && m.exp) || 0) + (Number(m && m.lives) || 0)])) };
});

async function openRoom(s) {
  await s.backHome();
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.innerText || '').trim() === 'モンヒロビート')?.click());
  await s.wait(2500);
  await s.dismissOverlays(10);
  if (!(await s.tapLabel(/^＋ 作成$/, 2500))) return false;
  await s.dismissOverlays(4);
  return true;
}

async function buddyScenario(s) {
  const today = jstDate(Date.now());
  // 朝5:00の少し前に始める
  await s.context.clock.install({ time: at(today, '04:40') });
  await s.boot();
  await s.inspect();
  if (!(await openRoom(s))) { await s.addIssue('進めない', 'プライベートルームを作れない'); return { ok: false, note: '部屋を作れない' }; }
  const problems = [];
  const log = [];
  const b0 = await readBuddy(s);
  // ① 4体を1体ずつ呼ぶ
  for (let k = 0; k < 4; k++) {
    if (!(await s.tapLabel(/^🎵 マスモンを呼ぶ/, 1200))) break;
    const left = await freeLeft(s);
    const call = (await s.listButtons()).find((b) => /^呼ぶ$/.test(b.label));
    if (!call) { log.push(`${k + 1}体目: 呼べる子がいない`); await s.tapLabel(/^(閉じる|✕)$/, 800); break; }
    const before = await readBuddy(s);
    await s.tap(call, `${k + 1}体目を呼ぶ`);
    await s.wait(1200);
    await s.dismissOverlays(4);
    // 券を使う確かめの窓が出たら、使う
    const use = (await s.listButtons()).find((b) => /券.*使|使って呼ぶ|^使う$|^はい$/.test(b.label));
    if (use) { await s.tap(use, 'セッション券を使う'); await s.wait(1000); }
    const after = await readBuddy(s);
    const ticketUsed = before.tickets - after.tickets;
    log.push(`${k + 1}体目: 無料のこり${left}→ 券 ${before.tickets}→${after.tickets}`);
    if (left > 0 && ticketUsed !== 0) problems.push(`無料が残っている(あと${left}回)のに、${k + 1}体目でセッション券が ${ticketUsed}枚減った`);
    if (left === 0 && ticketUsed !== 1) problems.push(`無料を使い切ったあとの${k + 1}体目で、セッション券が ${ticketUsed}枚減った(1枚のはず)`);
    if (after.used > 3) problems.push(`無料の使った回数が ${after.used} になった(1日3回まで)`);
  }
  const called = await cpuCount(s);
  if (called < 4) log.push(`部屋に入った CPU は ${called}体`);
  // ② 1曲遊ぶ
  const stats = {};
  const played = await playInRoom(s, stats);
  // 結果を閉じて部屋を出てから、育ち具合を読む
  await s.dismissOverlays(8);
  for (let k = 0; k < 4; k++) { if (!(await s.tapLabel(/^(みんなの結果を見る|ルームへ戻る|ルームに戻る|部屋へ戻る|次へ|OK|閉じる)$/, 1500))) break; }
  await s.tapLabel(/^ルームを出る$/, 1500);
  await s.wait(1000);
  const b1 = await readBuddy(s);
  const grown = Object.keys(b1.xp).filter((id) => b1.xp[id] > (b0.xp[id] || 0));
  if (process.env.PLAYBOT_DEBUG) console.log(`    [相棒] 前 ${JSON.stringify(b0.xp)} 後 ${JSON.stringify(b1.xp)}`);
  if (played.ok && !grown.length) problems.push('一緒に1曲遊んだのに、呼んだマスモンの経験値と遊んだ回数がどれも増えていない');
  // ③ 朝5:10へ進めて開き直す
  await s.context.clock.setSystemTime(at(today, '05:10'));
  await s.boot();
  let leftAfter = null;
  if (await openRoom(s)) {
    if (await s.tapLabel(/^🎵 マスモンを呼ぶ/, 1200)) { leftAfter = await freeLeft(s); await s.tapLabel(/^(閉じる|✕)$/, 800); }
    await s.tapLabel(/^ルームを出る$/, 1500);
  }
  if (leftAfter !== null && leftAfter !== 3) problems.push(`朝5:00を過ぎて開き直したのに、今日の無料が ${leftAfter}回(3回に戻るはず)`);
  for (const p of problems) await s.addIssue('相棒の数が合わない', p);
  await s.backHome();
  return { ok: !problems.length, note: `${log.join(' / ')}・1曲遊んで経験値が増えた子 ${grown.length}体${played.ok ? '' : '(演奏できず)'}・朝5:10に開き直すと無料 ${leftAfter ?? '?'}回` };
}

module.exports = { buddyScenario };

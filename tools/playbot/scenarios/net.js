// 通信不良: にせの Supabase をわざと「つながらない」「遅い」にして、電波の弱い場所で遊んだ人と同じ目にあわせる。
//   ① つながらないまま1曲演奏する → 記録が消えずに端末へ取っておかれるか(mh_rhythm_rank_pending_v1)
//   ② つながるように戻し、ランキングの「いま送る」で送り直す → 記録が送られ、端末の控えが空になるか
//   ③ とても遅い(10秒)ままランキングを開く → 画面が止まったり真っ白になったりせず、やがて出るか
// 送り直しの仕組みは tools/mode/rhythm-ranking-pending-check.js が細かく見ている。ここは遊ぶ人の流れで通す。
// 本物のランキングへは何も届かない(にせの Supabase が受け止める・CLAUDE.md ⑦)。
const { rhythmScenario, openSoloLive } = require('./rhythm');

const pendingOf = (s) => s.page.evaluate(() => { try { const v = JSON.parse(localStorage.getItem('mh_rhythm_rank_pending_v1') || '[]'); return Array.isArray(v) ? v.length : 0; } catch { return -1; } });

async function offlinePlayScenario(s, shared) {
  // わざとつながらなくしているので、それで出るコンソールのエラーは数えない(画面が止まる・真っ白は見張り続ける)
  s.state.ignoreConsole = /503|playbot: down|Service Unavailable|fetch failed|saving locally|publish failed/;
  s.supabase.net.mode = 'down';
  const r = await rhythmScenario(s);
  const pending = await pendingOf(s);
  shared.netSong = { song: r.stats && r.stats.song, difficulty: r.stats && r.stats.difficulty };
  if (r.ok && pending < 1) await s.addIssue('記録が消える', `つながらないまま演奏を終えたのに、送れなかった記録が端末に取っておかれていない(控え ${pending}件)`);
  await s.backHome();
  return { ok: r.ok && pending >= 1, note: `つながらないまま ${shared.netSong.song} ${shared.netSong.difficulty} を演奏 → 端末の控え ${pending}件(断られた通信 ${s.supabase.net.refused}回)${r.note ? `【演奏: ${r.note}】` : ''}` };
}

async function resendScenario(s, shared) {
  s.supabase.net.mode = 'ok';
  const before = await pendingOf(s);
  const writes0 = s.supabase.writes.filter((w) => w.table === 'rankings').length;
  const picked = await openSoloLive(s, { songName: shared.netSong && shared.netSong.song, difficulty: shared.netSong && shared.netSong.difficulty });
  if (!picked) return { ok: false, note: '曲えらびまで行けない' };
  if (!(await s.tapLabel(/この曲の全国ランキング/, 2500))) { await s.addIssue('進めない', '曲えらびに「この曲の全国ランキング」が無い'); return { ok: false, note: 'ランキングを開けない' }; }
  await s.wait(2500);
  await s.inspect();
  // ★つながる状態でランキングを開くと、順位を取りに行く前に、送れていない記録を先に送る作り。「いま送る」が残っていれば押す
  const sendNow = (await s.listButtons()).find((b) => /いま送る/.test(b.label));
  if (sendNow) { await s.tap(sendNow, 'いま送る'); await s.wait(2500); }
  const after = await pendingOf(s);
  const sent = s.supabase.writes.filter((w) => w.table === 'rankings').length - writes0;
  const problems = [];
  if (before >= 1 && after !== 0) problems.push(`つながるように戻してランキングを開いても、送れていない記録が ${after}件 残っている`);
  if (before >= 1 && sent < 1) problems.push('つながるように戻しても、取っておいた記録がランキングへ送られない');
  for (const p of problems) await s.addIssue('送り直せない', p);
  await s.backHome();
  return { ok: !problems.length, note: `つながるように戻すと 控え ${before}→${after}件・送り直した記録 ${sent}件${sendNow ? '(「いま送る」を押した)' : '(開いただけで送られた)'}` };
}

async function slowScenario(s, shared) {
  s.supabase.net.mode = 'slow';
  s.supabase.net.slowMs = 10000;
  const picked = await openSoloLive(s, { songName: shared.netSong && shared.netSong.song });
  let ok = true;
  if (picked && await s.tapLabel(/この曲の全国ランキング/, 1500)) {
    // 遅いあいだに画面が真っ白・エラーにならないか(待っているあいだの表示を見る)
    await s.wait(2000);
    await s.inspect();
    await s.shot('net-slow-waiting');
    // 10秒待てば出るはず。20秒たっても読み込み中のままなら止まっている
    let shown = false;
    for (let k = 0; k < 10 && !shown; k++) {
      await s.wait(2000);
      shown = await s.page.evaluate((name) => document.body.innerText.includes(name) || /まだ記録がありません|記録はまだ|だれも/.test(document.body.innerText), s.BOT_NAME);
    }
    await s.inspect();
    if (!shown) { ok = false; await s.addIssue('遅いと止まる', '通信がとても遅い(10秒)とき、ランキングが20秒たっても出ない'); }
  }
  s.supabase.net.mode = 'ok';
  await s.backHome();
  return { ok, note: `通信が10秒遅いときのランキング: ${ok ? '待てば出た' : '出なかった'}` };
}

module.exports = { offlinePlayScenario, resendScenario, slowScenario };

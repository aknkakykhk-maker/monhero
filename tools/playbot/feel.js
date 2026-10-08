// モンヒロくんの「反応の点検」の入口(2026-10-07)。モンヒロビートを人の指(本物のタッチの合図・親指で手前を押す・
// iPhone のくせ)で演奏し、押したのに取れない・判定のずれ・ホールドが切れた、を数える。中身は lib/feel.js。
// ユーザー指示「音ゲー班が自分で遊んで、操作性や反応の悪さを直す仕組み」。音ゲー班が毎回と、演奏まわりを変えたときに回す(ROUTINE.md)。
//
//   node tools/playbot/feel.js                        いまの版で3曲(HARD)を点検
//   node tools/playbot/feel.js --compare origin/main~5   前の版(git の参照)と今の版を、同じ曲・同じ指(同じ種)で比べる
//   node tools/playbot/feel.js --songs haruka,anima --difficulty HARD --mode ios|touch|mouse --seed 7 --cpu 4
//
// 本物の Supabase へは送らない(lib/session.js のにせの Supabase が受け止める)。結果は tools/out/playbot/feel-<日時>/
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { openSession } = require('./lib/session');
const { prepareVeteran } = require('./lib/seeds');
const { openSoloLive } = require('./scenarios/rhythm');
const { installFeelPlayer, analyzeFeel } = require('./lib/feel');
const { touchInputSource } = require('./lib/touch-input');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const SONG_IDS = argOf('songs', 'haruka,stay_with_me_short,freedom_dive').split(',').map((x) => x.trim()).filter(Boolean);
const DIFFICULTY = argOf('difficulty', 'HARD');
const SEED = Number(argOf('seed', 20261007)) || 1;
const CPU = Math.max(1, Number(argOf('cpu', 1)) || 1);
const OPTS = {
  mode: argOf('mode', 'ios'),          // ios: タッチの経路+ポインタの合図が抜ける・遅れて届く / touch: タッチの経路だけ / mouse: これまでのモンヒロくん
  sigma: 22,                           // 押す時刻のばらつき(ms)
  xNoiseLanes: 0.12,                   // 押す位置の横のばらつき(レーン)
  thumb: !args.includes('--no-thumb'), // 判定ラインより手前(画面の下)を押す
  near: args.includes('--near'),        // ホールド中に近くを押すしらべ(つられを強め、すべてのホールドで指の位置と受付の余裕を記録する)
  nudgePx: args.includes('--near') ? 12 : 5,                          // ホールド中に別の指で押すと、押さえている指がつられて動く(px)
  edgeProbe: 0.35,                     // HOLD の35%は「押し始めの受付のいちばん外側」を押さえ続ける(押し始めと押さえ中の受付の食い違いを突く)
  edgeOutLanes: 0.18,                  // 端のレーンは外へはみ出し気味に押す(レーン)。つられる向きも外側(10/7 のホールドの切れは端のレーンの外側寄りで起きた)
  dropPointer: 0.15,                   // ios: ポインタの合図が抜けるタッチの割合(10/7 の実機では千ノーツあたり18ほど)
  lateRate: 0.1, lateMs: [30, 120],    // 遅れて届くタッチの割合と遅れ
};
const stamp = (() => { const d = new Date(Date.now() + 9 * 3600 * 1000); return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-'); })();
const TAG = argOf('tag', '');
const RESUME_DIRS = argOf('resume', '').split(',').map((x) => x.trim()).filter(Boolean);   // 前の途中経過(partial-*.json)があるフォルダ。終わっている曲は回さずに引き継ぐ
const ORDER_NEAR = args.includes('--order-near');   // ホールドの近くにノーツが多い曲から先に回す
const PORT_BASE = Number(argOf('port', 8982)) || 8982;
const OUT = path.join(ROOT, 'tools', 'out', 'playbot', `feel-${stamp}${TAG ? '-' + TAG : ''}`);
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const serve = (root, port) => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, () => resolve(server));
});

// 前の版に「判定を読む参照」(rhythmNoteResults)が無ければ、参照だけをいまの版から写して組み立て直す。
// ゲームの動きは前の版のまま(読むだけの参照なので、判定にも見た目にも関わらない)。作業場所は使い捨て
const ensureFeelHook = (wt) => {
  const rel = 'monster-hero/src/parts/30-rhythm-play.jsx';
  const old = fs.readFileSync(path.join(wt, rel), 'utf8');
  if (old.includes('rhythmNoteResults:')) return 'あり';
  const cur = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const start = cur.indexOf('      // 1ノーツずつの判定とずれ(読むだけ)'), end = cur.indexOf('      rhythmNotes:()=>{');
  if (start < 0 || end < 0 || !old.includes('      rhythmNotes:()=>{')) return '写せない';
  let next = old.replace('      rhythmNotes:()=>{', cur.slice(start, end) + '      rhythmNotes:()=>{');
  next = next.replace('delete window.__mhTestHooks.rhythmNotes;', 'delete window.__mhTestHooks.rhythmNotes;delete window.__mhTestHooks.rhythmNoteResults;');
  fs.writeFileSync(path.join(wt, rel), next);
  const nm = path.join(wt, 'tools', 'node_modules');
  if (!fs.existsSync(nm)) fs.symlinkSync(path.join(ROOT, 'tools', 'node_modules'), nm);
  const b = spawnSync('node', ['tools/build.js'], { cwd: wt, encoding: 'utf8' });
  return b.status === 0 ? '写して組み立てた' : `組み立てに失敗: ${(b.stderr || b.stdout).trim().split('\n').pop()}`;
};
const makeRand = (seed) => { let st = seed >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// 1つの版(root)で、曲を1つずつ新しいブラウザで演奏して数える
async function auditBuild(playwright, root, label, port) {
  const server = await serve(root, port);
  const pageUrl = `http://localhost:${port}/monster-hero/index.html`;
  const results = [];
  // 前の途中経過があれば引き継ぐ(終わっている曲は回し直さない。使用量の節約)
  const done = new Set();
  for (const dir of RESUME_DIRS) {
    let names = []; try { names = fs.readdirSync(dir).filter((f) => /^partial-.*\.json$/.test(f)); } catch { /* 無ければ引き継がない */ }
    for (const f of names) { try { for (const r of JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))) if (r.ok && !done.has(r.songId)) { results.push(r); done.add(r.songId); } } catch { /* 読めない途中経過は無いものとする */ } }
  }
  let queue = SONG_IDS.filter((id) => !done.has(id));
  const originalIndex = (id) => SONG_IDS.indexOf(id);
  // ブラウザは1つを使い回す(曲ごとに開き直さない)。曲が終わったら起動し直して(ページを読み込み直して)次の曲へ。失敗したら開き直す
  let s = null, ordered = false;
  const open = async (k) => {
    const report = { headed: args.includes('--headed'), shotNo: 0, issues: [], steps: [], screens: new Map(), issueKeys: new Set(), phases: [] };
    const rand = makeRand(SEED + k);
    const sess = await openSession({ playwright, pageUrl, port, out: OUT, rand, persona: `反応の点検(${label})`, report, ...(CPU > 1 ? { cpuSlowdown: CPU } : {}) });
    await prepareVeteran(sess, { quiet: true });
    return sess;
  };
  // 進み具合(1曲ごとに書き出す。feel-progress.js がまとめて読む)
  const startedAt = Date.now(), songMs = [];
  const progress = (note = '') => {
    const finished = results.length, all = SONG_IDS.length;
    const avg = songMs.length ? songMs.reduce((a, b) => a + b, 0) / songMs.length : 0;
    const remainMin = avg ? Math.round(((all - finished) * avg) / 60000) : null;
    const eta = remainMin == null ? null : new Date(Date.now() + remainMin * 60000 + 9 * 3600 * 1000).toISOString().slice(11, 16);
    const line = `${TAG || label} ${finished}/${all}曲目${remainMin == null ? '' : `・この組の残り約${remainMin}分・終わる見込み ${eta}(日本時間)`}${note}`;
    try { fs.writeFileSync(path.join(OUT, 'progress.json'), JSON.stringify({ tag: TAG || label, finished, all, remainMin, eta, line, updatedAt: new Date().toISOString() })); } catch { /* 書けなくても調査は続ける */ }
    console.log(`[進み具合] ${line}`);
  };
  progress();
  while (queue.length) {
    let songId = queue.shift();
    let k = originalIndex(songId);
    const t1 = Date.now();
    const row = { label, songId, difficulty: DIFFICULTY, ok: false, why: '' };
    try {
      if (!s) s = await open(k);
      await s.boot();
      // 最初の1曲だけ、ホールドの近くにノーツが多い曲から先に回すよう並べ替える(songId・k も差し替える)
      if (ORDER_NEAR && !ordered) {
        ordered = true;
        const ids = [songId, ...queue];
        const score = await s.page.evaluate(({ list, d }) => { try { return Object.fromEntries(list.map((id) => { const song = RHYTHM_SONGS.find((x) => x.songId === id); const notes = (song && song.difficulties[d] && song.difficulties[d].notes) || []; const holds = notes.filter((n) => n.type === 'HOLD'); let near = 0; notes.forEach((n) => { if (holds.some((h) => h !== n && n.timeMs > h.timeMs - 100 && n.timeMs < (h.endTimeMs || h.timeMs) + 100)) near += 1; }); return [id, near]; })); } catch { return {}; } }, { list: ids, d: DIFFICULTY });
        const sorted = [...ids].sort((x, y) => (score[y] || 0) - (score[x] || 0));
        console.log(`曲の順番(ホールドの近くのノーツが多い順): ${sorted.map((x) => `${x}:${score[x] || 0}`).join(' ')}`);
        songId = sorted[0]; queue = sorted.slice(1); k = originalIndex(songId); row.songId = songId;
      }
      const title = await s.page.evaluate((id) => { try { return (RHYTHM_SONGS.find((x) => x.songId === id) || {}).displayName || ''; } catch { return ''; } }, songId);
      if (!title) { row.why = `曲 ${songId} がこの版に無い`; throw new Error(row.why); }
      const picked = await openSoloLive(s, { songName: title, difficulty: DIFFICULTY });
      if (!picked) { row.why = '曲えらびまで行けない'; throw new Error(row.why); }
      await s.tapLabel(/^(▶\s*)?(決定|START|スタート|演奏する|演奏開始|PLAY|はじめる)$/i, 2500);
      await s.dismissOverlays(4);
      const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, { timeout: 30000 }).then(() => true).catch(() => false);
      if (!ready) { row.why = '演奏画面が開かない'; throw new Error(row.why); }
      const installed = await s.page.evaluate(installFeelPlayer, { ...OPTS, touchSrc: touchInputSource, seed: SEED * 31 + k });
      if (!installed.ok) { row.why = installed.why; throw new Error(row.why); }
      const t0 = Date.now();
      while (Date.now() - t0 < 300000) {
        await s.wait(1500);
        if (await s.page.evaluate(() => !!(window.__feel && window.__feel.done))) break;
      }
      const data = await s.page.evaluate(() => ({ presses: window.__feel.presses, results: window.__feel.results }));
      const a = analyzeFeel({ notesInfo: installed.notesInfo, presses: data.presses, results: data.results });
      Object.assign(row, { ok: true, title, ...a.summary, probes: data.presses.filter((x) => x.edgeProbe), samples: { tapMissed: a.tapMissed.slice(0, 8), drift: a.drift.slice(0, 8), stolen: a.stolen.slice(0, 8), holdBroken: a.holdBroken.slice(0, 8) } });
      console.log(`${label} ${title} ${DIFFICULTY}: 押した ${a.summary.pressed} / 押したのに取れない ${a.summary.tapMissed}(合図が抜けた ${a.summary.tapMissedDroppedPointer}・遅れた ${a.summary.tapMissedLate}) / 判定のずれ ${a.summary.driftCount}(差の中央値 ${a.summary.errorMedianMs}ms・90%が ${a.summary.errorP90AbsMs}ms 以内) / 早取り ${a.summary.stolen} / ホールドが切れた ${a.summary.holdBroken}(受付の端で押さえて切れた ${a.summary.holdBrokenAtEdge}/${a.summary.edgeProbes})`);
    } catch (e) {
      if (!row.why) row.why = e.message.split('\n')[0];
      console.log(`${label} ${songId}: 点検できなかった — ${row.why}`);
    }
    // 失敗したときだけブラウザを開き直す(成功したら次の曲でも使い回す)
    if (!row.ok && s) { await s.close().catch(() => {}); s = null; }
    results.push(row);
    songMs.push(Date.now() - t1);
    // 1曲ごとに途中経過を書いておく(長い調査の途中で止まっても、そこまでの数が残る)
    try { fs.writeFileSync(path.join(OUT, `partial-${label.replace(/[^\w]/g, '_')}.json`), JSON.stringify(results, null, 1)); } catch { /* 書けなくても調査は続ける */ }
    progress();
  }
  if (s) await s.close().catch(() => {});
  server.close();
  return results;
}

const total = (rows) => {
  const ok = rows.filter((r) => r.ok);
  const sum = (k) => ok.reduce((a, r) => a + (Number(r[k]) || 0), 0);
  const pressed = sum('pressed');
  const med = ok.map((r) => r.errorMedianMs).filter((v) => v != null).sort((a, b) => a - b);
  return { songs: ok.length, pressed, tapMissed: sum('tapMissed'), tapMissedPer1000: pressed ? Math.round(sum('tapMissed') / pressed * 10000) / 10 : 0,
    stolen: sum('stolen'), drift: sum('driftCount'), driftPer1000: pressed ? Math.round(sum('driftCount') / pressed * 10000) / 10 : 0, holdBroken: sum('holdBroken'), holdBrokenAtEdge: sum('holdBrokenAtEdge'), edgeProbes: sum('edgeProbes'),
    errorMedianMs: med.length ? med[Math.floor(med.length / 2)] : null };
};
// 前の版より悪くなったか(音ゲー班が止めて直す目安)
const worse = (before, now) => {
  const out = [];
  if (now.tapMissed - before.tapMissed >= 3 && now.tapMissedPer1000 >= before.tapMissedPer1000 * 1.5) out.push(`押したのに取れない ${before.tapMissed} → ${now.tapMissed}`);
  // 早取りは同じ版でも回ごとに 3〜8 ほど揺れる(10/7 に同じ版どうしで 7 と 12)。揺れで止めないよう、6以上かつ1.5倍で見る
  if (now.stolen - before.stolen >= 6 && now.stolen >= before.stolen * 1.5) out.push(`早取り ${before.stolen} → ${now.stolen}`);
  if (now.holdBrokenAtEdge > 0) out.push(`受付の端で押さえたホールドが切れた ${now.holdBrokenAtEdge}回(押し始めと押さえ中の受付が食い違っている)`);
  if (now.holdBroken - before.holdBroken >= 2) out.push(`ホールドが切れた ${before.holdBroken} → ${now.holdBroken}`);
  if (before.errorMedianMs != null && now.errorMedianMs != null && Math.abs(now.errorMedianMs - before.errorMedianMs) >= 10) out.push(`判定のずれの中央値 ${before.errorMedianMs} → ${now.errorMedianMs}ms`);
  if (now.drift - before.drift >= 10 && now.driftPer1000 >= before.driftPer1000 * 1.5) out.push(`判定のずれ ${before.drift} → ${now.drift}`);
  return out;
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので動かせません'); process.exit(0); }
  const compareRef = argOf('compare', '');
  const report = { stamp, seed: SEED, difficulty: DIFFICULTY, opts: OPTS, cpu: CPU, runs: {} };
  if (compareRef) {
    const wt = path.join(ROOT, 'tools', 'out', 'playbot', `feel-wt-${stamp}`);
    const add = spawnSync('git', ['worktree', 'add', '--detach', wt, compareRef], { cwd: ROOT, encoding: 'utf8' });
    if (add.status !== 0) { console.log(`前の版を出せない: ${add.stderr.trim()}`); process.exit(1); }
    const hook = ensureFeelHook(wt);
    console.log(`前の版(${compareRef})の判定を読む参照: ${hook}`);
    try { report.runs.before = await auditBuild(playwright, wt, `前(${compareRef})`, PORT_BASE + 1); }
    finally { spawnSync('git', ['worktree', 'remove', '--force', wt], { cwd: ROOT }); }
  }
  report.runs.now = await auditBuild(playwright, ROOT, '今', PORT_BASE);
  const now = total(report.runs.now);
  const before = report.runs.before ? total(report.runs.before) : null;
  report.total = { now, before };
  report.worse = before ? worse(before, now) : [];
  fs.writeFileSync(path.join(OUT, 'feel.json'), JSON.stringify(report, null, 2));
  const line = (t, x) => `- ${t}: ${x.songs}曲・${x.pressed}回押した / 押したのに取れない ${x.tapMissed}(千回あたり ${x.tapMissedPer1000}) / 判定のずれ ${x.drift}(千回あたり ${x.driftPer1000}・差の中央値 ${x.errorMedianMs}ms) / 早取り ${x.stolen} / ホールドが切れた ${x.holdBroken}(受付の端で押さえて切れた ${x.holdBrokenAtEdge}/${x.edgeProbes})`;
  const md = [`# モンヒロくんの反応の点検 ${stamp}`, '',
    `- 指: ${OPTS.mode}${OPTS.thumb ? '・親指で手前を押す' : ''}・ホールド中のつられ ${OPTS.nudgePx}px・端は外へ ${OPTS.edgeOutLanes}レーン${OPTS.mode === 'ios' ? `・ポインタの合図が抜ける ${OPTS.dropPointer * 100}%・遅れて届く ${OPTS.lateRate * 100}%(${OPTS.lateMs.join('〜')}ms)` : ''}${CPU > 1 ? `・CPU ${CPU}倍遅い` : ''} / 種 ${SEED} / ${DIFFICULTY}`,
    ...(before ? [line(`前(${compareRef})`, before)] : []), line('今', now),
    ...(before ? ['', report.worse.length ? `## ⚠ 前の版より悪くなった\n\n${report.worse.map((w) => `- ${w}`).join('\n')}` : '## 前の版より悪くなったところは無い'] : []),
    '', '## 曲ごと', '',
    ...[...(report.runs.before || []), ...report.runs.now].map((r) => r.ok
      ? `- ${r.label} ${r.title} ${r.difficulty}: 押した ${r.pressed} / 取れない ${r.tapMissed}(合図が抜けた ${r.tapMissedDroppedPointer}・遅れた ${r.tapMissedLate}) / ずれ ${r.driftCount}(中央値 ${r.errorMedianMs}ms・90%が ${r.errorP90AbsMs}ms 以内) / 早取り ${r.stolen} / ホールドが切れた ${r.holdBroken}`
      : `- ${r.label} ${r.songId}: 点検できなかった — ${r.why}`),
    '', '## ホールド中に近くを押したとき(ホールドの数 / 近くを押した回数[同じ帯・隣・離れた] / 近くを押したホールド / 切れた / うち近くを押して切れた / 切れたうち指がずっと受付範囲の中だった)', '',
    ...report.runs.now.filter((r) => r.ok).map((r) => `- ${r.title} ${r.difficulty}: ホールド ${r.holds} / 近く ${r.nearPresses}回[${r.nearSame}・${r.nearAdjacent}・${r.nearFar}] / 近くを押したホールド ${r.holdsWithNear} / 切れた ${r.holdBroken} / 近くを押して切れた ${r.holdBrokenWithNear} / ずっと範囲内だったのに切れた ${r.holdBrokenAccepted}(うち近く ${r.holdBrokenAcceptedWithNear}) / ホールド中に押したタップの取れない ${r.tapMissedDuringHold}`),
    '', '## 例(1曲につき8件まで)', '',
    ...report.runs.now.filter((r) => r.ok).flatMap((r) => [
      ...r.samples.tapMissed.map((x) => `- 取れない ${r.title} ${x.timeMs}ms ${x.type}: 押したずれ ${x.botDelta}ms${x.dropPointer ? '・ポインタの合図なし' : ''}${x.lateMs ? `・${x.lateMs}ms遅れて届いた` : ''} (x${x.x}, y${x.y})`),
      ...r.samples.holdBroken.map((x) => `- ホールドが切れた ${r.title} ${x.timeMs}〜${x.endTimeMs}ms ${x.type}: ${x.cutAtMs}ms で切れた(指を離したのは ${x.releasedAtMs ?? '-'}ms・押し始め ${x.holdJudgment}・最後 ${x.judgment})・押したずれ ${x.botDelta}ms${x.dropPointer ? '・ポインタの合図なし' : ''}${x.edgeProbe ? '・受付の端で押さえた' : ''} (x${x.x}, y${x.y})`),
      ...r.samples.stolen.map((x) => `- 早取り ${r.title} ${x.timeMs}ms ${x.type}: 押したずれ ${x.botDelta}ms → 判定は ${x.gameDelta}ms(ほかの押下に取られた)`),
      ...r.samples.drift.map((x) => `- ずれ ${r.title} ${x.timeMs}ms ${x.type}: 押したずれ ${x.botDelta}ms → 判定は ${x.gameDelta}ms${x.dropPointer ? '・ポインタの合図なし' : ''}${x.lateMs ? `・${x.lateMs}ms遅れて届いた` : ''}`),
    ]), ''].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);
  console.log(`\n${before ? (report.worse.length ? `⚠ 前の版より悪くなった: ${report.worse.join(' / ')}` : '前の版より悪くなったところは無い') : ''}\n報告: ${path.relative(ROOT, path.join(OUT, 'report.md'))}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

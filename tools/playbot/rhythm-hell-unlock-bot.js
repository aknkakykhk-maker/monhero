// 難易度 HELL の開き方(案A)を、人と同じ手順で通して確かめるボット(2026-10-12)。
// 社長の決定「その曲の MASTER をクリアすると、その曲の HELL が開く」。初めて開いたときは、結果画面を閉じたら
// お話「空まで届くビート」→ 説明(RhythmHellGuide)が出て、一度見たら次からは出ない。
// ★公開の印 RELEASE_FLAGS.rhythmHell は偽のまま。デバッグの「公開の印が真だったら」(mh_rhythm_hell_preview_proto)で試す。
//
//   node tools/playbot/rhythm-hell-unlock-bot.js            印が偽のときに出ないこと+開く流れ(MASTER を2回演奏・約6分)
//   node tools/playbot/rhythm-hell-unlock-bot.js --quick    印が偽で出ない・試すと鍵つきで出る・ノーツ数が試作と同じ、まで(演奏しない)
//   node tools/playbot/rhythm-hell-unlock-bot.js --story    お話を「公開した日に全員へ」(RHYTHM_HELL_STORY_TRIGGER='release')と、空中の道の既定(演奏しない)
//   --song grievous_lady                                    曲を変える(既定は sheriruth。RHYTHM_HELL_CHARTS にある曲)
//
// 確かめること:
//   ① 印が偽: Sheriruth に HELL が無い(曲えらびにも数え上げにも出ない)
//   ② 印が真(試す): HELL は「MASTERで解放」の鍵つきで出る
//   ③ MASTER を人の指で演奏してクリア → 結果画面に「HELL が解放されました」
//   ④ 曲えらびへ戻る → お話が出る → 飛ばしても説明が出る → 説明を閉じると曲えらびへ戻り、HELL が選べる
//   ⑤ 既読は試し用のキーに付き、本番のキー(mh_rhythm_hell_story_seen_v1)には付かない
//   ⑥ もう一度 MASTER を初めてクリアした形にしても(記録の MASTER のクリアを外す)、お話は2回目は出ない
// 本物の Supabase へは送らない(lib/session.js のにせの Supabase が受け止める)。
const http = require('http');
const fs = require('fs');
const path = require('path');
const { openSession } = require('./lib/session');
const { prepareVeteran } = require('./lib/seeds');
const { openSoloLive } = require('./scenarios/rhythm');
const { installFeelPlayer } = require('./lib/feel');
const { touchInputSource } = require('./lib/touch-input');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const QUICK = args.includes('--quick');
const STORY = args.includes('--story');
const argOf = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback; };
const SONG_ID = argOf('song', 'sheriruth');
// 試作の枠で同じ譜面を持っている所(ノーツ数を突き合わせる)
const PROTO_OF = { sheriruth: ['sheriruth_hell_debug', 'HELL'], grievous_lady: ['grievous_lady_hell', 'MASTER'], kaze_ga_soyogu: ['kaze_ga_soyogu_hell_debug', 'HELL'] };
const PORT = 8991;
const OUT = path.join(ROOT, 'tools', 'out', 'playbot', 'hell-unlock');
fs.mkdirSync(OUT, { recursive: true });
// 人の指で押す。MASTER をクリアできる程度に落ち着いて押す(iPhone のくせは入れない)
const OPTS = { mode: 'touch', sigma: 12, xNoiseLanes: 0.06, thumb: true, stall: false, near: false, nudgePx: 0, edgeProbe: 0, edgeOutLanes: 0, dropPointer: 0, lateRate: 0, lateMs: [30, 120], lateDist: 'real' };

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!cond) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
const makeRand = (seed) => { let st = seed >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// その曲の HELL の見え方(数え上げに出るか・難易度の一覧に出るか・譜面があるか)
const hellState = (s) => s.page.evaluate((id) => {
  const song = RHYTHM_SONGS.find((x) => x.songId === id);
  return { keys: Object.keys(song.difficulties).includes('HELL'), defs: rhythmSongDifficultyDefs(song).some((d) => d.id === 'HELL'),
    chart: !!(song.difficulties.HELL && song.difficulties.HELL.notes && song.difficulties.HELL.notes.length), open: rhythmHellOpen(), released: rhythmHellReleased() };
}, SONG_ID);
const storage = (s) => s.page.evaluate(() => ({ preview: localStorage.getItem('mh_rhythm_hell_story_seen_preview_proto'), real: localStorage.getItem('mh_rhythm_hell_story_seen_v1'),
  best: (() => { try { return JSON.parse(localStorage.getItem('mh_rhythm_best_v1') || '{}').sheriruth || null; } catch { return null; } })() }));

// MASTER を人の指で最後まで演奏する。クリアしたか(結果画面の表示)を返す
async function playMaster(s, title) {
  const picked = await openSoloLive(s, { songName: title, difficulty: 'MASTER', strict: true });
  if (!picked || picked.difficulty !== 'MASTER') return { ok: false, why: `曲えらびで ${title} の MASTER を選べない(${JSON.stringify(picked)})` };
  await s.tapLabel(/^(▶\s*)?(決定|START|スタート|演奏する|演奏開始|PLAY|はじめる)$/i, 2500);
  await s.dismissOverlays(4);
  const ready = await s.page.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && window.__mhTestHooks && typeof window.__mhTestHooks.rhythmNotes === 'function' && (window.__mhTestHooks.rhythmNotes() || []).length > 0, null, { timeout: 60000 }).then(() => true).catch(() => false);
  if (!ready) return { ok: false, why: '演奏画面が開かない' };
  const installed = await s.page.evaluate(installFeelPlayer, { ...OPTS, touchSrc: touchInputSource, seed: 20261012 });
  if (!installed.ok) return { ok: false, why: installed.why };
  const t0 = Date.now();
  while (Date.now() - t0 < 330000) {
    await s.wait(1500);
    if (await s.page.evaluate(() => !![...document.querySelectorAll('button')].find((b) => /曲えらびへ戻る/.test(b.innerText || '')))) break;
  }
  await s.wait(1200);
  const result = await s.page.evaluate(() => ({ unlock: document.querySelector('[data-rhythm-result-unlock]')?.getAttribute('data-rhythm-result-unlock') || '',
    text: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 400) }));
  await s.page.screenshot({ path: path.join(OUT, `result-${Date.now()}.png`) });
  return { ok: true, notes: installed.notes, ...result };
}
// 結果画面から曲えらびへ戻り、出てきたものを見る
async function backFromResult(s) {
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => /曲えらびへ戻る/.test(b.innerText || ''))?.click());
  await s.wait(1500);
  return s.page.evaluate(() => ({ story: !!document.querySelector('[role="dialog"][aria-label^="イベント回想: 空まで届くビート"]'), guide: !!document.querySelector('[data-rhythm-hell-guide]') }));
}

// 起動して HOME まで進む。★s.boot は途中の窓を閉じてしまうので、お話を見るときは自分で進める
async function bootKeepStory(s) {
  await s.boot({ toHome: false });
  await s.tapLabel(/トップ画面へ進む/, 2200);
}
const storyShown = (s) => s.page.evaluate(() => !!document.querySelector('[role="dialog"][aria-label^="イベント回想: 空まで届くビート"]'));
// ほかのお話(タクティクスの導入など)が先に流れたら、人と同じく「スキップ」で進めてから HELL のお話を待つ
async function waitStory(s, ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (await storyShown(s)) return true;
    await s.page.evaluate(() => { const d = document.querySelector('[role="dialog"][aria-label^="イベント回想: "]'); if (d) [...d.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'スキップ')?.click(); });
    await s.wait(500);
  }
  return false;
}
// 公開した日に全員へ: MASTER のクリアとは関係なく、HOME に着いたらお話 → 説明を1回だけ
async function storyScenario(s) {
  const trig = await s.page.evaluate(() => ({ trigger: RHYTHM_HELL_STORY_TRIGGER, sky: RHYTHM_SKY_LANE_LOOK.id }));
  ok('お話の流し方の既定は「公開した日に全員へ」(release)', trig.trigger === 'release', trig.trigger);
  ok('空中の道の既定は「案E はっきり」(em)', trig.sky === 'em', trig.sky);
  // 公開(RELEASE_FLAGS.rhythmHell が真)のあとは「印が偽」の項目は確かめない(2026-10-13 HELL 公開)
  const relStory = await s.page.evaluate(() => typeof RELEASE_FLAGS === 'object' && RELEASE_FLAGS.rhythmHell === true);
  if (!relStory) ok('印が偽: HOME に着いてもお話は出ない', !(await waitStory(s, 6000)));
  await s.page.evaluate(() => localStorage.setItem('mh_rhythm_hell_preview_proto', '1'));
  await bootKeepStory(s);
  const shown = await waitStory(s, 20000);
  ok('印が真(試す): HOME に着くと、MASTER をクリアしていなくてもお話が出る', shown);
  await s.page.screenshot({ path: path.join(OUT, 'release-story.png') });
  await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'スキップ')?.click());
  await s.wait(800);
  ok('お話のあと(飛ばしても)説明が出る', await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]')));
  for (let i = 0; i < 8 && (await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]'))); i++) {
    await s.page.evaluate(() => { const g = document.querySelector('[data-rhythm-hell-guide]'); const b = [...g.querySelectorAll('button')].reverse().find((x) => x.offsetParent); b?.click(); });
    await s.wait(500);
  }
  ok('説明を最後まで進めると閉じる', !(await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]'))));
  const st = await storage(s);
  ok('既読は試し用のキーに付き、本番のキーには付かない', st.preview === 'true' && st.real === null, `試し用 ${st.preview} / 本番 ${st.real}`);
  ok('MASTER を遊ばずに済んだ(記録に MASTER のクリアは無い)', !(st.best && st.best.MASTER && st.best.MASTER.clear === true));
  await bootKeepStory(s);
  ok('読み込み直しても、お話は2回目は出ない', !(await waitStory(s, 10000)));
  const sky = await s.page.evaluate(() => RHYTHM_SKY_LANE_LOOK.id);
  ok('空中の道の既定は、試したあとも em のまま', sky === 'em', sky);
}

(async () => {
  const playwright = require('playwright');
  const server = await serve();
  const report = { headed: false, shotNo: 0, issues: [], steps: [], screens: new Map(), issueKeys: new Set(), phases: [] };
  const s = await openSession({ playwright, pageUrl: `http://localhost:${PORT}/monster-hero/index.html`, port: PORT, out: OUT, rand: makeRand(7), persona: 'HELL の開き方', report, viewport: { width: 844, height: 390 } });
  try {
    await prepareVeteran(s, { quiet: true });
    if (STORY) { await bootKeepStory(s); await s.wait(3000); await storyScenario(s); throw Object.assign(new Error('quick'), { quick: true }); }
    await s.boot();
    // ① 印が偽
    const off = await hellState(s);
    if (off.released !== true) {
      ok('印が偽: 公開の印は偽のまま', off.released === false && off.open === false);
      ok(`印が偽: ${SONG_ID} に HELL は出ない(譜面・難易度の一覧・数え上げのどれにも)`, !off.chart && !off.defs && !off.keys, JSON.stringify(off));
    }
    // ② 印が真(試す)。HARD・EXPERT はクリア済み、MASTER は未クリアの記録にする
    await s.page.evaluate(() => localStorage.setItem('mh_rhythm_hell_preview_proto', '1'));
    await s.boot();
    const on = await hellState(s);
    ok('印が真(試す): HELL の譜面が出る', on.open && on.chart && on.defs, JSON.stringify(on));
    ok('印が真(試す): 数え上げ(Object.keys)には出ない(レベル表・集計を変えない)', !on.keys);
    const counts = await s.page.evaluate(([id, proto]) => { const a = RHYTHM_SONGS.find((x) => x.songId === id).difficulties.HELL, b = RHYTHM_PROTO_SONGS.find((x) => x.songId === proto[0]); const c = b && b.difficulties[proto[1]];
      return { hell: a ? a.notes.length : 0, proto: c ? c.notes.length : null, sky: a ? a.notes.filter((n) => rhythmNoteIsSky(n)).length : 0, level: a ? a.level : null }; }, [SONG_ID, PROTO_OF[SONG_ID] || ['', '']]);
    ok('印が真(試す): HELL の譜面は試作の枠と同じ(ノーツ数)・空中のノーツがある', counts.hell > 0 && counts.hell === counts.proto && counts.sky > 0, JSON.stringify(counts));
    const title = await s.page.evaluate((id) => rhythmSongFullName(RHYTHM_SONGS.find((x) => x.songId === id)), SONG_ID);
    const lock = await s.page.evaluate((id) => { const all = JSON.parse(localStorage.getItem('mh_rhythm_best_v1') || '{}'); return rhythmDifficultyUnlocked(id, 'HELL', all) ? 'open' : rhythmDifficultyUnlockRequirement('HELL', id); }, SONG_ID);
    ok('印が真(試す): MASTER を未クリアなら HELL は鍵つき(MASTERで解放)', lock === 'MASTER', lock);
    if (QUICK) throw Object.assign(new Error('quick'), { quick: true });
    // ③ MASTER をクリア(openSoloLive が HARD・EXPERT のクリアを入れる)
    const r1 = await playMaster(s, title);
    ok('MASTER を最後まで演奏できる', r1.ok, r1.why || `${r1.notes}ノーツ`);
    ok('結果画面に「HELL が解放されました」', /HELL/.test(r1.unlock || ''), r1.unlock || r1.text);
    // ④ 戻る。お話の流し方(RHYTHM_HELL_STORY_TRIGGER)で確かめることが変わる。
    //   'after-result' … 結果画面を閉じたらお話 → 飛ばしても説明 → 閉じる
    //   'release'(2026-10-12 社長の決定・既定) … お話は公開後に HOME へ着いたとき全員へ(--story が確かめる)。結果画面のあとには出ない
    const trigger = await s.page.evaluate(() => RHYTHM_HELL_STORY_TRIGGER);
    const after = await backFromResult(s);
    if (trigger === 'after-result') {
      ok('曲えらびへ戻ると、お話「空まで届くビート」が出る', after.story, JSON.stringify(after));
      await s.page.screenshot({ path: path.join(OUT, 'story.png') });
      await s.page.evaluate(() => [...document.querySelectorAll('button')].find((b) => (b.innerText || '').trim() === 'スキップ')?.click());
      await s.wait(800);
      const guide = await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]'));
      ok('お話を飛ばしても、説明(HELL の遊び方)は出る', guide);
      await s.page.screenshot({ path: path.join(OUT, 'guide.png') });
      for (let i = 0; i < 8 && (await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]'))); i++) {
        await s.page.evaluate(() => { const g = document.querySelector('[data-rhythm-hell-guide]'); const b = [...g.querySelectorAll('button')].reverse().find((x) => x.offsetParent); b?.click(); });
        await s.wait(500);
      }
      ok('説明を最後まで進めると閉じる', !(await s.page.evaluate(() => !!document.querySelector('[data-rhythm-hell-guide]'))));
    } else {
      ok(`お話の流し方が「${trigger}」なので、曲えらびへ戻ってもお話も説明も出ない(HOME で流す・--story で確かめる)`, !after.story && !after.guide, JSON.stringify(after));
    }
    const st1 = await storage(s);
    if (trigger === 'after-result') ok('既読は試し用のキーに付く', st1.preview === 'true', String(st1.preview));
    ok('本番の既読のキー(mh_rhythm_hell_story_seen_v1)には付かない', st1.real === null, String(st1.real));
    ok('MASTER のクリアが記録に残る', !!(st1.best && st1.best.MASTER && st1.best.MASTER.clear === true));
    const sel = await s.page.evaluate(() => [...document.querySelectorAll('button')].map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()).filter((t) => /HELL/.test(t)));
    ok('曲えらびで HELL が選べる(「MASTERで解放」ではない)', sel.length > 0 && !sel.some((t) => /MASTERで解放/.test(t)), sel.join(' / '));
    await s.page.screenshot({ path: path.join(OUT, 'select-after.png') });
    // ⑥ もう一度「MASTER を初めてクリア」にしても、お話は2回目は出ない
    await s.page.evaluate(() => { const all = JSON.parse(localStorage.getItem('mh_rhythm_best_v1') || '{}'); if (all.sheriruth) delete all.sheriruth.MASTER; localStorage.setItem('mh_rhythm_best_v1', JSON.stringify(all)); });
    await s.boot();
    const r2 = await playMaster(s, title);
    ok('2回目: MASTER をクリアすると、結果画面には HELL の解放が出る', r2.ok && /HELL/.test(r2.unlock || ''), r2.why || r2.unlock);
    const after2 = await backFromResult(s);
    ok('2回目: お話も説明も出ない(一度見たら次からは出ない)', !after2.story && !after2.guide, JSON.stringify(after2));
  } catch (e) { if (!e.quick) ok('最後まで進められる', false, e.message.split('\n')[0]); }
  finally { try { await s.close?.(); } catch {} try { await s.browser?.close(); } catch {} server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

#!/usr/bin/env node
// モンヒロビートの演奏画面の「止まって飛ぶ」(1コマが長くなってノーツが止まり、追いついたときに先へ飛ぶ)を数える重さの検査。
// 2026-11-21 社長「モンビーは重さチェックもちゃんとしたほうがいい」(r1119-058)。測り方は調べ #7020
// (docs/progress/kensa/beat-freeze-2026-11/)と同じ: 本物の演奏画面・CPU を遅くして・50ms を超えるコマの回数と長さ。
//
//   node tools/mode/rhythm-stall-check.js                       … いまの作業ツリーと origin/main を比べる(演奏画面の直しのたび)
//   node tools/mode/rhythm-stall-check.js --song <曲id>         … 新曲を足したとき。前の版に無い曲は、同じ回で測る基準の曲と比べる
//   オプション: --diff HARD(難易度) --runs 3(それぞれ何回) --rate 4(CPU を何倍遅く) --sec 12(曲の何秒目まで)
//              --base origin/main(比べる版) --no-base(比べずに数だけ出す) --json(全部の数字)
//
// 前の版は丸ごと写さない。monster-hero/ の中で前の版と違うファイルだけを git から返し、ほかは同じファイルを返す。
// 曲の音の時計で進むので、測るのは「曲が鳴り始めてから --sec 秒目まで」のコマ(カウントダウンの間はノーツが動かないので数えない)。
// 端末の混み具合で数がぶれるので、前の版と交互に --runs 回ずつ測り、真ん中の値で比べる。
// NG: 止まり(50ms 超)の回数か、最大の止まりが、前の版より決まった幅を超えて増えたとき。
// Tone.js(効果音の部品)は cdnjs に出られない環境があるので、npm の tone@14.8.49 を一度だけ取って置き場から返す。
//
// run-checks-timeout: 1500
'use strict';
const fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9417, BASE_PORT = 9418;
const { installPlayer, installArgs } = require(path.join(ROOT, 'tools/playbot/scenarios/rhythm'));
const { eventStorySeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed'));

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const REF_SONG = 'crossing_field';
const SONG = opt('--song', REF_SONG), DIFF = opt('--diff', 'HARD').toUpperCase();
const RUNS = Math.max(1, Number(opt('--runs', 3)) || 3), RATE = Math.max(1, Number(opt('--rate', 4)) || 4);
const SEC = Math.max(3, Number(opt('--sec', 12)) || 12), BASE_REF = opt('--base', 'origin/main');
const NO_BASE = argv.includes('--no-base'), JSON_OUT = argv.includes('--json');
// 増えたとみなす幅(同じ版どうしを何度か測ったぶれより広くとる)
const ALLOW_COUNT = (base) => Math.max(2, Math.ceil(base * 0.3));
const ALLOW_WORST_MS = 100;

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'buffer', maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'ignore'] });

// ---- Tone.js の置き場 ----
const toneJs = () => {
  const dir = path.join(os.tmpdir(), 'mh-tone-14.8.49'), file = path.join(dir, 'package', 'build', 'Tone.js');
  if (fs.existsSync(file)) return fs.readFileSync(file);
  try {
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('npm', ['pack', 'tone@14.8.49', '--silent'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] });
    execFileSync('tar', ['xzf', 'tone-14.8.49.tgz'], { cwd: dir });
    return fs.readFileSync(file);
  } catch (e) { return null; }
};

// ---- 配る口(いまの版 / 前の版) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const serve = (port, baseRef) => new Promise((resolve, reject) => {
  let changed = new Set(), added = new Set();
  if (baseRef) {
    changed = new Set(git('diff', '--name-only', baseRef, '--', 'monster-hero').toString().split('\n').filter(Boolean));
    added = new Set(git('ls-files', '--others', '--exclude-standard', '--', 'monster-hero').toString().split('\n').filter(Boolean));
  }
  const sv = http.createServer((q, s) => {
    const rel = decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '');
    const f = path.join(ROOT, rel);
    const type = MIME[path.extname(f)] || 'application/octet-stream';
    if (!f.startsWith(ROOT + path.sep)) { s.writeHead(404); s.end(); return; }
    if (baseRef && added.has(rel)) { s.writeHead(404); s.end(); return; }
    if (baseRef && changed.has(rel)) {
      let body = null; try { body = git('show', `${baseRef}:${rel}`); } catch (e) { body = null; }
      if (!body) { s.writeHead(404); s.end(); return; }
      s.writeHead(200, { 'Content-Type': type }); s.end(body); return;
    }
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
    s.writeHead(200, { 'Content-Type': type }); fs.createReadStream(f).pipe(s);
  });
  sv.on('error', reject);
  sv.listen(port, () => resolve({ sv, changed: changed.size }));
});

// ---- 1回測る ----
const OWNED = ['amakakeru_tsubasa', 'dr_wily_stage_1', 'dr_wily_stage_1_okkussenman', 'gourmet_race_64', 'gourmet_race_dx', 'eiyuu_no_akashi', 'eiyuu_no_akashi_milktea', 'departure', 'rpg', 'midnight_studio', 'hopes_and_dreams', 'sparkling_pink_overture'];
async function measureOnce(browser, port, songId, tone) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  try {
    await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/tone\//, (r) => tone ? r.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'Access-Control-Allow-Origin': '*' }, body: tone }) : r.abort());
    await ctx.route(/supabase\.co/, (r) => /rest\/v1/.test(r.request().url()) ? r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }) : r.abort());
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const p = await ctx.newPage();
    await p.addInitScript((ids) => {
      window.__mhSupabaseStubbed = true;
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      ['mh_intro_done', 'mh_onboarded', 'mh_tutorial_seen_v1', 'mh_battle_tutorial_seen_v1', 'mh_battle_tutorial_guide_shown_v1', 'mh_assistant_unlock_seen_v1', 'mh_update_notice_seen_v1', 'mh_rhythm_tutorial_seen_v1', 'mh_rhythm_hell_story_seen_v1', 'mh_inherited_unique_level_compensation_v1', 'mh_masu_level_cap_compensation_notice_seen_v1'].forEach(k => put(k, true));
      put('mh_breeder_name', 'モンヒロくん'); put('mh_breeder_icon', '🐣'); put('mh_rhythm_owned_songs_v1', ids);
      // 測りの口: コマの間隔(曲が鳴り始めてから)を、曲の何秒目かと一緒に残す
      const pf = window.__pf = { on: false, song: [], pre: 0 };
      let last = 0;
      const loop = (t) => {
        if (last && pf.on) {
          let sm = null; try { sm = window.__mhTestHooks.rhythmSongMs(); } catch (e) { sm = null; }
          const dt = t - last;
          if (Number.isFinite(sm) && sm > 0) pf.song.push([Math.round(dt * 10) / 10, Math.round(sm)]);
          else if (dt > 50) pf.pre++;
        }
        last = t; requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, OWNED.includes(songId) ? OWNED : [...OWNED, songId]);
    await p.addInitScript(eventStorySeed());
    await p.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    await p.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await p.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await p.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await p.waitForFunction(() => !!document.querySelector('main.mh-home-scene'), null, { timeout: 60000 });
    await p.waitForTimeout(1500);
    for (let i = 0; i < 10; i++) {
      const ok = await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(受け取る|閉じる|OK|確認|スキップ|あとで読む)$/.test((x.innerText || '').trim()) && x.getClientRects().length); if (b) b.click(); return !!b; });
      if (!ok) break; await p.waitForTimeout(500);
    }
    await p.evaluate(() => document.querySelector('[data-home-fac="rhythm"]')?.click());
    await p.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 }); await p.waitForTimeout(800);
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /ソロライブ/.test(b.innerText || ''))?.click());
    await p.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 }); await p.waitForTimeout(800);
    const exact = p.locator(`[data-rhythm-song-row="${songId}"]`).first();
    const row = (await exact.count()) ? exact : p.locator(`[data-rhythm-song-row^="${songId.replace(/_(short|full|okkussenman|milktea|64|dx)$/, '')}"]`).first();
    if (!(await row.count())) return { missing: true };
    await row.scrollIntoViewIfNeeded(); await row.click(); await p.waitForTimeout(600);
    const ver = p.locator(`[data-rhythm-song-version="${songId}"]`).first();
    if (await ver.count()) { await ver.click(); await p.waitForTimeout(600); }
    const picked = await p.evaluate((d) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp('^\\d+ ' + d + '\\b').test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b && !b.disabled) { b.click(); return true; } return false; }, DIFF);
    if (!picked) return { missing: true, why: `難易度 ${DIFF} を選べない(鍵が開いていない・譜面が無い)` };
    await p.waitForTimeout(800);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    await p.evaluate(() => { window.__pf.on = true; document.querySelector('[data-rhythm-demo-start]').click(); });
    await p.waitForFunction(() => !!document.querySelector('[data-rhythm-play-area]') && (window.__mhTestHooks.rhythmNotes() || []).length > 0, null, { timeout: 90000 });
    await p.evaluate(installPlayer, { ...installArgs({ rand: Math.random }), sigma: 4, missRate: 0, dropRate: 0, lateRate: 0 });
    await p.waitForFunction((ms) => { const s = window.__pf.song; return s.length && s[s.length - 1][1] >= ms; }, SEC * 1000, { timeout: (SEC + 60) * 1000, polling: 500 });
    const r = await p.evaluate(() => ({ song: window.__pf.song, pre: window.__pf.pre }));
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => {});
    const frames = r.song.filter(([, sm]) => sm <= SEC * 1000);
    const stalls = frames.filter(([dt]) => dt > 50);
    return {
      frames: frames.length, over50: stalls.length, over100: stalls.filter(([dt]) => dt > 100).length,
      worst: Math.round(Math.max(0, ...stalls.map(([dt]) => dt))),
      // 止まりの時刻(曲の何秒目・何ms)。長い順に上から
      top: stalls.sort((a, b) => b[0] - a[0]).slice(0, 4).map(([dt, sm]) => `${(sm / 1000).toFixed(1)}s:${Math.round(dt)}ms`),
      preStalls: r.pre,
    };
  } finally { await ctx.close().catch(() => {}); }
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : 0; };
const sumUp = (runs) => ({ over50: median(runs.map(r => r.over50)), over100: median(runs.map(r => r.over100)), worst: median(runs.map(r => r.worst)) });
const line = (label, runs) => { const m = sumUp(runs); return `${label}: 止まり(50ms超) ${m.over50}回・100ms超 ${m.over100}回・最大 ${m.worst}ms  [各回 ${runs.map(r => `${r.over50}/${r.worst}ms`).join(' ')}]`; };

(async () => {
  let playwright; try { playwright = require('playwright'); } catch (e) { console.log('NG: playwright が読めない'); process.exit(1); }
  const tone = toneJs();
  if (!tone) console.log('注意: Tone.js を取れなかった(効果音なしで測る。前の版も同じ条件)');
  let baseRef = NO_BASE ? null : BASE_REF;
  if (baseRef) { try { git('rev-parse', '--verify', '--quiet', baseRef); } catch (e) { console.log(`注意: ${baseRef} が無いので比べずに測る`); baseRef = null; } }
  const head = await serve(PORT, null);
  const base = baseRef ? await serve(BASE_PORT, baseRef) : null;
  // ★1回ごとに新しいブラウザで測る。同じブラウザを使い回すと、あとに測る側が前の回の読み解き済みの JS を使えて軽く出る
  //   (同じ版どうしで「先に測った側だけ止まりが多い」になった)。前後の順も1回ごとに入れ替える
  const once = async (port, songId) => {
    const args = ['--autoplay-policy=no-user-gesture-required'];
    const exe = '/opt/pw-browsers/chromium';
    const browser = await playwright.chromium.launch(fs.existsSync(exe) ? { executablePath: exe, args } : { args });
    try { return await measureOnce(browser, port, songId, tone); } finally { await browser.close().catch(() => {}); }
  };
  const res = { head: [], base: [], headRef: [] };
  let songInBase = !!base, failed = 0;
  try {
    for (let i = 0; i < RUNS; i++) {
      const runBase = async () => { if (!base || !songInBase) return; const b = await once(BASE_PORT, SONG); if (b.missing) songInBase = false; else res.base.push(b); };
      if (i % 2 === 1) await runBase();
      const h = await once(PORT, SONG);
      if (h.missing) { console.log(`NG: ${h.why || `曲 ${SONG} が曲えらびに無い`}`); process.exitCode = 1; return; }
      res.head.push(h);
      if (i % 2 === 0) await runBase();
      // 前の版に無い曲(新曲)は、同じ回の基準の曲と比べる
      if (!songInBase && SONG !== REF_SONG) res.headRef.push(await once(PORT, REF_SONG));
    }
  } finally { head.sv.close(); if (base) base.sv.close(); }

  console.log(`曲 ${SONG} ${DIFF}・CPU ${RATE}倍遅く・曲の0〜${SEC}秒目・各${RUNS}回(真ん中の値)`);
  console.log(line('いまの版', res.head));
  let cmp = null, cmpLabel = '';
  if (res.base.length) { cmp = res.base; cmpLabel = `前の版(${baseRef}・違うファイル ${base.changed} 個)`; }
  else if (res.headRef.length) { cmp = res.headRef; cmpLabel = `基準の曲 ${REF_SONG}(いまの版)`; }
  if (cmp) {
    console.log(line(cmpLabel, cmp));
    const h = sumUp(res.head), c = sumUp(cmp);
    const countUp = h.over50 > c.over50 + ALLOW_COUNT(c.over50), worstUp = h.worst > c.worst + ALLOW_WORST_MS;
    console.log(`${countUp ? 'NG' : 'OK'}: 止まりの回数が増えていない(${c.over50} → ${h.over50}・許す幅 +${ALLOW_COUNT(c.over50)})`);
    console.log(`${worstUp ? 'NG' : 'OK'}: 最大の止まりが伸びていない(${c.worst}ms → ${h.worst}ms・許す幅 +${ALLOW_WORST_MS}ms)`);
    if (countUp || worstUp) failed++;
  } else console.log('(比べる版なし。数だけ)');
  const worstRun = [...res.head].sort((a, b) => b.worst - a.worst)[0];
  if (worstRun && worstRun.top.length) console.log(`いまの版のいちばん重い回の止まり: ${worstRun.top.join(' ')}`);
  if (JSON_OUT) console.log(JSON.stringify(res));
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.log('NG: 測れなかった — ' + String(e && e.message || e).split('\n')[0]); process.exit(1); });

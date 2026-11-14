#!/usr/bin/env node
// モンサクのトレーニング・修行の演出を、本物の画面の流れで録って mp4 にする(見本を社長に見せる用・2026-11-14 クラフトくん8)。
//   OUT=<フォルダ> [TONE_JS=<Tone.js の場所>] node docs/progress/player-raise/wip/rec-motion.js [life:1 pow:3 eva:1 shugyo:fire ...]
// 音も録る(Web Audio の出口を横取りして録音し、映像と重ねる)。cdnjs に出られない箱では npm pack tone@14.8.49 の build/Tone.js を TONE_JS に渡す
// 引数: <能力>:<Lv> でトレーニング、shugyo:<行き先> で修行。1つずつ <名前>.mp4 を作る(要 ffmpeg)。
// 流れ: success-shoot.js と同じく MonheroSuccessScreen を直接置き、途中の育成を芯で作って「続きから」→ 押す。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const OUT = path.resolve(process.env.OUT || path.join(__dirname, 'rec'));
const { chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'));
const { quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const STATS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const LV_XP = [0, 4, 9, 15, 22]; // トレーニングLv1〜5になる経験
// 録画の映像は録り始めが少し遅れて始まる。音をこれだけ後ろへずらして合わせる(秒。丸太の割れる瞬間で2回測った値。前へは負・REC_AV で替えられる)
const AV = Number.isFinite(Number(process.env.REC_AV)) && process.env.REC_AV !== undefined ? Number(process.env.REC_AV) : 0.12;
const jobs = (process.argv.slice(2).length ? process.argv.slice(2) : ['pow:1', 'life:1', 'eva:1', 'shugyo:fire']).map((a) => a.split(':'));

const makeRun = async ({ stat, lv }) => {
  /* global msxLoad, msxSuc */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'rec-run-1', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4, carry: [], bag: {} });
  let g = 0;
  while (s.turn < 9 && !s.over && g++ < 80) {
    const v = SUC.peek(s);
    const a = v.can.includes('retry') ? { kind: 'retry' } : s.hp < s.hpMax * 0.5 ? { kind: 'rest' } : { kind: 'train', stat: 'pow' };
    s = SUC.act(s, a).state;
    if (s.last && ['train', 'light', 'heavy'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
    let g2 = 0; while (s.battle && g2++ < 5) { const opp = SUC.opponents(s); s = SUC.settle(s, opp.map(() => true)).state; }
  }
  s = { ...s, hp: s.hpMax, tickets: 5, trainXp: { ...(s.trainXp || {}) } };
  if (stat) Object.keys(SUC.peek(s).cards).filter((k) => k.endsWith(`:${stat}`)).forEach((k) => { s.trainXp[k] = lv; });
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase: 'main', out: null, log: [], startAt: 1 };
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    for (const [kind, arg] of jobs) {
      const isQ = kind === 'shugyo';
      const lv = Math.max(1, Math.min(5, Number(arg) || 1));
      const name = isQ ? `shugyo-${arg || 'fire'}` : `train-${kind}-lv${lv}`;
      const vdir = path.join(OUT, `_v-${name}`); fs.rmSync(vdir, { recursive: true, force: true });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
      const page = await ctx.newPage();
      const t0 = Date.now(); // 映像はページを作ったときから始まる
      // 効果音の部品 Tone はふだん cdnjs から読む。外へ出られない箱では、npm から取った同じ版(TONE_JS)を差し込む
      if (process.env.TONE_JS) await page.route('https://cdnjs.cloudflare.com/ajax/libs/tone/**', (r) => r.fulfill({ path: process.env.TONE_JS, contentType: 'text/javascript' }));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      // 音: Web Audio の出口(destination)へつなぐ所を横取りして、同じ音を録音にも流す(ゲームの音の作りは変えない・録るときだけ)
      await page.addInitScript(() => {
        window.__recs = [];
        const orig = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (dest, ...rest) {
          const r = orig.call(this, dest, ...rest);
          try {
            if (dest instanceof AudioDestinationNode) {
              const c = dest.context;
              if (!c.__msd) {
                c.__msd = c.createMediaStreamDestination();
                const rec = new MediaRecorder(c.__msd.stream, { mimeType: 'audio/webm' }); const chunks = [];
                rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
                rec.start(); window.__recs.push({ rec, chunks, t0: Date.now() });
              }
              orig.call(this, c.__msd, rest[0] || 0);
            }
          } catch (e) { /* 録れなくても画面は動かす */ }
          return r;
        };
      });
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); } catch (e) { /* 無ければ無いで */ } });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
      // 音を先に有効にしてから画面を置く(録るときだけ音量を上げる。保存はしない)
      await page.evaluate(async ({ se, bgm }) => { try { await Audio_.setEnabled(true); await Audio_.unlock(false); Audio_.setSeVolume(se); Audio_.setBgmVolume(bgm); } catch (e) { /* 音が無くても録る */ } }, { se: Number(process.env.REC_SE) || 80, bgm: Number(process.env.REC_BGM) || 45 });
      await page.evaluate(async ({ opt, mk }) => {
        // eslint-disable-next-line no-new-func
        const make = new Function(`return (${mk})`)();
        const run = await make(opt); localStorage.setItem(MSX_KEYS.run, JSON.stringify(run));
        const el = Object.assign(document.createElement('div'), { id: 'msx-rec' }); document.body.appendChild(el);
        window.__msxRoot = ReactDOM.createRoot(el);
        window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
      }, { opt: isQ ? {} : { stat: kind, lv: LV_XP[lv - 1] }, mk: makeRun.toString() });
      await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
      const click = (re) => page.evaluate((src) => { const re = new RegExp(src); const b = [...document.querySelectorAll('.msx button')].find((x) => re.test(x.innerText || '') && !x.disabled); if (b) b.click(); return !!b; }, re.source);
      await click(/続きから/); await page.waitForTimeout(500);
      // 撮影の土台(タイトル画面のまま)の曲の切り替えが、サクセスの曲を止めることがある。録るときだけ、場面の曲を鳴らし直す
      await page.evaluate((q) => { try { Audio_.playBGM(successSoundBgm(q ? 'ascetic' : 'main', 'spring')); } catch (e) { /* 曲が無くても録る */ } }, isQ); await page.waitForTimeout(400);
      let tGo;
      if (isQ) {
        await click(/^⚔\s*修行/); await page.waitForTimeout(600);
        await page.evaluate((c) => { const b = document.querySelector(`[data-msx-r3-course="${c}"]`); if (b) b.click(); }, arg || 'fire'); await page.waitForTimeout(300);
        await page.evaluate(() => { const t = [...document.querySelectorAll('[data-msx-r3-techlist] span')].find((x) => getComputedStyle(x).opacity === '1' && !x.classList.contains('got')); if (t) t.click(); }); await page.waitForTimeout(500);
        tGo = Date.now(); await page.evaluate(() => { const b = document.querySelector('[data-msx-r3-shugyo]'); if (b) b.click(); });
        await page.waitForTimeout(5800);
      } else {
        await click(/^💪\s*(トレーニング|訓練)/); await page.waitForTimeout(500);
        await page.evaluate((i) => { const b = document.querySelectorAll('.v-trs .v-tr')[i]; if (b) b.click(); }, STATS.indexOf(kind)); await page.waitForTimeout(700);
        tGo = Date.now(); await click(/をする$/);
        await page.waitForTimeout(3800);
      }
      if (process.env.REC_DEBUG) console.log(JSON.stringify(await page.evaluate(async () => ({ diag: window.__mhAudioDiagnose ? await window.__mhAudioDiagnose() : null, recs: (window.__recs || []).map((r) => r.chunks.length), en: window.__mhAudioEnabled, cur: Audio_.currentBgmKey(), act: SuccessSound.isActive() }))).slice(0, 900));
      const auds = await page.evaluate(async () => Promise.all((window.__recs || []).map(({ rec, chunks, t0 }) => new Promise((ok) => {
        rec.onstop = async () => { const b = new Blob(chunks, { type: 'audio/webm' }); const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000)); ok({ t0, b64: btoa(bin) }); };
        try { rec.stop(); } catch (e) { ok({ t0, b64: '' }); }
      }))));
      const vid = page.video(); await ctx.close();
      const webm = await vid.path();
      const aFiles = auds.filter((a) => a.b64).map((a, i) => { const f = path.join(vdir, `a${i}.webm`); fs.writeFileSync(f, Buffer.from(a.b64, 'base64')); return { f, off: (a.t0 - t0) / 1000 + AV }; });
      const ss = Math.max(0, (tGo - t0) / 1000 - 0.5);
      const dur = isQ ? 5.8 : 3.8;
      // 映像と音(録り始めのずれを足して合わせる)を重ね、押した少し前から切り出す
      const ins = ['-i', webm]; aFiles.forEach((a) => { ins.push('-itsoffset', a.off.toFixed(3), '-i', a.f); });
      const mix = aFiles.length ? ['-filter_complex', `${aFiles.map((_, i) => `[${i + 1}:a]`).join('')}amix=inputs=${aFiles.length}:duration=longest:normalize=0[a]`, '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k'] : [];
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...ins, ...mix, '-ss', ss.toFixed(2), '-t', String(dur), '-vf', 'scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${name}.mp4`)]);
      console.log(`  音: ${aFiles.length}本(${aFiles.map((a) => a.off.toFixed(2)).join(', ')}秒から)`);
      fs.rmSync(vdir, { recursive: true, force: true });
      console.log(`作った: ${path.join(OUT, `${name}.mp4`)}`);
    }
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

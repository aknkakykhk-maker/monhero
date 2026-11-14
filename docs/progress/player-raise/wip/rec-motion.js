#!/usr/bin/env node
// モンサクのトレーニング・修行の演出を、本物の画面の流れで録って mp4 にする(見本を社長に見せる用・2026-11-14 クラフトくん8)。
//   OUT=<フォルダ> node docs/progress/player-raise/wip/rec-motion.js [life:1 pow:3 eva:1 shugyo:fire ...]
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
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [kind, arg] of jobs) {
      const isQ = kind === 'shugyo';
      const lv = Math.max(1, Math.min(5, Number(arg) || 1));
      const name = isQ ? `shugyo-${arg || 'fire'}` : `train-${kind}-lv${lv}`;
      const vdir = path.join(OUT, `_v-${name}`); fs.rmSync(vdir, { recursive: true, force: true });
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, recordVideo: { dir: vdir, size: { width: 390, height: 844 } } });
      const t0 = Date.now();
      const page = await ctx.newPage();
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); } catch (e) { /* 無ければ無いで */ } });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function', undefined, { timeout: 90000 });
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
      let tGo;
      if (isQ) {
        await click(/^⚔\s*修行/); await page.waitForTimeout(600);
        await page.evaluate((c) => { const b = document.querySelector(`[data-msx-r3-course="${c}"]`); if (b) b.click(); }, arg || 'fire'); await page.waitForTimeout(300);
        await page.evaluate(() => { const t = [...document.querySelectorAll('[data-msx-r3-techlist] span')].find((x) => getComputedStyle(x).opacity === '1' && !x.classList.contains('got')); if (t) t.click(); }); await page.waitForTimeout(500);
        tGo = Date.now(); await page.evaluate(() => { const b = document.querySelector('[data-msx-r3-shugyo]'); if (b) b.click(); });
        await page.waitForTimeout(4200);
      } else {
        await click(/^💪 トレーニング/); await page.waitForTimeout(500);
        await page.evaluate((i) => { const b = document.querySelectorAll('.v-trs .v-tr')[i]; if (b) b.click(); }, STATS.indexOf(kind)); await page.waitForTimeout(700);
        tGo = Date.now(); await click(/をする$/);
        await page.waitForTimeout(3000);
      }
      const vid = page.video(); await ctx.close();
      const webm = await vid.path();
      const ss = Math.max(0, (tGo - t0) / 1000 - 0.5);
      const dur = isQ ? 4.4 : 3.0;
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', ss.toFixed(2), '-i', webm, '-t', String(dur), '-vf', 'scale=390:-2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${name}.mp4`)]);
      fs.rmSync(vdir, { recursive: true, force: true });
      console.log(`作った: ${path.join(OUT, `${name}.mp4`)}`);
    }
  } finally { await browser.close(); server.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

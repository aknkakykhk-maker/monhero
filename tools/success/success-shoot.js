#!/usr/bin/env node
// モンヒロサクセス(育成の画面・回2)を本物のブラウザで開き、画面ごとの止め絵を撮る。あわせて「真っ白にならない・字が枠からはみ出さない」を見る。
//
//   node tools/success/success-shoot.js                 … 縦390×844 で全部の画面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-shoot.js … 縦390×844・横844×390・幅320×568 で撮る
//
// 入口はデバッグ設定だけなので、ここでは画面の部品(MonheroSuccessScreen)を直接置いて開く。
// 途中の育成は、芯(data/monhero-success.js)で決まった手を打って作り、保存のキー(mh_monsuc_run_v1)へ入れてから開く。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
let chromium;
try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const PORT = 8971;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で: 芯を読み、決まった手で途中の育成を作る(kind で場面を選ぶ)
const makeRun = async (kind) => {
  /* global msxLoad, msxSuc, MSX_KEYS */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'shot-run-1', species: 'Mocchi', aid: kind === 'atsu' ? 'atsu' : 'mua', team, aidBondLv: 4, carry: ['dango', 'kibidango'], bag: { juice: 1 } });
  const goal = kind === 'early' ? 1 : 21;
  let guard = 0;
  while (s.turn < goal && !s.over && guard++ < 200) {
    const v = SUC.peek(s);
    let a;
    if (v.can.includes('cond')) a = { kind: 'cond' };
    else if (v.can.includes('retry')) a = { kind: 'retry' };
    else if (s.hp < s.hpMax * 0.45) a = { kind: 'rest' };
    else {
      const keys = Object.keys(v.cards).filter((k) => k.startsWith('light:') || k.startsWith('train:'));
      keys.sort((x, y) => (v.cards[y].mult - v.cards[x].mult));
      a = { kind: v.cards[keys[0]].kind, stat: v.cards[keys[0]].stat };
    }
    s = SUC.act(s, a).state;
    if (s.last && ['train', 'light', 'heavy', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
    let g2 = 0; while (s.battle && g2++ < 5) { const opp = SUC.opponents(s); s = SUC.settle(s, opp.map(() => true)).state; }
  }
  if (kind === 'yosu') s = { ...s, yosu: { sabori: { visits: 0 } } };
  const run = { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: ['juice', 'dango'], used: 0, phase: 'main', out: null, log: [], startAt: 1 };
  return run;
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [844, 390, 'land'], [320, 568, 's320']] : [[390, 844, '']];
  // [名前, 作る育成, 開いたあとの操作]
  const SHOTS = [
    ['S1', null, ['new']], ['S2', null, ['new', 'next']], ['S3', null, ['new', 'next', 'next']], ['S4', null, ['new', 'next', 'next', 'next']],
    ['S5', null, ['new', 'next', 'next', 'next', 'next']], ['S6', null, ['new', 'next', 'next', 'next', 'next', 'next']],
    ['M1', 'mid', ['cont']], ['M2', 'yosu', ['cont']], ['M3', 'mid', ['cont', 'bag']], ['T1', 'mid', ['cont', 'train']],
    ['K1', 'mid', ['cont', 'train', 'go']], ['K3', 'mid', ['cont', 'train', 'go', 'next']], ['K5', 'mid', ['cont', 'train', 'go', 'next', 'praise']],
    ['I1', 'mid', ['cont', 'issa']], ['P1', 'mid', ['cont', 'stats']],
  ];
  try {
    const page0 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const [w, h, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { try { localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare', 'Plant', 'Ghost'])); localStorage.setItem('mh_monsuc_meta_v1', JSON.stringify({ v: 1, items: { dango: 2, mag: 1, juice: 3, loupe: 1, license: 1 } })); } catch (e) {} });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof msxLoad === 'function' && typeof MASMON_CALC !== 'undefined', undefined, { timeout: 90000 });
      for (const [name, kind, steps] of SHOTS) {
        await page.evaluate(async ({ kind, mk }) => {
          // eslint-disable-next-line no-new-func
          const make = new Function(`return (${mk})`)();
          if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; }
          if (kind) { const run = await make(kind); localStorage.setItem(MSX_KEYS.run, JSON.stringify(run)); } else localStorage.removeItem(MSX_KEYS.run);
          const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' });
          document.body.appendChild(el);
          window.__msxRoot = ReactDOM.createRoot(el);
          window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
        }, { kind, mk: makeRun.toString() });
        await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
        for (const st of steps) {
          const done = await page.evaluate(async (st) => {
            const btn = (re) => [...document.querySelectorAll('.msx button')].find((b) => re.test(b.innerText || '') && !b.disabled);
            const click = (re) => { const b = btn(re); if (b) b.click(); return !!b; };
            if (st === 'new') return click(/新しく育成をはじめる/);
            if (st === 'next') return click(/▶$/);
            if (st === 'cont') return click(/続きから/);
            if (st === 'bag') return click(/持ち物/);
            if (st === 'stats') return click(/^📊/);
            if (st === 'train') return click(/^💪 訓練/);
            if (st === 'go') return click(/の訓練をする$/);
            if (st === 'praise') return click(/褒める/);
            if (st === 'issa') {
              // 博士が来るターンを芯で探して、その場面を開く(ふだんは 3% なので、撮るときだけ id を変えて探す)
              const SUC = msxSuc.SUC; const raw = JSON.parse(localStorage.getItem(MSX_KEYS.run));
              for (let i = 0; i < 400; i++) { const s = { ...raw.s, id: `shot-issa-${i}`, acted: true }; if (SUC.issaComes(s)) { raw.s = s; raw.phase = 'issa'; localStorage.setItem(MSX_KEYS.run, JSON.stringify(raw)); break; } }
              window.__msxRoot.unmount(); const el = document.getElementById('msx-shot'); window.__msxRoot = ReactDOM.createRoot(el);
              window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4 }));
              await new Promise((r) => setTimeout(r, 600));
              return click(/続きから/);
            }
            return false;
          }, st);
          if (!done) check(`${name}${tag ? `(${tag})` : ''}: 「${st}」のボタンが押せる`, false);
          await page.waitForTimeout(350);
        }
        await page.waitForTimeout(900);
        const m = await page.evaluate(() => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          const R = root.getBoundingClientRect();
          // 中で送れる欄(overflow が auto/scroll)の中にあって隠れている物は数えない
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-act, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map((e) => (e.innerText || e.className).slice(0, 20));
          return { ok: true, text: root.innerText.length, over };
        });
        check(`${name}${tag ? `(${tag})` : ''}: 画面が出る`, m.ok && m.text > 20);
        check(`${name}${tag ? `(${tag})` : ''}: 枠からはみ出さない`, m.ok && m.over.length === 0, m.over && m.over.slice(0, 3).join(' / '));
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `msx-${name}${tag ? `-${tag}` : ''}.png`) }); }
      }
      await page.close();
    }
    await page0.close();
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();

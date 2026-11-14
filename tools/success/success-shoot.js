#!/usr/bin/env node
// モンヒロサクセス(育成の画面・回2)を本物のブラウザで開き、画面ごとの止め絵を撮る。あわせて「真っ白にならない・字が枠からはみ出さない」を見る。
// あわせて、押せる大きさ・字の小ささ・横画面・大きい文字の見張りは success-layout-check.js が回す。
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
  // [幅, 高さ, 名札, 文字の倍率]。大きい文字設定は、画面の中の文字を 1.3 倍にして真似る
  const sizes = process.env.SHOT_QUICK ? [[390, 844, '']] : [[390, 844, ''], [844, 390, 'land'], [667, 375, 'land667'], [320, 568, 's320'], [390, 844, 'big', 1.3], [844, 390, 'landbig', 1.3], [320, 568, 's320big', 1.3]];
  // [名前, 作る育成, 開いたあとの操作]
  const SHOTS = [
    ['S0', null, ['new']], // ストーリー選択(2026-11-14)。S1〜S6 はその「次へ」のあと
    ['S1', null, ['new', 'next']], ['S1D', null, ['new', 'next', 'detail']], ['S1A', null, ['new', 'next', 'detail', 'tab:apt']], ['S1F', null, ['new', 'next', 'detail', 'tab:feat']],
    ['S2', null, ['new', 'next', 'next']], ['S2P', null, ['new', 'next', 'next', 'slot:1']], ['S2B', null, ['new', 'next', 'next', 'slot:1', 'base:Golem']], ['S2G', null, ['new', 'next', 'next', 'gather']],
    ['S3', null, ['new', 'next', 'next', 'next']], ['S4', null, ['new', 'next', 'next', 'next', 'next']],
    ['S5', null, ['new', 'next', 'next', 'next', 'next', 'next']], ['S6', null, ['new', 'next', 'next', 'next', 'next', 'next', 'next']],
    ['M1', 'mid', ['cont']], ['M2', 'yosu', ['cont']], ['M3', 'mid', ['cont', 'bag']], ['T1', 'mid', ['cont', 'train']],
    ['K1', 'mid', ['cont', 'train', 'go']], ['K3', 'mid', ['cont', 'train', 'go', 'next']], ['K5', 'mid', ['cont', 'train', 'go', 'next', 'praise']],
    ['I1', 'mid', ['cont', 'issa']], ['P1', 'mid', ['cont', 'stats']], ['M1D', 'mid', ['cont', 'detail']], ['M1F', 'mid', ['cont', 'detail', 'tab:feat']],
    ['E1', 'mid', ['cont', 'event']],
  ];
  try {
    const page0 = await browser.newPage({ viewport: { width: 390, height: 844 } });
    for (const [w, h, tag, fscale] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); /* β版の説明の窓は monsuc-beta-browser-check.js が見る。ここは画面そのものを測る */ localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare', 'Plant', 'Ghost'])); localStorage.setItem('mh_monsuc_meta_v1', JSON.stringify({ v: 1, items: { dango: 2, mag: 1, juice: 3, loupe: 1, license: 1 } })); } catch (e) {} });
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
            if (st === 'detail') { const d = document.querySelector('[data-msx-detail-open]'); if (d) d.click(); return !!d; } // 選ぶ画面の「くわしく」(2026-11-14)
            if (st.startsWith('slot:')) { const d = document.querySelector(`[data-msx-slot="${st.slice(5)}"]`); if (d) d.click(); return !!d; } // 編成の枠を押す(2026-11-14)
            if (st.startsWith('base:')) { const d = document.querySelector(`[data-msx-pick-base="${st.slice(5)}"]`); if (d) d.click(); return !!d; }
            if (st === 'gather') { const d = document.querySelector('[data-msx-gather-open]'); if (d) d.click(); return !!d; }
            if (st.startsWith('tab:')) { const d = document.querySelector(`[data-msx-detail-tab="${st.slice(4)}"]`); if (d) d.click(); return !!d; }
            if (st === 'cont') return click(/続きから/);
            if (st === 'bag') return click(/持ち物/);
            if (st === 'stats') return click(/^📊/);
            if (st === 'train') return click(/^💪 トレーニング/);
            if (st === 'go') return click(/をする$/); // 2026-11-14 トレーニングのボタンは「丸太割りをする」のようにトレーニングの名前になった
            if (st === 'praise') return click(/褒める/);
            if (st === 'event') {
              // ランダムイベントが出るターンを芯で探して、その場面を開く(撮るときだけ id を変えて探す)
              const SUC = msxSuc.SUC; const raw = JSON.parse(localStorage.getItem(MSX_KEYS.run));
              if (!SUC.events) return false;
              let hit = false;
              for (let i = 0; i < 400 && !hit; i++) { const s0 = { ...raw.s, id: `shot-ev-${i}`, acted: false }; const o = SUC.events.open(s0, 'start'); if (o.out && o.out.ev && o.out.ev.choices && o.out.ev.choices.length) { raw.s = o.state; raw.phase = 'event'; raw.out = { ev: o.out.ev, slot: 'start' }; hit = true; } }
              if (!hit) return false;
              localStorage.setItem(MSX_KEYS.run, JSON.stringify(raw));
              window.__msxRoot.unmount(); const el = document.getElementById('msx-shot'); window.__msxRoot = ReactDOM.createRoot(el);
              window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4 }));
              await new Promise((r) => setTimeout(r, 600));
              return click(/続きから/);
            }
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
        const m = await page.evaluate((fscale) => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          if (fscale) { // 大きい文字設定の真似: 文字の大きさを倍にする(一度だけ)
            if (!root.dataset.fs) { root.dataset.fs = '1'; const els = [root, ...root.querySelectorAll('*')]; const sz = els.map((e) => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = `${sz[i] * fscale}px`; }); }
          }
          const R = root.getBoundingClientRect();
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
          const lab = (e) => ((e.innerText || e.getAttribute('aria-label') || e.className || e.tagName) + '').replace(/\s+/g, ' ').slice(0, 14);
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-act, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map(lab);
          // 押せる物は 44px 以上(送れる欄の中の物も数える。入力欄・ボタン・role=button)
          // 押せる範囲 = 見た目の枠と、::after で広げた範囲の大きいほう
          const hit = (e) => { const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after'); const aw = parseFloat(a.width) || 0; const ah = parseFloat(a.height) || 0; return { width: Math.max(r.width, a.content !== 'none' ? aw : 0), height: Math.max(r.height, a.content !== 'none' ? ah : 0) }; };
          const taps = [...root.querySelectorAll('button, [role=button], input, select, textarea')].filter((e) => vis(e) && e.type !== 'range' && e.type !== 'hidden' && !e.disabled).filter((e) => { const r = hit(e); return r.width < 43.5 || r.height < 43.5; }).map((e) => { const r = hit(e); return `${lab(e)}(${Math.round(r.width)}x${Math.round(r.height)})`; });
          // 字が切れる: 一行に収める枠で中身が枠より広い
          const cut = [...root.querySelectorAll('*')].filter((e) => vis(e) && e.children.length === 0 && (e.innerText || '').trim() && e.scrollWidth > e.clientWidth + 2 && ['hidden', 'clip'].includes(getComputedStyle(e).overflowX) && !clipped(e)).map(lab);
          // 字が極端に小さい(10px 未満。大きい文字設定では 13px 未満になっていないか)
          const tiny = [...root.querySelectorAll('*')].filter((e) => vis(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 10 * (fscale || 1) - 0.5).map((e) => `${lab(e)}(${Math.round(parseFloat(getComputedStyle(e).fontSize))}px)`);
          // 横画面の上の空白: 見える中身のいちばん上が、枠の上から 50px より下
          const kids = [...root.querySelectorAll('*')].filter((e) => vis(e) && (e.tagName === 'IMG' || e.tagName === 'BUTTON' || [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())));
          const topBlank = kids.length ? Math.round(Math.min(...kids.map((e) => e.getBoundingClientRect().top)) - R.top) : 0;
          // 重なり: 押せる物どうしが 6px 角以上かぶる
          const bs = [...root.querySelectorAll('button')].filter((e) => vis(e) && !clipped(e)).map((e) => ({ e, r: e.getBoundingClientRect() }));
          const lap = []; for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) { const a = bs[i].r, b = bs[j].r; if (bs[i].e.contains(bs[j].e) || bs[j].e.contains(bs[i].e)) continue; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 6 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 6) lap.push(`${lab(bs[i].e)}×${lab(bs[j].e)}`); }
          return { ok: true, text: root.innerText.length, over, taps, cut, tiny, topBlank, lap, land: window.innerWidth > window.innerHeight };
        }, fscale || 0);
        const L = `${name}${tag ? `(${tag})` : ''}`;
        const warn = (what, arr) => { if (arr && arr.length) console.log(`  見張り ${L}: ${what} ${arr.length}件 ${arr.slice(0, 4).join(' / ')}`); };
        if (m.ok) {
          check(`${L}: 押せる物が 44px 以上`, m.taps.length === 0, m.taps.slice(0, 4).join(' / '));
          check(`${L}: 字が枠で切れない`, m.cut.length === 0, m.cut.slice(0, 4).join(' / '));
          check(`${L}: 字が小さすぎない`, m.tiny.length === 0, m.tiny.slice(0, 4).join(' / '));
          check(`${L}: 押せる物が重ならない`, m.lap.length === 0, m.lap.slice(0, 3).join(' / '));
          if (m.land) check(`${L}: 横画面の上に空白が無い`, m.topBlank <= 50, `${m.topBlank}px`);
        }
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

#!/usr/bin/env node
// モンヒロサクセス 回3(大会・修行・引退・ゲームオーバー・保存枠)を本物のブラウザで開き、画面ごとに
// 「真っ白にならない・字が枠からはみ出さない・ページのエラーが出ない・保存枠に1回だけ入る」を見る。
//
//   node tools/success/success-r3-shoot.js                  … 縦390×844 で全部の画面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-r3-shoot.js … 縦390×844 と 幅320×568 で撮る
//
// 入口はデバッグ設定だけなので、回2の撮影(success-shoot.js)と同じく MonheroSuccessScreen を直接置いて開く。
// 途中の育成は芯で決まった手を打って作り、場面に合わせて形を整えてから mh_monsuc_run_v1 へ入れる。
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
const PORT = 8973;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で: 芯で途中の育成を作り、場面に合わせて形を整える
const makeRun = async (kind) => {
  /* global msxLoad, msxSuc */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'r3-shot-1', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4, items: { sand: 2, rainbow: 1 } });
  const goal = kind === 'debut' ? 5 : 22;
  let guard = 0;
  while (s.turn < goal && !s.over && guard++ < 200) {
    const v = SUC.peek(s);
    let a;
    if (v.can.includes('cond')) a = { kind: 'cond' };
    else if (v.can.includes('retry')) a = { kind: 'retry' };
    else if (s.hp < s.hpMax * 0.45) a = { kind: 'rest' };
    else { const keys = Object.keys(v.cards).filter((k) => k.startsWith('light:') || k.startsWith('train:')); keys.sort((x, y) => (v.cards[y].mult - v.cards[x].mult)); a = { kind: v.cards[keys[0]].kind, stat: v.cards[keys[0]].stat }; }
    s = SUC.act(s, a).state;
    if (s.last && ['train', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state;
    if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state;
    let g2 = 0; while (s.battle && g2++ < 5) s = SUC.settle(s, true).state;
  }
  s = { ...s, acted: false, battle: null, over: null, tickets: 3, items: { sand: 2, rainbow: 1 } };
  let phase = 'main';
  const stats = (n) => ({ life: n, pow: n, wise: n, hit: n, eva: n, tough: n });
  if (kind === 'win' || kind === 'lose') { s = { ...s, stats: stats(kind === 'win' ? 700 : 40), battle: { kind: 'cup', id: 'x', sys: 'str', star: 2, rival: null, round: 0 } }; phase = 'battle'; }
  if (kind === 'debutlose') { s = { ...s, turn: 5, wonNow: [], wonBefore: [], stats: stats(30), debutLoss: 2, debutWon: false, rematchUsed: 3, battle: { kind: 'debut', round: 0, retry: 2 } }; phase = 'battle'; }
  if (kind === 'gameover') { s = { ...s, turn: 7, debutLoss: 3, over: 'gameover' }; phase = 'over'; }
  if (kind === 'retire') { s = { ...s, turn: 46, pts: 34, over: 'done' }; phase = 'over'; }
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase, out: null, log: [{ turn: 3, t: '休んだ' }], startAt: 1 };
};

(async () => {
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const sizes = SHOT_DIR ? [[390, 844, ''], [320, 568, 's320']] : [[390, 844, '']];
  // [名前, 作る育成, 操作(data 属性 か テキストの正規表現)]。'@x' は [data-msx-r3-x] を押す
  const SHOTS = [
    ['C1', 'mid', ['cont', /^🏆大会/]],
    ['C1w', 'mid', ['cont', /^🏆大会/, '@cup']], ['C1p', 'mid', ['cont', /^🏆大会/, '@cup', '@prize=g']], ['C1m', 'mid', ['cont', /^🏆大会/, '@next-month']], // 受付の作り直し(確認の窓・賞品の詳細・次の月)
    // 大会の1戦はバトル部の見せる部品 MonsucCupShow('%x' は [data-msc-x])。賞品のあとのごはんは回3
    ['B1', 'win', ['cont']], ['C2', 'win', ['cont', '%go']], ['W1', 'win', ['cont', '%go', '%ready']],
    ['B2', 'win', ['cont', '%quick']], ['R1', 'win', ['cont', '%quick', '%next']], ['C3', 'win', ['cont', '%quick', '%next', '@next']], ['C3b', 'win', ['cont', '%quick', '%next', '@next', '@meal']], // R1: 賞金ランク UP!(段が上がったときだけ)
    ['C4', 'lose', ['cont', '%quick']], ['C4r', 'lose', ['cont', '%quick', '%rematch=sand']], ['C4g', 'lose', ['cont', '%quick', '%giveup']],
    ['C4d', 'debutlose', ['cont', '%quick']],
    ['Q1', 'mid', ['cont', /^⚔修行/]], ['Q2', 'mid', ['cont', /^⚔修行/, '@shugyo']], ['Q3', 'mid', ['cont', /^⚔修行/, '@shugyo', '@qnext']],
    ['G1', 'gameover', ['cont']],
    ['X1', 'box', ['@openbox', '@boxmon=b1', '@edit']], ['X2', 'box', ['@openbox', '@boxmon=b1', '@edit', '@editsave']],
    ['E0', 'retire', ['cont']], ['E3', 'retire', ['cont', '@e0']], ['E3b', 'retire', ['cont', '@e0', '@bal']], ['E1', 'retire', ['cont', '@e0', '@bal', '@e3']],
    ['E2', 'retire', ['cont', '@e0', '@bal', '@e3', '@e1', '@auto']], ['E9', 'retire', ['cont', '@e0', '@bal', '@e3', '@e1', '@auto', '@decide', '@decide']],
  ];
  try {
    for (const [w, h, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, meal: 1, rank: 1, scn: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); /* β版の説明は monsuc-beta-browser-check.js が見る */ localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'])); } catch (e) {} });
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof MsxR3 === 'function' && typeof msxLoad === 'function' && typeof MASMON_CALC !== 'undefined', undefined, { timeout: 90000 });
      for (const [name, kind, steps] of SHOTS) {
        const label = `${name}${tag ? `(${tag})` : ''}`;
        await page.evaluate(async ({ kind, mk }) => {
          // eslint-disable-next-line no-new-func
          const make = new Function(`return (${mk})`)();
          if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; }
          localStorage.removeItem('mh_monsuc_box_v1');
          if (kind === 'box') { // 保存枠に2体(名前と染色を変える画面を見る)
            const st = { life: 600, pow: 700, wise: 400, hit: 500, eva: 450, tough: 650 };
            localStorage.setItem('mh_monsuc_box_v1', JSON.stringify({ v: 1, cap: 30, memory: [], mons: [
              { id: 'b1', species: 'Mocchi', nick: 'もちまる', colors: [], gen: 1, st, techs: [], mast: [], loy: 80, pop: 60, lv: 8, rank: 'A', grade: 'A2', score: 11800, raised: true, assists: [], titles: [], keepMe: 'x' },
              { id: 'b2', species: 'Golem', nick: 'いわお', colors: [], gen: 1, st, techs: [], mast: [], loy: 70, pop: 40, lv: 6, rank: 'B', grade: 'B3', score: 9200, raised: true, assists: [], titles: [] }] }));
            localStorage.removeItem('mh_monsuc_run_v1');
          } else { const run = await make(kind); localStorage.setItem('mh_monsuc_run_v1', JSON.stringify(run)); }
          const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' });
          document.body.appendChild(el);
          window.__msxRoot = ReactDOM.createRoot(el);
          window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
        }, { kind, mk: makeRun.toString() });
        await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
        for (const st of steps) {
          const done = await page.evaluate(async (st) => {
            if (st.re) { const re = new RegExp(st.re); const b = [...document.querySelectorAll('.msx button')].find((x) => re.test((x.innerText || '').replace(/\s+/g, '')) && !x.disabled); if (b) b.click(); return !!b; }
            if (st === 'cont') { const b = [...document.querySelectorAll('.msx button')].find((x) => /続きから|結果を見る/.test(x.innerText || '')); if (b) b.click(); return !!b; }
            const [k, val] = st.slice(1).split('=');
            const pre = st[0] === '%' ? 'data-msc-' : 'data-msx-r3-';
            const b = document.querySelector(`[${pre}${k}${val ? `="${val}"` : ''}]`);
            if (b && !b.disabled) b.click(); return !!(b && !b.disabled);
          }, st instanceof RegExp ? { re: st.source } : st);
          if (!done) check(`${label}: 「${st}」が押せる`, false);
          await page.waitForTimeout(st === '%ready' ? 2500 : 700);
        }
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          const R = root.getBoundingClientRect();
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map((e) => (e.innerText || e.className).slice(0, 20));
          const box = JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null');
          return { ok: true, text: root.innerText.length, over, head: root.innerText.slice(0, 160).replace(/\s+/g, ' '), boxN: box && Array.isArray(box.mons) ? box.mons.length : 0, run: localStorage.getItem('mh_monsuc_run_v1') };
        });
        check(`${label}: 画面が出る`, m.ok && m.text > 20, m.head);
        check(`${label}: 枠からはみ出さない`, m.ok && m.over.length === 0, m.over && m.over.slice(0, 3).join(' / '));
        if (name === 'X2') { const b = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null')); const m = b && b.mons.find((x) => x.id === 'b1');
          check(`${label}: 名前と染色を決めても、ほかの項目と子は残る`, !!m && m.nick === 'もちまる' && m.keepMe === 'x' && Array.isArray(m.colors) && b.mons.length === 2); }
        if (name === 'E9') check(`${label}: 保存枠に1体入り、途中の育成が消える`, m.boxN === 1 && (m.run === null || m.run === 'null'), `保存枠 ${m.boxN}体`);
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `r3-${name}${tag ? `-${tag}` : ''}.png`) }); }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();

#!/usr/bin/env node
// モンヒロサクセス 助手1人分のストーリー(みゅあ編・2026-11-13)の画面を本物のブラウザで開き、
// 「真っ白にならない・字が枠からはみ出さない・ページのエラーが出ない・エンディングは1回だけ」を見る。
//   node tools/success/success-arc-shoot.js                  … 縦390×844 で全部の画面を開いて確かめる(撮らない)
//   SHOT_DIR=<フォルダ> node tools/success/success-arc-shoot.js … 縦390×844 と 幅320×568 で撮る
// 作り方は success-r3-shoot.js と同じ(MonheroSuccessScreen を直接置き、芯で作った育成を mh_monsuc_run_v1 へ入れる)。
//   '@x' は [data-msx-r3-x]・'%x' は [data-msc-x](バトル部の見せる部品)・'#x' は [data-msx-arc-x]・'opt' は出来事の1つ目の選択肢
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
const PORT = 8974;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };

// ページの中で: 芯で育成を作り、場面に合わせて形を整える
const makeRun = async (kind) => {
  /* global msxLoad, msxSuc */
  await msxLoad();
  const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  const rv = { name: 'ライバルのゴーレム', kind: 'aid', species: 'Golem', stats: { life: 500, pow: 500, wise: 400, hit: 450, eva: 400, tough: 520 } };
  let s = SUC.newRun({ id: 'arc-shot-1', species: 'Mocchi', aid: 'mua', team, aidBondLv: 4, items: { sand: 1, rainbow: 0 }, rivals: [rv] });
  const stats = (n) => ({ life: n, pow: n, wise: n, hit: n, eva: n, tough: n });
  let phase = 'main'; let out = null;
  if (kind === 'uniq') { s = { ...s, turn: 12 }; const o = SUC.events.open(s, 'start'); s = o.state; phase = 'event'; out = { ev: o.out.ev, slot: 'start' }; }
  if (kind === 'pick1' || kind === 'pick2' || kind === 'pick3') { const r = Number(kind.slice(-1)) - 1; s = { ...s, turn: 44 + r, stats: stats(999), aidBond: 100, astory: { ep: 4, path: 'good', done: true }, battle: { kind: 'summit', round: r } }; phase = 'battle'; }
  const end = (k, over) => { s = { ...s, turn: 46, stats: stats(600), over, aidBond: k === 'super' ? 100 : 70, ending: { kind: k, parties: SUC.PARTY[k].slice(), seen: false } }; phase = 'over'; };
  if (kind === 'bad') end('bad', 'lost');
  if (kind === 'good') end('good', 'done');
  if (kind === 'super') end('super', 'done');
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase, out, log: [{ turn: 3, t: '休んだ' }], startAt: 1 };
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
    ['U1', 'uniq', ['cont']], ['U2', 'uniq', ['cont', 'opt']],
    ['P1', 'pick1', ['cont']], ['P2', 'pick2', ['cont', '@precup', '@enter', '@yes', 'wait']], ['P3', 'pick3', ['cont']],
    ['A1', 'pick1', ['cont', '@precup', '@enter', '@yes', '#next*', '@cupintro-go', '%quick', '%next', '#next']],
    ['N1', 'bad', ['cont']], ['N2', 'bad', ['cont', '#next', '#next']],
    ['G1', 'good', ['cont']], ['G2', 'good', ['cont', '#next', '#next']], ['G4', 'good', ['cont', '#next', '#next', '#next', '#next']],
    ['S1', 'super', ['cont']], ['S2', 'super', ['cont', '#next', '#next']], ['S5', 'super', ['cont', '#next', '#next', '#next', '#next', '#next']],
    ['S6', 'super', ['cont', '#next', '#next', '#next', '#next', '#next', 'wait', '#next', '#next']],
  ];
  try {
    for (const [w, h, tag] of sizes) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      // β版のみゅあの説明(最初の1回だけ重なる窓)は見た印を付けておく。付けないと、試合の前の説明で手順が止まる
      await page.addInitScript(() => { try { localStorage.setItem('mh_monsuc_beta_v1', JSON.stringify({ v: 1, seen: { open: 1, firstend: 1, prep: 1, turn: 1, train: 1, result: 1, rest: 1, shugyo: 1, cup: 1, match: 1, rematch: 1, event: 1, awake: 1, retire: 1 } })); } catch (e) {} });
      await page.addInitScript(() => { try { localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'])); } catch (e) {} });
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
            if (st === 'wait') return true;
            if (st === '#next*') { // 相手えらびなどの会話を、次へが無くなるまで送る(最大20回)
              for (let i = 0; i < 20; i++) { await new Promise((r) => setTimeout(r, 500)); const b = document.querySelector('[data-msx-arc-next]'); if (!b) break; b.click(); }
              return true;
            }
            if (st === 'opt') { const b = document.querySelector('.msx .v-opt'); if (b) b.click(); return !!b; }
            if (st === 'cont') { const b = [...document.querySelectorAll('.msx button')].find((x) => /続きから|結果を見る/.test(x.innerText || '')); if (b) b.click(); return !!b; }
            const [k, val] = st.slice(1).split('=');
            const pre = st[0] === '%' ? 'data-msc-' : st[0] === '#' ? 'data-msx-arc-' : 'data-msx-r3-';
            const b = document.querySelector(`[${pre}${k}${val ? `="${val}"` : ''}]`);
            if (b && !b.disabled) b.click(); return !!(b && !b.disabled);
          }, st instanceof RegExp ? { re: st.source } : st);
          if (!done) check(`${label}: 「${st}」が押せる`, false);
          await page.waitForTimeout(st === 'wait' ? 5600 : st === '%quick' ? 1500 : 700);
        }
        await page.waitForTimeout(500);
        const m = await page.evaluate(() => {
          const root = document.querySelector('.msx'); if (!root) return { ok: false };
          const R = root.getBoundingClientRect();
          const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; if (o === 'auto' || o === 'scroll') return true; } return false; };
          const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-ft')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && !clipped(e) && (r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1); }).map((e) => (e.innerText || e.className).slice(0, 20));
          const box = JSON.parse(localStorage.getItem('mh_monsuc_box_v1') || 'null');
          return { ok: true, all: root.innerText, text: root.innerText.length, over, head: root.innerText.slice(0, 160).replace(/\s+/g, ' '), boxN: box && Array.isArray(box.mons) ? box.mons.length : 0, run: localStorage.getItem('mh_monsuc_run_v1') };
        });
        check(`${label}: 画面が出る`, m.ok && m.text > 20, m.head);
        check(`${label}: 枠からはみ出さない`, m.ok && m.over.length === 0, m.over && m.over.slice(0, 3).join(' / '));
        if (name === 'S6') { const r = JSON.parse(m.run || 'null'); check(`${label}: 特別演出のあと、エンディングを見た印が残る(もう一度は出ない)`, !!(r && r.s && r.s.ending && r.s.ending.seen) && /引退|評価/.test(m.head), m.head.slice(0, 40)); }
        if (name === 'P2') check(`${label}: 準決勝はライバルを選ぶ`, /ライバルのゴーレム/.test(m.all || ''), '');
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `arc-${name}${tag ? `-${tag}` : ''}.png`) }); }
      }
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();

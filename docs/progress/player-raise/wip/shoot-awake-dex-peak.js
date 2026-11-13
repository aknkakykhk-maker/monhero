// 覚醒・超覚醒の下見(作業用)。node shoot.js [名前...]
'use strict';
const fs = require('fs'); const path = require('path'); const http = require('http');
const ROOT = process.env.ROOT || '/home/user/monhero';
const OUT = path.join(__dirname, 'shots');
const { chromium } = require('playwright');
const { quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools/boot/quiet-boot-seed'));
const PORT = 8981;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const makeRun = async (kind) => {
  await msxLoad(); const SUC = msxSuc.SUC;
  const team = ['Tiger', 'Undine', 'Golem', 'Pixie', 'Suezo', 'Kyubi'].filter((x) => SUC.speciesList.includes(x)).map((species) => ({ kind: 'base', species }));
  let s = SUC.newRun({ id: 'aw-shot-1', species: 'Mocchi', aid: kind.aid || 'mua', team, aidBondLv: 4 });
  let guard = 0; const goal = kind.turn || 14;
  while (s.turn < goal && !s.over && guard++ < 200) {
    const v = SUC.peek(s); let a;
    if (v.can.includes('cond')) a = { kind: 'cond' }; else if (v.can.includes('retry')) a = { kind: 'retry' }; else if (s.hp < s.hpMax * 0.45) a = { kind: 'rest' };
    else { const keys = Object.keys(v.cards).filter((k) => k.startsWith('light:') || k.startsWith('train:')); keys.sort((x, y) => (v.cards[y].mult - v.cards[x].mult)); a = { kind: v.cards[keys[0]].kind, stat: v.cards[keys[0]].stat }; }
    s = SUC.act(s, a).state; if (s.last && ['train', 'shugyo'].includes(s.last.kind)) s = SUC.react(s, 'praise').state; if (SUC.peek(s).issa) s = SUC.issa(s, 'none').state;
    s = SUC.endTurn(s).state; let g2 = 0; while (s.battle && g2++ < 5) s = SUC.settle(s, true).state;
  }
  s = { ...s, acted: false, battle: null, over: null, omen: null, awake: kind.awake || 0, aptAwake: kind.awake === 2 ? [1, 2, 0, 0] : kind.awake === 1 ? [0, 1, 0, 0] : [0, 0, 0, 0] };
  if (s.ev) s.ev.pend = null;
  let phase = kind.phase || 'main';
  if (Number.isInteger(kind.type)) s.type = kind.type;
  if (kind.pend && s.ev) s.ev.pend = { id: kind.pend, slot: 'start', turn: s.turn };
  if (kind.omen) s.omen = { k: kind.omen, turn: kind.fire ? s.turn - 1 : s.turn };
  if (kind.over) { s.turn = 46; s.over = 'done'; phase = 'over'; }
  if (kind.battle) { s.battle = { kind: 'cup', id: 'x', sys: 'str', star: 2, rival: null, round: 0 }; phase = 'battle'; }
  return { v: 1, id: s.id, s, nick: 'もちまる', colors: [], from: { base: 'Mocchi' }, items: [], used: 0, phase, out: kind.out ? kind.out : phase === 'turn' ? { from: s.turn - 1 } : null, log: [], startAt: 1 };
};
const st = { life: 600, pow: 700, wise: 400, hit: 500, eva: 450, tough: 650 };
const BOX = { v: 1, cap: 30, memory: [], mons: [
  { id: 'b1', species: 'Mocchi', nick: 'もちまる', colors: [], gen: 1, st, techs: [], mast: [], loy: 80, pop: 60, lv: 8, rank: 'A', grade: 'A2', score: 11800, raised: true, assists: [], titles: [], awake: 1 },
  { id: 'b2', species: 'Golem', nick: 'いわお', colors: [], gen: 1, st, techs: [], mast: [], loy: 70, pop: 40, lv: 6, rank: 'B', grade: 'B3', score: 9200, raised: true, assists: [], titles: [], awake: 2 },
  { id: 'b3', species: 'Suezo', nick: 'すえ', colors: [], gen: 1, st, techs: [], mast: [], loy: 70, pop: 40, lv: 6, rank: 'C', grade: 'C1', score: 7200, raised: true, assists: [], titles: [] }] };
// [名前, 育成の形, 手順, 撮るまでの待ち(ms)]
const SHOTS = [
  ['gg1', { phase: 'result', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [], tags: [] }, gain: { wise: 60, hit: 25 } } }, ['cont'], 60],
  ['gg2', { phase: 'result', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [], tags: [] }, gain: { wise: 60, hit: 25 } } }, ['cont'], 500],
  ['gg3', { phase: 'result', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [], tags: [] }, gain: { wise: 60, hit: 25 } } }, ['cont'], 800],
  ['gg4', { phase: 'result', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [], tags: [] }, gain: { wise: 60, hit: 25 } } }, ['cont'], 1100],
  ['gg5', { phase: 'result', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [], tags: [] }, gain: { wise: 60, hit: 25 } } }, ['cont'], 2600],
  ['tev-a1', { phase: 'tevent', tev: 'a', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 350],
  ['tev-a2', { phase: 'tevent', tev: 'a', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 800],
  ['tev-a3', { phase: 'tevent', tev: 'a', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 2200],
  ['tev-b1', { phase: 'tevent', tev: 'b', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 350],
  ['tev-b2', { phase: 'tevent', tev: 'b', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 800],
  ['tev-b3', { phase: 'tevent', tev: 'b', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 2200],
  ['tev-c1', { phase: 'tevent', tev: 'c', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 350],
  ['tev-c2', { phase: 'tevent', tev: 'c', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 800],
  ['tev-c3', { phase: 'tevent', tev: 'c', out: { result: 'great', kind: 'train', card: { stat: 'wise', members: [0], tags: [] }, gain: { wise: 20 }, event: { who: 0, story: 2 } } }, ['cont'], 2200],
  ['g-aw0', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 2560],
  ['g-aw1', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 3200],
  ['g-aw2', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 4300],
  ['g-ev', { pend: 'ev.daily.book', phase: 'turn' }, ['cont', 'next', /本/], 300],
  ['g-ev2', { pend: 'ev.daily.book', phase: 'turn' }, ['cont', 'next', /本/], 1600],
  ['pk-soon', { type: 1, turn: 9 }, ['cont'], 1200],
  ['pk-start', { type: 1, turn: 11, pend: 'ev.self.peakin', phase: 'turn' }, ['cont', 'next'], 1500],
  ['pk-in', { type: 1, turn: 14 }, ['cont'], 1800],
  ['pk-rare', { type: 1, turn: 14, awake: 2 }, ['cont'], 1800],
  ['pk-calm', { type: 1, turn: 14, calm: true }, ['cont'], 800],
  ['pk-stats', { type: 1, turn: 14 }, ['cont', /^🔍/], 800],
  ['ev-unknown', { pend: 'ev.daily.rain', phase: 'turn' }, ['cont', 'next', '#[data-msx-info="a"]'], 800],
  ['ev-info', { pend: 'ev.daily.rain', phase: 'turn' }, ['cont', 'next', '#[data-msx-info="a"]', '#[data-msx-info="b"]'], 800],
  ['dex-story', {}, ['cont', /メニュー/, '#[data-msx-dex-open]'], 800],
  ['dex-daily', {}, ['cont', /メニュー/, '#[data-msx-dex-open]', '#[data-msx-dex-tab="daily"]'], 800],
  ['dex-read', {}, ['cont', /メニュー/, '#[data-msx-dex-open]', '#[data-msx-dex-tab="daily"]', '#[data-msx-dex-row="ev.daily.rain"]'], 1200],
  ['dex-home', 'box', ['#[data-msx-dex-home]'], 800],
  ['omen1', { omen: 1 }, ['cont'], 1500],
  ['omen2', { awake: 1, omen: 2 }, ['cont'], 1500],
  ['omen1-calm', { omen: 1, calm: true }, ['cont'], 800],
  ['aw1-a', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 600],
  ['aw1-b', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 1800],
  ['aw1-c', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 2850],
  ['aw1-d', { omen: 1, fire: true, phase: 'turn' }, ['cont', 'next'], 4800],
  ['aw2-a', { awake: 1, omen: 2, fire: true, phase: 'turn' }, ['cont', 'next'], 800],
  ['aw2-b', { awake: 1, omen: 2, fire: true, phase: 'turn' }, ['cont', 'next'], 2200],
  ['aw2-c', { awake: 1, omen: 2, fire: true, phase: 'turn' }, ['cont', 'next'], 3400],
  ['aw2-d', { awake: 1, omen: 2, fire: true, phase: 'turn' }, ['cont', 'next'], 5600],
  ['kira-main', { awake: 1 }, ['cont'], 2000],
  ['rare-main', { awake: 2 }, ['cont'], 2000],
  ['rare-train', { awake: 2 }, ['cont', /^💪訓練/], 1500],
  ['omen-stats', { omen: 1, awake: 0 }, ['cont', /^🔍/], 800],
  ['rare-battle', { awake: 2, battle: true }, ['cont'], 1500],
  ['rare-battle2', { awake: 2, battle: true }, ['cont', '%go'], 2000],
  ['rare-retire', { awake: 2, over: true }, ['cont'], 1500],
  ['box', 'box', ['@openbox'], 1500],
  ['box-detail', 'box', ['@openbox', '@boxmon=b2'], 1500],
];
(async () => {
  const want = process.argv.slice(2);
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
  await page.addInitScript(() => { try { localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'])); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => typeof MonheroSuccessScreen === 'function' && typeof MsxR3 === 'function' && typeof msxLoad === 'function' && typeof MASMON_CALC !== 'undefined', undefined, { timeout: 90000 });
  for (const [name, kind, steps, wait] of SHOTS) {
    if (want.length && !want.some((w) => name.startsWith(w))) continue;
    await page.evaluate(async ({ kind, mk, box }) => {
      const make = new Function(`return (${mk})`)();
      if (window.__msxRoot) { window.__msxRoot.unmount(); window.__msxRoot = null; }
      localStorage.setItem('mh_monsuc_box_v1', JSON.stringify(box));
      localStorage.setItem('mh_monsuc_event_seen_v1', JSON.stringify({ v: 1, ev: { 'ev.daily.rain': 1, 'ev.daily.nut': 1, 'ev.daily.arm': 1, 'story.mua.ep1': 1, 'story.mua.ep2': 1, 'ev.season.apr1': 1, 'aw.awake': 1, issa: 1 }, ch: { 'ev.daily.rain.b': 1, 'ev.daily.nut.a': 1, 'issa.stat': 1 } }));
      if (kind === 'box') localStorage.removeItem('mh_monsuc_run_v1'); else localStorage.setItem('mh_monsuc_run_v1', JSON.stringify(await make(kind)));
      window.__calm = !!(kind && kind.calm); window.__msxTevStyle = kind && kind.tev ? kind.tev : null;
      const el = document.getElementById('msx-shot') || Object.assign(document.createElement('div'), { id: 'msx-shot' });
      document.body.appendChild(el);
      window.__msxRoot = ReactDOM.createRoot(el);
      window.__msxRoot.render(React.createElement(MonheroSuccessScreen, { onClose() {}, callNameOf: () => 'けんささん', bondLvOf: () => 4, debug: false }));
    }, { kind, mk: makeRun.toString(), box: BOX });
    await page.waitForSelector('[data-msx-view="home"]', { timeout: 30000 });
    if (kind && kind.calm) await page.emulateMedia({ reducedMotion: 'reduce' }); else await page.emulateMedia({ reducedMotion: 'no-preference' });
    for (const stp of steps) {
      const ok = await page.evaluate(async (stp) => {
        const btns = [...document.querySelectorAll('.msx button')];
        if (stp.re) { const re = new RegExp(stp.re); const b = btns.find((x) => re.test((x.innerText || '').replace(/\s+/g, '')) && !x.disabled); if (b) b.click(); return !!b; }
        if (stp === 'cont') { const b = btns.find((x) => /続きから|結果を見る/.test(x.innerText || '')); if (b) b.click(); return !!b; }
        if (stp[0] === '#') { const b = document.querySelector(stp.slice(1)); if (b) b.click(); return !!b; }
        if (stp === 'next') { const b = btns.find((x) => /つぎへ/.test(x.innerText || '')); if (b) b.click(); return !!b; }
        const [k, val] = stp.slice(1).split('='); const pre = stp[0] === '%' ? 'data-msc-' : 'data-msx-r3-';
        const b = document.querySelector(`[${pre}${k}${val ? `="${val}"` : ''}]`); if (b && !b.disabled) b.click(); return !!(b && !b.disabled);
      }, stp instanceof RegExp ? { re: stp.source } : stp);
      if (!ok) console.log(`NG ${name}: ${stp} が押せない`);
      if (stp !== steps[steps.length - 1]) await page.waitForTimeout(700);
    }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('shot', name);
  }
  console.log(errors.length ? 'ERR:\n' + [...new Set(errors)].slice(0, 8).join('\n') : 'エラーなし');
  await browser.close(); server.close();
})();

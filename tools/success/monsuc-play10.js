#!/usr/bin/env node
// モンサクの「10周通し」点検台本(本物のブラウザ・デバッグの入口から・ブラウザの中の新しい保存だけ)。2026-11-15 r1115-038
//   node tools/success/monsuc-play10.js --laps 1-3          周を指定(既定 1-10)
//   OUT=<フォルダ> node tools/success/monsuc-play10.js …    記録(周ごとの JSON・止め絵・文の一覧)を置く先
// 直さない・見つけて記録するだけ。1周 = 育てるモンスターを選ぶ → 46ターン → 終わり(引退・完走・ゲームオーバー)。
// 周ごとに 育てる子・育て方(STYLE)・編成(TEAM)・選択肢の選び方(PICK)・戦い方 が変わる。
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const [LF, LT] = String(opt('--laps', '1-10')).split('-').map(Number); const LAST = LT || LF;
const OUT = process.env.OUT || path.join(ROOT, 'docs', 'progress', 'monsuc-soak-1115');
let chromium; try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); }
const { eventStorySeed, quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon' };
const serve = () => new Promise((res) => { const s = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '')); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(0, () => res(s)); });

// ---- 周の設計 ----
// style: tr=トレーニング / rest=休む / play=遊ぶ / shu=修行 / cup=大会 の重み・focus=トレーニングの能力の並び(life,pow,wise,hit,eva,tough の番号)
const LAPS = [
  { species: 'Mocchi',  style: { tr: 8, rest: 1, play: 0, shu: 1, cup: 1 }, focus: [1, 5, 0], pick: 'first', react: 'praise', team: 'base', ctl: 'auto', name: 'トレーニング中心' },
  { species: 'Suezo',   style: { tr: 4, rest: 3, play: 1, shu: 1, cup: 1 }, focus: [2, 3, 4], pick: 'last',  react: 'scold',  team: 'box-low', ctl: 'auto', name: '休み多め・かしこさ' },
  { species: 'Golem',   style: { tr: 2, rest: 1, play: 0, shu: 6, cup: 1 }, focus: [1, 5], pick: 'first', react: 'praise', team: 'box-mid', ctl: 'auto', name: '修行中心' },
  { species: 'Tiger',   style: { tr: 3, rest: 1, play: 0, shu: 1, cup: 6 }, focus: [3, 4, 1], pick: 'rand', react: 'praise', team: 'box-high', ctl: 'manual', name: '大会中心(手動で戦う)' },
  { species: 'Pixie',   style: { tr: 1, rest: 4, play: 4, shu: 0, cup: 0 }, focus: [2], pick: 'rand', react: 'none',   team: 'base', ctl: 'auto', name: 'ほったらかし(休む・遊ぶ)' },
  { species: 'Undine',  style: { tr: 5, rest: 2, play: 1, shu: 2, cup: 2 }, focus: [0, 1, 2, 3, 4, 5], pick: 'first', react: 'praise', team: 'box-mid', ctl: 'auto', name: 'バランス・ほめ中心' },
  { species: 'Kyubi',   style: { tr: 6, rest: 2, play: 0, shu: 2, cup: 2 }, focus: [2, 3], pick: 'last', react: 'scold', team: 'box-high', ctl: 'auto', name: 'しかる中心・かしこさ命中' },
  { species: 'Mocchi',  style: { tr: 9, rest: 0, play: 0, shu: 0, cup: 1 }, focus: [5, 4], pick: 'rand', react: 'praise', team: 'box-low', ctl: 'auto', name: '休まず突っ込む' },
  { species: 'Golem',   style: { tr: 3, rest: 2, play: 2, shu: 3, cup: 3 }, focus: [1, 0, 5], pick: 'first', react: 'praise', team: 'box-max', ctl: 'auto', name: '何でも均等・最強編成' },
  { species: 'Tiger',   style: { tr: 5, rest: 2, play: 0, shu: 3, cup: 3 }, focus: [4, 3, 1], pick: 'rand', react: 'scold', team: 'base', ctl: 'manual', name: '手動・回避命中' },
];
const KEYS = ['life', 'pow', 'wise', 'hit', 'eva', 'tough'];
const RANKS = { low: [800, 'C'], mid: [2400, 'B'], high: [4200, 'A'], max: [5800, 'S'] };
const boxSeed = (kind) => {
  const [sum, rank] = RANKS[kind.replace('box-', '')];
  const sp = ['Undine', 'Mocchi', 'Golem', 'Pixie', 'Tiger', 'Kyubi', 'Suezo'];
  const mons = sp.map((s, i) => { const st = {}; KEYS.forEach((k, j) => { st[k] = Math.round(sum / 6 * (0.7 + ((i + j) % 4) * 0.2)); }); return { id: `bx${i}`, species: s, nick: `箱${i + 1}`, raised: true, gen: 1, rank, st, techs: [], gt: i % 3 }; });
  return { v: 1, cap: 100, mons };
};

const lapSeed = (cfg) => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('点検ブリーダー'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
  for (const k of ['mh_onboarded', 'mh_tutorial_seen_v1', 'mh_battle_tutorial_seen_v1', 'mh_battle_tutorial_guide_shown_v1', 'mh_inherited_unique_level_compensation_v1']) localStorage.setItem(k, JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare']));
  if (cfg.box) localStorage.setItem('mh_monsuc_box_v1', JSON.stringify(cfg.box));
  localStorage.setItem('mh_monsuc_arena_ctl_v1', JSON.stringify(cfg.ctl));
  window.__mhSupabaseStubbed = true;
};

const isolate = async (page) => {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
};
const toHome = async (page, port) => {
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 6; i++) { const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first(); if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break; await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
};
const openEntry = async (page) => {
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.locator('[data-mh-help]').waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  const btn = page.locator('[data-debug-monhero-success]');
  await btn.evaluate((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await btn.dispatchEvent('click');
  await page.waitForSelector('.msx[data-msx-view]', { timeout: 30000 });
  await page.waitForTimeout(400);
};

// いまの育成の状態(保存から)
const runState = (page) => page.evaluate(() => { try { const r = JSON.parse(localStorage.getItem('mh_monsuc_run_v1')); return r && r.s ? r.s : null; } catch (e) { return null; } });
const screenInfo = (page) => page.evaluate(() => {
  const root = document.querySelector('.msx'); if (!root) return null;
  const R = root.getBoundingClientRect();
  const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const cs = getComputedStyle(p); if (/auto|scroll|hidden/.test(cs.overflowY + cs.overflowX)) return true; } return false; };
  const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-act, .v-ft, .v-card, .v-gains span')].filter((e) => { const r = e.getBoundingClientRect(); if (!r.width || !r.height || clipped(e)) return false; return r.right > R.right + 1 || r.left < R.left - 1; }).map((e) => (e.innerText || e.className || '').replace(/\s+/g, ' ').slice(0, 24));
  // 切れ・はみ出す文字(要素の中で字が収まっていない)
  const clip = [...root.querySelectorAll('button, .v-card, .v-opt, .v-log, .v-h, .v-chip, .v-kv, b, small')].filter((e) => e.children.length < 3 && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0).map((e) => (e.innerText || '').replace(/\s+/g, ' ').slice(0, 24));
  const imgs = [...root.querySelectorAll('img')].filter((i) => i.complete && (!i.naturalWidth)).map((i) => (i.getAttribute('src') || '').slice(-40));
  const stretch = [...root.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); if (!i.naturalWidth || r.width < 20 || r.height < 20 || getComputedStyle(i).objectFit !== 'fill') return false; const a = (i.naturalWidth / i.naturalHeight) / (r.width / r.height); return a > 1.25 || a < 0.8; }).map((i) => (i.getAttribute('src') || '').slice(-40));
  const tbI = root.querySelector('[data-msx-turn]');
  return { view: root.getAttribute('data-msx-view'), turn: tbI ? Number(tbI.getAttribute('data-msx-turn')) || 0 : 0, text: root.innerText.replace(/\s+/g, ' ').trim(), over, clip, imgs, stretch, hscroll: document.documentElement.scrollWidth > window.innerWidth + 1,
    arena: !!root.querySelector('.msa, .msc-wrap'), btns: [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null).map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 30)) };
});

// 1周分の1押し(押した物の名前を返す。何も押せなければ null)
const step = (page, cfg, mem) => page.evaluate(({ cfg, mem }) => {
  mem = window.__monsucMem || (window.__monsucMem = mem); // 押すたびに渡し直されるので、ページの中で持ち続ける
  const root = document.querySelector('.msx'); if (!root) return null;
  const vis = (b) => !b.disabled && b.offsetParent !== null;
  const all = [...root.querySelectorAll('button')].filter(vis);
  const by = (re, sel) => all.find((b) => (!sel || b.matches(sel)) && re.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
  const press = (b, why) => { if (!b) return null; b.click(); return why; };
  const rnd = () => { mem.seed = (mem.seed * 1103515245 + 12345) & 0x7fffffff; return mem.seed / 0x7fffffff; };
  const wpick = (w) => { const ks = Object.keys(w).filter((k) => w[k] > 0); let t = ks.reduce((a, k) => a + w[k], 0) * rnd(); for (const k of ks) { t -= w[k]; if (t <= 0) return k; } return ks[0]; };
  if (root.querySelector('[data-msx-birth]')) { const nx = root.querySelector('[data-msx-birth-next]:not([disabled])'); if (nx) return press(nx, 'birth'); const sk = root.querySelector('[data-msx-birth-skip]'); if (sk) return press(sk, 'birth-skip'); return 'wait'; }
  // 試合の中: 操作(オート/手動)の切り替え → 試合を進める
  const ctl = root.querySelector('[data-msa-ctl]');
  if (ctl) {
    if (cfg.ctl === 'auto' && ctl.getAttribute('data-msa-ctl') === 'manual' && !mem.ctlSet) { mem.ctlSet = 1; return press(ctl, 'ctl-auto'); }
    const mv = root.querySelector('.msa-mv:not([disabled]), [data-msa-move]:not([disabled]), .msa-tech:not([disabled])'); if (mv && cfg.ctl === 'manual') return press(mv, 'move');
  }
  // 大会の受付: 今月出られる札(late でも ng でもない)を1つ選んで「大会を選ぶ」。無ければ戻る
  const giveup = root.querySelector('[data-msc-giveup]'); if (giveup) { mem.giveups = (mem.giveups || 0) + 1; return press(giveup, 'giveup'); }
  const cupC = [...root.querySelectorAll('[data-msx-r3-cup]')];
  const yesB = by(/^はい$/); if (yesB && by(/^キャンセル$/)) return press(yesB, 'cup-yes');
  const dep = by(/^出場 ▶/); if (dep) return press(dep, 'cup-go');
  if (cupC.length) { const en = root.querySelector('[data-msx-r3-enter]:not([disabled])'); if (en) return press(en, 'cup-enter'); const ok = cupC.filter((c) => !c.disabled && !/\b(ng|late|later)\b/.test(c.className)); const pickable = ok.filter((c) => !c.classList.contains('sel')); if (pickable.length && !mem.cupTry) { mem.cupTry = 1; return press(pickable[0], 'cup-pick'); } mem.cupTry = 0; mem.noCup = mem.curTurn; const bks = all.filter((b) => /戻る/.test(b.innerText)); return press(bks[bks.length - 1] || root.querySelector('button.bk'), 'cup-back'); }
  mem.cupTry = 0;
  // 修行の画面: 覚えられる技を1つ(無ければ何も選ばず)→「修行する」。押せないときは戻る
  const shu = root.querySelector('[data-msx-r3-shugyo]');
  const tbE = root.querySelector('[data-msx-turn]');
  const curTurn = (tbE ? Number(tbE.getAttribute('data-msx-turn')) : ((root.innerText.match(/(\d+)\s*\/\s*46ターン/) || [])[1])) | 0; if (curTurn) mem.curTurn = curTurn;
  if (shu) {
    const cand = [...root.querySelectorAll('[data-msx-r3-tech].ok')];
    if (!mem.shuPicked && cand.length && !shu.disabled) { mem.shuPicked = 1; const c = cand[cand.length - 1]; mem.shuTech = c.getAttribute('data-msx-r3-tech') + ' ' + c.innerText.replace(/\s+/g, ' ').slice(0, 30); return press(c, 'shugyo-tech'); }
    mem.shuPicked = 0;
    if (!shu.disabled) { (mem.shuLog = mem.shuLog || []).push({ t: mem.curTurn, tech: mem.shuTech || null }); mem.shuTech = null; return press(shu, 'shugyo'); }
    mem.noShu = mem.curTurn; const bks = all.filter((b) => /戻る/.test(b.innerText)); return press(bks[bks.length - 1] || root.querySelector('button.bk'), 'shugyo-back');
  }
  mem.shuTry = 0;
  const ask = root.querySelector('.msx-btn.go'); if (ask && /はい|する|使う|やめる/.test(ask.innerText) && ask.closest('[class*="ask"], [class*="modal"], [class*="sheet"]')) return press(ask, 'ask');
  const ch = root.querySelector(`[data-msx-react-how="${mem.react === 'scold' ? 'scold' : 'praise'}"]`); if (ch && !ch.disabled && mem.react !== 'none') return press(ch, 'react');
  const rn = root.querySelector('[data-msx-react-next]:not([disabled])'); if (rn) return press(rn, 'react-next');
  const opts = [...root.querySelectorAll('.v-opts .v-opt:not([disabled])')]; if (opts.length) { const o = cfg.pick === 'first' ? opts[0] : cfg.pick === 'last' ? opts[opts.length - 1] : opts[Math.floor(rnd() * opts.length)]; mem.evPick = (mem.evPick || 0) + 1; return press(o, 'event'); }
  if (root.querySelector('[data-msx-r3-loading]')) return 'wait';
  const yes = root.querySelector('[data-msx-r3-yes]'); if (yes) return press(yes, 'pre-yes');
  if (root.querySelector('[data-msx-r3-pre-card]')) { const en = root.querySelector('[data-msx-r3-enter]'); if (en) return press(en, 'pre-enter'); }
  const pc = root.querySelector('[data-msx-r3-precup]'); if (pc) return press(pc, 'pre-cup');
  const ig = root.querySelector('[data-msx-r3-cupintro-go]'); if (ig) return press(ig, 'intro');
  const retry = by(/デビュー戦に再挑戦/); if (retry) return press(retry, 'retry');
  const cond = by(/^🛌 休む/, '.v-p.main'); if (cond) return press(cond, 'cond');
  // トレーニング選択
  const trs = [...root.querySelectorAll('.v-tr')];
  if (trs.length) { const idx = cfg.focus[Math.floor(rnd() * cfg.focus.length)]; const cur = root.querySelector('.v-tr.sel'); const want = trs[idx] || trs[0]; if (mem.trPick !== mem.turnKey) { mem.trPick = mem.turnKey; return press(want, 'pick'); } const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) return press(go, 'train'); return press(want, 'pick'); }
  const no = by(/何もしない/, '.v-ix'); if (no && !no.classList.contains('sel')) return press(no, 'issa-none');
  const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) return press(go, 'go');
  const nomeal = root.querySelector('[data-msx-r3-nomeal]:not([disabled])'); if (nomeal) return press(nomeal, 'meal-no');
  const nx = by(/(つぎへ|次へ) ▶|^▶/); if (nx) return press(nx, 'next');
  const skipB = by(/結果へ|^⏩|飛ばす|SKIP|スキップ|^閉じる|^OK$|^はい$|決定/); if (skipB) return press(skipB, 'skip');
  // メイン
  const hp = (root.innerText.match(/体力\s*(\d+)\s*\/\s*(\d+)/) || []);
  const frac = hp[1] ? Number(hp[1]) / Number(hp[2]) : 1;
  const st = (root.innerText.match(/ストレス\s*(\d+)\s*\/\s*100/) || [])[1];
  const menu = { rest: by(/^🛌\s*休む/, '.v-p'), tr: by(/^💪 トレーニング/), play: by(/^🎈 遊ぶ/), shu: by(/^⚔ 修行/), cup: by(/^🏆 大会/), clinic: by(/^🏥 通院/) };
  if (menu.clinic && /通院\s*(病気|けが|ケガ|不調)/.test(root.innerText)) return press(menu.clinic, 'clinic');
  const w = { ...cfg.style }; if (frac < 0.3) { w.rest += 8; w.tr = 0; w.shu = 0; } else if (frac < 0.5) { w.rest += 3; } if (st && Number(st) > 70) { w.play += 5; }
  if (mem.noShu === mem.curTurn) menu.shu = null; if (mem.noCup === mem.curTurn) menu.cup = null;
  for (const k of Object.keys(w)) if (!menu[k]) w[k] = 0;
  if (!Object.values(w).some((x) => x > 0)) { const any = menu.tr || menu.rest; return press(any, 'main-any'); }
  const k = wpick(w); mem.turnKey = (mem.turnKey || 0) + 1; return press(menu[k], 'main-' + k);
}, { cfg, mem });

module.exports = { LAPS, boxSeed, lapSeed, serve, isolate, toHome, openEntry, screenInfo, runState, ROOT, chromium, quietBootSeed, updateNoticeSeed, eventStorySeed };
const sanitize = (t) => t.replace(/[\d,]+/g, '#').slice(0, 60);
if (require.main === module) (async () => {
  fs.mkdirSync(path.join(OUT, 'raw'), { recursive: true }); fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  const server = await serve(); const port = server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  for (let lap = LF; lap <= LAST; lap++) {
    const cfg = { ...LAPS[lap - 1] }; if (cfg.team.startsWith('box')) cfg.box = boxSeed(cfg.team);
    const log = { lap, cfg: { ...cfg, box: undefined }, turns: [], screens: {}, findings: [], pressed: 0, endText: '' };
    const VW = (process.env.VIEW || '390,844').split(',').map(Number); const ctx = await browser.newContext({ viewport: { width: VW[0], height: VW[1] }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); const errs = []; const cerr = [];
    page.on('pageerror', (e) => errs.push(String(e && e.message || e).slice(0, 200)));
    page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|favicon|status of 404|status of 503/i.test(t)) cerr.push(t.slice(0, 160)); } });
    await page.addInitScript(lapSeed, cfg);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(eventStorySeed());
    await isolate(page);
    const note = (kind, text) => { log.findings.push({ kind, text }); console.log(`[周${lap}] ${kind}: ${text}`); };
    const t0 = Date.now();
    try {
      await toHome(page, port); await openEntry(page);
      await page.evaluate(() => { [...document.querySelectorAll('.msx button')].find((x) => /新しく育成を(?:始|はじ)める/.test(x.innerText)).click(); });
      await page.waitForSelector('[data-msx-scenario]', { timeout: 10000 });
      await page.evaluate(() => document.querySelector('[data-msx-scenario-next]').click());
      // はじめる6段: 1=育てる子を選ぶ
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(300);
        const info = await screenInfo(page); const key = `start${i + 1}`;
        log.screens[key] = info.text.slice(0, 700); if (info.over.length) note('はみ出し', `${key}: ${info.over.join('/')}`); if (info.clip.length) note('字の切れ', `${key}: ${info.clip.join('/')}`);
        if (i < 6) await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-${key}.png`) });
        if (i === 0) { // 育てる子
          const r = await page.evaluate((sp) => { const root = document.querySelector('.msx'); const names = { Mocchi: 'モッチー', Suezo: 'スエゾー', Golem: 'ゴーレム', Tiger: 'ライガー', Pixie: 'ピクシー', Undine: 'ウンディーネ', Kyubi: 'キュービ', Hare: 'ヘア' }; const cards = [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.innerText.trim() === '' ); return { n: cards.length, names: names[sp] }; }, cfg.species);
          // 子の札は絵だけのボタン(順番は species の順)。選べたかは次の画面の名前で確かめる
          const order = ['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi'];
          const idx = Math.max(0, order.indexOf(cfg.species));
          await page.evaluate((idx) => { const root = document.querySelector('.msx'); const cards = [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.innerText.trim() === '' && b.querySelector('img, canvas, svg')); if (cards[idx]) cards[idx].click(); }, idx);
          await page.waitForTimeout(200);
        }
        if (i === 1 && cfg.team.startsWith('box')) { // 編成: 箱の子を5体入れる
          for (let s = 0; s < 5; s++) {
            const opened = await page.evaluate((s) => { const sl = [...document.querySelectorAll('[data-msx-slot]')]; const t = sl[s]; if (t) t.click(); return sl.length; }, s);
            await page.waitForTimeout(250);
            // 選ぶ画面(全画面 MsxTeamPick・r1115-096): マスモンボックスのタブで s 番目の子を押して「決定」
            const picked = await page.evaluate((s) => { const p = document.querySelector('[data-msx-team-pick]'); if (!p) return 'nopicker'; const tb = p.querySelector('[data-msx-tp-tab="box"]'); if (tb) tb.click(); return 'ok'; }, s);
            await page.waitForTimeout(150);
            const picked2 = picked !== 'ok' ? picked : await page.evaluate((s) => { const p = document.querySelector('[data-msx-team-pick]'); const bs = [...p.querySelectorAll('[data-msx-tp-item]')].filter((x) => !x.classList.contains('lk') && !/編成中/.test(x.innerText)); const b = bs[0]; if (!b) return 'nobtn'; b.click(); return 'ok'; }, s);
            if (picked2 !== 'ok' && s === 0) note('編成', `箱から選べない(${picked2}・slots=${opened})`);
            await page.waitForTimeout(150);
            await page.evaluate(() => { const c = document.querySelector('[data-msx-tp-ok]'); if (c) c.click(); });
            await page.waitForTimeout(150);
          }
        }
        if (i === 1 && cfg.team.startsWith('box')) { const n = await page.evaluate(() => (document.querySelector('.msx').innerText.match(/箱\d/g) || []).length); if (n < 5) note('編成', `箱の子が編成に5体入っていない(${n}体)`); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-team.png`) }); }
        const r = await page.evaluate(() => { const root = document.querySelector('.msx'); const big = [...root.querySelectorAll('button')].find((b) => !b.disabled && /育成を(?:始|はじ)める$/.test(b.innerText.trim()) && b.classList.contains('v-big')); if (big) { big.click(); return 'start'; } const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) { go.click(); return 'next'; } return null; });
        if (i === 5) log.team = await page.evaluate(() => document.querySelector('.msx').innerText.replace(/\s+/g, ' ').slice(0, 500));
        if (r === 'start') break; if (!r) { note('止まる', `はじめる ${i + 1} 段目で先へ進めない`); break; }
      }
      // 46ターン
      const mem = { seed: lap * 7919 + 13, react: cfg.react, turnKey: 0 };
      let guard = 0, same = 0, lastSig = '', lastTurn = 0, over = false;
      const shotSeen = new Set();
      while (guard++ < 2500) {
        const info = await screenInfo(page);
        if (!info) { note('真っ白', '.msx が消えた'); break; }
        const sig = info.view + '|' + info.text.slice(0, 160);
        const turn = info.turn || (((info.text.match(/(\d+)\s*\/\s*46ターン/) || [])[1]) | 0);
        if (info.text.length < 20) note('真っ白', `文字がほぼ無い view=${info.view}`);
        const key = sanitize(info.text.replace(/^(?:← |⏸ )中断 みゅあ編 \d+ \/ 46ターン /, ''));
        if (!log.screens[key]) {
          log.screens[key] = info.text.slice(0, 900);
          if (info.over.length) { note('はみ出し', `T${turn} ${info.over.slice(0, 3).join('/')}`); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-over-t${turn}-${log.findings.length}.png`) }); }
          if (info.clip.length) note('字の切れ', `T${turn} ${info.clip.slice(0, 3).join('/')}`);
          if (info.imgs.length) note('画像が読めない', `T${turn} ${info.imgs.slice(0, 2).join('/')}`);
          if (info.stretch.length) { note('画像の伸び', `T${turn} ${info.stretch.slice(0, 2).join('/')}`); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-stretch-t${turn}-${log.findings.length}.png`) }); }
          if (info.hscroll) note('横スクロール', `T${turn}`);
          if (shotSeen.size < 40 && !shotSeen.has(key.slice(0, 20))) { shotSeen.add(key.slice(0, 20)); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-t${String(turn).padStart(2, '0')}-${shotSeen.size}.png`) }); }
        }
        if (sig === lastSig) same++; else { same = 0; lastSig = sig; }
        if (turn && turn !== (log.tt || 0)) { log.tt = turn; log.ttAt = guard; } else if (guard - (log.ttAt || 0) > 150) { note('止まる', `T${turn} 150押しても次のターンへ進まない: ${info.text.slice(0, 200)} / 直前の押し: ${(log.hist || []).slice(-14).join(',')} / ボタン: ${info.btns.join(',')}`); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-loop.png`) }); break; }
        if (same > 25) { note('止まる', `T${turn} 同じ画面で25回押しても変わらない: ${info.text.slice(0, 160)} / ボタン: ${info.btns.join(',')}`); break; }
        // ターンの記録(保存から)
        if (turn && turn !== lastTurn && info.view === 'play') { const s = await runState(page); if (s) log.turns.push({ t: s.turn, stats: s.stats, hp: s.hp, hpMax: s.hpMax, stress: s.stress, loy: s.loy, ama: s.ama, fear: s.fear, pop: s.pop, pts: s.pts, gold: s.gold, money: s.money, items: s.items, techs: s.techs, mastery: s.mastery, tickets: s.tickets }); lastTurn = turn; }
        // 育成の終わり(結果・評価・保存)
        if (/ゲームオーバー|育成おわり|育成を終え|引退|評価|殿堂|マスモンボックスへ/.test(info.text) && (info.view !== 'play' || /引退|評価|ゲームオーバー/.test(info.text)) && !info.btns.some((b) => /^💪 トレーニング/.test(b))) { log.endText = info.text.slice(0, 900); if (!log.endShot) { log.endShot = 1; await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-end1.png`) }); } }
        if (info.view === 'home' && guard > 20) { log.over = true; break; }
        const did = await step(page, cfg, mem);
        log.pressed++; (log.hist = log.hist || []).push(did); if (log.hist.length > 40) log.hist.shift();
        if (!did) { note('止まる', `T${turn} 押せるボタンが無い: ${info.text.slice(0, 200)} / ボタン: ${info.btns.join(',')}`); await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-stuck.png`) }); if (process.env.DUMP) console.log(await page.evaluate(() => [...document.querySelectorAll('.msx button, .msx [data-msx-r3-shugyo], .msx [data-msx-r3-tech]')].map((b) => b.tagName + ' ' + [...b.attributes].map((a) => a.name + '=' + String(a.value).slice(0, 20)).join(' ') + ' :: ' + (b.innerText || '').replace(/\s+/g, ' ').slice(0, 24)).join('\n'))); break; }
        if (did === 'wait') { await page.waitForTimeout(500); continue; }
        await page.waitForTimeout(60);
      }
      log.final = await runState(page); log.shuLog = await page.evaluate(() => (window.__monsucMem && window.__monsucMem.shuLog) || []);
      log.meta = await page.evaluate(() => { try { return { meta: JSON.parse(localStorage.getItem('mh_monsuc_meta_v1')), box: JSON.parse(localStorage.getItem('mh_monsuc_box_v1')), assist: JSON.parse(localStorage.getItem('mh_monsuc_assist_v1')), fuse: JSON.parse(localStorage.getItem('mh_monsuc_fuse_v1')) }; } catch (e) { return null; } });
    } catch (e) { note('止まる', `台本の例外: ${String(e && e.message || e).split('\n')[0]}`); try { await page.screenshot({ path: path.join(OUT, 'shots', `lap${lap}-exc.png`) }); } catch (_) {} }
    log.errors = errs; log.consoleErrors = cerr; log.sec = Math.round((Date.now() - t0) / 1000);
    if (errs.length) console.log(`[周${lap}] ページのエラー: ${errs.slice(0, 3).join(' / ')}`);
    fs.writeFileSync(path.join(OUT, 'raw', `lap${lap}.json`), JSON.stringify(log, null, 1));
    console.log(`[周${lap}] 済み ${log.sec}秒・押した ${log.pressed} 回・最後のターン ${log.turns.length ? log.turns[log.turns.length - 1].t : '?'}`);
    await ctx.close();
  }
  await browser.close(); server.close();
})();

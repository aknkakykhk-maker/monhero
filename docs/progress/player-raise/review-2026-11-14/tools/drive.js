// 常駐の操作役: ブラウザを開いたまま、localhost:9555 で命令を受ける
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = '/home/user/monhero';
const OUT = path.join(__dirname, 'shots'); const OUT2 = path.join(__dirname, 'shots2x'); fs.mkdirSync(OUT2, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
const { chromium } = require('playwright');
const { eventStorySeed, quietBootSeed, updateNoticeSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const site = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
}).listen(8981);
let browser, ctx, page; const errors = []; const sounds = [];
const SEED = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare']));
  window.__mhSupabaseStubbed = true;
  // 鳴った曲・効果音を控える
  window.__snd = [];
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { try { window.__snd.push({ t: Date.now(), src: String(this.src || this.currentSrc).split('/').slice(-2).join('/'), loop: this.loop }); } catch (e) {} return P.apply(this, arguments); };
};
async function open(w, h) {
  if (ctx) await ctx.close();
  ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < h, deviceScaleFactor: 2 });
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('PAGE ' + String(e && e.message || e).slice(0, 200)));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|net::|favicon|404|503/i.test(t)) errors.push('CON ' + t.slice(0, 200)); } });
  await page.addInitScript(SEED); await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(eventStorySeed());
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.route(/game-system\.compiled\.js/, (r) => { if (!PATCH) return r.continue(); let t = fs.readFileSync(path.join(ROOT, 'monster-hero', 'game-system.compiled.js'), 'utf8'); const a = "次、いこ!」')))) : null));"; if (!t.includes(a)) console.log('PATCH MISS'); t = t.replace(a, "次、いこ!」').t))) : null));"); r.fulfill({ status: 200, contentType: 'text/javascript', body: t }); });
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}
async function toEntry() {
  await page.goto('http://localhost:8981/monster-hero/index.html', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 6; i++) { const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first(); if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break; await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250); }
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  const btn = page.locator('[data-debug-monhero-success]');
  await btn.evaluate((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await btn.dispatchEvent('click');
  await page.waitForSelector('.msx[data-msx-view]', { timeout: 30000 });
  await page.waitForTimeout(600);
  await page.evaluate(HOOK);
}
// 画面の様子: 見える文字・押せるボタン(番号つき)・はみ出し・重なり
const LOOK = () => {
  const root = document.querySelector('.msx') || document.body; const R = root.getBoundingClientRect();
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.top < innerHeight; };
  const btns = [...root.querySelectorAll('button, [role=button]')].filter(vis);
  window.__btns = btns;
  const lab = (e) => (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const list = btns.map((b, i) => { const r = b.getBoundingClientRect(); return `${i}${b.disabled ? '×' : ''}[${lab(b)}](${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)})`; });
  const over = btns.filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1; }).map(lab);
  const lap = []; for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) { const a = btns[i].getBoundingClientRect(), b = btns[j].getBoundingClientRect(); if (btns[i].contains(btns[j]) || btns[j].contains(btns[i])) continue; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 6 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 6) lap.push(`${i}×${j}`); }
  const small = btns.filter((e) => !e.disabled).filter((e) => { const r = e.getBoundingClientRect(); return r.width < 40 || r.height < 40; }).map((e) => btns.indexOf(e));
  return { view: root.getAttribute && root.getAttribute('data-msx-view'), text: (root.innerText || '').replace(/\n{2,}/g, '\n').slice(0, 2500), btns: list, over, lap, small, hscroll: document.documentElement.scrollWidth > innerWidth + 1 };
};

const HOOK = () => { try { if (window.__sndHooked || typeof Audio_ === 'undefined') return window.__sndHooked ? 'already' : 'no-audio';
  window.__snd = window.__snd || []; const log = (k, n) => window.__snd.push(k + ':' + n);
  for (const k of ['playBGM', 'stopBGM']) { const o = Audio_[k]; if (typeof o === 'function') Audio_[k] = function (a) { log(k, a === undefined ? '' : (typeof a === 'string' ? a : JSON.stringify(a))); return o.apply(this, arguments); }; }
  if (Audio_.fgSe) for (const n of Object.keys(Audio_.fgSe)) { const o = Audio_.fgSe[n]; if (typeof o === 'function') Audio_.fgSe[n] = function () { log('se', n); return o.apply(this, arguments); }; }
  if (Audio_.se && typeof Audio_.se === 'object') for (const n of Object.keys(Audio_.se)) { const o = Audio_.se[n]; if (typeof o === 'function') Audio_.se[n] = function () { log('bse', n); return o.apply(this, arguments); }; }
  for (const n of Object.keys(Audio_)) { if (['playBGM','stopBGM','fgSe','isEnabled','currentBgmKey'].includes(n)) continue; const o = Audio_[n]; if (typeof o === 'function' && /^(play|fadeToBGM|setBgmOnce)/i.test(n)) Audio_[n] = function (a) { log(n, typeof a === 'string' ? a : ''); return o.apply(this, arguments); }; }
  window.__sndHooked = true; return 'hooked'; } catch (e) { return 'ERR ' + e.message; } };
const SND = () => { const s = (window.__snd || []).filter((x) => typeof x === 'string'); window.__snd = []; let bgm = ''; try { bgm = Audio_.currentBgmKey ? (typeof Audio_.currentBgmKey === 'function' ? Audio_.currentBgmKey() : Audio_.currentBgmKey) : ''; } catch (e) {} return { snd: s, bgm }; };
let shotN = fs.readdirSync(OUT).length; let PATCH = true; const sndLog = [];
async function after(name) { // 止め絵(2倍の JPEG と、見る用の等倍 PNG)+ 音
  const l = await page.evaluate(LOOK); const s = await page.evaluate(SND).catch(() => ({ snd: [], bgm: '?' }));
  shotN++; const base = String(shotN).padStart(3, '0') + '-' + (name || l.view || 'x');
  await page.screenshot({ path: path.join(OUT2, base + '.jpg'), type: 'jpeg', quality: 72 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, base + '.png'), scale: 'css' }).catch(() => {});
  sndLog.push(base + ' | bgm=' + s.bgm + ' | ' + s.snd.join(' ')); fs.appendFileSync(path.join(__dirname, 'sound.log'), base + ' | bgm=' + s.bgm + ' | ' + s.snd.join(' ') + '\n');
  l.shot = base; l.snd = s.snd; l.bgm = s.bgm; return l; }
(async () => {
  browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  await open(390, 844);
  http.createServer(async (req, res) => {
    let body = ''; req.on('data', (c) => body += c); await new Promise((r) => req.on('end', r));
    const u = new URL(req.url, 'http://x'); const q = Object.fromEntries(u.searchParams);
    let out;
    try {
      if (u.pathname === '/open') { await open(Number(q.w || 390), Number(q.h || 844)); out = 'ok'; }
      else if (u.pathname === '/entry') { await toEntry(); out = await after('entry'); }
      else if (u.pathname === '/look') { out = await page.evaluate(LOOK); }
      else if (u.pathname === '/tap') { // 番号のボタンを本物のタップで押す
        const box = await page.evaluate((i) => { const b = window.__btns[i]; if (!b) return null; b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, Number(q.i));
        if (!box) out = 'no-btn'; else { await page.mouse.click(box.x, box.y); await page.waitForTimeout(Number(q.wait || 700)); out = await after(q.name); }
      }
      else if (u.pathname === '/click') { await page.evaluate((i) => window.__btns[i].click(), Number(q.i)); await page.waitForTimeout(Number(q.wait || 700)); out = await page.evaluate(LOOK); }
      else if (u.pathname === '/eval') { out = await page.evaluate(body); }
      else if (u.pathname === '/shot') { out = (await after(q.name)).shot; }
      else if (u.pathname === '/errors') { out = errors.splice(0); }
      else if (u.pathname === '/wait') { await page.waitForTimeout(Number(q.ms || 1000)); out = await after(q.name); }
      else if (u.pathname === '/xy') { await page.mouse.click(Number(q.x), Number(q.y)); await page.waitForTimeout(Number(q.wait || 700)); out = await after(q.name); }
      else if (u.pathname === '/patch') { PATCH = q.on === '1'; out = 'patch ' + PATCH; }
      else if (u.pathname === '/hook') { out = await page.evaluate(HOOK); }
      else if (u.pathname === '/save') { const d = await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }); fs.writeFileSync(path.join(__dirname, 'save-' + q.name + '.json'), JSON.stringify(d)); out = 'saved ' + Object.keys(d).length; }
      else if (u.pathname === '/load') { const d = JSON.parse(fs.readFileSync(path.join(__dirname, 'save-' + q.name + '.json'), 'utf8')); const tok = '__restored_' + Date.now(); await page.addInitScript(({ d, tok }) => { if (sessionStorage.getItem(tok)) return; for (const k of Object.keys(localStorage)) if (/^mh_monsuc|^mh_msx|monsuc|success/i.test(k) && !(k in d)) localStorage.removeItem(k); for (const k of Object.keys(d)) localStorage.setItem(k, d[k]); sessionStorage.setItem(tok, '1'); }, { d, tok }); await toEntry(); out = await after(q.name); }
      else if (u.pathname === '/swipe') { const y = Number(q.y), x1 = Number(q.x1), x2 = Number(q.x2); await page.mouse.move(x1, y); await page.mouse.down(); for (let k = 1; k <= 8; k++) await page.mouse.move(x1 + (x2 - x1) * k / 8, y); await page.mouse.up(); await page.waitForTimeout(700); out = await page.evaluate(LOOK); }
      else out = 'unknown';
    } catch (e) { out = 'ERR ' + String(e.message).slice(0, 400); }
    res.end(typeof out === 'string' ? out : JSON.stringify(out, null, 1));
  }).listen(9555, () => console.log('ready'));
})();

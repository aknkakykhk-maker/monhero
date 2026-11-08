#!/usr/bin/env node
// 「セッションLv UP!」の祝いが、一気に何段も上がっても助手ごとに1行にまとまり、画面の外に出ないか(2026-11-08)。
//
//   node tools/ui/growth-fx-session-level-check.js
//   SHOT_DIR=<フォルダ> を付けると、縦・横・🔄横・タブレット(縦横)で撮る
//
// 社長のスクショ(タブレット縦): 助手4人のセッションLvが何段も上がり、「みゅあ セッションLv.8」「… Lv.9」…と1段ごとに1行、
// 20行以上並んで、見出しも下も画面の外へ切れた(社長「一気に上がったときは1~5に上がったみたいにまとめて出すような方法のほうがいいかも」)。
//   ① 中身: 何回に分けて届いても1枚。助手ごとに「Lv.7 → 18」の1行・上がった段の数(+11)・途中で開いたもの(Lv.10 好きな曲が見える など)を添える
//   ② 多いとき: 行は4つまで(5人以上は3人+「ほか◯人」)
//   ③ 画面: 見出し・説明・行が全部、画面の中に入る(縦・横・🔄横・タブレットの縦横)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SRC = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/44-growth-fx.jsx'), 'utf8');

// ①② 中身(部品の外側だけを vm で動かす)
const head = SRC.slice(0, SRC.indexOf('// ---------- 見た目 ----------'));
const IDS = ['mua', 'kiki', 'atsu', 'dra', 'erubin', 'kyuko'];
const NAMES = { mua: 'みゅあ', kiki: 'きき', atsu: 'あつ', dra: 'ドラ', erubin: 'えるびん', kyuko: 'きゅうこ' };
const ctx = { console, ASSISTANT_LIST: IDS.map((id) => ({ id, name: NAMES[id], imageDir: 'images/assistant', imagePrefix: id })), assistantReleased: () => true,
  RHYTHM_ASSIST_SESSION_TASTE_LEVEL: 10, RHYTHM_ASSIST_SESSION_GLOW_LEVEL: 15, RHYTHM_ASSIST_SESSION_CHEER_LEVEL: 25, RHYTHM_ASSIST_SESSION_FRAME_LEVEL: 45,
  RHYTHM_ASSIST_SESSION_BADGE_LEVEL: 50, RHYTHM_ASSIST_SESSION_LISTEN_LEVEL: 75, RHYTHM_ASSIST_SESSION_BACK_LEVEL: 90, RHYTHM_ASSIST_SESSION_MASTER_LEVEL: 100,
  RHYTHM_ASSIST_SESSION_P_BONUS: [[80, 0.08], [60, 0.06], [40, 0.04], [20, 0.02]] };
vm.createContext(ctx);
vm.runInContext(`${head}\nthis.S=GROWTH_FX_STORE;this.session=growthFxSessionLevel;`, ctx);
// 社長のスクショと同じ形: 4人が1段ずつ何回も届く(2回に分けて)
const steps = (id, from, to) => Array.from({ length: to - from }, (_, i) => ({ assistantId: id, levelBefore: from + i, levelAfter: from + i + 1, tickets: 0 }));
// いま出ている窓(先頭)はまとめ直さない作りなので、ほかの祝いが出ている最中に届いた形で確かめる
ctx.S.sheets.push({ tier: 'level', kind: 'other', key: 'other', id: 0 });
ctx.session([...steps('mua', 7, 12), ...steps('atsu', 8, 13)]);
ctx.session([...steps('mua', 12, 18), ...steps('atsu', 13, 16), ...steps('kiki', 3, 11), { assistantId: 'dra', levelBefore: 33, levelAfter: 36, tickets: 1 }]);
const sheets = ctx.S.sheets.filter((s) => s.kind === 'session');
const g = (sheets[0] && sheets[0].gains) || [];
check('何回に分けて届いても、祝いは1枚', sheets.length === 1, `${sheets.length}枚`);
check('助手ごとに1行(段ごとに行が増えない)', g.length === 4, g.map((x) => x.text).join(' / '));
check('行は「Lv.前 → 後」と上がった段の数', !!g[0] && g[0].text === 'みゅあ セッションLv.7 → 18' && g[0].up === '+11' && !!g[1] && g[1].text === 'あつ セッションLv.8 → 16');
check('途中で開いたものを添える(Lv.10 好きな曲が見える・Lv.15 サビで顔が光る)', !!g[0] && /Lv\.10 好きな曲が見える/.test(g[0].note) && /Lv\.15 サビで顔が光る/.test(g[0].note), g[0] && g[0].note);
check('もらったセッション券も添える', !!g[3] && g[3].text === 'ドラ セッションLv.33 → 36' && /セッション券 ×1/.test(g[3].note), g[3] && `${g[3].text} / ${g[3].note}`);
ctx.S.sheets.length = 0;
ctx.session(IDS.map((id) => ({ assistantId: id, levelBefore: 1, levelAfter: 30, tickets: 0 })));
const g6 = (ctx.S.sheets[0] && ctx.S.sheets[0].gains) || [];
check('5人以上は、3人+「ほか◯人」の4行', g6.length === 4 && g6[3].text === 'ほか3人', g6.map((x) => x.text).join(' / '));
check('開いたものが多いときは3つまで(ほか◯つ)', !!g6[0] && /ほか\d+つ$/.test(g6[0].note), g6[0] && g6[0].note);

// ③ 画面
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので画面は確かめられません'); finish(); return; }
  const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
  const PORT = 8963;
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
  const server = await new Promise((r) => { const s = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const [w, h, rot, name] of [[390, 844, false, 'tate'], [844, 390, false, 'yoko'], [390, 844, true, 'rot'], [820, 1180, false, 'tablet-tate'], [1180, 820, false, 'tablet-yoko'], [360, 640, false, 'small']]) {
      const page = await browser.newPage({ viewport: { width: w, height: h } });
      page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
      await page.addInitScript(() => { const put = (k, v) => localStorage.setItem(k, JSON.stringify(v)); put('mh_breeder_name', 'けんさ'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_rhythm_tutorial_seen_v1', true); });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), undefined, { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 12; i++) { const hit = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((e) => e.offsetParent && /^(スキップ|受け取る|閉じる|OK)$/.test((e.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!hit) break; await page.waitForTimeout(300); }
      if (rot) await page.evaluate(() => { try { RHYTHM_VIEW_ROTATION.set(90); } catch (e) {} });
      await page.evaluate(() => {
        const steps = (id, from, to) => Array.from({ length: to - from }, (_, i) => ({ assistantId: id, levelBefore: from + i, levelAfter: from + i + 1, tickets: 0 }));
        growthFxSessionLevel([...steps('mua', 7, 18), ...steps('atsu', 8, 16), ...steps('kiki', 3, 11), ...steps('momosuke', 30, 36)]);
      });
      await page.waitForSelector('.mh-gfx-lv', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(400);
      await page.evaluate(() => { const s = document.querySelector('.mh-gfx-sheet'); if (s) s.click(); }); // 押して動きを終わらせる(最後の形)
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const vw = window.innerWidth, vh = window.innerHeight;
        const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { t: Math.round(r.top), b: Math.round(r.bottom), l: Math.round(r.left), r: Math.round(r.right) }; };
        const inside = (b) => !!b && b.t >= 0 && b.l >= 0 && b.b <= vh + 1 && b.r <= vw + 1;
        const emb = box(document.querySelector('.mh-gfx-emblem'));
        const ttl = box(document.querySelector('.mh-gfx-lv .ttl')); const sub = box(document.querySelector('.mh-gfx-lv .sub'));
        const ul = document.querySelector('.mh-gfx-gains'); const lis = ul ? [...ul.querySelectorAll('li')] : [];
        return { vw, vh, ttl, sub, ul: box(ul), rows: lis.length, texts: lis.map((li) => li.innerText.replace(/\s+/g, ' ')), ok: inside(ttl) && inside(sub) && inside(box(ul)) && inside(emb), emb };
      });
      check(`${name}: 助手ごとに1行(4人で4行)`, m.rows === 4, m.texts.join(' | ').slice(0, 200));
      check(`${name}: Lvの盾・見出し・説明・行が画面の中に入る`, m.ok, JSON.stringify({ vw: m.vw, vh: m.vh, emb: m.emb, ttl: m.ttl, sub: m.sub, ul: m.ul }));
      if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `session-lv-${name}.png`) }); }
      await page.close();
    }
    check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) { check('最後まで通る', false, String(e && e.message || e).slice(0, 300)); }
  finally { await browser.close(); server.close(); }
  finish();
})();
function finish() { console.log(failed ? `${failed}件のNGがあります` : 'すべてOK'); process.exit(failed ? 1 : 0); }

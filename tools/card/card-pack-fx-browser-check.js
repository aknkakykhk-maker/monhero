#!/usr/bin/env node
// MFバトルカード: パックを開ける演出・強め(87 の CardPackOpen・案A'。2026-10-31 社長「速度感は案Aだけど演出は強く」→「これで入れて」)を、
// 実際のブラウザで確かめる(2026-10-31 ルールくん)
//
//   node tools/card/card-pack-fx-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、強めの開け方を動画で残す
//
//   ① 強め(既定・mh_card_pack_fx_v1 が無い): 破るとき中のいちばん良いカードの色で光る / キラは2段・別絵キラは3段、光が上がってからめくれる /
//      真ん中の札が大きい・別絵キラは虹の光の柱と紙吹雪 / 全部めくるで最後までめくれる
//   ② 短め(mh_card_pack_fx_v1 = 'OFF'): 段を上がらず、すぐめくれる(前の開け方)。札はふつうの大きさ・紙吹雪なし
//   ③ 出るカードは変わらない(渡した中身のまま並ぶ)
//   ④ 実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8964;
const SHOT = process.env.SHOT_DIR || '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// 中身: ふつう4枚・キラ1枚・別絵キラ1枚
const PACK = [{ no: '001', rarity: 'normal', slot: 'tech' }, { no: '013', rarity: 'normal', slot: 'tech' }, { no: 'F115', rarity: 'normal', slot: 'tech' }, { no: '025', rarity: 'normal', slot: 'tech' },
  { no: 'C-003S', rarity: 'kira', slot: 'mon' }, { no: 'C-001V', rarity: 'alt', slot: 'mon' }];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const run = async (fxSaved, video) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(video ? { recordVideo: { dir: video, size: { width: 390, height: 844 } } } : {}) });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof CardPackOpen === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
      await page.evaluate(([saved, pack]) => {
        if (saved === null) localStorage.removeItem('mh_card_pack_fx_v1'); else localStorage.setItem('mh_card_pack_fx_v1', saved);
        const div = document.createElement('div');
        div.id = '__pk';
        div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
        document.body.appendChild(div);
        ReactDOM.createRoot(div).render(React.createElement(CardPackOpen, { db: CARD_BATTLE_DATA, result: { packId: 'p1', packs: [pack], dupPoint: 0, cost: 0, demo: true }, onDone: () => {} }));
      }, [fxSaved, PACK]);
      const T = (sel) => page.locator(`#__pk ${sel}`);
      await T('[data-card-pack-tear]').waitFor({ timeout: 15000 });
      const fx = await T('[data-card-pack-open]').getAttribute('data-card-pack-fx');
      await page.waitForTimeout(600);
      await T('[data-card-pack-tear]').click({ force: true });
      await page.waitForTimeout(250);
      const omen = await T('[data-card-pack-omen]').getAttribute('data-card-pack-omen').catch(() => null);
      await T('[data-card-pack-flip-all]').waitFor({ timeout: 8000 });
      await page.waitForTimeout(700);
      // 全部めくるのあいだ、見えたものを拾う
      await page.evaluate(() => {
        const seen = window.__seen = { climb: new Set(), label: new Set(), pillar: 0, confetti: 0, cflash: 0, order: [] };
        const look = () => {
          document.querySelectorAll('#__pk [data-card-pack-climb]').forEach((b) => seen.climb.add(`${b.getAttribute('data-card-pack-rarity')}:${b.getAttribute('data-card-pack-climb')}`));
          document.querySelectorAll('#__pk [data-card-pack-label]').forEach((x) => seen.label.add(x.getAttribute('data-card-pack-label')));
          if (document.querySelector('#__pk [data-card-pack-pillar]')) seen.pillar++;
          const cf = document.querySelector('#__pk [data-card-pack-confetti]'); if (cf) seen.confetti = Math.max(seen.confetti, Number(cf.getAttribute('data-card-pack-confetti')));
          if (document.querySelector('#__pk .mh-pack-cflash')) seen.cflash++;
          requestAnimationFrame(look);
        };
        look();
      });
      const t0 = Date.now();
      await T('[data-card-pack-flip-all]').click();
      await T('[data-card-pack-done]').waitFor({ timeout: 20000 });
      const ms = Date.now() - t0;
      const seen = await page.evaluate(() => ({ ...window.__seen, climb: [...window.__seen.climb].sort(), label: [...window.__seen.label] }));
      const shown = await T('[data-card-pack-card]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-card-pack-rarity')}:${e.getAttribute('data-card-pack-flipped')}`));
      await page.waitForTimeout(video ? 800 : 0);
      await ctx.close();
      return { fx, omen, seen, ms, shown };
    };
    const strong = await run(null, SHOT ? path.join(SHOT, 'raw-strong') : '');
    check('① 強めが既定(保存が無い人)', strong.fx === 'on', strong.fx);
    check('① 破るとき、中のいちばん良いカード(別絵キラ)の色で光る', strong.omen === 'alt', String(strong.omen));
    check('① キラは2段・別絵キラは3段、光が上がってからめくれる', JSON.stringify(strong.seen.climb) === JSON.stringify(['alt:1', 'alt:2', 'alt:3', 'kira:1', 'kira:2']), strong.seen.climb.join(','));
    check('① 札が大きい・別絵キラは虹の光の柱・画面いっぱいの虹の光・紙吹雪(130+60)', strong.seen.label.includes('big') && !strong.seen.label.includes('normal') && strong.seen.pillar > 0 && strong.seen.cflash > 0 && strong.seen.confetti === 190, JSON.stringify(strong.seen));
    const weak = await run('OFF', '');
    check('② 短め(mh_card_pack_fx_v1 = OFF): 段を上がらず・札はふつう・紙吹雪なし・破るときの光なし', weak.fx === 'off' && weak.seen.climb.length === 0 && weak.seen.label.includes('normal') && !weak.seen.label.includes('big') && weak.seen.confetti === 0 && weak.seen.pillar === 0 && !weak.omen, JSON.stringify({ ...weak.seen, omen: weak.omen }));
    check(`② 強めは短めより長いが、延びすぎない(強め ${(strong.ms / 1000).toFixed(1)}秒 / 短め ${(weak.ms / 1000).toFixed(1)}秒)`, strong.ms > weak.ms && strong.ms - weak.ms < 4000, `${strong.ms} / ${weak.ms}`);
    const want = PACK.map((c) => `${c.rarity}:1`);
    check('③ 出るカードは変わらない(渡した中身のまま、全部めくれる)', JSON.stringify(strong.shown) === JSON.stringify(want) && JSON.stringify(weak.shown) === JSON.stringify(want), `${strong.shown.join(',')} / ${weak.shown.join(',')}`);
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで回る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`NG: ${failed} 件`); process.exit(1); }
  console.log('OK: パックを開ける演出');
})();

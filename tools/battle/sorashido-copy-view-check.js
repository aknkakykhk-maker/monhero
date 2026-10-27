// アシカ「ソラシドの自動化」の見せ方の部品(24-sorashido-copy-view.jsx)を、実際のブラウザに置いて確かめる。
//
//   node tools/battle/sorashido-copy-view-check.js                  確かめる
//   node tools/battle/sorashido-copy-view-check.js --shots <フォルダ> 画面の写しも書き出す
//   node tools/battle/sorashido-copy-view-check.js --video <フォルダ> 演出の動画も書き出す(390・約6秒)
//
// バトルへの組み込みはバトル部なので、ここではゲームのページを開いたあと、部品だけを空いた所に置いて見る。見ること:
//   ・コピーの手札の窓: 開く・カードが並ぶ・次に使うカードが光る・「閉じる」が44px以上・外を押すと閉じる・画面からはみ出さない(320 / 390 / 844×390)
//   ・次に使うカードの札: 枠の幅(縦 72px・横 56px)に収まり、長い名前は「…」で切れる。カードが無いときは「考え中」
//   ・演出: 組み上がり(緑のコードの線)・待機(少し透けて緑のふちどり)・選ぶとき(歯車)・消えるとき(光の粒)の目印と、透け具合
//   ・例外が出ない
const http = require('http');
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9197;
const SHOTS = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
// --video <フォルダ> … 390 の画面で、演出(組み上がり→待機→歯車→消える)を順に流した動画も書き出す(報告用)
const VIDEO = process.argv.includes('--video') ? process.argv[process.argv.indexOf('--video') + 1] : null;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
  try {
    for (const [label, w, h] of [['320', 320, 568], ['390', 390, 844], ['844x390', 844, 390]]) {
      const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, serviceWorkers: 'block' });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(require('../boot/quiet-boot-seed').quietBootSeed());
      await page.route(/supabase\.co/, (route) => route.abort());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => typeof MonsterHeroGame !== 'undefined' && typeof SorashidoCopyHandSheet === 'function', null, { timeout: 60000 });
      // 部品だけを置く台(ゲームの画面の上)
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'sorashido-view-host';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0f172a;overflow:hidden';
        document.body.appendChild(host);
        const cards = [
          { id: 'a1', uid: 'a1', name: 'モッチ砲', type: 'atk', guts: 20 },
          { id: 'g1', uid: 'g1', name: 'ガード', type: 'guard', guts: 10 },
          { id: 'u1', uid: 'u1', name: 'ものすごく長い名前の固有技ぶっとびモッチ砲', type: 'unique', guts: 45 },
        ];
        const img = (s) => React.createElement('span', { style: { display: 'inline-block', width: s, height: s, borderRadius: 12, background: 'linear-gradient(135deg,#f472b6,#60a5fa)' } });
        const slot = (layout, card, wpx) => React.createElement('div', { 'data-test-slot': layout, style: { width: wpx, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 4, border: '1px dashed #475569' } },
          React.createElement(SorashidoNextCardBadge, { card, layout, turnsLeft: 2 }), img(wpx - 12));
        window.__soraRoot = ReactDOM.createRoot ? ReactDOM.createRoot(host) : null;
        const tree = React.createElement('div', { style: { padding: 8, color: '#fff' } },
          React.createElement('div', { 'data-test-fx-row': true, style: { display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 10 } },
            ['appear', 'idle', 'thinking', 'vanish'].map((p) => React.createElement('div', { key: p, 'data-test-fx': p, style: { textAlign: 'center', fontSize: 10 } },
              React.createElement(SorashidoCopyFx, { phase: p }, img(48)), React.createElement('div', null, p)))),
          React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
            slot('portrait', cards[0], 72), slot('portrait', cards[2], 72), slot('landscape', cards[1], 56), slot('landscape', null, 56)),
          React.createElement(SorashidoCopyHandSheet, { open: true, copyName: 'モッチー', turnsLeft: 2, cards, nextCard: cards[2], guts: 120, maxGuts: 180, onClose: () => { window.__soraClosed = (window.__soraClosed || 0) + 1; } }));
        if (window.__soraRoot) window.__soraRoot.render(tree); else ReactDOM.render(tree, host);
      });
      await page.waitForTimeout(400);
      const r = await page.evaluate(() => {
        const sheet = document.querySelector('[data-sorashido-hand-sheet]');
        const panel = sheet && sheet.firstElementChild;
        const pr = panel ? panel.getBoundingClientRect() : null;
        const close = document.querySelector('[data-sorashido-hand-close]');
        const cr = close ? close.getBoundingClientRect() : null;
        const cards = [...document.querySelectorAll('[data-sorashido-hand-card]')];
        const next = cards.filter((c) => c.getAttribute('data-sorashido-hand-next') === '1');
        const badges = [...document.querySelectorAll('[data-test-slot]')].map((s) => {
          const b = s.querySelector('[data-sorashido-next]'), name = b && b.querySelector('b');
          const sr = s.getBoundingClientRect(), br = b.getBoundingClientRect();
          return { layout: s.getAttribute('data-test-slot'), kind: b.getAttribute('data-sorashido-next'), inside: br.left >= sr.left - 0.5 && br.right <= sr.right + 0.5, cut: name ? (name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1) : false, text: b.textContent };
        });
        const fx = Object.fromEntries([...document.querySelectorAll('[data-sorashido-fx]')].map((el) => [el.getAttribute('data-sorashido-fx'), {
          code: !!el.querySelector('[data-sorashido-code] i'), gear: !!el.querySelector('[data-sorashido-gear]'), sparks: el.querySelectorAll('[data-sorashido-spark]').length,
          opacity: Number(getComputedStyle(el.querySelector('[data-sorashido-body]')).opacity), filter: getComputedStyle(el.querySelector('[data-sorashido-body]')).filter,
        }]));
        return { pr: pr && { l: pr.left, r: pr.right, t: pr.top, b: pr.bottom }, vw: innerWidth, vh: innerHeight, closeSize: cr && [cr.width, cr.height], cards: cards.length, next: next.length, nextIsLong: next[0] && /固有技/.test(next[0].textContent), badges, fx, docW: document.documentElement.scrollWidth };
      });
      if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `sorashido-view-${label}.png`) });
      check(`${label}: 手札の窓が開き、3枚並び、次に使うカードが1枚だけ光る`, r.cards === 3 && r.next === 1 && r.nextIsLong, JSON.stringify({ cards: r.cards, next: r.next }));
      check(`${label}: 手札の窓は画面からはみ出さない`, !!r.pr && r.pr.l >= 0 && r.pr.r <= r.vw + 0.5 && r.pr.t >= 0 && r.pr.b <= r.vh + 0.5 && r.docW <= r.vw, JSON.stringify(r.pr));
      check(`${label}: 「閉じる」は44px以上`, !!r.closeSize && r.closeSize[0] >= 44 && r.closeSize[1] >= 44, JSON.stringify(r.closeSize));
      check(`${label}: 次に使うカードの札は枠の幅に収まる(縦・横)`, r.badges.length === 4 && r.badges.every((b) => b.inside), JSON.stringify(r.badges.map((b) => [b.layout, b.inside])));
      check(`${label}: 短い名前は札に全部見える(縦の「モッチ砲」・横の「ガード」)`, r.badges[0].cut === false && r.badges[2].cut === false && /モッチ砲/.test(r.badges[0].text), JSON.stringify(r.badges.map((b) => [b.text, b.cut])));
      const turnsOk = await page.evaluate(() => [...document.querySelectorAll('[data-sorashido-turns]')].every((t) => t.getBoundingClientRect().height <= 12 && t.getBoundingClientRect().right <= t.parentElement.getBoundingClientRect().right + 0.5));
      check(`${label}: 残りターンの行は1行で、札からはみ出さない`, turnsOk);
      check(`${label}: 2行に入らない長い名前だけ切れる・カードが無いときは「考え中」`, r.badges[1].cut === true && r.badges[3].kind === 'thinking' && /考え中/.test(r.badges[3].text));
      check(`${label}: 演出の目印(組み上がりの線・歯車・光の粒)`, r.fx.appear && r.fx.appear.code && r.fx.thinking && r.fx.thinking.gear && r.fx.vanish && r.fx.vanish.sparks >= 6 && !r.fx.idle.gear, JSON.stringify(r.fx));
      check(`${label}: 待機中のコピーは少し透けて、緑のふちどり`, r.fx.idle.opacity < 0.9 && r.fx.idle.opacity > 0.5 && /drop-shadow/.test(r.fx.idle.filter), JSON.stringify(r.fx.idle));
      // 閉じる: ボタンと、窓の外
      await page.click('[data-sorashido-hand-close]');
      await page.mouse.click(5, 5);
      check(`${label}: 「閉じる」と窓の外のどちらでも閉じる知らせが来る`, (await page.evaluate(() => window.__soraClosed)) === 2);
      check(`${label}: 例外が出ていない`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await context.close();
    }
    if (VIDEO) {
      fs.mkdirSync(VIDEO, { recursive: true });
      const context = await browser.newContext({ viewport: { width: 390, height: 300 }, serviceWorkers: 'block', recordVideo: { dir: VIDEO, size: { width: 390, height: 300 } } });
      const page = await context.newPage();
      await page.addInitScript(require('../boot/quiet-boot-seed').quietBootSeed());
      await page.route(/supabase\.co/, (route) => route.abort());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => typeof SorashidoCopyFx === 'function', null, { timeout: 60000 });
      await page.evaluate(() => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#0f172a;display:flex;align-items:center;justify-content:center;gap:24px';
        document.body.appendChild(host);
        const root = ReactDOM.createRoot(host);
        const card = { id: 'a1', name: 'モッチ砲' };
        const show = (phase, next) => root.render(React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 96 } },
          React.createElement(SorashidoNextCardBadge, { card: next, turnsLeft: 2 }),
          React.createElement(SorashidoCopyFx, { key: phase, phase }, React.createElement('span', { style: { display: 'inline-block', width: 88, height: 88, borderRadius: 16, background: 'linear-gradient(135deg,#f472b6,#60a5fa)' } })),
          React.createElement('div', { style: { color: '#94a3b8', fontSize: 11 } }, phase)));
        window.__soraShow = show;
      });
      for (const [phase, next, ms] of [['appear', null, 1500], ['idle', null, 900], ['thinking', null, 1200], ['idle', 'card', 1200], ['vanish', null, 1500]]) {
        await page.evaluate(([p, n]) => window.__soraShow(p, n ? { id: 'a1', name: 'モッチ砲' } : null), [phase, next]);
        await page.waitForTimeout(ms);
      }
      await context.close();
      console.log(`動画: ${VIDEO}`);
    }
  } catch (e) {
    check('最後まで確かめられた', false, String(e).slice(0, 300));
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

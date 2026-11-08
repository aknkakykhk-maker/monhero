// MFバトルカード: 助手のデッキの中身を見せる部品(87-card-assistant-deck-view.jsx)を、実際の画面で開いて押して確かめる(2026-11-08 カード部ツナグ)。
//   node tools/card/card-assistant-deck-view-browser-check.js      縦 390×844・横 844×390(カードの画面には🔄横は無い)
//   SHOT_DIR=<フォルダ> を付けると止め絵を残す
//
// 助手部のマスモンのシートと同じ器(56 の ASSISTANT_MASMON_CSS の .mhm-panel / .mhm-body)の中に、CardAssistantDeckView を開く。
//   ① 印 cardGrowStyle が偽のあいだは何も出さない(部品も札も null)
//   ② 8人 × 3つの型で、名前・3体・切り札が出る。種類ごとの一覧の枚数を足すと50枚。×N はデッキの中の枚数と同じ
//   ③ カードを押すと大きく見る窓(data-card-detail)が、シート(z-index 30)より上に出て、閉じられる
//   ④ 字が「…」で切れない・箱からはみ出さない・カードの札(.mhm-card)がパネルの端から 6px 以上あく(助手部の検査と同じ見方)
//   ⑤ 型の札(CardFoeDeckChip)の言葉: 相手えらび「今日のデッキ: 『◯◯』(守り)」・VS「今日は『◯◯』(守り)でいくよ」・結果「相手のデッキ: …」
//   ⑥ 実行時エラーが無い
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const WHO = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const STYLES = ['attack', 'guard', 'normal'];

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); process.exit(0); }
  const { quietBootSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8983;
  const SHOT = process.env.SHOT_DIR || '';
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    for (const [view, vw, vh] of [['縦', 390, 844], ['横', 844, 390]]) {
      const land = vw > vh;
      const page = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: SHOT ? 2 : 1, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      await page.route(/supabase\.co\/|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(quietBootSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof CardAssistantDeckView === 'function' && typeof cardAssistantDeckPreview === 'function' && typeof ASSISTANT_MASMON_CSS === 'string' && window.ReactDOM, null, { timeout: 120000 });
      // 助手部のシートと同じ器に開く。mount(who, style, flag)
      await page.evaluate((land) => {
        const host = document.createElement('div'); host.id = '__deck';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#0b1020';
        document.body.appendChild(host);
        const root = ReactDOM.createRoot(host);
        window.__mount = (who, styleId, on) => {
          RELEASE_FLAGS.cardGrowStyle = on;
          root.render(React.createElement('div', { className: 'absolute inset-0', style: { zIndex: 30 } },
            React.createElement('style', null, ASSISTANT_MASMON_CSS),
            React.createElement('div', { className: `mhm-panel ${land ? 'is-land' : ''}` },
              React.createElement('div', { className: 'mhm-body mt-2' },
                React.createElement(CardAssistantDeckView, { key: `${who}-${styleId}-${on}`, who, styleId, land }),
                React.createElement('div', { className: 'mt-2 flex flex-col gap-1.5' },
                  ['foe', 'vs', 'result'].map((k) => React.createElement(CardFoeDeckChip, { key: k, name: 'のんびり長期戦', styleId: 'guard', kind: k })))))));
        };
      }, land);
      const mount = async (who, s, on = true) => { await page.evaluate(([w, st, o]) => window.__mount(w, st, o), [who, s, on]); await page.waitForTimeout(250); };
      // ① 印が偽
      await mount('dra', 'guard', false);
      const offCount = await page.evaluate(() => document.querySelectorAll('[data-card-assistant-deck-view], [data-card-foe-deck-chip]').length);
      check(`① ${view}: 印 cardGrowStyle が偽のあいだは、部品も札も出さない`, offCount === 0, `${offCount}個`);
      // ② 8人 × 3つ
      const bad = [];
      for (const who of WHO) {
        for (const s of STYLES) {
          await mount(who, s, true);
          const r = await page.evaluate(([who, s]) => {
            const v = document.querySelector('[data-card-assistant-deck-view]');
            const p = cardAssistantDeckPreview(who, s, 'normal');
            const want = {}; p.cards.forEach((no) => { want[no] = (want[no] || 0) + 1; });
            const sum = [...document.querySelectorAll('[data-card-assistant-deck-group] [data-card-assistant-deck-card]')].reduce((n, el) => n + want[el.getAttribute('data-card-assistant-deck-card')], 0);
            const xs = [...document.querySelectorAll('[data-card-assistant-deck-list] [data-card-assistant-deck-card]')].map((el) => { const no = el.getAttribute('data-card-assistant-deck-card'); const b = el.querySelector('b'); return (b ? Number(b.textContent.replace('×', '')) : 1) === want[no]; });
            return { style: v && v.getAttribute('data-card-assistant-deck-view'), name: (document.querySelector('[data-card-assistant-deck-name]') || {}).textContent || '',
              mons: document.querySelectorAll('[data-card-assistant-deck-mon]').length, ace: !!document.querySelector('[data-card-assistant-deck-ace]'), sum, total: p.cards.length, xOk: xs.every(Boolean) };
          }, [who, s]);
          if (!(r.style === s && r.name.trim() && r.mons === 3 && r.ace && r.sum === 50 && r.total === 50 && r.xOk)) bad.push(`${who}/${s}: ${JSON.stringify(r)}`);
        }
      }
      check(`② ${view}: 8人 × 3つの型で、名前・3体・切り札が出て、一覧の合計が50枚・×N がデッキの枚数と同じ`, bad.length === 0, bad.slice(0, 2).join(' / '));
      // ④ 字が切れない・はみ出さない・端にくっつかない(ドラの守りと、名前の長い助手で)
      const fitBad = [];
      for (const [who, s] of [['dra', 'guard'], ['momosuke', 'attack'], ['erubin', 'normal']]) {
        await mount(who, s, true);
        if (SHOT && who === 'dra') await page.screenshot({ path: path.join(SHOT, `${land ? 'landscape' : 'portrait'}-view-dra-guard.png`) });
        const f = await page.evaluate(() => {
          // 助手部の検査(assistant-masmon-browser-check)と同じく、パネル(.mhm-panel)の左右から 6px 以上あくかを見る
          const body = document.querySelector('.mhm-body').getBoundingClientRect();
          const panel = document.querySelector('.mhm-panel').getBoundingClientRect();
          const out = [];
          document.querySelectorAll('[data-card-assistant-deck-view] .mhm-card').forEach((c) => { const r = c.getBoundingClientRect(); if (r.left - panel.left < 6 || panel.right - r.right < 6) out.push(`札がパネルの端に${Math.round(Math.min(r.left - panel.left, panel.right - r.right))}px`); });
          document.querySelectorAll('[data-card-assistant-deck-view] *').forEach((e) => { if (e.classList.contains('truncate') && e.scrollWidth > e.clientWidth + 1) out.push(`「…」で切れる: ${e.textContent.slice(0, 12)}`); });
          document.querySelectorAll('[data-card-assistant-deck-view] p, [data-card-foe-deck-chip]').forEach((e) => { const r = e.getBoundingClientRect(); if (r.right > body.right + 1 || r.left < body.left - 1) out.push(`はみ出し: ${e.textContent.slice(0, 12)}`); });
          return out;
        });
        fitBad.push(...f.map((x) => `${who}/${s}: ${x}`));
      }
      check(`④ ${view}: 字が「…」で切れず、箱からはみ出さず、札がパネルの端から6px以上あく`, fitBad.length === 0, fitBad.slice(0, 3).join(' / '));
      // ③ カードを押すと大きく見る
      await mount('dra', 'guard', true);
      await page.locator('[data-card-assistant-deck-ace] [data-card-assistant-deck-card]').click();
      const det = await page.evaluate(() => { const d = document.querySelector('[data-card-detail]'); if (!d) return null; const z = Number(getComputedStyle(d).zIndex) || 0; const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { z, onTop: !!(top && d.contains(top)) }; });
      if (SHOT) await page.screenshot({ path: path.join(SHOT, `${land ? 'landscape' : 'portrait'}-view-detail.png`) });
      await page.locator('[data-card-detail]').getByRole('button', { name: '閉じる' }).click().catch(() => page.locator('[data-card-detail]').click());
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => !document.querySelector('[data-card-detail]'));
      check(`③ ${view}: 切り札を押すと大きく見る窓がシート(z-index 30)より上に出て、閉じられる`, !!det && det.z >= 35 && det.onTop && closed, JSON.stringify({ det, closed }));
      // ⑤ 型の札の言葉
      const chips = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-card-foe-deck-chip]')].map((e) => [e.getAttribute('data-card-foe-deck-chip'), e.textContent])));
      check(`⑤ ${view}: 型の札の言葉(相手えらび・VS・結果)`, /今日のデッキ: 『のんびり長期戦』\(守り\)/.test(chips.foe || '') && /今日は『のんびり長期戦』\(守り\)でいくよ/.test(chips.vs || '') && /相手のデッキ: 『のんびり長期戦』\(守り\)/.test(chips.result || ''), JSON.stringify(chips));
      check(`⑥ ${view}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally {
    await b.close(); server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

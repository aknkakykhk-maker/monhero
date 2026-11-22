#!/usr/bin/env node
// 助手ライフの作り直し 段6: 画面の型(56-assistant-life-ui.jsx)の見本を撮って、型の決まりを数字で測る。ゲーム本体は変えない・読むだけ。
//   node tools/assistant/life-ui-shoot.js [--out <置き場>] [--2x]
//   置き場の既定: docs/progress/assistant-life/ui-type/(<大きさ>-<見本>.png と measure.json)
// 測る決まり(docs/spec/ASSISTANT_LIFE_UI.md):
//   ① 字は 11・13・16・20px の4段だけ(10px 未満なし)
//   ② 主なボタン(.alu-go)はいちばん上に見えている物が1つだけ(選ぶだけの窓は1つまで)・120×44px 以上・字13px 以上
//   ③ 上の帯は高さ48px・下のタブは5つで画面のいちばん下(どの大きさでも同じ位置)
//   ④ 横にはみ出さない(.alu の中の物が器の右端を越えない)
//   ⑤ 下の空き: 中身のいちばん下と下のタブのあいだが画面の20%まで(窓・結果の1枚を出しているときは窓の中)
//   ⑥ 窓は地が不透明・右上に ✕(44px 以上)
//   ⑦ PC・横は2段組(場面の絵が左・中身が右)。縦は1段
// 最後の1行が OK / NG。
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
const OUT = path.resolve(root, opt('--out', 'docs/progress/assistant-life/ui-type'));
const SIZES = { tate: { w: 390, h: 844 }, s320: { w: 320, h: 568 }, yoko: { w: 844, h: 390 }, pc: { w: 1280, h: 800 } };
const KINDS = ['house', 'sheet', 'result'];
const PORT = 9287;
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
if (require.main === module) fs.mkdirSync(OUT, { recursive: true });

const measure = (o = {}) => {
  const ng = [];
  // o.skipMain … 下まで送った絵(主なボタンが上へ流れて見えない)は②を見ない。場面の絵([data-alu-scene])の中の字は①④で数えない(絵の札は段8〜で直す)
  // o.withScene … 場面の絵の中の字も数える(段7の残り: 家の絵の札を4段に載せた・2026-11-22)
  const inScene = (el) => !o.withScene && !!(el && el.closest && el.closest('[data-alu-scene]'));
  const badAt = [];
  // o.frame … 測る型の目印(部屋は家の型の上に重なるので '[data-assistant-life-typed-room]')
  const frame = document.querySelector(o.frame || '[data-alu-frame]');
  if (!frame) return { ng: ['型(.alu)が描かれていない'] };
  const F = frame.getBoundingClientRect();
  const H = F.height, W = F.width;
  const sheet = frame.querySelector('[data-alu-sheet]');
  const onTop = (el) => { const r = el.getBoundingClientRect(); const t = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return !!t && (t === el || el.contains(t)); };
  // ① 字の段(見えている字だけ)
  const sizes = new Set(); let tiny = 0;
  const walker = document.createTreeWalker(frame, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (inScene(el)) continue;
    // 絵として置いた絵文字(aria-hidden の飾り・部屋の家具)は字ではないので数えない
    if (el.closest('[aria-hidden="true"], [data-assistant-life-room-furn]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || r.bottom < F.top || r.top > F.bottom) continue;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') continue;
    const px = Math.round(parseFloat(st.fontSize) * 10) / 10; sizes.add(px); if (px < 10) tiny++;
    if (![11, 13, 16, 20].includes(px) && badAt.length < (o.badMax || 6)) { const at = o.badMax ? ` ${(el.className && String(el.className).slice(0, 30)) || ''}[${[...el.attributes].map(a => a.name).filter(a => a.startsWith('data-')).slice(0, 1).join('')}]` : ''; badAt.push(`${px}px「${n.textContent.trim().slice(0, 10)}」${at}`); }
  }
  const steps = [...sizes].sort((a, b) => a - b);
  const bad = steps.filter(s => ![11, 13, 16, 20].includes(s));
  if (bad.length) ng.push(`① 4段のほかの字の大きさ: ${bad.join('・')}px(${badAt.join(' ')})`);
  if (tiny) ng.push(`① 10px 未満の字が ${tiny}か所`);
  // ② 主なボタン
  const gos = [...frame.querySelectorAll('.alu-go')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.bottom > F.top && r.top < F.bottom && onTop(e); });
  // 窓(選ぶだけの窓)は主なボタンが無くてよい(1つまで)。画面と結果の1枚はちょうど1つ
  if (o.skipMain ? gos.length > 1 : sheet && !sheet.querySelector('[data-alu-result-gains]') ? gos.length > 1 : gos.length !== 1) ng.push(`② 上に見えている主なボタンが ${gos.length}つ(${sheet ? '窓は1つまで' : '1つだけ'})`);
  const main = gos[0] ? (() => { const r = gos[0].getBoundingClientRect(); return { label: gos[0].textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), font: parseFloat(getComputedStyle(gos[0]).fontSize) }; })() : null;
  if (main && (main.w < 120 || main.h < 44)) ng.push(`② 主なボタン「${main.label}」が ${main.w}×${main.h}px(120×44 以上)`);
  if (main && main.font < 13) ng.push(`② 主なボタンの字が ${main.font}px(13 以上)`);
  // ③ 上の帯・下のタブ
  const top = frame.querySelector('[data-alu-top]').getBoundingClientRect();
  const tabs = frame.querySelector('[data-alu-tabs]'); const T = tabs.getBoundingClientRect();
  if (Math.round(top.height) !== 48 || Math.round(top.top - F.top) !== 0) ng.push(`③ 上の帯が 高さ${Math.round(top.height)}px・上から${Math.round(top.top - F.top)}px`);
  if (tabs.querySelectorAll('[data-alu-tab]').length !== 5) ng.push('③ 下のタブが5つでない');
  if (Math.abs(T.bottom - F.bottom) > 1) ng.push(`③ 下のタブが いちばん下にない(${Math.round(F.bottom - T.bottom)}px 上)`);
  // ④ 横のはみ出し
  let over = 0, overEx = '';
  for (const el of frame.querySelectorAll('*')) { if (inScene(el)) continue; const r = el.getBoundingClientRect(); if (r.width > 0 && (r.right > F.right + 1 || r.left < F.left - 1)) { over++; if (!overEx) overEx = (el.className && String(el.className)) || el.tagName; } }
  for (const el of frame.querySelectorAll('button, .alu-t, .alu-n, .alu-h')) { if (inScene(el)) continue; if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') { over++; if (!overEx) overEx = `${el.textContent.trim().slice(0, 12)}(字が切れる)`; } }
  if (over) ng.push(`④ 器の外・切れる物が ${over}か所(例 ${overEx})`);
  // ⑤ 下の空き
  let gap = 0;
  if (sheet) {
    const sb = sheet.querySelector('.sb'); const last = sb.lastElementChild; const S = sheet.getBoundingClientRect();
    gap = Math.round(S.bottom - last.getBoundingClientRect().bottom);
    if (sb.scrollHeight <= sb.clientHeight + 1 && gap > H * 0.2) ng.push(`⑤ 窓の下の空き ${gap}px(画面の20%まで)`);
  } else {
    const m = frame.querySelector('[data-alu-main]'); const last = m.lastElementChild;
    gap = Math.round(T.top - last.getBoundingClientRect().bottom);
    if (m.scrollHeight <= m.clientHeight + 1 && gap > H * 0.2) ng.push(`⑤ 下の空き ${gap}px(画面の ${Math.round(gap / H * 100)}%・20%まで)`);
  }
  // ⑥ 窓
  if (sheet) {
    const bg = getComputedStyle(sheet).backgroundColor; if (/rgba\(.*,\s*0?\.\d+\)$/.test(bg)) ng.push(`⑥ 窓の地が透けている(${bg})`);
    const x = sheet.querySelector('[data-alu-sheet-close]'); const xr = x && x.getBoundingClientRect(); const S = sheet.getBoundingClientRect();
    if (!x || xr.width < 44 || xr.height < 44 || xr.right < S.right - 12 || xr.top > S.top + 12) ng.push('⑥ 窓の右上に44px 以上の ✕ がない');
  }
  // ⑦ 段組み
  const wide = frame.getAttribute('data-alu-wide') === '1';
  const scene = frame.querySelector('[data-alu-scene]'); const mainEl = frame.querySelector('[data-alu-main]');
  const twoCol = !!scene && scene.getBoundingClientRect().right <= mainEl.getBoundingClientRect().left + 1;
  return { w: Math.round(W), h: Math.round(H), wide, twoCol, fontSteps: steps, main, bottomGap: gap, ng };
};

module.exports = { measure };
if (require.main === module) (async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が無い'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(root, 'tools/boot/quiet-boot-seed'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const result = { shots: {}, errors: [] };
  let failed = 0;
  for (const [sizeId, v] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: argv.includes('--2x') ? 2 : 1 });
    const page = await ctx.newPage();
    page.on('pageerror', e => result.errors.push(`${sizeId}: ${String(e.message || e).slice(0, 160)}`));
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof AssistantLifeUiSample === 'function' && typeof assistantById === 'function', null, { timeout: 60000 });
    for (const kind of KINDS) {
      // 15:00(昼)に固定した時刻で描く
      await page.evaluate((k) => {
        let host = document.getElementById('__alu_sample');
        if (host && host.__root) host.__root.unmount();
        if (host) host.remove();
        host = document.createElement('div'); host.id = '__alu_sample';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#0f0d24';
        document.body.appendChild(host);
        const now = Date.UTC(2026, 10, 21, 6, 0, 0); // 日本時間 15:00
        host.__root = ReactDOM.createRoot(host); host.__root.render(React.createElement(AssistantLifeUiSample, { kind: k, now }));
      }, kind);
      await page.waitForTimeout(900);
      const file = `${sizeId}-${kind}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      const m = await page.evaluate(measure);
      const wantTwo = sizeId === 'pc' || sizeId === 'yoko';
      if (m.twoCol !== wantTwo) m.ng = [...(m.ng || []), `⑦ ${wantTwo ? '2段組になっていない' : '縦なのに2段組'}`];
      result.shots[file] = m;
      console.log(`${m.ng.length ? 'NG' : 'OK'}: ${file} 字 ${(m.fontSteps || []).join('/')}px · 主 ${m.main ? `${m.main.w}×${m.main.h}・${m.main.font}px` : '-'} · 下の空き ${m.bottomGap}px${m.ng.length ? ` — ${m.ng.join(' / ')}` : ''}`);
      if (m.ng.length) failed++;
    }
    await ctx.close();
  }
  await browser.close(); server.close();
  fs.writeFileSync(path.join(OUT, 'measure.json'), JSON.stringify(result, null, 1) + '\n');
  if (result.errors.length) { console.log(`ページのエラー ${result.errors.length}件: ${result.errors.slice(0, 3).join(' / ')}`); }
  console.log(failed ? `NG: ${failed}枚が型の決まりを外れた` : `OK: 型の見本 ${Object.keys(result.shots).length}枚が決まりどおり`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

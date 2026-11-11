// MFバトルカードの画面いっぱいの窓が、iPhone の時計・電池の帯(上)とホームバー(下)に中身をかけないか(2026-11-04 テスターさん)。
//
//   node tools/card/card-safe-area-browser-check.js
//
// 【なぜ要るか】
// 戦術カードをえらぶ窓(「基本の型(メイン)をえらぶ」)の「←戻る」が、iPhone の時計の帯に重なって押せなかった。
// 窓は fixed inset-0 で画面の端まで広がるので、body が取っているセーフエリアの余白が効かない。窓ごとに cardSafePad(84)で取る。
// 後ろが透ける背景(bg-slate-950/95)だと、後ろの画面の「決める」の帯がうっすら見えていたので、画面いっぱいの窓は不透明にする。
//
// 見ているもの
//   ① 書き方: 82〜99 の部品の fixed inset-0 の窓(飾りの aria-hidden・pointer-events-none は除く)が、どれも cardSafePad かセーフエリアを持つ
//   ② 画面いっぱいの窓(flex-col)の背景が、後ろの透ける bg-slate-950/95 ではない
//   ③ 実際の画面: セーフエリア(上47px・下34px。iPhone 15 の縦)を付けて、えらぶ窓(基本の型・条件)の「戻る」が帯より下、下の余白が 34px 以上
//   ④ 詳しい画面(CardDetailModal)の上下の余白もセーフエリア以上
//   ⑤ 実行時エラーが無い
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ①② 書き方
const files = fs.readdirSync(PARTS).filter((f) => /^(8[2-9]|9\d)-.*\.jsx$/.test(f)).sort();
const noPad = [], seeThrough = [];
for (const f of files) {
  const lines = fs.readFileSync(path.join(PARTS, f), 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!/className=(?:"|\{`)fixed inset-0/.test(l) || /aria-hidden|pointer-events-none/.test(l)) return;
    // 余白は同じタグの次の行の style に書くこともある(無効試合の窓 CardPvpVoidDialog など)。タグの終わり(行末の「>」)まで、最大4行を見る
    let tag = l;
    for (let k = i + 1; k < Math.min(lines.length, i + 5) && !/>\s*$/.test(tag); k++) tag += `\n${lines[k]}`;
    if (!/cardSafePad\(|safe-area-inset/.test(tag)) noPad.push(`${f}:${i + 1}`);
    if (/fixed inset-0[^"`]*flex-col[^"`]*bg-slate-950\/95/.test(l)) seeThrough.push(`${f}:${i + 1}`);
  });
}
check('① 画面いっぱいの窓が、どれもセーフエリアの余白を取っている', noPad.length === 0, noPad.join(' / '));
check('② 画面いっぱいの窓の背景が、後ろの透ける bg-slate-950/95 ではない', seeThrough.length === 0, seeThrough.join(' / '));

// ③④ 実際の画面
(async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); process.exit(failed ? 1 : 0); }
  const { quietBootSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8998;
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''); const f = path.join(ROOT, rel); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const errors = [];
  try {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    await ctx.route(/supabase\.co\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await ctx.addInitScript(() => { const s = (k, v) => localStorage.setItem(k, JSON.stringify(v)); s('mh_breeder_name', '検査ブリーダー'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true); });
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const cdp = await ctx.newCDPSession(page);
    const TOP = 47, BOTTOM = 34;
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: TOP, bottom: BOTTOM, left: 0, right: 0 } });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof CardTacticPicker === 'function' && typeof CardDetailModal === 'function' && typeof cardNormalizeTactics === 'function' && window.ReactDOM, null, { timeout: 120000 });
    const measure = (scene) => page.evaluate((scene) => {
      document.getElementById('__safe')?.remove();
      if (window.__safeRoot) window.__safeRoot.unmount();
      const d = document.createElement('div'); d.id = '__safe'; document.body.appendChild(d);
      const db = CARD_BATTLE_DATA, tactics = cardNormalizeTactics(null), none = () => {};
      const el = scene === 'detail' ? React.createElement(CardDetailModal, { db, no: '101', onClose: none })
        : React.createElement(CardTacticPicker, { db, tactics, cat: scene, title: scene === 'base' ? '基本の型(メイン)をえらぶ' : '条件(〜なら)をえらぶ', onPick: none, onClose: none });
      window.__safeRoot = ReactDOM.createRoot(d); window.__safeRoot.render(el);
      return new Promise((res) => setTimeout(() => {
        const root = d.firstElementChild; const cs = root ? getComputedStyle(root) : null;
        const btn = [...d.querySelectorAll('button')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).sort((a, c) => a.top - c.top)[0];
        res({ top: btn ? Math.round(btn.top) : null, padTop: cs ? parseFloat(cs.paddingTop) : 0, padBottom: cs ? parseFloat(cs.paddingBottom) : 0 });
      }, 600));
    }, scene);
    for (const scene of ['base', 'cond']) {
      const m = await measure(scene);
      check(`③ えらぶ窓(${scene})の「戻る」が時計の帯(${TOP}px)より下・下の余白がホームバー(${BOTTOM}px)以上`, m.top !== null && m.top >= TOP && m.padBottom >= BOTTOM, JSON.stringify(m));
    }
    const d = await measure('detail');
    check(`④ 詳しい画面の上下の余白がセーフエリア以上`, d.padTop >= TOP && d.padBottom >= BOTTOM, JSON.stringify(d));
  } catch (e) {
    check('画面を開けた', false, String(e).split('\n')[0]);
  } finally {
    await b.close(); server.close();
  }
  check('⑤ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `${failed}件NG` : 'すべて OK');
  process.exit(failed ? 1 : 0);
})();

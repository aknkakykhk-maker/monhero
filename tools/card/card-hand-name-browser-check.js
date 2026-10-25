// MFバトルカードの手札の名前(84 の CardNameFit twoLine)が、どの大きさの画面でも切れずに読めるかを、実際のブラウザで測る。
//
//   node tools/card/card-hand-name-browser-check.js
//
// 【なぜ要るか】
// 手札の名前は1行に縮めて入れていたが、320幅や横画面の手札(1枚が 50px)では、いちばん小さい字(7px)でも
// 7文字以上の名前が入らず、端が切れていた(2026-10-25 カゲあつくん「カララギマンゴ/ー」。数えると50件)。
// 箱が狭いときだけ言葉の切れ目で2行に折る形にしたので、全部のカード名を本物の部品で並べて確かめる。
//
// 見ているもの
//   ① 手札の箱の幅(50・58・76px)ごとに、全部のカード名が切れていない(どの行も中身が箱に入る)
//   ② 狭い箱(50px)では、7文字以上で2つの言葉の切れ目がある名前だけ2行。1語のカタカナ(フォーメーション など)は割らずに1行
//      (2026-10-25 カゲあつくん「1語のカタカナは割らない」)。2行目の頭が「ー」「ッ」「ン」や小さい字で始まらない
//   ③ 広い箱(58・76px)では、今までどおり1行
//   ④ 「カララギ/マンゴー」「最後の/きらめき」「空中回転/アタック」「ドラゴン/パンチ」のように、言葉の切れ目で折る
//   ⑤ 狭い箱では、短い名前も長い名前も名前の高さがそろう(手札の絵の高さがずれない)
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(__dirname, '..', '..');
const PORT = 8998;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof CARD_BATTLE_DATA !== 'undefined' && typeof CardNameFit === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 60000 });
    // 本物の部品を、手札と同じ字の太さ・大きさの箱へ並べて描く(幅ごと)
    const measure = (width) => page.evaluate(async (W) => {
      const names = [...new Set(Object.values(CARD_BATTLE_DATA.cards).map((c) => c.name))];
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;background:#000;color:#fff;';
      document.body.appendChild(host);
      const items = names.map((name) => React.createElement('div', { key: name, 'data-test-name': name, style: { width: `${W}px`, marginBottom: '2px' }, className: 'rounded-md bg-black/60 py-0.5 text-center leading-tight' },
        React.createElement(CardNameFit, { name, size: W > 58 ? 11 : 10, className: 'font-bold leading-tight', twoLine: true })));
      const r = ReactDOM.createRoot(host);
      r.render(React.createElement(React.Fragment, null, items));
      await new Promise((ok) => setTimeout(ok, 300));
      const out = [...host.querySelectorAll('[data-test-name]')].map((box) => {
        const rows = [...box.querySelectorAll('span.whitespace-nowrap')].filter((el) => el.getClientRects().length > 0);
        return { name: box.getAttribute('data-test-name'), rows: rows.map((el) => el.textContent), clipped: rows.filter((el) => el.scrollWidth > el.clientWidth + 0.5).map((el) => el.textContent), h: Math.round(box.getBoundingClientRect().height) };
      });
      r.unmount(); host.remove();
      return out;
    }, width);
    for (const W of [50, 58, 76]) {
      const res = await measure(W);
      const clipped = res.filter((x) => x.clipped.length);
      check(`① 手札の箱 ${W}px: 全部のカード名(${res.length}種類)が切れていない`, res.length > 200 && clipped.length === 0, clipped.slice(0, 6).map((x) => `${x.name}(${x.clipped.join('/')})`).join('・'));
      if (W === 50) {
        // 1語のカタカナ(割らない)。ここに無い7文字以上の名前は、2つの言葉の切れ目があるので2行
        const ONE_WORD = ['フォーメーション', 'コンビネーション', 'バックドロップ', 'トランスフォーム'];
        const longOne = res.filter((x) => [...x.name].length >= 7 && !/[(（]/.test(x.name) && !ONE_WORD.includes(x.name) && x.rows.length !== 2);
        check('② 狭い箱では、2つの言葉の切れ目がある7文字以上の名前は2行', longOne.length === 0, longOne.slice(0, 6).map((x) => x.name).join('・'));
        const oneWordSplit = res.filter((x) => ONE_WORD.includes(x.name) && x.rows.length !== 1);
        check('② 1語のカタカナ(フォーメーション など)は割らずに1行', oneWordSplit.length === 0 && ONE_WORD.every((n) => res.some((x) => x.name === n)), oneWordSplit.map((x) => x.rows.join('/')).join('・'));
        const badHead = res.filter((x) => x.rows.length === 2 && /^[ーッッンャュョァィゥェォっゃゅょぁぃぅぇぉ、。]/.test(x.rows[1]));
        check('② 2行目の頭が「ー」「ッ」「ン」や小さい字で始まらない', badHead.length === 0, badHead.slice(0, 6).map((x) => x.rows.join('/')).join('・'));
        const mango = res.find((x) => x.name === 'カララギマンゴー');
        check('④ 「カララギマンゴー」は「カララギ/マンゴー」', !!mango && mango.rows.join('/') === 'カララギ/マンゴー', mango ? mango.rows.join('/') : 'なし');
        const want = { '最後のきらめき': '最後の/きらめき', '空中回転アタック': '空中回転/アタック', 'ドラゴンパンチ': 'ドラゴン/パンチ', 'ぐるぐるプレス': 'ぐるぐる/プレス', 'ヒノトリの復活': 'ヒノトリの/復活', 'ハガネのウロコ': 'ハガネの/ウロコ', 'ファイナルソード': 'ファイナル/ソード', 'フォーメーション': 'フォーメーション', 'コンビネーション': 'コンビネーション' };
        const wrong = Object.entries(want).map(([n, w]) => [n, w, (res.find((x) => x.name === n) || { rows: [] }).rows.join('/')]).filter(([, w, got]) => got !== w);
        check('④ 言葉の切れ目で折る(最後の/きらめき・空中回転/アタック・ドラゴン/パンチ)・1語は1行', wrong.length === 0, wrong.map(([n, w, g]) => `${n}: ${g}(${w} のはず)`).join('・'));
        const hs = [...new Set(res.filter((x) => !/[(（]/.test(x.name)).map((x) => x.h))];
        check('⑤ 狭い箱では、名前の高さがそろう(手札の絵がずれない)', hs.length === 1, `高さ ${hs.join('・')}px`);
      } else {
        const twoRows = res.filter((x) => !/[(（]/.test(x.name) && x.rows.length !== 1);
        check(`③ 広い箱 ${W}px では今までどおり1行`, twoRows.length === 0, twoRows.slice(0, 6).map((x) => x.rows.join('/')).join('・'));
      }
    }
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e));
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

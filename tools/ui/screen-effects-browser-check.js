const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// useScreenEffects を「本物の React」で動かし、画面を離れたときの止まりかたを確かめる。
//
//   node tools/ui/screen-effects-browser-check.js
//   (配信 serve.py はこの検査が自分で立てる)
//
// 【なぜ要るか】
// screen-effects-check.js は登録簿そのものを Node 上で動かすが、hook の部分——
// 「描画のたびに現在の画面を入れ直す」「effect の後始末は次の画面が描かれたあとに走る」——は
// React の実行順そのものなので、実物で動かさないと確かめられない。
// ここを取り違えると「新しい画面が登録したタイマーを、古い画面の後始末が止めてしまう」という、
// 画面を切り出したあとにしか出ない不具合になる。
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const PORT = 8981;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ページの中で走らせる本体。本体スクリプトはトップレベル宣言なので、そのまま呼べる
const probe = () => new Promise((done) => {
  const log = [];
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = ReactDOM.createRoot(host);
  const Probe = ({ scope }) => {
    const effects = useScreenEffects(scope);
    React.useEffect(() => {
      effects.timeout(() => log.push('screen:' + scope), 40, 'screen');
      effects.timeout(() => log.push('progress:' + scope), 40, 'progress');
      log.push('mounted:' + scope + ':' + effects.scope);
    }, [scope]);
    return null;
  };
  root.render(React.createElement(Probe, { scope: 'HOME' }));
  setTimeout(() => {
    root.render(React.createElement(Probe, { scope: 'BATTLE' })); // 画面を移る
    setTimeout(() => {
      root.render(null); // 画面そのものが外れる(アンマウント)
      setTimeout(() => { root.unmount(); host.remove(); done(log); }, 120);
    }, 20);
  }, 20);
});

(async () => {
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => typeof useScreenEffects === 'function', { timeout: 60000 });

    const log = await page.evaluate(probe);
    check('hook が本物の React で動く(例外なく描画できる)', Array.isArray(log) && log.length > 0, JSON.stringify(log));
    check('描画した時点で現在の画面が入っている',
      log.includes('mounted:HOME:HOME') && log.includes('mounted:BATTLE:BATTLE'));
    check('画面を離れると、その画面の「画面専用」は止まる', !log.includes('screen:HOME'));
    check('画面を離れても、その画面の「進行」は必ず発火する', log.includes('progress:HOME'));
    check('新しい画面の登録を、古い画面の後始末が巻き込まない(進行が生き残る)', log.includes('progress:BATTLE'));
    check('アンマウントでは残った「画面専用」も止まる', !log.includes('screen:BATTLE'));
    check('hook を動かしても本体のエラーは出ない', pageErrors.length === 0, pageErrors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで走る', false, String(e && e.message ? e.message : e));
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.kill();
  }
  console.log(failed === 0 ? '\nすべてOK' : `\nNG ${failed} 件`);
  process.exit(failed === 0 ? 0 : 1);
})();

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 送れなかった記録の「送り直し」を、実際のブラウザで通して確かめる検査。
//
// 端末に未送信の記録(約450億のスコア)を仕込んだ状態で起動し、
// HOMEへ着いたあとに本当に送信が飛ぶか、送れたら印が付くかを見る。
// Supabaseへは出られないので、送信先の応答は page.route で偽って返す。
//
//   ① 未送信の記録が、起動後に自動で送られる(450億がそのまま送られる)
//   ② 送れたら端末の記録へ「送信済み」の印が付く(記録そのものは消えない)
//   ③ 送信済みの記録は二重に送らない
//   ④ 送信に失敗したときは印を付けず、記録も消さない
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8992;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 端末に残っている記録を模したもの(submitLocalScore が作る形)
const PENDING_SCORE = 45054226345;
const localRows = (extra = {}) => ([
  { userName:'けんさ', hero:'Mocchi', party:[{ role:'hero', id:'Mocchi', name:'モッチー' }],
    score: PENDING_SCORE, diff:'Legend', level:10, icon:'Mocchi', clearId:'pending-450', at: Date.now(),
    reachedWave:10, turns:12, nationalSaved:false,
    nationalError:{ message:'integer out of range', status:400, code:'22003' }, ...extra },
  { userName:'けんさ', hero:'Mocchi', party:[], score: 1000, diff:'Legend', level:10, icon:'Mocchi',
    clearId:'already-sent', at: Date.now(), nationalSaved:true },
]);

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

    // 1回ぶんの立ち上げ。sendOk=false のときは送信を失敗させる
    const run = async (sendOk) => {
      const posted = [];
      const errors = [];
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on('pageerror', (e) => errors.push(String(e)));
      // Supabaseへは出られないので、送信先の応答をここで作る
      await page.route('**/rest/v1/rankings**', async (route) => {
        const req = route.request();
        if (req.method() === 'POST') {
          try { posted.push(JSON.parse(req.postData() || '{}')); } catch { posted.push(null); }
          if (sendOk) return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
          return route.fulfill({ status: 400, contentType: 'application/json',
            body: JSON.stringify({ code:'22003', message:'integer out of range' }) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });
      await page.route('**/rest/v1/bond_levels**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript((rows) => {
        localStorage.setItem('mh_breeder_name', JSON.stringify('けんさ'));
        localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
        localStorage.setItem('mh_onboarded', JSON.stringify(true));
        localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
        localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
        localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
        localStorage.setItem('mh_rank_Legend', JSON.stringify(rows));
      }, localRows());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.addStyleTag({ content: `.snap-mandatory{display:flex;overflow-x:auto;width:100%;}` });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
      // 送り直しは HOME へ着いて少し待ってから始まる(RANKING_RESEND_DELAY_MS)
      await page.waitForTimeout(9000);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_rank_Legend') || '[]'));
      await page.close();
      return { posted, saved, errors };
    };

    // --- 送信できるとき ---
    const ok = await run(true);
    const resent = ok.posted.filter(row => row && row.clear_id === 'pending-450');
    check('未送信の記録が、起動後に自動で送られる', resent.length === 1,
      `POST ${ok.posted.length}件 / 対象 ${resent.length}件`);
    check('450億のスコアがそのまま送られる',
      resent[0] && resent[0].score === PENDING_SCORE, String(resent[0] && resent[0].score));
    check('WAVEとターン数も一緒に送られる',
      resent[0] && resent[0].reached_wave === 10 && resent[0].turns === 12);
    check('送信済みの記録は二重に送らない',
      ok.posted.filter(row => row && row.clear_id === 'already-sent').length === 0);
    const target = ok.saved.find(r => r && r.clearId === 'pending-450');
    check('送れたら端末の記録へ「送信済み」の印が付く', target && target.nationalSaved === true,
      JSON.stringify(target && target.nationalSaved));
    check('記録そのものは消えない',
      ok.saved.length === 2 && target && target.score === PENDING_SCORE);
    check('エラーの控えは消える', target && target.nationalError === undefined);
    check('実行時エラーが出ていない', ok.errors.length === 0, ok.errors[0] || '');

    // --- 送信できないとき ---
    const ng = await run(false);
    const ngTarget = ng.saved.find(r => r && r.clearId === 'pending-450');
    check('送れなかったら印を付けない', ngTarget && ngTarget.nationalSaved === false,
      JSON.stringify(ngTarget && ngTarget.nationalSaved));
    check('送れなくても記録は消さない(次の起動で送り直せる)',
      ng.saved.length === 2 && ngTarget && ngTarget.score === PENDING_SCORE);
    check('送れなくても画面は落ちない', ng.errors.length === 0, ng.errors[0] || '');

    console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
    await browser.close(); server.close();
    process.exit(failed ? 1 : 0);
  } catch (e) {
    console.log(`NG: 確認できませんでした — ${e.message}`);
    if (browser) await browser.close();
    server.close();
    process.exit(1);
  }
})();

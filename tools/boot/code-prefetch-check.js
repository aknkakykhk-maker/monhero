// 事前ダウンロードを本体とデータ(JS・CSS)まで広げたとき(docs/progress/speed/download-plan.md・2026-10-27 社長「作る」)、
// 「新しい版を出したら必ず新しい JS が動く」を実ブラウザ(Chromium)で確かめる。
//
//   node tools/boot/code-prefetch-check.js
//
// 配信を自前で持ち(ポート 8934)、index.html の GAME_BUILD と本体の中身を差し替えて「版を出し直した」を真似る。
// 本体の末尾に印(window.__mhCodeMark)を足し、どちらの版の本体が動いたかを見る。見ること:
//  ① 1回目・2回目の起動で、いまの版(A)の本体が動く。作ったあとは、2回目に ?v= 付きの JS・CSS が SW から返る
//  ② 版を B に変えた index.html を出すと、次の起動で B の本体が動く(A が残って動き続けない)。開き直しても B のまま。
//     作ったあとは、一覧から消えた A が置き場(mh-code-v1)から消える
//  ③ 途中で失敗したとき: 本体の1回目の取得(先読みも)が 500 でも、&retry= 付きの取り直しで B が動く(&retry= は SW から返らない)。
//     作ったあとは、置き場の本体が壊れていても B が動く
//  ④ index.html・version.json・asset-manifest.json・manifest.json は SW がためた物を返さない(素通し)
//  ⑤ 止め札(sw.js の「JS・CSS をためない」印)を立てると素通しになり、置き場が消える。
//     設定の「ダウンロード」を切にすると、置き場(mh-code-v1)も含めて全部消え、B の本体が動く
//
// sw.js に置き場(mh-code-v1)がまだ無い間は、SW 側の項目を「まだ無い」と出して飛ばし、版の入れ替えで新しい本体が動くことだけを確かめる。
// 既存の検査 asset-prefetch-check.js(画像・音源)とは別に回す。
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const PORT = 8934;
const BASE = `http://localhost:${PORT}/monster-hero/`;
const CODE_CACHE = 'mh-code-v1';
const GAME_JS = 'game-system.compiled.js';
// 止め札の印(sw.js の1行)。「const <名前に CODE か JS を含み OFF/STOP を含む> = false;」の形を探す
const KILL_RE = /(const\s+[A-Z0-9_]*(?:CODE|JS)[A-Z0-9_]*(?:OFF|STOP)[A-Z0-9_]*\s*=\s*)false(\s*;)/;

const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };
const notYet = (name) => console.log(`  --  ${name} — まだ無い(sw.js に ${CODE_CACHE} が無いので飛ばす)`);

const swSrc = fs.readFileSync(path.join(GAME, 'sw.js'), 'utf8');
const built = swSrc.includes(CODE_CACHE);
const indexSrc = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
const gameSrc = fs.readFileSync(path.join(GAME, GAME_JS));
const manifestSrc = JSON.parse(fs.readFileSync(path.join(GAME, 'asset-manifest.json'), 'utf8'));
const hash12 = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

// 版を1つ作る: 本体の末尾に印を足し、中身のハッシュを版にする。index.html の GAME_BUILD と一覧(本体が載っていれば)をその版にする
const makeVersion = (mark) => {
  const body = Buffer.concat([gameSrc, Buffer.from(`\n;window.__mhCodeMark = ${JSON.stringify(mark)};\n`)]);
  const v = hash12(body);
  const html = indexSrc.replace(/var GAME_BUILD = '[^']*';/, `var GAME_BUILD = '${v}';`);
  const manifest = JSON.parse(JSON.stringify(manifestSrc));
  if (manifest.files && manifest.files[GAME_JS]) manifest.files[GAME_JS] = { ...manifest.files[GAME_JS], v, size: body.length };
  manifest.id = hash12(Buffer.from(JSON.stringify(manifest.files)));
  return { mark, v, body, html: Buffer.from(html), manifest: Buffer.from(JSON.stringify(manifest)) };
};

// ---- 配信(版の入れ替え・1回だけ失敗させる、ができる) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.PNG': 'image/png' };
const overrides = new Map(); // 'monster-hero/xxx' → Buffer
let failGame = false; // 立っているあいだ、本体の &retry= の無い取得をすべて 500 にする(先読みと1回目の読み込みの両方)
const requests = []; // 届いた取得(本体の取得の数え用)
const serve = () => new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    requests.push(req.url);
    const head = { 'Content-Type': MIME[path.extname(rel)] || MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
    if (failGame && rel === `monster-hero/${GAME_JS}`) {
      if (/[?&]retry=/.test(req.url)) failGame = false;
      else { res.writeHead(500, head); res.end('/* 失敗の真似 */'); return; }
    }
    if (overrides.has(rel)) { res.writeHead(200, head); res.end(overrides.get(rel)); return; }
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, head);
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', reject);
  server.listen(PORT, () => resolve(server));
});
const publish = (ver, sw = null) => {
  overrides.set('monster-hero/index.html', ver.html);
  overrides.set(`monster-hero/${GAME_JS}`, ver.body);
  overrides.set('monster-hero/asset-manifest.json', ver.manifest);
  if (sw) overrides.set('monster-hero/sw.js', Buffer.from(sw)); else overrides.delete('monster-hero/sw.js');
};

(async () => {
  console.log(built ? `(sw.js に ${CODE_CACHE} がある: 全部の項目を確かめる)` : `(sw.js に ${CODE_CACHE} がまだ無い: 版の入れ替えだけを確かめる)`);
  const A = makeVersion('A'), B = makeVersion('B');
  const server = await serve();
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  let log = []; // この起動で返った物 { path, query, sw }
  page.on('response', r => { try { const u = new URL(r.url()); if (u.origin === `http://localhost:${PORT}`) log.push({ path: u.pathname.replace(/^\/monster-hero\//, ''), query: u.search, sw: r.fromServiceWorker(), status: r.status() }); } catch (e) {} });
  const boot = async (ver) => {
    log = [];
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof MonsterHeroGame !== 'undefined' && !!window.__mhCodeMark, null, { timeout: 120000, polling: 200 });
    await page.waitForTimeout(1500);
    return page.evaluate(() => window.__mhCodeMark);
  };
  const codeKeys = () => page.evaluate(async (name) => (await caches.has(name)) ? (await (await caches.open(name)).keys()).map(r => r.url) : null, CODE_CACHE);
  const fromSw = (re) => log.filter(x => x.sw && re.test(x.path));
  try {
    console.log('① いまの版(A)');
    publish(A);
    check('1回目の起動で A の本体が動く', (await boot(A)) === 'A');
    await page.evaluate(() => { try { ASSET_CACHE.setAuto(false); } catch (e) {} }); // 画像・音源の自動ダウンロードは止めて静かにする
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 60000 });
    check('2回目の起動でも A の本体が動く', (await boot(A)) === 'A');
    check('3回目の起動でも A の本体が動く', (await boot(A)) === 'A');
    if (built) {
      check(`3回目は ?v=${A.v} の本体が SW の置き場から返る`, fromSw(new RegExp(`^${GAME_JS.replace(/\./g, '\\.')}$`)).some(x => x.query.includes(`v=${A.v}`)), JSON.stringify(log.filter(x => x.path === GAME_JS)));
      check('3回目は ?v= 付きのデータ(data/*.js)・CSS も SW から返る', fromSw(/^data\/[^/]+\.js$/).length > 0 && fromSw(/^tailwind\.css$/).length > 0);
      const keys = await codeKeys();
      check(`置き場 ${CODE_CACHE} に A の本体がある`, !!keys && keys.some(k => k.includes(GAME_JS) && k.includes(A.v)));
    } else { notYet('2回目から ?v= 付きの JS・CSS が SW から返る'); }

    console.log('② 版を B に出し直す');
    publish(B);
    check('出し直したあとの最初の起動で B の本体が動く(A が残って動かない)', (await boot(B)) === 'B', JSON.stringify(log.filter(x => x.path === GAME_JS)));
    check('開き直しても B のまま', (await boot(B)) === 'B');
    check('もう一度開き直しても B のまま', (await boot(B)) === 'B');
    if (built) {
      const keys = await codeKeys();
      check(`一覧から消えた A の本体が置き場 ${CODE_CACHE} から消える`, !!keys && !keys.some(k => k.includes(GAME_JS) && k.includes(A.v)), (keys || []).filter(k => k.includes(GAME_JS)).join(' '));
      check(`B の本体が置き場に入る`, !!keys && keys.some(k => k.includes(GAME_JS) && k.includes(B.v)));
    } else { notYet('古い版の本体が置き場から消える'); }

    console.log('③ 途中で失敗したとき');
    // 置き場に B があると SW がそれを返し、失敗が起きない。置き場に無い(はじめての版)ときの失敗を真似るため、先に本体だけ外す
    if (built) await page.evaluate(async ({ name, file }) => { const c = await caches.open(name); for (const req of await c.keys()) if (req.url.includes(file)) await c.delete(req); }, { name: CODE_CACHE, file: GAME_JS });
    failGame = true;
    check('本体の1回目の取得(先読みも)が 500 でも、取り直しで B の本体が動く', (await boot(B)) === 'B', JSON.stringify(log.filter(x => x.path === GAME_JS)));
    const retried = log.filter(x => x.path === GAME_JS && /[?&]retry=/.test(x.query));
    check('&retry= 付きで取り直している', retried.length > 0);
    check('&retry= 付きの取得は SW から返らない(必ずネットから取る)', retried.length > 0 && retried.every(x => !x.sw));
    check('失敗した応答をためていない(開き直すと1回で B が動く)', (await boot(B)) === 'B' && !log.some(x => x.path === GAME_JS && /[?&]retry=/.test(x.query)));
    if (built) {
      // 置き場の本体を壊す(中身を MonsterHeroGame の無い物にする)
      const broke = await page.evaluate(async ({ name, file }) => {
        const c = await caches.open(name); let n = 0;
        for (const req of await c.keys()) if (req.url.includes(file)) { await c.put(req, new Response('/* 壊れた本体 */', { headers: { 'Content-Type': 'text/javascript' } })); n++; }
        return n;
      }, { name: CODE_CACHE, file: GAME_JS });
      check('置き場の本体を壊した(検査の準備)', broke > 0, `${broke}件`);
      check('置き場の本体が壊れていても B の本体が動く', (await boot(B)) === 'B', JSON.stringify(log.filter(x => x.path === GAME_JS)));
      check('壊れた本体を置き場に残さない(次の起動は取り直し無しで B が動く)', (await boot(B)) === 'B' && !log.some(x => x.path === GAME_JS && /[?&]retry=/.test(x.query)));
    } else { notYet('置き場の本体が壊れていても新しい本体が動く'); }

    console.log('④ 素通しの物');
    await boot(B);
    for (const p of ['index.html', 'version.json', 'asset-manifest.json', 'manifest.json']) {
      const hits = log.filter(x => x.path === p);
      check(`${p} は SW がためた物を返さない`, hits.every(x => !x.sw), hits.length ? '' : '(この起動では読まれなかった)');
    }
    if (built) {
      const keys = await codeKeys();
      check(`置き場 ${CODE_CACHE} に index.html・version.json・一覧が入っていない`, !!keys && !keys.some(k => /\/(index\.html|version\.json|asset-manifest\.json|manifest\.json)(\?|$)/.test(k)));
    }

    console.log('⑤ 止め札・設定で切');
    const kill = swSrc.match(KILL_RE);
    if (built && kill) {
      publish(B, swSrc.replace(KILL_RE, '$1true$2'));
      // sw.js が変わったので、開き直すと新しい SW に入れ替わる
      await boot(B);
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()));
      await page.waitForTimeout(3000);
      check('止め札を立てても B の本体が動く', (await boot(B)) === 'B');
      check('止め札を立てると JS・CSS を SW から返さない', fromSw(/\.(js|css)$/).length === 0, fromSw(/\.(js|css)$/).slice(0, 3).map(x => x.path).join(' '));
      check(`止め札を立てると置き場 ${CODE_CACHE} が消える`, (await codeKeys()) === null);
      check('止め札を立てても、画像・音源の置き場はそのまま', await page.evaluate(() => caches.has('mh-assets-v1')));
      publish(B);
      await boot(B);
      await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r && r.update()));
      await page.waitForTimeout(3000);
      await boot(B);
    } else if (built) {
      console.log(`  --  止め札 — sw.js に「const …CODE…OFF… = false;」の形の印が見つからないので飛ばす(名前が決まったら KILL_RE を合わせる)`);
    } else { notYet('止め札で素通しになり置き場が消える'); }
    await page.evaluate(() => ASSET_CACHE.setEnabled(false));
    await page.waitForTimeout(1500);
    const off = await page.evaluate(async () => ({ regs: (await navigator.serviceWorker.getRegistrations()).length, caches: (await caches.keys()).filter(n => n.startsWith('mh-')) }));
    check(`設定で切にすると SW が外れ、置き場(${CODE_CACHE} も)が全部消える`, off.regs === 0 && off.caches.length === 0, JSON.stringify(off));
    check('切にしたあとも B の本体が動く', (await boot(B)) === 'B');
    check('切にしたあとは何も SW から返らない', log.every(x => !x.sw));
    await page.evaluate(() => ASSET_CACHE.setEnabled(true)); // 端末の状態を戻す(この検査の中だけ)

    check('ページで例外が出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで走る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    await browser.close();
    server.close();
  }
  const ng = results.filter(ok => !ok).length;
  console.log(ng ? `NG: ${ng}件` : `OK: ${results.length}件すべて通過${built ? '' : '(SW 側の項目は、作ったあとに確かめる)'}`);
  process.exit(ng ? 1 : 0);
})();

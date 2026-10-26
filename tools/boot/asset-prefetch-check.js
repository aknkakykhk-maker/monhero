// 事前ダウンロード(monster-hero/sw.js と 25-asset-cache.jsx の ASSET_CACHE)を実ブラウザで確かめる。
//
//   node tools/boot/asset-prefetch-check.js
//
// 説明の正本: docs/spec/ASSET_PREFETCH.md。見ること:
//  ① 一覧(asset-manifest.json)が音源・画像の中身と合っている / SW が扱うのは音源と画像だけ(コードの形)
//  ② 既定で ON(保存値なし・壊れた値も)。SW が登録され、ページを支配する。HTML・JSON を SW が返さず、JS・CSS は ?v= が一覧とぴったり同じものだけ返す(=ゲーム本体の更新を止めない。2026-10-27 から本体・データもためる)
//  ③ まとまりのダウンロードで、全部が端末に入る。取り消すと途中で止まる。端末から消すと0件になる
//  ④ アップデートの真似(絵を1枚差し替え、一覧の版を変える)で、古い版が消え、新しい中身が返る
//  ⑤ OFFで SW が外れ、ためたものが消える
//  ⑥ 保存データ(mh_* のうち事前ダウンロード専用キー以外)は最初から最後まで1文字も変わらない
//
// 配信は自前(ポート 8933。共有の 8899 とぶつけない)。差し替えの真似をするため、特定のパスだけ中身を入れ替えられる。
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const PORT = 8933;
const BASE = `http://localhost:${PORT}/monster-hero/`;
const OWN_KEY = 'mh_asset_prefetch_v1';

const results = [];
const check = (name, ok, detail = '') => { results.push(!!ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// ---- ① コードと一覧の形 ----
console.log('① 一覧とコードの形');
{
  const r = require('../build-asset-manifest').run({ check: true });
  check('asset-manifest.json がいまの音源・画像と合っている', r.ok, r.reason || '');
  const sw = fs.readFileSync(path.join(GAME, 'sw.js'), 'utf8');
  check('SW が respondWith するのは audio/ images/ data/images/ の音源・画像(拡張子つき)と、本体・データの JS・CSS だけ',
    sw.includes("/^(audio|images|data\\/images)\\/.+\\.(mp3|png|jpe?g|webp)$/i.test(path)) return;") && (sw.match(/respondWith\(/g) || []).length === 2
      && /if \(path && CODE_PATH_RE\.test\(path\)\)/.test(sw));
  check('本体・データは ?v= 付き・retry なしのときだけ受け持ち、止め札(CODE_CACHE_OFF)と切で素通しになる',
    /if \(disabled \|\| CODE_CACHE_OFF \|\| !url\.searchParams\.get\('v'\) \|\| url\.searchParams\.has\('retry'\)\) return;/.test(sw)
      && /const CODE_CACHE_OFF = false;/.test(sw));
  check('本体・データは、URL の版が一覧とぴったり同じときだけ返す・ためる', /e\.pack === 'core' && e\.v === v/.test(sw));
  check('SW はページ本体(navigate)に respondWith しない', /req\.mode === 'navigate'\)[\s\S]{0,200}?return;\s*\}/.test(sw));
  check('SW は Range つきの取得に手を出さない', /req\.headers\.has\('range'\)\) return;/.test(sw));
  check('SW は localStorage に触れない', !/localStorage/.test(sw.replace(/\/\/.*$/gm, '')));
  const part = fs.readFileSync(path.join(GAME, 'src', 'parts', '25-asset-cache.jsx'), 'utf8');
  const keys = [...new Set([...part.matchAll(/['"](mh_[a-z0-9_]+)['"]/g)].map(m => m[1]))];
  check('ページ側が使う保存キーは mh_asset_prefetch_v1 だけ', keys.length === 1 && keys[0] === OWN_KEY, keys.join(','));
  check('ページ側は storeSet(セーブデータの保存)を使わない', !/storeSet\(/.test(part));
  check('本人が入/切を押したときだけ enabledChosen を書く', /enabled: !!next, enabledChosen: true/.test(part) && (part.match(/enabledChosen: true/g) || []).length === 1);
  const settingsSrc = fs.readFileSync(path.join(GAME, 'src', 'parts', '51-screen-settings.jsx'), 'utf8');
  check('設定の「ダウンロード」の行は、入/切に関係なく出す', /\n\s*<SettingsMenuLink icon="📥"[^\n]*data-open-asset-download\/>/.test(settingsSrc) && !/ASSET_CACHE\.enabled && <SettingsMenuLink/.test(settingsSrc));
}

// ---- 配信(差し替えの真似ができる) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.PNG': 'image/png' };
const overrides = new Map(); // 'monster-hero/xxx' → Buffer
const serve = () => new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const head = { 'Content-Type': MIME[path.extname(rel)] || MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' };
    if (overrides.has(rel)) { res.writeHead(200, head); res.end(overrides.get(rel)); return; }
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, head);
    fs.createReadStream(file).pipe(res);
  });
  server.on('error', reject);
  server.listen(PORT, () => resolve(server));
});

const waitFor = async (page, fn, arg, timeout = 120000) => page.waitForFunction(fn, arg, { timeout, polling: 200 });

(async () => {
  const server = await serve();
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  const fromSw = [];
  page.on('response', r => { try { if (r.fromServiceWorker()) fromSw.push(r.url()); } catch (e) {} });
  const snapshotSave = () => page.evaluate((own) => {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k !== own) out[k] = localStorage.getItem(k); }
    return JSON.stringify(Object.keys(out).sort().map(k => [k, out[k]]));
  }, OWN_KEY);
  const status = () => page.evaluate(async () => { await ASSET_CACHE.refreshStatus(); return { packs: ASSET_CACHE.status.packs, job: ASSET_CACHE.job }; });
  try {
    await page.goto(BASE + 'index.html', { waitUntil: 'load' });
    await waitFor(page, () => typeof ASSET_CACHE !== 'undefined');
    // ゲーム自身が起動のたびに書くキー(遊んだ時間・ランキングの控えなど)を、ダウンロードの操作をせずに
    // 同じ回数だけ開き直して先に調べる。比べるのはそれ以外のキー(SW は localStorage を触れないので、見るのはページ側)
    const control0 = await snapshotSave();
    for (let i = 0; i < 3; i++) { await page.reload({ waitUntil: 'load' }); await waitFor(page, () => typeof ASSET_CACHE !== 'undefined'); }
    await page.waitForTimeout(3000);
    const control1 = await snapshotSave();
    const diffKeys = (x, y) => { const a = new Map(JSON.parse(x)), b = new Map(JSON.parse(y)); return [...new Set([...a.keys(), ...b.keys()])].filter(k => a.get(k) !== b.get(k)); };
    const selfWritten = new Set(diffKeys(control0, control1));
    const save0 = await snapshotSave();

    console.log('② ONで登録・ゲーム本体には手を出さない');
    // 既定は入・自動ダウンロード「する」(2026-10-11 公開)。保存値が無い・壊れている人も既定値になり、
    // 「しない」を選んだ人・切にした人の保存値は上書きしない(CLAUDE.md ⑦)
    check('最初から ON・自動ダウンロード「する」(保存値なしの既定)', await page.evaluate(() => ASSET_CACHE.enabled && ASSET_CACHE.auto));
    const norm = await page.evaluate(() => [null, 'こわれた', [1], { enabled: 'yes', auto: 3, songs: 'x' },
      { auto: false }, { enabled: false, enabledChosen: true }, { enabled: false, auto: true, songs: ['a'] }]
      .map(v => normalizeAssetCacheSettings(v)));
    check('保存値が無い・壊れているときは既定値(入・する)', norm.slice(0, 4).every(n => n.enabled === true && n.auto === true && Array.isArray(n.songs) && n.songs.length === 0));
    check('「しない」を選んだ人・本人が切にした人の保存値はそのまま', norm[4].enabled === true && norm[4].auto === false && norm[5].enabled === false && norm[5].auto === true);
    check('既定が切だったころに書かれた enabled:false(本人の印なし)は、既定(入)で読む・ほかの保存値は残す',
      norm[6].enabled === true && norm[6].auto === true && norm[6].songs.join() === 'a');
    await waitFor(page, () => navigator.serviceWorker.ready.then(() => true));
    // ここから先は件数を数えるので、自動ダウンロードは止めておく
    await page.evaluate(() => ASSET_CACHE.setAuto(false));
    await page.reload({ waitUntil: 'load' });
    await waitFor(page, () => typeof ASSET_CACHE !== 'undefined' && !!navigator.serviceWorker.controller);
    check('ONにすると SW がページを支配する', await page.evaluate(() => !!navigator.serviceWorker.controller && ASSET_CACHE.enabled));
    await page.waitForTimeout(3000);
    const pageFromSw = fromSw.filter(u => /\.(html|json)(\?|$)/.test(new URL(u).pathname + '?'));
    check('HTML・JSON を SW が返していない', pageFromSw.length === 0, pageFromSw.slice(0, 3).join(' '));
    // JS・CSS は ?v= が一覧とぴったり同じものだけ SW から返る(本体・データをためる。2026-10-27)
    const coreMap = await page.evaluate(async () => { const m = await (await fetch('asset-manifest.json?t=' + Date.now())).json(); return Object.fromEntries(Object.entries(m.files).filter(([, f]) => f.pack === 'core').map(([k, f]) => [k, f.v])); });
    const badCode = fromSw.filter(u => /\.(js|css)$/.test(new URL(u).pathname)).filter(u => { const x = new URL(u); const p = decodeURIComponent(x.pathname.replace(/^\/monster-hero\//, '')); return coreMap[p] !== x.searchParams.get('v') || x.searchParams.has('retry'); });
    check('SW が返した JS・CSS は、どれも一覧の版とぴったり同じ', badCode.length === 0, badCode.slice(0, 3).join(' '));
    await page.reload({ waitUntil: 'load' });
    await waitFor(page, () => typeof ASSET_CACHE !== 'undefined');
    const codeHits = fromSw.filter(u => /game-system\.compiled\.js\?v=/.test(u)).length;
    check('2回目に開くと、本体(game-system.compiled.js)が SW の置き場から返る', codeHits > 0, `${codeHits}回`);
    // 設定の「ダウンロード」が出る
    const opened = await page.evaluate(() => typeof ASSET_PACKS !== 'undefined' && ASSET_PACKS.map(p => p.id).join(','));
    check('まとまりは モンヒロビート・バトル・バトルカード・全部', opened === 'beat,battle,card,all', opened);
    // バトルカード(2026-10-25)は、公開の印が false のあいだ、遊ぶ人(デバッグの印が無い端末)には出さず、「全部」にも入れない
    const cardGate = await page.evaluate(async () => {
      const released = !!(typeof EVENT_REPLAY_RELEASE_FLAGS !== 'undefined' && EVENT_REPLAY_RELEASE_FLAGS.cardBattle);
      const debug = localStorage.getItem(DEBUG_UNLOCK_KEY) === '1';
      const shown = assetPacksShown().map(p => p.id).join(',');
      const st = await ASSET_CACHE.refreshStatus();
      const m = await (await fetch('asset-manifest.json', { cache: 'no-store' })).json();
      const cardCount = Object.values(m.files).filter(f => f.pack === 'card').length;
      const allCount = st.packs.all ? st.packs.all.count : -1;
      return { released, debug, shown, cardCount, allCount, nonCard: Object.values(m.files).filter(f => f.pack !== 'card' && f.pack !== 'core').length };
    });
    check('公開前の遊ぶ人には「バトルカード」を出さず、「全部」にもカードの絵を入れない(一覧にはカードの絵が入っている)',
      cardGate.released || cardGate.debug || (cardGate.shown === 'beat,battle,all' && cardGate.cardCount > 400 && cardGate.allCount === cardGate.nonCard), JSON.stringify(cardGate));
    // デバッグの合言葉が合った端末には出し、「全部」にもカードの絵が入る(印は読むだけ。確かめたら元に戻す)
    const cardDebug = await page.evaluate(async () => {
      const before = localStorage.getItem(DEBUG_UNLOCK_KEY);
      localStorage.setItem(DEBUG_UNLOCK_KEY, '1');
      const shown = assetPacksShown().map(p => p.id).join(',');
      const st = await ASSET_CACHE.refreshStatus();
      if (before === null) localStorage.removeItem(DEBUG_UNLOCK_KEY); else localStorage.setItem(DEBUG_UNLOCK_KEY, before);
      await ASSET_CACHE.refreshStatus();
      return { shown, all: st.packs.all && st.packs.all.count, card: st.packs.card && st.packs.card.count };
    });
    check('デバッグ端末には「バトルカード」が出て、「全部」にもカードの絵が入る', cardDebug.shown === 'beat,battle,card,all' && cardDebug.card > 400 && cardDebug.all === cardGate.nonCard + cardDebug.card, JSON.stringify(cardDebug));

    console.log('③ ダウンロード・取り消し・消す');
    const battleBefore = (await status()).packs.battle.haveCount; // 遊んでいる画面が使った絵は SW が入れる(作りどおり)
    const t0 = Date.now();
    await page.evaluate(() => { ASSET_CACHE.download('beat'); });
    check('2つ目のダウンロードは、1つ目が終わるまで始まらない', await page.evaluate(async () => (await ASSET_CACHE.download('battle')) === false));
    await waitFor(page, () => !ASSET_CACHE.job, null, 300000);
    let st = await status();
    check('モンヒロビートを落とすと全部が端末に入る', st.packs.beat.haveCount === st.packs.beat.count && st.packs.beat.count > 0,
      `${st.packs.beat.haveCount}/${st.packs.beat.count}件 ${(Date.now() - t0) / 1000}秒`);
    check('モンヒロビートを落としても、バトルの件数は変わらない(まとまりが混ざらない)', st.packs.battle.haveCount === battleBefore, `${battleBefore}→${st.packs.battle.haveCount}件`);
    await page.evaluate(() => { ASSET_CACHE.download('battle'); });
    await waitFor(page, () => ASSET_CACHE.job && ASSET_CACHE.job.done >= 5);
    await page.evaluate(() => ASSET_CACHE.cancel());
    await waitFor(page, () => !ASSET_CACHE.job);
    st = await status();
    check('取り消すと途中で止まる', st.packs.battle.haveCount > 0 && st.packs.battle.haveCount < st.packs.battle.count, `${st.packs.battle.haveCount}/${st.packs.battle.count}件`);
    await page.evaluate(() => ASSET_CACHE.remove('beat'));
    st = await status();
    check('モンヒロビートを端末から消すと0件', st.packs.beat.haveCount === 0);
    check('ほかのまとまり(バトル)は消えない', st.packs.battle.haveCount > 0);

    console.log('④ アップデートの真似');
    // バトルで入っている絵を1枚選び、中身と一覧の版を差し替える
    const target = await page.evaluate(async () => {
      const m = await (await fetch('asset-manifest.json?t=' + Date.now())).json();
      const cache = await caches.open('mh-assets-v1');
      for (const [p, f] of Object.entries(m.files)) {
        if (f.pack !== 'battle' || !/\.(png|jpg)$/i.test(p)) continue;
        if (await cache.match(new URL(`${encodeURI(p)}?v=${f.v}`, location.href).href)) return { path: p, v: f.v, size: f.size };
      }
      return null;
    });
    check('差し替えの相手(端末に入っている絵)が見つかる', !!target, target && target.path);
    if (target) {
      const manifest = JSON.parse(fs.readFileSync(path.join(GAME, 'asset-manifest.json'), 'utf8'));
      const newBody = Buffer.concat([fs.readFileSync(path.join(GAME, target.path)), Buffer.from('mh-new-version')]);
      manifest.files[target.path] = { ...manifest.files[target.path], v: 'abcdef123456', size: newBody.length };
      manifest.id = 'test-updated';
      overrides.set(`monster-hero/${target.path}`, newBody);
      overrides.set('monster-hero/asset-manifest.json', Buffer.from(JSON.stringify(manifest)));
      await page.reload({ waitUntil: 'load' });
      await waitFor(page, () => typeof ASSET_CACHE !== 'undefined' && !!navigator.serviceWorker.controller);
      // 版のない取得(古い作りの <img>)でも、新しい中身が返る
      const got = await page.evaluate(async (p) => (await (await fetch(encodeURI(p))).arrayBuffer()).byteLength, target.path);
      check('版のない取得でも新しい中身が返る(古い絵が残らない)', got === newBody.length, `${got} / 新${newBody.length} / 旧${target.size}`);
      const left = await page.evaluate(async (t) => {
        const cache = await caches.open('mh-assets-v1');
        return {
          old: !!(await cache.match(new URL(`${encodeURI(t.path)}?v=${t.v}`, location.href).href)),
          neu: !!(await cache.match(new URL(`${encodeURI(t.path)}?v=abcdef123456`, location.href).href)),
        };
      }, target);
      check('古い版は自動で消える', !left.old);
      check('新しい版は使った時点で入る', left.neu);
      overrides.clear();
      await page.reload({ waitUntil: 'load' });
      await waitFor(page, () => typeof ASSET_CACHE !== 'undefined');
    }

    console.log('⑤ OFFで外す');
    const codeBefore = await page.evaluate(async () => (await caches.has('mh-code-v1')) ? (await (await caches.open('mh-code-v1')).keys()).length : 0);
    check('OFFにする前は、本体・データが mh-code-v1 にたまっている', codeBefore > 0, `${codeBefore}件`);
    await page.evaluate(() => ASSET_CACHE.setEnabled(false));
    const off = await page.evaluate(async () => ({
      regs: (await navigator.serviceWorker.getRegistrations()).length,
      caches: (await caches.keys()).filter(n => n.startsWith('mh-assets-') || n.startsWith('mh-code-')),
    }));
    check('OFFにすると SW が外れ、ためたもの(画像・音源・本体・データ)が消える', off.regs === 0 && off.caches.length === 0, JSON.stringify(off));

    console.log('⑦ 既定が切だったころに曲を選んだ端末');
    {
      const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
      await ctx2.addInitScript((key) => { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem(key, JSON.stringify({ enabled: false, auto: true, songs: ['six_eternel'] })); } }, OWN_KEY);
      const p2 = await ctx2.newPage();
      await p2.goto(BASE + 'index.html', { waitUntil: 'load' });
      await waitFor(p2, () => typeof ASSET_CACHE !== 'undefined');
      const st2 = await p2.evaluate(async () => ({ enabled: ASSET_CACHE.enabled, auto: ASSET_CACHE.auto, reg: !!(await navigator.serviceWorker.getRegistration()) }));
      check('1段目の保存値(enabled:false・印なし)で開くと入になり、自動ダウンロードも「する」', st2.enabled && st2.auto, JSON.stringify(st2));
      await waitFor(p2, () => navigator.serviceWorker.getRegistration().then(r => !!r));
      check('そのとき SW が登録される', true);
      // 本人が切にしたら、開き直しても切のまま
      await p2.evaluate(() => ASSET_CACHE.setEnabled(false));
      await p2.reload({ waitUntil: 'load' });
      await waitFor(p2, () => typeof ASSET_CACHE !== 'undefined');
      const st3 = await p2.evaluate(async () => ({ enabled: ASSET_CACHE.enabled, regs: (await navigator.serviceWorker.getRegistrations()).length, saved: JSON.parse(localStorage.getItem('mh_asset_prefetch_v1')) }));
      check('本人が切にした人は、開き直しても切のまま(SW も登録しない)', !st3.enabled && st3.regs === 0, JSON.stringify(st3));
      check('切り替えても、最近選んだ曲などほかの保存値は残る', Array.isArray(st3.saved.songs) && st3.saved.songs.includes('six_eternel'));
      await ctx2.close();
    }

    console.log('⑥ 保存データ');
    const save1 = await snapshotSave();
    const diff = diffKeys(save0, save1).filter(k => !selfWritten.has(k));
    check('保存データ(事前ダウンロード専用キー・ゲームがひとりでに書くキー以外)が1文字も変わっていない', diff.length === 0,
      diff.length ? diff.join(',') : `ゲームがひとりでに書くキー: ${[...selfWritten].join(',') || 'なし'}`);
    check('ページで例外が出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('検査が最後まで走る', false, String(e && e.message || e).slice(0, 300));
  } finally {
    await browser.close();
    server.close();
  }
  const ng = results.filter(ok => !ok).length;
  console.log(ng ? `NG: ${ng}件` : `OK: ${results.length}件すべて通過`);
  process.exit(ng ? 1 : 0);
})();

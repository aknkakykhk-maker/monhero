#!/usr/bin/env node
// ゲームを自動で遊び回って、人が気づく種類の不具合を拾う(2026-11-11 検査部)。
//
//   node tools/browser/roam-bot.js                 縦・横・小さい横の3つを、種1で回す
//   node tools/browser/roam-bot.js --quick         歩数を減らして早く回す(毎晩の点検むけ)
//   node tools/browser/roam-bot.js --seed 7 --viewports 縦 --routes バトル,裏クイック --steps 40
//   node tools/browser/roam-bot.js --out docs/progress/qa-YYYY-MM-DD/roam   止め絵と report.json の置き場所
//   node tools/browser/roam-bot.js --update-known  いま出ている物を「既知」に書き足す(窓口へ送ったあとに打つ)
//
// 【何をするか】HOME から入れる主な画面を、決まった種(seed)の順にたどり、画面ごとにランダムなタップを混ぜる。
// 画面を出たら HOME へ戻り、そこで「前の画面の物が残っていないか」を確かめる。
// 【拾うもの】ページのエラー / コンソールの赤 / 画面エラーの表示 / 真っ白 / 固まり / 戻れない画面 /
//   音が鳴りっぱなし・曲が重なる・だれも押していないのに効果音が続く / 前の画面の演出が残る・一瞬出る・画面揺れの残り /
//   同じ窓(祝いなど)が2回出る / 起動直後にボタンが動く(タップのずれ) / ボタンが画面の端で切れる / 横はみ出し
// 【壊さないこと】新しいブラウザ(保存データは空)で回し、外への通信は3段でふさぐ:
//   ① Chromium の名前解決を localhost だけにする ② すべての外向き HTTP を route で止める(Supabase の読みは空で返す)
//   ③ WebSocket・sendBeacon をページの中で止める。本体側の「自動操作のブラウザは書き込まない」の番人もそのまま効く。
// 【出力】要約だけ(問題の大きい順の上位・止め絵の場所)。最後の1行が OK / NG。NG は「既知」に無い新しい物があるとき。
const fs = require('fs');
const os = require('os');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const KNOWN_FILE = path.join(__dirname, 'roam-known.json');
const recorder = require('./lib/roam-recorder');
const seeds = require('../boot/quiet-boot-seed');

// ── 引数 ──
const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => { const i = argv.indexOf(`--${name}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
const QUICK = flag('quick');
const TRACE = flag('trace'); // 1手ずつ書き出す(見つけた物を手で再現するとき)
const SEED = Number(opt('seed', 1)) || 1;
const STEPS = Number(opt('steps', QUICK ? 8 : 16));
const TOP = Number(opt('top', 12));
const OUT = path.resolve(opt('out', path.join(os.tmpdir(), 'monhero-roam')));
const VIEWPORTS = { 縦: { width: 390, height: 844 }, 横: { width: 844, height: 390 }, 小横: { width: 568, height: 320 } };
const vpNames = opt('viewports', '縦,横,小横').split(',').filter((n) => VIEWPORTS[n]);
const routeFilter = opt('routes', '').split(',').filter(Boolean);

// ── コース(HOME からの入り方。そのあとはランダムに歩く) ──
// dept … 見つけた物を返す持ち場(tools/team/depts.json の id)
const HOME_BUTTONS = '.mh-home-facility,.mh-home-mission,.mh-home-gift,.mh-home-settings,.mh-home-update,.mh-home-player';
const home = (label) => ({ tap: `^(\\S+ )?${label}`, within: HOME_BUTTONS });
const BATTLE = home('モンヒロバトル');
const ROUTES = [
  { name: 'M/B管理', dept: 'dev', path: [home('M/B管理')] },
  { name: '図鑑', dept: 'monster', path: [home('M/B管理'), { tap: '^モンスター図鑑' }] },
  { name: '神殿', dept: 'dev', path: [home('神殿')] },
  { name: 'マーケット', dept: 'dev', path: [home('マーケット')] },
  { name: 'ミッション', dept: 'dev', path: [home('ミッション')] },
  { name: 'ギフト', dept: 'dev', path: [home('ギフト')] },
  { name: '更新履歴', dept: 'dev', path: [home('更新履歴')] },
  { name: '設定', dept: 'dev', path: [home('設定')] },
  { name: 'プロフィール', dept: 'dev', path: [{ sel: '.mh-home-player' }] },
  { name: 'おしゃべり', dept: 'assistant-ai', path: [{ sel: '[data-home-assistant-chat]' }] },
  { name: '助手ライフ', dept: 'assistant-life', path: [{ sel: '[data-home-assistant-life]' }], steps: 1.5 },
  { name: 'モンヒロビート', dept: 'beat', path: [home('モンヒロビート')], steps: 2.5, idleListen: 'control' },
  { name: 'MFバトルカード', dept: 'card', path: [{ sel: '[data-home-card-battle]', wait: 1500 }, { hook: 'cardStarter' }], steps: 2.5 },
  { name: 'イベント', dept: 'beat', path: [{ sel: '[data-home-event-banner]' }] },
  { name: 'バトル', dept: 'battle', path: [BATTLE, { tap: '^CLASSIC BATT' }], steps: 3 },
  { name: 'タクティクス', dept: 'battle', path: [BATTLE, { tap: '^TACTICS BATT' }], steps: 3 },
  { name: 'クイック', dept: 'battle', path: [BATTLE, { sel: '[data-battle-system="systemQuick"]' }], steps: 3 },
  // 裏クイック: クイックの∞周回を走らせたままモンヒロビートへ移り、そこで遊んでから HOME へ戻る
  //(社長の報告: 戻ると一瞬バトルの演出が出る・バトルの効果音が鳴り続ける)。入り方は tools/assistant/quick-guide-once-check.js と同じ
  { name: '裏クイック', dept: 'battle', steps: 2, idleListen: true, path: [BATTLE, { sel: '[data-battle-system="systemQuick"]', wait: 1500 },
    { aria: '前の難易度', repeat: 12, optional: true, wait: 300 }, { tap: '^この難易度で挑戦', wait: 1500 },
    { tap: 'スエゾー', within: 'article,button' }, { tap: '^勇者モンに選ぶ$' }, { tap: '近距離|中距離|零距離|遠距離', wait: 1200 },
    { tap: '新規習得' }, { tap: '^習得する$', wait: 3500 }, { sel: '[data-battle-auto-button]', wait: 800 }, { sel: '[data-battle-auto-button]', wait: 800, optional: true },
    { aria: '周回を続けたままモンヒロビートへ', waitFor: 15000, wait: 1800 }] },
];

// 決まった手順でしか通れない所(ランダムなタップでは抜けられない)
const HOOKS = {
  // MFバトルカードのはじめて: スターターを選ぶ → 開ける画面 → 練習試合を飛ばす → トップ(進め方は tools/landscape-screens-check.js と同じ)
  cardStarter: async (page) => {
    if (!(await page.$('[data-card-top="starter"]'))) return;
    await page.click('[data-card-kit="powerful"]', { timeout: 5000 });
    await page.getByRole('button', { name: /にする$/ }).click({ timeout: 5000 });
    await require('../card/lib/starter-open-pass.js')(page);
    await page.waitForSelector('[data-card-battle]', { timeout: 20000 });
    await page.click('[data-card-quit]', { timeout: 5000 });
    await page.waitForTimeout(300);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === '飛ばす' && !x.hasAttribute('data-card-quit')); if (b) b.click(); });
    await page.waitForSelector('[data-card-top="result"]', { timeout: 15000 });
    await page.getByRole('button', { name: 'トップへ' }).click({ timeout: 5000 });
    await page.waitForSelector('[data-card-top="top"]', { timeout: 15000 });
  },
};

// ── 見つけた物の種類(大きい順) ──
const KINDS = {
  pageerror: [100, 'ページのエラー'], screenError: [96, '画面エラーの表示'], hang: [94, '固まった'], white: [92, '真っ白'],
  lost: [88, '窓のボタンが画面の外で押せない'], stuck: [85, '戻れない'], soundLoop: [78, '音が鳴りっぱなし'], ghostSe: [74, 'だれも押していないのに音が続く'], bgmDouble: [72, '曲が重なって鳴る'],
  flash: [68, '前の画面が一瞬出る'], shake: [66, '画面の揺れが残る'], fxLeft: [64, '前の画面の演出が残る'], twice: [62, '同じ窓が2回出る'],
  soundTail: [56, '前の画面の音が残る'], console: [50, 'コンソールの赤'], shift: [46, '起動直後にボタンが動く'], cut: [40, 'ボタンが画面の端で切れる'],
  hOver: [36, '横はみ出し'], enter: [30, 'コースの入口へ進めない'],
};
// 押さないもの(保存データの出し入れ・消去。新しいブラウザなので壊れる物は無いが、起動し直しになって歩けなくなる)。
// マルチは通信をふさいでいるので部屋がつながらず、歩いても意味のある物が拾えない
const NEVER = /MULTI|マルチ|データ.*(削除|消去|初期化|リセット)|引き継|引継|復元|インポート|エクスポート|バックアップ|ログアウト|再読み込み|リロード/;
const FORWARD = /挑戦|出撃|スタート|START|開始|はじめ|決定|選ぶ|えらぶ|バトル|OK|次へ|習得|遊ぶ|プレイ|対戦|受け取る/;
const CONFIRM = /^(OK|確認|はい|スキップ|とばす|飛ばす|あとで|受け取る|次へ|わかった|タップで次へ|終了|終了する|リタイア|リタイアする|降参|投了する|あきらめる|中断|中断する|やめる|トップへ|HOMEへ|ホームへ|結果へ)/;
// 画面をまたいで出る作りの演出(成長の知らせの札 mhGfx*・タップの波紋 mhRipple)。持ち越しに数えない
const CROSSING = /^mhGfx|^mhRipple$/;
// 祝い・知らせの窓(同じ物が2回出たら拾う)
const CELEBRATE = /おめでとう|達成|獲得|レベルアップ|LEVEL ?UP|クリア|解放|ボーナス|報酬|ランクアップ|新記録|受け取りました|GET|CLEAR|COMPLETE/i;
const NETWORK_NOISE = /Failed to load resource|Failed to fetch|fetch failed|NetworkError|Load failed|ERR_FAILED|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR/;

const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

// ── 配信(リポジトリをそのまま配る) ──
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

// 効果音は Tone.js(CDN)で鳴らす。外へは出さないので、同じ版を npm から1回だけ取って手元から渡す。
// 取れないときは効果音が鳴らないだけ(BGM の見張りは効く)。その旨を要約に出す
const toneFile = () => {
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/14-audio.jsx'), 'utf8');
  const version = (src.match(/libs\/tone\/([0-9.]+)\/Tone\.js/) || [])[1];
  if (!version) return null;
  const dir = path.join(os.tmpdir(), 'monhero-roam-cache', `tone-${version}`), file = path.join(dir, 'package', 'build', 'Tone.js');
  if (fs.existsSync(file)) return file;
  try {
    fs.mkdirSync(dir, { recursive: true });
    execSync(`npm pack tone@${version} --silent && tar xzf tone-${version}.tgz package/build/Tone.js`, { cwd: dir, stdio: 'ignore', timeout: 90000 });
  } catch (_) {}
  return fs.existsSync(file) ? file : null;
};

// ── 1つの画面の大きさで回す ──
async function runViewport(chromium, base, vpName, tone) {
  const vp = VIEWPORTS[vpName];
  const rng = mulberry32(SEED * 1000 + vpNames.indexOf(vpName));
  const findings = new Map(); // key → finding
  const stats = { vp: vpName, actions: 0, sigs: new Set(), routes: 0, sbRead: 0, sbWrite: 0, otherBlocked: 0, shots: 0, reboots: 0 };
  // ① 名前解決を localhost だけにする(route をすり抜ける通信があっても、外へは出られない)
  const browser = await chromium.launch({ ...(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}), args: ['--autoplay-policy=no-user-gesture-required', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1'] });
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // ② 外向きの HTTP を全部止める。Supabase の読みは空、書きは「できた」ことにして捨てる(本物へは何も送らない)
  await context.route((url) => !/^(localhost|127\.0\.0\.1)$/.test(url.hostname), (route) => {
    const req = route.request(), url = req.url(), method = req.method();
    if (tone && /\/Tone\.js(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(tone) });
    if (/supabase\.co\//.test(url)) {
      if (method === 'GET' || method === 'HEAD') stats.sbRead++; else stats.sbWrite++;
      if (/\/functions\/v1\//.test(url)) return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      return route.fulfill({ status: method === 'GET' ? 200 : 201, contentType: 'application/json', body: method === 'GET' ? '[]' : '' });
    }
    stats.otherBlocked++;
    return route.abort();
  });
  let page = null;
  const cur = { route: '起動', sig: '', tag: 'boot' };
  const actions = []; // seq → 種類
  const where = () => `${cur.route}／${cur.sig || '?'}`;

  const shot = async (name) => {
    if (stats.shots >= 10) return '';
    const file = path.join(OUT, `${vpName}-${String(++stats.shots).padStart(2, '0')}-${name}.jpg`);
    try { await page.screenshot({ path: file, type: 'jpeg', quality: 55, timeout: 8000 }); return file; } catch (_) { return ''; }
  };
  const add = async (kind, at, detail, { withShot = true } = {}) => {
    detail = String(detail).replace(/\s+/g, ' ').slice(0, 200);
    const key = `${kind}|${at}|${detail.replace(/[0-9]+/g, '#')}`;
    const hit = findings.get(key);
    if (hit) { hit.count++; return; }
    const f = { kind, at, detail, key, count: 1, vp: vpName, dept: (ROUTES.find((r) => r.name === cur.route) || {}).dept || 'dev', shot: '' };
    findings.set(key, f);
    if (withShot === 'back') f.shot = saveBackShot(kind);
    else if (withShot && page) f.shot = await shot(kind);
  };

  const HANG = new Error('ROAM_HANG');
  const ev = (fn, arg, timeout = 7000) => Promise.race([page.evaluate(fn, arg), new Promise((_, reject) => setTimeout(() => reject(HANG), timeout))]);
  const wait = (ms) => page.waitForTimeout(ms);

  const openPage = async () => {
    if (page) await page.close().catch(() => {});
    page = await context.newPage();
    actions.length = 0;
    page.on('pageerror', (e) => { add('pageerror', where(), String(e.message || e).split('\n')[0]); });
    page.on('console', (m) => { if (m.type() !== 'error') return; const t = m.text(); if (NETWORK_NOISE.test(t)) return; add('console', where(), t.split('\n')[0]); });
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    page.on('popup', (p) => p.close().catch(() => {}));
    await page.addInitScript(recorder);
    await page.addInitScript(seeds.quietBootSeed());
    await page.addInitScript(seeds.updateNoticeSeed());
    await page.addInitScript(() => {
      const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
      put('mh_breeder_name', 'ロームボット'); put('mh_breeder_icon', '🤖'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true); put('mh_masu_migrated', true);
      put('mh_clears_Beginner', 1); put('mh_quick_clears_Beginner', 1);
    });
  };
  // 起動して HOME まで進む。first のときは「起動直後にボタンが動くか」も測る
  const boot = async (first) => {
    await openPage();
    await page.goto(`${base}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 40000 });
    await page.waitForSelector('.mh-home-scene', { timeout: 40000 });
    cur.sig = 'HOME';
    if (!first) { await wait(1500); return; }
    // 起動から 0.3 / 1 / 2 / 4 秒のボタンの位置。1秒より後に動く物は、押そうとした指の下から逃げる
    const spots = [];
    let last = 0;
    for (const at of [300, 1000, 2000, 4000]) {
      await wait(at - last); last = at;
      spots.push({ at, list: await ev(() => window.__roam.candidates().map((c) => ({ label: c.label, x: c.x, y: c.y }))) });
    }
    for (let i = 1; i < spots.length - 1; i++) {
      for (const a of spots[i].list) {
        const same = spots[i].list.filter((c) => c.label === a.label).length === 1 ? spots[i + 1].list.filter((c) => c.label === a.label) : [];
        if (same.length !== 1) continue;
        const d = Math.round(Math.hypot(same[0].x - a.x, same[0].y - a.y));
        if (d > 6) await add('shift', 'HOME', `「${a.label}」が起動の${spots[i].at / 1000}秒後から${spots[i + 1].at / 1000}秒後のあいだに${d}px動く`);
      }
    }
  };

  const act = async (kind, x, y, label = '') => {
    stats.actions++;
    if (TRACE) console.error(`[${vpName}] ${cur.route}／${cur.sig} … ${kind} ${label} (${x},${y})`);
    actions.push(kind);
    await ev((k) => { const R = window.__roam; R.seq++; if (k === 'back') R.leaveAt = performance.now(); }, kind);
    if (kind === 'scroll') { await page.mouse.move(x, y); await page.mouse.wheel(0, y > vp.height / 2 ? 260 : -260); } else await page.mouse.click(x, y);
  };
  // 画面の具合を見て、見つけた物を足す。真っ白・固まりなら false(起動し直しが要る)
  const cutSeen = new Set(), overSeen = new Set();
  const check = async () => {
    let h = await ev(() => window.__roam.health());
    cur.sig = h.sig; stats.sigs.add(h.sig);
    if (h.error) await add('screenError', where(), '画面の代わりにエラーの表示が出ている');
    if (h.white) { await wait(1500); h = await ev(() => window.__roam.health()); if (h.white) { await add('white', where(), '画面に何も出ていない(1.5秒たっても同じ)'); return false; } }
    if (h.hOver && !overSeen.has(h.sig)) { overSeen.add(h.sig); await add('hOver', `${cur.route}／${h.sig}`, `右へ${h.hOver}pxはみ出す`); }
    if (h.lost.length && !cutSeen.has(`lost|${h.sig}`)) {
      cutSeen.add(`lost|${h.sig}`);
      await wait(900); // 出てくる途中の物を数えない
      const again = await ev(() => window.__roam.health());
      const still = h.lost.filter((c) => again.sig === h.sig && again.lost.includes(c));
      if (still.length) await add('lost', `${cur.route}／${h.sig}`, still.join(' / '));
    }
    if (h.cut.length && !cutSeen.has(h.sig)) {
      cutSeen.add(h.sig);
      await wait(700); // 動いている途中の物を数えない(0.7秒あとも切れている物だけ)
      const again = await ev(() => window.__roam.health());
      const still = h.cut.filter((c) => again.sig === h.sig && again.cut.includes(c));
      if (still.length) await add('cut', `${cur.route}／${h.sig}`, still.slice(0, 4).join(' / '));
    }
    return true;
  };

  // HOME へ戻る。戻れなければ false
  let backShot = null, lastFrom = '';
  const saveBackShot = (name) => {
    if (!backShot || stats.shots >= 10) return '';
    const file = path.join(OUT, `${vpName}-${String(++stats.shots).padStart(2, '0')}-${name}.jpg`);
    fs.writeFileSync(file, backShot); return file;
  };
  const goHome = async (max = 24) => {
    const used = new Map();
    await page.keyboard.press('Escape').catch(() => {}); // 開いたままのプルダウン(select)があると、ほかを押せない
    for (let i = 0; i < max; i++) {
      if (await ev(() => window.__roam.isHome())) return true;
      const list = (await ev(() => window.__roam.candidates())).filter((c) => !NEVER.test(c.label) && (used.get(c.label) || 0) < 6);
      const overlay = await ev(() => !!window.__roam.topOverlay());
      const pick = (overlay && list.find((c) => CONFIRM.test(c.label)))
        || list.find((c) => c.back && /HOME|ホーム/.test(c.label + c.aria))
        || list.find((c) => c.back)
        || list.find((c) => CONFIRM.test(c.label))
        || list.find((c) => /一時停止|ポーズ|中断|pause|ほかの画面へ|を出る|退出|抜ける|メニュー|MENU|☰/i.test(c.label + c.aria))
        // 戻る物が何も無い画面(パックの開封など)は、進む物を押して先へ送る
        || (i >= 3 && list.length ? list[Math.floor(rng() * list.length)] : null);
      lastFrom = cur.sig;
      await ev(() => window.__roam.watch(1800));
      if (pick) { used.set(pick.label, (used.get(pick.label) || 0) + 1); await act('back', pick.x, pick.y, pick.label || pick.aria); }
      // 押せる物が見えていない: 窓の中を下へ送って探す(閉じるボタンが下にある窓)。それでも無ければ Esc と真ん中のタップ
      else if (i % 2 === 0) { await page.mouse.move(Math.round(vp.width / 2), Math.round(vp.height / 2)); await page.mouse.wheel(0, 500); }
      else { await page.keyboard.press('Escape').catch(() => {}); await act('back', Math.round(vp.width / 2), Math.round(vp.height / 2)); }
      // 切り替わりの最中の止め絵(「一瞬出る」物は、あとから撮っても写らない)
      await wait(130);
      backShot = await page.screenshot({ type: 'jpeg', quality: 55, timeout: 5000 }).catch(() => null);
      await wait(520);
      cur.sig = await ev(() => window.__roam.sig());
    }
    return ev(() => window.__roam.isHome());
  };

  // HOME の「ふだん」(ここに無い音・演出が、ほかの画面から戻ったあとに出たら持ち越し)
  const baseline = { anims: new Set(), sounds: new Set(), starts: 0 };
  const learnHome = async () => {
    const got = await ev(() => { const R = window.__roam; return { anims: Object.keys(R.anims.home || {}).concat(Object.keys(R.anims.boot || {})), sounds: R.audioNow().map((a) => a.sig) }; });
    got.anims.forEach((n) => baseline.anims.add(n)); got.sounds.forEach((s) => baseline.sounds.add(s));
  };

  let idleControl = -1;
  // 1コースぶん歩く
  const walk = async (route, index) => {
    cur.route = route.name; cur.tag = `v${index}:${route.name}`; stats.routes++;
    await ev((t) => { window.__roam.tag = t; }, cur.tag);
    const visited = new Set();
    // 入口
    let entered = true;
    for (const stepDef of route.path) {
      if (stepDef.hook) { await HOOKS[stepDef.hook](page).catch(() => {}); if (!(await check())) return false; continue; }
      let found = false;
      const tries = stepDef.repeat || 1, until = Date.now() + (stepDef.waitFor || 2500);
      for (let n = 0; n < tries; n++) {
        let spot = null;
        do { spot = await ev((q) => window.__roam.find(q), stepDef); if (!spot) await wait(300); } while (!spot && Date.now() < until && n === 0);
        if (!spot) break;
        found = true;
        await act('path', spot.x, spot.y, spot.label);
        await wait(stepDef.wait || 900);
      }
      if (!found && !stepDef.optional) { await add('enter', route.name, `「${stepDef.tap || stepDef.sel || stepDef.aria}」が見つからない(その手前の画面: ${await ev(() => window.__roam.sig())})`); entered = false; break; }
      if (!(await check())) return false;
      visited.add(cur.sig.split('>')[0]);
    }
    if (!entered) return goHome(); // 入口で止まったら、ちがう画面をこのコースの名前で歩かない
    // だれも押さずに耳をすます(裏で回っている物の音が、ほかの画面で鳴り続けていないか)
    if (route.idleListen) {
      const t0 = await ev(() => performance.now());
      await wait(5000);
      const n = await ev((t) => window.__roam.starts.filter((x) => x > t + 1000).length, t0);
      if (route.idleListen === 'control') idleControl = n; // ふつうに入ったときの数(比べる相手)
      else if (n >= 3 && n > Math.max(0, idleControl) * 2 + 2) await add('ghostSe', where(), `だれも押していない4秒のあいだに音が${n}回鳴り始めた(裏の周回なしで同じ画面に入ったときは${idleControl < 0 ? '測っていない' : `${idleControl}回`})。裏で回っているバトルの音が、この画面で鳴っている疑い`);
    }
    // ランダムに歩く
    let homeStreak = 0;
    const tried = new Set(), steps = Math.round(STEPS * (route.steps || 1)), deadline = Date.now() + (QUICK ? 45000 : 90000);
    for (let i = 0; i < steps && Date.now() < deadline; i++) {
      const list = (await ev(() => window.__roam.candidates())).filter((c) => !NEVER.test(c.label));
      const overlay = await ev(() => !!window.__roam.topOverlay());
      const r = rng();
      if (!list.length || r < 0.12) await act('random', 8 + Math.floor(rng() * (vp.width - 16)), 8 + Math.floor(rng() * (vp.height - 16)));
      else if (r < 0.17) await act('scroll', Math.round(vp.width / 2), 40 + Math.floor(rng() * (vp.height - 80)));
      else {
        const weights = list.map((c) => (tried.has(`${cur.sig}|${c.label}`) ? 1 : 4) * (FORWARD.test(c.label) ? 2 : 1) * (c.back ? (overlay ? 0.6 : 0.25) : 1));
        let x = rng() * weights.reduce((a, b) => a + b, 0), k = 0;
        while (k < list.length - 1 && (x -= weights[k]) > 0) k++;
        tried.add(`${cur.sig}|${list[k].label}`);
        await act(overlay ? 'in-overlay' : 'tap', list[k].x, list[k].y, list[k].label);
      }
      await wait(250 + Math.floor(rng() * 350));
      if (!(await check())) return false;
      visited.add(cur.sig.split('>')[0]);
      // 歩いているうちに HOME へ出たら、このコースはここまで(ちがう画面をこのコースの名前で歩かない)
      homeStreak = cur.sig === 'HOME' ? homeStreak + 1 : 0;
      if (i > 0 && (homeStreak >= 2 || await ev(() => window.__roam.isHome()))) break;
    }
    // 出る
    const leftFrom = cur.sig;
    if (!(await goHome())) {
      await add('stuck', `${route.name}／${cur.sig}`, `戻る・閉じるを24回ためしても HOME へ戻れない(出ようとした画面: ${leftFrom})`);
      return false;
    }
    // ── HOME に戻った直後(切り替わりの1コマずつ) ──
    await wait(1900);
    const frames = await ev(() => window.__roam.frames || []);
    const mine = await ev((t) => Object.keys(window.__roam.anims[t] || {}), cur.tag);
    const fromBase = lastFrom.split('>')[0]; // 最後の「戻る」を押す直前にいた画面
    const span = (list) => (list.length ? Math.max(16, list[list.length - 1].t - list[0].t) : 0);
    const other = frames.filter((f) => { const b = f.sig.split('>')[0]; return b && b !== 'HOME' && b !== fromBase && visited.has(b); });
    if (other.length >= 2) await add('flash', `${route.name}／${leftFrom}`, `HOME へ戻る途中に「${other[0].sig.split('>')[0]}」の画面が${span(other)}ミリ秒出る`, { withShot: 'back' });
    const atHome = frames.filter((f) => f.sig === 'HOME');
    const carried = (names) => names.filter((n) => mine.includes(n) && !baseline.anims.has(n) && !CROSSING.test(n));
    const flashFx = atHome.filter((f) => carried(f.names).length).length >= 3 ? atHome.filter((f) => carried(f.names).length) : [];
    const shaken = atHome.filter((f) => f.shaken);
    // ── 落ち着いてから(戻って4秒あと) ──
    const quietFrom = await ev(() => performance.now());
    await wait(QUICK ? 1600 : 2600);
    const now = await ev((q) => { const R = window.__roam; return { audio: R.audioNow(), anims: R.animsNow(), leaveAt: R.leaveAt, t: performance.now(), starts: R.starts.filter((x) => x > q + 600).length, log: R.overlayLog }; }, quietFrom);
    const stay = carried(now.anims.names);
    if (stay.length) await add('fxLeft', `${route.name}／${leftFrom}`, `HOME に戻って4秒たっても、前の画面のアニメーションが走っている: ${stay.slice(0, 4).join(', ')}`);
    else if (flashFx.length) await add('fxLeft', `${route.name}／${leftFrom}`, `HOME に戻った直後の${span(flashFx)}ミリ秒、前の画面のアニメーションが走る: ${carried(flashFx[0].names).slice(0, 4).join(', ')}`, { withShot: 'back' });
    if (now.anims.shaken) await add('shake', `${route.name}／${leftFrom}`, 'HOME に戻って4秒たっても、画面そのものが動かされたまま(画面揺れの残り)');
    else if (shaken.length) await add('shake', `${route.name}／${leftFrom}`, `HOME に戻った直後の${span(shaken)}ミリ秒、画面そのものが揺れる`, { withShot: 'back' });
    // 音: この画面にいるあいだに鳴らし始めて、出たあとも聞こえている物
    const left = now.audio.filter((a) => a.tag === cur.tag && now.t - a.age * 1000 < now.leaveAt && !baseline.sounds.has(a.sig));
    for (const a of left) {
      const what = a.kind === 'osc' ? '効果音(発振)' : `${a.dur}秒の音${a.loop ? '(くり返し)' : ''}`;
      if (a.loop || a.kind === 'osc') await add('soundLoop', `${route.name}／${leftFrom}`, `${what}が、HOME に戻って4秒たっても鳴っている(鳴らし始めて${Math.round(a.age)}秒・音量${a.gain})`, { withShot: false });
      else if (a.dur - a.age > 1) await add('soundTail', `${route.name}／${leftFrom}`, `${what}が、HOME に戻って4秒たってもまだ鳴っている(あと${Math.round(a.dur - a.age)}秒)`, { withShot: false });
    }
    const loops = [...new Set(now.audio.filter((a) => a.loop && a.kind !== 'osc').map((a) => a.sig))];
    if (loops.length >= 2) await add('bgmDouble', `${route.name}／${leftFrom}`, `HOME でくり返しの曲が${loops.length}つ同時に鳴っている: ${loops.join(' と ')}`, { withShot: false });
    if (now.starts >= 3 && baseline.starts === 0) await add('ghostSe', `${route.name}／${leftFrom}`, `HOME に戻ってだれも押していない2秒のあいだに、音が${now.starts}回鳴り始めた`, { withShot: false });
    // 同じ窓が2回: 1回目を閉じただけ(または何もしていない)のに、同じ窓がもう一度出た
    const logs = now.log.filter((e) => e.tag === cur.tag);
    for (let i = 1; i < logs.length; i++) {
      const a = logs[i - 1], b = logs[i];
      if (a.sig !== b.sig || b.t - a.t > 20000 || !CELEBRATE.test(a.sig)) continue;
      const between = actions.slice(a.seq, b.seq);
      if (between.length <= 2 && between.every((k) => k === 'in-overlay' || k === 'back')) await add('twice', `${route.name}／${a.sig.split('|')[0]}`, `「${a.sig.split('|')[1].slice(0, 24)}」の窓が、閉じたあと${Math.round((b.t - a.t) / 100) / 10}秒でもう一度出た`, { withShot: false });
    }
    cur.route = 'HOME'; cur.sig = 'HOME';
    await ev(() => { window.__roam.tag = 'home'; });
    await learnHome();
    return true;
  };

  // ── 本番 ──
  let ok = true;
  try {
    await boot(true);
    await ev(() => { window.__roam.tag = 'home'; });
    // 起動直後の窓(ログインボーナスなど)を見てから閉じる。閉じられなければ、それが見つけた物
    await wait(1200);
    await check();
    if (!(await goHome(10))) { await add('stuck', `起動／${cur.sig}`, '起動直後に出た窓を閉じられず、HOME を触れない'); stats.reboots++; await boot(false); await ev(() => { window.__roam.tag = 'home'; }); await goHome(8); }
    const t0 = await ev(() => performance.now());
    await wait(3000);
    baseline.starts = await ev((t) => window.__roam.starts.filter((x) => x > t + 600).length, t0);
    await learnHome();
    cur.route = 'HOME';
    await check();
    // コースの順は種で決める(裏クイックは長いので最後)
    const picked = ROUTES.filter((r) => !routeFilter.length || routeFilter.includes(r.name));
    const order = picked.filter((r) => r.name !== '裏クイック').map((r) => [rng(), r]).sort((a, b) => a[0] - b[0]).map((x) => x[1]).concat(picked.filter((r) => r.name === '裏クイック'));
    for (let i = 0; i < order.length; i++) {
      let fine = false;
      try { fine = await walk(order[i], i + 1); }
      catch (e) {
        if (e === HANG) await add('hang', where(), '画面が7秒返事をしない(固まった)', { withShot: false });
        else await add('stuck', where(), `歩いている途中で進めなくなった: ${String(e.message || e).split('\n')[0]}`);
      }
      if (!fine) { stats.reboots++; cur.route = '起動'; await boot(false); await ev(() => { window.__roam.tag = 'home'; }); await goHome(8); }
    }
    stats.sockets = await ev(() => window.__roam.blockedSockets).catch(() => 0);
  } catch (e) {
    ok = false;
    await add('stuck', where(), `回し切れなかった: ${String(e === HANG ? '画面が返事をしない' : e.message || e).split('\n')[0]}`).catch(() => {});
  } finally {
    await browser.close().catch(() => {});
  }
  return { findings: [...findings.values()], stats: { ...stats, sigs: stats.sigs.size }, ok };
}

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch (_) { try { ({ chromium } = require(path.join(ROOT, 'tools/node_modules/playwright'))); } catch (__) { console.log('SKIP: playwright が入っていないので回せません'); process.exit(0); } }
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/\.jpg$|^report\.json$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const started = Date.now();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const tone = toneFile();
  const runs = flag('serial')
    ? await vpNames.reduce(async (acc, n) => [...await acc, await runViewport(chromium, base, n, tone)], Promise.resolve([]))
    : await Promise.all(vpNames.map((n) => runViewport(chromium, base, n, tone)));
  server.close();

  // 画面の大きさをまたいで同じ物をまとめる
  const merged = new Map();
  for (const run of runs) for (const f of run.findings) {
    const m = merged.get(f.key);
    if (m) { m.vps.push(f.vp); m.count += f.count; if (!m.shot) m.shot = f.shot; } else merged.set(f.key, { ...f, vps: [f.vp] });
  }
  let known = [];
  try { known = JSON.parse(fs.readFileSync(KNOWN_FILE, 'utf8')).keys || []; } catch (_) {}
  const all = [...merged.values()].map((f) => ({ ...f, sev: KINDS[f.kind][0], label: KINDS[f.kind][1], isNew: !known.includes(f.key) }))
    .sort((a, b) => (b.isNew - a.isNew) || (b.sev - a.sev) || (b.vps.length - a.vps.length) || a.key.localeCompare(b.key));
  const fresh = all.filter((f) => f.isNew);
  const total = (k) => runs.reduce((s, r) => s + (r.stats[k] || 0), 0);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ seed: SEED, steps: STEPS, viewports: vpNames, stats: runs.map((r) => r.stats), findings: all.map(({ vp, ...f }) => f) }, null, 1));
  if (flag('update-known')) {
    fs.writeFileSync(KNOWN_FILE, `${JSON.stringify({ note: '窓口へ送り済みの物。直ったら行を消す(node tools/browser/roam-bot.js --update-known は足すだけ)', keys: [...new Set([...known, ...all.map((f) => f.key)])].sort() }, null, 1)}\n`);
  }

  const secs = Math.round((Date.now() - started) / 1000);
  console.log(`roam-bot: 種${SEED} / ${vpNames.join('・')} / コース${total('routes')}回 / 画面${total('sigs')}種 / 操作${total('actions')}回 / 起動し直し${total('reboots')}回 / ${Math.floor(secs / 60)}分${secs % 60}秒`);
  console.log(`外へ出さなかった通信: Supabase 読み${total('sbRead')}・POSTなど${total('sbWrite')}(集計の読み出しを含む。どれも本物へは届かない) / ソケット${total('sockets')} / ほか${total('otherBlocked')}${tone ? '' : ' / ★Tone.js を取れなかったので効果音は鳴っていない(BGM の見張りだけ)'}`);
  console.log(`見つけた物 ${all.length}件(新しい ${fresh.length}・既知 ${all.length - fresh.length})${all.length > TOP ? ` — 大きい順に上位${TOP}件` : ''}`);
  all.slice(0, TOP).forEach((f, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${f.isNew ? '' : '(既知)'}[${f.label}] ${f.at} — ${f.detail} 〔${f.vps.join('・')}${f.count > f.vps.length ? ` ×${f.count}` : ''} / 持ち場 ${f.dept}〕${f.shot ? ` 止め絵 ${path.relative(ROOT, f.shot).startsWith('..') ? f.shot : path.relative(ROOT, f.shot)}` : ''}`);
  });
  const byKind = {};
  for (const f of all) byKind[f.label] = (byKind[f.label] || 0) + 1;
  if (all.length) console.log(`種類ごと: ${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(' / ')}`);
  console.log(`全部の一覧と止め絵: ${OUT}/report.json`);
  const broken = runs.some((r) => !r.ok);
  console.log(fresh.length || broken ? `NG(新しい物 ${fresh.length}件${broken ? '・回し切れなかった大きさあり' : ''})` : 'OK');
  process.exit(fresh.length || broken ? 1 : 0);
})().catch((e) => { console.error(e); console.log('NG(道具が途中で止まった)'); process.exit(1); });

// 遊んでくれるロボット(プレイボット)。実ブラウザでゲームを開き、ボタンを押して回り、
// 「おかしなこと」を見つけたらスクリーンショット付きで記録する(2026-10-06 試作)。
//
//   node tools/playbot/playbot.js                 ふつうに1回(約4分)
//   node tools/playbot/playbot.js --steps 300     探索の手数を変える
//   node tools/playbot/playbot.js --seed 12345    同じ乱数で同じ押し方を再現する
//   node tools/playbot/playbot.js --headed        画面つきで動かす(手元で見たいとき)
//
// 結果は tools/out/playbot/<日時>/ に出る(report.md / report.json / 画像)。tools/out は git に入らない。
//
// 【やること】
//   1. 起動: TAP TO START → タイトル → HOME まで、止まらずに着くか
//   2. クイックモード: 勇者モンを選んでバトルへ入り、AUTO で一定時間回す。進行が止まらないか
//   3. 探索: 画面に見えているボタンを、まだ押していないものを優先して押していく
//      (モンキーテスト)。押すたびに下の「見張り」を確かめる
//
// 【見張り】(見つけたら issues に積む)
//   ・JSの実行時エラー(pageerror / console.error)
//   ・画面が真っ白(#root が空、または本文が空)
//   ・横にはみ出す(ページ全体が画面幅より広い)
//   ・押せるものが1つも無い(行き止まり)
//   ・押しても何も変わらないボタン(同じボタンで3回続いたら)
//   ・バトルの進行が一定時間止まる
//
// 【守ること】(CLAUDE.md ⑦)
//   ・毎回まっさらなブラウザで動かす。手元・本番のセーブデータには触れない
//   ・Supabase(全国ランキング)へは一切送らない。通信を横取りして、読みは空、書きは成功を返す
//   ・外部への通信はすべて止める(よその作品へのリンクも開かない)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { quietBootSeed, updateNoticeSeed } = require('../boot/quiet-boot-seed');

const ROOT = path.resolve(__dirname, '..', '..');
const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : fallback;
};
const STEPS = Math.max(1, Number(argOf('steps', 160)) || 160);
const SEED = Number(argOf('seed', Date.now() % 1000000)) || 1;
const HEADED = args.includes('--headed');
const AUTO_WATCH_MS = Math.max(5000, Number(argOf('auto-ms', 45000)) || 45000);
const PORT = 8981;
const PAGE_URL = `http://localhost:${PORT}/monster-hero/index.html`;

const stamp = (() => {
  const d = new Date(Date.now() + 9 * 3600 * 1000); // JST
  return d.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-');
})();
const OUT = path.join(ROOT, 'tools', 'out', 'playbot', stamp);
fs.mkdirSync(OUT, { recursive: true });

// ---- 再現できる乱数(mulberry32) ----
let rngState = SEED >>> 0;
const rand = () => {
  rngState = (rngState + 0x6D2B79F5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- 配信(リポジトリのルート) ----
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// ---- 押さないボタン ----
// まっさらなブラウザなので消えて困るデータは無いが、押すと探索が進まなくなるもの・
// 外へ出ていくもの・デバッグ専用のものは避ける
const AVOID = /削除|初期化|リセット|引き継ぎ|データ移行|ログアウト|デバッグ|DEBUG|Debug|検証用|外部|公式サイト|X\(|Twitter|共有|シェア|コピー|ダウンロード|書き出し|読み込む|復元|あきらめる|ギブアップ|リタイア|フルスクリーン|全画面/;

// 見つけたものの分け方。「不具合候補」はまず直す対象、「改善のヒント」は遊びやすさの話
const HINT_KINDS = new Set(['反応なし']);
// 調べた結果、意図どおりだと分かっている挙動。消さずに「既知」として報告の下のほうへ回す
// (同じものを毎回調べ直さないため)。足すときは、どこにそう書いてあるかを note に残す
const KNOWN = [
  { kind: '反応なし', screen: /^rhythm/, detail: /「ポーズ」/,
    note: 'カウントダウン中は止めない作り(30-rhythm-play.jsx の pause)。押せない見た目にするかは別の話' },
];

const issues = [];
const steps = [];
const screensSeen = new Map(); // 画面の見出し → 初めて見た手番
const clickCount = new Map();  // ボタン名 → 押した回数
let shotNo = 0;

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので動かせません'); process.exit(0); }

  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: !HEADED });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, locale: 'ja-JP', timezoneId: 'Asia/Tokyo' });
  const page = await context.newPage();

  // ---- 通信: 手元以外は止める。Supabase だけは「空の成功」を返す ----
  let supabaseWrites = 0;
  await context.route('**/*', async (route) => {
    const url = route.request().url();
    if (url.startsWith(`http://localhost:${PORT}/`)) return route.continue();
    if (/supabase\.co/.test(url)) {
      const method = route.request().method();
      if (method === 'GET' || method === 'HEAD') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
      supabaseWrites += 1;
      return route.fulfill({ status: 201, contentType: 'application/json', body: '[]' });
    }
    return route.abort();
  });

  // ---- 見張り: エラー ----
  let currentStep = 0;
  const errorLog = [];
  const IGNORE_CONSOLE = /ERR_FAILED|ERR_BLOCKED|net::|Failed to load resource|AudioContext|play\(\) failed|NotAllowedError|autoplay/i;
  page.on('pageerror', (e) => errorLog.push({ step: currentStep, kind: 'pageerror', text: String(e && e.message || e) }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (IGNORE_CONSOLE.test(text)) return;
    errorLog.push({ step: currentStep, kind: 'console', text });
  });

  const shot = async (label) => {
    shotNo += 1;
    const name = `${String(shotNo).padStart(3, '0')}-${label.replace(/[^\w぀-ヿ一-鿿-]+/g, '_').slice(0, 40)}.png`;
    await page.screenshot({ path: path.join(OUT, name) }).catch(() => {});
    return name;
  };
  const issueKeys = new Set();
  const addIssue = async (kind, detail, extra = {}) => {
    // 同じ種類・同じ中身は1回だけ記録する(画像も1枚だけ)
    const key = `${kind}|${String(detail).slice(0, 120)}`;
    if (issueKeys.has(key)) return;
    issueKeys.add(key);
    const screen = await screenName().catch(() => '?');
    const image = await shot(kind);
    const known = KNOWN.find((k) => k.kind === kind && k.screen.test(screen) && k.detail.test(String(detail)));
    const level = known ? '既知' : HINT_KINDS.has(kind) ? '改善のヒント' : '不具合候補';
    issues.push({ kind, level, known: known ? known.note : null, detail: String(detail), step: currentStep, screen, image, recentSteps: steps.slice(-6), ...extra });
    console.log(`  ${level === '不具合候補' ? '⚠' : '・'} [${level}] ${kind}: ${String(detail).slice(0, 100)} (手番${currentStep} / ${screen})`);
  };

  // ---- 画面の様子を読む ----
  // gameState はページの外から見えないので、テーマの分類と、いちばん上に見えている見出しで画面を呼び分ける
  const screenName = () => page.evaluate(() => {
    const app = document.querySelector('.mh-app');
    const cat = app ? app.getAttribute('data-mh-theme-category') || '' : '';
    const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight; };
    const dialog = [...document.querySelectorAll('[role="dialog"]')].filter(vis).pop();
    const scope = dialog || document;
    const head = [...scope.querySelectorAll('h1,h2,h3')].filter(vis)
      .map((h) => (h.innerText || '').replace(/\s+/g, ' ').trim()).find((t) => t && t.length <= 30);
    if (document.querySelector('.mh-home-scene') && !dialog) return 'HOME';
    return `${cat || '-'}${dialog ? '/dialog' : ''}:${head || '(見出しなし)'}`;
  });

  // 押せるボタンの一覧(見えていて、無効でなく、上に何も重なっていないもの)
  const listButtons = () => page.evaluate((avoidSrc) => {
    const avoid = new RegExp(avoidSrc);
    const out = [];
    const els = [...document.querySelectorAll('button, [role="button"], a[href], input[type="checkbox"], input[type="radio"], select')];
    els.forEach((el, idx) => {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      if (el.tagName === 'A' && (el.target === '_blank' || /^https?:/.test(el.getAttribute('href') || ''))) return;
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) return;
      const top = document.elementFromPoint(cx, cy);
      if (!top || !(top === el || el.contains(top) || top.contains(el))) return;
      const label = (el.getAttribute('aria-label') || el.innerText || el.title || el.tagName)
        .replace(/\s+/g, ' ').trim().slice(0, 40) || `(無名の${el.tagName.toLowerCase()})`;
      if (avoid.test(label)) return;
      out.push({ idx, label, x: cx, y: cy, tag: el.tagName });
    });
    return out;
  }, AVOID.source);

  const health = () => page.evaluate(() => {
    const root = document.getElementById('root');
    const text = (document.body && document.body.innerText || '').trim();
    const doc = document.documentElement;
    return {
      blank: !root || root.childElementCount === 0 || text.length === 0,
      overflowX: Math.max(doc.scrollWidth, document.body ? document.body.scrollWidth : 0) - innerWidth,
      text: text.slice(0, 2000),
    };
  });

  // 押したあとの確認をまとめて行う
  let lastErrorCount = 0;
  const inspect = async () => {
    const h = await health().catch(() => null);
    if (h) {
      if (h.blank) await addIssue('真っ白', '画面に何も描かれていない');
      if (h.overflowX > 2) await addIssue('横はみ出し', `ページが画面幅より ${Math.round(h.overflowX)}px 広い`, { screenAt: await screenName() });
    }
    while (lastErrorCount < errorLog.length) {
      const e = errorLog[lastErrorCount++];
      await addIssue(e.kind === 'pageerror' ? 'JSエラー' : 'コンソールエラー', e.text);
    }
    const name = await screenName().catch(() => '?');
    if (!screensSeen.has(name)) {
      screensSeen.set(name, { step: currentStep, image: await shot(`screen-${name}`) });
    }
    return { name, h };
  };

  const tap = async (b) => {
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(450 + Math.floor(rand() * 300));
  };

  // 重なった案内・ログインボーナスなどを閉じる
  const dismissOverlays = async () => {
    // ★会話(イベントのお話など)は「次へ」を何十回も押すことになるので、「スキップ」を先に押す
    for (let i = 0; i < 40; i++) {
      const list = await listButtons();
      const b = list.find((x) => /^スキップ$/.test(x.label))
        || list.find((x) => /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|とじる|×)$/.test(x.label));
      if (!b) break;
      await tap(b);
    }
  };

  const tapLabel = async (pattern, wait = 900) => {
    const list = await listButtons();
    const b = list.find((x) => pattern.test(x.label));
    if (!b) return false;
    steps.push({ step: currentStep, screen: await screenName(), label: b.label, scripted: true });
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(wait);
    return true;
  };

  const phases = [];
  const phase = async (name, fn) => {
    const t0 = Date.now();
    let ok = true, note = '';
    try { const r = await fn(); if (r === false) ok = false; else if (typeof r === 'string') note = r; }
    catch (e) { ok = false; note = e.message; await addIssue('シナリオ失敗', `${name}: ${e.message}`); }
    phases.push({ name, ok, ms: Date.now() - t0, note });
    console.log(`${ok ? 'OK' : 'NG'}: ${name}${note ? ' — ' + note : ''} (${((Date.now() - t0) / 1000).toFixed(1)}秒)`);
  };

  // ---- 下準備: 「はじめての設定」と起動時の会話を済ませた状態から始める ----
  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'プレイボット');
    put('mh_breeder_icon', '🤖');
    put('mh_intro_done', true);
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_assistant_selected_v1', 'mua');
    put('mh_assistant_unlock_seen_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true);
    put('mh_clears_Beginner', 1);
    put('mh_quick_clears_Beginner', 1);
  });
  await page.addInitScript(quietBootSeed());
  await page.addInitScript(updateNoticeSeed());

  const goHome = async () => {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await tapLabel(/TAP TO START/, 2200);
    await tapLabel(/トップ画面へ進む/, 2200);
    await dismissOverlays();
    await page.waitForFunction(() => !!document.querySelector('.mh-home-scene'), { timeout: 20000 });
  };

  // ===== 1. 起動 =====
  await phase('起動してHOMEへ着く', async () => {
    const t0 = Date.now();
    await goHome();
    await inspect();
    return `${((Date.now() - t0) / 1000).toFixed(1)}秒`;
  });

  // ===== 2. クイックモードを AUTO で回す =====
  const battleStats = { entered: false, samples: [], stalls: 0 };
  await phase('クイックモードをAUTOで遊ぶ', async () => {
    await page.evaluate(() => document.querySelector('button[aria-label="モンヒロバトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('[data-battle-system="systemQuick"]')?.click());
    await page.waitForTimeout(1300);
    await inspect();
    // 難易度は前回の選択(初めてなら Normal)から始まる。挑戦できる難易度が出るまで左へ送る
    for (let i = 0; i < 9 && !(await tapLabel(/この難易度で挑戦/, 1500)); i++) {
      if (!(await tapLabel(/^前の難易度$/, 700))) break;
    }
    // 勇者モンは毎回ちがう子を選ぶ(偏りなく見るため)。カードは「総合力」を含む枠で見分ける
    // ★画像の有無で探すと、助手の顔(吹き出しの横)を勇者モンと取り違える
    const heroCount = await page.evaluate(() => [...document.querySelectorAll('article,button,[role="button"],div')]
      .filter((x) => /総合力/.test(x.innerText || '') && /詳細を見る/.test(x.innerText || '') && x.querySelectorAll('img').length === 1).length);
    const pick = Math.floor(rand() * Math.max(1, Math.min(heroCount, 8)));
    const heroName = await page.evaluate((n) => {
      const cards = [...document.querySelectorAll('article,button,[role="button"],div')]
        .filter((x) => /総合力/.test(x.innerText || '') && /詳細を見る/.test(x.innerText || '') && x.querySelectorAll('img').length === 1);
      const card = cards[n] || cards[0];
      if (!card) return '';
      card.scrollIntoView({ block: 'center' });
      const detail = [...card.querySelectorAll('button')].find((b) => /詳細を見る/.test(b.innerText || ''));
      (detail || card).click();
      return (card.innerText || '').split('\n')[0].trim();
    }, pick);
    await page.waitForTimeout(900);
    await tapLabel(/勇者モンに選ぶ/, 900);
    await tapLabel(/近距離|中距離|零距離|遠距離/, 1300);
    await dismissOverlays();
    await tapLabel(/新規習得/, 900);
    await tapLabel(/^習得する$/, 3500);
    await inspect();
    const inBattle = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
    battleStats.entered = inBattle;
    if (!inBattle) { await addIssue('進めない', 'クイックモードのバトル画面へ入れなかった'); return false; }
    await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
    await page.waitForTimeout(800);
    const sample = () => page.evaluate(() => {
      const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
      return {
        turn: Number((text.match(/TURN\s*(\d+)/) || [])[1] || 0),
        wave: Number((text.match(/WAVE\s*(\d+)/) || [])[1] || 0),
        over: /GAME OVER|ゲームオーバー|リザルト|RESULT|CLEAR|クリア/.test(text),
      };
    });
    const t0 = Date.now();
    let last = await sample(), lastChange = Date.now();
    while (Date.now() - t0 < AUTO_WATCH_MS) {
      await page.waitForTimeout(3000);
      currentStep += 1;
      const s = await sample();
      battleStats.samples.push({ t: Date.now() - t0, ...s });
      if (s.turn !== last.turn || s.wave !== last.wave || s.over !== last.over) lastChange = Date.now();
      // 結果画面に出たら、閉じるボタンなどを押して先へ進めるかも確かめる
      if (s.over) break;
      if (Date.now() - lastChange > 20000) {
        battleStats.stalls += 1;
        await addIssue('進行停止', `AUTO中に20秒以上 WAVE/ターンが動かない (W${s.wave}/T${s.turn})`);
        break;
      }
      last = s;
      await inspect();
    }
    const end = battleStats.samples[battleStats.samples.length - 1] || last;
    return `${heroName || '?'} で W${end.wave} / T${end.turn}${end.over ? ' (決着)' : ''}`;
  });

  // ===== 3. 探索 =====
  await phase(`探索(${STEPS}手)`, async () => {
    await goHome();
    let sameScreenStreak = 0, prevName = '', noEffect = new Map();
    for (let i = 0; i < STEPS; i++) {
      currentStep += 1;
      const before = await screenName().catch(() => '?');
      const list = await listButtons().catch(() => []);
      if (!list.length) {
        await addIssue('行き止まり', `押せるボタンが1つも無い`);
        await goHome().catch(() => {});
        continue;
      }
      // まだ押していないボタンを優先する(押した回数が少ないほど選ばれやすい)
      const weights = list.map((b) => 1 / (1 + (clickCount.get(`${before}|${b.label}`) || 0)) ** 2);
      let r = rand() * weights.reduce((a, b) => a + b, 0), pick = list[0];
      for (let k = 0; k < list.length; k++) { r -= weights[k]; if (r <= 0) { pick = list[k]; break; } }
      const key = `${before}|${pick.label}`;
      clickCount.set(key, (clickCount.get(key) || 0) + 1);
      const textBefore = (await health().catch(() => ({ text: '' }))).text;
      steps.push({ step: currentStep, screen: before, label: pick.label });
      await tap(pick);
      const { name, h } = await inspect();
      // 押しても画面の文字が1文字も変わらない → 3回続いたら「反応しないボタン」
      if (h && h.text === textBefore && pick.tag !== 'SELECT' && pick.tag !== 'INPUT') {
        const n = (noEffect.get(key) || 0) + 1; noEffect.set(key, n);
        if (n === 3) await addIssue('反応なし', `「${pick.label}」を押しても画面が変わらない`, { screenAt: before });
      }
      // 同じ画面に長くいたら HOME へ戻して、ほかの画面も見に行く
      sameScreenStreak = name === prevName ? sameScreenStreak + 1 : 0;
      prevName = name;
      if (sameScreenStreak >= 12 || (i > 0 && i % 40 === 0)) {
        const back = await tapLabel(/^(戻る|もどる|HOMEへ|ホームへ|HOME|←)$/, 900);
        if (!back) await goHome().catch(async (e) => { await addIssue('進めない', `HOMEへ戻れない: ${e.message}`); });
        sameScreenStreak = 0;
      }
    }
    return `${screensSeen.size}画面を見た`;
  });

  // ===== まとめ =====
  const result = {
    stamp, seed: SEED, steps: STEPS, phases, battle: battleStats, supabaseWrites,
    screens: [...screensSeen.entries()].map(([name, v]) => ({ name, ...v })),
    issues, path: steps,
  };
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(result, null, 2));

  const md = [
    `# プレイボットの報告 ${stamp}`,
    '',
    `- 乱数の種: \`${SEED}\`(\`node tools/playbot/playbot.js --seed ${SEED} --steps ${STEPS}\` で同じ押し方を再現)`,
    `- 見た画面: ${screensSeen.size} / 押した回数: ${steps.length}`,
    `- 全国ランキングへの送信: ${supabaseWrites}件(すべて横取り済み・本物へは届いていない)`,
    '',
    '## シナリオ',
    '',
    ...phases.map((p) => `- ${p.ok ? '✅' : '❌'} ${p.name}${p.note ? ` — ${p.note}` : ''}(${(p.ms / 1000).toFixed(1)}秒)`),
    '',
    ...['不具合候補', '改善のヒント', '既知'].flatMap((level) => {
      const list = issues.filter((x) => x.level === level);
      return [
        `## ${level}(${list.length}件)`,
        '',
        ...(list.length ? [] : ['- なし', '']),
        ...list.map((x, i) => [
          `### ${i + 1}. ${x.kind} — ${x.screen}`,
          '',
          `- 内容: ${x.detail.replace(/\n/g, ' ').slice(0, 300)}`,
          ...(x.known ? [`- 既知の理由: ${x.known}`] : []),
          `- 手番: ${x.step} / 画像: \`${x.image}\``,
          `- 直前に押したもの: ${x.recentSteps.map((st) => `「${st.label}」`).join(' → ') || '(なし)'}`,
          '',
        ].join('\n')),
      ];
    }),
    '## 見た画面',
    '',
    ...[...screensSeen.entries()].map(([n, v]) => `- ${n}(手番${v.step} / \`${v.image}\`)`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'report.md'), md);

  const countOf = (level) => issues.filter((x) => x.level === level).length;
  console.log(`\n見た画面 ${screensSeen.size} / 不具合候補 ${countOf('不具合候補')}件 / 改善のヒント ${countOf('改善のヒント')}件 / 既知 ${countOf('既知')}件`);
  console.log(`報告: ${path.relative(ROOT, path.join(OUT, 'report.md'))}`);
  await browser.close();
  server.close();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

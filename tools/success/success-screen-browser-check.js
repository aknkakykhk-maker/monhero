#!/usr/bin/env node
// モンヒロサクセスの画面の通し検査(本物のブラウザ)。デバッグ設定の入口から実際に押して進める。
//
//   node tools/success/success-screen-browser-check.js
//   SHOT_DIR=<フォルダ> node tools/success/success-screen-browser-check.js   … 場面ごとに止め絵も撮る
//
// 見るもの(縦390×844・横844×390・幅320×568 のそれぞれで):
//   ① HOME → 設定 → ヘルプ → DEBUG MENU → 「🌱 モンヒロサクセス(試す)」で開く
//   ② はじめる6段を ▶ で進めて「🌱 育成をはじめる」→ メイン
//   ③ 数ターン(トレーニング → 結果 → 褒める/叱る → ターンが進む。期末の大会はデバッグの「勝ったことにする」)
//   ④ 「← 中断」→ 保存(mh_monsuc_run_v1)を控える → ページを読み直す → 入口から「▶ 続きから」
//      → 同じターン・同じ能力・同じ体力から始まる → さらに数ターン進む
//   ⑤ どの場面でも: 真っ白にならない・ページのエラー/コンソールのエラーが出ない・ボタンや帯が枠(.msx)からはみ出さない・横にスクロールしない
//   ⑥ 公開の印(RELEASE_FLAGS.monheroSuccess)が偽のとき: ふつうに起動して HOME に出ても、モンヒロサクセスの字が出ない・
//      芯(MONHERO_SUCCESS)を読み込まない・mh_monsuc_* を1つも書かない
//
// 回2の画面(56-monhero-success-*.jsx)がまだ main に無いときは「見送り」で通す(回2の PR #5723 が入ると自動で回り出す)。
// 印を真にしたあと(公開後)は ⑥ を見送る。
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
const SHOT_DIR = process.env.SHOT_DIR || '';
const PARTS = path.join(ROOT, 'monster-hero', 'src', 'parts');
const TURNS_BEFORE = Number(process.env.MSX_TURNS || 4); // 中断までに進めるターン
const TURNS_AFTER = 3;                                     // 再開してから進めるターン

if (!fs.existsSync(path.join(PARTS, '56-monhero-success-main.jsx')) || !fs.existsSync(path.join(PARTS, '56-monhero-success-store.jsx'))) {
  console.log('SKIP: モンヒロサクセスの画面(回2)がまだ入っていないので見送り'); process.exit(0);
}
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e2) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
}
const { eventStorySeed, quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot', 'quiet-boot-seed'));
const released = /monheroSuccess:\s*true/.test(fs.readFileSync(path.join(PARTS, '17-release-changelog-login-missions.jsx'), 'utf8'));

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ico': 'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server)); // 空いているポートを使う(ほかの検査とぶつからない)
});

const SEED = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Suezo', 'Golem', 'Tiger', 'Pixie', 'Undine', 'Kyubi', 'Hare']));
  window.__mhSupabaseStubbed = true;
};

// 外へは出さない(Supabase・助手のおしゃべりの中継・外の CDN)
// (playwright は後から足した route が先に効くので、外を止める行を先に足す)
const isolate = async (page) => {
  await page.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
};
const prepare = async (page, errors, consoleErrors) => {
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|ERR_FAILED|net::|favicon|status of 404|status of 503/i.test(t)) consoleErrors.push(t.slice(0, 160)); } });
  await page.addInitScript(SEED);
  await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(eventStorySeed());
  await isolate(page);
};
const toHome = async (page, port) => {
  await page.goto(`http://localhost:${port}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
  for (let i = 0; i < 6; i++) { // ログインボーナス・お知らせ
    const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(250);
  }
};
const openEntry = async (page) => {
  await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
  await page.getByRole('button', { name: '分かった！冒険に戻る' }).waitFor({ timeout: 20000 });
  await page.locator('footer button[aria-label=""]').dispatchEvent('click');
  await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
  const btn = page.locator('[data-debug-monhero-success]');
  await btn.evaluate((el) => { for (let p = el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS') p.open = true; });
  await btn.dispatchEvent('click');
  await page.waitForSelector('.msx[data-msx-view]', { timeout: 30000 });
  await page.waitForTimeout(400);
};

// 画面の様子(はみ出し・真っ白・いまのターン)
const look = (page) => page.evaluate(() => {
  const root = document.querySelector('.msx'); if (!root) return { ok: false, text: 0, over: [], view: null };
  const R = root.getBoundingClientRect();
  const clipped = (e) => { for (let p = e.parentElement; p && p !== root; p = p.parentElement) { const o = getComputedStyle(p).overflowY; const ox = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || ox === 'auto' || ox === 'scroll' || o === 'hidden') return true; } return false; };
  const over = [...root.querySelectorAll('button, .v-band, .v-st, .v-act, .v-ft')].filter((e) => {
    const r = e.getBoundingClientRect(); if (!r.width || !r.height || clipped(e)) return false;
    return r.right > R.right + 1 || r.left < R.left - 1 || r.bottom > R.bottom + 1;
  }).map((e) => (e.innerText || e.className || '').replace(/\s+/g, ' ').slice(0, 24));
  const hd = (root.innerText.match(/(\d+)\s*\/\s*46ターン/) || [])[1];
  return { ok: true, text: root.innerText.trim().length, over, view: root.getAttribute('data-msx-view'), turn: hd ? Number(hd) : null,
    hscroll: document.documentElement.scrollWidth > window.innerWidth + 1, rw: Math.round(R.width), rh: Math.round(R.height) };
});
// 次へ進む1押し(何を押したかを返す)
const advance = (page, react) => page.evaluate((react) => {
  const root = document.querySelector('.msx'); if (!root) return null;
  const all = [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
  const by = (re, sel) => all.find((b) => (!sel || b.matches(sel)) && re.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
  const press = (b, why) => { if (!b) return null; b.click(); return why; };
  // 円盤石から生まれる演出(再開したときにも出る): 短縮 → 育成をはじめる
  if (root.querySelector('[data-msx-birth]')) { const nx = root.querySelector('[data-msx-birth-next]:not([disabled])'); if (nx) return press(nx, 'birth'); const sk = root.querySelector('[data-msx-birth-skip]'); if (sk) return press(sk, 'birth-skip'); }
  // 確かめの小窓(はい/やめておく)
  const ask = root.querySelector('.msx-btn.go'); if (ask && /はい|する|使う|やめる/.test(ask.innerText) && ask.closest('[class*="ask"], [class*="modal"], [class*="sheet"]')) return press(ask, 'ask');
  // 叱る・褒める
  // 2026-11-14 選択肢の字は場面ごと(思いきりほめる・なぐさめる・気合いを入れる…)になったので、data-msx-react-how で探す
  const ch = root.querySelector(`[data-msx-react-how="${react === 'scold' ? 'scold' : 'praise'}"]`) || by(react === 'scold' ? /^📣 叱る/ : /^👏 褒める/, '.v-ch'); if (ch && !ch.disabled) return press(ch, react);
  // その後の結果の札(選んだあとの「つぎへ」)は下の「つぎへ」で進む
  // 出来事(ランダムイベント・助手の連続イベント・2026-11-12 回2): 1つ目の選択肢を選ぶ
  const opt = root.querySelector('.v-opts .v-opt:not([disabled])'); if (opt) return press(opt, 'event');
  // 期末の大会の当日: 当日のメインの「大会(本番)」→ 受付の「出場」→ 参加の確認「はい」→ 紋章の入りの SKIP
  if (root.querySelector('[data-msx-r3-loading]')) return 'wait'; // 試合を読み込み中
  const yes = root.querySelector('[data-msx-r3-yes]'); if (yes) return press(yes, 'pre-yes');
  if (root.querySelector('[data-msx-r3-pre-card]')) { const en = root.querySelector('[data-msx-r3-enter]'); if (en) return press(en, 'pre-enter'); }
  const pc = root.querySelector('[data-msx-r3-precup]'); if (pc) return press(pc, 'pre-cup');
  const ig = root.querySelector('[data-msx-r3-cupintro-go]'); if (ig) return press(ig, 'intro');
  // 期末の大会(デバッグ)
  const win = by(/勝ったことにする/); if (win) return press(win, 'win');
  // デビュー戦の再挑戦・体調が悪い
  const retry = by(/デビュー戦に再挑戦/); if (retry) return press(retry, 'retry');
  const cond = by(/^🛌 休む/, '.v-p.main'); if (cond) return press(cond, 'cond');
  // トレーニングを選ぶ画面: いちばん上の札を選んでから「する」
  const tr = root.querySelector('.v-tr'); if (tr) {
    if (!root.querySelector('.v-tr.sel')) return press(tr, 'pick');
    const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) return press(go, 'train');
  }
  // イッサ博士: 何もしない → ことわる
  const no = by(/何もしない/, '.v-ix'); if (no && !no.classList.contains('sel')) return press(no, 'issa-none');
  // 結果・ターンが進む・博士: 足もとの「▶」のボタン
  const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) return press(go, 'go');
  const nomeal = root.querySelector('[data-msx-r3-nomeal]:not([disabled])'); if (nomeal) return press(nomeal, 'next'); // ごはんの段(2026-11-14 ボタンは「あげずに つぎへ」1つ)
  const nx = by(/つぎへ ▶|^▶/); if (nx) return press(nx, 'next');
  // メイン: 体力が少なければ休む・ふだんはトレーニング
  const hp = (root.innerText.match(/体力\s*(\d+)\s*\/\s*(\d+)/) || []);
  if (hp[1] && Number(hp[1]) < Number(hp[2]) * 0.35) { const rest = by(/^🛌\s*休む/, '.v-p'); if (rest) return press(rest, 'rest'); }
  const train = by(/^💪 トレーニング/); if (train) return press(train, 'open-train');
  return null;
}, react);

const sameState = (a, b) => {
  const pick = (s) => s && JSON.stringify({ turn: s.turn, stats: s.stats, hp: s.hp, hpMax: s.hpMax, stress: s.stress, ama: s.ama, fear: s.fear, pop: s.pop, pts: s.pts, tickets: s.tickets, debutLoss: s.debutLoss, items: s.items, bag: s.bag, techs: s.techs });
  return pick(a) === pick(b);
};

(async () => {
  const server = await serve(); const port = server.address().port;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  try {
    // ---- ⑥ 印が偽のとき、ふつうのプレイに何も出さない ----
    if (released) console.log('SKIP: 公開の印が真なので「偽のときに何も出ない」は見送り');
    else {
      const errors = []; const cerr = [];
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await prepare(page, errors, cerr);
      await toHome(page, port);
      await page.waitForTimeout(2500);
      const r = await page.evaluate(() => ({
        keys: Object.keys(localStorage).filter((k) => k.startsWith('mh_monsuc')),
        core: typeof MONHERO_SUCCESS !== 'undefined',
        script: [...document.scripts].some((s) => /monhero-success/.test(s.src || '')),
        text: /モンヒロサクセス|モンサク/.test(document.body.innerText),
        flag: typeof RELEASE_FLAGS !== 'undefined' ? RELEASE_FLAGS.monheroSuccess : 'none',
      }));
      check('印が偽: RELEASE_FLAGS.monheroSuccess は false', r.flag === false, String(r.flag));
      check('印が偽: HOME にモンヒロサクセスの字が出ない', !r.text);
      check('印が偽: 芯と台本を読み込まない', !r.core && !r.script);
      check('印が偽: mh_monsuc_* を書かない', r.keys.length === 0, r.keys.join(', '));
      check('印が偽: 起動でエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }

    // ---- ①〜⑤ 入口から通す ----
    const SIZES = [[390, 844, '縦390'], [844, 390, '横844'], [320, 568, '幅320']];
    for (const [w, h, tag] of SIZES) {
      const errors = []; const cerr = [];
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await prepare(page, errors, cerr);
      const looks = [];
      const see = async (where) => {
        await page.waitForTimeout(250);
        const m = await look(page); looks.push({ where, ...m });
        if (SHOT_DIR) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `msx-${tag}-${String(looks.length).padStart(2, '0')}-${where}.png`) }); }
        return m;
      };
      let saved = null;
      try {
        await toHome(page, port);
        await openEntry(page);
        let m = await see('home');
        check(`${tag}: 入口から開く`, m.ok && m.view === 'home' && m.text > 20, `view=${m.view}`);
        const startNew = await page.evaluate(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /新しく育成をはじめる/.test(x.innerText)); if (b) b.click(); return !!b; });
        check(`${tag}: 「新しく育成をはじめる」が押せる`, startNew);
        // ストーリー選択(2026-11-14): シナリオの名前が出て、「次へ」で育てるモンスターを選ぶ段へ
        await page.waitForSelector('[data-msx-scenario]', { timeout: 10000 }).catch(() => {});
        const scn = await page.evaluate(() => { const el = document.querySelector('[data-msx-scenario]'); const t = el ? el.innerText : ''; const b = document.querySelector('[data-msx-scenario-next]'); if (b) b.click(); return { id: el ? el.getAttribute('data-msx-scenario') : null, name: /ヒーローへの道/.test(t), next: !!b }; });
        check(`${tag}: ストーリー選択に「ヒーローへの道」が出て、次へで進める`, scn.id === 'hero' && scn.name && scn.next, JSON.stringify(scn));
        // はじめる6段
        let steps = 0;
        for (; steps < 8; steps++) {
          await page.waitForTimeout(250);
          const r = await page.evaluate(() => {
            const root = document.querySelector('.msx'); const btns = [...root.querySelectorAll('button')].filter((b) => !b.disabled);
            const big = btns.find((b) => /育成をはじめる$/.test(b.innerText.trim()) && b.classList.contains('v-big')); if (big) { big.click(); return 'start'; }
            const go = root.querySelector('.v-ft button.go:not([disabled])'); if (go) { go.click(); return 'next'; }
            return null;
          });
          await see(`start${steps + 1}`);
          if (r === 'start') break;
          if (!r) { check(`${tag}: はじめる ${steps + 1} 段目で先へ進むボタンが無い`, false); break; }
        }
        check(`${tag}: はじめる6段を通ってメインへ`, steps === 5, `${steps + 1} 段`);
        await page.waitForSelector('.msx[data-msx-view]:not([data-msx-view="home"])', { timeout: 15000 }).catch(() => {});
        // 円盤石から生まれる演出(2026-11-13 r1113-008): 出たら「短縮」→「育成をはじめる」
        const birth = await page.evaluate(async () => {
          if (!document.querySelector('[data-msx-birth]')) return 'none';
          const sk = document.querySelector('[data-msx-birth-skip]'); if (sk) sk.click();
          await new Promise((r) => setTimeout(r, 300));
          const nx = document.querySelector('[data-msx-birth-next]:not([disabled])'); if (nx) { nx.click(); return 'ok'; } return 'stuck';
        });
        check(`${tag}: 円盤石から生まれる演出を通る`, birth !== 'stuck', birth);
        await page.waitForTimeout(400);
        m = await see('main');
        check(`${tag}: 1ターン目のメインが出る`, m.turn === 1, `turn=${m.turn} view=${m.view}`);
        // 数ターン進める
        const play = async (n, label) => {
          const t0 = (await look(page)).turn || 0; let guard = 0; let pressed = [];
          while (guard++ < 40 * n) {
            const cur = await look(page);
            if (cur.turn && cur.turn >= t0 + n && cur.view !== 'home' && !(await page.evaluate(() => !!document.querySelector('.v-ch, .v-tr')))) {
              const onMain = await page.evaluate(() => [...document.querySelectorAll('.msx button')].some((b) => /^💪 トレーニング|デビュー戦に再挑戦|^🛌 休む/.test(b.innerText.trim())));
              if (onMain) break;
            }
            const did = await advance(page, guard % 3 === 0 ? 'scold' : 'praise');
            if (!did) { const tx = await page.evaluate(() => (document.querySelector(".msx") || {}).innerText || ""); check(`${tag}: ${label} T${cur.turn} で押せるボタンが見つからない`, false, `view=${cur.view} ${pressed.slice(-4).join(",")} ${tx.replace(/\s+/g, " ").slice(0, 200)}`); break; }
            pressed.push(did);
            if (did === 'wait') { await page.waitForTimeout(400); continue; }
            if (['train', 'praise', 'scold', 'go', 'next', 'win', 'rest', 'retry', 'cond'].includes(did)) await see(`T${cur.turn}-${did}`);
          }
          return pressed;
        };
        const p1 = await play(TURNS_BEFORE, '中断の前');
        m = await look(page);
        check(`${tag}: ${TURNS_BEFORE} ターン進む`, m.turn === 1 + TURNS_BEFORE, `turn=${m.turn}・押した ${p1.length} 回`);
        // 2026-11-14 叱る/褒めるは大成功・失敗・サボり・修行のあとだけ出る(ふつうの成功では出ない)。出たときは上の advance が押す
        check(`${tag}: トレーニングを通った`, p1.includes('train'), p1.join(',').slice(0, 80));
        // 中断
        const paused = await page.evaluate(() => { const b = [...document.querySelectorAll('.msx .v-ft button')].find((x) => /中断/.test(x.innerText)); if (b) b.click(); return !!b; });
        check(`${tag}: 「← 中断」が押せる`, paused);
        await page.waitForTimeout(600);
        m = await see('paused');
        saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_monsuc_run_v1')); } catch (e) { return null; } });
        check(`${tag}: 中断で途中の育成が保存される`, Boolean(saved && saved.s && saved.s.turn === 1 + TURNS_BEFORE), saved && saved.s ? `turn=${saved.s.turn}` : 'なし');
        // 読み直して再開
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
        await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
        await openEntry(page);
        m = await see('reopen');
        const cont = await page.evaluate(() => { const b = [...document.querySelectorAll('.msx button')].find((x) => /続きから/.test(x.innerText)); if (b) b.click(); return !!b; });
        check(`${tag}: 読み直したあと「▶ 続きから」が出る`, cont);
        await page.waitForTimeout(600);
        m = await see('resumed');
        const after = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_monsuc_run_v1')); } catch (e) { return null; } });
        check(`${tag}: 再開すると同じターンから`, m.turn === saved.s.turn, `画面 ${m.turn} / 保存 ${saved.s.turn}`);
        check(`${tag}: 再開しても能力・体力・忠誠・持ち物が同じ`, sameState(saved.s, after && after.s));
        const p2 = await play(TURNS_AFTER, '再開のあと');
        m = await look(page);
        check(`${tag}: デビュー戦(期末の大会)を通った`, p1.concat(p2).includes('win'));
        check(`${tag}: 再開してからさらに ${TURNS_AFTER} ターン進む`, m.turn === saved.s.turn + TURNS_AFTER, `turn=${m.turn}・押した ${p2.length} 回`);
      } catch (e) {
        check(`${tag}: 最後まで通る`, false, String(e && e.message || e).split('\n')[0]);
      }
      const blank = looks.filter((x) => !x.ok || x.text < 20).map((x) => x.where);
      const over = looks.filter((x) => x.over && x.over.length).map((x) => `${x.where}: ${x.over.slice(0, 2).join(' / ')}`);
      const hs = looks.filter((x) => x.hscroll).map((x) => x.where);
      check(`${tag}: どの場面も真っ白にならない(${looks.length} 場面)`, blank.length === 0, blank.slice(0, 4).join(', '));
      check(`${tag}: ボタンや帯が枠からはみ出さない`, over.length === 0, over.slice(0, 3).join(' | '));
      check(`${tag}: 横にスクロールしない`, hs.length === 0, hs.slice(0, 4).join(', '));
      check(`${tag}: ページのエラーが出ない`, errors.length === 0, errors.slice(0, 2).join(' / '));
      check(`${tag}: コンソールのエラーが出ない`, cerr.length === 0, cerr.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `NG success-screen-browser-check: ${failed} 件` : 'OK success-screen-browser-check: すべて');
  process.exit(failed ? 1 : 0);
})();

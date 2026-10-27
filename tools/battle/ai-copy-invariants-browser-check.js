#!/usr/bin/env node
// AIコピー(ソラシドのアシカの5人目・2026-10-27 社長の決め)を、実際のブラウザで1戦流して確かめる。
// 部品を直接呼ぶ分は tools/battle/ai-copy-invariants-check.js。こちらは本体(60-app.jsx)につながったあとの通しの分。
//
//   node tools/battle/ai-copy-invariants-browser-check.js
//
// ・公開の印 RELEASE_FLAGS.assistantSorashido は、この検査の中でだけ真にする(ドライバーくんに聞いた形。ほかの検査と同じ)
// ・アシストカードはソラシドの自動化だけを持たせる(mh_unlocked_teachings・mh_teaching_roster。検査のまっさらなデータだけ)
// ・タクティクスプロ(Beginner)を勇者1体で始め、WAVE1 でソラシドのカードを勇者に使う。敵のライフは40倍にして WAVE を長くする
// 見ること:
//   ① 使った次のターンからコピーが出る(バトルの記録「…が次のターンから一緒に戦う」)
//   ② 続くターン(Lv1=2)が切れたら消える(「…が消えた(時間切れ)」)
//   ③ コピーが出ているあいだも、勇者が立っていれば負けにならない/倒れた数(記録の「倒れた」)にコピーは入らない
//   ④ 保存: 戦ったあとに増えた mh_* の鍵に、コピーのためのもの(copy を含む)が無い。ランキングへは何も送っていない
//   ⑤ 実行時エラー(真っ白)が出ない
// 土台(起動・始め方)は stack-marks-overlap-browser-check.js から写した。
const { pickProParty } = require('./lib/pro-party-pick');
const TOOLS_DIR = require('path').join(__dirname, '..');
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8996;
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

(async () => {
  // 本体につながる前は飛ばす(部品の分は ai-copy-invariants-check.js)
  const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  if (!/\bsummonTacticsAiCopy\(/.test(app)) { console.log('SKIP: 本体にタクティクスの AIコピー(summonTacticsAiCopy)がまだ無い'); process.exit(0); }
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  const posts = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    // Service Worker を止める(敵のライフの書き換えが効くように。stack-marks の検査と同じ)
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('mh_breeder_name', '検査ブリーダー'); set('mh_breeder_icon', '🐣'); set('mh_onboarded', true);
      set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
      set('mh_masu_migrated', true); set('mh_inherited_unique_level_compensation_v1', true); set('mh_inherited_unique_level_compensation_pending_v1', false);
      set('mh_tactics_intro_seen_v1', true);
      // 勇者モンに選ぶ子を解放しておく(stack-marks の検査と同じ並び)
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Ghost','Spooky','Melody','Kuromy']));
      // アシストカードはソラシドの自動化だけ(検査のまっさらなデータだけの話)
      set('mh_unlocked_teachings', ['sorashido']); set('mh_teaching_roster', ['sorashido']);
      // 公開の印は、本体が読まれたあとに書き換える(凍っていないふつうのオブジェクト)
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantSorashido = true; clearInterval(t); } } catch (e) {} }, 5);
    });
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    // ランキングの記録を書き込む通信だけを数える(プロフィールの同期・読むだけの rpc は別物)
    await page.route(/supabase\.co/, (route) => { const r = route.request(); const u = r.url(); if (r.method() !== 'GET' && /\/rest\/v1\/[a-z_]*rank/i.test(u) && !/\/rpc\//.test(u)) posts.push(`${r.method()} ${u}`); return route.abort(); });
    await page.route(/data\/enemy-monsters\.js/, async (route) => {
      const res = await route.fetch();
      const body = (await res.text()).replace(/baseHp:(\d+)/g, (m, n) => `baseHp:${Number(n) * 40}`);
      await route.fulfill({ response: res, body });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 8; i += 1) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300);
    }
    const keysBefore = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mh_')));
    check('公開の印が検査の中でだけ真になっている', await page.evaluate(() => typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantSorashido === true));
    const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    // タクティクスプロ(Beginner)を勇者1体で始める
    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click');
    await page.waitForTimeout(600);
    await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click');
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
    await page.evaluate(() => { const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')]; const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...(card ? card.querySelectorAll('button') : [])].find((x) => x.textContent.includes('難易度を選ぶ'))?.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled)?.click());
    await page.waitForTimeout(1500);
    const pickError = await pickProParty(page, 'メロディー');
    check('タクティクスプロをメロディーで始められる', !pickError, pickError || '');
    await page.waitForTimeout(1200);
    let pickedSorashido = false;
    for (let i = 0; i < 40; i += 1) {
      if (/WAVE 1\/10/.test(await text())) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => !x.disabled && x.offsetParent);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|この子で挑む|^決定$|^確定$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const so = live.find((x) => /ソラシド/.test(x.textContent)); if (so) { so.click(); return 'sorashido'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const start = pick(/はじめる|この子で/); if (start) { start.click(); return 'start'; }
        return null;
      });
      if (step === 'sorashido') pickedSorashido = true;
      if (!step) break;
      await page.waitForTimeout(900);
    }
    check('アシストカードでソラシドの自動化を選べる', pickedSorashido);
    check('バトル(WAVE 1)まで進める', /WAVE 1\/10/.test(await text()));

    const heroSlot = await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-slot-index]')].find((x) => x.querySelector('img')); return b ? Number(b.getAttribute('data-slot-index')) : null; });
    const turnNo = async () => { const m = (await text()).match(/TURN (\d+)\/20/); return m ? Number(m[1]) : null; };
    const readLog = async () => {
      await page.locator('[data-battle-log-button]').first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(400);
      const t = await text();
      await page.getByRole('button', { name: /閉じる/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(300);
      return t;
    };
    // 1ターン進める。first なら手札のソラシドを勇者へ使う。ほかは攻撃以外(ガード・回復など)で敵を倒さずにつなぐ
    const playTurn = async (useSorashido) => {
      const before = await turnNo();
      const idx = await page.evaluate((useSo) => {
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        const usable = (c) => c.getAttribute('data-card-usable') === 'true';
        let i = useSo ? cards.findIndex((c) => usable(c) && /ソラシド/.test(c.textContent)) : -1;
        if (i < 0) i = cards.findIndex((c) => usable(c) && /^(guard|weak_guard|heal|buff|draw)$/.test(c.getAttribute('data-card-type') || ''));
        if (i < 0) i = cards.findIndex(usable);
        return i;
      }, useSorashido);
      if (idx >= 0) {
        await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(600);
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => !x.disabled && x.offsetParent && /\(使用中\)/.test(x.textContent)); if (b) b.click(); });
        if (heroSlot != null && await page.locator('button[data-slot-assignable="true"]').count()) await page.locator(`button[data-slot-index="${heroSlot}"]`).click().catch(() => {});
        await page.waitForTimeout(400);
        await page.evaluate(() => document.querySelector('[data-tactics-ex-close]')?.click());
      }
      await page.evaluate(() => document.querySelector('[data-battle-action]')?.click());
      for (let k = 0; k < 60; k += 1) { await page.waitForTimeout(500); const now = await turnNo(); if (now != null && before != null && now !== before) break; if (/WAVE 2\/10|GAME OVER|敗\s*北/.test(await text())) break; }
      await page.waitForTimeout(600);
      return idx;
    };

    // 手札はくじで配られるので、ソラシドが手札に来るまで攻撃以外のカードでつなぐ(最大8ターン)
    const hasSorashido = () => page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].some((c) => c.getAttribute('data-card-usable') === 'true' && /ソラシド/.test(c.textContent)));
    let waited = 0;
    while (!(await hasSorashido()) && waited < 8) { await playTurn(false); waited += 1; }
    const usedIdx = await hasSorashido() ? await playTurn(true) : -1;
    check('WAVE1 でソラシドのカードを勇者に使える', usedIdx >= 0, `手札に来るまで ${waited} ターン`);
    let log = await readLog();
    check('① 使った次のターンからコピーが出る(記録「一緒に戦う」)', /一緒に戦う/.test(log), (log.match(/🤖[^🤖]{0,40}/g) || []).join(' / '));
    // 枠の札の印(セコンドくん #4112): data-tactics-ai-copy-out="1" ならコピーが出ている
    const copyOut = () => page.evaluate(() => [...document.querySelectorAll('[data-tactics-ai-copy-out]')].map((e) => e.getAttribute('data-tactics-ai-copy-out')).join(','));
    const hasMark = /data-tactics-ai-copy-out/.test(fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8'));
    if (hasMark) check('① 出ているあいだ、枠の札の印が「出ている」(data-tactics-ai-copy-out="1")', (await copyOut()).split(',').includes('1'), await copyOut());
    let gone = false; let lost = false;
    for (let t = 0; t < 5 && !gone; t += 1) {
      await playTurn(false);
      if (/GAME OVER|敗\s*北/.test(await text())) { lost = true; break; }
      log = await readLog();
      gone = /消えた\(時間切れ\)/.test(log);
    }
    check('② 続くターンが切れたらコピーが消える(記録「消えた(時間切れ)」)', gone, (log.match(/🤖[^🤖]{0,40}/g) || []).join(' / '));
    if (hasMark) check('② 消えたあとは枠の札が出ていない', !(await copyOut()).split(',').includes('1'), await copyOut() || '札なし');
    check('③ コピーが出ていたあいだに負けにならない(勇者が立っている)', !lost);
    check('③ 倒れた数の記録にコピーが入らない', !/コピーが倒れた|コピー.{0,6}倒れ(た|ました)/.test(log));

    const keysAfter = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mh_')));
    const added = keysAfter.filter((k) => !keysBefore.includes(k));
    check('④ 保存: 戦ったあとに、コピーのための mh_* の鍵が増えていない', added.every((k) => !/copy/i.test(k)), added.join(',') || '増えた鍵なし');
    check('④ ランキングへは何も送っていない', posts.length === 0, posts.slice(0, 3).join(' / '));
    check('⑤ 実行時エラーが出ていない', errors.length === 0, errors[0] || '');
  } catch (e) {
    check('通しで動く', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

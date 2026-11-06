#!/usr/bin/env node
// AIコピー(ソラシドのアシカの5人目)の予測ダメージ「攻N」が、実際にコピーが撃つダメージと合うかを、実際のブラウザで1戦流して確かめる(2026-11-06)。
// 社長「ソラシドのコピーにも予測ダメージとか出して」。数えるのは 60-app.jsx の aiCopyPredictedDmg、出すのは 71-screen-battle.jsx の DamagePreviewChip。
//
//   node tools/battle/sorashido-copy-predict-browser-check.js            # タクティクスプロ(コピーは空きマスか小窓)
//   MODE=classic node tools/battle/sorashido-copy-predict-browser-check.js # クラシック(本編・コピーは敵の段の小窓)
//   SHOT_DIR=<フォルダ> を付けると、予測が出ている画面の写真を残す
//
// 見ること:
//   ① コピーが出ているターンに「攻N」(data-ai-copy-damage-preview)が出る(コピーが攻撃の札を決めているとき)
//   ② そのターンを流すと、バトルの記録の「〜のコピーの 技 → 敵に N ダメージ」の合計が、出ていた N と同じ(会心は乱数を止めて出さない)
//   ③ 見た目は味方の枠の「攻N」と同じ部品(字の大きさ・色が同じ)
//   ④ 実行時エラーが出ない
// 土台(起動・始め方・1ターンの流し方)は ai-copy-invariants-browser-check.js から写した。
const { pickProParty } = require('./lib/pro-party-pick');
const TOOLS_DIR = require('path').join(__dirname, '..');
const http = require('http');
const path = require('path');
const fs = require('fs');

const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8997;
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
const MODE = process.env.MODE === 'classic' ? 'classic' : 'tactics';
const SHOT = process.env.SHOT_DIR || '';
// 勇者は近い間合いで殴るモンスター(遠い子は、コピーの攻撃が間合いで0になって守りばかり選ぶ)
const HERO = process.env.HERO || 'ゴーレム';

(async () => {
  const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  if (!/\baiCopyPredictedDmg\(/.test(app)) { console.log('SKIP: 本体にコピーの予測ダメージ(aiCopyPredictedDmg)がまだ無い'); process.exit(0); }
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', deviceScaleFactor: SHOT ? 2 : 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      // 乱数は真ん中(0.45〜0.55)に寄せる。会心(当たる率は低い)が出ず、コピーはいちばんよい札を選ぶ(32-sorashido-copy.jsx の aiCopyPickOne は乱数が pick より小さいとき1番を選ぶ)。
      //   大きい側に寄せると、コピーがわざと2番目以下(守り)ばかり選んで攻撃しなかった。山札の並びは毎回同じになる
      let seed = 7; Math.random = () => { seed = (seed * 9301 + 49297) % 233280; return 0.45 + (seed / 233280) * 0.1; };
      const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      set('mh_breeder_name', '検査ブリーダー'); set('mh_breeder_icon', '🐣'); set('mh_onboarded', true);
      set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
      set('mh_masu_migrated', true); set('mh_inherited_unique_level_compensation_v1', true); set('mh_inherited_unique_level_compensation_pending_v1', false);
      set('mh_tactics_intro_seen_v1', true);
      set('mh_rhythm_event_story_v1', ['card_cup_2026_10_31']);
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','KenshiMocchi','Mia','Snegurochka','Undine','Yaobikuni','Pandora','Ghost','Spooky','Melody','Kuromy']));
      set('mh_unlocked_teachings', ['sorashido']); set('mh_teaching_roster', ['sorashido']);
      // コピーの札の選び方は AUTO の作戦(攻撃優先)にそろえる。乱数まかせ(既定)だと守りばかり選ぶことがある
      set('mh_auto_settings_v1', { strategy: 'offense' });
      const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantSorashido = true; clearInterval(t); } } catch (e) {} }, 5);
    });
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.route(/supabase\.co/, (route) => route.abort());
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
    const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

    await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click');
    await page.waitForTimeout(600);
    if (MODE === 'tactics') {
      await page.locator('[data-battle-system="systemTactics"]').dispatchEvent('click');
      await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });
      await page.evaluate(() => { const cards = [...document.querySelectorAll('[data-battle-mode="tacticsPro"]')]; const card = cards[Math.floor(cards.length / 2)] || cards[0];
        [...(card ? card.querySelectorAll('button') : [])].find((x) => x.textContent.includes('難易度を選ぶ'))?.click(); });
    } else {
      await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click');
      await page.waitForTimeout(1400);
      await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ') && !x.disabled && x.offsetParent)?.click());
    }
    await page.waitForTimeout(1500);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled)?.click());
    await page.waitForTimeout(1500);
    if (MODE === 'tactics') {
      const pickError = await pickProParty(page, HERO);
      check(`タクティクスプロを${HERO}で始められる`, !pickError, pickError || '');
      await page.waitForTimeout(1200);
    }
    let pickedSorashido = false;
    for (let i = 0; i < 40; i += 1) {
      if (/WAVE 1\/10/.test(await text())) break;
      const step = await page.evaluate(() => {
        const live = [...document.querySelectorAll('button')].filter((x) => !x.disabled && x.offsetParent);
        const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
        const go = pick(/出撃|バトル開始|この編成で|この子で挑む|^決定$|^確定$|^勇者モンに選ぶ$/); if (go) { go.click(); return 'go'; }
        const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
        const so = live.find((x) => /ソラシド/.test(x.textContent)); if (so) { so.click(); return 'sorashido'; }
        const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
        const start = pick(/はじめる|この子で/); if (start) { start.click(); return 'start'; }
        // クラシックの勇者モンえらび: 並びの最初のモンスター
        const mon = live.find((x) => x.closest('[data-hero-pick],[data-masu-pick],[data-monster-pick]'));
        if (mon) { mon.click(); return 'mon'; }
        return null;
      });
      if (step === 'sorashido') pickedSorashido = true;
      if (!step) break;
      await page.waitForTimeout(900);
    }
    check('アシストカードでソラシドの自動化を選べる', pickedSorashido);
    check('バトル(WAVE 1)まで進める', /WAVE 1\/10/.test(await text()), MODE);

    const heroSlot = await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-slot-index]')].find((x) => x.querySelector('img')); return b ? Number(b.getAttribute('data-slot-index')) : null; });
    const turnNo = async () => { const m = (await text()).match(/TURN (\d+)\//); return m ? Number(m[1]) : null; };
    // バトルの記録から、コピーが敵へ当てたダメージの行を全部取る(「〜のコピーの 技 → 敵に N ダメージ」)
    const copyHits = async () => {
      await page.locator('[data-battle-log-button]').first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(400);
      const t = await page.evaluate(() => document.body.innerText);
      await page.getByRole('button', { name: /閉じる/ }).first().dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(300);
      if (process.env.DEBUG) console.log('LOG', (t.match(/[^\n]*(コピー|🤖)[^\n]*/g) || []).slice(-6).join(' | '));
      return [...t.matchAll(/のコピー(?:の [^\n→]*)? → 敵に ([\d,]+) ダメージ/g)].map((m) => Number(m[1].replace(/,/g, '')));
    };
    const preview = () => page.evaluate(() => [...document.querySelectorAll('[data-ai-copy-damage-preview]')].filter((e) => e.offsetParent || e.getClientRects().length).map((e) => Number(e.getAttribute('data-ai-copy-damage-preview'))));
    const playTurn = async (useSorashido, beforeAction = null) => {
      const before = await turnNo();
      const idx = await page.evaluate((useSo) => {
        const cards = [...document.querySelectorAll('[data-hand-card]')];
        const usable = (c) => c.getAttribute('data-card-usable') === 'true';
        let i = useSo ? cards.findIndex((c) => usable(c) && /ソラシド/.test(c.textContent)) : -1;
        // コピーのダメージだけを見たいので、味方は攻撃の札を使わない(ガード・回復など)
        if (i < 0 && !useSo) i = cards.findIndex((c) => usable(c) && /^(guard|weak_guard|heal|draw)$/.test(c.getAttribute('data-card-type') || ''));
        // 攻撃の札しか無いときは、それを使う(札を使わないと次のターンへ進めない)。比べるのはコピーの行だけ
        if (i < 0 && !useSo) i = cards.findIndex((c) => usable(c) && !/ソラシド/.test(c.textContent));
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
      // 開いたままの窓(手札の窓など)を閉じてから、行動のボタンを押す。進まなければ押し直す
      await page.locator('[data-sorashido-hand-close]').click({ timeout: 1000 }).catch(() => {});
      // 予測は、味方の札を置いたあと・流す直前に読む(本編は味方の札の補正がコピーの予測に乗る)
      const seen = beforeAction ? await beforeAction() : null;
      for (let k = 0; k < 60; k += 1) {
        if (k % 10 === 0) await page.evaluate(() => document.querySelector('[data-battle-action]')?.click());
        await page.waitForTimeout(500); const now = await turnNo(); if (now != null && before != null && now !== before) break; if (/WAVE 2\/10|GAME OVER|敗\s*北/.test(await text())) break;
      }
      await page.waitForTimeout(800);
      return beforeAction ? seen : idx;
    };

    const hasSorashido = () => page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].some((c) => c.getAttribute('data-card-usable') === 'true' && /ソラシド/.test(c.textContent)));
    let waited = 0;
    // 敵が近づいてコピーの攻撃が届くまで、数ターン待ってから使う(遠いうちは、コピーの攻撃が間合いで0になり守りを選ぶ)
    const WAIT = Number(process.env.WAIT_TURNS || 3);
    for (let k = 0; k < WAIT; k += 1) { await playTurn(false); waited += 1; }
    while (!(await hasSorashido()) && waited < 8 + WAIT) { await playTurn(false); waited += 1; }
    const usedIdx = await hasSorashido() ? await playTurn(true) : -1;
    if (process.env.DEBUG) console.log('USED at turn', await turnNo(), 'hits', await copyHits(), 'pv', await preview());
    check('WAVE1 でソラシドのカードを勇者に使える', usedIdx >= 0, `手札に来るまで ${waited} ターン`);

    // コピーが出ているあいだ、毎ターン「出ている予測」と「流したあとの記録の合計」を比べる
    const rows = [];
    let shot = false;
    for (let t = 0; t < 4; t += 1) {
      const tBefore = await turnNo();
      const sum = (a) => a.reduce((x, y) => x + y, 0);
      const hitsBefore = sum(await copyHits());
      const got = await playTurn(false, async () => {
        const pv = await preview();
        if (pv.length && SHOT && !shot) { await page.screenshot({ path: path.join(SHOT, `predict-${MODE}.png`) }); shot = true; }
        const look = pv.length ? await page.evaluate(() => {
          const e = [...document.querySelectorAll('[data-ai-copy-damage-preview]')].find((x) => x.getClientRects().length);
          const s = e && getComputedStyle(e);
          return s ? { fs: s.fontSize, bg: s.backgroundColor, color: s.color } : null;
        }) : null;
        return { pv, look };
      });
      const pv = got ? got.pv : [], look = got ? got.look : null;
      if (/GAME OVER|敗\s*北|WAVE 2\/10/.test(await text())) break;
      if ((await turnNo()) === tBefore) { if (process.env.DEBUG) console.log('STUCK', (await page.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent).map((x) => (x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 20)).join(' / '))).slice(0, 600)); continue; } // ターンが進まなかった行は数えない
      const dealt = sum(await copyHits()) - hitsBefore;
      if (process.env.DEBUG) console.log('ROW', await turnNo(), 'pv', pv, 'before', hitsBefore, 'dealt', dealt);
      rows.push({ pv: pv.length ? pv[0] : null, dealt, look });
    }
    const shown = rows.filter((r) => r.pv != null && r.pv > 0);
    check('① コピーが出ているターンに「攻N」が出る', shown.length > 0, rows.map((r) => `予測${r.pv ?? 'なし'}・実際${r.dealt}`).join(' / '));
    check('② 出ていた予測と、流したあとの記録の合計が同じ', shown.length > 0 && shown.every((r) => r.pv === r.dealt), shown.map((r) => `${r.pv}→${r.dealt}`).join(' / '));
    check('② 予測が出ていないターンは、コピーの攻撃も無い', rows.filter((r) => r.pv == null).every((r) => r.dealt === 0), rows.filter((r) => r.pv == null).map((r) => r.dealt).join(','));
    const ally = fs.readFileSync(path.join(root, 'monster-hero/src/parts/71-screen-battle.jsx'), 'utf8');
    check('③ 味方とコピーが同じ部品(DamagePreviewChip)で出している', /<DamagePreviewChip[^>]*data-tactics-damage-preview/.test(ally) && /<DamagePreviewChip[^>]*data-ai-copy-damage-preview/.test(ally));
    check('③ 字の大きさ8px・赤い札(味方の「攻N」と同じ)', shown.length > 0 && shown.every((r) => r.look && r.look.fs === '8px' && /^rgb\(220, 38, 38\)$/.test(r.look.bg)), JSON.stringify(shown[0] && shown[0].look));
    check('④ 実行時エラーが出ていない', errors.length === 0, errors[0] || '');
  } catch (e) {
    check('通しで動く', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

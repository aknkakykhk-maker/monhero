#!/usr/bin/env node
// 固有技のオリジナル強化「連撃数」を、本物のバトルで確かめる(2026-11-07 社長「連撃数 +3本も実際に積んでバトルで本数が増えるのを見る」)。
//   マスモンのザン(固有技 Lv.8)で、強化なしと「連撃数+3本」の2回、クラシックの WAVE1 で固有技を1回撃ち、
//   ① 予測「攻N」と実際の記録が合う ② 連撃数+3本では、元のダメージの10%の連撃が3本ぶん増える ことを見る。
//   node tools/battle/unique-boost-combo-browser-check.js   (SHOT_DIR=<フォルダ> で予測の画面を撮る / DEBUG=1 で記録を出す)
const TOOLS_DIR = require('path').join(__dirname, '..');
const http = require('http');
const path = require('path');
const fs = require('fs');

// ROOT_DIR を渡すと、その場所のゲームを開く(止め絵の「前」を、直す前の版で同じ場面から撮るため)
const root = process.env.ROOT_DIR ? path.resolve(process.env.ROOT_DIR) : path.resolve(TOOLS_DIR, '..');
const PORT = 8979;
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
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SHOT = process.env.SHOT_DIR || '';
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

// 1回のバトルを流し、勇者(マスモンのザン)の固有技を1回撃って、出ていた予測「攻N」と実際の記録を返す
const runOnce = async (browser, label, boosts) => {
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', deviceScaleFactor: SHOT ? 2 : 1 });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript((boosts) => {
    // 乱数は 0.5〜1.0 に寄せる(固有技 Lv.8 の会心率50%以上なので、乱数の会心は出ない。予測と実際を比べられる)
    let seed = 11; Math.random = () => { seed = (seed * 9301 + 49297) % 233280; return 0.5 + (seed / 233280) * 0.5; };
    const set = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    set('mh_breeder_name', '検査ブリーダー'); set('mh_breeder_icon', '🐣'); set('mh_onboarded', true);
    set('mh_tutorial_seen_v1', true); set('mh_battle_tutorial_seen_v1', true); set('mh_battle_tutorial_guide_shown_v1', true);
    set('mh_masu_migrated', true); set('mh_inherited_unique_level_compensation_v1', true); set('mh_inherited_unique_level_compensation_pending_v1', false);
    set('mh_unique_lineage_dedupe_migrated_v1', true);
    set('mh_quick_guide_seen_v1', { v: 1, seen: ['g1a', 'g1b', 'g2', 'g3a', 'g3b', 'g3c', 'auto'] });
    set('mh_rhythm_event_story_v1', ['card_cup_2026_10_31']);
    set('mh_unlocked_monsters', ['Mocchi', 'Zan', 'Golem']);
    const m = { id: 'zb1', baseId: 'Zan', name: '連撃ザン', bondXp: 0, levelCap: 30, createdAt: 1, statPoints: { hp: 3000, atk: 0, def: 0, guts: 3000 },
      uniqueSkillLevels: { own: 8 }, uniqueSkillPoints: 0 };
    if (boosts) m.uniqueSkillBoosts = { own: boosts };
    set('mh_masu_mons', [m]);
    set('mh_monster_roster', ['masu:zb1']);
  }, boosts);
  await page.addInitScript(quietBootSeed());
  await page.addInitScript(updateNoticeSeed());
  await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
  await page.route(/supabase\.co/, (route) => route.abort());
  // 敵のライフを大きくして、1発で倒れないようにする(記録の数字をそのまま比べるため)
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
    const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK|スキップ/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300);
  }
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  await page.getByRole('button', { name: 'モンヒロバトル' }).dispatchEvent('click');
  await page.waitForTimeout(600);
  await page.locator('[data-battle-system="systemClassic"]').dispatchEvent('click', {}, { timeout: 10000 });
  await page.waitForTimeout(1400);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('難易度を選ぶ') && !x.disabled && x.offsetParent)?.click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.includes('この難易度で挑戦') && !x.disabled)?.click());
  await page.waitForTimeout(1500);
  for (let i = 0; i < 40; i += 1) {
    if (/WAVE 1\/10/.test(await text())) break;
    const step = await page.evaluate(() => {
      const live = [...document.querySelectorAll('button')].filter((x) => !x.disabled && x.offsetParent);
      const pick = (re) => live.find((x) => re.test(x.textContent.trim()));
      const go = pick(/出撃|バトル開始|この編成で|この子で挑む|^決定$|^確定$|^勇者モンに選ぶ$/); if (go) { go.click(); return 'go'; }
      const confirm = pick(/^(習得する|強化する)$/); if (confirm) { confirm.click(); return 'confirm'; }
      const learn = pick(/新規習得/); if (learn) { learn.click(); return 'learn'; }
      const slot = pick(/^(零|近|中|遠)距離/); if (slot) { slot.click(); return 'slot'; }
      const start = pick(/(?:始|はじ)める|この子で/); if (start) { start.click(); return 'start'; }
      const mon = live.find((x) => x.innerText.replace(/\s+/g, ' ').trim().startsWith('連撃ザン'));
      if (mon) { mon.click(); return 'mon'; }
      return null;
    });
    if (process.env.DEBUG) console.log(label, 'STEP', i, step, step ? '' : (await page.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.offsetParent && !x.disabled).map((x) => (x.innerText || x.getAttribute('aria-label') || '').replace(/\s+/g, ' ').slice(0, 18)).join(' / '))).slice(0, 500));
    if (!step) break;
    await page.waitForTimeout(900);
  }
  const reached = /WAVE 1\/10/.test(await text());
  const heroSlot = await page.evaluate(() => { const b = [...document.querySelectorAll('button[data-slot-index]')].find((x) => x.querySelector('img')); return b ? Number(b.getAttribute('data-slot-index')) : null; });
  const turnNo = async () => { const m = (await text()).match(/TURN (\d+)\//); return m ? Number(m[1]) : null; };
  const logText = async () => {
    await page.locator('[data-battle-log-button]').first().dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(400);
    const t = await page.evaluate(() => document.body.innerText);
    for (let c = 0; c < 3 && /BATTLE LOG/.test(await text()); c += 1) { await page.getByRole('button', { name: /^閉じる$/ }).last().dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300); }
    return t;
  };
  let result = null;
  for (let turn = 0; turn < 20 && reached && !result; turn += 1) {
    // バトルの途中で出たお話は「スキップ」で閉じる
    for (let sk = 0; sk < 3; sk += 1) {
      const skip = page.getByRole('button', { name: 'スキップ', exact: true }).first();
      if (await skip.count() === 0 || !(await skip.isVisible().catch(() => false))) break;
      await skip.click().catch(() => {}); await page.waitForTimeout(800);
      await page.getByRole('button', { name: /^(閉じる|OK)$/ }).first().click({ timeout: 1500 }).catch(() => {});
    }
    const before = await turnNo();
    if (process.env.DEBUG) { console.log(label, 'TURN', await turnNo(), JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].map((c) => [c.getAttribute('data-card-type'), c.getAttribute('data-card-usable'), c.textContent.slice(0, 8)])))); if (turn === 0 && SHOT) await page.screenshot({ path: path.join(SHOT, `combo-${label}-turn0.png`) }); }
    const uniqueIdx = await page.evaluate(() => [...document.querySelectorAll('[data-hand-card]')].findIndex((c) => c.getAttribute('data-card-usable') === 'true' && c.getAttribute('data-card-type') === 'unique'));
    // 固有技が使えないターンは、守り・回復の札、無ければ固有技以外の使える札でターンを進める
    const idx = uniqueIdx >= 0 ? uniqueIdx : await page.evaluate(() => { const cs = [...document.querySelectorAll('[data-hand-card]')]; const ok = (c) => c.getAttribute('data-card-usable') === 'true';
      let i = cs.findIndex((c) => ok(c) && /^(guard|weak_guard|heal|draw)$/.test(c.getAttribute('data-card-type') || '')); if (i < 0) i = cs.findIndex((c) => ok(c) && c.getAttribute('data-card-type') !== 'unique'); return i; });
    if (idx >= 0) {
      await page.locator('[data-hand-card]').nth(idx).click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);
      if (heroSlot != null && await page.locator('[data-battle-action][disabled]').count()) await page.locator(`button[data-slot-index="${heroSlot}"]`).click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
    const pv = uniqueIdx >= 0 ? await page.evaluate(() => { const e = [...document.querySelectorAll('[data-tactics-damage-preview]')].find((x) => x.getClientRects().length); return e ? Number(e.getAttribute('data-tactics-damage-preview') || (e.innerText.match(/\d[\d,]*/) || ['0'])[0].replace(/,/g, '')) : null; }) : null;
    if (uniqueIdx >= 0 && SHOT) await page.screenshot({ path: path.join(SHOT, `combo-${label}-予測.png`) });
    const logBefore = uniqueIdx >= 0 ? await logText() : '';
    for (let k = 0; k < 60; k += 1) {
      if (k % 10 === 0) await page.evaluate(() => document.querySelector('[data-battle-action]')?.click());
      await page.waitForTimeout(500); const now = await turnNo(); if (now != null && before != null && now !== before) break; if (/WAVE 2\/10|GAME OVER|敗\s*北/.test(await text())) break;
    }
    await page.waitForTimeout(800);
    if (uniqueIdx >= 0) {
      const logAfter = await logText();
      const added = logAfter.slice(logBefore.length > 200 ? logAfter.indexOf(logBefore.slice(-200)) + 200 : 0);
      const lines = (logAfter.split('\n').filter((l) => /敵に [\d,]+ ダメージ/.test(l)));
      if (process.env.DEBUG) console.log(label, 'LOG', lines.slice(-8).join(' | '));
      result = { pv, lines: lines.slice(-8) };
    }
  }
  await page.close();
  return { reached, result, errors };
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const plain = await runOnce(browser, '強化なし', null);
    if (process.env.ONLY_PLAIN) { console.log(JSON.stringify(plain)); process.exit(0); }
    const boosted = await runOnce(browser, '連撃数3本', { comboCount: 3 });
    console.log('強化なし', JSON.stringify(plain.result));
    console.log('連撃数3本', JSON.stringify(boosted.result));
    check('どちらもバトル(WAVE 1)まで進み、固有技を撃てた', plain.reached && boosted.reached && !!plain.result && !!boosted.result);
    // 固有技を撃ったターンの記録(技の名前の行から後ろ)を数に直す
    const hitsOf = (r) => { if (!r) return []; const i = r.lines.map((l) => /連撃ザンの (?!連撃)/.test(l)).lastIndexOf(true); return r.lines.slice(Math.max(0, i)).map((l) => Number((l.match(/敵に ([\d,]+) ダメージ/) || [0, '0'])[1].replace(/,/g, ''))); };
    const a = hitsOf(plain.result), b = hitsOf(boosted.result);
    const sum = (x) => x.reduce((p, q) => p + q, 0);
    check('① 強化なし: 予測「攻N」と実際の記録の合計が同じ', plain.result && plain.result.pv === sum(a), `予測${plain.result && plain.result.pv} 実際${sum(a)}(${a.join('+')})`);
    check('① 連撃数+3本: 予測「攻N」と実際の記録の合計が同じ', boosted.result && boosted.result.pv === sum(b), `予測${boosted.result && boosted.result.pv} 実際${sum(b)}(${b.join('+')})`);
    const extra = b.slice(a.length), ten = Math.floor((a[0] || 0) * 0.1);
    check('② 連撃数+3本: 元のダメージの10%の連撃がちょうど3本増える', b.length === a.length + 3 && a[0] === b[0] && extra.every((x) => x === ten) && ten > 0, `本数 ${a.length}→${b.length} 増えた分 ${extra.join(',')}(10%=${ten})`);
    check('実行時エラーが出ない', plain.errors.length === 0 && boosted.errors.length === 0, [...plain.errors, ...boosted.errors].slice(0, 2).join(' / '));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

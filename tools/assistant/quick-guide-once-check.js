#!/usr/bin/env node
// 裏周回の案内(モードえらび g3c・曲えらび g3b)が「1回目は出る/2回目は出ない」ことを、本物の画面で縦・横・🔄横の3つで確かめて撮る
// (2026-11-07 社長「モンビーとかひらくたびに助手が裏周回の説明をしてくる」→ #4837 で直した。検査部が裏周回の条件を作れず未確認だったため)。
//   QG_BASE=<URL> で見る版を選ぶ(既定は本番 https://aknkakykhk-maker.github.io/monhero/)。手元なら QG_BASE=http://localhost:8899/
//   QG_SHOT_DIR=<フォルダ> で止め絵(1回目・2回目)を残す
//   node tools/assistant/quick-guide-once-check.js
// 裏クイックをどこでも回す公開の印(17-release)
const QUICK_ANYWHERE = /const QUICK_RUN_ANYWHERE_RELEASE = true;/.test(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8'));
'use strict';
const path = require('path');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const BASE = (process.env.QG_BASE || 'https://aknkakykhk-maker.github.io/monhero/').replace(/\/?$/, '/');
const SHOT = process.env.QG_SHOT_DIR || '';
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed } = require('../boot/quiet-boot-seed');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const vp of [{ name: '縦', width: 390, height: 844 }, { name: '横', width: 844, height: 390 }, { name: '🔄横', width: 390, height: 844, rot: true }]) {
    const page = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: SHOT ? 2 : 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_clears_Beginner', 1);
      // バトル側の案内は見たことにする(見るのは裏周回のモンヒロビートの2つだけ)。誘導も済み
      put('mh_quick_guide_seen_v1', { v: 1, seen: ['g1a', 'g1b', 'g2', 'g3a', 'auto'] }); put('mh_quick_nudge_v1', { v: 1, n: 3, day: '2026-01-01' });
      put('mh_rhythm_tutorial_seen_v1', true);
      window.__mhSupabaseStubbed = true;
    });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    // 本番でも、ランキングなどへは書き込まない(読み出しは空で返す)
    await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: r.request().method() === 'GET' ? '[]' : '' }));
    const down = (sel) => page.evaluate((s) => { const el = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(s.text)); if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!el; }, sel);
    const guide = () => page.evaluate(() => { const g = document.querySelector('[data-quick-guide]'); return g ? { id: g.getAttribute('data-quick-guide'), page: g.getAttribute('data-quick-guide-page') } : null; });
    const click = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (el) el.click(); return !!el; }, sel);
    const store = (k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } }, k);
    const shot = async (name) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${name}-${vp.name}.png`) }); };
    const T = `[${vp.name}] `;
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    const build = await page.evaluate(async () => { try { return (await (await fetch('version.json', { cache: 'no-store' })).json()).build; } catch (_) { return null; } });
    console.log(`${T}見ている版: ${BASE} build ${build}`);
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await down({ text: 'TAP TO START' });
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 60000 }).catch(() => {});
    await down({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(3500);
    for (let i = 0; i < 8; i++) {
      const hit = await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => !x.closest('[data-quick-guide]') && /^(確認|受け取る|閉じる|スキップ|OK|とじる)$/.test(x.textContent.trim())); if (el) el.click(); return !!el; });
      await page.waitForTimeout(700);
      if (!hit) break;
    }
    await click('button[aria-label="モンヒロバトル"]'); await page.waitForTimeout(1200);
    await click('[data-battle-system="systemQuick"]'); await page.waitForTimeout(1500);
    for (let k = 0; k < 12; k++) { const moved = await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="前の難易度"]')].find((x) => x.offsetParent && !x.disabled); if (b) { b.click(); return true; } return false; }); if (!moved) break; await page.waitForTimeout(300); }
    const tap = (re, sel = 'button') => page.evaluate(([s, q]) => { const b = [...document.querySelectorAll(q)].find((x) => x.offsetParent && !x.disabled && new RegExp(s).test((x.innerText || '').replace(/\s+/g, ' ').trim())); if (b) b.click(); return !!b; }, [re, sel]);
    await tap('^この難易度で挑戦'); await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); }); await page.waitForTimeout(800);
    await tap('^勇者モンに選ぶ$'); await page.waitForTimeout(800);
    await tap('近距離|中距離|零距離|遠距離'); await page.waitForTimeout(1200);
    await tap('新規習得'); await page.waitForTimeout(800);
    await tap('^習得する$'); await page.waitForTimeout(3500);
    for (let k = 0; k < 2; k++) { await page.evaluate(() => document.querySelector('[data-battle-auto-button]')?.click()); await page.waitForTimeout(800); }
    const toBeat = () => page.evaluate(() => { const b = document.querySelector('button[aria-label="周回を続けたままモンヒロビートへ"]'); if (b && b.offsetParent) { b.click(); return true; } return false; });
    const tapSel = (sel) => page.evaluate((q) => { const b = document.querySelector(q); if (b && b.offsetParent && !b.disabled) { b.click(); return true; } return false; }, sel);
    let opened = false;
    for (let k = 0; k < 30 && !opened; k++) { opened = await toBeat(); if (!opened) await page.waitForTimeout(500); }
    check(`${T}クイックの∞で裏周回したまま、モンヒロビートへ行ける`, opened);
    await page.waitForTimeout(1800);
    if (vp.rot) { await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle())); await page.waitForTimeout(1200); }
    const g1 = await guide();
    await shot('1回目-モードえらび');
    // 裏クイックをどこでも回すとき(2026-11-11 QUICK_RUN_ANYWHERE_RELEASE)は、モードえらびの左上がふつうの「←」になる(出ても周回は続く)ので、
    //   「⏹ 終了」の案内(g3c)は出さない(意図した変更。56-quick-guide.jsx)。曲えらびの案内(g3b)は今までどおり
    if (QUICK_ANYWHERE) check(`${T}1回目のモードえらび: どこでも回すときは「⏹ 終了」の案内(g3c)を出さない`, !(g1 && g1.id === 'g3c'), JSON.stringify(g1));
    else check(`${T}1回目のモードえらび: 裏周回の案内(g3c)が出る`, g1 && g1.id === 'g3c', JSON.stringify(g1));
    if (g1) await click('[data-quick-guide-next]');
    await page.waitForTimeout(500);
    await tapSel('[data-rhythm-mode-solo]'); await page.waitForTimeout(2000);
    const g2 = await guide();
    await shot('1回目-曲えらび');
    check(`${T}1回目の曲えらび: 裏周回の案内(g3b)が出る`, g2 && g2.id === 'g3b', JSON.stringify(g2));
    if (g2) await click('[data-quick-guide-later]');
    await page.waitForTimeout(500);
    const back = await tapSel('[data-rhythm-song-select-back]'); await page.waitForTimeout(2000);
    const g3 = await guide();
    await shot('2回目-モードえらび');
    const solo = await tapSel('[data-rhythm-mode-solo]'); await page.waitForTimeout(2000);
    const g4 = await guide();
    await shot('2回目-曲えらび');
    check(`${T}2回目のモードえらび・曲えらび: 案内は出ない`, back && solo && !g3 && !g4, JSON.stringify({ back, solo, g3, g4 }));
    const seen = (await store('mh_quick_guide_seen_v1')) || {};
    check(`${T}見た印(g3b${QUICK_ANYWHERE ? '' : '・g3c'})が保存されている`, (seen.seen || []).includes('g3b') && (QUICK_ANYWHERE || (seen.seen || []).includes('g3c')), JSON.stringify(seen));
    check(`${T}画面のエラーが無い`, errors.length === 0, errors.slice(0, 3).join(' / '));
    await page.close();
  }
  await b.close();
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

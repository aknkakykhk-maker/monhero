#!/usr/bin/env node
require('../shared-serve'); // :8899 が無ければ立てる
// ボタンのタップ音が、モンヒロビートの画面と助手ライフでも鳴るか(2026-11-24 r1119-164 社長「モンビーだけ各場所選択してもタップ音ならない」「助手ライフもならない」→ 案B)。
//   モンヒロビートの画面・助手ライフの裏クイック中は、裏のバトルの音を消すために効果音の口(seBus)を0にしている。
//   ボタンの音だけは別の口(Audio_.uiTap・uiBus)で、保存してある効果音の音量で鳴らす(14-audio.jsx / 60-app.jsx の「全ボタンのタップ」)。
//   本物の画面を開いてボタンを押し、①鳴らす口が呼ばれる ②その口の音量が0でない ③裏の効果音の口はモンヒロビートで0のまま
//   ④演奏エリア([data-rhythm-play-area])の中のボタンでは鳴らさない(ノーツの音と重ねない)を確かめる。
//   BTS_BASE=<URL> で見る版を選ぶ(既定は手元 http://localhost:8899/)
'use strict';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const BASE = (process.env.BTS_BASE || 'http://localhost:8899/').replace(/\/?$/, '/');
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed } = require('../boot/quiet-boot-seed');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const open = async () => {
    const page = await b.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => console.log(`  (ページのエラー) ${String(e.message).slice(0, 120)}`));
    await page.addInitScript(() => {
      const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
      put('mh_clears_Beginner', 1); put('mh_rhythm_tutorial_seen_v1', true);
      window.__mhSupabaseStubbed = true;
    });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    // ランキングなどへは書き込まない(読み出しは空で返す)
    await page.route('**/functions/v1/**', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.route('**/rest/v1/**', (r) => r.fulfill({ status: r.request().method() === 'GET' ? 200 : 201, contentType: 'application/json', body: r.request().method() === 'GET' ? '[]' : '' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'load', timeout: 90000 });
    const down = (t, aria) => page.evaluate(([tx, a]) => { const el = a ? document.querySelector(`button[aria-label="${a}"]`) : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(tx)); if (el) el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!el; }, [t, aria]);
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await down('TAP TO START');
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 60000 }).catch(() => {});
    await down(null, 'トップ画面へ進む');
    await page.waitForTimeout(3500);
    for (let i = 0; i < 8; i++) {
      const hit = await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|スキップ|OK|とじる)$/.test(x.textContent.trim())); if (el) el.click(); return !!el; });
      await page.waitForTimeout(700);
      if (!hit) break;
    }
    // 鳴らす口を数える(音そのものは鳴らしたまま)
    await page.evaluate(() => {
      window.__btsTap = { ui: 0, se: 0, fg: 0 };
      const wrap = (obj, key, slot) => { const f = obj && obj[key]; if (typeof f !== 'function') return; obj[key] = (...a) => { window.__btsTap[slot]++; return f(...a); }; };
      wrap(Audio_, 'uiTap', 'ui'); wrap(Audio_.se, 'tap', 'se'); wrap(Audio_.fgSe, 'tap', 'fg');
    });
    return page;
  };
  // 画面を動かさずに、ボタン1つへ click を届ける(document の捕まえ口までは届き、既定の動きは捨てる)
  const press = (page, inPlayArea = false) => page.evaluate((inArea) => {
    window.__btsTap.ui = 0; window.__btsTap.se = 0; window.__btsTap.fg = 0;
    let btn, host;
    if (inArea) { host = document.createElement('div'); host.setAttribute('data-rhythm-play-area', ''); btn = document.createElement('button'); btn.type = 'button'; host.appendChild(btn); document.body.appendChild(host); }
    else btn = [...document.querySelectorAll('button')].find((x) => x.offsetParent && !x.disabled);
    if (!btn) return null;
    btn.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); }, { once: true });
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    if (host) host.remove();
    const d = Audio_.diagnose ? Audio_.diagnose() : {};
    return { ...window.__btsTap, uiVol: Audio_.uiSeVolume ? Audio_.uiSeVolume() : null, seVol: d.seVolumePct };
  }, inPlayArea);
  try {
    let page = await open();
    const home = await press(page);
    check('HOME: ボタンを押すとボタンの音の口(uiTap)が1回呼ばれる', home && home.ui === 1, JSON.stringify(home));
    check('HOME: ボタンの音の口の音量が0でない', home && home.uiVol > 0, JSON.stringify(home));
    const beatOpened = await page.evaluate(() => { const bt = document.querySelector('button[aria-label="モンヒロビート"]'); if (bt) bt.click(); return !!bt; });
    await page.waitForTimeout(3000);
    const onBeat = await page.evaluate(() => /SELECT MODE|モード選び/.test(document.body.innerText));
    check('モンヒロビートのモード選びが開く', beatOpened && onBeat);
    const beat = await press(page);
    check('モンヒロビート: ボタンを押すとボタンの音の口(uiTap)が1回呼ばれる', beat && beat.ui === 1, JSON.stringify(beat));
    check('モンヒロビート: ボタンの音の口の音量が0でない(保存してある効果音の音量)', beat && beat.uiVol > 0, JSON.stringify(beat));
    check('モンヒロビート: 裏のバトルの効果音の口は今までどおり0', beat && beat.seVol === 0, JSON.stringify(beat));
    check('モンヒロビート: se/fgSe のタップでは二重に鳴らさない', beat && beat.se === 0 && beat.fg === 0, JSON.stringify(beat));
    const area = await press(page, true);
    check('演奏エリアの中のボタンでは鳴らさない(ノーツの音と重ねない)', area && area.ui === 0 && area.se === 0 && area.fg === 0, JSON.stringify(area));
    await page.close();
    page = await open();
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {});
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    check('助手ライフが開く', (await page.locator('[data-assistant-life-screen]').count()) > 0);
    const life = await press(page);
    check('助手ライフ: ボタンを押すとボタンの音の口(uiTap)が1回呼ばれる', life && life.ui === 1, JSON.stringify(life));
    check('助手ライフ: ボタンの音の口の音量が0でない', life && life.uiVol > 0, JSON.stringify(life));
    await page.close();
  } catch (e) { check('最後まで確かめられた', false, String(e && e.message || e).slice(0, 200)); }
  await b.close();
  console.log(failed ? `NG ${failed}件` : 'OK: ボタンのタップ音は、モンヒロビートと助手ライフでも別の口で鳴る');
  process.exit(failed ? 1 : 0);
})();

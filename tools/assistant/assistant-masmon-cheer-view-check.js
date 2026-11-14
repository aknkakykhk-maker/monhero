// 助手ライフ「👀 ◯◯の修行」(練習試合の観戦。56-assistant-life-masmon-cheer.jsx)を、本物の画面で確かめる。2026-11-14 社長「ここも文字とか見直して。修行の演出がいまいちわからない」
//   node tools/assistant/assistant-masmon-cheer-view-check.js [--shots]   止め絵: docs/progress/masmon-battle/cheer-view/
// 見るもの: 上が相手・下が自分(名前と顔)・「奥」「手前」の字が無い・名前が切れない・「今日の修行」・場が大きい(モンサクの試合と同じ MsaStage)・ねらいが最初に出る・結果が最後に出る
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const TOOLS_DIR = path.join(__dirname, '..');
const root = path.resolve(TOOLS_DIR, '..');
const PORT = 8897;
const PAGE_URL = `http://localhost:${PORT}/monster-hero/index.html`;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/masmon-battle/cheer-view');
let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const seed = () => {
  if (localStorage.getItem('mh_breeder_name') !== null) return;
  for (const [k, v] of [['mh_breeder_name', 'テスト'], ['mh_breeder_icon', 'Mocchi'], ['mh_onboarded', true], ['mh_tutorial_seen_v1', true],
    ['mh_battle_tutorial_seen_v1', true], ['mh_battle_tutorial_guide_shown_v1', true], ['mh_masu_migrated', true]]) localStorage.setItem(k, JSON.stringify(v));
};
(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていません'); process.exit(0); }
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const width of [390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: width < 360 ? 700 : 844 }, deviceScaleFactor: SHOTS ? 2 : 1 });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript(seed);
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      const pointerDown = (sel) => page.evaluate((s) => { const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text)); if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b; }, sel);
      const clickText = (re) => page.evaluate((pattern) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent)); if (b) b.click(); return !!b; }, re);
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
      await pointerDown({ text: 'TAP TO START' });
      await page.waitForTimeout(2500);
      await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
      await pointerDown({ aria: 'トップ画面へ進む' });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 8; i++) { const closed = await clickText('受け取|閉じる|あとで|スキップ'); await page.waitForTimeout(700); if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break; }
      const prepared = await page.evaluate(async () => {
        RELEASE_FLAGS.assistantMasmonTrain = true; RELEASE_FLAGS.assistantMasmonCheer = true; RELEASE_FLAGS.assistantMasmonBattleBeta = true;
        await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
        const st = ASSISTANT_MASMON_STORE.state, w = { ...st.draw.welcomed };
        for (const [aid, rows] of Object.entries(st.draw.made)) { w[aid] = { ...(w[aid] || {}) }; for (const t of rows) w[aid][t.monster] = w[aid][t.monster] || '2026-11-01'; }
        ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, welcomed: w } });
        await AMGT_STORE.load(); await AMGC_STORE.load();
        const aid = ambbAssistantsWithRows()[0].id;
        const d = document.createElement('div'); d.id = 'cv-host'; document.body.appendChild(d);
        ReactDOM.createRoot(d).render(React.createElement(AssistantMasmonTrainWatchHost));
        await new Promise(r => setTimeout(r, 300));
        return { aid, opened: assistantMasmonTrainWatchOpen(aid) };
      });
      check(`(幅${width}) 修行の観戦が開く`, prepared.opened === true, JSON.stringify(prepared));
      await page.waitForFunction(() => !!document.querySelector('[data-amgc-match]') || !!document.querySelector('[data-amgc-solo]'), { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const r = document.querySelector('.amgc-root'); const t = r ? r.innerText : '';
        const side = (k) => { const e = document.querySelector(`[data-amgc-side="${k}"]`); return e ? { text: e.innerText.replace(/\s+/g, ' '), face: !!e.querySelector('img'), cut: [...e.querySelectorAll('b')].some(b => b.scrollWidth > b.clientWidth + 1) } : null; };
        const sb = document.querySelector('[data-msa-stagebox]');
        return { match: !!document.querySelector('[data-amgc-match]'), solo: !!document.querySelector('[data-amgc-solo]'), foe: side('foe'), me: side('me'), aim: (document.querySelector('[data-amgc-aim]') || {}).innerText || '', stageH: sb ? Math.round(sb.getBoundingClientRect().height) : 0,
          okuTemae: /奥|手前/.test(t), kyou: /きょうの/.test(t), hasStage: !!document.querySelector('[data-msa-stagebox] .msa-stage'), over: r ? r.scrollWidth > r.clientWidth + 1 : false };
      });
      if (m.solo) check(`(幅${width}) ひとりで稽古の場面が出る(相手がいない形)`, true);
      else {
        check(`(幅${width}) 上が相手・下が自分の名前と顔`, !!m.foe && !!m.me && /練習相手/.test(m.foe.text) && /修行中/.test(m.me.text) && m.foe.face && m.me.face && m.foe.text !== m.me.text, JSON.stringify({ foe: m.foe, me: m.me }));
        check(`(幅${width}) 名前が切れない`, !!m.foe && !m.foe.cut && !m.me.cut);
        check(`(幅${width}) 「奥」「手前」の字が無い・「きょうの」ではなく「今日」`, !m.okuTemae && !m.kyou, JSON.stringify({ oku: m.okuTemae, kyou: m.kyou }));
        check(`(幅${width}) 場がモンサクの試合と同じ部品で、高さがある`, m.hasStage && m.stageH >= (width < 360 ? 220 : 300), `${m.stageH}px`);
        check(`(幅${width}) 最初に「ねらい」が出る`, /ねらい/.test(m.aim) && /練習試合/.test(m.aim), m.aim);
      }
      check(`(幅${width}) 横にはみ出さない`, !m.over);
      if (SHOTS) { fs.mkdirSync(shotDir, { recursive: true }); await page.screenshot({ path: path.join(shotDir, `cheer-watch-${width}.png`) }); }
      if (!m.solo) {
        const p0 = await page.evaluate(() => { document.querySelector('[data-amgc-pause]').click(); return Number(document.querySelector('[data-amgc-match]').dataset.msaPos); });
        await page.waitForTimeout(2500);
        const p1 = await page.evaluate(() => Number(document.querySelector('[data-amgc-match]').dataset.msaPos));
        check(`(幅${width}) ⏸ で止まる`, p0 === p1, `${p0}→${p1}`);
        await page.evaluate(() => document.querySelector('[data-amgc-pause]').click());
      }
      await page.evaluate(() => { const b = document.querySelector('[data-amgc-skip]'); if (b) b.click(); });
      await page.waitForTimeout(1200);
      const res = await page.evaluate(() => { const r = document.querySelector('[data-amgc-result]'); return r ? r.innerText.replace(/\s+/g, ' ') : ''; });
      check(`(幅${width}) 最後に「今日の修行の結果」が出る`, /(今日|前回)の修行の結果|まだ修行していません/.test(res), res.slice(0, 80));
      if (SHOTS && width === 390) await page.screenshot({ path: path.join(shotDir, 'cheer-result-390.png') });
      await page.close();
    }
  } finally { if (browser) await browser.close(); server.kill(); }
  check('画面のエラーが無い', errors.length === 0, errors.slice(0, 2).join(' / '));
  console.log(failed ? `NG ${failed}件` : 'OK: すべて');
  process.exit(failed ? 1 : 0);
})();

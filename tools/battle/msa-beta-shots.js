#!/usr/bin/env node
// 助手マスモン対戦 β の「準備(比べっこ・試合の設定)→ 観戦(場が画面いっぱい)」を縦の画面で撮る。2026-11-13 バトル部(段2)
//   STILL_DIR=<出力先> node tools/battle/msa-beta-shots.js     … 止め絵(390×844・2倍)
//   VIDEO_OUT=<出力.mp4|.webm> node tools/battle/msa-beta-shots.js  … 動画(準備で設定を選ぶ所から観戦の途中まで・音なし・ffmpeg で起動の分を切る)
// 撮影のブラウザの中だけで助手のマスモンを用意して開く(本物の保存には触れない)
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const TOOLS_DIR = path.join(__dirname, '..');
const STILL_DIR = process.env.STILL_DIR || '';
const OUT = process.env.VIDEO_OUT || '';
if (!OUT && !STILL_DIR) { console.log('VIDEO_OUT か STILL_DIR を渡してください'); process.exit(0); }
const PORT = 8977;
// TECHS_JSON=<技表の json(species: { 種: [技…] })> … 試しの技表で開く(資料の技で12〜24技になったときの見た目。全部の技を覚えている形にする)
// MANUAL=1 … 手動で対戦する場面を撮る(段3)
const TECHS = process.env.TECHS_JSON ? JSON.parse(fs.readFileSync(process.env.TECHS_JSON, 'utf8')).species : null;
const MANUAL = process.env.MANUAL === '1';
// LONGEST=1 … TECHS_JSON の中で名前の長い技24個を、どの種類にも全部の間合いで持たせる(技名が切れないかの確かめ)。WIDTH=<幅> … 画面の幅
const LONGEST = process.env.LONGEST === '1';
const WIDTH = Number(process.env.WIDTH) || 390;
const HEIGHT = Number(process.env.HEIGHT) || 844;
let TECHS_USE = TECHS;
if (TECHS && LONGEST) {
  const all = Object.values(TECHS).flat().sort((a, b) => [...b.name].length - [...a.name].length);
  const seen = new Set(); const top = all.filter((t) => (seen.has(t.name) ? false : seen.add(t.name))).slice(0, 24).map((t, i) => ({ ...t, id: `long_${i}`, dist: [0, 1, 2, 3], guts: 5 + i }));
  TECHS_USE = Object.fromEntries(Object.keys(TECHS).map((k) => [k, top]));
}
const URL = `http://localhost:${PORT}/monster-hero/index.html`;

const seed = () => {
  if (localStorage.getItem('mh_breeder_name') !== null) return;
  for (const [k, v] of [['mh_breeder_name', 'テスト'], ['mh_breeder_icon', 'Mocchi'], ['mh_onboarded', true], ['mh_tutorial_seen_v1', true],
    ['mh_battle_tutorial_seen_v1', true], ['mh_battle_tutorial_guide_shown_v1', true], ['mh_masu_migrated', true]]) localStorage.setItem(k, JSON.stringify(v));
};

(async () => {
  const { chromium } = require('playwright');
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const tmp = OUT ? path.join(path.dirname(OUT), `.rec-${process.pid}`) : '';
  const errs = [];
  try {
    const ctx = await browser.newContext(STILL_DIR ? { viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 2 } : { viewport: { width: WIDTH, height: HEIGHT }, recordVideo: { dir: tmp, size: { width: WIDTH, height: HEIGHT } } });
    const page = await ctx.newPage();
    const t0 = Date.now(); let tPrep = 0;
    page.on('pageerror', (e) => errs.push(String(e)));
    await page.addInitScript(seed);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 8; i++) {
      const closed = await clickText('受け取|閉じる|あとで|スキップ');
      await page.waitForTimeout(700);
      if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
    }
    if (TECHS_USE) await page.evaluate((t) => { for (const [k, v] of Object.entries(t)) ASSISTANT_MASMON_TECHS.species[k] = v.map((x) => ({ ...x, learn: { start: true } })); }, TECHS_USE);
    await page.evaluate(async () => {
      await ASSISTANT_MASMON_STORE.load(); await assistantMasmonEnsureMade();
      const st = ASSISTANT_MASMON_STORE.state, w = { ...st.draw.welcomed };
      for (const [aid, rows] of Object.entries(st.draw.made)) { w[aid] = { ...(w[aid] || {}) }; for (const t of rows) w[aid][t.monster] = w[aid][t.monster] || '2026-11-01'; }
      ASSISTANT_MASMON_STORE.set({ ...st, draw: { ...st.draw, welcomed: w } });
      // 本来の開き方(育成の回を決めてから並べる = 能力が育った値で出る)。保存はこの撮影のブラウザの中だけ
      RELEASE_FLAGS.assistantMasmonBattleBeta = true; await AMBB_STORE.load();
      assistantMasmonBattleOpen({ assistantId: ambbAssistantsWithRows()[0].id, from: 'room' });
    });
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-prep]'), { timeout: 20000 });
    tPrep = Date.now();
    await page.waitForTimeout(900);
    const scrollTo = (sel) => page.evaluate((s) => { const r = document.querySelector('[data-ambb-root]'); const el = document.querySelector(s); if (r && el) r.scrollTop = el.offsetTop - 8; }, sel);
    const still = async (name) => { if (STILL_DIR) await page.screenshot({ path: path.join(STILL_DIR, `${name}.png`) }); };
    fs.mkdirSync(STILL_DIR || path.dirname(OUT), { recursive: true });
    await still('1-prep-top');
    await scrollTo('[data-ambb-compare]'); await page.waitForTimeout(OUT ? 1400 : 700);
    await still('2-compare');
    if (await clickSel('[data-ambb-cmp-pair="1"]')) { await page.waitForTimeout(OUT ? 1200 : 700); await still('2b-compare-pair2'); await clickSel('[data-ambb-cmp-pair="0"]'); }
    await scrollTo('[data-ambb-settings]'); await page.waitForTimeout(OUT ? 900 : 300);
    for (const s of MANUAL ? ['[data-ambb-set="ctl:manual"]', '[data-ambb-size="2"]'] : ['[data-ambb-set="team:ko"]', '[data-ambb-set="dist:0"]', '[data-ambb-set="guts:70"]', '[data-ambb-set="rounds:50"]']) { await clickSel(s); await page.waitForTimeout(OUT ? 600 : 100); }
    await page.evaluate(() => { const d = document.querySelector('[data-ambb-tune]'); if (d) d.open = true; });
    await page.waitForTimeout(OUT ? 900 : 300);
    await still('3-settings');
    if (MANUAL) {
      // 準備画面の「🃏 技の札を決める」→ 札を押して一覧 →「☆ 代表にする」
      if (await clickSel('[data-ambb-rep-open]')) {
        await page.waitForTimeout(OUT ? 1400 : 300); await still('7a-prep-rep');
        for (let d = 0; d < 4; d++) {
          await page.evaluate((k) => { const c = document.querySelector(`[data-ambb-rep-edit] [data-msa-dc-card="${k}"]`); if (c && !c.disabled) c.click(); }, d);
          await page.waitForTimeout(OUT ? 1200 : 250);
          if (await page.evaluate(() => !!document.querySelector('[data-msa-sheet] [data-msa-rep]'))) { await still('7b-prep-rep-list'); await clickSel('[data-msa-sheet] [data-msa-rep]'); await page.waitForTimeout(OUT ? 1200 : 300); await still('7c-prep-rep-set'); break; }
          await page.evaluate(() => { const x = document.querySelector('[data-msa-sheet] [data-msa-sheet-close]'); if (x) x.click(); });
        }
        await page.evaluate(() => { document.querySelectorAll('[data-msa-sheet-close]').forEach((b) => b.click()); const b = [...document.querySelectorAll('[data-ambb-rep-edit] button')].find((x) => /閉じる/.test(x.textContent)); if (b) b.click(); });
        await page.waitForTimeout(300);
      }
    }
    await clickSel('[data-ambb-start]');
    await page.waitForFunction(() => !!document.querySelector('[data-ambb-watch] [data-msa-stage]'), { timeout: 10000 });
    if (MANUAL) {
      // 手動(段3・技の札は間合いごとの4枚): 帯 → いまの間合いの札を押して一覧 → ☆ 代表にする → 一覧の技を使う → 全部の技 → 相手の札の一覧
      const waitBar = () => page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] [data-msxm="act"]'), { timeout: 15000 });
      const closeSheet = () => page.evaluate(() => { document.querySelectorAll('[data-msa-sheet-close]').forEach((b) => b.click()); });
      await waitBar(); await page.waitForTimeout(400); await still('8-manual-cards');
      const fit = await page.evaluate(() => { const st = document.querySelector('[data-msa-stage]').getBoundingClientRect(); const r = document.querySelector('[data-ambb-root]'); return { stageH: Math.round(st.height), scroll: r.scrollHeight - r.clientHeight, cards: document.querySelectorAll('[data-msa-dc-card]').length }; });
      console.log('手動の帯:', JSON.stringify(fit));
      await clickSel('[data-msa-dc="manual"] [data-msa-dc-card].now'); await page.waitForTimeout(OUT ? 1400 : 300); await still('9-manual-list');
      if (await clickSel('[data-msa-sheet] [data-msa-rep]')) { await page.waitForTimeout(OUT ? 1400 : 300); await still('9b-manual-rep'); }
      const used = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msa-sheet] [data-msxm-tech]')].find((x) => !x.disabled); if (b) { b.click(); return true; } return false; });
      if (!used) { await closeSheet(); await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msxm] .msxm-btn')].find((x) => !x.disabled); if (b) b.click(); }); }
      await page.waitForTimeout(OUT ? 3500 : 2500); await still('10-manual-after');
      await waitBar().catch(() => {});
      // 技名が切れていないか(枠からはみ出さない・言葉の途中で折れない・字が 7px 以上)を、札・一覧で数える
      const fitOf = () => page.evaluate(() => { const els = [...document.querySelectorAll('[data-msa-tn]')]; const bad = els.filter((el) => el.scrollWidth > el.clientWidth + 1 || [...el.querySelectorAll('.msa-tn-s')].some((s) => s.getClientRects().length > 1) || parseFloat(getComputedStyle(el).fontSize) < 7).map((el) => el.textContent); return { n: els.length, bad: bad.length, ex: bad.slice(0, 3) }; });
      const fitCards = await fitOf();
      await clickSel('[data-msxm-all]'); await page.waitForTimeout(OUT ? 1400 : 300); await still('11-manual-all'); const fitAll = await fitOf(); await closeSheet();
      await page.evaluate(() => { const c = [...document.querySelectorAll('[data-ambw-cards="B"] [data-msa-dc-card]')].find((x) => !x.disabled); if (c) c.click(); });
      await page.waitForTimeout(OUT ? 1500 : 400); await still('12-foe-list');
      const fitList = await fitOf();
      console.log(`技名(幅 ${WIDTH}): 札 ${JSON.stringify(fitCards)} / 全部 ${JSON.stringify(fitAll)} / 相手の一覧 ${JSON.stringify(fitList)}`);
      await closeSheet();
      if (OUT) {
        // もう1手(札 → 一覧の技)選んでから「オートにする」で進むところまで(終わっていたら待たない)
        const hasBar = () => page.evaluate(() => !!document.querySelector('[data-ambb-manual] [data-msxm="act"]'));
        await page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] [data-msxm="act"]') || !!document.querySelector('[data-ambb-review]'), { timeout: 15000 }).catch(() => {});
        if (await hasBar()) {
          await page.waitForTimeout(700); await clickSel('[data-msa-dc="manual"] [data-msa-dc-card].now'); await page.waitForTimeout(1200);
          const ok = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msa-sheet] [data-msxm-tech]')].find((x) => !x.disabled); if (b) { b.click(); return true; } return false; });
          if (!ok) { await closeSheet(); await page.evaluate(() => { const b = [...document.querySelectorAll('[data-msxm] .msxm-btn')].find((x) => !x.disabled); if (b) b.click(); }); }
        }
        await page.waitForFunction(() => !!document.querySelector('[data-ambb-manual] .msxm-auto') || !!document.querySelector('[data-ambb-review]'), { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(700);
        await page.evaluate(() => { const b = document.querySelector('[data-ambb-manual] .msxm-auto'); if (b) b.click(); });
        await page.waitForTimeout(9000);
      }
    } else if (STILL_DIR) {
      // 構え・当たり・その先(ラウンドが進んだ所)
      for (const [name, ms] of [['4-watch-intro', 1200], ['5-watch-fight', 3200], ['6-watch-mid', 6000]]) { await page.waitForTimeout(ms); await still(name); }
      const fit = await page.evaluate(() => {
        const st = document.querySelector('[data-msa-stage]').getBoundingClientRect();
        const root = document.querySelector('[data-ambb-root]');
        return { stageH: Math.round(st.height), bottom: Math.round(st.bottom), scroll: root.scrollHeight - root.clientHeight, vh: innerHeight };
      });
      console.log('観戦の場:', JSON.stringify(fit));
    } else {
      await page.waitForTimeout(16000);
    }
    await ctx.close();
    if (OUT) {
      const f = fs.readdirSync(tmp).find((x) => x.endsWith('.webm'));
      // 起動の画面は落とす(β が開いた所から)。.mp4 なら ffmpeg で変換もする
      const ss = Math.max(0, (tPrep - t0) / 1000 - 0.3).toFixed(2);
      require('child_process').execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', ss, '-i', path.join(tmp, f), ...(OUT.endsWith('.mp4') ? ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-movflags', '+faststart'] : []), OUT]);
      fs.rmSync(tmp, { recursive: true, force: true });
      console.log('動画:', OUT);
    }
    console.log(errs.length ? `画面のエラー: ${errs.slice(0, 3).join(' / ')}` : '画面のエラーなし');
  } catch (e) {
    try { const pg = browser.contexts()[0].pages()[0]; await pg.screenshot({ path: path.join(STILL_DIR || path.dirname(OUT), 'stuck.png') }); console.log(await pg.evaluate(() => document.querySelector('[data-ambb-root]') ? document.querySelector('[data-ambb-root]').innerText.slice(0, 200) : 'β が無い')); } catch (_) {}
    console.log('止まった:', String(e).split('\n')[0], errs.length ? `/ 画面のエラー: ${errs.slice(0, 3).join(' / ')}` : '');
    process.exitCode = 1;
  } finally {
    await browser.close(); server.kill();
  }
})().catch((e) => { console.error(e); process.exit(1); });

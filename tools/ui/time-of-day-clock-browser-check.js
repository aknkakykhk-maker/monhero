// いまの時刻の札(44-time-of-day.jsx)を本物の画面で確かめる。2026-11-07 演出担当ハナビ
// きっかけ: 助手ライフの家の見出しに札を置いたら、題が「助手ライ」で切れ、時間帯も「🌙 21:34」「🌙 夜」で二重になった(社長「仕上がりが甘い」)。
// 見ること(縦 390x844・横 844x390・縦の端末で「🔄 横」の3つ。夜の時刻にして測る):
//  ① 札がほかのボタン・札・文字に重なっていない(HOME・プロフィール・助手ライフの家)
//  ② 札と同じ見出しにある題が、文字の途中で切れていない(scrollWidth > clientWidth にならない)
//  ③ 札の中身が日本時間になっている。HOMEでは押すと24時間 / AM・PMをその場で切り替えられ、保存される
// 配信 serve.py はこの検査が自分で立てる。SMOKE_URL で本番を見ることもできる
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const TOOLS_DIR = path.resolve(__dirname, '..');
const PORT = 8983;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
const errors = [];
const ng = (m) => errors.push(m);

const SAVE = () => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1'); const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
  put('mh_update_notice_seen_v1', true); put('mh_rhythm_tutorial_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true); put('mh_breeder_points_granted', true); };

// 札のまわりを測る(画面の中で札と重なる、押せる物・文字の箱を探す。札の祖先と子孫は除く)
const MEASURE = () => {
  const out = [];
  // プロフィール等の札は押せないので、測るあいだだけ「いちばん上に見えているか」の判定に入れる
  const tmp = document.createElement('style'); tmp.textContent = '[data-time-of-day-clock]{pointer-events:auto!important}'; document.head.appendChild(tmp);
  document.querySelectorAll('[data-time-of-day-clock]').forEach(clock => {
    const r = clock.getBoundingClientRect();
    if (r.width === 0) return;
    // ほかの画面の下に隠れている札(家を開いているときの HOME の札など)は測らない
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!top || !(clock === top || clock.contains(top))) return;
    const shown = (el, b) => { const x = Math.max(r.left, b.left) + 1, y = Math.max(r.top, b.top) + 1; const t = document.elementFromPoint(Math.min(x, b.right - 1), Math.min(y, b.bottom - 1)); return !!t && (el === t || el.contains(t) || t.contains(el)); };
    const text = clock.innerText.replace(/\s+/g, ' ').trim();
    const hits = [];
    document.querySelectorAll('button,a,[role=button],[data-assistant-life-clock],h1,h2,p,strong').forEach(el => {
      if (el === clock || el.contains(clock) || clock.contains(el)) return;
      const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) === 0) return;
      const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) return;
      const ox = Math.min(r.right, b.right) - Math.max(r.left, b.left), oy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
      if (ox > 2 && oy > 2 && shown(el, b)) hits.push((el.innerText || el.getAttribute('aria-label') || el.className || el.tagName).toString().replace(/\s+/g, ' ').slice(0, 24));
    });
    // 同じ見出し(札の親から3段上まで)の中で、文字が切れているもの
    let row = clock.parentElement; for (let i = 0; i < 3 && row && row.parentElement; i++) row = row.parentElement;
    const cut = [];
    (row ? row.querySelectorAll('p,h1,h2,span,strong,b,div') : []).forEach(el => {
      if (el.children.length > 0 || !(el.innerText || '').trim()) return;
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'visible') cut.push(el.innerText.trim().slice(0, 16));
    });
    out.push({ text, hits, cut });
  });
  tmp.remove();
  return out;
};

(async () => {
  const server = process.env.SMOKE_URL ? null : spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, server ? 1500 : 0));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [name, vp, rot] of [['縦', { width: 390, height: 844 }, 0], ['横', { width: 844, height: 390 }, 0], ['🔄横', { width: 390, height: 844 }, 90]]) {
      const page = await browser.newPage({ viewport: vp, isMobile: true, hasTouch: true });
      await page.addInitScript(SAVE);
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 90000 });
      await page.waitForFunction(() => document.body?.innerText.includes('TAP TO START'), { timeout: 90000 });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForFunction(() => document.querySelector('.mh-home-background.is-ready'), { timeout: 60000 });
      for (let i = 0; i < 16; i++) {
        const did = await page.evaluate(() => { const inO = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.position === 'fixed' || (st.position === 'absolute' && Number(st.zIndex) >= 40)) return true; } return false; };
          const l = [...document.querySelectorAll('button')].filter(b => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
          if (!l.length) return false; l[0].click(); return true; });
        if (!did) break; await page.waitForTimeout(300);
      }
      if (rot) { await page.evaluate(a => RHYTHM_VIEW_ROTATION.set(a), rot); await page.waitForTimeout(1200); }
      // 夜の 21:34 にする(いちばん幅の広い時刻の形で測る)
      await page.evaluate(() => { TIME_OF_DAY_STORE.slot = TIME_OF_DAY_SLOTS[3]; TIME_OF_DAY_STORE.minute = '21:34'; timeOfDayEmit(); });
      await page.waitForTimeout(800);
      const look = async (where) => {
        const res = await page.evaluate(MEASURE);
        if (!res.length) return false;
        for (const r of res) {
          if (!/^🌙\s?21:34$/.test(r.text)) ng(`${name} ${where}: 札の中身が「🌙 21:34」でない(${r.text})`);
          if (r.hits.length) ng(`${name} ${where}: 札がほかの表示に重なっている — ${r.hits.join(' / ')}`);
          if (r.cut.length) ng(`${name} ${where}: 札と同じ見出しで文字が切れている — ${r.cut.join(' / ')}`);
        }
        return true;
      };
      if (!(await look('HOME'))) ng(`${name} HOME: 時刻の札が無い`);
      // HOME の時計は押すと表示形式のシートが開き、選んだ瞬間に表示と保存へ反映する
      const homeClock = page.locator('[data-time-of-day-clock]').first();
      await homeClock.click();
      const fmtSheet = page.locator('[data-time-of-day-format-sheet]');
      if (!(await fmtSheet.isVisible().catch(() => false))) ng(`${name} HOME: 時計を押しても時刻表示の設定が開かない`);
      else {
        const firstFmt = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_time_of_day_v1') || 'null'); } catch { return null; } });
        if (firstFmt && firstFmt.format && firstFmt.format !== '24h') ng(`${name} HOME: 旧保存データの既定が24時間でない(${firstFmt.format})`);
        await page.locator('[data-time-of-day-format="12h"]').click();
        await page.waitForTimeout(150);
        const twelve = (await homeClock.innerText()).replace(/\s+/g, ' ').trim();
        const saved12 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_time_of_day_v1') || 'null'); } catch { return null; } });
        if (!/^(🌙\s*)?(AM|PM)\s+\d{1,2}:\d{2}$/.test(twelve)) ng(`${name} HOME: AM・PMへ変えても時計が切り替わらない(${twelve})`);
        if (!saved12 || saved12.format !== '12h') ng(`${name} HOME: AM・PMの設定が保存されない`);
        await page.locator('[data-time-of-day-format="24h"]').click();
        await page.waitForTimeout(150);
        const twentyFour = (await homeClock.innerText()).replace(/\s+/g, ' ').trim();
        const saved24 = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_time_of_day_v1') || 'null'); } catch { return null; } });
        if (/\b(?:AM|PM)\b/.test(twentyFour) || !/\d{1,2}:\d{2}$/.test(twentyFour)) ng(`${name} HOME: 24時間へ戻しても時計が切り替わらない(${twentyFour})`);
        if (!saved24 || saved24.format !== '24h') ng(`${name} HOME: 24時間の設定が保存されない`);
        await page.locator('[data-time-of-day-format-close]').click();
        if (await fmtSheet.isVisible().catch(() => false)) ng(`${name} HOME: 「閉じる」で時刻表示の設定が閉じない`);
        // このあとの重なり検査は従来どおり最も幅の広い夜21:34へ戻す
        await page.evaluate(() => { TIME_OF_DAY_STORE.slot = TIME_OF_DAY_SLOTS[3]; TIME_OF_DAY_STORE.minute = '21:34'; timeOfDayEmit(); });
      }
      // 助手ライフの家(公開の印が真のときだけ入口がある)
      const life = await page.evaluate(() => { const el = document.querySelector('[data-home-assistant-life]'); if (el) { el.click(); return true; } return false; });
      if (life) {
        await page.waitForTimeout(2000);
        await page.evaluate(() => { TIME_OF_DAY_STORE.slot = TIME_OF_DAY_SLOTS[3]; TIME_OF_DAY_STORE.minute = '21:34'; timeOfDayEmit(); });
        await page.waitForTimeout(500);
        await look('助手ライフの家');
        // 家の見出しの題そのものが切れていないか(札を見出しに置かないときも、時間帯の札と並ぶため)
        const titleCut = await page.evaluate(() => { const h = [...document.querySelectorAll('.mhl-hdr')].find(x => { const b = x.getBoundingClientRect(); const t = document.elementFromPoint(b.left + b.width / 2, b.top + 4); return t && x.contains(t); }); if (!h) return null; return [...h.querySelectorAll('p,span,b,strong,h1,h2')].filter(el => !el.children.length && el.scrollWidth > el.clientWidth + 1).map(el => el.innerText.trim().slice(0, 16)); });
        if (titleCut && titleCut.length) ng(`${name} 助手ライフの家: 見出しの文字が切れている — ${titleCut.join(' / ')}`);
        await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-close]'); b && b.click(); });
        await page.waitForTimeout(1200);
      }
      // プロフィール
      if (!rot) {
        await page.locator('.mh-home-player').click();
        await page.waitForTimeout(1500);
        await page.evaluate(() => { TIME_OF_DAY_STORE.slot = TIME_OF_DAY_SLOTS[3]; TIME_OF_DAY_STORE.minute = '21:34'; timeOfDayEmit(); });
        await page.waitForTimeout(300);
        if (!(await look('プロフィール'))) ng(`${name} プロフィール: 時刻の札が無い`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  if (errors.length) { console.log(`NG: 時刻の札 ${errors.length}件`); errors.forEach(e => console.log(`  - ${e}`)); process.exit(1); }
  console.log('OK: 時刻の札(縦・横・🔄横で、重ならない・見出しが切れない・日本時間の時:分)');
})().catch(e => { console.error(e); process.exit(1); });

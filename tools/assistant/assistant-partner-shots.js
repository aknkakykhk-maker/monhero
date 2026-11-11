require('../shared-serve'); // :8899 が無ければ立てる
// 助手の解放(2026-11-11)の本物の止め絵を撮る(検査ではなく、窓口・社長へ見せる写しを作る道具)。
//   node tools/assistant/assistant-partner-shots.js <置き場>
// はじめての人(mode:'earn'・最初はきき)が、みゅあのカードを40回使って解放した直後の HOME(演出)と、助手を変える小窓を、縦・横で撮る。
// 公開の印 assistantPartnerUnlock はこのページの中だけ真にする(ファイルの印は変えない)
const path = require('path');
const { chromium } = require(path.join(__dirname, '../node_modules/playwright'));
const { quietBootSeed, updateNoticeSeed, loginBonusDoneSeed } = require('../boot/quiet-boot-seed');
const OUT = path.resolve(process.argv[2] || 'docs/progress/assistant-unlock/real');
const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true); put('mh_first_battle_done_v1', true);
  put('mh_assistant_selected_v1', 'kiki');
  put('mh_assistant_partner_v1', { v: 1, mode: 'earn', first: 'kiki', unlocked: ['kiki', 'mua'], noticed: [] });
  put('mh_assistant_card_uses_v1', { mua: 40, dra: 17, atsu: 6 });
  const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantPartnerUnlock = true; clearInterval(t); } } catch {} }, 2);
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  for (const [tag, vp] of [['tate', { width: 390, height: 844 }], ['yoko', { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(loginBonusDoneSeed());
    await page.addInitScript(seed);
    await page.goto(PAGE_URL);
    // タイトル → タップで始める
    for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await page.$('[data-assistant-partner-fx]')) break; const b = await page.$('text=TAP TO START'); if (b) await b.click({ force: true, timeout: 2000 }).catch(() => {}); else await page.mouse.click(vp.width / 2, vp.height * 0.5).catch(() => {}); }
    const fx = await page.$('[data-assistant-partner-fx]');
    if (!fx) { console.log(`NG: ${tag} 演出が出ない`); await page.screenshot({ path: path.join(OUT, `${tag}-nofx.jpg`), type: 'jpeg', quality: 70 }); continue; }
    await page.screenshot({ path: path.join(OUT, `${tag}-fx1.jpg`), type: 'jpeg', quality: 78 });
    await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, `${tag}-fx2.jpg`), type: 'jpeg', quality: 78 });
    await page.waitForTimeout(1200); await page.screenshot({ path: path.join(OUT, `${tag}-fx3.jpg`), type: 'jpeg', quality: 78 });
    await page.click('[data-assistant-partner-fx]'); await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(OUT, `${tag}-fx4.jpg`), type: 'jpeg', quality: 78 });
    await page.click('[data-assistant-partner-later]'); await page.waitForTimeout(800);
    const gone = !(await page.$('[data-assistant-partner-fx]'));
    console.log(`${gone ? 'OK' : 'NG'}: ${tag} 「あとで」で閉じる`);
    const saved = await page.evaluate(() => localStorage.getItem('mh_assistant_partner_v1'));
    console.log(`${/"noticed":\["mua"\]/.test(saved) ? 'OK' : 'NG'}: ${tag} 見た印が残る — ${saved}`);
    await page.close();
  }
  await browser.close();
})();

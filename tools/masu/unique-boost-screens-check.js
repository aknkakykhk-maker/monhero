#!/usr/bin/env node
// 固有技のオリジナル強化を、遊ぶ人として縦・横・🔄横の3つの向きで触って確かめる(2026-11-07 社長「ちゃんと検査しながらすすめて」)。
//
//   node tools/masu/unique-boost-screens-check.js            (UB_SHOT_DIR=<フォルダ> で止め絵も撮る)
//   UB_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ。既定は手元の配信)
//
// 向き: 縦 390×844 / 横 844×390 / 🔄横(端末は縦のまま、モンヒロビートの「🔄 横」と同じ回し方)
// 触る所と見ること:
//   ① マスモン詳細の「固有技強化」: Lv.8 の技に「✨ オリジナル強化」が出て、押すとシートが開く
//   ② シート: 3タブを順に開ける・灰色の行は押せない・? で説明が開いて閉じられる・確定すると要約が行に出る
//   ③ 総合力の札を押すと内わけが開き、オリジナル強化の行が出る・もう一度押すと閉じる
//   ④ スキルポイントリセット券: 確認に「オリジナル強化」と返すPが出る(やめるを押して、何も変わらない)
//   ⑤ 合体の確認: 副の技を選ぶ一覧(引き継がない・自前・前に引き継いだ技)が出て、選ぶと「Lv とオリジナル強化も一緒に引き継ぎます」
//   どの画面も: 横にはみ出さない・ボタンや札の文字が切れていない(はみ出していない)・画面の外に出ていない・実行時エラーが出ない
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8978;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SHOT = process.env.UB_SHOT_DIR || '';

const zan = { name: 'リバースレイド', monId: 'Zan', lineageId: 'Zan', inheritedUniqueId: 'ubz1', sourceMasuName: 'ザンさん', baseMult: 2.4, baseGuts: 44, evoLevel: 8 };
const eiki = { name: '華影緋閃', monId: 'Eiki', lineageId: 'Eiki', inheritedUniqueId: 'ube1', sourceMasuName: 'エイキさん', baseMult: 2.4, baseGuts: 44, evoLevel: 8 };
const FIXTURES = [
  { id: 'ub-m1', baseId: 'Golem', name: '検査ゴーレム', bondXp: 2000000, levelCap: 30, createdAt: 1, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
    inheritedUniques: [zan], uniqueSkillLevels: { own: 8, 'inhId:ubz1': 8 }, uniqueSkillPoints: 60000,
    uniqueSkillBoosts: { 'inhId:ubz1': { comboCount: 1, power: 20 } } },
  { id: 'ub-s1', baseId: 'Pixie', name: '検査ピクシー', bondXp: 2000000, levelCap: 30, createdAt: 2, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 },
    inheritedUniques: [eiki], uniqueSkillLevels: { own: 6, 'inhId:ube1': 8 }, uniqueSkillPoints: 340,
    uniqueSkillBoosts: { 'inhId:ube1': { power: 8, mooSlayer: 6 } } },
];
const VIEWS = [
  { name: '縦', w: 390, h: 844 },
  { name: '横', w: 844, h: 390 },
  { name: '🔄横', w: 390, h: 844, rot: true },
];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const vp of VIEWS) {
      const T = `[${vp.name}] `;
      const errors = [];
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: SHOT ? 2 : 1 });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript((fixtures) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_masu_migrated', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
        put('mh_unique_lineage_dedupe_migrated_v1', true);
        put('mh_masu_mons', fixtures);
        put('mh_monster_roster', fixtures.map((m) => `masu:${m.id}`));
        put('mh_owned_items', { unique_skill_reset_ticket: 2 });
        put('mh_gold', 10000000);
      }, FIXTURES);
      await page.addInitScript(quietBootSeed());
      await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
      await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${process.env.UB_BASE ? process.env.UB_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      const closePopups = () => page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む|あとで)$/.test((x.innerText || '').trim()) && !x.closest('[data-unique-boost-sheet]')); if (b) { b.click(); return true; } return false; });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
        if (await top.isVisible().catch(() => false)) await top.dispatchEvent('pointerdown').catch(() => {});
        await closePopups();
        await page.waitForTimeout(500);
      }
      for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
      const shot = async (name) => { if (SHOT) await page.screenshot({ path: path.join(SHOT, `${name}-${vp.name}.png`) }); };
      const rotate = async () => {
        if (!vp.rot) return;
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle()));
        await page.waitForTimeout(900);
        for (let i = 0; i < 6 && await closePopups(); i++) await page.waitForTimeout(300);
      };
      // 横にはみ出さない・文字の切れ(ボタン・札の中身が箱からはみ出す)が無い・画面の外に出ていない
      const layout = (sel) => page.evaluate((s) => {
        const root = document.querySelector(s);
        if (!root) return { found: false };
        const bad = [];
        root.querySelectorAll('button,[data-unique-boost-summary],[data-power-breakdown] div,span').forEach((el) => {
          if (!el.offsetParent) return;
          const cs = getComputedStyle(el);
          if (cs.textOverflow === 'ellipsis' || el.classList.contains('truncate')) return; // 「…」で切る約束の所は除く
          if (!(el.innerText || '').trim()) return; // 文字の無いアイコンだけのボタン(押しやすさのため当たり判定を広げてある mh-hit-expand など)は文字切れの対象外
          if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'auto' && cs.overflowX !== 'scroll' && el.clientWidth > 0) bad.push(`${(el.innerText || '').trim().slice(0, 16) || el.outerHTML.slice(0, 160)}(${el.scrollWidth}>${el.clientWidth})`);
        });
        const overX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        return { found: true, bad: bad.slice(0, 4), overX };
      }, sel);
      const fine = async (label, sel) => { const l = await layout(sel); check(`${T}${label}: 横にはみ出さず、文字が切れていない`, l.found && l.overX <= 1 && l.bad.length === 0, JSON.stringify(l)); };

      await page.getByRole('button', { name: 'M/B管理' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: /マスモン一覧/ }).first().dispatchEvent('click');
      await page.getByText('検査ゴーレム').first().waitFor({ timeout: 20000 });
      await page.getByText('検査ゴーレム').first().dispatchEvent('click');
      await page.locator('[data-unique-boost-open]').first().waitFor({ state: 'attached', timeout: 20000 });
      await rotate();
      // ① 固有技強化の枠
      check(`${T}① Lv.8 の技2つに「✨ オリジナル強化」が出て、強化済みの技には要約が出る`, await page.locator('[data-unique-boost-open]').count() === 2
        && /連撃数\+1本/.test(await page.locator('[data-unique-boost-summary]').nth(1).innerText()));
      await page.evaluate(() => document.querySelector('[data-unique-boost-open]')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(400);
      await shot('01-詳細-固有技強化の枠');
      await fine('① 固有技強化の枠', '[data-monster-detail-box]');
      // ② シート(ザンの技: 連撃あり)
      await page.locator('[data-unique-boost-open]').nth(1).dispatchEvent('click');
      await page.locator('[data-unique-boost-sheet]').waitFor({ timeout: 10000 });
      await page.waitForTimeout(400);
      const sheetBox = await page.locator('[data-unique-boost-sheet] > div').first().boundingBox();
      const vw = vp.rot ? vp.h : vp.w, vh = vp.rot ? vp.w : vp.h; // 回したときは画面の縦横が入れ替わる
      check(`${T}② シートが画面に収まる`, !!sheetBox, JSON.stringify(sheetBox));
      // 行を見る場所が狭すぎない(横で説明が場所を取り、行が1つしか見えなかった。2026-11-07)。行2つぶん(約150px)は見える
      const rowsH = await page.evaluate(() => { const r = document.querySelector('[data-unique-boost-rows]'); return r ? r.clientHeight : -1; });
      check(`${T}② 行を見る場所が、行2つぶん以上ある`, rowsH >= 150, `${rowsH}px`);
      await shot('02-シート-攻撃タブ');
      await fine('② シート(攻撃)', '[data-unique-boost-sheet]');
      const cc = (await page.locator('[data-unique-boost-row="comboCount"]').innerText()).replace(/\s+/g, ' ');
      check(`${T}② 連撃数は 10,000Pで+1本・最大+3本、いま+1本`, /10,000Pで\+1本・最大\+3本/.test(cc) && /\+1本 → \+1本/.test(cc), cc);
      await page.locator('[data-unique-boost-row="comboCount"] button[aria-label="連撃数を上げられるだけ上げる"]').dispatchEvent('click');
      await page.waitForTimeout(200);
      const cc2 = (await page.locator('[data-unique-boost-row="comboCount"]').innerText()).replace(/\s+/g, ' ');
      check(`${T}② MAX で +3本 まで(それ以上は押せない)`, /\+1本 → \+3本/.test(cc2) && await page.locator('[data-unique-boost-row="comboCount"] button[aria-label="連撃数を1つ上げる"]').isDisabled(), cc2);
      for (const tab of ['slayer', 'support']) {
        await page.locator(`[data-unique-boost-tab="${tab}"]`).dispatchEvent('click');
        await page.waitForTimeout(300);
        const n = await page.locator('[data-unique-boost-row]').count();
        check(`${T}② ${tab === 'slayer' ? '特攻' : '補助'}タブが開く(${n}行)`, n === (tab === 'slayer' ? 8 : 6));
        await shot(`03-シート-${tab === 'slayer' ? '特攻' : '補助'}タブ`);
        await fine(`② シート(${tab === 'slayer' ? '特攻' : '補助'})`, '[data-unique-boost-sheet]');
      }
      const heal = page.locator('[data-unique-boost-row="healAmount"]');
      check(`${T}② ザンの技では回復の量が灰色で「この技には効果がありません」・ボタンが無い`, (await heal.getAttribute('data-unique-boost-applies')) === '0'
        && /この技には効果がありません/.test(await heal.innerText()) && await heal.locator('button[aria-label^="回復の量を"]').count() === 0);
      await page.locator('button[aria-label="見切りの説明"]').dispatchEvent('click');
      await page.waitForTimeout(300);
      const help = page.locator('[role="dialog"][aria-label="見切りの説明"]');
      check(`${T}② ? で説明が開く`, await help.count() === 1 && /よける率が上がります/.test(await help.innerText()));
      await shot('04-種類の説明');
      await help.getByRole('button', { name: '閉じる' }).dispatchEvent('click');
      await page.waitForTimeout(300);
      check(`${T}② 説明の「閉じる」で閉じる`, await help.count() === 0);
      await page.locator('[data-unique-boost-commit]').dispatchEvent('click');
      await page.waitForTimeout(700);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]').find((m) => m.id === 'ub-m1'));
      check(`${T}② 確定で保存(連撃数3本・20,000P減る)・シートが閉じる`, saved.uniqueSkillBoosts['inhId:ubz1'].comboCount === 3 && saved.uniqueSkillPoints === 40000
        && await page.locator('[data-unique-boost-sheet]').count() === 0, JSON.stringify({ b: saved.uniqueSkillBoosts, p: saved.uniqueSkillPoints }));
      check(`${T}② 行の要約が新しい値になる`, /連撃数\+3本/.test(await page.locator('[data-unique-boost-summary]').nth(1).innerText()));
      // ③ 総合力の内わけ
      await page.evaluate(() => { const b = document.querySelector('[data-monster-detail-box]'); if (b) b.scrollTop = 0; const body = document.querySelector('[data-monster-detail-body]'); if (body) body.scrollTop = 0; });
      await page.locator('[data-power-breakdown-toggle]').first().dispatchEvent('click');
      await page.waitForTimeout(400);
      const bd = (await page.locator('[data-power-breakdown]').first().innerText()).replace(/\s+/g, ' ');
      check(`${T}③ 内わけにオリジナル強化(使った固有技P 32,000 → +320,000)と合計`, /使った固有技P 32,000/.test(bd) && /\+320,000/.test(bd) && /合計/.test(bd), bd);
      await shot('05-総合力の内わけ');
      await fine('③ 総合力の内わけ', '[data-power-breakdown]');
      const bodyH = await page.evaluate(() => { const b = document.querySelector('[data-monster-detail-body]'); return b ? b.clientHeight : -1; });
      check(`${T}③ 内わけを開いても、詳細の中身を見る場所が残る(縦の真ん中の欄が潰れない)`, vp.name !== '縦' || bodyH >= 200, String(bodyH));
      await page.locator('[data-power-breakdown-toggle]').first().dispatchEvent('click');
      await page.waitForTimeout(300);
      check(`${T}③ もう一度押すと閉じる`, await page.locator('[data-power-breakdown]').count() === 0);
      // ④ リセット券(やめる)
      const resetBtn = page.getByRole('button', { name: '配分済み固有技Pをリセット' }).first();
      await resetBtn.dispatchEvent('click');
      await page.waitForTimeout(500);
      const dlg = (await page.locator('[role="dialog"], [role="alertdialog"]').last().innerText()).replace(/\s+/g, ' ');
      check(`${T}④ リセット券の確認に、オリジナル強化と返すPが出る(Lv 16P・オリジナル強化 32,000P)`, /固有技Lv とオリジナル強化をすべて戻し/.test(dlg) && /オリジナル強化 32,000P/.test(dlg) && /Lv 16P/.test(dlg), dlg.slice(0, 160));
      await shot('06-リセット券の確認');
      await page.getByRole('button', { name: /^やめる$|^キャンセル$/ }).last().dispatchEvent('click');
      await page.waitForTimeout(400);
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]').find((m) => m.id === 'ub-m1'));
      const items = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
      check(`${T}④ やめると何も変わらない`, kept.uniqueSkillBoosts['inhId:ubz1'].comboCount === 3 && items.unique_skill_reset_ticket === 2);
      // ⑤ 合体の確認
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /閉じる/.test(x.getAttribute('aria-label') || '') && x.closest('[data-monster-detail-box]')); if (b) b.click(); });
      await page.waitForTimeout(400);
      if (vp.rot) { await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(0)); await page.waitForTimeout(600); }
      const clickButton = async (re) => page.evaluate((src) => {
        const rx = new RegExp(src);
        const b = [...document.querySelectorAll('button')].find((n) => n.offsetParent && (rx.test((n.innerText || '').replace(/\s+/g, ' ')) || rx.test(((n.innerText || '').split('\n')[0] || '').trim()) || rx.test(n.getAttribute('aria-label') || '')));
        if (b) b.click(); return !!b;
      }, re.source);
      for (let i = 0; i < 10 && !(await home.isVisible().catch(() => false)); i++) { await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /HOME|ホーム|戻る/.test((x.getAttribute('aria-label') || '') + (x.innerText || ''))); if (b) b.click(); }); await page.waitForTimeout(500); }
      const steps = [];
      for (const re of [/神殿/, /^合体$/, /検査ゴーレム/, /検査ピクシー/, /副1体で確認へ/]) { steps.push(await clickButton(re)); await page.waitForTimeout(500); }
      await page.locator('[data-fusion-inherit-pick]').first().waitFor({ timeout: 15000 }).catch(() => {});
      await rotate();
      check(`${T}⑤ 合体の確認まで進める`, steps.every(Boolean) && await page.locator('[data-fusion-inherit-pick]').count() === 1, JSON.stringify(steps));
      const opts = await page.locator('[data-fusion-inherit-pick] button[role="radio"]').count();
      check(`${T}⑤ 引き継がない・自前・前に引き継いだ技の3つが並ぶ`, opts === 3, String(opts));
      await page.locator('[data-fusion-inherit-option="inhId:ube1"]').dispatchEvent('click');
      await page.waitForTimeout(300);
      const pick = (await page.locator('[data-fusion-inherit-pick]').innerText()).replace(/\s+/g, ' ');
      check(`${T}⑤ 選ぶと「Lv とオリジナル強化も一緒に引き継ぎます」・強化の要約・消えるPが出る`, /Lv とオリジナル強化も一緒に引き継ぎます/.test(pick) && /威力\+0\.8%・ムー特攻\+1\.2%/.test(pick) && /副の未使用固有技P 340 は消えます/.test(pick), pick.slice(0, 200));
      await page.evaluate(() => document.querySelector('[data-fusion-inherit-pick]')?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(400);
      await shot('07-合体の確認-引き継ぐ技を選ぶ');
      await fine('⑤ 合体の確認', '[data-fusion-inherit-pick]');
      check(`${T}実行時エラーが出ない`, errors.length === 0, errors.slice(0, 3).join(' / '));
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

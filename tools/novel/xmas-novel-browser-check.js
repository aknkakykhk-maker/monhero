#!/usr/bin/env node
// クリスマスのミステリーノベル(台帳 r1126-022)を、実際のブラウザで通して遊ぶ。
//   node tools/novel/xmas-novel-browser-check.js
//   SHOT_DIR=docs/progress/xmas-novel を付けると、止め絵(縦・横・タブレット)を残す
//
//   ① openXmasNovel() でタイトルが開く(App の状態は使わない)
//   ② はじめから → タップで送る → 手がかりを手に入れる → 行動の選択・突きつけ(1回まちがえてから正解)・人を選ぶ → エンディングまで
//   ③ エンディングの記録に1つ増え、保存(mh_xmas_novel_v1)に見たエンディング・一発目の記録・読んだ印が残る。ほかのキーを書いていない
//   ④ とじると画面が片づく・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8961;
const SHOT_DIR = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : '';
let failed = 0;
const say = (m) => { if (process.env.NV_VERBOSE) console.log(`… ${m}`); };
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const ONLY = process.env.NV_ONLY || '';
// 本番の台本は長いので、通しで遊ぶのは仮の台本(SAMPLE.md)で。openXmasNovel の script に渡す(検査だけの引数)
const SAMPLE_SCRIPT = (() => { const b = require('./xmas-novel-build.js'); return b.parseScript(fs.readFileSync(path.join(ROOT, 'docs/progress/xmas-novel/SAMPLE.md'), 'utf8'), 'docs/progress/xmas-novel/SAMPLE.md'); })();
const CASES_ALL = [
  { label: '縦', viewport: { width: 390, height: 844 }, isMobile: true, shot: 'tate', full: true },
  { label: '横', viewport: { width: 844, height: 390 }, isMobile: true, shot: 'yoko' },
  { label: 'タブレット', viewport: { width: 820, height: 1180 }, isMobile: true, shot: 'tablet' },
];
const CASES = CASES_ALL.filter((c) => !ONLY || c.shot === ONLY);

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const vp of CASES) {
      const ctx = await browser.newContext({ viewport: vp.viewport, hasTouch: true, isMobile: vp.isMobile, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      // ①〜④は「期間の外」で見る。実際の時計に頼ると、開幕(11/28 10:00)のあとに落ちた(2026-11-28)。時計を開幕前にずらす(Date だけ)
      await page.addInitScript({ content: `(() => { const off = Date.parse('2026-11-27T13:05:00+09:00') - Date.now(); const RD = Date;
        class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
        D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      say(`${vp.label}: 読み込み`);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 30000 });
      const shot = async (name) => { if (!SHOT_DIR) return; fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, `${vp.shot}-${name}.jpg`), type: 'jpeg', quality: 80 }); };
      say(`${vp.label}: HOME に着いた`);
      const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort());

      // ①
      const opened = await page.evaluate((script) => { window.__nvScript = script; window.__nvClosed = 0; window.__nvPerfect = 0; const outside = openXmasNovel({ script, playerName: 'テスト' }); return { outside, opened: openXmasNovel({ script, force: true, playerName: 'テスト', onClose: () => { window.__nvClosed += 1; } }) }; }, SAMPLE_SCRIPT);
      await page.locator('[data-xmas-novel-title]').waitFor({ timeout: 8000 }).catch(() => {});
      check(`① ${vp.label}: 期間の外は開かず(false)、force で起動画面が開く`, opened.outside === false && opened.opened === true && await page.locator('[data-xmas-novel-title]').count() === 1);
      await shot('01-title');

      // ②
      await page.locator('[data-xmas-novel-new]').click();
      const seen = { clue: 0, present: 0, person: 0, action: 0, wrong: 0, chapter: 0, line: 0 };
      const shots = new Set();
      let ending = null;
      // 1手ごとに、画面の様子を1回で読む(ブラウザへの問い合わせを減らす)
      const look = () => page.evaluate(() => {
        const q = (s) => document.querySelector(s);
        const at = (s, a) => { const e = q(s); return e ? e.getAttribute(a) : null; };
        const root = q('[data-xmas-novel]');
        return { end: at('[data-xmas-novel-ending-card]', 'data-xmas-novel-ending-card'), sheet: at('[data-xmas-novel-sheet]', 'data-xmas-novel-sheet'),
          qid: at('[data-xmas-novel-question]', 'data-xmas-novel-question'), card: at('[data-xmas-novel-card]', 'data-xmas-novel-card'),
          got: !!q('[data-xmas-novel-got]'), who: (q('.mh-nv-name') || {}).textContent || '', panel: !!q('[data-xmas-novel-panel]'),
          scene: root && root.getAttribute('data-scene'), row: root && root.getAttribute('data-row') };
      });
      const tap = (sel) => page.evaluate((s) => { const e = document.querySelector(s); if (e) e.click(); return !!e; }, sel);
      const answerOf = (id) => page.evaluate((qid) => { for (const s of window.__nvScript.scenes) for (const r of s.rows) if (r.id === qid) return r.answer || []; return []; }, id);
      const tried = new Set();
      for (let i = 0; i < 400; i++) {
        const s = await look();
        if (i % 25 === 0) say(`${vp.label}: ${i}手目 ${s.scene} ${s.row}`);
        if (s.end) { ending = s.end; break; }
        if (await page.evaluate(() => !!document.querySelector('[data-xmas-novel-transit]'))) { seen.transit = (seen.transit || 0) + 1; if (!shots.has('transit')) { shots.add('transit'); if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${vp.shot}-03-transit.jpg`), type: 'jpeg', quality: 80 }); } }
        if (s.sheet === 'present') {
          seen.present++;
          if (vp.full && !shots.has('present')) { shots.add('present'); await shot('05-present'); }
          const answer = await answerOf(s.qid);
          const names = await page.locator('[data-xmas-novel-present]').evaluateAll((els) => els.map((e) => e.getAttribute('data-xmas-novel-present')));
          const wrong = names.find((n) => !answer.includes(n));
          const pick = wrong && !tried.has(s.qid) ? wrong : names.find((n) => answer.includes(n));
          if (pick === wrong) { seen.wrong++; tried.add(s.qid); }
          await tap(`[data-xmas-novel-present="${pick}"]`);
        } else if (s.sheet === 'person') {
          seen.person++;
          if (!shots.has('person')) { shots.add('person'); await shot('06-person'); }
          await tap(`[data-xmas-novel-person="${(await answerOf(s.qid))[0]}"]`);
        } else if (s.sheet === 'action') {
          seen.action++;
          if (!shots.has('action')) { shots.add('action'); await shot('04-action'); }
          await tap('[data-xmas-novel-option]');
        } else if (s.card) {
          if (s.card === 'chapter') { seen.chapter++; if (!shots.has('chapter')) { shots.add('chapter'); await shot('02-chapter'); } }
          await tap('[data-xmas-novel-card]');
        } else {
          if (s.got) { seen.clue++; if (!shots.has('clue')) { shots.add('clue'); await shot('03-clue'); } }
          if (s.who) seen.line++;
          if (await page.evaluate(() => !!document.querySelector('.mh-nv-fx.bleed'))) { seen.bleed = (seen.bleed || 0) + 1; if (!shots.has('bleed')) { shots.add('bleed'); if (SHOT_DIR) await page.screenshot({ path: path.join(SHOT_DIR, `${vp.shot}-16-bleed.jpg`), type: 'jpeg', quality: 80 }); } }
          if (await page.evaluate(() => !!document.querySelector('[data-xmas-novel-fallen]'))) { seen.fallen = (seen.fallen || 0) + 1; if (!shots.has('fallen')) { shots.add('fallen'); await shot('17-fallen'); } }
          if (s.panel && !shots.has('panel')) { shots.add('panel'); await shot('03-panel'); }
          if (vp.full && s.who === 'ソラシド' && !shots.has('line')) { shots.add('line'); await tap('.mh-nv-stage'); await shot('03-line'); }
          await tap('.mh-nv-stage');
        }
        await page.waitForTimeout(40);
      }
      check(`② ${vp.label}: 最後のエンディングまで通して読めた`, !!ending, ending || '着かなかった');
      check(`② ${vp.label}: 章の札・台詞・手がかり・行動の選択・突きつけ(まちがい1回)・人を選ぶ・外側からゲームの中への切り替え・赤いにじみ・倒れた影が出た`, seen.chapter > 0 && seen.line > 0 && seen.clue > 0 && seen.action > 0 && seen.present > 0 && seen.wrong > 0 && seen.person > 0 && seen.transit > 0 && seen.bleed > 0 && seen.fallen > 0, JSON.stringify(seen));
      await shot('07-ending');

      // ③
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_xmas_novel_v1') || 'null'));
      check(`③ ${vp.label}: 保存に見たエンディング・一発目の記録・読んだ印が残る`, !!saved && saved.v === 1 && saved.endings.includes(ending) && Object.keys(saved.first || {}).length > 0 && saved.read.length > 10,
        saved ? `endings=${saved.endings} first=${Object.keys(saved.first).length} read=${saved.read.length}` : 'null');
      const keysAfter = await page.evaluate(() => Object.keys(localStorage).sort());
      // 裏で動くゲーム本体が書くキー(ノベルと関係ない)は数えない。クリスマス・ノベルの名前のキーだけ見る
      const added = keysAfter.filter((k) => !keysBefore.includes(k) && /^mh_.*(xmas|novel)/.test(k));
      check(`③ ${vp.label}: 新しく書いたクリスマスのキーは mh_xmas_novel_v1 と分岐の地図の mh_xmas_novel_route_v1(r1126-102)だけ`, added.every((k) => k === 'mh_xmas_novel_v1' || k === 'mh_xmas_novel_route_v1'), added.join(','));
      await page.locator('[data-xmas-novel-to-title]').click();
      await page.locator('[data-xmas-novel-endings]').click();
      const seenList = await page.locator('[data-xmas-novel-ending][data-seen]').count();
      const atText = await page.locator('[data-xmas-novel-ending-at]').first().innerText().catch(() => '');
      check(`③ ${vp.label}: エンドヒストリーに、見たものだけ名前と日時が出る(見ていないのは？？？)`, seenList === 1 && /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/.test(atText), `見た ${seenList} 日時 ${atText}`);
      await shot('08-ending-list');

      // ③-2 エンディングの記録から見返す(カーテンコールまで)。幕が下りる/上がる演出が出て、保存は変わらない
      const before = await page.evaluate(() => localStorage.getItem('mh_xmas_novel_v1'));
      await tap(`[data-xmas-novel-replay="${ending}"]`);
      let curtainSeen = 0; let replayEnd = null;
      for (let i = 0; i < 120; i++) {
        const s = await look();
        if (await page.evaluate(() => !!document.querySelector('[data-xmas-novel-curtain]'))) { curtainSeen++; if (curtainSeen === 1) await shot('12-curtain'); }
        if (s.end) { replayEnd = s.end; break; }
        if (s.card) await tap('[data-xmas-novel-card]'); else await tap('.mh-nv-stage');
        await page.waitForTimeout(120);
      }
      const after = await page.evaluate(() => localStorage.getItem('mh_xmas_novel_v1'));
      check(`③ ${vp.label}: 記録から見返すと、カーテンコールまで流れて幕が出る`, replayEnd === ending && curtainSeen > 0, `end=${replayEnd} 幕=${curtainSeen}`);
      check(`③ ${vp.label}: 見返しでは保存が変わらない`, before === after);
      await tap('[data-xmas-novel-to-endings]');
      await page.waitForTimeout(300);

      // ④
      await page.locator('[data-xmas-novel-close]').click();
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => ({ n: window.__nvClosed, host: document.querySelectorAll('[data-xmas-novel-host]').length }));
      check(`④ ${vp.label}: とじると片づく`, closed.n === 1 && closed.host === 0, JSON.stringify(closed));
      check(`④ ${vp.label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
    // ⑤ イベントページの物語タブからの入口(時計をずらす)。11/27 13:00 からは序章だけ・本編は「11/28 10:00 から」/ 11/28 10:05 は「事件簿を開く」で起動画面が開く
    if (!ONLY || ONLY === 'tate') for (const [iso, open] of [['2026-11-27T13:05:00+09:00', false], ['2026-11-28T10:05:00+09:00', true]]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript({ content: `(() => { const off = Date.parse(${JSON.stringify(iso)}) - Date.now(); const RD = Date;
        class D extends RD { constructor(...a) { if (a.length === 0) super(RD.now() + off); else super(...a); } static now() { return RD.now() + off; } }
        D.parse = RD.parse; D.UTC = RD.UTC; window.Date = D; })();` });
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false); put('mh_first_battle_done_v1', true);
      });
      await page.addInitScript(seeds.eventStorySeed()); await page.addInitScript(seeds.updateNoticeSeed()); await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.waitForTimeout(4000);
      for (let i = 0; i < 8; i++) {
        const btn = page.getByRole('button', { name: /受け取る|閉じる|(?:始|はじ)める|OK/ }).first();
        if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
        await btn.dispatchEvent('click').catch(() => {});
        await page.waitForTimeout(250);
      }
      const entry = page.locator('[data-home-xmas-entry]').first();
      await entry.waitFor({ timeout: 15000 }).catch(() => {});
      await entry.dispatchEvent('click').catch(() => {});
      await page.locator('[data-xmas-story]').waitFor({ timeout: 10000 }).catch(() => {});
      const st = await page.evaluate(() => ({ btn: document.querySelectorAll('[data-xmas-novel-open]').length, soon: /本編は 11\/28/.test((document.querySelector('[data-xmas-story]') || {}).textContent || '') ? 1 : 0,
        prologue: document.querySelectorAll('[data-xmas-story-chapter="xs00"]').length, ch1: document.querySelectorAll('[data-xmas-story-chapter="xs01"]').length }));
      const label = open ? '⑤ 11/28 10:05' : '⑤ 11/27 13:05';
      if (open) {
        check(`${label}: 物語タブに「事件簿を開く」と序章の読み返しがある(毎日の話の行は無い)`, st.btn === 1 && st.prologue === 1 && st.ch1 === 0, JSON.stringify(st));
        if (SHOT_DIR) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, 'tate-20-storytab-open.jpg'), type: 'jpeg', quality: 80 }); }
        await page.locator('[data-xmas-novel-open]').dispatchEvent('click');
        await page.locator('[data-xmas-novel-title]').waitFor({ timeout: 8000 }).catch(() => {});
        check(`${label}: 押すと事件簿の起動画面が開く`, await page.locator('[data-xmas-novel-title]').count() === 1);
      } else {
        check(`${label}: 開幕までは本編の入口を出さず「本編は 11/28 10:00 から」と序章だけ`, st.btn === 0 && st.soon === 1 && st.prologue === 1, JSON.stringify(st));
        if (SHOT_DIR) { await page.waitForTimeout(500); await page.screenshot({ path: path.join(SHOT_DIR, 'tate-21-storytab-preopen.jpg'), type: 'jpeg', quality: 80 }); }
      }
      check(`${label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `NG ${failed} 件` : 'OK: ノベルを通して遊べる');
  process.exit(failed ? 1 : 0);
})();

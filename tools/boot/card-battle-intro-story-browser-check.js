#!/usr/bin/env node
// お話「MFバトルカード ～物置の古い箱～」(card_battle_intro_2026・2026-10-24)を、実際のブラウザで最後まで流す。
// あつは、解放した人にだけ出る(atsu の印・eventScriptForPlayer)。きゅうこは最初から選べるので、いつも出る(台帳 #53)。台本: docs/playbot/reports/2026-10-24/card-battle-intro/story.md
//
//   node tools/boot/card-battle-intro-story-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、2通りそれぞれの写真を残す
//   SHOT_LINES=0,4,15 のように行(0から)を並べると、その行ごとに撮る(ファイル名に行の番号が付く)
//
//   あつの加入のお話を「見た/まだ」の2通りで起動し、デバッグ設定の「全ストーリーを確認」から再生する
//   (きゅうこはいつも出る。分かれが無いことは card-battle-intro-story-check.js が見る)
//   ① 最後まで送れて、行の数が台本どおり(2通りで違う)
//   ② 解放していない子は一度も出ない(名前・セリフのどこにも)。その子の代わりの行が出る
//   ③ 解放した子のセリフが出て、代わりの行は出ない
//   ④ 再生しても保存は何も変わらない(デバッグから見ても見た印を立てない・入口の印 mh_story_card_battle_seen_v1 も書かない)・実行時エラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8937;
const SHOT_DIR = process.env.SHOT_DIR || '';
const SHOT_LINES = (process.env.SHOT_LINES || '').split(',').filter((x) => /^\d+$/.test(x)).map(Number);
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
// お話ごとの行の数(解放あり・なし)と、写真を撮る行(0から)と、その行に出るはずの文
const STORY = { id: 'card_battle_intro_2026', shot: 9 };
// 4通りの行の数と、出るはずの文(あり)・代わりの文(なし)
const CASES = [{ atsu: true, kyuko: true, lines: 49 }, { atsu: false, kyuko: true, lines: 41 }];
const TEXT = {
  atsu: { on: 'モンスター甲子園にも出たことあるよ', off: 'ドラちゃんだけ知ってるの、ずるい' },
  kyuko: { on: 'もう組み方考えちゃってる', off: 'デッキの組み方なら任せて' },
};
const JOIN = { atsu: 'atsu_join_2026_10_22', kyuko: 'kyuko_join_2026_10_22' };
(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const seed = eventStorySeed();
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const cs of CASES) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.route(/supabase\.co/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
        put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      });
      await page.addInitScript(seed);
      // 解放あり … その子の加入のお話を見たことにする / 解放なし … 見ていないことにする(ほかの既読はそのまま)
      await page.addInitScript(([key, add, drop]) => {
        try {
          const list = JSON.parse(localStorage.getItem(key) || '[]').filter((id) => !drop.includes(id));
          localStorage.setItem(key, JSON.stringify([...list, ...add]));
        } catch (e) { /* 検査の種が壊れていたら、本体の既定に任せる */ }
      }, [(fs.readFileSync(path.join(ROOT, 'monster-hero/src/game-system.jsx'), 'utf8').match(/const RHYTHM_EVENT_STORY_KEY = '([^']+)'/) || [])[1],
        ['atsu', 'kyuko'].filter((k) => cs[k]).map((k) => JOIN[k]), Object.values(JOIN)]);
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
      for (let i = 0; i < 8; i++) {
        const b = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK|スキップ/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await page.waitForTimeout(300);
      }
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      const keysBefore = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay|card/i.test(k)))));
      const listBtn = page.locator('[data-debug-story-list]');
      await listBtn.evaluate((el) => { let p = el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; } });
      await listBtn.dispatchEvent('click');
      await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
      const label = `あつ${cs.atsu ? 'あり' : 'なし'}・きゅうこ${cs.kyuko ? 'あり' : 'なし'}`;
      {
        const st = STORY;
        await page.locator(`[data-debug-story-item="${st.id}"]`).dispatchEvent('click');
        const dlg = page.locator('[role="dialog"][aria-label^="イベント回想"]');
        await dlg.waitFor({ timeout: 10000 });
        const texts = [];
        for (let i = 0; i < 200; i++) {
          if (await dlg.count() === 0) break;
          texts.push(await dlg.innerText());
          const many = SHOT_LINES.length > 0;
          if (SHOT_DIR && (many ? SHOT_LINES.includes(i) : i === st.shot)) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOT_DIR, `${st.id}-${label}${many ? `-${String(i + 1).padStart(2, '0')}` : ''}.png`) }); }
          await dlg.locator('button[aria-label="次へ"]').dispatchEvent('click').catch(() => {});
          await page.waitForTimeout(40);
        }
        // 行の数は画面の「◯ / ◯」で数える
        const steps = texts.map((t) => (/(\d+)\s*\/\s*(\d+)/.exec(t) || []).slice(1).map(Number)).filter((x) => x.length === 2);
        const total = steps.length ? steps[0][1] : 0, seen = new Set(steps.map((x) => x[0]));
        check(`① ${label}: 最後まで送れて、${cs.lines}行`, total === cs.lines && seen.size === cs.lines && seen.has(cs.lines), `全部で ${total}行・見た行 ${seen.size}`);
        const all = texts.join('\n');
        for (const k of ['atsu', 'kyuko']) {
          const name = k === 'atsu' ? 'あつ' : 'きゅうこ';
          if (cs[k]) check(`③ ${label}: ${name}のセリフが出て、代わりの行は出ない`, all.includes(TEXT[k].on) && !all.includes(TEXT[k].off));
          else check(`② ${label}: ${name}が一度も出ない・代わりの行が出る`, !all.includes(name) && all.includes(TEXT[k].off), (all.match(new RegExp(`.{0,12}${name}.{0,12}`)) || [''])[0]);
        }
        await page.locator('[data-debug-story-overlay]').waitFor({ timeout: 10000 });
      }
      const keysAfter = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => /story|seen|replay|card/i.test(k)))));
      check(`④ ${label}: 再生しても保存は変わらない・実行時エラーが無い`, keysBefore === keysAfter && errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();

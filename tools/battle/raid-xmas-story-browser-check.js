#!/usr/bin/env node
// クリスマスのレイド「もうひとつの聖夜」のお話(raid_xmas_story_*・r1126-026)が、HOME で流れるかを実際のブラウザで見る。
//   node tools/battle/raid-xmas-story-browser-check.js
//   SHOT_DIR=<フォルダ> を付けると、黒羽・白瀬が話す止め絵を残す
//
//   ① 11/29 10:00(レイドの開始より前): HOME に着いても、レイドのお話は流れない
//   ② 11/30 10:05(開始のあと): HOME に着くと導入(raid_xmas_story_1b)が流れ、黒羽・白瀬が顔つきで話す。
//      最後までめくると「見た」の印が会話の既読キーに残り、ほかの話(段階のあと)は合計が取れないあいだ流れない
//   共有の合計(Supabase)は空の返事にしてある(本番の表には触らない)
const http = require('http'), path = require('path'), fs = require('fs');
const seeds = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8973;
const SHOT_DIR = process.env.SHOT_DIR ? path.resolve(process.env.SHOT_DIR) : '';
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const RAID_IDS = ['raid_xmas_story_1b', 'raid_xmas_story_2', 'raid_xmas_story_3', 'raid_xmas_story_4', 'raid_xmas_story_5', 'raid_xmas_story_6', 'raid_xmas_ending_cleared', 'raid_xmas_ending_notcleared'];
const STORY_KEY = seeds.eventStoryKey();

(async () => {
  let chromium;
  try { ({ chromium } = require(path.join(ROOT, 'tools', 'node_modules', 'playwright'))); } catch (e) { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const server = await serve();
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const [iso, open] of [['2026-11-29T10:00:00+09:00', false], ['2026-11-30T10:05:00+09:00', true]]) {
      const label = open ? '② 11/30 10:05' : '① 11/29 10:00';
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
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
      // レイドのお話だけは「まだ見ていない」にする(ほかのお話・案内は見たことにして、HOME で先に出ないようにする)
      await page.addInitScript(seeds.eventStorySeed({ except: RAID_IDS })); await page.addInitScript(seeds.updateNoticeSeed());
      await page.addInitScript(seeds.loginBonusDoneSeed()); await page.addInitScript(seeds.oneTimeNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
      await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
      // 見回りは HOME に着いてから回る。お話が出るまで待つ(出ないはずの時刻は少し待って確かめる)
      let storyId = null;
      for (let i = 0; i < (open ? 40 : 16); i++) {
        await page.waitForTimeout(500);
        storyId = await page.evaluate(() => (document.querySelector('[data-event-story]') || { getAttribute: () => null }).getAttribute('data-event-story'));
        if (storyId) break;
        const btn = page.getByRole('button', { name: /受け取る|閉じる|OK/ }).first();
        if (await btn.count() && await btn.isVisible().catch(() => false)) await btn.dispatchEvent('click').catch(() => {});
      }
      if (!open) {
        check(`${label}: レイドのお話は流れない`, !RAID_IDS.includes(storyId), String(storyId));
      } else {
        check(`${label}: HOME で導入(raid_xmas_story_1b)が流れる`, storyId === 'raid_xmas_story_1b', String(storyId));
        // 最後までめくる。黒羽・白瀬が話す行で、顔の絵が出ているかを見る
        const speakers = new Set(); let faceOk = { kuroba: false, shirase: false }; let shot = 0;
        for (let i = 0; i < 200; i++) {
          const st = await page.evaluate(() => {
            const root = document.querySelector('[data-event-story]');
            if (!root) return null;
            const imgs = [...root.querySelectorAll('img')].map((im) => ({ src: im.getAttribute('src') || '', ok: im.complete && im.naturalWidth > 0 }));
            return { text: root.textContent || '', imgs };
          });
          if (!st) break;
          for (const [id, name] of [['kuroba', '黒羽'], ['shirase', '白瀬']]) {
            const im = st.imgs.find((x) => x.src.includes(`story-guests/${id}_face.png`));
            if (im) { speakers.add(name); if (im.ok) faceOk[id] = true; if (SHOT_DIR && shot < 2 && st.text.includes(name)) { fs.mkdirSync(SHOT_DIR, { recursive: true }); await page.screenshot({ path: path.join(SHOT_DIR, `raid-xmas-story-${id}.jpg`), type: 'jpeg', quality: 80 }); shot++; } }
          }
          const next = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-event-story] button')].find((x) => /^(次へ|閉じる|とじる|おわる|終わる)$/.test(x.textContent.trim())); if (b) { b.click(); return true; } return false; });
          if (!next) { await page.mouse.click(195, 600); }
          await page.waitForTimeout(140);
        }
        check(`${label}: 黒羽・白瀬が顔の絵つきで話す`, faceOk.kuroba && faceOk.shirase, JSON.stringify(faceOk));
        await page.waitForTimeout(800);
        const seen = await page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } }, STORY_KEY);
        check(`${label}: 最後まで見ると「見た」の印が残る`, Array.isArray(seen) && seen.includes('raid_xmas_story_1b'));
        // 段階の合計が取れない(空)あいだは、次のお話は並ばない
        await page.waitForTimeout(3000);
        const again = await page.evaluate(() => (document.querySelector('[data-event-story]') || { getAttribute: () => null }).getAttribute('data-event-story'));
        check(`${label}: 段階をまだ倒していなければ、次のお話は流れない`, !RAID_IDS.includes(again), String(again));
      }
      check(`${label}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await ctx.close();
    }
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `\nNG ${failed} 件` : '\nOK: クリスマスのレイドのお話が開始のあと HOME で流れる');
  process.exit(failed ? 1 : 0);
})();

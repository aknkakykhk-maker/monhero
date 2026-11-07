// HOME の助手の顔の列と施設の札を、いろいろな端末の大きさで開いて確かめる(2026-11-07 社長「顔は小さく・施設の札のすぐ下に横1列」
//   「まだまだ仕上がりが甘すぎるからちゃんと検査しながらすすめて」)。
//   node tools/assistant/assistant-life-home-layout-check.js            検査(手元の配信)
//   node tools/assistant/assistant-life-home-layout-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/shots/home-faces-*.png)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
// 見ること(どの大きさでも):
//   ・会った助手8人の顔が全部出る
//   ・顔の列は、どの札でも札(名前)の下にあり、札・ほかのボタン・画面の端に重ならない(横へ逃がさない)
//   ・施設の札どうし・みゅあの吹き出しと札が重ならない。吹き出しの台詞が長いときも(横 667×375 で M/B管理とモンヒロビートが重なった)
// 大きさ: 縦 390×844・390×664(iPhone の Safari)・375×667・320×568 / 横 844×390・667×375 / 🔄横(モンヒロビートで回してから戻る)390×844・375×667
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9233;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk, homeFacesProblems, waitFaces } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = [
  { id: 'p390x844', name: '縦 390×844', w: 390, h: 844 },
  { id: 'p390x664', name: '縦 390×664', w: 390, h: 664 },
  { id: 'p375x667', name: '縦 375×667', w: 375, h: 667 },
  { id: 'p320x568', name: '縦 320×568', w: 320, h: 568 },
  { id: 'l844x390', name: '横 844×390', w: 844, h: 390 },
  { id: 'l667x375', name: '横 667×375', w: 667, h: 375 },
  { id: 'r390x844', name: '🔄横 390×844', w: 390, h: 844, rot: true },
  { id: 'r375x667', name: '🔄横 375×667', w: 375, h: 667, rot: true },
];
// 吹き出しを、HOME で出うるいちばん長いくらいの台詞にする(助手の台詞は切らずに全部出すので、伸びたぶん札が動く)
//   (いま HOME で出る台詞でいちばん長いのは、MFバトルカードの告知の66文字)
const LONG = 'トーナメントでも総当たりでもいいし、来られなくても登録したデッキが代わりに戦ってくれるんだ♪ 仲間を呼んで、表が光るところ見てみて〜';

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  let server = null;
  if (!process.env.LIFE_BASE) {
    server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
    });
    await new Promise(r => server.listen(PORT, r));
  }
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const T = `[${v.name}] `;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed());
      await page.addInitScript(updateNoticeSeed());
      await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      // 🔄横: HOME は回して描かない(モンヒロビートを出ると回転を戻す)。モンヒロビートで🔄横にしてから戻り、回転が戻って顔が札の下にあるかを見る
      if (v.rot) {
        await waitFaces(page);
        await page.locator('.mh-home-facility.rhythm').click({ timeout: 10000 });
        await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 });
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(900);
        await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 });
        await page.locator('.mh-home-player').waitFor({ timeout: 15000 });
        check(`${T}モンヒロビートで🔄横にしたまま HOME へ戻っても、HOME は回さずに描く`, await page.evaluate(() => !RHYTHM_VIEW_ROTATION.active()));
      }
      await waitFaces(page);
      await page.waitForTimeout(1600); // 顔は 0.7秒ごとに札を測り直す
      await finishTalk(page); await page.waitForTimeout(800); // 流れてきた掛け合い(特別なお話など)は読み終えてから見る
      const n = await page.locator('[data-assistant-life-home-face]').count();
      check(`${T}会った助手8人の顔が全部出る`, n === 8, `${n}人`);
      { const ng = await homeFacesProblems(page); check(`${T}顔の列は札の下にあり、札・ボタン・画面の端に重ならない/札どうしも重ならない`, ng.length === 0, ng.slice(0, 6).join(' / ')); }
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `home-faces-${v.id}.png`) });
      // 吹き出しを長くする
      const grew = await page.evaluate((t) => { const el = document.querySelector('.mh-home-assistant [data-bubble-text]'); if (!el) return false; el.textContent = t; window.dispatchEvent(new Event('resize')); return true; }, LONG);
      await page.waitForTimeout(1800);
      { const ng = await homeFacesProblems(page); check(`${T}吹き出しの台詞が長くても、札・顔が重ならない`, grew && ng.length === 0, grew ? ng.slice(0, 6).join(' / ') : '吹き出しの文字が見つからない'); }
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `home-faces-${v.id}-long.png`) });
      check(`${T}実行時エラーがない`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();

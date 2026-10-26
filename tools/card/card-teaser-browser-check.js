// MFバトルカードの公開前の予告(社長 2026-10-25「近日公開みたいな感じでホームに出して」)を、実際のブラウザで確かめる。
//
//   node tools/card/card-teaser-browser-check.js
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-teaser-browser-check.js   HOME の札と予告の小窓の写真も撮る
//   CARD_VIEWPORT=844x390 … 画面の大きさ(既定 390x844)
//
// 見ているもの(ふつうのプレイヤー = デバッグの合言葉の印が無い端末)
//   ① HOME に「MFバトルカード 近日公開」の札が出る。ふつうの入口(押すと中へ入るもの)は出ない
//   ② 札を押すと予告の小窓が出る。絵(更新履歴の予告と同じ)が読めて、「近日公開」と本文が出る。閉じられる
//   ③ 押しても中の画面(CARD_*)へは入らない。カードの保存(mh_card_*)を1つも書かない
//   ④ 更新履歴に「新コンテンツ『MFバトルカード』近日公開」が出ている
// (デバッグの人)
//   ⑤ 合言葉の端末では、予告の札ではなく、いままでどおり中へ入れる入口が出る
// (作り)
//   ⑥ 公開の印(RELEASE_FLAGS.cardBattle)を立てたら、予告の札が下りてふつうの入口に替わる式になっている
// (公開したあと。2026-10-26 社長「公開する」で印を立てた)
//   ①〜④ は公開前だけの見た目なので、印が立っているときは代わりに次を見る
//   ①' ふつうのプレイヤーの HOME に予告の札が出ず、中へ入れる入口が出る(公開のお話は見たことにして開く)
const http = require('http');
const path = require('path');
const fs = require('fs');
const quiet = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9003;
const SHOT = process.env.CARD_SHOT_DIR || '';
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

// 公開の印(17-release-changelog-login-missions.jsx の RELEASE_FLAGS.cardBattle)
const RELEASED = /^\s*cardBattle:\s*true\b/m.test(fs.readFileSync(path.join(root, 'monster-hero/src/parts/17-release-changelog-login-missions.jsx'), 'utf8'));
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const fatal = [];
  const open = async (debug) => {
    const context = await browser.newContext({ viewport: { width: VW, height: VH } });
    const page = await context.newPage();
    page.on('pageerror', (e) => fatal.push(e.message));
    await page.addInitScript((dbg) => {
      if (sessionStorage.getItem('__teaserSeeded')) return;
      sessionStorage.setItem('__teaserSeeded', '1');
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
      if (dbg) localStorage.setItem('mh_debug_unlocked_v1', '1');
    }, debug);
    await page.addInitScript(quiet.eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 60000 }).catch(() => {});
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('TAP TO START'))?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2200);
    await page.evaluate(() => document.querySelector('button[aria-label="トップ画面へ進む"]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.waitForTimeout(2500);
    // 起動直後の助手の告知(この予告の告知も含む)・ログインボーナスなどを閉じる
    // ★助手のお知らせ(まとめ)は、ログインボーナスの窓を閉じたあとに出る。閉じていく途中で、この予告が出ているかを見る(写真を撮るときは「くわしく」も開く)
    let noticeSeen = false;
    for (let i = 0; i < 24; i++) {
      if (!debug && !noticeSeen && await page.evaluate(() => (document.body.innerText || '').includes('新コンテンツ「MFバトルカード」近日公開'))) {
        noticeSeen = true;
        if (SHOT) {
          fs.mkdirSync(SHOT, { recursive: true });
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(SHOT, 'notice-list.png') }).catch(() => {});
          await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === 'くわしく'); if (b) b.click(); });
          await page.waitForTimeout(1500);
          await page.screenshot({ path: path.join(SHOT, 'notice-detail.png') }).catch(() => {});
        }
      }
      const clicked = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|OK|スキップ|あとで|あとで読む|次へ)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; });
      if (!clicked && await page.evaluate(() => !!document.querySelector('.mh-home-scene') && !document.querySelector('[role="dialog"]'))) break;
      await page.waitForTimeout(600);
    }
    if (!debug && !RELEASED) check('④ 起動直後の助手のお知らせに、予告が出る', noticeSeen);
    return { context, page };
  };
  const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
  try {
    // ---- ふつうのプレイヤー ----
    let { context, page } = await open(false);
    if (RELEASED) {
      console.log('-- 公開の印が立っているので、公開前の予告(①〜④)の代わりに公開後の HOME を見る');
      check("①' 公開後: ふつうのプレイヤーの HOME に予告の札は出ず、中へ入れる入口が出る", (await page.locator('[data-home-card-battle-teaser]').count()) === 0 && (await page.locator('[data-home-card-battle]').count()) === 1);
      await shot(page, 'released-home');
    } else {
    const cardKeys = () => page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('mh_card_')));
    const keysBefore = await cardKeys();
    const teaser = page.locator('[data-home-card-battle-teaser]');
    check('① HOME に「MFバトルカード 近日公開」の札が出る', (await teaser.count()) === 1 && /近日公開/.test(await teaser.innerText()), await teaser.innerText().catch(() => 'なし'));
    check('① ふつうの入口(中へ入るもの)は出ない', (await page.locator('[data-home-card-battle]').count()) === 0);
    await page.waitForTimeout(600);
    await shot(page, 'teaser-home');
    await teaser.click();
    await page.waitForSelector('[data-card-teaser]', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
    const modal = await page.evaluate(() => {
      const el = document.querySelector('[data-card-teaser]');
      if (!el) return null;
      const img = el.querySelector('img');
      return { text: (el.innerText || '').replace(/\s+/g, ' '), img: img ? { ok: img.complete && img.naturalWidth > 0, src: img.getAttribute('src') } : null };
    });
    check('② 札を押すと予告の小窓が出て、絵(更新履歴の予告と同じ)が読める', !!modal && !!modal.img && modal.img.ok && /card-battle-teaser\.jpg\?v=/.test(modal.img.src), JSON.stringify(modal && modal.img));
    check('② 小窓に「MFバトルカード」「近日公開」と本文が出る', !!modal && /MFバトルカード/.test(modal.text) && /近日公開/.test(modal.text) && /スターターキット/.test(modal.text), modal ? modal.text.slice(0, 80) : 'なし');
    await shot(page, 'teaser-modal');
    await page.click('[data-card-teaser-close]');
    await page.waitForTimeout(400);
    check('② 「閉じる」で小窓が閉じ、HOME のまま', !(await page.locator('[data-card-teaser]').count()) && await page.evaluate(() => !!document.querySelector('.mh-home-scene')));
    check('③ 中の画面(MFバトルカードのトップなど)へは入らない', !(await page.evaluate(() => !!document.querySelector('[data-card-top],[data-card-battle]'))));
    const keysAfter = await cardKeys();
    check('③ カードの保存(mh_card_*)を1つも書かない', keysBefore.length === 0 && keysAfter.length === 0, keysAfter.join(','));
    const listed = await page.evaluate(() => (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []).some((e) => e && /MFバトルカード/.test(e.title || '') && /近日公開/.test(e.title || '') && e.assistantNotice && e.assistantNotice.type === 'content'));
    check('④ 更新履歴に「新コンテンツ『MFバトルカード』近日公開」があり、助手の告知(content)が付いている', listed);
    }
    await context.close();
    // ---- デバッグの人 ----
    ({ context, page } = await open(true));
    check('⑤ 合言葉の端末では、予告の札ではなく中へ入れる入口が出る', (await page.locator('[data-home-card-battle]').count()) === 1 && (await page.locator('[data-home-card-battle-teaser]').count()) === 0);
    await context.close();
    // ---- 作り ----
    const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
    check('⑥ 公開の印を立てたら、予告の札が下りてふつうの入口に替わる式になっている',
      app.includes('cardBattleTeaser={!EVENT_REPLAY_RELEASE_FLAGS.cardBattle&&!cardBattleDebugHome}')
      && app.includes('cardBattleVisible={(EVENT_REPLAY_RELEASE_FLAGS.cardBattle&&cardBattleIntroSeenFlag)||cardBattleDebugHome}'));
    check('どこでも実行時エラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } catch (e) {
    check('途中で止まらずに最後まで進む', false, String(e && e.message || e).split('\n')[0]);
  } finally {
    await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

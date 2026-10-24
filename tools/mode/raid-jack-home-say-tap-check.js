// HOMEのジャックのひとこと(吹き出し)が、どこを押しても「つぎ」へ進むかを実際のブラウザで確かめる(2026-10-11・社長の実機の指摘)。
//
//   node tools/mode/raid-jack-home-say-tap-check.js
//   RAID_SAY_SHOT_DIR=docs/proto/raid-bubble-tap node tools/mode/raid-jack-home-say-tap-check.js   静止画も撮る
//
// iPhone縦で吹き出しがジャックの右(神殿とマーケットのあいだ)に置かれると、施設の透明な押し場所が吹き出しの上にかぶり、
// 「▶ つぎ」を押すと施設が開いていた。画面の大きさごとにセリフを何周か送り、そのたびに次を確かめる。
//   ① 吹き出しの中を格子状に測り、どの点でもいちばん上にあるのが吹き出し(elementFromPoint)
//   ② 「▶ つぎ」を実際に押す(マウスの位置で押すので、上にかぶったものがあればそちらが反応する)とセリフが進み、HOMEのまま
//   ③ HOMEのほかのボタン(施設の札・ミッション・ギフト・更新履歴・みゅあ)の真ん中は、そのボタン自身が押せる(ジャックがふさがない)
//   ④ 施設の押せる範囲は、見えている札とそのまわり8pxだけ(札の外4pxは押せる・札の外14pxは押せない・高さ44px以上)。
//      以前は建物ぶんの透明な箱が押し場所で、札の外の何もない所でも施設が開いていた
// 通信はすべて差し替える(Supabaseへは出ない)。
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8994;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };

const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const SIZES = [[390, 844], [360, 640], [430, 932], [320, 568], [844, 390], [667, 375]];   // 320×568 は背の低い端末の位置替え(max-height:620)も通る
const LINES_PER_SIZE = 6;

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const SHOT = process.env.RAID_SAY_SHOT_DIR || '';
  if (SHOT) fs.mkdirSync(SHOT, { recursive: true });
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.clock.install({ time: new Date('2026-10-04T12:00:00+09:00') });
    await page.clock.resume();
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_rhythm_tutorial_seen_v1', JSON.stringify(true));
      // HELL の公開(2026-10-13)後は、HOME に着くと HELL のお話と説明が一度だけ流れる。検査では見たことにしておく
      localStorage.setItem('mh_rhythm_hell_story_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      localStorage.setItem('mh_unlocked_monsters', JSON.stringify(['Mocchi', 'Mitarashi', 'Pixie', 'Mia', 'Pandora', 'Suezo']));
      window.__mhSupabaseStubbed = true;
    });
    await page.addInitScript(eventStorySeed());
    // 通信はすべて差し替える。レイドの合計だけ「段階2が挑戦中」を返す
    await page.route(/supabase\.co|\/rest\/v1\//, async (route) => {
      const url = route.request().url();
      let rows = [];
      if (/raid_jack_tier_totals/.test(url)) rows = [
        { kind: 'a', tier: 1, total_damage: 1750000, player_count: 12, any_defeated: true },
        { kind: 'a', tier: 2, total_damage: 500000, player_count: 7, any_defeated: false },
      ];
      if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/2', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) });
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // デバッグの強制表示でHOMEへジャックを出す(期間・公開フラグを待たない)
    await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
    await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
    await page.locator('footer button[aria-label=""]').dispatchEvent('click');
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
    await page.locator('[data-debug-raid-jack]').dispatchEvent('click');
    await page.locator('[data-raid-jack-debug]').waitFor({ timeout: 20000 });
    await page.locator('[data-raid-force-toggle]').click();
    await page.locator('[data-raid-go-home]').click();
    await page.locator('[data-home-raid-jack]').waitFor({ timeout: 20000 });
    // HOMEの上に出る案内(お知らせのまとめの「あとで読む」・HELL の遊び方の「つぎへ」)を先に閉じる(2026-10-13 から HOME に出る)
    for (let i = 0; i < 20; i++) {
      const did = await page.evaluate(() => { const b = document.querySelector('[data-update-guide-bundle-later], [data-rhythm-hell-guide-next]'); if (!b) return false; b.click(); return true; });
      if (!did) break;
      await page.waitForTimeout(300);
    }
    for (let i = 0; i < 60; i++) {
      const next = page.locator('button[aria-label="次へ"], button:has-text("次へ"), button:has-text("はじめる"), button:has-text("閉じる"), button:has-text("あとで")').filter({ visible: true }).first();
      if (await next.count() === 0) break;
      await next.click({ timeout: 3000, force: true }).catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.locator('[data-home-raid-say]').waitFor({ timeout: 20000 });

    const sides = new Set();
    for (const [w, h] of SIZES) {
      const tag = `${w}×${h}`;
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(1800);   // 吹き出しの置き場所の測り直し(1.5秒ごと)を待つ
      let gridBad = [], tapBad = [], coverBad = [];
      for (let k = 0; k < LINES_PER_SIZE; k++) {
        await page.waitForTimeout(400);   // 出てくる動き(storyPop)が終わってから測る
        const probe = await page.evaluate(() => {
          const say = document.querySelector('[data-home-raid-say]');
          if (!say) return null;
          // かぼちゃの上に置き場所が無いとき(幅320で、みゅあの台詞が長いとき)は、吹き出しを出さない(2026-10-24)
          if (say.getAttribute('data-say-hidden') === 'true') return { hidden: true };
          const r = say.getBoundingClientRect();
          const bad = [];
          for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
            const x = r.left + 6 + (r.width - 12) * i / 4, y = r.top + 6 + (r.height - 12) * j / 3;   // 角は丸め(半径14px)の内側で測る
            const top = document.elementFromPoint(x, y);
            if (!top || !say.contains(top)) bad.push(`(${Math.round(x)},${Math.round(y)})→${top ? (top.getAttribute('aria-label') || top.className || top.tagName) : 'なし'}`);
          }
          const next = [...say.querySelectorAll('span')].find((s) => /つぎ/.test(s.textContent) && s.getBoundingClientRect().width > 0);   // 狭い吹き出しでは枠線の上の「▶ つぎ」、ふだんは下の行
          const nr = next.getBoundingClientRect();
          return { side: say.getAttribute('data-say-side'), text: say.innerText.replace('▶ つぎ', '').trim(), bad, nx: nr.left + nr.width - 10, ny: nr.top + nr.height / 2,
            box: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
        });
        if (!probe) { tapBad.push('吹き出しが見つからない(HOMEへ戻れなかった)'); break; }
        // 出さないのは幅360未満だけ。出していないあいだは押せないので、この幅はここまで
        if (probe.hidden) { if (w >= 360) gridBad.push('吹き出しを出していない(出さないのは幅360未満だけ)'); break; }
        sides.add(probe.side);
        if (probe.bad.length) gridBad.push(`${probe.side} ${probe.box.join(',')}: ${probe.bad.slice(0, 3).join(' / ')}`);
        if (SHOT && k === 0) await page.screenshot({ path: `${SHOT}/home-${w}x${h}.png` });
        if (SHOT && probe.side === 'right' && !fs.existsSync(`${SHOT}/home-${w}x${h}-right.png`)) await page.screenshot({ path: `${SHOT}/home-${w}x${h}-right.png` });
        // 「▶ つぎ」をマウスの位置で押す(いちばん上のものが反応する)
        await page.mouse.click(probe.nx, probe.ny);
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => ({
          home: !!document.querySelector('.mh-home-scene') && !!document.querySelector('[data-home-raid-say]'),
          text: (document.querySelector('[data-home-raid-say]') || { innerText: '' }).innerText.replace('▶ つぎ', '').trim(),
        }));
        if (!after.home || after.text === probe.text) {
          tapBad.push(`${probe.side}「${probe.text.slice(0, 12)}」→ ${after.home ? 'セリフが変わらない' : 'HOMEから別の画面へ移った'}`);
          if (!after.home) {   // 開いてしまった画面からHOMEへ戻す
            if (SHOT) await page.screenshot({ path: `${SHOT}/opened-${w}x${h}.png` });
            await page.locator('button[aria-label="戻る"], button[aria-label="HOMEへ戻る"], button:has-text("もどる"), button:has-text("戻る"), button:has-text("HOME")').filter({ visible: true }).first().click({ timeout: 5000 }).catch(() => {});
            await page.locator('[data-home-raid-say]').waitFor({ timeout: 10000 }).catch(() => {});
          }
        }
        // HOMEのほかのボタンは、真ん中を押せばそのボタンが反応する(ジャックと吹き出しがふさがない)
        const cover = await page.evaluate(() => {
          const out = [];
          const faces = [...document.querySelectorAll('.mh-home-facility')].map((el) => [el, el.querySelector(':scope > span') || el]);
          document.querySelectorAll('.mh-home-scene button').forEach((el) => {
            if (el.closest('[data-home-raid-jack-wrap]') || el.classList.contains('mh-home-facility')) return;
            faces.push([el, el]);
          });
          for (const [btn, face] of faces) {
            const r = face.getBoundingClientRect();
            if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.right <= 0 || r.top >= innerHeight || r.left >= innerWidth) continue;
            const cs = getComputedStyle(btn);
            if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            if (top && !btn.contains(top) && top.closest('[data-home-raid-jack-wrap]')) out.push(btn.getAttribute('aria-label') || btn.textContent.trim().slice(0, 10));
          }
          return out;
        });
        if (cover.length) coverBad.push(`${probe.side}: ${cover.join('・')}`);
      }
      // ④ 施設の押せる範囲(吹き出し・ジャックの位置には左右されないので、1回だけ測る)
      const hit = await page.evaluate(() => {
        const bad = [];
        document.querySelectorAll('.mh-home-facility').forEach((btn) => {
          const name = btn.getAttribute('aria-label');
          const r = btn.querySelector(':scope > span').getBoundingClientRect();
          const owns = (x, y) => { if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null; const t = document.elementFromPoint(x, y); return !!t && btn.contains(t); };
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          if (owns(cx, cy) === false) { const t = document.elementFromPoint(cx, cy); bad.push(`${name}: 札の真ん中が押せない(上にあるもの: ${t ? (t.getAttribute('aria-label') || t.getAttribute('data-home-hint') || t.className || t.tagName).toString().slice(0, 80) + ' / ' + (t.closest('[aria-label]') ? t.closest('[aria-label]').getAttribute('aria-label') : '') + ' / ' + ((t.closest('.mh-home-assistant') || t).innerText || '').replace(/\s+/g, ' ').slice(0, 80) : 'なし'})`); }
          if (r.height + 16 < 44) bad.push(`${name}: 押せる高さが44px未満(${Math.round(r.height + 16)})`);
          for (const [dx, dy, side] of [[-1, 0, '左'], [1, 0, '右'], [0, -1, '上'], [0, 1, '下']]) {
            const edgeX = dx < 0 ? r.left : dx > 0 ? r.right : cx, edgeY = dy < 0 ? r.top : dy > 0 ? r.bottom : cy;
            const near = owns(edgeX + dx * 4, edgeY + dy * 4), far = owns(edgeX + dx * 14, edgeY + dy * 14);
            // 札のすぐ外(4px)は、ほかのボタンや吹き出しが上にあるときを除いて押せる
            const nearTop = document.elementFromPoint(edgeX + dx * 4, edgeY + dy * 4);
            if (near === false && nearTop && !nearTop.closest('button, [role="button"], a[href], .mh-home-assistant, .mh-home-status')) bad.push(`${name}: 札の${side}4pxが押せない`);
            if (far === true) bad.push(`${name}: 札の${side}14pxの何もない所でも押せてしまう`);
          }
        });
        return bad;
      });
      check(`${tag}: 施設は札とそのまわり8pxだけが押せる(札の外の何もない所では開かない)`, hit.length === 0, hit.slice(0, 3).join(' | '));
      check(`${tag}: 吹き出しの中のどこを押しても、いちばん上は吹き出し(${LINES_PER_SIZE}セリフ)`, gridBad.length === 0, gridBad.slice(0, 2).join(' | '));
      check(`${tag}: 「▶ つぎ」を押すとセリフが進み、施設は開かない`, tapBad.length === 0, tapBad.slice(0, 2).join(' | '));
      check(`${tag}: ほかのボタンの真ん中を、ジャックと吹き出しがふさがない`, coverBad.length === 0, coverBad.slice(0, 2).join(' | '));
      const size = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
      check(`${tag}: 画面が横にはみ出さない`, size.s <= size.c + 1, `${size.s} / ${size.c}`);
    }
    console.log(`(吹き出しの置き場所: ${[...sides].join(' / ')})`);
    check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' | '));
  } catch (error) {
    check('検査の実行', false, String(error && error.message || error).slice(0, 500));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  if (failed) { console.log(`\n${failed}件 NG`); process.exit(1); }
  console.log('\nすべて OK');
})();

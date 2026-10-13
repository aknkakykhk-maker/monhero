// HOMEのレイドボス(ジャック)の炎(オーラ)が、施設の札・みゅあの吹き出し・上の帯より必ず後ろにあるかを、実際のブラウザで確かめる。
// (2026-10-13・社長「またレイドボスのオーラが各施設に重なってる」)
//
//   node tools/mode/raid-jack-home-aura-check.js
//   RAID_AURA_SHOT_DIR=docs/playbot/shots/xxx node tools/mode/raid-jack-home-aura-check.js   静止画も撮る
//
// 10/07(#2299)に炎を施設の後ろへ回したが、10/11 に吹き出しを押せるようにしたときジャック全体の重なり順を上げ、
// 中にあった炎も一緒に施設の札の前へ戻ってしまった。炎は施設より後ろの別の層(data-home-raid-aura-wrap)で描く。
// 段階(男爵〜大王の5段階)ごとに炎の大きさが変わるので、全段階 × 画面の大きさで見る。
//   ① 炎は施設より後ろの層にある(炎の層の重なり順 < 施設の重なり順)
//   ② 炎に当たり判定を持たせても、施設の札・みゅあの吹き出し・上の帯の上の点では、いちばん上が炎にならない(=炎が後ろ)
// 通信はすべて差し替える(Supabaseへは出ない)。
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8996;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json',
  '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp',
  '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
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

const SIZES = [[390, 844], [375, 667], [844, 390], [667, 375]];
const TIERS = [1, 2, 3, 4, 5];

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  const SHOT = process.env.RAID_AURA_SHOT_DIR || '';
  if (SHOT) fs.mkdirSync(SHOT, { recursive: true });
  // いま挑める段階。前の段階はすべて倒した合計にする
  let current = 1;
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
    await page.route(/supabase\.co|\/rest\/v1\//, async (route) => {
      const url = route.request().url();
      let rows = [];
      if (/raid_jack_tier_totals/.test(url)) rows = TIERS.filter((t) => t <= current).map((t) => (
        { kind: 'a', tier: t, total_damage: t < current ? 1e12 : 0, player_count: 3, any_defeated: t < current }));
      if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-0/${rows.length}`, 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range' }, body: JSON.stringify(rows) });
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
    // HOMEの上に出る案内(HELL の遊び方・お知らせのまとめ など)を全部閉じる。残っていると、測る点がその案内に当たってしまう
    const closeOverlays = async () => {
      for (let i = 0; i < 80; i++) {
        const did = await page.evaluate(() => {
          // 決まった印のあるもの(お知らせのまとめの「あとで読む」・HELL の遊び方の「つぎへ」)を先に、次に一番上の案内の中のボタンを文言の完全一致で押す
          const marked = document.querySelector('[data-update-guide-bundle-later], [data-rhythm-hell-guide-next]');
          if (marked) { marked.click(); return true; }
          const rx = /^(次へ|つぎへ|はじめる|閉じる|とじる|あとで|あとで読む|わかった！?|OK|受け取る)$/;
          const dialogs = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"]')];
          const scope = dialogs.length ? dialogs[dialogs.length - 1] : document;
          const btn = [...scope.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, '').trim()) && b.offsetParent);
          if (btn) { btn.click(); return true; }
          return false;
        });
        if (!did) break;
        await page.waitForTimeout(300);
      }
    };
    await closeOverlays();

    for (const tier of TIERS) {
      current = tier;
      // ジャックは60秒ごとに合計を読み直す。時計を進めて、この段階の合計を読ませる
      await page.clock.fastForward(61000);
      const shown = await page.waitForFunction((t) => !!document.querySelector(`[data-home-raid-jack] [data-jack-aura="${t}"]`), tier, { timeout: 20000 }).then(() => true).catch(() => false);
      check(`段階${tier}: HOMEにその段階のジャックが出る`, shown);
      if (!shown) continue;
      for (const [w, h] of SIZES) {
        await page.setViewportSize({ width: w, height: h });
        await page.waitForTimeout(900);
        await closeOverlays();
        // HOMEの上に何もかぶっていない(施設の札の真ん中でいちばん上にあるのがその施設)ことを先に確かめる
        const clear = await page.evaluate(() => [...document.querySelectorAll('.mh-home-facility')].every((el) => {
          const r = (el.querySelector(':scope > span') || el).getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return true;
          const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!top && (el.contains(top) || !!top.closest('[data-home-raid-jack-wrap],[data-home-raid-aura-wrap]'));
        }));
        check(`段階${tier} ${w}×${h}: HOMEの上に案内がかぶっていない(測れる)`, clear);
        if (SHOT) await page.screenshot({ path: path.join(SHOT, `tier${tier}-${w}x${h}.png`) });
        const res = await page.evaluate(() => {
          const z = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const v = getComputedStyle(e).zIndex; if (v !== 'auto') return Number(v); } return 0; };
          const auraEls = [...document.querySelectorAll('[data-jack-aura-el] > *')];
          const auraWrap = document.querySelector('[data-home-raid-aura-wrap]');
          const facility = document.querySelector('.mh-home-facilities');
          const inAuraLayer = auraEls.every((el) => auraWrap && auraWrap.contains(el));
          const auraBox = auraEls.reduce((b, el) => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return b;
            return { left: Math.min(b.left, r.left), top: Math.min(b.top, r.top), right: Math.max(b.right, r.right), bottom: Math.max(b.bottom, r.bottom) }; },
            { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
          // 炎と、比べる相手に当たり判定を持たせて、重なった所でいちばん上が何かを見る
          const tag = document.createElement('style');
          tag.textContent = '[data-jack-aura-el],[data-jack-aura-el] *{pointer-events:auto!important}.mh-home-status,.mh-home-status *,.mh-home-facility,.mh-home-facility *,.mh-home-assistant,.mh-home-assistant *{pointer-events:auto!important}';
          document.head.appendChild(tag);
          const targets = [
            ...[...document.querySelectorAll('.mh-home-facility')].map((el) => ({ name: (el.getAttribute('aria-label') || '施設').trim(), el: el.querySelector(':scope > span') || el })),
            { name: 'みゅあの吹き出し', el: document.querySelector('.mh-home-assistant') },
            { name: '上の帯', el: document.querySelector('.mh-home-status') },
          ].filter((t) => t.el);
          const covered = [], touched = [];
          for (const t of targets) {
            const r = t.el.getBoundingClientRect();
            const L = Math.max(r.left, auraBox.left), T = Math.max(r.top, auraBox.top), R = Math.min(r.right, auraBox.right), B = Math.min(r.bottom, auraBox.bottom);
            if (!(R - L > 1 && B - T > 1)) continue;
            touched.push(t.name);
            let bad = 0;
            for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
              const x = L + (R - L) * (i + .5) / 6, y = T + (B - T) * (j + .5) / 4;
              const top = document.elementFromPoint(x, y);
              if (top && top.closest('[data-jack-aura-el]')) bad++;
            }
            if (bad) covered.push(`${t.name}(${bad}点)`);
          }
          tag.remove();
          return { inAuraLayer, auraZ: auraWrap ? z(auraWrap) : null, facilityZ: facility ? z(facility) : null, count: auraEls.length, covered, touched };
        });
        const tagName = `段階${tier} ${w}×${h}`;
        check(`${tagName}: 炎は施設より後ろの層にある`, res.count > 0 && res.inAuraLayer && res.auraZ !== null && res.facilityZ !== null && res.auraZ < res.facilityZ,
          `炎 ${res.count}個 / 重なり順 炎${res.auraZ}・施設${res.facilityZ}`);
        check(`${tagName}: 施設の札・みゅあの吹き出し・上の帯の上に炎が出ない`, res.covered.length === 0,
          res.covered.length ? res.covered.join(', ') : `重なる範囲 ${res.touched.join('・') || 'なし'}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
    }
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / ') || 'なし');
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

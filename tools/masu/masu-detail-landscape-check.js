// マスモン詳細の真ん中の欄(技・固有技強化・合体…)が、横画面でも見えて、最後まで動かして届くかを実ブラウザで確かめる。
//
//   node tools/masu/masu-detail-landscape-check.js
//
// 2026-11-07 レフェリーくん: 横(844×390)でマスモン詳細を開くと、見出し(お気に入り/転生ロックつき・#1998 で高くなった)と
// 下の「育成・カスタム」だけで枠が埋まり、真ん中の欄の高さが0になって何も見えなかった(#1998 より前も 21px しか無かった)。
// 直し: 横で背が低いときだけ、詳細の枠ごと縦に動かす(60-app.jsx の renderMonsterDetailModal)。縦の見た目は変えない。
//   ① 横(844×390・667×375)で、真ん中の欄の高さが0でない(中身の高さぶん出ている)
//   ② 横で、枠を動かすと 技・固有技強化・合体 の欄まで画面の中へ届く
//   ③ 縦(390×844)は今までどおり: 見出しと下の操作は動かず、真ん中の欄だけが動く(枠ごとは動かない)
//   ④ 縦でも、真ん中の欄を動かすと 固有技強化・合体 の欄まで届く
//   ⑤ モンヒロビートの「🔄 横」で回したとき(端末は縦のまま)も、①②と同じ。回したときは --mh-vh が端末の縦の長さのままなので、枠が画面からはみ出さないことも見る
'use strict';
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed, updateNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8974;
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

// 固有技Pを持つ(固有技強化の欄が開く)マスモン1体と、合体の欄が出るもう1体
const FIXTURES = [
  { id: 'ld-1', baseId: 'Mocchi', name: '横画面けんさ', bondXp: 900000, createdAt: 1, uniqueSkillPoints: 3, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0] },
  { id: 'ld-2', baseId: 'Suezo', name: 'もう一体', bondXp: 400000, createdAt: 2, statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, distAptBoosts: [0, 0, 0, 0] },
];

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const app = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
  check('詳細の枠に、横で背が低いときだけ枠ごと動かす作りがある(縦の見た目は変えない)',
    /data-monster-detail-box[^\n]*\[@media\(orientation:landscape\)_and_\(max-height:520px\)\]:overflow-y-auto/.test(app)
    && /data-monster-detail-body[^\n]*\[@media\(orientation:landscape\)_and_\(max-height:520px\)\]:flex-none/.test(app));
  const css = fs.readFileSync(path.join(root, 'monster-hero/tailwind.css'), 'utf8');
  check('静的CSS(tailwind.css)にその作りが入っている(node tools/build.js 済み)', css.includes('max-height\\:520px\\)\\]\\:overflow-y-auto') && css.includes('max-height\\:520px\\)\\]\\:flex-none'));

  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    for (const vp of [{ w: 844, h: 390, land: true }, { w: 667, h: 375, land: true }, { w: 390, h: 844, land: false }, { w: 390, h: 844, land: true, rot: true }]) {
      const T = `[${vp.w}×${vp.h}${vp.rot ? '・🔄横' : ''}] `;
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.addInitScript((fixtures) => {
        const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
        put('mh_breeder_name', '検査ブリーダー'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_masu_migrated', true);
        put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
        put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true);
        put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
        put('mh_masu_mons', fixtures);
      }, FIXTURES);
      await page.addInitScript(quietBootSeed());
      await page.addInitScript(updateNoticeSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' }), home = page.locator('button[aria-label="モンヒロバトル"]');
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) {
        if (await top.isVisible().catch(() => false)) await top.click().catch(() => {});
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む)$/.test((x.innerText || '').trim())); if (b) b.click(); });
        await page.waitForTimeout(500);
      }
      await page.getByRole('button', { name: 'M/B管理' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: /マスモン一覧/ }).first().dispatchEvent('click');
      await page.getByText('横画面けんさ').first().waitFor({ timeout: 20000 });
      await page.getByText('横画面けんさ').first().dispatchEvent('click');
      await page.locator('[data-monster-detail-body]').first().waitFor({ state: 'attached', timeout: 20000 });
      await page.waitForTimeout(600);
      if (vp.rot) {
        // モンヒロビートの「🔄 横」と同じ回し方(端末は縦のまま、絵を回す)。回したときに出る窓は閉じる
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(RHYTHM_VIEW_ROTATION.preferredAngle()));
        await page.waitForTimeout(1000);
        for (let i = 0; i < 6; i++) { const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && !x.closest('[data-monster-detail-box]') && /^(確認|受け取る|閉じる|OK|スキップ|あとで読む)$/.test((x.innerText || '').trim())); if (b) b.click(); return !!b; }); if (!hit) break; await page.waitForTimeout(400); }
        check(`${T}回した目印(data-mh-view-rotation)が付いている`, await page.evaluate(() => document.querySelector('[data-mh-view-rotation="true"]') !== null));
      }
      const m = await page.evaluate(() => {
        const box = document.querySelector('[data-monster-detail-box]'), body = box.querySelector('[data-monster-detail-body]');
        const r = (e) => e.getBoundingClientRect();
        const frame = box.parentElement;
        return { frameH: frame.clientHeight, boxH: box.offsetHeight, boxSH: box.scrollHeight, boxCan: box.scrollHeight > box.clientHeight + 4 && getComputedStyle(box).overflowY !== 'hidden', bodyH: body.offsetHeight, bodySH: body.scrollHeight, bodyCan: body.scrollHeight > body.clientHeight + 4 && getComputedStyle(body).overflowY !== 'visible' };
      });
      // 欄の見出しを探して、そこまで動かして画面に入るか(scrollIntoView は使わず、動かせる箱の scrollTop で寄せる)
      const reach = (label) => page.evaluate(([lbl, land]) => {
        const box = document.querySelector('[data-monster-detail-box]');
        const sc = land ? box : box.querySelector('[data-monster-detail-body]');
        const el = [...box.querySelectorAll('div,section,span,button')].find((x) => (x.innerText || '').trim().startsWith(lbl));
        if (!el) return { found: false };
        // 回したときも測れるよう、画面の座標ではなく、動かす箱の中での位置(offsetTop の和)で見る
        const pos = sc.style.position; sc.style.position = 'relative';
        let off = 0; for (let x = el; x && x !== sc; x = x.offsetParent) off += x.offsetTop;
        sc.style.position = pos;
        const max = sc.scrollHeight - sc.clientHeight;
        sc.scrollTop = Math.max(0, off - 8);
        const top = off - sc.scrollTop;
        // 箱の中で見える位置(0〜箱の高さ)に入り、箱そのものも見える範囲(枠の中)にある
        const frame = document.querySelector('[data-monster-detail-box]').parentElement;
        const boxFits = document.querySelector('[data-monster-detail-box]').offsetHeight <= frame.clientHeight + 1;
        return { found: true, off, scrollTop: sc.scrollTop, max, top, inView: top >= 0 && top + 30 <= sc.clientHeight && boxFits };
      }, [label, vp.land]);
      if (vp.land) {
        check(`${T}横: 真ん中の欄の高さが0でない(中身の高さぶん出ている)`, m.bodyH > 100 && m.bodyH >= m.bodySH - 2, JSON.stringify(m));
        check(`${T}横: 詳細の枠が画面の中に収まる(上下にはみ出さない)`, m.boxH <= m.frameH + 1, JSON.stringify(m));
        check(`${T}横: 詳細の枠ごと縦に動かせる`, m.boxCan, JSON.stringify(m));
      } else {
        check(`${T}縦: 真ん中の欄だけが動き、枠ごとは動かない(今までどおり)`, m.bodyH > 100 && m.bodyCan && !m.boxCan, JSON.stringify(m));
      }
      for (const label of ['通常技', '固有技強化', '合体']) {
        const r = await reach(label);
        check(`${T}「${label}」の欄まで動かして画面に入る`, r.found && r.inView, JSON.stringify(r));
      }
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  check('画面のエラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

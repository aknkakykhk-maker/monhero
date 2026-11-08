// 助手の部屋を大きく見る(2026-11-08 社長 案A・①〜③・マスモン全部)を、実際に開いて確かめる。
//   node tools/assistant/assistant-life-roomview-check.js            検査
//   node tools/assistant/assistant-life-roomview-check.js --shots    止め絵(docs/progress/assistant-peer/roomview/real-*.png)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る
//   ① 部屋を押すと大きな部屋(上の帯に部屋の名前・「← 家へ」で閉じる)。縦は下へ送ると今の中身、横は右の欄が中身
//   ② 家にいる助手は立ち絵が立ち(①色味の層・③見えている体で大きさ)、腰から下は家具の後ろ(②)。寝ているときはベッド
//   ③ 出かけている助手はいない。行き先の札が出る
//   ④ マスモンは全部(出かけている助手は留守番の子だけ)。床の上・部屋の中・重ならない・押すとマスモンのシート
//   ⑤ 札の段(縦): 6つが部屋の中に収まり、押すとそれぞれ動く(👀 で中身へ送る・🐾 でマスモン)
//   ⑥ 大きさ: 縦 390×844・375×667・320×568 / 横 844×390・667×375 / タブレット 768×1024
//   ⑦ ページのエラーが出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9249;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/roomview');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const SIZES = [
  { id: 't390', name: '縦 390×844', w: 390, h: 844 },
  { id: 't375', name: '縦 375×667', w: 375, h: 667 },
  { id: 't320', name: '縦 320×568', w: 320, h: 568 },
  { id: 'y844', name: '横 844×390', w: 844, h: 390, land: true },
  { id: 'y667', name: '横 667×375', w: 667, h: 375, land: true },
  { id: 'tab', name: 'タブレット 768×1024', w: 768, h: 1024 },
];
// 顔ぶれ: あつは家でひとり/ききとみゅあは家で一緒/ドラは家で寝ている/ももすけはモンヒロビート/ほかは町
const MIX = { groups: [{ ids: ['kiki', 'mua'], doing: 'snack', place: 'home' }, { ids: ['erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }],
  solo: { atsu: { doing: 'idle', place: 'home' }, dra: { doing: 'sleep', place: 'home' }, momosuke: { doing: 'practice', place: 'studio' }, kyuko: { doing: 'read', place: 'library' } } };

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  for (const v of SIZES.filter(x => !process.env.RV_ONLY || process.env.RV_ONLY.split(',').includes(x.id))) {
    const T = `[${v.name}] `;
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo } }); }, MIX);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(500);
    for (const [id, kind] of [['atsu', 'home'], ['kiki', 'pair'], ['dra', 'sleep'], ['momosuke', 'away']]) {
      await page.locator(`[data-assistant-life-room="${id}"]`).click({ timeout: 5000 });
      await page.waitForTimeout(900);
      const r = await page.evaluate((who) => {
        const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
        const ng = []; const sc = document.querySelector(`[data-assistant-life-roomview="${who}"]`); if (!sc) return { ng: ['大きな部屋が無い'] };
        const S = sc.getBoundingClientRect();
        if (S.width < 200 || S.height < 260) ng.push(`部屋が小さい ${Math.round(S.width)}×${Math.round(S.height)}`);
        const close = document.querySelector('[data-assistant-life-roomview-close]'); const cr = close && close.getBoundingClientRect();
        if (!close || cr.top < -1 || cr.left < -1) ng.push('「← 家へ」が見えない');
        const title = sc.querySelector('p'); const tr = title && title.getBoundingClientRect();
        if (cr && tr && hit(cr, tr)) ng.push('題が「← 家へ」に隠れる');
        const figs = [...sc.querySelectorAll('[data-assistant-life-roomview-fig]')].map(e => e.getAttribute('data-assistant-life-roomview-fig'));
        const front = (sc.querySelector('[data-assistant-life-roomview-front]') || {}).getAttribute ? sc.querySelector('[data-assistant-life-roomview-front]').getAttribute('data-assistant-life-roomview-front') : null;
        const away = !!sc.querySelector('[data-assistant-life-roomview-away]');
        const ms = [...sc.querySelectorAll('[data-assistant-life-roomview-masmon]')].map(e => e.getBoundingClientRect());
        const dock = sc.querySelector('[data-assistant-life-roomview-dock]'); const dr = dock && dock.getBoundingClientRect();
        for (const m of ms) { if (m.left < S.left - 1 || m.right > S.right + 1 || m.top < S.top - 1 || m.bottom > S.bottom + 1) ng.push('マスモンが部屋の外'); if (dr && hit(m, dr)) ng.push('マスモンが札の段に重なる'); }
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) if (Math.min(ms[i].right, ms[j].right) - Math.max(ms[i].left, ms[j].left) > ms[i].width * 0.35 && Math.min(ms[i].bottom, ms[j].bottom) - Math.max(ms[i].top, ms[j].top) > ms[i].height * 0.35) ng.push('マスモンどうしが大きく重なる');
        if (dock) { for (const b of dock.querySelectorAll('button')) { const q = b.getBoundingClientRect(); if (q.bottom > innerHeight + 1 || q.top < S.top) ng.push(`札が画面の外 ${b.textContent}`); if (b.scrollWidth > b.clientWidth + 1) ng.push(`札の字が切れる ${b.textContent}`); } }
        // 立ち絵の色味の層(①)・大きさ(③ 見えている体)
        for (const f of sc.querySelectorAll('[data-assistant-life-roomview-fig]')) { if (!f.nextElementSibling || !/multiply/.test(getComputedStyle(f.nextElementSibling).mixBlendMode)) ng.push('立ち絵に色味の層が無い'); }
        // 同じ部屋の人は顔(目〜顎)の長さが同じ・左右に分かれる(真ん中が離れている)(2026-11-08 社長「きき・みゅあが大きく重なる」)
        const ps = [...sc.querySelectorAll('[data-assistant-life-roomview-face]')].map(e => ({ f: Number(e.getAttribute('data-assistant-life-roomview-face')), r: e.getBoundingClientRect() }));
        if (ps.length > 1 && new Set(ps.map(p => p.f)).size > 1) ng.push(`顔の大きさがそろわない ${ps.map(p => p.f).join(',')}`);
        for (let i = 0; i + 1 < ps.length; i++) { const a = ps[i].r, b = ps[i + 1].r; if (Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2) < Math.min(a.width, b.width) * 0.45) ng.push('2人の立ち絵が大きく重なる'); }
        const life = ASSISTANT_LIFE_STORE.state.life;
        const team = assistantLifeMasmonTeamOf(who).length, want = assistantLifeRoomMasmons(who, life).length;
        return { ng, figs, front, away, ms: ms.length, team, want, dockN: dock ? dock.querySelectorAll('button').length : 0 };
      }, id);
      const ng = r.ng || [];
      if (kind === 'home' && !(r.figs.length === 1 && r.figs[0] === 'atsu' && r.front && r.front !== 'bed' && !r.away)) ng.push(`ひとりで家: ${JSON.stringify(r)}`);
      if (kind === 'pair' && !(r.figs.length === 2 && r.figs.includes('kiki') && r.figs.includes('mua'))) ng.push(`2人: ${JSON.stringify(r.figs)}`);
      if (kind === 'sleep' && r.front !== 'bed') ng.push(`寝ているのにベッドでない: ${r.front}`);
      if (kind === 'away' && !(r.figs.length === 0 && r.away && !r.front)) ng.push(`留守: ${JSON.stringify(r)}`);
      if (r.ms !== r.want || (kind !== 'away' && r.ms !== r.team)) ng.push(`マスモン ${r.ms}体(全部 ${r.team}・いるはず ${r.want})`);
      if (!v.land && r.dockN !== 6) ng.push(`札の段が ${r.dockN}個`);
      check(`${T}${id}(${kind}): 大きな部屋・立ち絵・家具・マスモン・札`, ng.length === 0, ng.slice(0, 5).join(' / '));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `real-${v.id}-${id}.png`) });
      if (id === 'atsu') {
        // 下の中身(今の部屋のシート)が残っている・👀 で中身へ・🐾 でマスモン
        if (!v.land) {
          await page.locator('[data-assistant-life-roomview-act="sheet"]').click(); await page.waitForTimeout(700);
          const seen = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-act="peek"],[data-assistant-life-room-act="watch"]'); if (!b) return false; const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; });
          check(`${T}👀 で今の中身(ようすを見る など)まで送る`, seen);
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `real-${v.id}-sheet.png`) });
          await page.locator('[data-assistant-life-roomview-act="masmon"]').click(); await page.waitForTimeout(500);
          check(`${T}🐾 でマスモンのシート`, (await page.locator('.mhm-panel, [data-assistant-masmon-sheet]').count()) > 0);
          await page.locator('[data-mhl-sheet-close]').last().click().catch(() => {}); await page.waitForTimeout(300);
        } else {
          const right = await page.evaluate(() => { const sh = document.querySelector('[data-assistant-life-room-sheet] .mhl-sheet'); const sc = document.querySelector('[data-assistant-life-roomview]'); if (!sh || !sc) return false; const a = sh.getBoundingClientRect(), b = sc.getBoundingClientRect(); return a.left >= b.right - 1 && a.right <= innerWidth + 1; });
          check(`${T}横は部屋が左・今の中身が右の欄`, right);
        }
        await page.locator('[data-assistant-life-roomview-masmon="0"]').click().catch(() => {}); await page.waitForTimeout(500);
        check(`${T}部屋のマスモンを押すとマスモンのシート`, (await page.locator('.mhm-panel, [data-assistant-masmon-sheet]').count()) > 0);
        await page.locator('[data-mhl-sheet-close]').last().click().catch(() => {}); await page.waitForTimeout(300);
      }
      await page.locator('[data-assistant-life-roomview-close]').click(); await page.waitForTimeout(300);
      if (id === 'atsu') check(`${T}「← 家へ」で家に戻る`, (await page.locator('[data-assistant-life-room-sheet]').count()) === 0);
    }
    await page.close();
  }
  check('⑦ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

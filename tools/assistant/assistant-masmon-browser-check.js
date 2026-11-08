// 助手ライフ: 部屋の「🐾 マスモン」(56-assistant-life-masmon.jsx)を本物の画面で開いて確かめる。
//   node tools/assistant/assistant-masmon-browser-check.js          検査(縦 390×844・横 844×390・🔄横から戻った 390×844)
//   node tools/assistant/assistant-masmon-browser-check.js --shots  止め絵も撮る(docs/progress/assistant-peer/shots/masmon-<タブ>-<向き>.jpg)
//   MASMON_TAG_MOCK=1 で、出かけ札を上へ寄せた見本の形を当てて見る(ナカヨシ8が札を動かす前の確かめ用)
//   MASMON_LOW_BOND=1 で、仲良し度が低い(まだ迎えていない)ままの画面を見る
//   MASMON_ALL=1 で8人ぶん・MASMON_WHO=dra でその1人(ふだんはききだけ)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
// 見るもの:
//   ① 部屋のシートに「🐾 マスモン」の1行があり、押すとシートが開く/4つのタブ(マスモン・編成・デッキ・好き苦手)が全部出る
//   ② マスモンは3体・先頭が1体・染めた絵が出ている(絵の読み込みに失敗していない)
//   ③ 枠の端にカードがくっつかない(パネルの左右から 6px 以上あける)・横にはみ出さない・名前が「…」で切れない
//   ④ 口: assistantLifeCardStyle・assistantLifeTasteOf が8人ぶん返る(印が偽なら null)
//   ⑤ 部屋にいるマスモン: 札・顔・吹き出し・扉・名札に重ならない/部屋からはみ出さない/一緒に出かけたマスモンは部屋に出ない/地図には出ない
//   ⑥ 画面のエラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9273;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'r', name: '🔄横から戻った 390×844', w: 390, h: 844, rot: true }];
const WHOS = process.env.MASMON_WHO ? [process.env.MASMON_WHO] : process.env.MASMON_ALL ? ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'] : ['kiki'];
const TABS = ['mons', 'team', 'deck', 'taste'];

const layoutProblems = (page) => page.evaluate(() => {
  const ng = [];
  const panel = document.querySelector('.mhm-panel');
  if (!panel) return ['パネルが無い'];
  const pr = panel.getBoundingClientRect();
  if (pr.left < -1 || pr.right > window.innerWidth + 1) ng.push(`パネルが画面からはみ出す(${Math.round(pr.left)}〜${Math.round(pr.right)})`);
  const body = panel.querySelector('.mhm-body');
  if (body && body.scrollWidth > body.clientWidth + 1) ng.push('中身が横にはみ出す');
  for (const c of panel.querySelectorAll('.mhm-card')) {
    const r = c.getBoundingClientRect();
    if (r.left - pr.left < 6 || pr.right - r.right < 6) ng.push(`カードが枠の端にくっつく(左${Math.round(r.left - pr.left)}・右${Math.round(pr.right - r.right)})`);
  }
  for (const t of panel.querySelectorAll('.truncate')) if (t.scrollWidth > t.clientWidth + 1) ng.push(`文字が切れる: ${t.textContent.slice(0, 18)}`);
  for (const t of panel.querySelectorAll('.mhm-tab')) if (t.scrollWidth > t.clientWidth + 1) ng.push(`タブの文字が切れる: ${t.textContent}`);
  for (const im of panel.querySelectorAll('img')) if (im.complete && im.naturalWidth === 0) ng.push(`絵が出ない: ${im.getAttribute('src') ? im.getAttribute('src').slice(0, 40) : im.alt}`);
  return [...new Set(ng)];
});

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    for (const v of VIEWS) {
      const T0 = `[${v.name}] `; const T = T0;
      const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
      const errors = []; page.on('pageerror', e => errors.push(String(e)));
      await page.clock.setFixedTime(new Date('2026-11-08T03:40:00Z'));
      await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
      await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
      await page.addInitScript(seed, { storyIds: STORY_IDS, life: true });
      // 仲良し度を Lv7 に(迎える2体とも届く)。保存キーは助手ごと(みゅあだけ mh_assistant_bond_v1)。ページの中だけ
      if (!process.env.MASMON_LOW_BOND) await page.addInitScript(() => { try { if (localStorage.getItem('mh_check_masmon_bond') === null) { localStorage.setItem('mh_check_masmon_bond', '1'); for (const id of ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']) { const key = id === 'mua' ? 'mh_assistant_bond_v1' : `mh_assistant_bond_${id}_v1`; let b = {}; try { b = JSON.parse(localStorage.getItem(key)) || {}; } catch {} localStorage.setItem(key, JSON.stringify({ ...b, points: 1800 })); } } } catch {} });
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      if (v.rot) {
        await page.locator('.mh-home-facility.rhythm').click({ timeout: 15000 }).catch(() => {});
        await page.getByRole('button', { name: '戻る' }).first().waitFor({ timeout: 15000 }).catch(() => {});
        await page.evaluate(() => RHYTHM_VIEW_ROTATION.set(90)); await page.waitForTimeout(800);
        await page.getByRole('button', { name: '戻る' }).first().click({ timeout: 5000 }).catch(() => {});
        await page.locator('.mh-home-player').waitFor({ timeout: 15000 }).catch(() => {});
      }
      await finishTalk(page);
      await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
      await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 8000 });
      await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
      if (process.env.MASMON_TAG_MOCK) {
        await page.addStyleTag({ content: '.mhl-room .tag{top:4px!important;transform:translate(-50%,0) rotate(-2deg) scale(.82)!important;transform-origin:50% 0!important}' });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      }
      { // ⑤ 部屋にいるマスモン(染めた絵ができるのを待つ)
        await page.waitForTimeout(SHOTS ? 4000 : 1500);
        const r = await page.evaluate(() => {
          const ng = []; let n = 0, stay = 0, should = 0; const miss = [], sizeList = [];
          const life = assistantLifeCurrent();
          for (const room of document.querySelectorAll('[data-assistant-life-room]')) {
            const id = room.getAttribute('data-assistant-life-room');
            const pet = room.querySelector('[data-assistant-life-room-masmon-pet]');
            const where = assistantMasmonWhere(id, life).kind;
            if (where === 'out' && pet) ng.push(`${id}: 出かけたのに部屋にいる`);
            if (where !== 'out' && !room.querySelector('.lock')) should++;
            if (!pet || pet.style.visibility === 'hidden') { if (where !== 'out' && !room.querySelector('.lock')) miss.push(id); continue; }
            n++; if (where === 'stay') stay++;
            const size = parseFloat(pet.style.width), y = parseFloat(pet.style.top), rr = room.getBoundingClientRect();
            sizeList.push(Math.round(size));
            const [w0, w1] = (pet.getAttribute('data-assistant-life-room-masmon-walk') || '').split('-').map(Number);
            if (!Number.isFinite(w0) || !Number.isFinite(w1)) { ng.push(`${id}: 歩く区間が無い`); continue; }
            // 歩く区間の端から端まで、どの位置でも(印のはみ出しを含めて)重ならない・はみ出さない
            const obs = [...room.querySelectorAll('.tag,.pp,.bb,.pl,.lv,[data-assistant-life-rel-door],[data-assistant-life-rel-mend],[data-assistant-life-rel-sit]')].map(o => [o, o.getBoundingClientRect()]).filter(([, q]) => q.width);
            for (let x = w0; x <= w1; x += 2) {
              const box = { l: rr.left + x, r: rr.left + x + size + 2, t: rr.top + y - 3, b: rr.top + y + size };
              if (box.l < rr.left - 1 || box.r > rr.right + 1 || box.t < rr.top - 1 || box.b > rr.bottom + 1) ng.push(`${id}: 部屋からはみ出す(x=${x})`);
              for (const [o, q] of obs) if (Math.min(box.r, q.right) - Math.max(box.l, q.left) > 1 && Math.min(box.b, q.bottom) - Math.max(box.t, q.top) > 1) ng.push(`${id}: 歩く途中で ${o.className || '部品'} に重なる`);
            }
          }
          return { ng: [...new Set(ng)], n, stay, should, miss, sizeList };
        });
        check(`${T}部屋のマスモン: 歩く途中のどの位置でも札・顔・吹き出し・扉・名札に重ならない・はみ出さない`, !r.ng.length, r.ng.slice(0, 4).join(' / '));
        check(`${T}部屋のマスモンは、どの部屋も同じ大きさ`, new Set(r.sizeList).size <= 1, r.sizeList.join(','));
        check(`${T}部屋のマスモンが、出かけていない部屋の全部に見える`, r.should > 0 && r.n === r.should, `${r.n}/${r.should}部屋(留守番${r.stay})${r.miss.length ? ' 出ない: ' + r.miss.join('・') : ''}`);
        if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-5-house-${v.id}.jpg`), type: 'jpeg', quality: 80 });
        { // 歩く: しばらく待つと位置が変わる/動きを減らす設定では動かない
          const pos = () => page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-room-masmon-pet]')].filter(p => p.style.visibility !== 'hidden').map(p => `${p.getAttribute('data-assistant-life-room-masmon-pet')}:${p.getBoundingClientRect().left.toFixed(0)}`).join(' '));
          const xs = {}; const a = await pos();
          for (let k = 0; k < 12; k++) { for (const it of (await pos()).split(' ').filter(Boolean)) { const [n, x] = it.split(':'); (xs[n] = xs[n] || []).push(Number(x)); } await page.waitForTimeout(1000); }
          const moved = Object.entries(xs).map(([n, v]) => `${n}:${Math.max(...v) - Math.min(...v)}px`);
          if (a) check(`${T}部屋のマスモンが床を歩く(12秒のあいだにどれかが 8px 以上動く)`, Object.values(xs).some(v => Math.max(...v) - Math.min(...v) >= 8), moved.join(' '));
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-5-house-${v.id}-2.jpg`), type: 'jpeg', quality: 80 });
          if (a && v.id === 'p') {
            await page.emulateMedia({ reducedMotion: 'reduce' }); await page.evaluate(() => window.dispatchEvent(new Event('resize'))); await page.waitForTimeout(1500);
            const c = await pos(); await page.waitForTimeout(8000); const d = await pos();
            check(`${T}動きを減らす設定では、止まったまま`, c === d, `${c} → ${d}`);
            await page.emulateMedia({ reducedMotion: 'no-preference' });
          }
        }

      }
      if (v.id === 'p') {
        const hooks = await page.evaluate(() => ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'].map(id => ({ id, s: assistantLifeCardStyle(id), t: assistantLifeTasteOf(id) })));
        check(`${T}口 assistantLifeCardStyle が8人ぶん attack/guard/normal`, hooks.every(h => ['attack', 'guard', 'normal'].includes(h.s)), hooks.map(h => `${h.id}:${h.s}`).join(' '));
        check(`${T}口 assistantLifeTasteOf が8人ぶん(好きは1つ以上・名前で)`, hooks.every(h => h.t && h.t.likes.length >= 1 && h.t.likes.every(n => typeof n === 'string' && n)), hooks.map(h => `${h.id}:${h.t ? h.t.likes.join('・') : 'null'}`).join(' / '));
      }
      for (const WHO of WHOS) {
      const T = `${T0}${WHO} `;
      const low = !!process.env.MASMON_LOW_BOND; // 仲良し度が低い(まだ迎えていない)ときの確かめ
      const want = await page.evaluate(({ id, low }) => { const p = ASSISTANT_MASMON_PLAN.find(a => a.id === id); const n = low ? 0 : (p.extra || []).length; return { deck: p.deck.name, colors: p.favColors.length, dis: p.dislikeMon.length, all: p.team.length + n, bench: n }; }, { id: WHO, low });
      await page.locator(`[data-assistant-life-room="${WHO}"]`).first().click({ timeout: 8000 });
        await page.locator('[data-assistant-life-room-sheet]').waitFor({ timeout: 5000 });
        const row = page.locator('[data-assistant-life-room-masmon]');
        check(`${T}部屋のシートに「🐾 マスモン」の1行`, (await row.count()) === 1, await row.innerText().catch(() => ''));
        if (SHOTS) { await row.scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(shotDir, `masmon-0-room-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 }); }
        await row.click({ timeout: 5000 }).catch(() => {});
        await page.locator('[data-assistant-masmon-sheet]').waitFor({ timeout: 5000 }).catch(() => {});
        check(`${T}押すとマスモンのシートが開く`, (await page.locator(`[data-assistant-masmon-sheet="${WHO}"]`).count()) === 1);
        // 迎える: 1回目に開くと1体目の場面 →「よろしくね」→ 閉じてもう一度開くと2体目 → 3回目は出ない
        for (let k = 0; k < want.bench; k++) {
          const sc = page.locator('[data-assistant-masmon-welcome]');
          await sc.waitFor({ timeout: 4000 }).catch(() => {});
          const line = await page.locator('[data-assistant-masmon-welcome-line]').innerText().catch(() => '');
          check(`${T}迎える場面 ${k + 1}体目(ひとこと・名前入り)`, (await sc.count()) === 1 && line.length > 10 && !/\{(name|mon|nick)\}/.test(line), line.slice(0, 40));
          if (SHOTS && k === 0) { await page.waitForTimeout(2500); await page.screenshot({ path: path.join(shotDir, `masmon-7-welcome-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 }); }
          await page.locator('[data-assistant-masmon-welcome-ok]').click({ timeout: 3000 }).catch(() => {});
          await page.locator('[data-assistant-masmon-close]').click({ timeout: 3000 }).catch(() => {});
          await row.click({ timeout: 5000 }).catch(() => {});
          await page.locator('[data-assistant-masmon-sheet]').waitFor({ timeout: 5000 }).catch(() => {});
        }
        await page.waitForTimeout(1500);
        check(`${T}迎え終わったら、もう場面は出ない`, (await page.locator('[data-assistant-masmon-welcome]').count()) === 0);
        for (const tab of TABS) {
          await page.locator(`[data-assistant-masmon-tab-btn="${tab}"]`).click({ timeout: 3000 }).catch(() => {});
          await page.waitForTimeout(tab === 'mons' || tab === 'team' ? 1500 : 500); // 染めた絵ができるのを待つ
          check(`${T}タブ「${tab}」が開く`, (await page.locator(`[data-assistant-masmon-tab="${tab}"]`).count()) === 1);
          if (tab === 'mons') {
            const n = await page.locator('[data-assistant-masmon-row]').count();
            const leads = await page.locator('[data-assistant-masmon-row] .mhm-lead:not(.mhm-bench)').count();
            check(`${T}マスモンは編成3体+迎えた${want.bench}体・先頭は1体`, n === want.all && leads === 1, `${n}体・先頭${leads}`);
            // 押すと詳細画面(見るだけ)
            await page.locator('[data-assistant-masmon-row]').first().click();
            await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1200);
            const dt = await page.evaluate(() => { const d = document.querySelector('[data-assistant-masmon-detail]'); if (!d) return null; const ng = []; for (const t of d.querySelectorAll('.truncate')) if (t.scrollWidth > t.clientWidth + 1) ng.push(t.textContent.slice(0, 16)); const b = d.querySelector('.mhm-body'); if (b && b.scrollWidth > b.clientWidth + 1) ng.push('横にはみ出す'); return { ng, parts: ['stats', 'skills', 'dye', 'talk'].filter(k => d.querySelector(`[data-assistant-masmon-detail-${k}]`)).length }; });
            check(`${T}押すと詳細画面(能力・技・染めた色・ひとこと)・切れない`, dt && dt.parts === 4 && !dt.ng.length, dt ? `${dt.parts}つ ${dt.ng.join(' / ')}` : '開かない');
            if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-6-detail-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
            await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 3000 }).catch(() => {});
          }
          if (tab === 'team') check(`${T}編成に3体・迎えた${want.bench}体(控え)・編成の型`, (await page.locator('[data-assistant-masmon-team]').count()) === 3 && (await page.locator('[data-assistant-masmon-bench-mon]').count()) === want.bench && (await page.locator('[data-assistant-masmon-team-info]').count()) === 1);
        if (tab !== 'deck') { // 空いた枠: タブの中身が、見える高さの 75% 以上を使う(社長「ページの空き枠をもっと活用して」)。デッキはカード部の部品が入ってから
          const fill = await page.evaluate(() => { const b = document.querySelector('.mhm-body'); if (!b) return 0; const br = b.getBoundingClientRect(); let bottom = br.top; for (const el of b.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.height && r.bottom > bottom) bottom = r.bottom; } return Math.min(1, (bottom - br.top + b.scrollTop) / b.clientHeight); });
          check(`${T}「${tab}」: 中身が見える高さの75%以上を使う(空き枠が少ない)`, fill >= 0.75, `${Math.round(fill * 100)}%`);
        }
          if (tab === 'deck') check(`${T}デッキの型の名前「${want.deck}」`, (await page.locator('[data-assistant-masmon-deck]').innerText().catch(() => '')).includes(want.deck));
          if (tab === 'taste') check(`${T}好き・苦手・好きな色が出る`, (await page.locator('[data-assistant-masmon-taste^="like:"]').count()) >= 1 && ((await page.locator('[data-assistant-masmon-taste^="dislike:"]').count()) >= 1) === (want.dis > 0) && (await page.locator('[data-assistant-masmon-color]').count()) === want.colors);
          const ng = await layoutProblems(page);
          check(`${T}「${tab}」: 端にくっつかない・はみ出さない・切れない・絵が出る`, !ng.length, ng.slice(0, 4).join(' / '));
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-${TABS.indexOf(tab) + 1}-${tab}-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
        }
        await page.locator('[data-assistant-masmon-close]').click({ timeout: 3000 }).catch(() => {});
        check(`${T}閉じると部屋のシートに戻る`, (await page.locator('[data-assistant-masmon-sheet]').count()) === 0 && (await page.locator('[data-assistant-life-room-sheet]').count()) === 1);
      await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-sheet] > button[aria-label="閉じる"]'); if (b) b.click(); });
        await page.locator('[data-assistant-life-room-sheet]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      }
      check(`${T}画面のエラーが無い`, !errors.length, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

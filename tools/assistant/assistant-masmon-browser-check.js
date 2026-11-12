// 助手ライフ: 部屋の「🐾 マスモン」(56-assistant-life-masmon.jsx)を本物の画面で開いて確かめる。
//   node tools/assistant/assistant-masmon-browser-check.js          検査(縦 390×844・横 844×390・🔄横から戻った 390×844)
//   node tools/assistant/assistant-masmon-browser-check.js --shots  止め絵も撮る(docs/progress/assistant-peer/shots/masmon-<タブ>-<向き>.jpg)
//   MASMON_TAG_MOCK=1 で、出かけ札を上へ寄せた見本の形を当てて見る(ナカヨシ8が札を動かす前の確かめ用)
//   MASMON_LOW_BOND=1 で、仲良し度が低い(まだ迎えていない)ままの画面を見る
//   MASMON_ALL=1 で8人ぶん・MASMON_WHO=dra でその1人(ふだんはききだけ)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
// 見るもの:
//   ① 部屋のシートに「🐾 マスモン」の1行があり、押すとシートが開く/4つのタブ(マスモン・編成・デッキ・好き苦手)が全部出る
//   ② マスモンは仲良し度 Lv までの数(引き直し: Lv1 で1体・Lv2 ごとに1体・最大8体)・勇者モンが1体・染めた絵が出ている(絵の読み込みに失敗していない)
//   ③ 枠の端にカードがくっつかない(パネルの左右から 6px 以上あける)・横にはみ出さない・名前が「…」で切れない
//   ④ 口: assistantLifeCardStyle・assistantLifeTasteOf が8人ぶん返る(印が偽なら null)
//   ⑤ 部屋にいるマスモン: 札・顔・吹き出し・扉・名札に重ならない/部屋からはみ出さない/一緒に出かけたマスモンは部屋に出ない/歩く/動きを減らす設定では止まる
//   ⑥ 画面のエラーが無い
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9273;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const { MIME, STORY_IDS, seed, toHome, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
const SHOTS = process.argv.includes('--shots');
const GROW = !!process.env.MASMON_GROW; // 育成基盤(印 assistantMasmonGrow を真にして・2026-11-11 キズナ4)
const BOND = !!process.env.MASMON_BOND; // 絆(印 assistantMasmonBond を真にして・くわしい画面の総合力・忠誠度・人気・方針・年齢・型・叱る/褒める・2026-11-12 キズナ)。--shots で masmon-bond-*.png
const ASK = !!process.env.MASMON_ASK; // 「提案する」の流れも確かめる(2026-11-08 キズナ4)
const shotDir = process.env.MASMON_SHOT_DIR ? path.resolve(process.env.MASMON_SHOT_DIR) : path.join(root, 'docs/progress/assistant-peer/shots');
//   MASMON_SEED=◯◯ で、そのプレイヤーの種でマスモンを決めて開く(プレイヤーごとに違うマスモン ❶B の止め絵用)
const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const VIEWS = [{ id: 'p', name: '縦 390×844', w: 390, h: 844 }, { id: 'l', name: '横 844×390', w: 844, h: 390 }, { id: 'r', name: '🔄横から戻った 390×844', w: 390, h: 844, rot: true }];
// iPhone SE/8 の横(667×375)も見る(2026-11-08 ミハリ: 667 では歩くマスモンが1部屋しか出なかった)
VIEWS.push({ id: 's', name: '横 667×375', w: 667, h: 375 });
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
      if (process.env.MASMON_SEED) await page.addInitScript((sd) => { try { if (localStorage.getItem('mh_assistant_life_masmon_v1') === null) localStorage.setItem('mh_assistant_life_masmon_v1', JSON.stringify({ v: 1, seed: sd })); } catch (_) {} }, process.env.MASMON_SEED);
      await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      // MASMON_ASK=1: 「提案する」(kind:'masmon_suggest')に偽物の AI で答える(色=好きな色の1つ目を部位0に/勇者モン=2番目の枠/迎える=候補の1つ目/デッキ=推し・守り・まったり作戦)
      if (ASK) await page.route(/functions\/v1\/assistant-chat/, async (r) => {
        let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch {}
        if (b.kind !== 'masmon_suggest') return r.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        const c = b.ctx || {}; const replies = { yes: 'いいね、そうしてみるよ', some: '少しだけ変えてみるね', no: 'それはちょっと…ごめんね' };
        const base = { name: '', colors: [], monster: '', slot: 0, face: '', deckName: '', plan: '', replies };
        const favId = (c.colors || []).find(x => (c.fav || []).includes(x.label));
        const result = /を鍛えて/.test(b.text || '') ? { ...base, kind: 'train', train: 'hit' }
          : /育て方/.test(b.text || '') ? { ...base, kind: 'grow', grow: (c.mon && c.mon.grow) === '攻撃型' ? '防御型' : '攻撃型' }
          : /付けられない名前/.test(b.text || '') ? { ...base, kind: 'none', blocked: 'name' }
          : /みんなの名前/.test(b.text || '') ? { ...base, kind: 'nameStyle', style: '名前の最後に♪', names: (c.team || []).map(t => ({ slot: t.slot, n: `${t.nick}♪` })) }
          : /入れ替え/.test(b.text || '') ? { ...base, kind: 'swap', monster: ((c.cands || [])[0] || {}).id || '', name: 'あたらしい♪' }
          : b.from === 'masmon' ? { ...base, kind: 'color', colors: [{ part: 0, color: favId ? favId.id : 'orange' }] }
          : b.from === 'hero' ? { ...base, kind: 'hero', slot: ((c.team || [])[1] || {}).slot || 1 }
          : b.from === 'welcome' ? { ...base, kind: 'welcome', monster: ((c.cands || [])[0] || {}).id || '' }
          : { ...base, kind: 'deck', face: 'oshi', plan: 'guard', deckName: 'まったり作戦' };
        await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kind: 'masmon_suggest', result }) });
      });
      // MASMON_REAL_NAMES=1: 名前の頼み(assistant-chat)だけ本番の関数へ通して、AI の名前が入るのを確かめる(1回だけ呼ぶ・費用 約0.2円)
      if (process.env.MASMON_REAL_NAMES && v.id === 'p') await page.route(/functions\/v1\/assistant-chat/, async (r) => {
        // ブラウザ道具の通信は入れ物の中継を通らないことがあるので、curl で送る(見出しの Origin だけ本番の形に)
        const req = r.request(); const h = req.headers();
        const out = await new Promise((res) => require('child_process').execFile('curl', ['-sS', '-m', '40', '-X', 'POST', req.url(), '-H', `apikey: ${h.apikey || ''}`, '-H', 'Content-Type: application/json', '-H', 'Origin: https://aknkakykhk-maker.github.io', '--data-binary', req.postData() || '{}'], { maxBuffer: 1 << 20 }, (e, so) => res(e ? '{"ok":false}' : so)));
        await r.fulfill({ status: 200, contentType: 'application/json', body: out });
      });
      await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await toHome(page);
      if (GROW || BOND) await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonGrow = true; });
      if (BOND) await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonBond = true; });
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
      if (process.env.MASMON_REAL_NAMES && v.id === 'p') {
        await page.waitForFunction(() => ASSISTANT_MASMON_STORE.state.draw.named === true, null, { timeout: 40000 }).catch(() => {});
        const r = await page.evaluate(() => { const st = ASSISTANT_MASMON_STORE.state; const all = Object.values(st.draw.made).flat(); return { named: st.draw.named, ai: all.filter(t => t.ai).length, n: all.length, kiki: (st.draw.made.kiki || []).map(t => t.nick).join('・') }; });
        check(`${T0}本番の関数で AI の名前が入る(印 assistantMasmonNamesApi)`, r.named && r.ai >= r.n * 0.7, `${r.ai}/${r.n}体 きき: ${r.kiki}`);
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
        check(`${T}部屋のマスモンは1部屋に1体まで(2重に出ない)`, await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-room]')].every(r => r.querySelectorAll('[data-assistant-life-room-masmon-pet]').length <= 1)));
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
      // 667×375 もシートまで見る(細い札で種類名・名前・育ち方を切らずに折り返すか)
      for (const WHO of WHOS) {
      const T = `${T0}${WHO} `;
      const low = !!process.env.MASMON_LOW_BOND; // 仲良し度が低い(まだ迎えていない)ときの確かめ
      // 引き直し(draw v:2): 仲良し度 Lv1 で1体・Lv2 ごとに1体(最大8体)。迎える場面は、まとめて迎えた最後の1体だけ
      const want = await page.evaluate(({ id, low }) => { const p = ASSISTANT_MASMON_PLAN.find(a => a.id === id); const key = id === 'mua' ? 'mh_assistant_bond_v1' : `mh_assistant_bond_${id}_v1`; let pts = 0; try { pts = normalizeAssistantBond(JSON.parse(localStorage.getItem(key))).points; } catch (_) {} const lv = low ? 1 : assistantBondLevel(pts); const made = (ASSISTANT_MASMON_STORE.state.draw.made[id] || []); const all = made.filter(t => t.welcome <= lv).length; return { deck: p.deck.name, colors: p.favColors.length, dis: p.dislikeMon.length, all, bench: all > 1 ? 1 : 0, total: made.length, lv }; }, { id: WHO, low });
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
          check(`${T}迎える場面(まとめて迎えた最後の1体・ひとこと・名前入り)`, (await sc.count()) === 1 && line.length > 10 && !/\{(name|mon|nick)\}/.test(line), line.slice(0, 40));
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
            if (GROW) { await page.waitForTimeout(600); const rs = await page.locator('[data-assistant-masmon-row] [data-amg-stats]').count(); check(`${T}育成基盤: 一覧の札に6能力のゲージ`, rs === n && n > 0, `${rs}/${n}`); if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-grow-list-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 }); }
            const leads = await page.locator('[data-assistant-masmon-row] .mhm-lead:not(.mhm-bench)').count();
            check(`${T}マスモンは仲良し度 Lv${want.lv} までの${want.all}体・勇者モンは1体`, n === want.all && leads === 1, `${n}体・勇者モン${leads}`);
            // 押すと詳細画面(見るだけ)
            await page.locator('[data-assistant-masmon-row]').first().click();
            await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            await page.waitForTimeout(1200);
            const dt = await page.evaluate(() => { const d = document.querySelector('[data-assistant-masmon-detail]'); if (!d) return null; const ng = []; for (const t of d.querySelectorAll('.truncate')) if (t.scrollWidth > t.clientWidth + 1) ng.push(t.textContent.slice(0, 16)); const b = d.querySelector('.mhm-body'); if (b && b.scrollWidth > b.clientWidth + 1) ng.push('横にはみ出す'); return { ng, parts: ['stats', 'skills', 'dye', 'talk'].filter(k => d.querySelector(`[data-assistant-masmon-detail-${k}]`)).length }; });
            check(`${T}押すと詳細画面(能力・技・染めた色・ひとこと)・切れない`, dt && dt.parts === 4 && !dt.ng.length, dt ? `${dt.parts}つ ${dt.ng.join(' / ')}` : '開かない');
            if (BOND) { // 絆: 総合力とランク・忠誠度・人気・方針・年齢・型の曲線・叱る/褒める(止め絵のため、見本の値を絆の保存に入れて見る)
              await page.evaluate(async () => { await AMGB_STORE.load(); const aid = 'kiki'; const k = Object.keys(AMG_STORE.state.mons[aid] || {})[0]; if (!k) return; const [slot, monster] = k.split(':'); const key = `${aid}:${slot}:${monster}`;
                const b = AMGB_STORE.state.mons[key] || {}; amgbSave({ ...AMGB_STORE.state, mons: { ...AMGB_STORE.state.mons, [key]: { ...b, loy: 72, pop: 64, pol: 1, pp: 4, gt: 1, age: 9, life: 300, last: amgSlotDay(amgSlotOf()), touch: amgSlotDay(amgSlotOf()), fight: amgSlotDay(amgSlotOf()), sc: { d: -1, n: 0 }, rs: [{ s: amgSlotOf(), r: 'great' }] } } }); });
              await page.waitForTimeout(500);
              const bp = await page.evaluate(() => { const p = document.querySelector('[data-amgb-panel]'); if (!p) return null; p.scrollIntoView({ block: 'center' }); const r = p.getBoundingClientRect(); const ng = []; if (r.right > window.innerWidth + 1 || r.left < -1) ng.push('はみ出す'); for (const t of p.querySelectorAll('p,span,b')) if (t.scrollWidth > t.clientWidth + 2 && getComputedStyle(t).overflow === 'hidden') ng.push(t.textContent.slice(0, 12));
                return { total: !!p.querySelector('[data-amgb-total]'), rank: p.querySelector('[data-amgb-rank]')?.textContent || '', loy: p.querySelector('[data-amgb-loy]')?.textContent, pop: p.querySelector('[data-amgb-pop]')?.textContent, curve: !!p.querySelector('[data-amgb-curve]'), acts: p.querySelectorAll('[data-amgb-act]').length, ng }; });
              check(`${T}絆: 総合力とランク・忠誠度・人気・型の曲線・叱る/褒めるが出て、はみ出さない`, bp && bp.total && bp.rank && bp.loy === '72' && bp.pop === '64' && bp.curve && bp.acts === 2 && !bp.ng.length, JSON.stringify(bp));
              if (SHOTS) await page.locator('[data-amgb-panel]').screenshot({ path: path.join(shotDir, `masmon-bond-panel-${v.id}.png`) }).catch(() => {});
              await page.locator('[data-amgb-act="praise"]').click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(400);
              const msg = await page.evaluate(() => document.querySelector('[data-amgb-msg]')?.textContent || '');
              check(`${T}絆: 褒めると忠誠度が上がり、ボタンが消える`, /忠誠度 \+3/.test(msg) && (await page.locator('[data-amgb-act]').count()) === 0, msg);
              if (SHOTS) await page.locator('[data-amgb-panel]').screenshot({ path: path.join(shotDir, `masmon-bond-praised-${v.id}.png`) }).catch(() => {});
            }
            if (GROW) { // 育成基盤: 6能力・疲労・ストレス・今日の育成。一覧の札にも6能力
              const g = await page.evaluate(() => ({ stats: document.querySelectorAll('[data-assistant-masmon-detail] [data-amg-card] [data-amg-stat]').length, fat: !!document.querySelector('[data-amg-fat]'), str: !!document.querySelector('[data-amg-str]'), log: document.querySelectorAll('[data-amg-log]').length, saved: typeof AMG_STORE !== 'undefined' && Object.keys(AMG_STORE.state.mons || {}).length }));
              check(`${T}育成基盤: くわしい画面に6能力・疲労・ストレス・今日の育成`, g.stats === 6 && g.fat && g.str && g.log >= 1 && g.saved >= 1, JSON.stringify(g));
              // 関わるほど強くなる: 見に来た印・次の回の訓練を自分で決める
              await page.locator('[data-amg-pick-select]').selectOption('heavy:hit').catch(() => {});
              await page.locator('[data-amg-pick-go]').click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(400);
              const pk = await page.evaluate(() => ({ now: document.querySelector('[data-amg-pick-now]')?.textContent || '', viewed: !!document.querySelector('[data-amg-viewed]') }));
              check(`${T}育成基盤: 見に来た印が出て、次の回の訓練を決められる`, pk.viewed && /高速射撃/.test(pk.now), JSON.stringify(pk));
              if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-grow-detail-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
              if (ASK) { // 「命中を鍛えて」→ 受けると、しばらく命中を鍛える(育成の相談)
                await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonSuggest = true; });
                await page.locator('[data-assistant-masmon-ask-open="masmon"]').first().click({ timeout: 4000 }).catch(() => {});
                await page.locator('[data-assistant-masmon-ask-text]').fill('命中を鍛えて').catch(() => {});
                await page.locator('[data-assistant-masmon-ask-send]').click().catch(() => {});
                await page.locator('[data-assistant-masmon-ask-result]').waitFor({ timeout: 8000 }).catch(() => {});
                const tr = await page.evaluate((id) => { const f = (AMG_STORE.state.focus || {})[id] || {}; return { res: document.querySelector('[data-assistant-masmon-ask-result]')?.getAttribute('data-assistant-masmon-ask-result'), focus: Object.values(f).map(x => x.k) }; }, WHO);
                check(`${T}育成の相談: 「命中を鍛えて」を受けると、命中を優先する`, tr.res === 'yes' && tr.focus.includes('hit'), JSON.stringify(tr));
                if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-grow-ask-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
                await page.locator('[data-assistant-masmon-ask] [data-mhl-sheet-close]').click({ timeout: 3000 }).catch(() => {});
              }
            }
            if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-6-detail-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
            await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 3000 }).catch(() => {});
          }
          if (tab === 'team') check(`${T}編成: 勇者モン1体・編成${want.all}/8・まだの枠${want.total - want.all}・道中で仲間にしやすい3体`, (await page.locator('[data-assistant-masmon-hero]').count()) === 1 && (await page.locator('[data-assistant-masmon-team]').count()) === want.all && (await page.locator('[data-assistant-masmon-formation] [data-assistant-masmon-wait]').count()) === want.total - want.all && (await page.locator('[data-assistant-masmon-allies]').count()) === 1, `勇者モン${await page.locator('[data-assistant-masmon-hero]').count()}・編成${await page.locator('[data-assistant-masmon-team]').count()}`);
        if (tab !== 'deck') { // 空いた枠: タブの中身が、見える高さの 75% 以上を使う(社長「ページの空き枠をもっと活用して」)。デッキはカード部の部品が入ってから
          const fill = await page.evaluate(() => { const b = document.querySelector('.mhm-body'); if (!b) return 0; const br = b.getBoundingClientRect(); let bottom = br.top; for (const el of b.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.height && r.bottom > bottom) bottom = r.bottom; } return Math.min(1, (bottom - br.top + b.scrollTop) / b.clientHeight); });
          check(`${T}「${tab}」: 中身が見える高さの75%以上を使う(空き枠が少ない)`, fill >= 0.75, `${Math.round(fill * 100)}%`);
        }
          if (tab === 'deck' && (await page.locator('[data-assistant-masmon-deck-styles]').count())) {
            // カード部の3つのデッキ(印 cardGrowStyle が真)。2026-11-08 推し・好き・素顔に作り直し(カード部ルールくん):
            //   切りかえ3つ(推し/好き/素顔)・「よく使う」は今の気分に合う顔だけ(カード部の口 cardAiDeckMainFace。分からなければ印なし)・押すと中身が切りかわる・名前が出る
            const faces = await page.evaluate(() => typeof cardAssistantFacePreview === 'function');
            const ids = faces ? ['oshi', 'suki', 'sugao'] : ['attack', 'guard', 'normal'];
            const fav = await page.evaluate(([id, f]) => (f ? (typeof cardAiDeckMainFace === 'function' ? cardAiDeckMainFace(id) : null) : (ASSISTANT_MASMON_CARD_STYLE[id] || 'normal')), [WHO, faces]);
            const favOk = fav ? (await page.locator(`[data-assistant-masmon-deck-style="${fav}"] [data-assistant-masmon-deck-fav]`).count()) === 1 && (await page.locator('[data-assistant-masmon-deck-fav]').count()) === 1
              : (await page.locator('[data-assistant-masmon-deck-fav]').count()) === 0;
            check(`${T}デッキの切りかえ3つ(${ids.join('/')})・「よく使う」は ${fav || '無し'}`, (await page.locator('[data-assistant-masmon-deck-style]').count()) === 3 && ids.every(Boolean) && favOk);
            const seen = [];
            for (const sid of ids) {
              await page.locator(`[data-assistant-masmon-deck-style="${sid}"]`).click();
              await page.waitForTimeout(300);
              const name = await page.locator('[data-card-assistant-deck-name]').innerText().catch(() => '');
              seen.push(`${sid}:${(await page.locator(`[data-card-assistant-deck-view="${sid}"]`).count())}:${name.slice(0, 12)}`);
              if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-3-deck-${sid}-${v.id}.jpg`), type: 'jpeg', quality: 80 });
            }
            check(`${T}押すと3つのデッキの中身が切りかわり、名前が出る`, seen.every(x => /:1:.+/.test(x)), seen.join(' / '));
          } else if (tab === 'deck') check(`${T}デッキの型の名前「${want.deck}」`, (await page.locator('[data-assistant-masmon-deck]').innerText().catch(() => '')).includes(want.deck));
          if (tab === 'taste') check(`${T}好き・苦手・好きな色が出る`, (await page.locator('[data-assistant-masmon-taste^="like:"]').count()) >= 1 && ((await page.locator('[data-assistant-masmon-taste^="dislike:"]').count()) >= 1) === (want.dis > 0) && (await page.locator('[data-assistant-masmon-color]').count()) === want.colors);
          const ng = await layoutProblems(page);
          check(`${T}「${tab}」: 端にくっつかない・はみ出さない・切れない・絵が出る`, !ng.length, ng.slice(0, 4).join(' / '));
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-${TABS.indexOf(tab) + 1}-${tab}-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
        }
        if (ASK) { // 「提案する」(印 assistantMasmonSuggest を真にして、偽物の AI で)
          await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonSuggest = true; });
          const send = async (open, text, shot) => {
            await page.locator(`[data-assistant-masmon-ask-open="${open}"]`).first().click({ timeout: 4000 });
            await page.locator('[data-assistant-masmon-ask-text]').fill(text);
            if (await page.locator('[data-assistant-masmon-ask-send]').isDisabled()) { const left = await page.locator('[data-assistant-masmon-ask-left]').innerText().catch(() => ''); if (SHOTS && shot) await page.screenshot({ path: path.join(shotDir, `masmon-8-ask-${open}-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 }); await page.locator('[data-assistant-masmon-ask] [data-mhl-sheet-close]').click({ timeout: 3000 }).catch(() => {}); return { res: 'limit', what: '', left }; }
            await page.locator('[data-assistant-masmon-ask-send]').click();
            await page.locator('[data-assistant-masmon-ask-result]').waitFor({ timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(open === 'masmon' ? 2500 : 600);
            const r = { res: await page.locator('[data-assistant-masmon-ask-result]').getAttribute('data-assistant-masmon-ask-result').catch(() => ''), what: await page.locator('[data-assistant-masmon-ask-what]').innerText().catch(() => '') };
            const ng = await layoutProblems(page);
            check(`${T}提案「${open}」: 返事が出る・切れない`, !!r.res && !ng.length, `${r.res} ${r.what} ${ng.slice(0, 2).join(' / ')}`);
            if (SHOTS && shot) await page.screenshot({ path: path.join(shotDir, `masmon-8-ask-${open}-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
            await page.locator('[data-assistant-masmon-ask] [data-mhl-sheet-close]').click({ timeout: 3000 }).catch(() => {});
            return r;
          };
          await page.locator('[data-assistant-masmon-tab-btn="mons"]').click(); await page.waitForTimeout(800);
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const c1 = await send('masmon', '体を好きな色にしてみたら？', true);
          check(`${T}提案(色): 好きな色は受けて、色が変わる`, c1.res === 'yes' && /を/.test(c1.what), c1.what);
          check(`${T}提案(色)のあと「前の色に戻してもらう」が出る`, (await page.locator('[data-assistant-masmon-undo="color"]').count()) === 1);
          if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-8-ask-undo-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
          await page.locator('[data-assistant-masmon-undo="color"]').click().catch(() => {});
          await page.waitForTimeout(500);
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const logTxt = await page.locator('[data-assistant-masmon-dye-log]').innerText().catch(() => '');
          check(`${T}提案(色)を戻したら「前の色に戻しました」・戻すボタンは消える`, /前の色に戻しました/.test(logTxt) && (await page.locator('[data-assistant-masmon-undo="color"]').count()) === 0, logTxt.slice(0, 30));
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          // 育て方(2026-11-09 社長「育て方も受ける」): 受けると印が付き、能力のゲージは下がらない。「前の育て方に戻してもらう」で戻る
          {
            const gNow = () => page.evaluate((id) => { const t = (assistantMasmonPlanOf(id).team || [])[0] || {}; return { grow: t.grow, mine: t.growMine, st: assistantMasmonStats(t) }; }, WHO);
            const g0 = await gNow();
            await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            const gr = await send('masmon', '育て方を変えてみたら？', false);
            await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
            await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            const g1 = await gNow();
            const mark = await page.locator('[data-assistant-masmon-grow-mine]').innerText().catch(() => '');
            const notLower = g0.st && g1.st && ['hp', 'atk', 'def', 'guts'].every(k => g1.st[k] >= g0.st[k] - 1e-9);
            check(`${T}提案(育て方): 受けると育て方が変わり「🌱 育て方: …(あなたの提案)」が出る・ゲージは下がらない`, gr.res === 'yes' && g1.grow !== g0.grow && /🌱 育て方: .+あなたの提案/.test(mark) && notLower, `${gr.res} ${g0.grow}→${g1.grow} ${mark}`);
            if (SHOTS) await page.screenshot({ path: path.join(shotDir, `masmon-8-ask-grow-${v.id}${WHO !== 'kiki' ? '-' + WHO : ''}.jpg`), type: 'jpeg', quality: 80 });
            await page.locator('[data-assistant-masmon-undo="grow"]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400);
            const g2 = await gNow();
            check(`${T}提案(育て方)を戻すと前の育て方に戻り、印が消える`, g2.grow === g0.grow && !g2.mine, `${g2.grow}`);
            await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          }
          // 名前として通さない言葉(2026-11-09 社長「全然聞いてくれない」): 「分からない」ではなく、助手の口調で付けられないと言う・回数は減らない
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const usedNg0 = await page.evaluate((id) => assistantMasmonAskUsed(id), WHO);
          const bn = await send('masmon', '付けられない名前にしてみたら？', false);
          const lastNg = await page.evaluate((id) => (ASSISTANT_MASMON_STORE.state.asked || []).filter(x => x.a === id).slice(-1)[0] || {}, WHO);
          check(`${T}提案(付けられない名前): 断る返事になり、回数は減らない`, bn.res === 'no' && /名前/.test(lastNg.reply || '') && (await page.evaluate((id) => assistantMasmonAskUsed(id), WHO)) === usedNg0, `${bn.res} ${lastNg.reply}`);
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          // 入れ替え(2026-11-09 社長「マスモン変更提案とかもほしい」): 前のマスモンは残り、「前のマスモンに戻してもらう」で戻せる
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const m0 = await page.locator('[data-assistant-masmon-detail]').getAttribute('data-assistant-masmon-detail');
          const sw = await send('masmon', '別のマスモンに入れ替えてみたら？名前は「あたらしい♪」で', true);
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const m1 = await page.locator('[data-assistant-masmon-detail]').getAttribute('data-assistant-masmon-detail');
          check(`${T}提案(入れ替え): 別の種類になり、「前のマスモンに戻してもらう」が出る`, sw.res !== 'yes' || (m1 !== m0 && (await page.locator('[data-assistant-masmon-undo="swap"]').count()) === 1), `${m0}→${m1} ${sw.res} ${sw.what}`);
          if (sw.res === 'yes') {
            await page.locator('[data-assistant-masmon-undo="swap"]').click().catch(() => {}); await page.waitForTimeout(500);
            await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            check(`${T}提案(入れ替え)を戻すと前のマスモンに戻る`, (await page.locator('[data-assistant-masmon-detail]').getAttribute('data-assistant-masmon-detail')) === m0);
          }
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          // 名前のくせ(2026-11-09 社長「なまえの付け方のくせを提案して全マスモンに適用」): 全部の名前が変わり、一覧に「やめてもらう」が出て、やめると戻る
          await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
          const ns = await send('masmon', 'みんなの名前の最後に♪を付けて', false);
          await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
          const names1 = await page.evaluate((id) => assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, id).map(t => t.nick), WHO);
          check(`${T}提案(名前のくせ): 全部の名前にくせが当たり、「やめてもらう」が出る`, ns.res !== 'yes' || (names1.every(n => n.endsWith('♪')) && (await page.locator('[data-assistant-masmon-undo="nameStyle"]').count()) === 1), names1.join('・'));
          let swapped = null;
          if (ns.res === 'yes') { // くせ → 入れ替え → やめる: 入れ替えたマスモンの名前は、前のマスモンのくせ前の名前に変わらない(ミハリ)
            await page.locator('[data-assistant-masmon-row]').first().click(); await page.locator('[data-assistant-masmon-detail]').waitFor({ timeout: 3000 }).catch(() => {});
            const sw2 = await send('masmon', '別のマスモンに入れ替えてみたら？', false);
            await page.locator('[data-assistant-masmon-detail-close]').click({ timeout: 2000 }).catch(() => {});
            if (sw2.res === 'yes') swapped = await page.evaluate((id) => { const r = assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, id)[0]; return { slot: r.slot, nick: r.nick }; }, WHO);
          }
          if (ns.res === 'yes') { await page.locator('[data-assistant-masmon-undo="nameStyle"]').click().catch(() => {}); await page.waitForTimeout(400); const rows2 = await page.evaluate((id) => assistantMasmonRowsOf(ASSISTANT_MASMON_STORE.state, id).map(t => ({ slot: t.slot, nick: t.nick })), WHO); const others = rows2.filter(r => !swapped || r.slot !== swapped.slot); check(`${T}提案(名前のくせ)をやめると前の名前に戻る・入れ替えたマスモンの名前はそのまま`, others.every(r => !r.nick.endsWith('♪')) && (!swapped || (rows2.find(r => r.slot === swapped.slot) || {}).nick === swapped.nick), rows2.map(r => r.nick).join('・')); }
          const hasWait = (await page.locator('[data-assistant-masmon-ask-open="welcome"]').count()) > 0;
          if (hasWait) { const w = await send('welcome', '次はこのモンスターを迎えてみたら？', true); check(`${T}提案(迎える): 希望が残る`, (await page.locator('[data-assistant-masmon-wish]').innerText().catch(() => '')).includes('希望') || w.res === 'no', w.res); }
          await page.locator('[data-assistant-masmon-tab-btn="team"]').click(); await page.waitForTimeout(800);
          const before = await page.locator('[data-assistant-masmon-hero]').getAttribute('data-assistant-masmon-hero');
          const h = await send('hero', '勇者モンを2番目にしてみたら？', true);
          const after = await page.locator('[data-assistant-masmon-hero]').getAttribute('data-assistant-masmon-hero');
          check(`${T}提案(勇者モン): 受けたら勇者モンが変わる・戻すボタン`, h.res !== 'yes' || (before !== after && (await page.locator('[data-assistant-masmon-undo="hero"]').count()) === 1), `${before}→${after} ${h.res}`);
          await page.locator('[data-assistant-masmon-tab-btn="deck"]').click(); await page.waitForTimeout(600);
          const d = await send('deck', '推しのデッキは守りで「まったり作戦」にしたら？', true);
          const used = await page.evaluate((id) => assistantMasmonAskUsed(id), WHO);
          check(`${T}提案(デッキ): 希望が残る(カード部の口 assistantLifeDeckWish)。受けてもらうのは1日10回まで(11回目は押せない)`, used <= 10 && (d.res === 'limit' ? used === 10 && /あと 0回/.test(d.left) : (d.res === 'no' || (await page.evaluate((id) => !!assistantLifeDeckWish(id), WHO)))), `${d.res} 使った${used}回`);
        }
        await page.locator('[data-assistant-masmon-close]').click({ timeout: 3000 }).catch(() => {});
        check(`${T}閉じると部屋のシートに戻る`, (await page.locator('[data-assistant-masmon-sheet]').count()) === 0 && (await page.locator('[data-assistant-life-room-sheet]').count()) === 1);
      await page.evaluate(() => { const b = (document.querySelector('[data-assistant-life-room-sheet] [data-assistant-life-roomview-close]') || document.querySelector('[data-assistant-life-room-sheet] > button[aria-label="閉じる"]')); if (b) b.click(); });
        await page.locator('[data-assistant-life-room-sheet]').waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
      }
      check(`${T}画面のエラーが無い`, !errors.length, errors.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\nNG が ${failed} 件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

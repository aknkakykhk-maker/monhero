// MFバトルカード: 助手のデッキの中身を見せる部品(87-card-assistant-deck-view.jsx)を、実際の画面で開いて押して確かめる(2026-11-08 カード部ツナグ)。
//   node tools/card/card-assistant-deck-view-browser-check.js      縦 390×844・横 844×390(カードの画面には🔄横は無い)
//   SHOT_DIR=<フォルダ> を付けると止め絵を残す
//
// 助手部のマスモンのシートと同じ器(56 の ASSISTANT_MASMON_CSS の .mhm-panel / .mhm-body)の中に、CardAssistantDeckView を開く。
//   ① 印 cardGrowStyle が偽のあいだは何も出さない(部品も札も null)
//   ② 8人 × 3つの型と、推し・好き・素顔の3つで、名前・3体・切り札が出る。種類ごとの一覧の枚数を足すと50枚。×N はデッキの中の枚数と同じ
//   ③ カードを押すと大きく見る窓(data-card-detail)が、シート(z-index 30)より上に出て、閉じられる
//   ④ 字が「…」で切れない・箱からはみ出さない・カードの札(.mhm-card)がパネルの端から 6px 以上あく(助手部の検査と同じ見方)
//   ⑤ 札の言葉: 「今日のデッキ」の見出し+型の印+デッキの名前(CardFoeDeckChip)・「チーム」の見出し+自動の名前(CardFoeTeamName)
//   ⑦ 名前の既定(社長 Q4 A): AI の名前が無いときは「のんびり長期戦・攻め」(ふつうは名前だけ)。タブに「よく使う3体」「3体は対戦のたびに変わります」(Q2 B)
//   ⑧ 実際の流れ(印をページの中でだけ立てる): VS の「チーム」と「今日のデッキ」・投了したあとの結果の2つが出て、
//      画面からはみ出さず、互いにも3体・吹き出しにも重ならず、切れない。相手えらびの型の欄にも今日のデッキが1つ出て、
//      その型・名前が VS・結果と同じ(ルールが先に決める cardAiDeckNextStyle。見せた型と戦う型がずれない)
//   ⑨ 札のデッキの名前が途中で折れない(8人×3つの既定の名前と12字の名前を、200px の箱で。入らないときは見出しと名前の間で行が分かれる)
//   ⑥ 実行時エラーが無い
const fs = require('fs');
const path = require('path');
const http = require('http');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const WHO = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin'];
const STYLES = ['attack', 'guard', 'normal'];
// 2026-11-08 推し・好き・素顔に作り直し(ルールくん)。今の口は顔の id を返す。型の id は前のリプレイを読むために残す
const FACES = ['oshi', 'suki', 'sugao'];
const ICON = '(⚔️|🛡️|⚖️|💖|⭐|🎭)';

(async () => {
  let pw;
  try { pw = require('playwright'); } catch { console.log('SKIP: playwright が無いので画面は見ません'); process.exit(0); }
  const { quietBootSeed } = require(path.join(ROOT, 'tools', 'boot', 'quiet-boot-seed'));
  const PORT = Number(process.env.CARD_PORT) || 8983;
  const SHOT = process.env.SHOT_DIR || '';
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const server = await new Promise((res) => { const s = http.createServer((req, r) => { const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '')); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(PORT, () => res(s)); });
  const b = await pw.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    for (const [view, vw, vh] of [['縦', 390, 844], ['横', 844, 390]]) {
      const land = vw > vh;
      const page = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: SHOT ? 2 : 1, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      await page.route(/supabase\.co\/|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(quietBootSeed());
      await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => typeof CardAssistantDeckView === 'function' && typeof cardAssistantDeckPreview === 'function' && typeof ASSISTANT_MASMON_CSS === 'string' && window.ReactDOM, null, { timeout: 120000 });
      // 助手部のシートと同じ器に開く。mount(who, style, flag)
      await page.evaluate((land) => {
        const host = document.createElement('div'); host.id = '__deck';
        host.style.cssText = 'position:fixed;inset:0;z-index:2147480000;background:#0b1020';
        document.body.appendChild(host);
        const root = ReactDOM.createRoot(host);
        window.__mount = (who, styleId, on) => {
          RELEASE_FLAGS.cardGrowStyle = on;
          root.render(React.createElement('div', { className: 'absolute inset-0', style: { zIndex: 30 } },
            React.createElement('style', null, ASSISTANT_MASMON_CSS),
            React.createElement('div', { className: `mhm-panel ${land ? 'is-land' : ''}` },
              React.createElement('div', { className: 'mhm-body mt-2' },
                React.createElement(CardAssistantDeckView, { key: `${who}-${styleId}-${on}`, who, styleId, land }),
                React.createElement('div', { className: 'mt-2 flex flex-col gap-1.5' },
                  React.createElement(CardFoeTeamName, { text: 'ドラのカチコチねばり腰の砦' }),
                  ['foe', 'vs', 'result'].map((k) => React.createElement(CardFoeDeckChip, { key: k, name: cardAssistantDeckDisplayName('dra', 'guard'), styleId: 'guard', kind: k })))))));
        };
      }, land);
      const mount = async (who, s, on = true) => { await page.evaluate(([w, st, o]) => window.__mount(w, st, o), [who, s, on]); await page.waitForTimeout(250); };
      // ① 印が偽
      await mount('dra', 'guard', false);
      const offCount = await page.evaluate(() => document.querySelectorAll('[data-card-assistant-deck-view], [data-card-foe-deck-chip], [data-card-foe-team-name]').length);
      check(`① ${view}: 印 cardGrowStyle が偽のあいだは、部品も札も出さない`, offCount === 0, `${offCount}個`);
      // ② 8人 × 3つ
      const bad = [];
      for (const who of WHO) {
        for (const s of [...STYLES, ...FACES]) {
          await mount(who, s, true);
          const r = await page.evaluate(([who, s]) => {
            const v = document.querySelector('[data-card-assistant-deck-view]');
            const face = s === 'oshi' || s === 'suki' || s === 'sugao';
            const p = face ? cardAssistantFacePreview(who, s, 'normal') : cardAssistantDeckPreview(who, s, 'normal');
            const want = {}; p.cards.forEach((no) => { want[no] = (want[no] || 0) + 1; });
            const sum = [...document.querySelectorAll('[data-card-assistant-deck-group] [data-card-assistant-deck-card]')].reduce((n, el) => n + want[el.getAttribute('data-card-assistant-deck-card')], 0);
            const xs = [...document.querySelectorAll('[data-card-assistant-deck-list] [data-card-assistant-deck-card]')].map((el) => { const no = el.getAttribute('data-card-assistant-deck-card'); const b = el.querySelector('b'); return (b ? Number(b.textContent.replace('×', '')) : 1) === want[no]; });
            const base = CARD_AI_STYLE_NAMES[who]; const wantName = face ? cardAiFaceName(who, s) : s === 'normal' ? base : `${base}・${{ attack: '攻め', guard: '守り' }[s]}`;
            return { nameOk: ((document.querySelector('[data-card-assistant-deck-name]') || {}).textContent || '').includes(wantName), note: !!document.querySelector('[data-card-assistant-deck-mon-note]') && /よく使う3体/.test(v.textContent),
              style: v && v.getAttribute('data-card-assistant-deck-view'), name: (document.querySelector('[data-card-assistant-deck-name]') || {}).textContent || '',
              atOk: (Number(p.at) > 0) === /AI が \d+:\d\d に組み直しました/.test(v.textContent), mons: document.querySelectorAll('[data-card-assistant-deck-mon]').length, ace: !!document.querySelector('[data-card-assistant-deck-ace]'), sum, total: p.cards.length, xOk: xs.every(Boolean) };
          }, [who, s]);
          if (!(r.style === s && r.nameOk && r.note && r.mons === 3 && r.ace && r.sum === 50 && r.total === 50 && r.xOk && r.atOk)) bad.push(`${who}/${s}: ${JSON.stringify(r)}`);
        }
      }
      check(`② ${view}: 8人 × 3つの型で、名前(既定は「名前・型」)・よく使う3体と注記・切り札が出て、一覧の合計が50枚・×N がデッキの枚数と同じ・組み直した時刻は AI が組んだときだけ(at が 0 なら出さない)`, bad.length === 0, bad.slice(0, 2).join(' / '));
      // ④ 字が切れない・はみ出さない・端にくっつかない(ドラの守りと、名前の長い助手で)
      const fitBad = [];
      for (const [who, s] of [['dra', 'guard'], ['momosuke', 'attack'], ['erubin', 'normal']]) {
        await mount(who, s, true);
        if (SHOT && who === 'dra') await page.screenshot({ path: path.join(SHOT, `${land ? 'landscape' : 'portrait'}-view-dra-guard.png`) });
        const f = await page.evaluate(() => {
          // 助手部の検査(assistant-masmon-browser-check)と同じく、パネル(.mhm-panel)の左右から 6px 以上あくかを見る
          const body = document.querySelector('.mhm-body').getBoundingClientRect();
          const panel = document.querySelector('.mhm-panel').getBoundingClientRect();
          const out = [];
          document.querySelectorAll('[data-card-assistant-deck-view] .mhm-card').forEach((c) => { const r = c.getBoundingClientRect(); if (r.left - panel.left < 6 || panel.right - r.right < 6) out.push(`札がパネルの端に${Math.round(Math.min(r.left - panel.left, panel.right - r.right))}px`); });
          document.querySelectorAll('[data-card-assistant-deck-view] *').forEach((e) => { if (e.classList.contains('truncate') && e.scrollWidth > e.clientWidth + 1) out.push(`「…」で切れる: ${e.textContent.slice(0, 12)}`); });
          document.querySelectorAll('[data-card-assistant-deck-view] p, [data-card-foe-deck-chip]').forEach((e) => { const r = e.getBoundingClientRect(); if (r.right > body.right + 1 || r.left < body.left - 1) out.push(`はみ出し: ${e.textContent.slice(0, 12)}`); });
          return out;
        });
        fitBad.push(...f.map((x) => `${who}/${s}: ${x}`));
      }
      check(`④ ${view}: 字が「…」で切れず、箱からはみ出さず、札がパネルの端から6px以上あく`, fitBad.length === 0, fitBad.slice(0, 3).join(' / '));
      // ③ カードを押すと大きく見る
      await mount('dra', 'guard', true);
      await page.locator('[data-card-assistant-deck-ace] [data-card-assistant-deck-card]').click();
      const det = await page.evaluate(() => { const d = document.querySelector('[data-card-detail]'); if (!d) return null; const z = Number(getComputedStyle(d).zIndex) || 0; const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { z, onTop: !!(top && d.contains(top)) }; });
      if (SHOT) await page.screenshot({ path: path.join(SHOT, `${land ? 'landscape' : 'portrait'}-view-detail.png`) });
      await page.locator('[data-card-detail]').getByRole('button', { name: '閉じる' }).click().catch(() => page.locator('[data-card-detail]').click());
      await page.waitForTimeout(300);
      const closed = await page.evaluate(() => !document.querySelector('[data-card-detail]'));
      check(`③ ${view}: 切り札を押すと大きく見る窓がシート(z-index 30)より上に出て、閉じられる`, !!det && det.z >= 35 && det.onTop && closed, JSON.stringify({ det, closed }));
      // ⑤ 型の札の言葉
      const chips = await page.evaluate(() => ({ ...Object.fromEntries([...document.querySelectorAll('[data-card-foe-deck-chip]')].map((e) => [e.getAttribute('data-card-foe-deck-chip'), e.textContent])), team: (document.querySelector('[data-card-foe-team-name]') || {}).textContent || '' }));
      check(`⑤ ${view}: 札の言葉(「今日のデッキ」+型の印+名前・「チーム」+自動の名前)`, ['foe', 'vs', 'result'].every((k) => /^今日のデッキ🛡️ のんびり長期戦・守り$/.test(chips[k] || '')) && chips.team === 'チームドラのカチコチねばり腰の砦', JSON.stringify(chips));
      // ⑨ 札のデッキの名前が途中で折れない(部長 2026-11-08: 横の相手えらびで「のんびり長期戦・/守り」と折れた)。
      //    8人×3つの既定の名前と、AI の名前の上限12字(83 の CARD_AI_DECK_NAME_MAX)を、横の相手えらびの型の欄(約210px)より狭い 200px の箱に置く
      const fold = await page.evaluate(() => {
        const names = []; Object.keys(CARD_AI_STYLE_NAMES).forEach((w) => ['attack', 'guard', 'normal'].forEach((st) => names.push([st, cardAssistantDeckDisplayName(w, st)])));
        // 推し・好き・素顔の既定の名前(素顔は よそいき・本音 の両方)
        Object.keys(CARD_AI_FACES).forEach((w) => ['oshi', 'suki', 'yoso', 'honne'].forEach((sl) => names.push([sl === 'yoso' || sl === 'honne' ? 'sugao' : sl, cardAiFaceDefaultName(w, sl)])));
        names.push(['attack', 'ガチガチ鉄壁のカウンター砦'.slice(0, CARD_AI_DECK_NAME_MAX)], ['guard', 'ＷＷＷＷＷＷＷＷＷＷＷＷ'.slice(0, CARD_AI_DECK_NAME_MAX)]);
        const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:200px;z-index:2147483000'; document.body.appendChild(box);
        const r = ReactDOM.createRoot(box); const bad = [];
        ReactDOM.flushSync(() => r.render(React.createElement('div', null, names.map(([st, n], i) => React.createElement(CardFoeDeckChip, { key: i, name: n, styleId: st, kind: 'foe', compact: true })))));
        [...box.querySelectorAll('[data-card-foe-deck-chip]')].forEach((chip, i) => {
          const t = chip.querySelector('[data-card-foe-deck-chip-name]'); const lh = parseFloat(getComputedStyle(t).lineHeight) || 14;
          const tr = t.getBoundingClientRect(); const cr = chip.getBoundingClientRect();
          if (Math.round(tr.height / lh) !== 1 || tr.right > cr.right + 0.5 || cr.right > 200.5 || !t.textContent.includes(names[i][1])) bad.push(`${names[i][1]}(${Math.round(tr.height)}px/${Math.round(tr.right)}px)`);
        });
        r.unmount(); box.remove();
        return { n: names.length, bad };
      });
      check(`⑨ ${view}: 札のデッキの名前が途中で折れない(既定の名前 ${fold.n - 2}個と12字の名前を、200px の箱で)`, fold.bad.length === 0 && fold.n >= 58, fold.bad.slice(0, 3).join(' / '));
      check(`⑥ ${view}: 実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      await page.close();
    }
    // ⑧ 実際の流れ(相手えらび → VS → 投了 → 結果)。印 cardGrowStyle はページの中でだけ立てる(本体の印は偽のまま)
    for (const [view, vw, vh] of [['縦', 390, 844], ['横', 844, 390]]) {
      const tag = vw > vh ? 'landscape' : 'portrait';
      const page = await b.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: SHOT ? 2 : 1, serviceWorkers: 'block' });
      const errors = []; page.on('pageerror', (e) => errors.push(String(e).split('\n')[0]));
      await page.route(/supabase\.co\/|functions\/v1/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
      await page.addInitScript(() => {
        if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); const p = (k, v) => localStorage.setItem(k, JSON.stringify(v)); p('mh_breeder_name', 'モンヒロ太郎'); p('mh_breeder_icon', 'Mocchi'); p('mh_onboarded', true); p('mh_tutorial_seen_v1', true); p('mh_battle_tutorial_seen_v1', true); p('mh_battle_tutorial_guide_shown_v1', true); p('mh_inherited_unique_level_compensation_v1', true); p('mh_inherited_unique_level_compensation_pending_v1', false); }
        const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.cardGrowStyle = true; clearInterval(t); } } catch (_) {} }, 2);
      });
      await page.addInitScript(quietBootSeed());
      const shot = async (t) => { if (SHOT) { await page.waitForTimeout(400); await page.screenshot({ path: path.join(SHOT, `${tag}-${t}.png`) }); } };
      // 箱(overflow が hidden/auto/scroll の祖先)で切れている字・画面からはみ出す字を探す。一覧は先にいちばん下まで送っておく
      const clipped = (sel) => page.evaluate((sel) => {
        const root = document.querySelector(sel); if (!root) return ['画面が無い'];
        const out = [];
        root.querySelectorAll('*').forEach((e) => {
          if (e.children.length || !e.textContent.trim() || !(e.offsetParent || e.getClientRects().length)) return;
          const r = e.getBoundingClientRect(); if (r.height < 2) return;
          let p = e.parentElement;
          while (p && p !== document.body) { const cs = getComputedStyle(p); if (/hidden|auto|scroll|clip/.test(cs.overflowY)) { const b = p.getBoundingClientRect(); if (r.bottom > b.bottom + 1 && r.top < b.bottom - 1) out.push(`「${e.textContent.trim().slice(0, 10)}」が箱で切れる`); break; } p = p.parentElement; }
        });
        return out;
      }, sel);
      const overlap = (sels) => page.evaluate((sels) => {
        const rs = sels.flatMap((s) => [...document.querySelectorAll(s)].map((e) => ({ s, r: e.getBoundingClientRect() })));
        const out = [];
        rs.forEach((a, i) => rs.slice(i + 1).forEach((b) => { if (a.s === b.s) return; const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left); const y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top); if (x > 2 && y > 2) out.push(`${a.s} と ${b.s} が重なる`); }));
        rs.forEach((a) => { if (a.r.left < -1 || a.r.right > innerWidth + 1) out.push(`${a.s} が画面の横からはみ出す`); });
        return out;
      }, sels);
      const scrollAll = (sel) => page.evaluate((sel) => { document.querySelectorAll(`${sel}, ${sel} *`).forEach((e) => { const cs = getComputedStyle(e); if (/auto|scroll/.test(cs.overflowY) && e.scrollHeight > e.clientHeight) e.scrollTop = 99999; }); }, sel);
      try {
        await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
        await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 120000 });
        await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
        await page.locator('[data-home-card-battle]').waitFor({ timeout: 30000 });
        for (let i = 0; i < 8; i++) { const c = await page.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.offsetParent && /^(受け取る|閉じる|OK|わかった！?|あとで)$/.test((y.innerText || '').trim())); if (x) { x.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); }
        await page.locator('[data-home-card-battle]').dispatchEvent('click');
        await page.locator('[data-card-top="starter"]').waitFor({ timeout: 30000 });
        await page.locator('[data-card-kit="powerful"]').click();
        await page.getByRole('button', { name: /にする$/ }).click();
        await require(path.join(__dirname, 'lib', 'starter-open-pass.js'))(page);
        await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-quit]').click();
        await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
        await page.getByRole('button', { name: 'トップへ' }).click();
        await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
        await page.locator('[data-card-cpu]').click();
        await page.getByRole('button', { name: 'わかった' }).click({ timeout: 3000 }).catch(() => {});
        await page.locator('[data-card-top] button').filter({ hasText: 'フリー対戦' }).first().click();
        // 今日のデッキは毎回ちがう顔になる。いちばん長い名前(ドラの好き「メダマ焼きのギャグ劇場」)に決めてから選ぶ(83 の cardAiDeckNextMemo)
        await page.evaluate(() => { cardAiDeckNextMemo.dra = 'oshi'; }); // eslint-disable-line no-undef
        await page.locator('[data-card-foe="dra"]').click();
        await page.locator('[data-card-foe-style="dra"] [data-card-foe-deck-chip="foe"]').waitFor({ timeout: 5000 }).catch(() => {});
        const foe = await page.evaluate(() => { const els = [...document.querySelectorAll('[data-card-foe-deck-chip]')]; const e = els[0]; const t = e && e.querySelector('span'); const lh = t ? parseFloat(getComputedStyle(t).lineHeight) || 14 : 0; return { n: els.length, inPanel: !!(e && e.closest('[data-card-foe-style="dra"]')), chip: e ? e.textContent : '', style: e ? e.getAttribute('data-card-foe-deck-style') : '', lines: t ? Math.round(t.getBoundingClientRect().height / lh) : 0 }; });
        // 型の欄を見える所へ動かしてから切れを測る(横では右の列がスクロールする箱。画像の読み込みで、欄の下の行が箱の端にかかったまま測ることがあった)
        await page.locator('[data-card-foe-style="dra"]').scrollIntoViewIfNeeded().catch(() => {});
        await page.waitForTimeout(200);
        const foeClip = await clipped('[data-card-foe-style="dra"]');
        await shot('real-foe');
        check(`⑧ ${view}: 相手えらびの型の欄に今日のデッキが1つ出て、既定の名前が1行に収まり(折れると帯が崩れる)、はみ出さず、切れない`, foe.n === 1 && foe.inPanel && new RegExp(`^今日のデッキ${ICON} `).test(foe.chip) && foe.lines === 1 && !foeClip.length, [JSON.stringify(foe), ...foeClip].slice(0, 3).join(' / '));
        // ドラの今日のデッキの名前(推し・好き・素顔の今の側)。顔の印のあとに、そのどれか
        const draNames = await page.evaluate(() => ['oshi', 'suki', 'sugao'].map((f) => cardAiFaceName('dra', f)));
        const draChip = new RegExp(`^今日のデッキ${ICON} (${draNames.join('|')})$`);
        await page.locator('[data-card-start]').click();
        await page.locator('[data-card-deck-pick-go]').click();
        await page.locator('[data-card-vs-style]').waitFor({ timeout: 10000 });
        await page.waitForTimeout(1900);
        const vs = await page.evaluate(() => ({ team: (document.querySelector('[data-card-vs-style] [data-card-foe-team-name]') || {}).textContent || '', chip: (document.querySelector('[data-card-vs-style] [data-card-foe-deck-chip="vs"]') || {}).textContent || '', style: (document.querySelector('[data-card-vs-style] [data-card-foe-deck-chip="vs"]') || { getAttribute: () => '' }).getAttribute('data-card-foe-deck-style') || '' }));
        const vsOver = await overlap(['[data-card-vs-style] [data-card-foe-team-name]', '[data-card-vs-style] [data-card-foe-deck-chip]', '[data-card-vs-line]', '[data-card-vs-mon]', '[data-card-vs-mark]']);
        const vsClip = await clipped('[data-card-vs]');
        await shot('real-vs');
        check(`⑧ ${view}: VS に「チーム」と「今日のデッキ」が両方出て、互いにも3体・吹き出し・VS の字にも重ならず、はみ出さず、切れない`, /^チーム.+/.test(vs.team) && draChip.test(vs.chip) && !vsOver.length && !vsClip.length, [JSON.stringify(vs), ...vsOver, ...vsClip].slice(0, 4).join(' / '));
        check(`⑧ ${view}: 相手えらびで見せた今日のデッキと、VS の今日のデッキが同じ(型も名前も)`, foe.chip === vs.chip && foe.style === vs.style, `相手えらび ${foe.chip}(${foe.style}) / VS ${vs.chip}(${vs.style})`);
        await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2500);
        await page.locator('[data-card-quit]').click();
        await page.getByRole('button', { name: /^投了する/ }).last().click();
        await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
        await page.waitForTimeout(2200);
        await page.locator('[data-card-result-ai-deck]').scrollIntoViewIfNeeded();
        const res = await page.evaluate(() => ({ team: (document.querySelector('[data-card-result-ai-deck] [data-card-foe-team-name]') || {}).textContent || '', chip: (document.querySelector('[data-card-result-ai-deck] [data-card-foe-deck-chip="result"]') || {}).textContent || '' }));
        const resOver = await overlap(['[data-card-result-ai-deck] [data-card-foe-team-name]', '[data-card-result-ai-deck] [data-card-foe-deck-chip]']);
        await shot('real-result');
        await scrollAll('[data-card-top="result"]');
        const resClip = await clipped('[data-card-top="result"]');
        check(`⑧ ${view}: 結果に「チーム」と「今日のデッキ」が両方出て、重ならず、はみ出さず、切れない`, /^チーム.+/.test(res.team) && draChip.test(res.chip) && res.chip === vs.chip && !resOver.length && !resClip.length, [JSON.stringify(res), ...resOver, ...resClip].slice(0, 4).join(' / '));
        check(`⑧ ${view}: 実際の流れで実行時エラーが無い`, errors.length === 0, errors.slice(0, 2).join(' / '));
      } catch (e) {
        check(`⑧ ${view}: 実際の流れを最後まで進められた`, false, String(e).split('\n')[0]);
      } finally { await page.close(); }
    }
  } finally {
    await b.close(); server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

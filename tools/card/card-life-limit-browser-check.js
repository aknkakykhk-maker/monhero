// MFバトルカード: カード部屋の 1.5倍の回数(1つの時間帯で、助手1人につき1回。2026-11-08 社長 Q1 A・Q2 A)。本物の画面を縦・横で触る。
//
//   node tools/card/card-life-limit-browser-check.js        (SHOT_DIR=<フォルダ> で止め絵を残す)
//
// 土台は card-life-reward-browser-check.js と同じ(助手ライフの様子を書きかえ、ソラシド・えるびんだけをカード部屋に置く)
//
// 見ているもの(縦 390×844・横 844×390)
//   ① ソラシドと MASTER で勝つ: 300(1.5倍)。保存 mh_card_life_reward_v1 が { slot: 今の時間帯, used: { sorashido: 1 } }
//   ② 「もう一度」でまた勝つ: 200(ふだん)・帯なし。保存の数は1のまま(2回目は数えない)
//   ③ 相手えらび: ソラシドの印は灰色の「🃏済」、えるびんは「🃏UP」。帯は「いまカード部屋にいる助手: えるびん」と
//      「🃏 ソラシドのごほうびアップは使い切りました…次は◯時から」(◯は次の時間帯の始まり)。字が切れず、札・画面からはみ出さない
//   ④ えるびんとすぐ投了(もらえる数 0): 数えない(保存にえるびんが無い・印は「🃏UP」のまま)
//   ⑤ HOME: MFバトルカードの横にソラシドの顔は残り「済」の印(2026-11-08 社長「HOMEも地図も出す」で前の「消える」を改めた)、えるびんと「UP」も残る
//   ⑥ 助手ライフの家: ソラシドの部屋は灰色の押せないボタン「🃏 ごほうびアップは使い切りました…次は◯時から」、えるびんの部屋はふだんのボタン。画面に入り、字が切れない
//   ⑦ 2人とも使い切る: HOME の顔は2人とも残って「済」の印(2026-11-08 社長「HOMEも地図も出す」)、「UP」は消える。相手えらびの帯は灰色で、2人とも「済」
//   ⑧ 時間帯が変わると戻る(保存の slot が前の時間帯): 相手えらびは2人とも「🃏UP」・起動し直した HOME に2人の顔と「UP」
//   ③' 帯がいちばん高いまま 320×568 にしても、強さのボタンが「対戦する」の帯に潜らない
//   ⑨ 表示と保存が一致(③⑦⑧で、印が「済」の助手 = 保存で今の時間帯に1回使った助手)
//   ⑩ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const starterOpenPass = require(path.resolve(__dirname, 'lib/starter-open-pass.js'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9243;
const SHOT = process.env.SHOT_DIR || '';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2' };
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
const MODES = [
  { id: 'tate', label: '縦', view: { width: 390, height: 844 } },
  { id: 'yoko', label: '横', view: { width: 844, height: 390 } },
];
const LIFE = ['sorashido', 'erubin'];

const run = async (browser, mode, errors) => {
  const ctx = await browser.newContext({ viewport: mode.view, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${mode.label}: ${String(e).slice(0, 200)}`));
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'あかり'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_intro_done', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_update_notice_seen_v1', true); });
  await page.addInitScript(eventStorySeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
  const dismiss = async () => { for (let i = 0; i < 16; i++) { const did = await page.evaluate(() => { const inO = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
    const l = [...document.querySelectorAll('button')].filter((b) => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む|あとで)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!l.length) return false; l[0].click(); return true; }); if (!did) break; await page.waitForTimeout(400); } };
  // 指定の助手だけをカード部屋でカード研究にする(ほかにカード部屋にいた助手は広場へ散歩に。ids が空ならだれもいない)
  const force = (ids = LIFE) => page.evaluate((ids) => { const st = ASSISTANT_LIFE_STORE.state; const life = st.life; const abs = assistantLifeSlotAt().abs; // eslint-disable-line no-undef
    const away = (v) => (v.place === 'cardroom' ? { ...v, place: 'plaza', doing: 'walk' } : v);
    const groups = (life.groups || []).map((g) => away({ ...g, ids: g.ids.filter((x) => !ids.includes(x)) })).filter((g) => g.ids.length >= 2);
    const inGroup = new Set(groups.flatMap((g) => g.ids));
    const solo = {};
    for (const [k, v] of Object.entries(life.solo || {})) if (!ids.includes(k)) solo[k] = away(v);
    for (const g of life.groups || []) for (const x of g.ids) if (!ids.includes(x) && !inGroup.has(x) && !solo[x]) solo[x] = away({ place: g.place, doing: g.doing });
    for (const x of ids) solo[x] = { place: 'cardroom', doing: 'cards' };
    ASSISTANT_LIFE_STORE.set({ life: { ...life, abs, groups, solo } }); // eslint-disable-line no-undef
  }, ids);
  // モンヒロビートの外では絵が回っていない(🔄横はモンヒロビートの中だけ。外へ出ると 60-app の releaseScreenOrientation で戻る)
  const notRotated = async (where) => {
    const r = await page.evaluate(() => (typeof RHYTHM_VIEW_ROTATION === 'undefined' ? 'なし' : RHYTHM_VIEW_ROTATION.active())); // eslint-disable-line no-undef
    check(`${mode.label} ${where}: 絵は回っていない(🔄横はモンヒロビートの中だけ)`, r === false || r === 'なし', String(r));
  };
  // 対戦の前の画面(デッキの確かめ・対戦開始の演出)を進める
  const pass = async () => {
    const b = page.getByRole('button', { name: /対戦へ|このデッキで|はじめる|スタート|タップ/ }).first();
    if (await b.count() && await b.isVisible().catch(() => false)) await b.click().catch(() => {});
    else await page.mouse.click(mode.view.width / 2, mode.view.height * 0.7).catch(() => {});
    await page.waitForTimeout(600);
  };
  // ランクアップの窓(少しあとから出る)を、出なくなるまで閉じる
  const closeUp = async () => {
    let quiet = 0;
    for (let i = 0; i < 20 && quiet < 4; i++) {
      const nx = page.getByText(/押すと(先へ|閉じる)/);
      if (await nx.count() && await nx.first().isVisible().catch(() => false)) { quiet = 0; await nx.first().click().catch(() => {}); } else quiet++;
      await page.waitForTimeout(600);
    }
  };
  const snap = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${mode.id}-${name}.png`) }); } };
  // その場面の印(sel)が、いちばん手前に見えているか(上に別の画面がかぶったまま撮る・読むのを防ぐ。2026-11-08 部長: HOME のつもりの止め絵が助手ライフの家だった)
  const onTop = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'ない'; const r = el.getBoundingClientRect(); const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), y = Math.min(Math.max(r.top + Math.min(r.height / 2, 20), 1), innerHeight - 1);
    const t = document.elementFromPoint(x, y); return !!t && (el.contains(t) || t.contains(el)) ? true : `手前は ${t ? (t.closest('[data-mh-screen],[data-assistant-life-house],[class*="mhl"]') || t).className.toString().slice(0, 40) : 'なし'}`; }, sel);
  const scene = async (name, sel, label) => { const r = await onTop(sel); check(`場面 ${mode.label} ${name}: ${label}(${sel})がいちばん手前に見えている`, r === true, String(r)); await snap(name); };
  const inView = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'ない'; const r = el.getBoundingClientRect(); const W = window.innerWidth, H = window.innerHeight;
    if (r.width < 2 || r.height < 2) return '見えない'; return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1 ? true : `画面の外(${Math.round(r.left)},${Math.round(r.top)}〜${Math.round(r.right)},${Math.round(r.bottom)} / ${W}×${H})`; }, sel);
  const boot = async () => {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 40000 });
    await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 40000 });
    await page.waitForTimeout(2500); await dismiss();
  };
  // 回数の保存と写し(84 の CARD_LIFE_REWARD_MEM)をそろえて書く。HOME などを描き直すため、そのあと助手ライフの様子も置き直す
  const setUsed = async (used, slotShift = 0) => {
    await page.evaluate(([used, sh]) => { const v = { slot: assistantLifeSlotAt().abs + sh, used }; localStorage.setItem('mh_card_life_reward_v1', JSON.stringify(v)); CARD_LIFE_REWARD_MEM.raw = v; }, [used, slotShift]); // eslint-disable-line no-undef
    await force(); await page.waitForTimeout(900);
  };
  const stored = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('mh_card_life_reward_v1')); } catch (_) { return 'こわれ'; } });
  const slotNow = () => page.evaluate(() => assistantLifeSlotAt()); // eslint-disable-line no-undef
  const nextHour = () => page.evaluate(() => { const s = assistantLifeSlotAt(); return ASSISTANT_LIFE_SLOTS[(s.i + 1) % ASSISTANT_LIFE_SLOTS.length].from; }); // eslint-disable-line no-undef
  // 字が切れていない(はみ出し・… が無い)・画面に入っている
  const textFits = (sel) => page.evaluate((s) => { const out = []; for (const el of document.querySelectorAll(s)) { const r = el.getBoundingClientRect(); if (el.scrollWidth > el.clientWidth + 1) out.push(`横にはみ出す ${el.textContent.slice(0, 20)}`);
    if (/…$|\.\.\.$/.test(el.textContent) && !/使い切りました…/.test(el.textContent)) out.push(`… で切れる ${el.textContent.slice(0, 20)}`); if (r.left < -1 || r.right > window.innerWidth + 1) out.push(`画面の外 ${el.textContent.slice(0, 20)}`); }
    return out; }, sel);
  // 相手えらびの印と帯を読む
  const readPick = () => page.evaluate(() => {
    const chips = Object.fromEntries([...document.querySelectorAll('[data-card-foe-life-chip]')].map((c) => [c.closest('[data-card-foe]').getAttribute('data-card-foe'), c.getAttribute('data-card-foe-life-chip') === 'spent' ? '済' : 'UP']));
    const band = document.querySelector('[data-card-foe-life-band]');
    const spent = Object.fromEntries([...document.querySelectorAll('[data-card-foe-life-spent]')].map((p) => [p.getAttribute('data-card-foe-life-spent'), p.textContent]));
    const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    const bad = [];
    for (const c of document.querySelectorAll('[data-card-foe-life-chip]')) { const tile = c.closest('[data-card-foe]'); const r = c.getBoundingClientRect(); const t = tile.getBoundingClientRect();
      if (hit(r, tile.querySelector('[data-card-foe-name]').getBoundingClientRect())) bad.push(`${tile.getAttribute('data-card-foe')}: 印が名前に重なる`);
      if (r.left < t.left - 0.5 || r.right > t.right + 0.5 || r.top < t.top - 0.5 || r.bottom > t.bottom + 0.5) bad.push(`${tile.getAttribute('data-card-foe')}: 印が札からはみ出す`); }
    return { chips, band: band ? band.getAttribute('data-card-foe-life-band') : null, bandText: band ? band.textContent : '', spent, bad };
  });
  const usedOf = (v, slot) => (v && typeof v === 'object' && v.slot === slot && v.used ? Object.keys(v.used).filter((k) => v.used[k] >= 1).sort().join(',') : '');
  const goFoe = async () => {
    for (let i = 0; i < 3 && !(await page.locator('[data-card-top="foe"]').count()); i++) {
      const b = page.getByRole('button', { name: '相手をえらぶ' });
      if (await b.count()) { await b.click(); break; }
    }
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
  };
  const goHome = async () => {
    for (let i = 0; i < 8; i++) {
      if (await page.locator('[data-assistant-life-close]').count()) { await page.locator('[data-assistant-life-close]').first().click().catch(() => {}); await page.waitForTimeout(700); continue; }
      if (await page.locator('[data-home-card-battle]').count() && (await onTop('[data-home-card-battle]')) === true) break;
      // 戻るボタンの名前は画面ごとに違う(「戻る」「トップへ戻る」など)ので、名前に「戻」を含むものを押す
      const back = page.locator('[data-mh-screen] button[aria-label*="戻"]').first();
      if (await back.count() && await back.isVisible().catch(() => false)) await back.click().catch(() => {}); else await page.keyboard.press('Escape').catch(() => {});
      await page.waitForTimeout(700); await dismiss();
    }
    await page.locator('[data-home-card-battle]').first().waitFor({ timeout: 20000 });
    await force(); await page.waitForTimeout(1500);
  };
  const homeRow = async () => ({ top: (await onTop('[data-home-card-battle]')) === true, ...(await homeRow0()) });
  const homeRow0 = () => page.evaluate(() => ({ faces: [...document.querySelectorAll('[data-assistant-life-home-faces="card"] [data-assistant-life-home-face]')].map((e) => e.getAttribute('data-assistant-life-home-face')).sort().join(','),
    up: !!document.querySelector('[data-assistant-life-home-card-up]'), spent: [...document.querySelectorAll('[data-assistant-life-home-faces="card"] [data-assistant-life-home-face-spent="1"]')].map((e) => e.getAttribute('data-assistant-life-home-face')).sort().join(',') }));
  const winScene = () => page.evaluate(() => { window.__mhCardScene = (st) => { st.turn = 12; st.players[1].mons.forEach((m) => { m.life = 0; }); st.winner = 0; st.reason = '全員KO'; st.phase = 'over'; st.pending = null; return st; }; });
  const toResult = async () => {
    for (let i = 0; i < 40; i++) { if (await page.locator('[data-card-top="result"]').count()) break; await pass(); }
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await closeUp();
    return page.evaluate(() => { const top = document.querySelector('[data-card-top="result"]'); return { outcome: top.getAttribute('data-card-outcome'), gain: Number(top.getAttribute('data-card-gain')), band: !!document.querySelector('[data-card-result-life-up]') }; });
  };
  try {
    await boot();
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 30000 });
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    await starterOpenPass(page);
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await page.evaluate(() => { localStorage.setItem('mh_card_cpu_unlocked_v1', JSON.stringify({ hard: true, expert: true, master: true }));
      localStorage.setItem('mh_card_daily_v1', JSON.stringify({ day: cardTodayJst(), cpuPoint: 0, pvpPoint: 0, firstWin: true, foes: {}, quickLoops: 0 })); }); // eslint-disable-line no-undef
    await boot();
    await force(); await page.waitForTimeout(1500);
    const slot = (await slotNow()).abs; const nx = await nextHour();
    // ① ソラシドと MASTER で勝つ(部屋のボタンから)
    await page.locator('[data-assistant-life-home-face="sorashido"]').dispatchEvent('click');
    await page.locator('[data-assistant-life-room-act="card"]').waitFor({ timeout: 20000 });
    await page.locator('[data-assistant-life-room-act="card"]').dispatchEvent('click');
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 30000 });
    await dismiss();
    await page.getByRole('button', { name: /MASTER/ }).first().click();
    await winScene();
    await page.locator('[data-card-start]').click();
    const r1 = await toResult();
    const s1 = await stored();
    check(`① ${mode.label} ソラシドと MASTER で勝つ: 300(1.5倍)・保存に今の時間帯で sorashido 1回`, r1.outcome === 'win' && r1.gain === 300 && r1.band && s1 && s1.slot === slot && JSON.stringify(s1.used) === '{"sorashido":1}', `${JSON.stringify(r1)} ${JSON.stringify(s1)}`);
    // ② もう一度
    await page.getByRole('button', { name: 'もう一度' }).click();
    const r2 = await toResult();
    const s2 = await stored();
    check(`② ${mode.label} 「もう一度」でまた勝つ: 200(ふだん)・帯なし・保存は1回のまま`, r2.outcome === 'win' && r2.gain === 200 && !r2.band && s2 && JSON.stringify(s2.used) === '{"sorashido":1}', `${JSON.stringify(r2)} ${JSON.stringify(s2)}`);
    await page.evaluate(() => { window.__mhCardScene = null; });
    // ③ 相手えらび
    await goFoe(); await force(); await page.waitForTimeout(800);
    const p3 = await readPick();
    const want3 = `🃏 ソラシドのごほうびアップは使い切りました…次は${nx}時から`;
    const fit3 = await textFits('[data-card-foe-life-band] p');
    await page.evaluate(() => document.querySelector('[data-card-foe-life-band]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const band3In = await inView('[data-card-foe-life-band]');
    check(`③ ${mode.label} 相手えらび: ソラシド「🃏済」・えるびん「🃏UP」・帯に「えるびん」と「${want3}」・字が切れず、はみ出さない`,
      p3.chips.sorashido === '済' && p3.chips.erubin === 'UP' && p3.band === 'up' && /いまカード部屋にいる助手: えるびん/.test(p3.bandText) && !/いまカード部屋にいる助手:[^🃏]*ソラシド/.test(p3.bandText) && p3.spent.sorashido === want3 && !p3.bad.length && !fit3.length && band3In === true,
      JSON.stringify({ ...p3, fit3, band3In }));
    check(`⑨ ${mode.label} ③の表示と保存が一致`, Object.keys(p3.chips).filter((k) => p3.chips[k] === '済').sort().join(',') === usedOf(await stored(), slot));
    await scene('3-pick', '[data-card-foe-life-band]', '相手えらびの帯');
    // ③' 帯がいちばん高い(いる助手+使い切りの1行)まま、小さい縦 320×568 にしても、強さのボタンが「対戦する」の帯に潜らない
    //    (帯を強さのボタンの上に置いていたとき、3行の帯で 13px 潜った。2026-11-08)
    if (mode.id === 'tate') {
      await page.setViewportSize({ width: 320, height: 568 }); await page.waitForTimeout(600);
      await page.evaluate(() => { document.querySelectorAll('[data-card-top="foe"] *').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }); await page.waitForTimeout(300);
      const lv = await page.evaluate(() => { const st = document.querySelector('[data-card-start]'); const f = st ? st.closest('div').getBoundingClientRect() : null;
        return [...document.querySelectorAll('[data-card-level]')].filter((b) => { const x = b.getBoundingClientRect(); return x.top < 0 || x.bottom > innerHeight + 0.5 || (f && x.left < f.right && x.right > f.left && x.top < f.bottom && x.bottom > f.top + 0.5); }).map((b) => b.getAttribute('data-card-level')); });
      check('③ 320×568: カード部屋の帯がいちばん高くても、強さのボタンが「対戦する」の帯に潜らない', lv.length === 0, lv.join(','));
      await scene('3-pick-320', '[data-card-level="easy"]', '相手えらびの強さのボタン');
      await page.setViewportSize(mode.view); await page.waitForTimeout(600);
    }
    // ④ えるびんとすぐ投了(0)
    await page.locator('[data-card-foe="erubin"]').dispatchEvent('click');
    await page.locator('[data-card-start]').click();
    for (let i = 0; i < 40; i++) { if (await page.locator('[data-card-quit]').count()) break; await pass(); }
    await page.locator('[data-card-quit]').click();
    await page.getByRole('button', { name: /投了する|投了/ }).last().click();
    const r4 = await toResult();
    const s4 = await stored();
    await goFoe(); await force(); await page.waitForTimeout(800);
    const p4 = await readPick();
    check(`④ ${mode.label} えるびんとすぐ投了(0): 数えない(保存にえるびんが無い・印は「🃏UP」のまま)`, r4.gain === 0 && !r4.band && s4 && !('erubin' in (s4.used || {})) && p4.chips.erubin === 'UP', `${JSON.stringify(r4)} ${JSON.stringify(s4)} ${JSON.stringify(p4.chips)}`);
    // ⑤ HOME
    await goHome();
    const h5 = await homeRow();
    const up5 = await inView('[data-assistant-life-home-card-up]');
    check(`⑤ ${mode.label} HOME: MFバトルカードの横にソラシドの顔は残り「済」の印が付く・えるびんと「UP」も残る(2026-11-08 社長「HOMEも地図も出す」)`, h5.top && h5.faces === 'erubin,sorashido' && h5.spent === 'sorashido' && h5.up && up5 === true, `${JSON.stringify(h5)} UP ${up5}`);
    await scene('5-home', '[data-home-card-battle]', 'HOME の MFバトルカードの札');
    // ⑥ 助手ライフの家: 部屋のボタン
    for (let i = 0; i < 5; i++) { try { await page.locator('[data-home-assistant-life]').first().click({ timeout: 4000 }); break; } catch (e) { if (i === 4) throw e; await dismiss(); await page.waitForTimeout(800); } }
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(600);
    await force(); await page.waitForTimeout(800);
    await page.locator('[data-assistant-life-room="sorashido"]').click();
    await page.locator('[data-assistant-life-room-sheet="sorashido"]').waitFor({ timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-assistant-life-room-act="card-spent"]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    const room6 = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-room-act="card-spent"]'); return b ? { text: b.textContent, disabled: b.disabled, normal: !!document.querySelector('[data-assistant-life-room-act="card"]') } : null; });
    const in6 = await inView('[data-assistant-life-room-act="card-spent"]');
    const fit6 = await textFits('[data-assistant-life-room-act="card-spent"]');
    check(`⑥ ${mode.label} ソラシドの部屋: 灰色の押せない「🃏 ごほうびアップは使い切りました…次は${nx}時から」・画面に入り、字が切れない`,
      !!room6 && room6.disabled && !room6.normal && room6.text.endsWith(`🃏 ごほうびアップは使い切りました…次は${nx}時から`) && in6 === true && !fit6.length, JSON.stringify({ room6, in6, fit6 }));
    await scene('6-room-sorashido', '[data-assistant-life-room-act="card-spent"]', '部屋の灰色のボタン');
    await page.locator('[data-assistant-life-room-close]').click().catch(() => {});
    await page.waitForTimeout(500);
    await page.locator('[data-assistant-life-room="erubin"]').click();
    await page.waitForTimeout(800);
    const room6b = await page.evaluate(() => ({ normal: !!document.querySelector('[data-assistant-life-room-act="card"]'), spent: !!document.querySelector('[data-assistant-life-room-act="card-spent"]') }));
    check(`⑥ ${mode.label} えるびんの部屋はふだんの「🃏 カード部屋で対戦する」`, room6b.normal && !room6b.spent, JSON.stringify(room6b));
    await page.locator('[data-assistant-life-room-close]').click().catch(() => {});
    await page.waitForTimeout(400);
    await page.locator('[data-assistant-life-close]').first().click().catch(() => {}); // 助手ライフの家を閉じて HOME へ
    await page.locator('[data-assistant-life-close]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    // ⑦ 2人とも使い切る
    await goHome();
    await setUsed({ sorashido: 1, erubin: 1 });
    const h7 = await homeRow();
    check(`⑦ ${mode.label} 2人とも使い切る: HOME の顔は2人とも残って「済」の印・「UP」は消える(2026-11-08 社長「HOMEも地図も出す」)`, h7.top && h7.faces === 'erubin,sorashido' && h7.spent === 'erubin,sorashido' && !h7.up, JSON.stringify(h7));
    await scene('7-home-none', '[data-home-card-battle]', 'HOME の MFバトルカードの札');
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(800); await dismiss();
    await page.locator('[data-card-cpu]').dispatchEvent('click');
    await page.getByRole('button', { name: 'わかった' }).click({ timeout: 2500 }).catch(() => {});
    await page.waitForTimeout(500);
    if (!(await page.locator('[data-card-top="foe"]').count())) await page.locator('[data-card-top] button').filter({ hasText: /フリー対戦|助手と対戦/ }).first().dispatchEvent('click').catch(() => {});
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 20000 });
    await force(); await page.waitForTimeout(800);
    const p7 = await readPick();
    const fit7 = await textFits('[data-card-foe-life-band] p');
    check(`⑦ ${mode.label} 相手えらび: 2人とも「🃏済」・帯は灰色(使い切りの言い方だけ)・字が切れない`, p7.chips.sorashido === '済' && p7.chips.erubin === '済' && p7.band === 'spent' && !/いまカード部屋にいる助手/.test(p7.bandText) && Object.keys(p7.spent).length === 2 && !fit7.length && !p7.bad.length, JSON.stringify({ ...p7, fit7 }));
    check(`⑨ ${mode.label} ⑦の表示と保存が一致`, Object.keys(p7.chips).filter((k) => p7.chips[k] === '済').sort().join(',') === usedOf(await stored(), slot));
    await page.evaluate(() => document.querySelector('[data-card-foe-life-band]')?.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    await scene('7-pick-none', '[data-card-foe-life-band]', '相手えらびの帯');
    // ⑧ 時間帯が変わると戻る
    await setUsed({ sorashido: 1, erubin: 1 }, -1);
    await dismiss(); await page.locator('[data-card-foe="erubin"]').dispatchEvent('click'); await page.waitForTimeout(500); // 相手えらびを描き直す
    const p8 = await readPick();
    check(`⑧ ${mode.label} 時間帯が変わると戻る: 相手えらびは2人とも「🃏UP」`, p8.chips.sorashido === 'UP' && p8.chips.erubin === 'UP' && p8.band === 'up', JSON.stringify(p8));
    check(`⑨ ${mode.label} ⑧の表示と保存が一致(前の時間帯の数は今に数えない)`, Object.keys(p8.chips).filter((k) => p8.chips[k] === '済').join(',') === usedOf(await stored(), slot));
    // HOME は起動し直して見る(保存から読み直す所 cardLifeRewardLoad の確かめにもなる)
    await boot(); await force(); await page.waitForTimeout(1500);
    const h8 = await homeRow();
    check(`⑧ ${mode.label} 時間帯が変わると戻る(起動し直して保存から読む): HOME に2人の顔と「UP」・「済」の印は消える`, h8.top && h8.faces === 'erubin,sorashido' && h8.spent === '' && h8.up, JSON.stringify(h8));
  } finally { await ctx.close(); }
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    for (const mode of MODES) {
      try { await run(browser, mode, errors); } catch (e) { check(`${mode.label} 最後まで触れる`, false, String(e).slice(0, 300)); }
    }
    check('⑩ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`カード部屋の 1.5倍の回数(画面): NG ${failed}件`); process.exit(1); }
  console.log('カード部屋の 1.5倍の回数(画面): すべてOK');
})();

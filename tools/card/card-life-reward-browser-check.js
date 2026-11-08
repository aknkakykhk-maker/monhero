// MFバトルカード: カード部屋にいる助手と対戦すると、ごほうびが 1.5倍(2026-11-07 社長・カード部ルールくん)。本物の画面を縦・横で触る。
//
//   node tools/card/card-life-reward-browser-check.js        (SHOT_DIR=<フォルダ> で止め絵を残す)
//
// 助手ライフ段階2の本物の口(assistantLifeCardIds・assistantLifeAtCard・assistantLifeOnCardMatch)を使う。
// 助手ライフの様子を書きかえて、ソラシド・えるびんだけをカード部屋に置いた状態で見る
//
// 見ているもの(縦 390×844・横 844×390・小さい横 568×320 の3つ。🔄横(絵を回す)はモンヒロビートの中だけで、HOME・カードの画面は回らない。2026-11-07 ナカヨシ7)
//   ① HOME: MFバトルカードの札の横の顔の並びに「UP」。画面の中に入っている
//   ② 顔を押した助手の部屋に「🃏 カード部屋で対戦する」。画面の中に入っていて、押すとMFバトルカードの相手えらびがその助手で開く
//   ③ 相手えらび: カード部屋にいる助手の札だけに「🃏UP」。札の左上の角で、名前・「勝」の印に重ならず、札からはみ出さない。強さのボタンの下に説明の帯(いる助手の名前)。強さのボタンが「対戦する」の帯に潜らない(568×320 も)
//   ④ MASTER で勝つ: もらったビートP 300(ふだん 200)・帯「200 → 300」・保存のビートPも 300 増える(ランクアップのごほうびは別)。
//      カードランクの経験値が数えられる版なら 27(はじめての勝ちなら +30)。助手ライフの「今日あったこと」に勝ったと入る
//   ⑤ すぐ投了(もらえる数 0): 帯を出さない
//   ⑥ カード部屋にだれもいないとき: 相手えらびに印も帯も出ない
//   ⑦ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const starterOpenPass = require(path.resolve(__dirname, 'lib/starter-open-pass.js'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9241;
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
  // 小さい横(SE)。カード部屋の帯が3行になると、強さのボタンが「対戦する」の帯に潜っていた(2026-11-08 ツナグの指摘)
  //   この画面で見るのは相手えらび(③)から。HOME の顔の列は札が画面のいちばん下に来て切れる(助手ライフ側の顔の置き方。部長へ報告済み)ので、① は縦・横だけで見る
  { id: 'se', label: '横(568×320)', view: { width: 568, height: 320 }, skipHome: true },
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
  await page.addInitScript(eventStorySeed());
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
  const inView = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'ない'; const r = el.getBoundingClientRect(); const W = window.innerWidth, H = window.innerHeight;
    if (r.width < 2 || r.height < 2) return '見えない'; return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1 ? true : `画面の外(${Math.round(r.left)},${Math.round(r.top)}〜${Math.round(r.right)},${Math.round(r.bottom)} / ${W}×${H})`; }, sel);
  const boot = async () => {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 40000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 40000 });
    await page.waitForTimeout(2500); await dismiss();
  };
  try {
    await boot();
    // スターターを受け取り、練習試合は飛ばす
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
    // MASTER まで開け、その日はじめての勝ちは済ませておく(ビートPの 1.5倍だけを見るため)
    await page.evaluate(() => { localStorage.setItem('mh_card_cpu_unlocked_v1', JSON.stringify({ hard: true, expert: true, master: true }));
      localStorage.setItem('mh_card_daily_v1', JSON.stringify({ day: cardTodayJst(), cpuPoint: 0, pvpPoint: 0, firstWin: true, foes: {}, quickLoops: 0 })); }); // eslint-disable-line no-undef
    await boot();
    // ① HOME
    await notRotated('HOME');
    await force(); await page.waitForTimeout(1500);
    const ids = await page.evaluate(() => (typeof assistantLifeCardIds === 'function' ? assistantLifeCardIds() : null)); // eslint-disable-line no-undef
    check(`① ${mode.label} 助手ライフの口で、カード部屋にいるのがソラシド・えるびんだと読める`, Array.isArray(ids) && ids.slice().sort().join() === LIFE.slice().sort().join(), JSON.stringify(ids));
    const up = await inView('[data-assistant-life-home-card-up]');
    const faces = await page.evaluate((ids) => ids.every((id) => !!document.querySelector(`[data-assistant-life-home-faces="card"] [data-assistant-life-home-face="${id}"]`)), LIFE);
    if (!mode.skipHome) check(`① ${mode.label} HOME: カードの札の横の顔(ソラシド・えるびん)に「UP」が出て、画面に入っている`, faces && up === true, `顔 ${faces} / UP ${up}`);
    await snap('1-home');
    // ② 部屋の窓
    await page.locator('[data-assistant-life-home-face="sorashido"]').dispatchEvent('click');
    await page.locator('[data-assistant-life-room-sheet="sorashido"]').waitFor({ timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-assistant-life-room-act="card"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const cardBtn = await inView('[data-assistant-life-room-act="card"]');
    check(`② ${mode.label} ソラシドの部屋に「🃏 カード部屋で対戦する」が出て、画面に入っている`, cardBtn === true, String(cardBtn));
    await snap('2-room');
    await page.locator('[data-assistant-life-room-act="card"]').dispatchEvent('click');
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 30000 });
    await dismiss();
    await notRotated('相手えらび');
    await page.waitForTimeout(600);
    const picked = await page.evaluate(() => { const b = document.querySelector('[data-card-foe="sorashido"]'); return !!b && /bg-white\/10/.test(b.className); });
    check(`② ${mode.label} 押すと相手えらびがソラシドを選んだ形で開く`, picked);
    // ③ 相手えらび
    await page.getByRole('button', { name: /MASTER/ }).first().click();
    await page.waitForTimeout(400);
    await notRotated('相手えらび(強さを選んだあと)');
    const pick = await page.evaluate((ids) => {
      const out = [];
      const chips = [...document.querySelectorAll('[data-card-foe-life-chip]')];
      const owners = chips.map((c) => c.closest('[data-card-foe]')?.getAttribute('data-card-foe'));
      if (owners.slice().sort().join(',') !== ids.slice().sort().join(',')) out.push(`印のある札 ${owners.join('・')}`);
      const hit = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
      for (const c of chips) {
        const tile = c.closest('[data-card-foe]'); const r = c.getBoundingClientRect(); const t = tile.getBoundingClientRect();
        const name = tile.querySelector('[data-card-foe-name]').getBoundingClientRect();
        const won = [...tile.querySelectorAll('span')].find((s) => s.textContent === '勝');
        if (hit(r, name)) out.push(`${tile.getAttribute('data-card-foe')}: 印が名前に重なる`);
        if (won && hit(r, won.getBoundingClientRect())) out.push(`${tile.getAttribute('data-card-foe')}: 印が「勝」に重なる`);
        if (r.left < t.left - 0.5 || r.right > t.right + 0.5 || r.top < t.top - 0.5 || r.bottom > t.bottom + 0.5) out.push(`${tile.getAttribute('data-card-foe')}: 印が札からはみ出す`);
        if (t.left < -1 || t.right > window.innerWidth + 1 || t.top < -1) out.push(`${tile.getAttribute('data-card-foe')}: 札が画面の端で切れる`);
      }
      // 強さのボタンが下の「対戦する」の帯に潜らない(見える所まで巻き取って、帯の上の端=「あなたのデッキ」の欄の上の端と比べる)
      const bar = document.querySelector('[data-card-foe-mydeck]');
      const lvs = [...document.querySelectorAll('[data-card-level]')];
      if (bar && lvs.length) {
        lvs[lvs.length - 1].scrollIntoView({ block: 'nearest' });
        const br = bar.parentElement ? bar.parentElement.getBoundingClientRect() : bar.getBoundingClientRect();
        const top = bar.getBoundingClientRect().top;
        // 横の画面は「対戦する」の帯と強さのボタンが左右の別の列なので、横に重なる物だけを数える
        const under = lvs.filter((b) => { const r = b.getBoundingClientRect(); return r.bottom > top + 1 && r.left < br.right - 1 && r.right > br.left + 1; });
        if (under.length) out.push(`強さのボタンが「対戦する」の帯に潜る(${Math.round(Math.max(...under.map((b) => b.getBoundingClientRect().bottom)) - Math.round(top))}px)`);
      }
      const band = document.querySelector('[data-card-foe-life-band]');
      if (!band || !/ソラシド・えるびん/.test(band.textContent) || !/1\.5倍/.test(band.textContent)) out.push(`帯 ${band ? band.textContent : 'なし'}`);
      return out;
    }, LIFE);
    check(`③ ${mode.label} 相手えらび: いる助手の札だけ左上に「🃏UP」(名前・「勝」に重ならない・はみ出さない)・説明の帯`, pick.length === 0, pick.join(' / '));
    await snap('3-pick');
    // ④ MASTER で勝つ
    const before = await page.evaluate(() => ({ p: Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')) || 0, lv: JSON.parse(localStorage.getItem('mh_card_level_v1') || 'null') }));
    await page.evaluate(() => { window.__mhCardScene = (st) => { st.turn = 12; st.players[1].mons.forEach((m) => { m.life = 0; }); st.winner = 0; st.reason = '全員KO'; st.phase = 'over'; st.pending = null; return st; }; });
    await page.locator('[data-card-start]').click();
    for (let i = 0; i < 40; i++) {
      if (await page.locator('[data-card-top="result"]').count()) break;
      await pass();
    }
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await closeUp();
    await notRotated('結果');
    const res = await page.evaluate(() => {
      const top = document.querySelector('[data-card-top="result"]');
      const band = document.querySelector('[data-card-result-life-up]');
      const plain = document.querySelector('[data-card-result-life-plain]');
      return { outcome: top.getAttribute('data-card-outcome'), gain: Number(top.getAttribute('data-card-gain')), band: band ? band.textContent : null, plain: plain ? plain.textContent : null,
        lines: [...top.querySelectorAll('div')].filter((d) => !d.querySelector('div')).map((d) => d.textContent).filter((t) => /の勝ち:|もらったビートP/.test(t)) };
    });
    check(`④ ${mode.label} MASTER の勝ち: もらったビートP 300(ふだん 200)・帯「ソラシド」「200 → 300」・「MASTERの勝ち: 200」`,
      res.outcome === 'win' && res.gain === 300 && /ふだん 200/.test(res.plain || '') && /ソラシド/.test(res.band || '') && /200 → 300/.test(res.band || '') && res.lines.some((t) => /MASTERの勝ち: 200$/.test(t)), JSON.stringify(res));
    await page.evaluate(() => document.querySelector('[data-card-result-life-up]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const bandIn = await inView('[data-card-result-life-up]');
    check(`④ ${mode.label} 結果の帯が画面に入る`, bandIn === true, String(bandIn));
    await snap('4-result');
    const after = await page.evaluate(() => {
      const p = Number(JSON.parse(localStorage.getItem('mh_rhythm_event_points_v1') || '0')) || 0;
      const lv = JSON.parse(localStorage.getItem('mh_card_level_v1') || 'null');
      return { p, lv };
    });
    const got0 = (before.lv && Array.isArray(before.lv.got)) ? before.lv.got : [];
    const gotNew = after.lv && Array.isArray(after.lv.got) ? after.lv.got.filter((x) => !got0.includes(x)) : [];
    const rankPoint = await page.evaluate((lvs) => lvs.reduce((a, lv) => a + (cardRankRewardOf(lv).point || 0), 0), gotNew); // eslint-disable-line no-undef
    check(`④ ${mode.label} 保存のビートPが 300 増える(ランクアップのごほうび ${rankPoint} は別)`, after.p - before.p - rankPoint === 300, `${before.p} → ${after.p}`);
    const xpAdd = (after.lv && Number(after.lv.xp)) - ((before.lv && Number(before.lv.xp)) || 0);
    check(`④ ${mode.label} カードランクの経験値: 数える版なら 27(はじめての勝ちなら 57)`, !after.lv || xpAdd === 27 || xpAdd === 57, String(xpAdd));
    await page.waitForTimeout(800);
    const diary = await page.evaluate(() => (ASSISTANT_LIFE_DIARY.state.items || []).map((x) => x.text)); // eslint-disable-line no-undef
    check(`④ ${mode.label} 助手ライフの「今日あったこと」に「ソラシドとMFバトルカードで対戦して勝った」が入る`, diary.some((t) => /ソラシドとMFバトルカードで対戦して勝った/.test(t)), JSON.stringify(diary.slice(-3)));
    // ⑤ すぐ投了(0)
    await page.evaluate(() => { window.__mhCardScene = null; });
    await closeUp();
    await page.getByRole('button', { name: 'もう一度' }).click();
    for (let i = 0; i < 40; i++) {
      if (await page.locator('[data-card-quit]').count()) break;
      await pass();
    }
    await page.locator('[data-card-quit]').click();
    await page.getByRole('button', { name: /投了する|投了/ }).last().click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    const zero = await page.evaluate(() => ({ gain: document.querySelector('[data-card-top="result"]').getAttribute('data-card-gain'), band: !!document.querySelector('[data-card-result-life-up]'), plain: !!document.querySelector('[data-card-result-life-plain]') }));
    check(`⑤ ${mode.label} すぐ投了(0): 帯も「ふだん」も出さない`, zero.gain === '0' && !zero.band && !zero.plain, JSON.stringify(zero));
    // ⑥ だれもいないとき
    await force([]);
    await page.getByRole('button', { name: '相手をえらぶ' }).click();
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 20000 });
    const none = await page.evaluate(() => ({ chips: document.querySelectorAll('[data-card-foe-life-chip]').length, band: !!document.querySelector('[data-card-foe-life-band]') }));
    check(`⑥ ${mode.label} カード部屋にだれもいないとき、印も帯も出ない`, none.chips === 0 && !none.band, JSON.stringify(none));
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
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`カード部屋の助手と対戦(画面): NG ${failed}件`); process.exit(1); }
  console.log('カード部屋の助手と対戦(画面): すべてOK');
})();

// MFバトルカード: 助手の推し・好き・素顔のデッキを AI で組む(83-card-ai-deck.jsx・2026-11-08 社長の決定)を、本物の画面で縦・横に触る。
//   公開の印 RELEASE_FLAGS.cardGrowStyle は、この検査の中だけ真にする。中継役(card-assistant-talk)は偽物の返事
//
//   node tools/card/card-ai-deck-browser-check.js        (SHOT_DIR=<フォルダ> で止め絵を残す)
//
// 見ているもの(縦 390×844・横 844×390)
//   ① 印が偽: VS・結果に型の札が出ない(今と同じ)・中継役を呼ばない・保存を書かない
//   ② 印が真・AI が返す: 相手えらびで選ぶと裏で AI に組んでもらう → VS に「チーム」と「今日のデッキ」の名前・ひとこと → 結果に同じ「今日のデッキ」の名前→ その助手との10戦の数が1つ増える。札は画面の中
//   ③ 印が真・AI なし(遅れの返事): 揺らぎで組む → VS・結果は既定の名前で同じ形(画面に違いが出ない)
//   ⑥ これまでのデッキ: 相手えらびの選び口(おまかせ・今の3つ・これまで)で選ぶと、今日のデッキ・VS・結果の名前がそれになる
//   ⑧ 遊ぶ人の提案(assistantLifeDeckWish の代わり): 次の組み直しで1回だけ使い、相手えらび・VS・結果に提案の名前が出る
//   ⑦ 選び口を開いても、隣の欄の立ち絵と吹き出しが画面に入る(横で下へ押し出された崩れ)
//   ⑤ VS に自分の側(3体)も出て、画面に入っている(相手の側より遅れて出るので、出そろうまで待ってから撮る)
//   ④ 実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const starterOpenPass = require(path.resolve(__dirname, 'lib/starter-open-pass.js'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 9246;
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
const WHO = 'kiki';

const run = async (browser, mode, scene, errors) => {
  const ctx = await browser.newContext({ viewport: mode.view, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const label = `${mode.label}・${scene.label}`;
  page.on('pageerror', (e) => errors.push(`${label}: ${String(e).slice(0, 200)}`));
  const asked = [];
  // ★Playwright はあとに登録した口を先に使う。Supabase 全体の偽物を先に置き、中継役の偽物をあとに置く
  await page.route(/supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  // 中継役は偽物(本物は呼ばない)。deckPlan は場面ごとに AI の返事か遅れ(sorry)。ほかの種類はいつも sorry
  await page.route(/card-assistant-talk/, async (r) => {
    let body = null; try { body = JSON.parse(r.request().postData() || 'null'); } catch (_) { body = null; }
    if (body && body.kind === 'deckPlan') {
      asked.push(body.assistantId);
      if (scene.ai) {
        const cands = body.facts.cards.map((c) => c.no);
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kind: 'plan', name: 'ゴーレム大暴れ', line: 'ためしに組んでみたよ!', prefer: cands.slice(0, 6), field: [body.facts.fields[0]], habit: { big: body.facts.habit.big[1] }, remainingToday: 9 }) });
      }
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, kind: 'sorry', text: null }) });
  });
  await page.addInitScript(() => { if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'あかり'); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_intro_done', true); put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true); put('mh_update_notice_seen_v1', true); });
  await page.addInitScript(eventStorySeed());
  // おしゃべり AI を呼べる端末にする(公開の印 cardAssistantTalk は main で真)。デッキの印は検査の中だけ
  // 自動操作のブラウザの書き込みの守り(26-supabase.jsx)は、中継役だけ偽物へ通す(差し替えた口だけ)
  await page.addInitScript((on) => { window.__aiDeckFlag = on; window.__mhSupabaseStubbed = ['card-assistant-talk']; }, scene.flag);
  // ⑥ これまでのデッキ: きき の昔のデッキを1つ置いておく(推しの枠・主役ゴーレム)。選び口で選び、VS・結果にその名前が出るか
  // ⑧ 遊ぶ人の提案(助手部の口 assistantLifeDeckWish の代わり): 推しのデッキ・守り・「まったり作戦」
  if (scene.wish) await page.addInitScript(() => { window.assistantLifeDeckWish = (id) => (id === 'kiki' ? { face: 'oshi', name: 'まったり作戦', plan: 'guard', day: '2026-11-08' } : null); });
  if (scene.past) await page.addInitScript(() => { if (sessionStorage.getItem('h')) return; sessionStorage.setItem('h', '1');
    localStorage.setItem('mh_card_ai_deck_history_v1', JSON.stringify({ v: 1, perWho: { kiki: [{ id: 'oshi-1700000000000', slot: 'oshi', name: 'ゴーレムの力くらべ', plan: null,
      spec: { lead: 'golem', avoid: ['dragon', 'zilla'], keep: ['tiger', 'hare'], free: 1, style: 'normal' }, monsters: [], top: [], from: 1700000000000, to: 1700300000000 }] } })); });
  const dismiss = async () => { for (let i = 0; i < 16; i++) { const did = await page.evaluate(() => { const inO = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || (s.position === 'absolute' && Number(s.zIndex) >= 40)) return true; } return false; };
    const l = [...document.querySelectorAll('button')].filter((b) => inO(b) && /^(確認|閉じる|OK|受け取る|次へ|わかった|はい|スキップ|あとで読む|あとで)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!l.length) return false; l[0].click(); return true; }); if (!did) break; await page.waitForTimeout(400); } };
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
  const snap = async (name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${mode.id}-${scene.id}-${name}.png`) }); } };
  const inView = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'ない'; const r = el.getBoundingClientRect(); const W = window.innerWidth, H = window.innerHeight;
    if (r.width < 2 || r.height < 2) return '見えない'; return r.left >= -1 && r.top >= -1 && r.right <= W + 1 && r.bottom <= H + 1 ? true : `画面の外(${Math.round(r.left)},${Math.round(r.top)}〜${Math.round(r.right)},${Math.round(r.bottom)} / ${W}×${H})`; }, sel);
  const boot = async () => {
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 40000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 40000 });
    await page.waitForTimeout(2500); await dismiss();
  };
  const flagUp = () => page.evaluate(() => { if (typeof RELEASE_FLAGS !== 'undefined') RELEASE_FLAGS.cardGrowStyle = window.__aiDeckFlag === true; }); // eslint-disable-line no-undef
  try {
    await boot();
    await flagUp();
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
    await page.evaluate(() => { localStorage.setItem('mh_card_cpu_unlocked_v1', JSON.stringify({ hard: true, expert: true, master: true })); });
    await boot();
    await flagUp();
    await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 30000 }); await dismiss();
    // 相手えらび: きき を選ぶ(会った印 → まだデッキが無いので裏で1つ組む)
    await page.locator('[data-card-cpu]').first().click();
    await page.locator('[data-card-mode-assistant]').click();
    await page.locator(`[data-card-foe="${WHO}"]`).waitFor({ timeout: 20000 });
    await page.locator(`[data-card-foe="${WHO}"]`).click();
    await page.getByRole('button', { name: /MASTER/ }).first().click();
    await page.waitForTimeout(2500);
    if (scene.wish) {
      await page.waitForTimeout(1500);
      const saved = await page.evaluate(() => { const v = JSON.parse(localStorage.getItem('mh_card_ai_recipe_v2') || 'null'); const u = JSON.parse(localStorage.getItem('mh_card_ai_deck_wish_v1') || 'null'); return { oshi: v && v.perWho.kiki && v.perWho.kiki.decks.oshi, used: u }; });
      check(`⑧ ${label}: 提案は次の組み直しで1回だけ使い、推しのデッキの名前と型になる・使った印を残す`, !!saved.oshi && saved.oshi.name === 'ゴーレムのまったり作戦' && saved.oshi.style === 'guard' && !!saved.used && JSON.stringify(saved.used.used.kiki) === JSON.stringify(['oshi:2026-11-08']), JSON.stringify(saved));
      // 今日のデッキを推しにして、相手えらびの札を見る(83 の cardAiDeckNextMemo)
      await page.evaluate(() => { cardAiDeckNextMemo.kiki = 'oshi'; }); // eslint-disable-line no-undef
      await page.locator('[data-card-foe="mua"]').click(); await page.locator(`[data-card-foe="${WHO}"]`).click(); await page.waitForTimeout(500);
      const chip = await page.evaluate((w) => { const c = document.querySelector(`[data-card-foe-style="${w}"] [data-card-foe-deck-chip-name]`); return c ? c.textContent.trim() : ''; }, WHO);
      check(`⑧ ${label}: 相手えらびの今日のデッキに提案の名前が出る`, /ゴーレムのまったり作戦$/.test(chip), chip);
      await snap('0-wish');
    }
    if (scene.past) {
      const pk = page.locator(`[data-card-foe-deck-picker="${WHO}"] [data-card-foe-deck-picker-open]`);
      const first = (await pk.innerText().catch(() => '')).replace(/\s+/g, '');
      check(`⑥ ${label}: 相手えらびに「デッキ おまかせ(その日の気分)」の選び口`, /^デッキおまかせ\(その日の気分\)/.test(first), first);
      await page.waitForTimeout(1500);
      await snap('0-picker-closed'); // 選び口を閉じたまま(今までの画面とくらべる)
      await pk.click();
      await page.waitForTimeout(1200); // 押したときの波紋が消えてから撮る
      const list = await page.evaluate(() => [...document.querySelectorAll('[data-card-foe-deck-choice]')].map((e) => e.getAttribute('data-card-foe-deck-choice')));
      const pastHead = await page.locator('[data-card-foe-deck-picker-list]').innerText().catch(() => '');
      check(`⑥ ${label}: 選び口に おまかせ・今の3つ・これまでのデッキ(名前と時期)`, JSON.stringify(list) === JSON.stringify(['auto', 'oshi', 'suki', 'sugao', 'h:oshi-1700000000000']) && /これまでのデッキ/.test(pastHead) && /ゴーレムの力くらべ/.test(pastHead) && /11\/1[5-9]/.test(pastHead), `${JSON.stringify(list)} / ${pastHead.replace(/\s+/g, ' ').slice(0, 80)}`);
      // ⑦ 崩れの種類「選び口を開くと右の欄が伸び、隣の欄(立ち絵と吹き出し)の中身が欄の下のほうへ押し出されて画面から出る」(2026-11-08 部長の止め絵・横 844×390)。
      //    横の画面で、開いたまま、左の欄の上の端から絵・吹き出しまでの距離が小さい(欄の上に寄っている)か。スクロールの位置に左右されないよう、欄の中の位置で見る
      if (mode.id === 'yoko') {
        const intro = await page.evaluate((w) => {
          const box = document.querySelector(`[data-card-foe-intro="${w}"]`); if (!box) return 'ない';
          const b = box.getBoundingClientRect();
          const im = box.querySelector('img'); const ln = box.querySelector('[data-card-foe-intro-line]');
          const right = document.querySelector(`[data-card-foe-style="${w}"]`);
          return { art: im ? Math.round(im.getBoundingClientRect().top - b.top) : null, line: ln ? Math.round(ln.getBoundingClientRect().top - b.top) : null, boxH: Math.round(b.height), rightH: right ? Math.round(right.getBoundingClientRect().height) : null };
        }, WHO);
        check(`⑦ ${label}: 選び口を開いて欄が伸びても、隣の欄の立ち絵と吹き出しは欄の上に寄ったまま(下へ押し出されない)`, intro && intro.art !== null && intro.art <= 40 && intro.line !== null && intro.line <= 90 && intro.boxH > 160, JSON.stringify(intro));
      }
      await snap('0-picker');
      await page.locator('[data-card-foe-deck-choice="h:oshi-1700000000000"]').scrollIntoViewIfNeeded();
      await page.waitForTimeout(400);
      check(`⑥ ${label}: 選び口の「これまでのデッキ」の行まで動かすと、画面に入る`, (await inView('[data-card-foe-deck-choice="h:oshi-1700000000000"]')) === true);
      await snap('0-picker-past');
      await page.locator('[data-card-foe-deck-choice="h:oshi-1700000000000"]').click();
      const chip = await page.evaluate((w) => { const c = document.querySelector(`[data-card-foe-style="${w}"] [data-card-foe-deck-chip-name]`); return c ? c.textContent.trim() : ''; }, WHO);
      check(`⑥ ${label}: 選ぶと、今日のデッキの札がそのデッキの名前になる`, /ゴーレムの力くらべ$/.test(chip), chip);
      const clip = await inView(`[data-card-foe-style="${WHO}"]`);
      check(`⑥ ${label}: 選び口を開いても型の欄が画面に入る`, clip === true, String(clip));
    }
    const saved0 = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_ai_recipe_v2') || 'null'));
    if (!scene.flag) check(`① ${label}: 保存を書かない・中継役を呼ばない`, saved0 === null && asked.length === 0, JSON.stringify({ saved0, asked }));
    else check(`${scene.ai ? '②' : '③'} ${label}: 相手えらびで選ぶと、裏で1つ組む`, !!saved0 && !!saved0.perWho && !!saved0.perWho[WHO] && Object.keys(saved0.perWho[WHO].decks).length === 1 && asked.includes(WHO) && Object.values(saved0.perWho[WHO].decks)[0].ai === scene.ai, JSON.stringify(saved0 && saved0.perWho && saved0.perWho[WHO]));
    // 対戦: 勝ちの場面にして、VS と結果を見る
    await page.evaluate(() => { window.__mhCardScene = (st) => { st.turn = 12; st.players[1].mons.forEach((m) => { m.life = 0; }); st.winner = 0; st.reason = '全員KO'; st.phase = 'over'; st.pending = null; return st; }; });
    await page.locator('[data-card-start]').click();
    let vs = null;
    for (let i = 0; i < 30 && !vs; i++) {
      vs = await page.evaluate(() => { const m = document.querySelector('[data-card-vs-mark]'); if (!m) return null; const s = document.querySelector('[data-card-vs-style] [data-card-foe-deck-chip-name]') || document.querySelector('[data-card-vs-style]'); const l = document.querySelector('[data-card-vs-line]'); const t = document.querySelector('[data-card-vs-style] [data-card-foe-team-name]'); return { style: s ? s.textContent.trim().replace(/^(⚔️|🛡️|⚖️|💖|⭐|🎭)\s*/u, '') : null, line: l ? l.textContent : null, team: t ? t.textContent : null }; });
      if (!vs) { const go = page.getByRole('button', { name: /^対戦へ$|このデッキで/ }).first(); if (await go.count() && await go.isVisible().catch(() => false)) await go.click().catch(() => {}); await page.waitForTimeout(250); }
    }
    // 自分の側(3体・名前)は相手の側より遅れて出る。出そろうまで待ってから撮る(2026-11-08 部長「止め絵に自分の側が写っていない」)
    let me = null;
    for (let i = 0; i < 24; i++) {
      me = await page.evaluate(() => { const side = document.querySelector('[data-card-vs-side="me"]'); if (!side) return null;
        const mons = [...side.querySelectorAll('[data-card-vs-mon]')]; const W = innerWidth, H = innerHeight;
        const shown = mons.filter((m) => { const r = m.getBoundingClientRect(); return Number(getComputedStyle(m).opacity) > 0.9 && r.width > 4 && r.left >= -1 && r.right <= W + 1 && r.top >= -1 && r.bottom <= H + 1; });
        return { mons: mons.length, shown: shown.length }; });
      if (me && me.mons === 3 && me.shown === 3) break;
      await page.waitForTimeout(250);
    }
    check(`⑤ ${label}: VS に自分の側の3体が出て、画面に入っている`, !!me && me.mons === 3 && me.shown === 3, JSON.stringify(me));
    await snap('1-vs');
    // 推し・好き・素顔の今の名前(2026-11-08 作り直し。素顔は口が無ければ よそいき)
    const names = await page.evaluate((w) => (typeof cardAiFaceName === 'function' ? ['oshi', 'suki', 'sugao'].map((f) => cardAiFaceName(w, f)) : []), WHO); // eslint-disable-line no-undef
    if (!scene.flag) check(`① ${label}: VS に型の札が出ない`, !!vs && vs.style === null, JSON.stringify(vs));
    else {
      const styleIn = await inView('[data-card-vs-style]');
      // 3つのうち組んだのは1つだけ。ほかの型が選ばれたときは既定の名前(どちらでも「型: 名前」とひとことが出る)
      const okName = !!vs && (scene.wish ? vs.style === 'ゴーレムのまったり作戦' : scene.past ? vs.style === 'ゴーレムの力くらべ' : (names.includes(vs.style) || (scene.ai && vs.style === 'ゴーレム大暴れ'))) && !!vs.team;
      check(`${scene.ai ? '②' : '③'} ${label}: VS に「チーム」と「今日のデッキ」の名前・ひとこと(画面の中)`, okName && !!vs.line && styleIn === true, `${JSON.stringify(vs)} / ${styleIn}`);
    }
    for (let i = 0; i < 40; i++) { if (await page.locator('[data-card-top="result"]').count()) break; await pass(); }
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await closeUp();
    const res = await page.evaluate(() => { const r = document.querySelector('[data-card-result-ai-deck] [data-card-foe-deck-chip-name]') || document.querySelector('[data-card-result-ai-deck]'); return r ? r.textContent.trim().replace(/^(⚔️|🛡️|⚖️|💖|⭐|🎭)\s*/u, '') : null; });
    if (!scene.flag) check(`① ${label}: 結果に型の札が出ない`, res === null, String(res));
    else {
      await page.evaluate(() => document.querySelector('[data-card-result-ai-deck]')?.scrollIntoView({ block: 'center' }));
      const resIn = await inView('[data-card-result-ai-deck]');
      check(`${scene.ai ? '②' : '③'} ${label}: 結果に VS と同じ「今日のデッキ」の名前(画面の中)`, !!res && !!vs && res === vs.style && resIn === true, `${res} / ${vs && vs.style} / ${resIn}`);
      const n = await page.evaluate((w) => { const v = JSON.parse(localStorage.getItem('mh_card_ai_recipe_v2') || 'null'); return v && v.perWho[w] ? v.perWho[w].gamesSince : null; }, WHO);
      check(`${scene.ai ? '②' : '③'} ${label}: その助手との10戦の数が1つ増える`, n === 1, String(n));
    }
    await snap('2-result');
  } finally { await ctx.close(); }
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  const SCENES = [{ id: 'off', label: '印が偽', flag: false, ai: false }, { id: 'ai', label: 'AI あり', flag: true, ai: true }, { id: 'noai', label: 'AI なし', flag: true, ai: false }, { id: 'past', label: '昔のデッキ', flag: true, ai: false, past: true }, { id: 'wish', label: '提案', flag: true, ai: false, wish: true }];
  try {
    for (const mode of MODES) for (const scene of SCENES) {
      try { await run(browser, mode, scene, errors); } catch (e) { check(`${mode.label}・${scene.label} 最後まで触れる`, false, String(e).slice(0, 300)); }
    }
    check('④ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally { await browser.close(); server.close(); }
  if (failed) { console.log(`助手の3つのデッキ(画面): NG ${failed}件`); process.exit(1); }
  console.log('助手の3つのデッキ(画面): すべてOK');
})();

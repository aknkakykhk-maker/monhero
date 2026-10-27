// MFバトルカードの「記録をくわしく」(2026-10-27 社長: 「全体」「助手ごと」「マルチ」の3つのタブ・よく使う技まで・これから遊んだ分から)を、
// 実際のブラウザで確かめる。保存は新しいキー mh_card_record_detail_v1 だけ。Supabase は偽物(読むだけの表を決めた行で返す)。
//
//   node tools/card/card-record-detail-check.js
//
// 見るもの
//   ① 壊れた保存・無い保存でも既定値(0・空)で読める(90 の cardNormalizeRecordDetail)
//   ② 前からの記録(mh_card_record_v1 の最近の30戦)から助手ごとの数を1回だけ起こす。起こした印があれば二度は足さない
//   ③ 1試合足す: 勝ち・負け・投了・連勝・いちばん早い勝ち・今日の勝ち(日付が変わったら1から)・デッキ(20まで)・モンスター・技
//   ④ 使った技を、試合のなぞり直しから数える(場の記録が古いものから捨てられても、全部数える)。技(ちから・かしこさ・特殊)だけ
//   ⑤ 途中で閉じた対戦を投了として数えるとき、助手ごとの投了にも同じ取引で入る。mh_card_record_v1 の形は変えない
//   ⑥ 記録の画面: 3つのタブ。「全体」に前からの表、「助手ごと」は押すと開く、「マルチ」は強さ・移り・最近の試合と「マルチの履歴」へ
//   ⑦ いちばん高かった強さは、マルチの履歴といまの点数から残す(新しいキーだけに書く)。本物へは何も送らない。実行時エラーが無い
const http = require('http');
const path = require('path');
const fs = require('fs');
const { quietBootSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = Number(process.env.CARD_PORT) || 8951;
const SELF = 'self-0000-0000-0000-000000000002';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const PVP = [{ breeder_id: SELF, user_name: '検査ブリーダー', icon: '🐣', profile_frame: null, rating: 1531, wins: 3, loses: 1 }];
const HISTORY = [
  { match: 'm3', at: Date.now() - 1000, room: 'free', outcome: 'win', reason: '', turns: 9, verify: 'ok', foe: { bid: 'b-a', name: 'たろう' }, rating: { before: 1533, after: 1548 } },
  { match: 'm2', at: Date.now() - 2000, room: 'free', outcome: 'lose', reason: '', turns: 8, verify: 'ok', foe: { bid: 'b-b', name: 'はなこ' }, rating: { before: 1549, after: 1533 } },
  { match: 'm1', at: Date.now() - 3000, room: 'free', outcome: 'win', reason: '', turns: 7, verify: 'ok', foe: { bid: 'b-c', name: 'じろう' }, rating: { before: 1500, after: 1549 } },
];

(async () => {
  let playwright;
  try { playwright = require(path.join(root, 'tools', 'node_modules', 'playwright')); } catch { try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていない'); return; } }
  const server = await serve();
  const errors = [];
  const writes = [];
  let browser;
  try {
    browser = await playwright.chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.route(/supabase\.co\//, async (r) => {
      const req = r.request();
      const url = req.url();
      const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (req.method() !== 'GET') { writes.push(url.replace(/^.*supabase\.co/, '')); return json(201, []); }
      if (/card_battle_pvp_ratings/.test(url)) {
        if (/rating=gt\./.test(url)) return json(200, [{ breeder_id: 'b-x' }, { breeder_id: 'b-y' }]);
        return json(200, /breeder_id=eq\./.test(url) ? PVP : PVP);
      }
      return json(200, []);
    });
    await ctx.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await ctx.addInitScript(({ self, history }) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      const s = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      s('mh_breeder_name', '検査ブリーダー'); s('mh_breeder_icon', '🐣'); s('mh_onboarded', true); s('mh_tutorial_seen_v1', true);
      s('mh_battle_tutorial_seen_v1', true); s('mh_battle_tutorial_guide_shown_v1', true);
      s('mh_inherited_unique_level_compensation_v1', true); s('mh_inherited_unique_level_compensation_pending_v1', false);
      s('mh_breeder_id_v1', self);
      s('mh_card_pvp_history_v1', history);
    }, { self: SELF, history: HISTORY });
    await ctx.addInitScript(quietBootSeed());
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    const sleep = (ms) => page.waitForTimeout(ms);
    const dismiss = async () => {
      for (let i = 0; i < 8; i++) {
        const b = page.getByRole('button', { name: /^(受け取る|閉じる|はじめる|OK|スキップ|あとで読む)$/ }).first();
        if (await b.count() === 0 || !(await b.isVisible().catch(() => false))) break;
        await b.dispatchEvent('click').catch(() => {}); await sleep(250);
      }
    };
    const home = page.locator('[data-home-card-battle]');
    const boot = async (reload) => {
      if (reload) await page.reload({ waitUntil: 'domcontentloaded' });
      else await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
      const top = page.getByRole('button', { name: 'トップ画面へ進む' });
      for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
      for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
    };
    await boot(false);

    // ①〜④ 計算(本体の関数をそのまま呼ぶ)
    const calc = await page.evaluate(() => {
      const out = {};
      const n0 = cardNormalizeRecordDetail('こわれた');
      const n1 = cardNormalizeRecordDetail({ foes: { mua: { win: -3, lose: 'x' } }, wins: { n: NaN }, decks: { a: { n: 2, name: 5 } }, mons: { 'C-1': 2.7, bad: -1 }, quick: 3, seeded: 1 });
      out.norm = { empty: n0.seeded === false && Object.keys(n0.foes).length === 0 && n0.wins.n === 0 && n0.quick === 0, broken: n1.foes.mua.win === 0 && n1.foes.mua.lose === 0 && n1.wins.n === 0 && n1.decks.a.name === '' && n1.mons['C-1'] === 2 && !('bad' in n1.mons) && n1.quick === 3 && n1.seeded === false };
      // 最近の30戦は新しい順。みゅあ: 勝・勝・負(古い順) → 連勝は負けで切れて 0、最高 2
      const record = { recent: [
        { at: 4, who: 'kiki', level: 'easy', outcome: 'surrender' }, { at: 3, who: 'mua', level: 'easy', outcome: 'lose' },
        { at: 2, who: 'mua', level: 'normal', outcome: 'win' }, { at: 1, who: 'mua', level: 'easy', outcome: 'win' },
      ] };
      const s1 = cardRecordDetailSeed(cardNormalizeRecordDetail(null), record);
      const s2 = cardRecordDetailSeed(s1, record);
      out.seed = { mua: s1.foes.mua, kiki: s1.foes.kiki, seeded: s1.seeded, twice: JSON.stringify(s1) === JSON.stringify(s2) };
      let d = s1;
      d = cardRecordDetailAfter(d, { who: 'mua', level: 'hard', outcome: 'win', turns: 9, deck: { id: 'd1', name: 'はやい' }, mons: ['C-1', 'C-2', 'C-3'], moves: { '001': 2 }, today: '2026-10-27' });
      d = cardRecordDetailAfter(d, { who: 'mua', level: 'hard', outcome: 'win', turns: 7, deck: { id: 'd1', name: 'はやい' }, mons: ['C-1', 'C-2', 'C-3'], moves: { '001': 1, '002': 4 }, today: '2026-10-27' });
      const sameDay = d.day.win;
      d = cardRecordDetailAfter(d, { who: 'mua', level: 'hard', outcome: 'win', turns: 12, today: '2026-10-28' });
      const nextDay = d.day;
      d = cardRecordDetailAfter(d, { who: 'mua', level: 'hard', outcome: 'surrender', turns: 3, today: '2026-10-28' });
      out.after = { mua: d.foes.mua, wins: d.wins, sameDay, nextDay, deck: d.decks.d1, mons: d.mons, moves: d.moves };
      let many = cardNormalizeRecordDetail(null);
      for (let i = 0; i < 25; i++) many = cardRecordDetailAfter(many, { who: 'mua', level: 'easy', outcome: 'lose', deck: { id: `deck${i}`, name: `d${i}` } });
      const keptLast = !!many.decks.deck24;
      many = cardRecordDetailAfter(many, { who: 'mua', level: 'easy', outcome: 'lose', deck: { id: 'deck24', name: 'd24' } });
      out.decksMax = { n: Object.keys(many.decks).length, kept: keptLast && many.decks.deck24 && many.decks.deck24.n === 2 };
      // ④ 2人とも助手の考えで1試合を最後まで進め、なぞり直しから数えた技と、進めながら数えた技(場の記録の捨てられ方に頼らない)を比べる
      const db = CARD_BATTLE_DATA;
      const decks = [cardAiBuildDeck(db, 'mua', 'normal', cardAiSeededRand('rec-a')), cardAiBuildDeck(db, 'kiki', 'normal', cardAiSeededRand('rec-b'))];
      const seed = 12345;
      const first = 0;
      let st = cardCreateGame(db, { decks, names: ['あなた', 'みゅあ'], seed, first });
      const policy = cardAiPolicy('mua', 'normal');
      const rand = cardAiSeededRand('rec-play');
      const history = [];
      const live = {};
      let logEver = 0;
      for (let i = 0; i < 3000 && st.winner === null; i++) {
        const by = cardPvpDecider(st);
        const act = cardAiChooseAction(db, st, policy, rand);
        if (!act) break;
        const next = cardApplyAction(db, st, act);
        if (!next) break;
        history.push({ by, act });
        // 進めながら数える: 前の場の記録の最後の行より後ろが、この手で足された行
        const prev = st.log;
        const last = prev.length ? JSON.stringify(prev[prev.length - 1]) : null;
        let from = 0;
        if (last !== null) { for (let k = next.log.length - 1; k >= 0; k--) { if (JSON.stringify(next.log[k]) === last) { from = k + 1; break; } } }
        next.log.slice(from).forEach((e) => { logEver += 1; if (e.kind === 'use' && e.p === 0) e.cards.forEach((no) => { const c = cardOf(db, no); if (c && ['pow', 'int', 'spe'].includes(c.kind)) live[no] = (live[no] || 0) + 1; }); });
        st = next;
      }
      const rec = cardReplayFromCpu(db, { id: 'crec', at: Date.now(), myDeck: decks[0], cpuDeck: decks[1], seed, first, history, foe: { name: 'みゅあ', who: 'mua' }, outcome: st.winner === 0 ? 'win' : 'lose', reason: '' });
      const counted = cardRecordMovesOf(db, rec);
      out.moves = { over: st.winner !== null, acts: history.length, logEver, logMax: CARD_BATTLE_LOG_MAX, rec: !!rec, live, counted,
        kinds: Object.keys(counted).every((no) => ['pow', 'int', 'spe'].includes((cardOf(db, no) || {}).kind)), none: JSON.stringify(cardRecordMovesOf(db, null)) };
      return out;
    });
    check('① 壊れた保存・無い保存でも既定値で読める', calc.norm.empty && calc.norm.broken, JSON.stringify(calc.norm));
    const m = calc.seed.mua;
    check('② 最近の30戦から助手ごとの数を起こす(古い順に連勝を数える)', m.win === 2 && m.lose === 1 && m.now === 0 && m.best === 2 && m.levels.easy === 1 && m.levels.normal === 1 && calc.seed.kiki.surrender === 1 && calc.seed.seeded, JSON.stringify(calc.seed));
    check('② 起こした印があれば、二度は足さない', calc.seed.twice);
    const a = calc.after;
    check('③ 勝ち・連勝・いちばん早い勝ち・投了で連勝が切れる', a.mua.win === 5 && a.mua.surrender === 1 && a.mua.now === 0 && a.mua.best === 3 && a.mua.fastest === 7 && a.mua.levels.hard === 3, JSON.stringify(a.mua));
    check('③ 勝つまでの平均(自分の番の合計と勝ち数)', a.wins.n === 3 && a.wins.turns === 28 && a.wins.fastest === 7, JSON.stringify(a.wins));
    check('③ 今日の勝ちは日付が変わると1から', a.sameDay === 2 && a.nextDay.key === '2026-10-28' && a.nextDay.win === 1, JSON.stringify({ sameDay: a.sameDay, nextDay: a.nextDay }));
    check('③ デッキ・モンスター・技を足す', a.deck.n === 2 && a.deck.name === 'はやい' && a.mons['C-1'] === 2 && a.moves['001'] === 3 && a.moves['002'] === 4, JSON.stringify({ deck: a.deck, mons: a.mons, moves: a.moves }));
    check('③ デッキは多い順に20まで(いま使ったデッキは同じ数の古いものに押し出されない)', calc.decksMax.n === 20 && calc.decksMax.kept, JSON.stringify(calc.decksMax));
    const mv = calc.moves;
    check('④ なぞり直しから数えた技が、進めながら数えた技と同じ', mv.over && mv.rec && JSON.stringify(Object.entries(mv.counted).sort()) === JSON.stringify(Object.entries(mv.live).sort()) && Object.keys(mv.counted).length > 0,
      `手 ${mv.acts}・記録の行 ${mv.logEver}(上限 ${mv.logMax}) / ${JSON.stringify(mv.counted)} / ${JSON.stringify(mv.live)}`);
    check('④ 場の記録の上限より長い試合でも数える(この試合の記録の行が上限を超えている)', mv.logEver > mv.logMax, `${mv.logEver} > ${mv.logMax}`);
    check('④ 技(ちから・かしこさ・特殊)だけ・試合の記録が無ければ空', mv.kinds && mv.none === '{}');

    // ⑤ 途中で閉じた対戦(印が古い)を、MFバトルカードを開いたときに投了として数える → 助手ごとの投了にも入る
    await home.click();
    await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
    await sleep(600); await dismiss();
    if (await page.locator('[data-card-top="starter"]').count()) {
      await page.locator('[data-card-kit="speed"]').click();
      await page.getByRole('button', { name: /にする$/ }).click();
      await require(require('path').join(__dirname, 'lib/starter-open-pass.js'))(page); // はじめのスターターを開ける画面を通す
      await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
      await page.locator('[data-card-quit]').click();
      await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
      await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
      await page.getByRole('button', { name: /トップへ/ }).first().click();
      await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
    }
    await page.evaluate(() => {
      const r = JSON.parse(localStorage.getItem('mh_card_record_v1') || 'null') || {};
      r.recent = [{ at: 2, who: 'mua', level: 'easy', outcome: 'win' }, { at: 1, who: 'mua', level: 'easy', outcome: 'win' }];
      r.cpu = { win: 2, lose: 0, surrender: 0 };
      localStorage.setItem('mh_card_record_v1', JSON.stringify(r));
      localStorage.removeItem('mh_card_record_detail_v1');
      const now = Date.now();
      localStorage.setItem('mh_card_cpu_open_v1', JSON.stringify({ id: 'old-1', who: 'kiki', level: 'easy', rankable: false, at: now - 600000, beat: now - 600000, facts: { ownTurns: 5, kos: 0 } }));
    });
    await boot(true);
    await home.click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    await sleep(1500); await dismiss();
    const after5 = await page.evaluate(() => ({ detail: JSON.parse(localStorage.getItem('mh_card_record_detail_v1') || 'null'), record: JSON.parse(localStorage.getItem('mh_card_record_v1') || 'null'), open: localStorage.getItem('mh_card_cpu_open_v1') }));
    const d5 = after5.detail || { foes: {} };
    check('⑤ 途中で閉じた対戦は、助手ごとの投了にも入る(前の2勝も起こしてある)', d5.seeded === true && d5.foes.kiki && d5.foes.kiki.surrender === 1 && d5.foes.mua && d5.foes.mua.win === 2, JSON.stringify(d5.foes));
    check('⑤ mh_card_record_v1 の形はそのまま(投了の数が増えるだけ)・印は消える', after5.record && after5.record.cpu.surrender === 1 && Array.isArray(after5.record.recent) && !('foes' in after5.record) && (after5.open === null || after5.open === 'null'), JSON.stringify(after5.record && after5.record.cpu));

    // ⑥ 記録の画面
    await page.locator('[data-card-record-open], button:has-text("記録")').first().click();
    await page.locator('[data-card-record-view]').waitFor({ timeout: 10000 });
    await sleep(600);
    check('⑥ 3つのタブ(全体・助手ごと・マルチ)', (await page.locator('[data-card-record-tab]').count()) === 3);
    check('⑥ 全体: 前からの表(助手と対戦・難易度ごと)と、勝ち方・よく使う・ほか', (await page.locator('[data-card-record]').innerText()).includes('2勝 1敗') && await page.locator('[data-card-record-levels]').count() === 1
      && await page.locator('[data-card-record-wins]').count() === 1 && await page.locator('[data-card-record-often]').count() === 1 && await page.locator('[data-card-record-other]').count() === 1, (await page.locator('[data-card-record]').innerText()));
    await page.locator('[data-card-record-tab="foe"]').click(); await sleep(400);
    const kikiRow = page.locator('[data-card-record-foe="kiki"]');
    check('⑥ 助手ごと: 勝ち負け(投了は負けに数える)', (await kikiRow.innerText()).includes('0勝 1敗') && (await page.locator('[data-card-record-foe="mua"]').innerText()).includes('2勝 0敗'), (await page.locator('[data-card-record-foes]').innerText()).replace(/\s+/g, ' ').slice(0, 200));
    await kikiRow.locator('button').click(); await sleep(300);
    check('⑥ 助手ごと: 押すと開いて、投了・連勝・難易度ごとが出る', (await page.locator('[data-card-record-foe-open="kiki"]').count()) === 1 && (await page.locator('[data-card-record-foe-open="kiki"]').innerText()).includes('投了'));
    await page.locator('[data-card-record-tab="multi"]').click();
    await page.locator('[data-card-record-trend] i').first().waitFor({ timeout: 10000 }).catch(() => {});
    await sleep(800);
    const multiText = (await page.locator('[data-card-record-multi]').innerText()).replace(/\s+/g, ' ');
    check('⑥ マルチ: いまの強さと順位(自分より高い人の数 + 1)', multiText.includes('1531') && multiText.includes('3位'), multiText);
    check('⑥ マルチ: 強さの移り(履歴の点数の分だけ棒)と最近の試合', (await page.locator('[data-card-record-trend] i').count()) === 3 && (await page.locator('[data-card-record-recent]').innerText()).includes('たろう'));
    const best = await page.evaluate(() => (JSON.parse(localStorage.getItem('mh_card_record_detail_v1') || 'null') || {}).pvpBest);
    check('⑦ いちばん高かった強さを履歴から残す(新しいキーだけ)', best === 1549 && (await page.locator('[data-card-record-multi]').innerText()).includes('1549'), `pvpBest ${best}`);
    await page.locator('[data-card-record-pvp-history]').click(); await sleep(600);
    check('⑥ 「マルチの履歴」へ行けて、戻ると記録に戻る', (await page.locator('text=マルチの履歴').count()) > 0);
    await page.getByRole('button', { name: /戻る|もどる/ }).first().click().catch(async () => { await page.locator('[data-mh-screen] button').first().click(); });
    await page.locator('[data-card-record-view]').waitFor({ timeout: 5000 }).catch(() => {});
    check('⑥ 戻ると記録の画面', (await page.locator('[data-card-record-view]').count()) === 1);
    // 320 幅で横にはみ出さない
    await page.setViewportSize({ width: 320, height: 568 });
    for (const t of ['all', 'foe', 'multi']) {
      await page.locator(`[data-card-record-tab="${t}"]`).click(); await sleep(300);
      const over = await page.evaluate(() => [...document.querySelectorAll('[data-card-record-view] *')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1); }).length);
      check(`⑥ 320幅の「${t}」で横にはみ出さない`, over === 0, `${over}個`);
    }
    check('⑦ 本物へは何も送らない(書き込みは偽物の表だけ)', writes.every((w) => !/card_battle_ranks|card_battle_pvp_report/.test(w)), writes.join(','));
    check('⑦ 実行時エラーが無い', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    check('検査が最後まで進む', false, e.message.slice(0, 400));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

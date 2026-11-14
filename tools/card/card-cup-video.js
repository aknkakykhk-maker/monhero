#!/usr/bin/env node
// MFバトルカードの紹介動画 第3弾の撮影の道具(2026-11-06 ルールくん。案はビート部テンポ・社長「この案で撮る」)。ゲームは変えない・撮るだけ
//
//   node tools/card/card-cup-video.js            (b) 個人杯 と (c) 公式杯 を全部撮る
//   node tools/card/card-cup-video.js --only b   (b) だけ / --only c で (c) だけ
//   VIDEO_DIR=<フォルダ> で出し先を変える(既定は docs/progress/card-intro-video-3)
//
// 形(全員共通): 縦 390×844 を deviceScaleFactor 2(= 780×1688)で、場面ごとに mp4(音なし)。各 8〜14 秒
//   ・本物の表(Supabase)には行かない。答えはこの道具の中の偽の表で返す。名前はそれらしい普通の名前(ほかのブリーダーの本名・デッキ名は出さない)
//   ・デバッグのボタン・合言葉の欄は映さない(デバッグの印を立てない。準備の場面は録ったあとで切り落とす)
//   ・ブラウザから2倍の細かさのこまを受け取り(CDP の screencast)、場面の始まりと終わりの時刻で ffmpeg に並べて mp4 にする
// 撮るもの
//   (b) 個人杯(ゲームの上に個人杯の画面 CardCup を重ねて描く。card-cup-screen-browser-check.js と同じ形)
//       b1-open    個人杯をひらく: 「開く」→ 名前・形式・人数を選んで「開く」を押すまで(開いたあとは合言葉が出るので映さない)
//       b2-join    参加: 一覧 → 杯を押す → 参加の画面(このデッキで参加)まで(参加したあとは合言葉が出るので映さない)
//       b3-result  結果: トーナメントの山の表で、勝ち上がりの線が光って優勝カップへ
//   (c) 公式杯(本物のゲームの画面を通る。card-tour-home-browser-check.js と同じ入り方)
//       c1-table   HOME の公式杯の札 → 総当たりの順位の表(「大会結果」の演出)
//       c2-replay  「試合」→「見返す」→ 試合のリプレイ(自動で進める)
const http = require('http'), path = require('path'), fs = require('fs');
const { execFileSync } = require('child_process');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 8971;
const OUT = process.env.VIDEO_DIR || path.join(ROOT, 'docs', 'progress', 'card-intro-video-3');
const ONLY = (() => { const i = process.argv.indexOf('--only'); return i >= 0 ? process.argv[i + 1] : ''; })();
const VW = 390, VH = 844, DPR = 2;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const serve = () => new Promise((r) => { const s = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res); }); s.listen(PORT, () => r(s)); });
const J = (v) => JSON.stringify(v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- 偽の表(それらしい普通の名前) ----
const ME = 'あかり';
const NAMES = ['あかり', 'ゆうと', 'さくら', 'はると', 'みお', 'そうた', 'あおい', 'れん'];
const MONS = ['C-001', 'C-002', 'C-003'];
const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const KEY = 'c'.repeat(48);
const myDeck = [{ owner_id: 'me', user_name: ME, deck: { monsters: MONS, cards: Array(50).fill('001') }, tactics: { habit: 'kiki', name: 'まっすぐ攻めデッキ' }, version: 1, active: true, battles: 0, deck_wins: 0, rents: 0, updated_at: iso(now) }];

// 録画: Playwright の recordVideo は 1倍(390×844)でしか絵を撮らず、780×1688 の枠の左上にしか入らない(2026-11-06 テンポの指摘・card-tactic-video.js と同じ直し)。
//   そこで、ブラウザに画面のこまを deviceScaleFactor 2 の細かさ(780×1688)で送らせ(CDP の Page.startScreencast)、直近 KEEP_MS ぶんだけ手元に持つ。
//   こまは画面が変わったときだけ届くので、mp4 にするときは次のこままでの長さを付けて並べる。場面が終わるたびにすぐ mp4 にする
const KEEP_MS = 60000;
const recorder = async (context, page) => {
  const client = await context.newCDPSession(page);
  const frames = [];
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp * 1000, buf: Buffer.from(data, 'base64') });
    const old = Date.now() - KEEP_MS;
    while (frames.length > 2 && frames[1].t < old) frames.shift();
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: VW * DPR, maxHeight: VH * DPR, everyNthFrame: 1 });
  return { frames, stop: () => client.send('Page.stopScreencast').catch(() => {}) };
};
// from〜to(Date.now() の時刻・ミリ秒)のこまを mp4 に(30fps・780×1688・音なし)
const mp4 = (rec, name, from, to) => {
  fs.mkdirSync(OUT, { recursive: true });
  const out = path.join(OUT, `${name}.mp4`);
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'card-cup-frames-'));
  try {
    const all = rec.frames;
    const startIdx = Math.max(0, all.findIndex((f) => f.t > from) - 1);
    const use = all.slice(startIdx).filter((f) => f.t <= to);
    if (!use.length) throw new Error(`${name}: こまが無い`);
    const lines = [];
    use.forEach((f, i) => {
      const file = path.join(dir, `${String(i).padStart(5, '0')}.jpg`);
      fs.writeFileSync(file, f.buf);
      const a = Math.max(f.t, from), b = i + 1 < use.length ? use[i + 1].t : to;
      lines.push(`file '${file}'`, `duration ${Math.max(0.001, (b - a) / 1000).toFixed(3)}`);
    });
    lines.push(`file '${path.join(dir, `${String(use.length - 1).padStart(5, '0')}.jpg`)}'`);
    fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', `scale=${VW * DPR}:${VH * DPR}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-an', '-movflags', '+faststart', out]);
    console.log(`  ${path.relative(ROOT, out)}(${((to - from) / 1000).toFixed(1)}秒)`);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};
// 1つのモードを1つのページで撮る。fn(page, mark, start, save): start() で録り始め、save(名前, 始まり, 終わり) で場面を mp4 に
const record = async (browser, name, fn) => {
  const context = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e && e.message || e)));
  let rec = null;
  const start = async () => { if (!rec) rec = await recorder(context, page); await page.waitForTimeout(300); };
  const save = (clip, a, b) => mp4(rec, clip, a, b);
  try { await fn(page, () => Date.now(), start, save); } finally { if (rec) await rec.stop(); await context.close(); }
  if (errors.length) console.log(`  (${name} の実行時エラー: ${errors.slice(0, 2).join(' / ')})`);
};
const seed = (page, extra = {}) => page.addInitScript((x) => {
  if (sessionStorage.getItem('__vidSeeded')) return; sessionStorage.setItem('__vidSeeded', '1');
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', x.me); put('mh_breeder_icon', '🐣'); put('mh_onboarded', true); put('mh_intro_done', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_inherited_unique_level_compensation_pending_v1', false);
  put('mh_update_notice_seen_v1', true); put('mh_card_deck_owner_key_v1', x.key);
}, { me: ME, key: KEY, ...extra });
// 前に出る窓(お知らせ・ログインのごほうびなど)を閉じる
const dismiss = async (page) => { for (let i = 0; i < 16; i++) {
  const did = await page.evaluate(() => { const inOverlay = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const st = getComputedStyle(e); if (st.position === 'fixed' || (st.position === 'absolute' && Number(st.zIndex) >= 40)) return true; } return false; };
    const l = [...document.querySelectorAll('button')].filter((b) => inOverlay(b) && /^(確認|閉じる|OK|受け取る|次へ|(?:分|わ)かった|はい|スキップ|あとで読む|あとで)$/.test((b.innerText || '').replace(/\s+/g, ' ').trim()));
    if (!l.length) return false; l[0].click(); return true; }).catch(() => false);
  if (!did) return; await page.waitForTimeout(400); } };
const boot = async (page) => {
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 40000 });
  await page.getByRole('button', { name: 'モンヒロバトル', exact: true }).waitFor({ timeout: 40000 });
  await page.waitForTimeout(2500);
  await dismiss(page);
};

// ======== (b) 個人杯 ========
const cupRow = (o) => ({ id: 'c1', name: '金曜の夜カップ', host_id: 'host', host_name: 'さくら', host_icon: null, mode: 'auto', format: 'ko', max: 8, listed: true, status: 'entry',
  entry_until: iso(now + 3 * 3600000), start_at: iso(now + 5 * 3600000), closed_reason: null, done_at: null, players: 5, ...o });
const cupEnt = (i, o = {}) => ({ owner_id: `p${i}`, mine: false, user_name: NAMES[i], icon: null, monsters: MONS, seat: i, checkin: false, place: null, wins: null, ...o });
const KO = { rounds: [[[0, 7], [3, 4], [1, 6], [2, 5]], [[0, 3], [1, 2]], [[0, 1]]] };
const koMatches = [
  ...KO.rounds[0].map((p, k) => ({ id: 100 + k, round: 0, slot: k, a: p[0], b: p[1], winner: 0, kos: [3, 1], decided: 'ko', live: null })),
  ...KO.rounds[1].map((p, k) => ({ id: 110 + k, round: 1, slot: k, a: p[0], b: p[1], winner: 0, kos: [3, 2], decided: 'ko', live: null })),
  { id: 120, round: 2, slot: 0, a: 0, b: 1, winner: 0, kos: [3, 2], decided: 'ko', live: null },
];
const shootCup = (browser) => record(browser, '(b) 個人杯', async (page, mark, start, save) => {
  let joined = false;
  await page.route(/supabase\.co/, async (route) => {
    const url = route.request().url();
    const m = url.match(/rpc\/(card_cup_[a-z_]+)/);
    if (!m) return route.fulfill({ status: 200, contentType: 'application/json', body: url.includes('card_deck_entries') ? J(myDeck) : '[]' });
    const body = JSON.parse(route.request().postData() || '{}');
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: J(v) });
    const fn = m[1];
    if (fn === 'card_cup_list') return json([cupRow({}), cupRow({ id: 'c2', name: 'のんびり総当たり杯', mode: 'live', format: 'rr', max: 6, players: 4, host_name: 'はると' }), cupRow({ id: 'c3', name: '朝のデュラハン杯', max: 4, players: 2, host_name: 'みお' })]);
    if (fn === 'card_cup_list_done') return json([cupRow({ id: 'cko', name: '週末トーナメント', status: 'done', start_at: iso(now - 3600000), players: 8, host_name: 'ゆうと' })]);
    if (fn === 'card_cup_match_for') return json(null);
    if (fn === 'card_cup_mine') return json([cupRow({ id: 'cko', name: '週末トーナメント', status: 'done', start_at: iso(now - 3600000), players: 8, host_name: 'ゆうと' })]);
    if (fn === 'card_cup_join') { joined = true; return json('ok'); }
    if (fn === 'card_cup_create') return json({ status: 'ok', id: 'cnew', code: '583104' });
    if (fn === 'card_cup_view') {
      if (body.p_cup === 'cko') return json({ cup: { ...cupRow({ id: 'cko', name: '週末トーナメント', status: 'done', start_at: iso(now - 3600000), players: 8, host_name: 'ゆうと' }), code: null, bracket: KO }, me: true,
        entries: Array.from({ length: 8 }, (_, i) => cupEnt(i, { mine: i === 0, place: [1, 2, 3, 3, 5, 5, 5, 5][i], wins: [3, 2, 1, 1, 0, 0, 0, 0][i] })), matches: koMatches });
      if (body.p_cup === 'cnew') return json({ cup: { ...cupRow({ id: 'cnew', name: 'みんなで遊ぼうカップ', host_id: 'ME', host_name: ME, players: 1 }), code: '583104', bracket: null }, me: true,
        entries: [cupEnt(0, { owner_id: 'ME', mine: true, user_name: ME, seat: null })], matches: [] });
      return json({ cup: { ...cupRow({ id: body.p_cup, players: joined ? 6 : 5 }), code: joined ? '274615' : null, bracket: null }, me: joined,
        entries: [1, 2, 3, 4, 5].map((i) => cupEnt(i, { seat: null })).concat(joined ? [cupEnt(0, { owner_id: 'ME', mine: true, user_name: ME, seat: null })] : []), matches: [] });
    }
    return json(null);
  });
  await seed(page);
  await boot(page);
  await page.waitForFunction(() => typeof CardCup === 'function' && typeof ReactDOM !== 'undefined', null, { timeout: 90000 });
  await start();
  const mount = () => page.evaluate(() => {
    document.getElementById('__cup')?.remove();
    const div = document.createElement('div');
    div.id = '__cup';
    div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
    document.body.appendChild(div);
    window.__root = ReactDOM.createRoot(div);
    window.__root.render(React.createElement(CardCup, { onBack: () => {}, onOpenRegister: () => {}, onOpenReplay: async () => true }));
  });
  const T = (sel) => page.locator(`#__cup ${sel}`);
  // b1 個人杯をひらく
  await mount();
  await T('[data-card-cup-tab="create"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  let a = mark();
  await page.waitForTimeout(2200);
  await T('[data-card-cup-tab="create"]').click();
  await T('[data-card-cup-create-go]').waitFor({ timeout: 10000 });
  await page.waitForTimeout(900);
  await T('[data-card-cup-name]').click();
  await T('[data-card-cup-name]').fill('');
  await T('[data-card-cup-name]').pressSequentially('みんなで遊ぼうカップ', { delay: 130 });
  await page.waitForTimeout(700);
  for (const opt of ['format-ko', 'max-8']) { const o = T(`[data-card-cup-opt="${opt}"]`); if (await o.count()) { await o.click(); await page.waitForTimeout(700); } }
  await T('[data-card-cup-create-go]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(2000);
  // 開いたあとの画面には合言葉が出るので、「開く」を押したところで場面を切る(合言葉は映さない)
  await T('[data-card-cup-create-go]').hover().catch(() => {});
  await page.waitForTimeout(400);
  save('b1-open', a, mark());
  await T('[data-card-cup-create-go]').click();
  // b2 参加
  await mount();
  await T('[data-card-cup-row="c1"]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(600);
  a = mark();
  await page.waitForTimeout(2500);
  await T('[data-card-cup-row="c1"]').click();
  await T('[data-card-cup-join-go]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(3000);
  await T('[data-card-cup-join-go]').scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(3500);
  // 参加したあとの画面には合言葉が出るので、参加の画面(このデッキで参加)までで場面を切る(合言葉は映さない)
  save('b2-join', a, mark());
  // b3 結果のトーナメント
  await mount();
  await T('[data-card-cup-tab="mine"]').waitFor({ timeout: 20000 });
  await T('[data-card-cup-tab="mine"]').click();
  await T('[data-card-cup-row="cko"]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(500);
  a = mark();
  await page.waitForTimeout(1600);
  await T('[data-card-cup-row="cko"]').click();
  await T('[data-card-cup-bracket]').waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#__cup [data-card-cup-bracket]')?.getAttribute('data-card-cup-lit') === '3', null, { timeout: 15000 });
  await page.waitForTimeout(4500);
  save('b3-result', a, mark());
});

// ======== (c) 公式杯 ========
const DAY = 86400000;
const jst = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const addDay = (ymd, n) => jst(Date.parse(`${ymd}T00:00:00+09:00`) + n * DAY);
const at4 = (ymd) => new Date(Date.parse(`${ymd}T04:00:00+09:00`)).toISOString();
const first = jst(now - 5 * DAY);
const TOUR = { id: 'tour-v3', name: '第1回 MFバトルカード公式杯', open_on: jst(now - 8 * DAY), entry_until: new Date(Date.parse(`${first}T00:00:00+09:00`)).toISOString(), status: 'done',
  first_day: first, done_day: addDay(first, 3), groups: 1, rewards: { ranks: [{ point: 10000 }, { point: 5000 }, { point: 3000 }], participation: { point: 500 }, perWin: 100 }, players: 4 };
const tourEnt = (seat, name, place, wins, mine = false) => ({ seat_id: `s${seat}`, mine, is_assist: false, assist_id: null, user_name: name, monsters: MONS, grp: 0, seat, final_seat: null, place, wins });
const TOUR_ENTRIES = [tourEnt(0, ME, 1, 3, true), tourEnt(1, 'ゆうと', 2, 2), tourEnt(2, 'さくら', 3, 1), tourEnt(3, 'はると', 4, 0)];
const LIVE = { who: 'kiki', play: '最後の1体まで目が離せない、手に汗にぎる試合になりました', review: '守りのカードを最後まで残したのが、勝ちにつながりました', ai: true };
const pairs = [[0, 1, 0], [2, 3, 0], [0, 2, 0], [1, 3, 0], [0, 3, 0], [1, 2, 0]];
const TOUR_MATCHES = pairs.map(([a, b, w], i) => ({ id: 301 + i, stage: 'group', grp: 0, day: Math.floor(i / 2), a, b, play_on: addDay(first, Math.floor(i / 2)), visible_at: at4(addDay(first, Math.floor(i / 2) + 1)),
  winner: w, kos: [3, 1 + (i % 2)], decided: 'ko', live: LIVE }));
const shootTour = (browser) => record(browser, '(c) 公式杯', async (page, mark, start, save) => {
  let matchRow = null;
  await page.route(/supabase\.co/, async (route) => {
    const url = route.request().url();
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: J(v) });
    const m = url.match(/rpc\/(card_tournament_[a-z]+)/);
    if (!m) return json(url.includes('card_deck_entries') ? myDeck : []);
    const fn = m[1];
    if (fn === 'card_tournament_list') return json([TOUR]);
    if (fn === 'card_tournament_history') return json([]);
    if (fn === 'card_tournament_view') return json({ tour: TOUR, me: true, entries: TOUR_ENTRIES, matches: TOUR_MATCHES });
    if (fn === 'card_tournament_match') return json(matchRow);
    return json(null);
  });
  await seed(page);
  await boot(page);
  // MFバトルカードをはじめて開くと出るスターター選びと練習試合を、先に済ませる(録画からは切り落とす)
  await page.locator('[data-home-card-battle]').first().dispatchEvent('click');
  await page.locator('[data-card-top="starter"]').waitFor({ timeout: 30000 });
  await page.locator('[data-card-kit="powerful"]').click();
  await page.getByRole('button', { name: /にする$/ }).click();
  await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
  await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-quit]').click();
  await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
  await page.getByRole('button', { name: 'トップへ' }).click();
  await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
  // 見返す試合(本物の部品 cardTourPlay で1試合回し、表の1行と同じ形にする。何も保存しない・送らない)
  matchRow = await page.evaluate(({ me, foe, live }) => {
    const db = CARD_BATTLE_DATA;
    const s = 424242;
    const res = cardTourPlay(db, { assist: 'kiki' }, { assist: 'atsu' }, { seed: s, first: 0, key: `video|${s}` });
    return { id: 301, stage: 'group', day: 0, seed: s, first: 0, winner: res.winner, kos: res.kos, rules: res.rules, acts: res.acts, live,
      a: { name: me, icon: null, is_assist: false, deck: res.decks[0] }, b: { name: foe, icon: null, is_assist: false, deck: res.decks[1] } };
  }, { me: ME, foe: 'はると', live: LIVE }); // 「試合」のタブのいちばん上は最終日の「あなた 対 はると」
  // HOME へ戻る(読み込み直す)
  await boot(page);
  await page.locator('[data-home-card-tour]').waitFor({ timeout: 30000 });
  await dismiss(page);
  await start();
  await page.waitForTimeout(800);
  // c1 総当たりの順位の表
  let a = mark();
  await page.waitForTimeout(1500);
  await page.locator('[data-home-card-tour]').dispatchEvent('click');
  await page.locator('[data-card-tour-head]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-tour-reveal-replay]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(3600);
  save('c1-table', a, mark());
  // c2 「見返す」で試合のリプレイ
  await page.locator('[data-card-tour-tab="today"]').click();
  await page.locator('[data-card-tour-replay]').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  a = mark();
  await page.waitForTimeout(1500);
  await page.locator('[data-card-tour-replay]').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('[data-card-tour-replay]').first().click();
  await page.locator('[data-card-replay-bar]').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  const auto = page.locator('[data-card-replay-auto]');
  if (await auto.count()) await auto.first().click();
  await page.waitForTimeout(9500);
  save('c2-replay', a, mark());
});

(async () => {
  const playwright = require('playwright');
  const server = await serve();
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    if (!ONLY || ONLY === 'b') { console.log('(b) 個人杯を撮る'); await shootCup(browser); }
    if (!ONLY || ONLY === 'c') { console.log('(c) 公式杯を撮る'); await shootTour(browser); }
  } finally {
    await browser.close();
    server.close();
  }
  console.log(`撮れました: ${path.relative(ROOT, OUT)}`);
})().catch((e) => { console.error(`撮れませんでした: ${String(e && e.message || e).slice(0, 400)}`); process.exit(1); });

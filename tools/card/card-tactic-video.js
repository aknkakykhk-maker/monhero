// MFバトルカード 紹介動画 第3弾 (a) 戦術カードの場面を、実際のブラウザで撮る(2026-11-06 ソランド部長の割り振り・ビート部テンポ)。
//   node tools/card/card-tactic-video.js [出力フォルダ]   既定: docs/progress/card-intro-video-3/
//   縦 390×844・deviceScaleFactor 2(780×1688)・音なしの mp4。ffmpeg で書き出す
//
// 撮るもの
//   a-tactic-glow-finish.mp4 / a-tactic-glow-guard.mp4 … 登録デッキ(偽・戦術カード入り)との対戦。相手が戦術カードで動くと、上に「📜 ◯◯の戦術カード(…)」の帯(84 の tacGlow)が出て、
//                      その指示どおりにとどめ・守りが決まる所(帯が出た時刻の前後を切り出す)
//   a-tactic-smart.mp4 … デッキ登録の確かめの欄の「賢さ GRAND MASTER 相当」と「次の HELL まで」
//
// 決まり
//   ・公開済みの main の画面だけ。ゲーム本体は変えない(相手のデッキ・戦術カード・カードランクは、この道具の中で作る偽のデータ)
//   ・ほかのブリーダーの本名・デッキ名は出さない(相手は「ブリーダーA」、デッキ名は仮の名前)
//   ・本物の Supabase には行かない(この道具の中ですべて返す)。デバッグのボタン・合言葉の欄は、切り出したあとの動画には映らない
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(root, 'docs/progress/card-intro-video-3'));
const SHOTS = process.env.CARD_VIDEO_SHOTS || '';   // 途中の画面の写真を置くフォルダ(作り直すとき用)
const PORT = Number(process.env.CARD_PORT) || 8993;
const W = 390, H = 844, DSF = Number(process.env.CARD_VIDEO_DSF) || 2; // 細かさ(CARD_VIDEO_DSF=3 で 1170×2532)
const FOE = { name: 'ブリーダーA', deck: '仮のデッキ' };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''));
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});
// 録画: Playwright の recordVideo は 1倍(390×844)でしか絵を撮らない(780×1688 の枠の左上にしか入らなかった。2026-11-06 テンポ)。
//   そこで、ブラウザに画面のこまを deviceScaleFactor 2 の細かさ(780×1688)で送らせ(CDP の Page.startScreencast)、直近 KEEP_MS ぶんだけ手元に持つ。
//   こまは画面が変わったときだけ届くので、mp4 にするときは次のこままでの長さを付けて並べる
const KEEP_MS = 40000;
const recorder = async (context, page) => {
  const client = await context.newCDPSession(page);
  const frames = [];
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp * 1000, buf: Buffer.from(data, 'base64') });
    const old = Date.now() - KEEP_MS;
    while (frames.length > 2 && frames[1].t < old) frames.shift();
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
  return { frames, stop: () => client.send('Page.stopScreencast').catch(() => {}) };
};
// from〜to(ミリ秒の時刻)のこまを mp4 に(30fps・780×1688・音なし)
const mp4 = (rec, out, from, to) => {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'card-tactic-frames-'));
  try {
    const all = rec.frames;
    const startIdx = Math.max(0, all.findIndex((f) => f.t > from) - 1);
    const use = all.slice(startIdx).filter((f) => f.t <= to);
    if (!use.length) throw new Error(`${path.basename(out)}: こまが無い`);
    const lines = [];
    use.forEach((f, i) => {
      const name = path.join(dir, `${String(i).padStart(5, '0')}.jpg`);
      fs.writeFileSync(name, f.buf);
      const a = Math.max(f.t, from), b = i + 1 < use.length ? use[i + 1].t : to;
      lines.push(`file '${name}'`, `duration ${Math.max(0.001, (b - a) / 1000).toFixed(3)}`);
    });
    lines.push(`file '${path.join(dir, `${String(use.length - 1).padStart(5, '0')}.jpg`)}'`);
    fs.writeFileSync(path.join(dir, 'list.txt'), lines.join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'),
      '-vf', `scale=${W * DSF}:${H * DSF}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-crf', '18', '-preset', 'medium', '-an', out]);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
};

// ゲームを開いて HOME まで(はじめての窓は閉じる)。偽の登録デッキと、本物の Supabase へ行かない返事を仕込む
const boot = async (browser, opts = {}) => {
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  const state = { entry: null };
  await page.route(/supabase\.co/, (route) => {
    const url = route.request().url();
    const json = (v) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) });
    if (/\/rest\/v1\/card_deck_entries\?/.test(url) && !/owner_id=eq\./.test(url)) return json(state.entry ? [state.entry] : []);
    if (/\/rpc\/card_deck_register/.test(url)) return json('ok');
    const fn = (url.match(/rpc\/([a-z_]+)/) || [])[1] || '';
    return json(fn ? null : []);
  });
  await page.addInitScript((name) => {
    if (sessionStorage.getItem('__cardSeeded')) return;
    sessionStorage.setItem('__cardSeeded', '1');
    localStorage.setItem('mh_debug_unlocked_v1', '1'); // HOME に MFバトルカードの札を出すため(デバッグのボタンは撮らない)
    for (const [k, v] of Object.entries({ mh_breeder_name: name, mh_breeder_icon: '🐣', mh_onboarded: true, mh_tutorial_seen_v1: true, mh_battle_tutorial_seen_v1: true,
      mh_battle_tutorial_guide_shown_v1: true, mh_inherited_unique_level_compensation_v1: true, mh_inherited_unique_level_compensation_pending_v1: false })) localStorage.setItem(k, JSON.stringify(v));
  }, opts.name || 'ブリーダー');
  await page.addInitScript(eventStorySeed()); await page.addInitScript(require('../boot/quiet-boot-seed').updateNoticeSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').loginBonusDoneSeed()); await page.addInitScript(require('../boot/quiet-boot-seed').oneTimeNoticeSeed()); // みゅあの今日の助言などの一度きりの案内も済んだことにする // ログインボーナスの窓も同じく割りこむので受け取ったことにする // 更新履歴の告知の窓が後から割りこんで押せなくなるので、見たことにする(2026-11-11)
  await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
  const sleep = (ms) => page.waitForTimeout(ms);
  const dismiss = async () => { for (const x of await page.getByRole('button', { name: /^(受け取る|閉じる|(?:始|はじ)める|OK|スキップ|次へ|とじる|あとで|あとで読む|(?:分|わ)かった)$/ }).all()) { if (await x.isVisible().catch(() => false)) { await x.dispatchEvent('click').catch(() => {}); await sleep(300); } } };
  await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 90000 });
  const top = page.getByRole('button', { name: 'トップ画面へ進む' });
  const home = page.locator('[data-home-card-battle]');
  for (let i = 0; i < 120 && !(await home.isVisible().catch(() => false)); i++) { if (await top.isVisible().catch(() => false)) await top.click().catch(() => {}); await dismiss(); await sleep(500); }
  for (let i = 0; i < 4; i++) { await sleep(500); await dismiss(); }
  const rec = await recorder(context, page);
  return { context, page, state, errors, sleep, dismiss, rec };
};
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); } };


// スターター(一撃必殺パワフルチーム)を受け取り、練習試合を飛ばしてトップへ
const starter = async (page) => {
  if (!(await page.locator('[data-card-top="starter"]').count())) return;
  await page.locator('[data-card-kit="powerful"]').click();
  await page.getByRole('button', { name: /にする$/ }).click();
  await require(path.join(__dirname, 'lib/starter-open-pass.js'))(page);
  await page.locator('[data-card-quit]').waitFor({ timeout: 20000 });
  await page.locator('[data-card-quit]').click();
  await page.getByRole('button', { name: /^飛ばす$/ }).last().click();
  await page.locator('[data-card-top="result"]').waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /トップへ/ }).first().click();
  await page.locator('[data-card-top="top"]').waitFor({ timeout: 15000 });
};
// 偽の登録デッキ(ドラの MASTER のデッキ・戦術カード入り)。ゲームの中の関数で作る(ブラウザの中で動く)
//   基本カード: 仕留め型・守り型 / 3体それぞれ「倒せる相手 → 攻める」「受けるダメージ3以上 → 守る」
const fakeEntry = (foe) => {
  const db = CARD_BATTLE_DATA;
  const d = cardAiBuildDeck(db, 'dra', 'master', cardAiSeededRand('tactic-video'));
  const id = (g, v) => (CARD_TACTIC_CARDS.find((c) => c.g === g && (v === undefined || c.v === v)) || {}).id;
  const guardAct = (CARD_TACTIC_CARDS.find((c) => c.cat === 'monster' && c.phase === 'guard') || {}).id;
  const rows = [{ c: id('ko'), a: id('atk'), on: true }, { c: id('incoming', 3), a: guardAct, on: true }];
  const frames = cardTacticNormalizeFrames({ base: [id('tFinish'), id('tGuard'), null], breeder: [], mons: [rows, rows, rows] });
  const f = cardTacticPackFrames(frames);
  return { owner_id: 'tacticvideo01', user_name: foe.name, icon: '🛡️', profile_frame: null, deck: { monsters: d.monsters, cards: d.cards },
    tactics: { name: foe.deck, habit: 'dra', aces: [], f }, version: 1, active: true, battles: 3, deck_wins: 2, rents: 0, updated_at: new Date().toISOString() };
};

// デッキ登録の画面のための偽のデータ(ブラウザの中で動く): カードランク12(基本カードの2枚目が開く)・戦術カードを全部持つ・
//   基本2枚(仕留め型・守り型)と、ちゃんと効く戦術カード6枚 → 賢さ GRAND MASTER(HELL まであと3枚)
const seedSmart = () => {
  let xp = 0;
  for (let r = 1; r < 12; r++) xp += playerRankNeed(r);
  localStorage.setItem('mh_card_level_v1', JSON.stringify({ v: 1, xp, day: '', dayWin: false, got: Array.from({ length: 11 }, (_, i) => i + 2) }));
  const id = (g, v) => (CARD_TACTIC_CARDS.find((c) => c.g === g && (v === undefined || c.v === v)) || {}).id;
  const conds = CARD_TACTIC_CARDS.filter((c) => c.cat === 'cond' && c.g !== 'species' && !CARD_TACTIC_GUARD_ONLY_CONDS.includes(c.g));
  const acts = CARD_TACTIC_CARDS.filter((c) => c.cat === 'monster' && c.phase === 'attack');
  const frames = { base: [id('tFinish'), id('tGuard'), null], breeder: [], mons: [[], [], []] };
  let k = 0;
  for (const c of conds) {
    for (const a of acts) {
      if (cardTacticCountedRows(cardTacticNormalizeFrames(frames)) >= 6) break;
      const mi = k % 3;
      const next = { ...frames, mons: frames.mons.map((r, i) => (i === mi ? [...r, { c: c.id, a: a.id, on: true }] : r)) };
      if (next.mons[mi].length > 2) continue;
      if (cardTacticCountedRows(cardTacticNormalizeFrames(next)) > cardTacticCountedRows(cardTacticNormalizeFrames(frames))) { frames.mons = next.mons; k++; break; }
    }
  }
  const own = {};
  CARD_TACTIC_CARDS.forEach((c) => { own[c.id] = 1; });
  localStorage.setItem('mh_card_tactics_v1', JSON.stringify({ ...cardNormalizeTactics(null), own, frames }));
  localStorage.removeItem('mh_card_tactics_by_deck_v1');
  return `${cardTacticSmartLevel(cardTacticNormalizeFrames(frames))}(基本2・効く ${cardTacticCountedRows(cardTacticNormalizeFrames(frames))}枚)`;
};
// デッキ登録の画面だけを、ゲームの上に重ねて描く(デッキは偽の1組「わたしのデッキ」。habit … どの助手の MASTER のデッキの形か。既定はきき)
const mountRegister = (habit) => {
  const db = CARD_BATTLE_DATA;
  const A = { ...cardAiBuildDeck(db, habit || 'kiki', 'master', cardAiSeededRand('tactic-video-mine')), id: 'dMine', name: 'わたしのデッキ' };
  const col = {};
  [...A.monsters, ...A.cards].forEach((no) => { col[no] = 9; });
  document.getElementById('__reg')?.remove();
  const div = document.createElement('div');
  div.id = '__reg';
  div.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#0f172a;color:#fff';
  document.body.appendChild(div);
  window.__regRoot = ReactDOM.createRoot(div);
  window.__regRoot.render(React.createElement(CardDeckRegister, { db, decks: { v: 1, active: 'dMine', decks: [A] }, collection: col, onBack: () => {} }));
};

module.exports = { boot, shot, mp4, serve, starter, fakeEntry, seedSmart, mountRegister, FOE, W, H, DSF, OUT, root };
if (require.main === module) {
  (async () => {
    const playwright = require('playwright');
    fs.mkdirSync(OUT, { recursive: true });
    const server = await serve();
    const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    try {
      const A = await boot(browser);
      const { page, sleep, dismiss } = A;
      await page.locator('[data-home-card-battle]').click();
      await page.locator('[data-card-top]').first().waitFor({ timeout: 20000 });
      await sleep(800); await dismiss();
      await starter(page);
      A.state.entry = await page.evaluate(fakeEntry, FOE);
      await page.locator('[data-card-cpu]').click();
      await page.locator('[data-card-mode-assistant]').click();
      await sleep(1200); await dismiss();
      await page.locator('[data-card-foe-tab="breeder"]').click();
      await sleep(1500); await dismiss();
      await shot(page, '03-breeder');
      await page.locator('[data-card-share-fight="tacticvideo01"]').click();
      await page.locator('[data-card-deck-pick]').first().waitFor({ timeout: 15000 });
      await sleep(800); await dismiss();
      await shot(page, '04-deck-pick');
      await page.locator('[data-card-deck-pick-mode="auto"]').click();
      await sleep(400);
      await page.locator('[data-card-deck-pick-go]').click();
      // 帯(data-card-tactic-glow)が出るたびに、時刻と文を控える。とどめ(倒せる相手)と守り(守り方で守る)の最初の帯を、
      //   それぞれ帯の5秒前から12秒(帯 2.4秒 → 技・守りが決まって数字が出るまで)書き出す。帯が出てから7秒たったら書き出す(手元のこまは直近 KEEP_MS だけ)
      const want = [{ re: /倒せる/, name: 'a-tactic-glow-finish.mp4' }, { re: /守り方で守る/, name: 'a-tactic-glow-guard.mp4' }];
      const glows = [];
      const until = Date.now() + 240000;
      let seen = '';
      while (Date.now() < until && want.some((w) => !w.done)) {
        const g = await page.locator('[data-card-tactic-glow]').first().textContent({ timeout: 300 }).catch(() => null);
        if (g && g !== seen) { glows.push({ at: Date.now(), text: g }); seen = g; }
        if (!g) seen = '';
        for (const w of want) {
          const x = !w.done && glows.find((y) => w.re.test(y.text));
          if (x && Date.now() - x.at > 7500) { mp4(A.rec, path.join(OUT, w.name), x.at - 5000, x.at + 7000); w.done = true; console.log(`書き出し: ${w.name}(${x.text})`); }
        }
        await sleep(150);
      }
      want.filter((w) => !w.done).forEach((w) => console.log(`${w.name}: 帯が出なかったので撮れない`));
      await A.rec.stop();
      await A.context.close();
      if (A.errors.length) console.log(`実行時エラー: ${A.errors.slice(0, 3).join(' / ')}`);

      // ---- デッキ登録の確かめの欄(賢さ GRAND MASTER 相当・次の HELL まで) ----
      try {
        const B = await boot(browser);
        const smart = await B.page.evaluate(seedSmart);
        console.log(`賢さの仕込み: ${smart}`);
        await B.page.evaluate(mountRegister);
        const R = (sel) => B.page.locator(`#__reg ${sel}`);
        await R('[data-card-reg-deck]').first().waitFor({ timeout: 20000 });
        const t0 = Date.now();
        await B.sleep(900);
        await R('[data-card-reg-deck]').first().click();
        await B.sleep(700);
        await R('[data-card-reg-next]').click();
        await B.sleep(700);
        await R('[data-card-reg-style="custom"]').click();
        await B.sleep(500);
        await R('[data-card-reg-next]').click();
        await R('[data-card-reg-smart]').waitFor({ timeout: 10000 });
        await B.sleep(600);
        await R('[data-card-reg-smart]').scrollIntoViewIfNeeded();
        await R('[data-card-reg-smart]').evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
        await shot(B.page, '05-smart');
        const text = await R('[data-card-reg-smart]').innerText();
        console.log(text.replace(/\s+/g, ' '));
        await B.sleep(6500);
        const end2 = Date.now();
        await B.rec.stop();
        await B.context.close();
        mp4(B.rec, path.join(OUT, 'a-tactic-smart.mp4'), t0, end2);
        console.log(`書き出し: a-tactic-smart.mp4(${((end2 - t0) / 1000).toFixed(1)}秒)`);
        if (B.errors.length) console.log(`実行時エラー: ${B.errors.slice(0, 3).join(' / ')}`);
      } finally { /* こまは手元のメモリだけ */ }

    } finally { await browser.close(); server.close(); }
  })().catch((e) => { console.error(e.message || e); process.exit(1); });
}

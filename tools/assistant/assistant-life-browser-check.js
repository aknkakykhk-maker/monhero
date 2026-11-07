// 助手ライフ(助手たちの家・段階1 2026-11-07)の画面と HOME の施設の顔を、実際に開いて確かめる。公開の印 assistantLife はページの中でだけ立てる(本体の印は偽のまま)。
//   node tools/assistant/assistant-life-browser-check.js            検査
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る(公開後の確かめ)
//   node tools/assistant/assistant-life-browser-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/shots/life-*.png)
//   ① HOME の施設の横に、会った助手の顔が全部出る(帯は出ない)/ 施設「🏡 助手ライフ」を押すと家が開く / 縦 390・横 844×390 ではみ出さない
//   ⑩ 家: 8人の部屋・いる部屋は顔・出かけた部屋は行き先の札・部屋を押すとその助手のこと・場面・みんなの居場所(地図と一覧)・入場の演出
//   一覧(組・ひとり・誘う・引き合わせる・見守る・渡す)は家の「📋 居場所」の中。掛け合いは家を閉じずに場面で流れる
//   ⑫ 文字が切れない・名前の途中で折れない・地図の札が重ならない ⑬ 寝ている助手は寝言・起こされた反応
//   ⑪ 声をかける: その助手だけが {name} へ話す(ほかの助手の台本を流さない)・ひとりの助手の場面に、いない助手が出ない(2026-11-07 社長の指摘)
//   ② 見守る: 掛け合いが流れ、見守った数・にぎわい・友情Lv が増える / 同じ時間に同じ組は2度見守れない
//   ③ 誘う・引き合わせる: 次の時間の声かけとして残る
//   ④ 関係とアルバム: 名前は「友情Lv」「友だち」。今日のペアは出ない
//   ⑤ 帯は HOME だけ(モンヒロビートの画面へ行くと消える)。画面を閉じているあいだは様子を書き換えない
//   ⑥ 印が偽のときは帯も入口も出ない
//   ⑧ 2人にあげる道具: 道具の欄(持っている数・起きること)/「渡す」で5つが分かる確かめ → 渡すと2人のひとこと・持ち物が1つ減る・2回目は理由が出る/
//      はじめて手に入れたときの案内は HOME で1回だけ(止め絵 life-8-give・life-9-intro)
//   ⑨ 演出(44-growth-fx.jsx): 渡すと品物の演出/見守って友情Lv が上がると Lv アップの演出(トーストは重ねない)。止め絵 life-10・life-11
//   ⑭ カード部とのつなぎ口: カード部屋にいる助手を読むだけ・対戦の知らせで今日あったことに1件
//   ⑦ 段階3: 見守ると組の中の人だけが話す様子の台本が流れる(穴が残らない)/ひとりの助手の「ようすを見る」で、その人のひとりごとが流れる
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9231;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const { MIME, STORY_IDS, seed, toHome, finishTalk, homeFacesProblems, waitFaces } = require(path.resolve(__dirname, "life-browser-shared"));
// 家を開く(施設「🏡 助手ライフ」)→ 入場の演出が終わるのを待つ → 「📋 居場所」の一覧へ
const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {}); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 5000 }).catch(() => {}); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); };
const toWhere = async (page) => { await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(250); };
const reopen = async (page) => { if (!(await page.locator('[data-assistant-life-screen]').count())) await openHouse(page); await toWhere(page); };
// 場面の掛け合いを最後まで進めて、家へ戻る
const endScene = async (page) => { await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(250); };
const talkInfo = (page) => page.evaluate(() => { const el = document.querySelector('[data-assistant-peer-talk]'); if (!el) return null; return { id: el.getAttribute('data-assistant-peer-talk'), faces: [...el.querySelectorAll('[data-assistant-peer-face]')].map(x => x.getAttribute('data-assistant-peer-face')), line: (el.querySelector('[data-assistant-peer-line]') || {}).innerText || '' }; });
const ls = (page, k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, k);
// 掲示板に長い1行を入れ、ひとりの助手をさみしそうにする(ミハリ 残り①③: 「カード研/究」「ド/ラ」・「ソラシドがさみし…」)
const LONG_DIARY = '朝: あつ・ソラシド 図書室でカード研究 / ドラ・えるびん ひなたの丘で散歩 / ももすけ・きゅうこ おやつ屋さんでおやつ';
const seedBoard = (page) => page.evaluate((text) => {
  const st = ASSISTANT_LIFE_DIARY.state; ASSISTANT_LIFE_DIARY.state = { ...st, day: assistantLifeDayKey(), items: [...(st.items || []), { t: '07:30', text, ids: [], kind: 'slot' }] }; ASSISTANT_LIFE_DIARY.emit();
  const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, sorashido: { doing: 'idle', place: 'home', reason: 'lonely' } } } });
}, LONG_DIARY);
// 掲示板のまとまり(名前・場所・していること)が行をまたがない/今日やれることの小さい字が切れない
const boardProblems = (page) => page.evaluate(() => {
  const ng = [];
  for (const c of document.querySelectorAll('[data-assistant-life-board-item] [data-assistant-life-chunk]')) if (c.getClientRects().length > 1) ng.push(`掲示板の言葉が途中で折れる: ${c.textContent}`);
  if (!document.querySelector('[data-assistant-life-board-item] [data-assistant-life-chunk]')) ng.push('掲示板に言葉が無い(検査の前提)');
  for (const sm of document.querySelectorAll('[data-assistant-life-today] small')) if (sm.scrollWidth > sm.clientWidth + 1) ng.push(`今日やれることの字が切れる: ${sm.textContent}`);
  // 部屋の吹き出し(「💭 だれか来ないかな…」)が部屋の幅で切れない・まとまりの途中で折れない(2026-11-08 ミハリ: 横で「だれか来ない…」)
  for (const b of document.querySelectorAll('[data-assistant-life-room-bub]')) { if (b.scrollWidth > b.clientWidth + 1 || b.scrollHeight > b.clientHeight + 1) ng.push(`部屋の吹き出しが切れる: ${b.textContent}`); for (const c of b.querySelectorAll('[data-assistant-life-chunk]')) if (c.getClientRects().length > 1) ng.push(`吹き出しが途中で折れる: ${c.textContent}`); }
  if (!document.querySelector('[data-assistant-life-room-bub]')) ng.push('部屋の吹き出しが無い(検査の前提)');
  // 吹き出しは1行で収まり、名札に重ならない(字の幅が端末で1割ちがっても)
  for (const b of document.querySelectorAll('[data-assistant-life-room-bub]')) { const room = b.closest('.mhl-room'), pl = room && room.querySelector('.pl'); const r = b.getBoundingClientRect(); if (b.getClientRects().length && [...b.querySelectorAll('[data-assistant-life-chunk]')].some((c, i, a) => i && Math.abs(c.getBoundingClientRect().top - a[0].getBoundingClientRect().top) > 2)) ng.push(`部屋の吹き出しが2行になる: ${b.textContent}`); if (r.width * 1.1 > room.clientWidth * 0.88 + 1) ng.push(`部屋の吹き出しが字の幅しだいで切れる: ${b.textContent} ${Math.round(r.width)}/${Math.round(room.clientWidth)}`); if (pl) { const q = pl.getBoundingClientRect(); if (Math.min(r.right, q.right) - Math.max(r.left, q.left) > 1 && Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top) > 1) ng.push(`部屋の吹き出しが名札に重なる: ${b.textContent}`); } }
  // 屋根の札「🏡 助手の家」が家の枠に隠れない(縦で下半分が枠の下にあった)
  const hn = document.querySelector('[data-assistant-life-hname]'); if (hn) { const r = hn.getBoundingClientRect(); for (const y of [r.top + 3, r.bottom - 3]) { const e = document.elementFromPoint(r.left + r.width / 2, y); if (!e || !hn.contains(e)) ng.push('屋根の札「助手の家」が枠に隠れる'); } }
  const sub = document.querySelector('[data-assistant-life-today-sub]'); if (!sub || !/^💭 \S+/.test(sub.textContent)) ng.push(`声をかけるにさみしそうな助手の名前が無い: ${sub && sub.textContent}`);
  return ng;
});
const overflowX = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return r.left < -1 || r.right > window.innerWidth + 1; }, sel);

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
  const open = async ({ w, h, life = true, intro = false, bondAll = null }) => {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.addInitScript(quietBootSeed());
    await page.addInitScript(updateNoticeSeed());
    await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, life, intro, bondAll });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page);
    return { page, errors };
  };
  try {
    // 縦 390
    const { page, errors } = await open({ w: 390, h: 844 });
    // 流れてくる掛け合いが終わるのを待ってから顔を見る(掛け合いのあいだは出ない)
    await waitFaces(page);
    const faceIds = await page.locator('[data-assistant-life-home-face]').evaluateAll(els => els.map(e => e.getAttribute('data-assistant-life-home-face')));
    check('① HOME の施設の横に、会った助手8人の顔が全部出る(上限で切らない)', faceIds.length === 8 && new Set(faceIds).size === 8, faceIds.join(','));
    check('① 練習中の助手はモンヒロビート、カード研究の組は MFバトルカードの横', (await page.locator('[data-assistant-life-home-faces="rhythm"] [data-assistant-life-home-face="momosuke"]').count()) === 1 && (await page.locator('[data-assistant-life-home-faces="card"] [data-assistant-life-home-face]').count()) === 3);
    check('① 家と町にいる助手は施設「🏡 助手ライフ」の横(5人目からは2段)', (await page.locator('[data-assistant-life-home-faces="life"] [data-assistant-life-home-face]').count()) === 4);
    check('① 帯は出ない', (await page.locator('[data-assistant-life-band]').count()) === 0);
    { const ng = await homeFacesProblems(page); check('① 顔の列は、どの札でも札(名前)の下にあり、何にも重ならない(縦 390×844)', ng.length === 0, ng.join(' / ')); }
    check('① 顔ははみ出さない(縦 390)', await page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-home-faces]')].every(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; })));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-1-home-faces.png') });
    // 入場の演出(その日の最初は長い)・家
    await page.locator('[data-home-assistant-life]').click();
    await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 5000 });
    check('⑩ 入場の演出が出る(その日の最初は長い)', (await page.locator('[data-assistant-life-intro="long"]').count()) === 1);
    check('⑩ 入場を見た日を新しいキーに残す', /^\d{4}-\d{2}-\d{2}$/.test(String(await ls(page, 'mh_assistant_life_intro_v1'))));
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {});
    check('⑩ 家に8人の部屋が出る', (await page.locator('[data-assistant-life-room]').count()) === 8);
    check('⑩ 家にいる助手は部屋に顔(あつ・さみしそう)', (await page.locator('[data-assistant-life-room="atsu"] [data-assistant-life-room-face="atsu"]').count()) === 1);
    check('⑩ 出かけている助手の部屋には行き先の札(みゅあ → おやつ屋さん)', /おやつ屋さんへ/.test(await page.locator('[data-assistant-life-room-away="mua"]').innerText().catch(() => '')));
    check('⑩ 居間に「今日あったこと」の掲示板', (await page.locator('[data-assistant-life-board]').count()) === 1);
    check('⑩ 家ははみ出さない(縦 390)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-12-house.png') });
    await seedBoard(page); await page.waitForTimeout(250);
    { const ng = await boardProblems(page); check('⑫ 掲示板の言葉(名前・場所・していること)が途中で折れない・今日やれることの字が切れない・屋根の札が隠れない(縦)', ng.length === 0, ng.join(' / ')); }
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-16-board.png') });
    // カード部とのつなぎ口(読むだけ・2026-11-07 社長「カード部屋にいる助手と対戦すると 1.5倍」): カード部屋でカード研究の組の全員/図書室のカード研究は入れない/対戦の知らせで今日あったことに1件
    {
      const r = await page.evaluate(() => {
        const l = ASSISTANT_LIFE_STORE.state.life;
        const card = (l.groups || []).find(g => g.doing === 'cards' && g.place === 'cardroom');
        const ids = assistantLifeCardIds();
        const lib = ASSISTANT_LIFE_STORE.state.life;
        ASSISTANT_LIFE_STORE.set({ life: { ...lib, groups: (lib.groups || []).map(g => g === card ? { ...g, place: 'library' } : g) } });
        const libIds = assistantLifeCardIds();
        ASSISTANT_LIFE_STORE.set({ life: l });
        const n0 = ASSISTANT_LIFE_DIARY.state.items.length;
        assistantLifeOnCardMatch({ assistantId: card ? card.ids[0] : 'dra', won: true, at: Date.now() });
        return { want: card ? [...card.ids].sort().join(',') : null, got: [...ids].sort().join(','), libIds: libIds.length, atOne: card ? assistantLifeAtCard(card.ids[0]) : false, n0 };
      });
      await page.waitForTimeout(300);
      const last = await page.evaluate(() => (ASSISTANT_LIFE_DIARY.state.items.slice(-1)[0] || {}).text || '');
      check('⑭ カード部屋にいる助手(assistantLifeAtCard・assistantLifeCardIds): 組の全員・図書室のカード研究は入れない・対戦の知らせで今日あったことに1件', !!r.want && r.want === r.got && r.atOne && r.libIds === 0 && /カード部屋で対戦して勝った/.test(last), `${r.got} / 図書室 ${r.libIds} / ${last}`);
    }
    // ⑫ 文字(2026-11-07 社長「文字列も気をつけて」): 題が切れない・助手の名前の途中で折れない・掲示板は2行で読める
    const textOk = await page.evaluate(() => {
      const ng = [];
      const ti = document.querySelector('[data-assistant-life-title] .mhl-ti');
      if (!ti || ti.scrollWidth > ti.clientWidth + 1) ng.push('題が切れる');
      const clk = document.querySelector('[data-assistant-life-title]'); const tc = [...document.querySelectorAll('.mhl-hdr *')].find(e => /\d{1,2}:\d{2}/.test(e.textContent || '') && e.children.length === 0);
      if (clk && tc) { const a = clk.getBoundingClientRect(), b = tc.getBoundingClientRect(); if (a.right > b.left + 1 && a.top < b.bottom && b.top < a.bottom) ng.push('題と時刻の札が重なる'); }
      for (const n of document.querySelectorAll('[data-assistant-life-name]')) if (n.getClientRects().length > 1) ng.push(`名前の途中で折れる: ${n.textContent}`);
      const cut = (b) => { const tag = b.closest('.tag'), room = b.closest('.mhl-room'), cs = getComputedStyle(tag); const room92 = room.clientWidth * 0.92 - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth); return b.scrollWidth * 1.1 > room92; }; for (const b of document.querySelectorAll('[data-assistant-life-room-away] b')) { const own = b.textContent, mark = own.split(' ')[0]; for (const name of Object.keys(ASSISTANT_LIFE_PLACES).map(assistantLifePlaceShow)) { b.textContent = `${mark} ${name}へ`; if (cut(b)) ng.push(`札が切れる: ${b.textContent}`); } b.textContent = own; } for (const b of document.querySelectorAll('[data-assistant-life-room-away] small')) if (cut(b)) ng.push(`札が切れる: ${b.textContent}`);
      for (const p of document.querySelectorAll('[data-assistant-life-board-item]')) if (p.scrollHeight > p.clientHeight + 2) ng.push(`掲示板が切れる: ${p.textContent}`);
      // ミハリ L8・L10: 時間帯の言葉は HOME の札と同じ(朝・昼・夕・夜)。区切りの名前(午後・深夜)・略称「モンビー」を画面に出さない
      const scr = document.querySelector('[data-assistant-life-screen]'); const all = scr ? scr.innerText : '';
      const ck = document.querySelector('[data-assistant-life-clock]');
      if (!ck || !ck.textContent.startsWith(timeOfDayLabelAt())) ng.push(`見出しの時間帯が HOME とちがう: ${ck && ck.textContent}`);
      for (const w of ['午後', '深夜', 'モンビー']) if (all.includes(w)) ng.push(`画面に「${w}」`);
      return ng;
    });
    check('⑫ 家の文字が切れない・助手の名前の途中で折れない・時間帯の言葉が HOME と同じ・区切りの名前と略称を出さない(縦)', textOk.length === 0, textOk.slice(0, 3).join(' / '));
    await page.locator('[data-assistant-life-room="atsu"]').click(); await page.waitForTimeout(300);
    const sheetText = await page.locator('[data-assistant-life-room-sheet="atsu"]').innerText().catch(() => '');
    check('⑩ 部屋を押すと、その助手のこと(いまどこ・仲良し度・友情Lv・セッション・今日あったこと)', ['あつの部屋', '仲良し度', '友情Lv', 'セッション', '今日あったこと'].every(w => sheetText.includes(w)), sheetText.replace(/\s+/g, ' ').slice(0, 80));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-13-room.png') });
    // ⑪ 声をかける(2026-11-07 社長「声をかけにいったら俺とじゃなくて別の助手と喋ってる」): その助手だけが {name} に話す・場面にいない助手が出ない
    await page.locator('[data-assistant-life-room-sheet="atsu"] [data-assistant-life-room-act="invite"]').click().catch(() => {});
    await page.waitForTimeout(800);
    {
      const info = await talkInfo(page);
      const speakers = await page.evaluate(() => [...document.querySelectorAll('[data-assistant-peer-face]')].map(e => e.getAttribute('data-assistant-peer-face')));
      const stands = await page.locator('[data-assistant-life-scene] img.st').count();
      check('⑪ 声をかけると、選んだ助手だけがプレイヤーへ話す(ほかの助手の顔・台詞が出ない)', !!info && info.faces.every(id => id === 'atsu') && speakers.every(id => id === 'atsu') && /^life-breeder-atsu/.test(info.id), info ? `${info.id}・${info.faces.join(',')}` : 'なし');
      check('⑪ ひとりの助手の場面には、その助手の立ち絵だけ', stands === 1, `${stands}`);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-15-call.png') });
      await endScene(page);
    }
    await page.locator('[data-assistant-life-room-sheet] > button').first().click({ position: { x: 10, y: 10 } }).catch(() => {});
    // ⑬ 寝ている助手(2026-11-07 社長「寝てるのに話したら普通に会話した」): 声をかけると寝言か起こされた反応・場面は寝ている見せ方
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, kyuko: { doing: 'sleep', place: 'home', reason: 'mypace' } } } }); });
    await page.waitForTimeout(300);
    check('⑬ 寝ている部屋には「💤 おやすみ中」', /おやすみ中/.test(await page.locator('[data-assistant-life-room="kyuko"]').innerText().catch(() => '')));
    await page.locator('[data-assistant-life-room="kyuko"]').click().catch(() => {}); await page.waitForTimeout(300);
    {
      // ミハリ L1・L2・L12: 寝ている助手の部屋に、ふつうの「声をかける」・さみしそう・起きている気分を出さない
      const t = await page.locator('[data-assistant-life-room-sheet="kyuko"]').innerText().catch(() => '');
      const inv = await page.locator('[data-assistant-life-room-sheet="kyuko"] [data-assistant-life-room-act="invite"]').innerText().catch(() => '');
      const beat = await page.locator('[data-assistant-life-room-sheet="kyuko"] [data-assistant-life-room-act="beat"]').innerText().catch(() => null);
      check('⑬ 寝ている助手の部屋は「💤 ぐっすり寝ている」・「💤 そっと声をかける」(さみしそう・気分・ふつうの誘いを出さない)', /ぐっすり寝ている/.test(t) && /そっと声をかける/.test(inv) && !/さみしそう|気分:/.test(t) && (beat == null || /起こして/.test(beat)), `${inv} / ${beat}`);
    }
    await page.locator('[data-assistant-life-room-sheet="kyuko"] [data-assistant-life-room-act="invite"]').click().catch(() => {});
    await page.waitForTimeout(800);
    {
      const info = await talkInfo(page);
      check('⑬ 寝ている助手に声をかけると、寝言か起こされた反応(その助手だけ)', !!info && /^life-sleep-kyuko/.test(info.id) && info.faces.every(id => id === 'kyuko'), info ? `${info.id}・${info.line}` : 'なし');
      check('⑬ 寝ている助手の場面は、寝ている見せ方(暗い立ち絵と💤)', (await page.locator('[data-assistant-life-scene-stand="kyuko"][data-assistant-life-scene-sleep="1"]').count()) === 1);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-16-sleep.png') });
      await endScene(page);
    }
    await page.locator('[data-assistant-life-room-sheet] > button').first().click({ position: { x: 10, y: 10 } }).catch(() => {});
    {
      // ミハリ L13: 声をかけたあとの一言は、別の部屋を開いたら消える
      const before = await page.locator('[data-assistant-life-note]').count();
      await page.locator('[data-assistant-life-room="atsu"]').click().catch(() => {}); await page.waitForTimeout(300);
      const after = await page.locator('[data-assistant-life-note]').count();
      check('⑬ 声をかけたあとの一言は、別の部屋を開くと消える(前の一言が残らない)', before >= 1 && after === 0, `${before}→${after}`);
      await page.locator('[data-assistant-life-room-sheet] > button').first().click({ position: { x: 10, y: 10 } }).catch(() => {});
    }
    // 地図のふち(丘は上・家は左)にも顔が出るようにする(ミハリ L7①)
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; const gs = l.groups || []; const k = gs.findIndex(x => x.place !== 'cafe'); if (k >= 0) ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: gs.map((x, i) => i === k ? { ...x, doing: 'walk', place: 'hill' } : x) } }); });
    await toWhere(page);
    check('⑩ みんなの居場所に町の地図(場所に顔)', (await page.locator('[data-assistant-life-map] [data-assistant-life-map-place="cafe"] button').count()) === 2);
    const mapOk = await page.evaluate(() => {
      const map = document.querySelector('[data-assistant-life-map]'); if (!map) return ['地図が無い'];
      const m = map.getBoundingClientRect(); const ng = [];
      const labs = [...map.querySelectorAll('[data-assistant-life-map-place] > span:last-child')].map(e => ({ id: e.parentElement.getAttribute('data-assistant-life-map-place'), r: e.getBoundingClientRect() }));
      for (const a of labs) { if (a.r.left < m.left - 1 || a.r.right > m.right + 1 || a.r.top < m.top - 1 || a.r.bottom > m.bottom + 1) ng.push(`地図の外: ${a.id}`); }
      for (const f of map.querySelectorAll('[data-assistant-life-map-place] button')) { const r = f.getBoundingClientRect(); if (r.left < m.left - 1 || r.right > m.right + 1 || r.top < m.top - 1 || r.bottom > m.bottom + 1) ng.push(`顔が地図のふちで切れる: ${f.closest('[data-assistant-life-map-place]').getAttribute('data-assistant-life-map-place')}`); }
      if (document.documentElement.getAttribute('data-mh-tod') && !map.querySelector('[data-time-of-day-tint]')) ng.push('地図に時間帯の色が重なっていない(夜も昼の明るさ)');
      if (!map.querySelector('[data-assistant-life-map-place="hill"] button') || !map.querySelector('[data-assistant-life-map-place="home"] button')) ng.push('丘・家に顔が無い(検査の前提)');
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const a = labs[i].r, b = labs[j].r; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) ng.push(`札が重なる: ${labs[i].id}×${labs[j].id}`); }
      return ng;
    });
    check('⑫ 地図の場所の札と顔は地図の中で、札どうし重ならない(家とおやつ屋さん・丘と家のふちの顔も)・時間帯の色が重なる', mapOk.length === 0, mapOk.join(' / '));
    // 中庭に2人(顔の丸が練習スタジオの札にかかっていた。ミハリ 残り②)
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; const solo = { ...l.solo }; const ks = Object.keys(solo).filter(k => solo[k].place !== 'home').concat(Object.keys(solo).filter(k => solo[k].place === 'home')).slice(0, 2); const gs = l.groups || []; if (ks.length === 2) { for (const k of ks) delete solo[k]; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo, groups: [...gs, { ids: ks, doing: 'walk', place: 'garden' }] } }); } });
    await page.waitForTimeout(300);
    const faceOk = await page.evaluate(() => {
      const map = document.querySelector('[data-assistant-life-map]'); if (!map) return ['地図が無い'];
      const ng = []; const labs = [...map.querySelectorAll('[data-assistant-life-map-place] > span:last-child')].map(e => ({ id: e.parentElement.getAttribute('data-assistant-life-map-place'), r: e.getBoundingClientRect() }));
      if (!map.querySelector('[data-assistant-life-map-place="garden"] button')) ng.push('中庭に顔が無い(検査の前提)');
      for (const f of map.querySelectorAll('[data-assistant-life-map-place] > span:first-child')) { if (!f.querySelector('button')) continue; const r = f.getBoundingClientRect(), own = f.parentElement.getAttribute('data-assistant-life-map-place'); for (const b of labs) { if (b.id === own) continue; if (Math.min(r.right, b.r.right) - Math.max(r.left, b.r.left) > 1 && Math.min(r.bottom, b.r.bottom) - Math.max(r.top, b.r.top) > 1) ng.push(`顔が札に重なる: ${own}の顔×${b.id}`); } }
      for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) { const a = labs[i].r, b = labs[j].r; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) ng.push(`札が重なる: ${labs[i].id}×${labs[j].id}`); }
      return ng;
    });
    check('⑫ 地図で顔の丸がとなりの場所の札に重ならない(中庭に2人 → 練習スタジオの札)', faceOk.length === 0, faceOk.join(' / '));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-17-map-garden.png') });
    const groups = await page.locator('[data-assistant-life-group]').count();
    const solos = await page.locator('[data-assistant-life-solo]').count();
    check('① 画面が開き、組とひとりの助手が出る(8人ぶん)', groups + solos >= 3, `組 ${groups}・ひとり ${solos}`);
    check('① にぎわいは「にぎやか」(×1.5・上限45)', /にぎやか/.test(await page.locator('[data-assistant-life-tier]').innerText()) && /×1\.5/.test(await page.locator('[data-assistant-life-tier]').innerText()));
    check('① 画面ははみ出さない(縦 390)', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-2-where.png') });
    // ③ 誘う
    const inv = page.locator('[data-assistant-life-invite]:not([disabled])').first();
    if (await inv.count()) {
      const who = await inv.getAttribute('data-assistant-life-invite');
      await inv.click(); await page.waitForTimeout(300);
      const life = await ls(page, 'mh_assistant_life_v1');
      check('③ 誘うと、次の時間の声かけとして残る', life && life.nudges && life.nudges.invite.some(n => n.id === who && n.abs === life.abs + 1));
      // 声をかけに行く台本があれば場面で流れる → 最後まで進めて家へ戻る
      if (await page.locator('[data-assistant-life-scene]').count()) await endScene(page);
    } else check('③ 誘えるひとりの助手がいる', false);
    // 引き合わせる
    await page.locator('[data-assistant-life-pick="kyuko"]').click(); await page.locator('[data-assistant-life-pick="dra"]').click();
    await page.locator('[data-assistant-life-introduce-go]').click(); await page.waitForTimeout(300);
    const life2 = await ls(page, 'mh_assistant_life_v1');
    check('③ 引き合わせると、2人が次の時間の声かけとして残る', life2 && life2.nudges.introduce.some(n => n.pair === 'dra-kyuko' && n.abs === life2.abs + 1));
    // ② 見守る
    const bondBefore = await ls(page, 'mh_assistant_peer_bond_v1');
    const playBefore = await ls(page, 'mh_assistant_life_play_v1');
    const wbtn = page.locator('[data-assistant-life-watch]:not([disabled])').first();
    let watched = null;
    if (await wbtn.count()) {
      watched = await wbtn.getAttribute('data-assistant-life-watch');
      // 言い合いの台本が選ばれると友情Lv は上がらない(運で落ちないよう、選ぶあいだだけ乱数を固定する)
      await page.evaluate(() => { window.__mhRandom = Math.random; Math.random = () => 0.99; });
      await wbtn.click();
      await page.waitForTimeout(300);
      await page.evaluate(() => { if (window.__mhRandom) Math.random = window.__mhRandom; });
      await page.waitForTimeout(800);
      const talking = await page.locator('[data-assistant-peer-talk], [data-assistant-peer-line]').count();
      check('② 見守ると、家を閉じずに場面でその組の掛け合いが流れる', (await page.locator('[data-assistant-life-screen]').count()) === 1 && (await page.locator('[data-assistant-life-scene]').count()) === 1 && talking > 0, `${talking}`);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-3-watch.png') });
      const info = await talkInfo(page);
      check('⑦ 見守ると、その組の中の人だけが話す台本が流れる(穴が残らない)', info && info.faces.every(id => watched.split('+').includes(id)) && !/[{}]/.test(info.line), info ? `${info.id}・${info.faces.join(',')}` : 'なし');
      const playAfter = await ls(page, 'mh_assistant_life_play_v1');
      const bondAfter = await ls(page, 'mh_assistant_peer_bond_v1');
      const ids = watched.split('+');
      const up = ids.some((a, i) => ids.slice(i + 1).some(b => ((bondAfter || {})[[a, b].sort().join('-')] || 0) > ((bondBefore || {})[[a, b].sort().join('-')] || 0)));
      check('② 見守った数・にぎわいが増え、組の友情Lv の点が上がる', playAfter.counts.watch === 1 && playAfter.points > playBefore.points && up, JSON.stringify(playAfter.counts));
      // 掛け合いを最後まで進める
      for (let i = 0; i < 20; i++) { const n = await page.locator('[data-assistant-peer-talk], [data-assistant-peer-line]').count(); if (!n) break; await page.locator('[data-assistant-peer-talk], [data-assistant-peer-line]').first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(250); }
      await page.locator('[data-assistant-life-scene-back]').click({ timeout: 2000 }).catch(() => {});
      await reopen(page);
      check('② 同じ時間に同じ組は2度見守れない', await page.locator(`[data-assistant-life-watch="${watched}"]`).isDisabled().catch(() => false));
    } else check('② 見守れる組がある', false);
    // ⑦ ひとりの助手の様子を見る
    const peekBtn = page.locator('[data-assistant-life-peek]:not([disabled])').first();
    if (await peekBtn.count()) {
      const who = await peekBtn.getAttribute('data-assistant-life-peek');
      await peekBtn.click(); await page.waitForTimeout(800);
      const info = await talkInfo(page);
      check('⑦ ようすを見ると、その助手のひとりごとが流れる(顔はその助手だけ・穴が残らない)', info && (/^life-solo/.test(info.id) ? info.faces.join() === who : info.faces.includes(who)) && !/[{}]/.test(info.line), info ? `${info.id}・${info.faces.join(',')}・${info.line.slice(0, 30)}` : 'なし');
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-7-solo.png') });
      await endScene(page); await reopen(page);
      check('⑦ 同じ時間に同じ助手は1回だけ', await page.locator(`[data-assistant-life-peek="${who}"]`).isDisabled().catch(() => false));
    } else check('⑦ ようすを見られるひとりの助手がいる', false);
    // ⑧ 2人にあげる道具(家の「🎒 道具」)
    await page.locator('[data-assistant-life-icon="items"]').click().catch(() => {}); await page.waitForTimeout(250);
    const itemsText = await page.locator('[data-assistant-life-items]').innerText().catch(() => '');
    check('⑧ 道具の欄に、持っている数・起きること・手に入れる所が出る', /持っている 2個/.test(itemsText) && /友情Lv \+15/.test(itemsText) && /仲良し度 \+\d+/.test(itemsText) && /ビートP交換所/.test(itemsText), itemsText.replace(/\s+/g, ' ').slice(0, 80));
    await toWhere(page);
    const giveBtn = page.locator('[data-assistant-life-give]').first();
    if (await giveBtn.count()) {
      await giveBtn.click(); await page.waitForTimeout(300);
      const sheet = await page.locator('[data-assistant-life-give-sheet]').innerText().catch(() => '');
      check('⑧ 「渡す」で、何の道具か・起きること・使える数・手に入れる所・このあと が1枚で出る', ['何の道具', '起きること', '使える数', '手に入れる', 'このあと'].every(w => sheet.includes(w)) && /1日1回/.test(sheet));
      check('⑧ 確かめの1枚もはみ出さない(縦 390)', await page.evaluate(() => { const el = document.querySelector('[data-assistant-life-give-sheet] > div'); const r = el && el.getBoundingClientRect(); return !!r && r.left >= -1 && r.right <= window.innerWidth + 1 && r.top >= -1; }));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-8-give.png') });
      await page.locator('[data-assistant-life-give-go]').click(); await page.waitForTimeout(800);
      const owned = await ls(page, 'mh_owned_items');
      const info = await talkInfo(page);
      check('⑧ 渡すと、2人のひとことが流れて差し入れが1つ減る', owned && owned.peer_gift === 1 && !!info, info ? info.id : 'なし');
      // 品物を渡した演出(44-growth-fx.jsx)。演出は1つずつ出るので、前の札が出ていればその後に出る(数秒で閉じる)
      await page.locator('[data-growth-fx-sheet="item"]').waitFor({ timeout: 10000 }).catch(() => {});
      check('⑨ 渡すと、品物の演出(2人の友情Lv・仲良し度)が出る', (await page.locator('[data-growth-fx-sheet="item"]').count()) > 0);
      // 数字は数え上がるので、止まってから見る
      await page.waitForTimeout(1800);
      const fxText = await page.locator('[data-growth-fx-sheet="item"]').innerText().catch(() => '');
      check('⑨ 品物の演出の数字が、渡した量と合う(友情Lv +15・仲良し度 +30)', /\+15/.test(fxText) && /\+30/.test(fxText), fxText.replace(/\s+/g, ' ').slice(0, 90));
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-10-item-fx.png') });
      await endScene(page);
      for (let i = 0; i < 10 && (await page.locator('[data-growth-fx-sheet]').count()); i++) { await page.locator('[data-growth-fx-sheet]').first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(600); }
      await reopen(page);
      await page.locator('[data-assistant-life-give]').first().click(); await page.waitForTimeout(300);
      await page.locator('[data-assistant-life-give-kind="gift"]').click().catch(() => {});
      const reason = await page.locator('[data-assistant-life-give-reason]').innerText().catch(() => '');
      check('⑧ 同じ日に2回目は、理由が出て渡せない', /今日はもう使いました/.test(reason) && await page.locator('[data-assistant-life-give-go]').isDisabled());
      await page.locator('[data-assistant-life-give-cancel]').click();
    } else check('⑧ 渡せる組がある', false);
    // ④ 関係とアルバム
    await page.locator('[data-assistant-life-icon="friends"]').click(); await page.waitForTimeout(300);
    const mapText = await page.locator('[data-assistant-peer-map]').innerText().catch(() => '');
    check('④ 関係図の名前は「友情Lv」で、Lv3 は「友だち」・Lv4 は「いい友だち」', /友情Lv3/.test(mapText) && /友だち/.test(mapText) && /いい友だち/.test(mapText) && !/仲良し度 Lv/.test(mapText) && !/なかよし/.test(mapText));
    check('④ 今日のペアは出ない', (await page.locator('[data-assistant-peer-daily]').count()) === 0);
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-4-map.png') });
    await page.locator('[data-assistant-peer-row="kiki-mua"]').click(); await page.waitForTimeout(300);
    const album = await page.locator('[data-assistant-peer-album]').innerText().catch(() => '');
    check('④ アルバムも「友情Lv」・写真の題は「友だちの1枚」', /友情Lv5/.test(album) && /友だちの1枚/.test(album));
    await page.locator('[data-assistant-peer-album-close]').click().catch(() => {});
    await page.locator('[data-assistant-life-close]').click(); await page.waitForTimeout(300);
    // ⑤ 帯は HOME だけ・閉じているあいだは様子を書き換えない
    const lifeBefore = await page.evaluate(() => localStorage.getItem('mh_assistant_life_v1'));
    await page.getByRole('button', { name: /モンヒロビート/ }).first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const gs = await page.evaluate(() => document.querySelector('.mh-home-player') ? 'HOME' : 'other');
    check('⑤ HOME を離れると顔は出ない', gs === 'HOME' || (await page.locator('[data-assistant-life-home-face]').count()) === 0, gs);
    await page.waitForTimeout(2000);
    check('⑤ HOME の外にいるあいだは、様子を書き換えない', (await page.evaluate(() => localStorage.getItem('mh_assistant_life_v1'))) === lifeBefore);
    check('① 画面の出し入れでエラーが出ない', errors.length === 0, errors.slice(0, 2).join(' / '));
    await page.close();

    // 横 844×390
    const L = await open({ w: 844, h: 390 });
    await waitFaces(L.page);
    check('① 横 844×390 でも顔が全部出て、はみ出さない', (await L.page.locator('[data-assistant-life-home-face]').count()) === 8 && await L.page.evaluate(() => [...document.querySelectorAll('[data-assistant-life-home-faces]')].every(el => { const r = el.getBoundingClientRect(); return r.left >= -1 && r.right <= window.innerWidth + 1; })));
    check('① 横: 施設「🏡 助手ライフ」は右の列(画面の右半分・ほかの施設に重ならない)', await L.page.evaluate(() => { const el = document.querySelector('[data-home-assistant-life]'); if (!el) return false; const r = el.getBoundingClientRect(); const others = [...document.querySelectorAll('.mh-home-facility:not(.life),.mh-home-mission,.mh-home-gift')].map(x => x.getBoundingClientRect()); return r.left > window.innerWidth / 2 && r.width < 200 && others.every(o => o.right <= r.left || o.left >= r.right || o.bottom <= r.top || o.top >= r.bottom); }));
    { const ng = await homeFacesProblems(L.page); check('① 横でも顔の列は札の下にあり、何にも重ならない', ng.length === 0, ng.join(' / ')); }
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-5-home-faces-land.png') });
    // iPhone の Safari に近い高さ(縦 390×664)。本番で顔が札の横に逃げていた(2026-11-07)
    {
      const P = await open({ w: 390, h: 664 });
      await waitFaces(P.page); await finishTalk(P.page); await P.page.waitForTimeout(800);
      const ng = await homeFacesProblems(P.page);
      check('① 縦 390×664 でも顔の列は札の下にあり、何にも重ならない', (await P.page.locator('[data-assistant-life-home-face]').count()) === 8 && ng.length === 0, ng.join(' / '));
      if (SHOTS) await P.page.screenshot({ path: path.join(shotDir, 'life-1-home-faces-664.png') });
      await openHouse(P.page);
      const t = await P.page.evaluate(() => { const ti = document.querySelector('[data-assistant-life-title] .mhl-ti'); return ti && ti.scrollWidth <= ti.clientWidth + 1; });
      check('⑫ 縦 390×664 でも見出しの題が切れない', t === true);
      if (SHOTS) await P.page.screenshot({ path: path.join(shotDir, 'life-12-house-664.png') });
      await P.page.close();
    }
    await openHouse(L.page);
    check('① 横 844×390 でも画面がはみ出さない(家は左・右の列に今日やれること)', await L.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && (await L.page.locator('[data-assistant-life-screen][data-assistant-life-land="1"]').count()) === 1 && (await L.page.locator('[data-assistant-life-room]').count()) === 8);
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-6-house-land.png') });
    // 札の字は、端末の字体で幅が変わる(この検査のブラウザと既定のブラウザでかなの幅が1割ちがった)。字の幅に1割を足しても札に収まるかを見る。行き先はすべての場所の名前を入れて測る(2026-11-07 本番の横で「おやつ屋さ…」)
    const textL = await L.page.evaluate(() => { const ng = []; const ti = document.querySelector('[data-assistant-life-title] .mhl-ti'); if (!ti || ti.scrollWidth > ti.clientWidth + 1) ng.push('題が切れる'); const cut = (b) => { const tag = b.closest('.tag'), room = b.closest('.mhl-room'), cs = getComputedStyle(tag); const room92 = room.clientWidth * 0.92 - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth); return b.scrollWidth * 1.1 > room92; }; for (const b of document.querySelectorAll('[data-assistant-life-room-away] b')) { const own = b.textContent, mark = own.split(' ')[0]; for (const name of Object.keys(ASSISTANT_LIFE_PLACES).map(assistantLifePlaceShow)) { b.textContent = `${mark} ${name}へ`; if (cut(b)) ng.push(`札が切れる: ${b.textContent}`); } b.textContent = own; } for (const b of document.querySelectorAll('[data-assistant-life-room-away] small')) if (cut(b)) ng.push(`札が切れる: ${b.textContent}`); for (const n of document.querySelectorAll('[data-assistant-life-name]')) if (n.getClientRects().length > 1) ng.push(`名前の途中で折れる: ${n.textContent}`); for (const bt of document.querySelectorAll('[data-assistant-life-screen] button')) if (/モンビー/.test(bt.textContent)) ng.push(`ボタンが略称: ${bt.textContent}`); for (const bt of document.querySelectorAll('[data-assistant-life-screen] button b')) if (bt.scrollWidth > bt.clientWidth + 1) ng.push(`ボタンの字が切れる: ${bt.textContent}`); return ng; });
    await seedBoard(L.page); await L.page.waitForTimeout(250);
    { const ng = await boardProblems(L.page); check('⑫ 横でも掲示板の言葉が途中で折れない・今日やれることの字が切れない', ng.length === 0, ng.join(' / ')); }
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-16-board-land.png') });
    check('⑫ 横でも家の文字(題・部屋の札・ボタン)が切れない・名前の途中で折れない・ボタンは正式名称(モンヒロビート)', textL.length === 0, textL.join(' / '));
    await L.page.locator('[data-assistant-life-room="atsu"]').click().catch(() => {}); await L.page.waitForTimeout(300);
    check('⑩ 横: 部屋を押すと右にその助手のこと(はみ出さない)', await L.page.evaluate(() => { const el = document.querySelector('[data-assistant-life-room-sheet] .mhl-sheet'); const r = el && el.getBoundingClientRect(); return !!r && r.left > window.innerWidth / 2 - 1 && r.right <= window.innerWidth + 1; }));
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-14-room-land.png') });
    await L.page.close();

    // ⑨ 友情Lv が上がった演出: みんなの友情Lv を Lv3 の手前(118)にして見守る → 上がると画面いっぱいの祝い(トーストは出さない)
    {
      // 様子は端末ごとの種で決まるので、組ができていなければ開き直す(新しい端末として)
      let V = null, wb = null;
      for (let tries = 0; tries < 4; tries++) {
        V = await open({ w: 390, h: 844, bondAll: 118 });
        await waitFaces(V.page);
        await reopen(V.page);
        wb = V.page.locator('[data-assistant-life-watch]:not([disabled])').first();
        if (await wb.count()) break;
        if (tries < 3) await V.page.close(); // 最後の1枚は閉じない(閉じたページを触って落ちないように)
      }
      if (await wb.count()) {
        // 見守ったときに言い合いの台本が選ばれると友情Lv は上がらない(運で落ちないよう、選ぶあいだだけ乱数を高い値に固定する。2026-11-07 統括)
        await V.page.evaluate(() => { window.__mhRandom = Math.random; Math.random = () => 0.99; });
        await wb.click(); await V.page.waitForTimeout(500);
        await V.page.evaluate(() => { if (window.__mhRandom) Math.random = window.__mhRandom; });
        check('⑨ 見守った掛け合いは言い合いではない(友情Lv が上がる掛け合い)', (await V.page.locator('[data-assistant-peer-kind="quarrel"]').count()) === 0);
        await finishTalk(V.page);
        await V.page.locator('[data-growth-fx-sheet="level"]').waitFor({ timeout: 8000 }).catch(() => {});
        check('⑨ 見守って友情Lv が上がると、Lv アップの演出が出る', (await V.page.locator('[data-growth-fx-sheet="level"]').count()) > 0);
        check('⑨ 友情Lv のトーストは重ねて出さない', (await V.page.locator('[data-assistant-peer-toast="level"]').count()) === 0);
        if (SHOTS) await V.page.screenshot({ path: path.join(shotDir, 'life-11-level-fx.png') });
      } else check('⑨ 見守れる組がある', false);
      check('⑨ 演出のあいだもエラーが出ない', V.errors.length === 0, V.errors.slice(0, 2).join(' / '));
      await V.page.close();
    }
    // ⑧ はじめての案内
    const I = await open({ w: 390, h: 844, intro: true });
    // 掛け合いが流れているあいだは案内を出さない(重ねない)。流れていたら最後まで進めてから見る
    for (let i = 0; i < 40 && !(await I.page.locator('[data-assistant-life-item-intro]').count()); i++) { await finishTalk(I.page); await I.page.waitForTimeout(500); }
    check('⑧ 案内は掛け合いと重ならない', !((await I.page.locator('[data-assistant-life-item-intro]').count()) && (await I.page.locator('[data-assistant-peer-talk]').count())));
    check('⑧ はじめて道具を持っていると、HOME で案内が出る', (await I.page.locator('[data-assistant-life-item-intro]').count()) === 1);
    if (SHOTS) await I.page.screenshot({ path: path.join(shotDir, 'life-9-intro.png') });
    await I.page.locator('[data-assistant-life-item-intro-open]').click().catch(() => {});
    await I.page.waitForTimeout(400);
    check('⑧ 案内から「助手ライフ」が開き、案内は2度出ない', (await I.page.locator('[data-assistant-life-screen]').count()) === 1 && (await ls(I.page, 'mh_assistant_life_item_intro_v1')) === true);
    await I.page.close();

    // ⑥ 印が偽
    const F = await open({ w: 390, h: 844, life: false });
    await F.page.waitForTimeout(3000);
    check('⑥ 印が偽なら顔も施設「🏡 助手ライフ」も出ない', (await F.page.locator('[data-assistant-life-home-face]').count()) === 0 && (await F.page.locator('[data-home-assistant-life]').count()) === 0);
    check('⑥ 印が偽なら様子を保存しない', (await ls(F.page, 'mh_assistant_life_v1')) === null);
    await F.page.close();
  } finally {
    await browser.close(); server.close();
  }
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})();

// 助手ライフ(助手たちの家・段階1 2026-11-07)の画面と HOME の施設の顔を、実際に開いて確かめる。公開の印 assistantLife はページの中でだけ立てる(本体の印は偽のまま)。
//   node tools/assistant/assistant-life-browser-check.js            検査
//   node tools/assistant/assistant-life-browser-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/shots/life-*.png)
//   ① HOME の施設の横に、会った助手の顔が全部出る(帯は出ない)/ 施設「🏡 助手ライフ」を押すと家が開く / 縦 390・横 844×390 ではみ出さない
//   ⑩ 家: 8人の部屋・いる部屋は顔・出かけた部屋は行き先の札・部屋を押すとその助手のこと・場面・みんなの居場所(地図と一覧)・入場の演出
//   一覧(組・ひとり・誘う・引き合わせる・見守る・渡す)は家の「📋 居場所」の中。掛け合いは家を閉じずに場面で流れる
//   ② 見守る: 掛け合いが流れ、見守った数・にぎわい・友情Lv が増える / 同じ時間に同じ組は2度見守れない
//   ③ 誘う・引き合わせる: 次の時間の声かけとして残る
//   ④ 関係とアルバム: 名前は「友情Lv」「友だち」。今日のペアは出ない
//   ⑤ 帯は HOME だけ(モンヒロビートの画面へ行くと消える)。画面を閉じているあいだは様子を書き換えない
//   ⑥ 印が偽のときは帯も入口も出ない
//   ⑧ 2人にあげる道具: 道具の欄(持っている数・起きること)/「渡す」で5つが分かる確かめ → 渡すと2人のひとこと・持ち物が1つ減る・2回目は理由が出る/
//      はじめて手に入れたときの案内は HOME で1回だけ(止め絵 life-8-give・life-9-intro)
//   ⑨ 演出(44-growth-fx.jsx): 渡すと品物の演出/見守って友情Lv が上がると Lv アップの演出(トーストは重ねない)。止め絵 life-10・life-11
//   ⑦ 段階3: 見守ると組の中の人だけが話す様子の台本が流れる(穴が残らない)/ひとりの助手の「ようすを見る」で、その人のひとりごとが流れる
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = 9231;
const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/shots');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.woff2': 'font/woff2' };
const assistantsSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
const replaySrc = assistantsSrc.slice(assistantsSrc.indexOf('const EVENT_REPLAYS = ['));
const STORY_IDS = [...replaySrc.matchAll(/\{ id: '([a-z0-9_]+)'/g)].map(m => m[1]);
const seed = ({ storyIds, life, intro = false, bondAll = null }) => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  if (localStorage.getItem('mh_breeder_name') === null) {
    put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
    for (const k of ['mh_tutorial_seen_v1','mh_battle_tutorial_seen_v1','mh_battle_tutorial_guide_shown_v1','mh_rhythm_tutorial_seen_v1','mh_masu_migrated','mh_kiki_intro_seen_v1','mh_momosuke_intro_seen_v1','mh_tactics_intro_seen_v1','mh_rhythm_hell_story_seen_v1','mh_story_assistant_chat_seen_v1','mh_story_tactics_types_seen_v1','mh_story_card_battle_seen_v1','mh_inherited_unique_level_compensation_v1']) put(k, true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_assistant_selected_v1', 'mua'); put('mh_rhythm_event_story_v1', storyIds);
    const d = new Date(), pad = (n) => String(n).padStart(2, '0');
    put('mh_daily_masu_advice_date_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    put('mh_login_bonus_last_v1', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    // 友情Lv をいろいろに(Lv3 友だち・Lv4 いい友だち・Lv5 名コンビ…)
    put('mh_assistant_peer_bond_v1', { 'kiki-mua': 460, 'dra-momosuke': 260, 'atsu-sorashido': 130, 'erubin-kyuko': 130, 'kiki-kyuko': 60, 'dra-mua': 720 });
    // にぎわい「にぎやか」(朝4時区切りの今日)
    const day = new Date(Date.now() + 5 * 3600000).toISOString().slice(0, 10);
    put('mh_assistant_life_play_v1', { day, points: 70, counts: { rhythm: 40, card: 30 }, lastDay: null, streak: 1 });
    // 2人にあげる道具(差し入れ2・友情のしるし1)。はじめての案内は intro のときだけ出す
    let owned = {}; try { owned = JSON.parse(localStorage.getItem('mh_owned_items')) || {}; } catch {}
    put('mh_owned_items', { ...owned, peer_gift: 2, peer_token: 1 });
    if (!intro) put('mh_assistant_life_item_intro_v1', true);
  }
  // 公開の印はページの中だけで切り替える(本体は 2026-11-07 から真)。偽の確かめのときは偽に戻す
  { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLife = !!life; clearInterval(t); } } catch {} }, 2); }
  // いまの時間の様子を決めて入れておく(様子は時間帯と種で変わり、組やひとりの助手ができないことがあるため。印が偽の確かめでは入れない)
  if (life && localStorage.getItem('mh_check_life_seeded') === null) {
    localStorage.setItem('mh_check_life_seeded', '1');
    const t = Date.now() + 9 * 3600000, h = new Date(t).getUTCHours();
    const i = [0, 5, 10, 14, 18, 21].filter(x => h >= x).length - 1, ids = ['late', 'morning', 'noon', 'afternoon', 'evening', 'night'];
    const base = { salt: 'check', abs: Math.floor(t / 86400000) * 6 + i, slot: ids[i], recent: [], nudges: { invite: [], introduce: [] }, watched: [] };
    put('mh_assistant_life_v1', bondAll != null
      ? { ...base, moods: {}, solo: {}, groups: [{ ids: ['kiki', 'mua'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'momosuke'], doing: 'walk', place: 'plaza' }, { ids: ['atsu', 'kyuko'], doing: 'cards', place: 'library' }, { ids: ['erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }] }
      : { ...base, moods: { atsu: 'lonely', kyuko: 'happy', momosuke: 'lonely' },
        groups: [{ ids: ['kiki', 'mua'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'erubin', 'sorashido'], doing: 'cards', place: 'cardroom' }],
        solo: { atsu: { doing: 'idle', place: 'home', reason: 'lonely' }, kyuko: { doing: 'read', place: 'library', reason: 'mypace' }, momosuke: { doing: 'practice', place: 'studio', reason: 'lonely' } } });
  }
  if (bondAll != null && localStorage.getItem('mh_check_bond_all') === null) { localStorage.setItem('mh_check_bond_all', '1'); const b = {}; const ids = ['mua', 'kiki', 'momosuke', 'dra', 'atsu', 'kyuko', 'sorashido', 'erubin']; for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) b[[ids[i], ids[j]].sort().join('-')] = bondAll; put('mh_assistant_peer_bond_v1', b); }
};
const toHome = async (page) => {
  for (let i = 0; i < 60; i++) {
    if (await page.locator('.mh-home-player').count()) break;
    await page.getByRole('button', { name: /TAP TO START|トップ画面へ進む/ }).first().click({ timeout: 800 }).catch(() => {});
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 12; i++) { const c = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.offsetParent && /^(受け取る|閉じる|OK|わかった！?|とじる)$/.test((x.innerText || '').trim())); if (b) { b.click(); return true; } return false; }); if (!c) break; await page.waitForTimeout(400); }
};
const finishTalk = async (page) => { for (let i = 0; i < 24; i++) { const n = await page.locator('[data-assistant-peer-talk]').count(); if (!n) break; await page.locator('[data-assistant-peer-talk]').first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(250); } };
// 家を開く(施設「🏡 助手ライフ」)→ 入場の演出が終わるのを待つ → 「📋 居場所」の一覧へ
const openHouse = async (page) => { await page.locator('[data-home-assistant-life]').click({ timeout: 20000 }).catch(() => {}); await page.locator('[data-assistant-life-screen]').waitFor({ timeout: 5000 }).catch(() => {}); await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 4000 }).catch(() => {}); };
const toWhere = async (page) => { await page.locator('[data-assistant-life-icon="where"]').click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(250); };
const reopen = async (page) => { if (!(await page.locator('[data-assistant-life-screen]').count())) await openHouse(page); await toWhere(page); };
// 場面の掛け合いを最後まで進めて、家へ戻る
const endScene = async (page) => { await finishTalk(page); await page.locator('[data-assistant-life-scene-back]').click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(250); };
const waitFaces = async (page) => { for (let i = 0; i < 60 && !(await page.locator('[data-assistant-life-home-face]').count()); i++) { await finishTalk(page); await page.waitForTimeout(500); } };
const talkInfo = (page) => page.evaluate(() => { const el = document.querySelector('[data-assistant-peer-talk]'); if (!el) return null; return { id: el.getAttribute('data-assistant-peer-talk'), faces: [...el.querySelectorAll('[data-assistant-peer-face]')].map(x => x.getAttribute('data-assistant-peer-face')), line: (el.querySelector('[data-assistant-peer-line]') || {}).innerText || '' }; });
const ls = (page, k) => page.evaluate((key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }, k);
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
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
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
    await page.locator('[data-assistant-life-room="atsu"]').click(); await page.waitForTimeout(300);
    const sheetText = await page.locator('[data-assistant-life-room-sheet="atsu"]').innerText().catch(() => '');
    check('⑩ 部屋を押すと、その助手のこと(いまどこ・仲良し度・友情Lv・セッション・今日あったこと)', ['あつの部屋', '仲良し度', '友情Lv', 'セッション', '今日あったこと'].every(w => sheetText.includes(w)), sheetText.replace(/\s+/g, ' ').slice(0, 80));
    if (SHOTS) await page.screenshot({ path: path.join(shotDir, 'life-13-room.png') });
    await page.locator('[data-assistant-life-room-sheet="atsu"] > button').first().click({ position: { x: 10, y: 10 } }).catch(() => {});
    await toWhere(page);
    check('⑩ みんなの居場所に町の地図(場所に顔)', (await page.locator('[data-assistant-life-map] [data-assistant-life-map-place="cafe"] button').count()) === 2);
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
      await wbtn.click();
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
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-5-home-faces-land.png') });
    await openHouse(L.page);
    check('① 横 844×390 でも画面がはみ出さない(家は左・右の列に今日やれること)', await L.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1) && (await L.page.locator('[data-assistant-life-screen][data-assistant-life-land="1"]').count()) === 1 && (await L.page.locator('[data-assistant-life-room]').count()) === 8);
    if (SHOTS) await L.page.screenshot({ path: path.join(shotDir, 'life-6-house-land.png') });
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
        await wb.click(); await V.page.waitForTimeout(500);
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

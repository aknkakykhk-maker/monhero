// 助手ライフの作り直し(2026-11-11 社長・docs/progress/assistant-peer/LIFE-UX-V3-PLAN.md)の新UIを、実際に開いて確かめる
//   node tools/assistant/assistant-life-ux-check.js            検査
//   node tools/assistant/assistant-life-ux-check.js --shots    止め絵も撮る(docs/progress/assistant-peer/lifeux/step1/)
//   LIFE_BASE=https://aknkakykhk-maker.github.io/monhero/ で本番の版を見る
//   STEP1 部屋は「その助手とできること」1列(新UIだけ)
//   ① 新UIの部屋: 上の6つのボタン(dock)は出ず、「できること」の行が縦と横で同じ並び
//   ② 仲良し度の道のり: Lv が部屋の題の Lv と同じ・「あと◯」がその段階の幅の中
//   ③ その場所ならではの得がある行は先頭(カード部屋の助手=対戦・ビートで券なしの助手=ビート)
//   ④ 行は押せる大きさ(高さ44px以上)・横幅からはみ出さない
//   ⑤ 旧UI(設定で前の画面)は今までどおり: 縦は6つのボタン、「できること」の行は出ない
//   ⑥ ページのエラーが出ない
//   STEP2 ⑦ 家の上の「✨ いま行くと得なこと」(行・大きさ・goPlace)/⑧ 神殿の得は1日1回・保存は新しいキー・旧UIには出ない
const http = require('http'), path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '..', '..'), PORT = Number(process.env.LIFE_PORT) || 9265;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/lifeux/step1');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
// 顔ぶれ: みゅあ・きき=おやつ屋さん/ドラ・ソラシド・えるびん=カード部屋/ももすけ=ビート/あつ=家
const MIX = { groups: [{ ids: ['mua', 'kiki'], doing: 'snack', place: 'cafe' }, { ids: ['dra', 'sorashido', 'erubin'], doing: 'cards', place: 'cardroom' }],
  solo: { momosuke: { doing: 'practice', place: 'studio' }, atsu: { doing: 'idle', place: 'home' }, kyuko: { doing: 'read', place: 'library' } } };

(async () => {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { console.log('SKIP: playwright が入っていないので確かめられません'); process.exit(0); }
  const { quietBootSeed, updateNoticeSeed, oneTimeNoticeSeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));
  const { MIME, STORY_IDS, INTRO_KEYS, seed, toHome, waitFaces, finishTalk } = require(path.resolve(__dirname, 'life-browser-shared'));
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
  });
  await new Promise(r => server.listen(PORT, r));
  const BASE = process.env.LIFE_BASE ? process.env.LIFE_BASE.replace(/\/?$/, '/') : `http://localhost:${PORT}/`;
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const open = async (v, v2) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript((on) => { window.__mhSupabaseStubbed = true; localStorage.setItem('mh_assistant_life_ui_v2', on ? 'true' : 'false'); }, v2);
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds: STORY_IDS, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`${BASE}monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.evaluate((m) => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, groups: m.groups, solo: m.solo, watched: [] } }); }, MIX);
    await page.waitForTimeout(800); await finishTalk(page);
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };
  const room = async (page, id) => {
    await page.locator(`[data-assistant-life-room="${id}"]`).first().click({ timeout: 5000 }); await page.waitForTimeout(800);
    return page.evaluate(() => {
      const rows = [...document.querySelectorAll('[data-assistant-life-room-do]')];
      const road = document.querySelector('[data-assistant-life-bond-road]');
      const remain = document.querySelector('[data-assistant-life-bond-road-remain]');
      return { rows: rows.map(b => b.getAttribute('data-assistant-life-room-do')), small: rows.filter(b => b.getBoundingClientRect().height < 44).map(b => b.getAttribute('data-assistant-life-room-do')),
        over: rows.filter(b => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map(b => b.getAttribute('data-assistant-life-room-do')),
        dock: !!document.querySelector('[data-assistant-life-roomview-dock]'), road: road ? road.getAttribute('data-assistant-life-bond-road') : null, remain: remain ? Number(remain.getAttribute('data-assistant-life-bond-road-remain')) : null };
    });
  };
  const closeRoom = async (page) => { await page.locator('[data-assistant-life-roomview-close]').click().catch(() => {}); await page.waitForTimeout(400); };
  const order = {};
  for (const v of [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }]) {
    const T = `[${v.name}] `;
    const page = await open(v, true);
    // 仲良し度の段階の幅(Lv → 次の Lv までに要る点数)
    const span = await page.evaluate(() => Object.fromEntries(ASSISTANT_BOND_LEVELS.map((s, i, a) => [s.level, a[i + 1] ? a[i + 1].need - s.need : null])));
    // STEP2 ⑦ 家のいちばん上の「✨ いま行くと得なこと」: 札がある・カード部屋の助手と神殿の助手の行・押せる大きさ・横にはみ出さない
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, kyuko: { doing: 'idle', place: 'temple' } } } }); });
    await page.waitForTimeout(900);
    // 「得」の3行(56-assistant-life-guide.jsx)の1行目は、初めは1行+「ほか◯件 ▼」。開いて、残りの行(カード部屋・神殿)を確かめる
    const firstN = await page.locator('[data-assistant-life-now-perk]').count();
    await page.locator('[data-assistant-life-now-perks-more]').click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(300);
    { const pk = await page.evaluate(() => {
        const b = document.querySelector('[data-assistant-life-now-perks]'); if (!b) return null;
        const rs = [...b.querySelectorAll('[data-assistant-life-now-perk]')], art = document.querySelector('[data-assistant-life-house]');
        return { keys: rs.map(x => x.getAttribute('data-assistant-life-now-perk')), n: rs.length, small: rs.filter(x => x.getBoundingClientRect().height < 44).length,
          over: rs.filter(x => { const r = x.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).length, goReady: typeof ASSISTANT_LIFE_LINKS.goPlace === 'object' && !!ASSISTANT_LIFE_LINKS.goPlace && typeof ASSISTANT_LIFE_LINKS.goPlace.temple === 'function',
          above: !art || b.getBoundingClientRect().top <= art.getBoundingClientRect().top };
      });
      check(`${T}⑦ 家の上の「得」の1行目(初めは1行・ほか◯件を開くとカード部屋・神殿の行)`, !!pk && pk.keys.includes('card') && pk.keys.includes('temple') && firstN === 1, JSON.stringify({ ...pk, firstN }));
      check(`${T}⑦ 行は高さ44px以上・横にはみ出さない・家の絵より上`, !!pk && pk.small === 0 && pk.over === 0 && pk.above, JSON.stringify(pk));
      check(`${T}⑦ HOME が施設へ行く口(goPlace)を入れている`, !!pk && pk.goReady === true);
      if (SHOTS) await page.screenshot({ path: path.join(shotDir, `check-${v.id}-house.png`) });
    }
    for (const id of ['mua', 'dra', 'momosuke', 'atsu']) {
      const r = await room(page, id);
      (order[id] = order[id] || {})[v.id] = r.rows.join(',');
      check(`${T}① ${id}: 新UIの部屋は「できること」の行(${r.rows.length}行)・上の6つのボタンは出ない`, r.rows.length >= 5 && !r.dock, JSON.stringify(r.rows));
      check(`${T}④ ${id}: 行は高さ44px以上・横にはみ出さない`, r.small.length === 0 && r.over.length === 0, JSON.stringify({ small: r.small, over: r.over }));
      { const lvTitle = await page.evaluate(() => { const m = /仲良し度 Lv(\d+)/.exec(document.querySelector('[data-assistant-life-room-sheet]').innerText || ''); return m ? m[1] : null; });
        const w = span[Number(r.road)];
        check(`${T}② ${id}: 仲良し度の道のり Lv${r.road}・あと${r.remain}(部屋の題の Lv と同じ・その段階の幅の中)`, r.road != null && r.road === lvTitle && (w == null ? r.remain == null : (r.remain > 0 && r.remain <= w)), JSON.stringify({ road: r.road, lvTitle, remain: r.remain, span: w })); }
      // 助手マスモン対戦β(ミセカタ2の口)の行: 口が null を返すあいだは出ない。口が値を返せば「🐾 マスモン」の下に出る(2026-11-11)
      if (id === 'mua') {
        // 公開(印が真)のあとは、はじめから行が出る。口が null を返すとき(印が偽)だけ出ない(2026-11-11 公開でミセカタ2が直した)
        const bbOpenNow = await page.evaluate(() => typeof assistantMasmonBattleRowInfo === 'function' && assistantMasmonBattleRowInfo('mua') != null);
        check(`${T}⑧ mua: 「マスモンで対戦(β)」の行は、口が値を返すときだけ出る(null なら出ない)`, bbOpenNow === r.rows.includes('masmon-battle'), `${bbOpenNow} / ${r.rows.join(',')}`);
        await closeRoom(page);
        await page.evaluate(() => { window.__bbFlags = { b: RELEASE_FLAGS.assistantMasmonBattleBeta, g: RELEASE_FLAGS.assistantMasmonGrow }; RELEASE_FLAGS.assistantMasmonBattleBeta = true; RELEASE_FLAGS.assistantMasmonGrow = true; });
        const r2 = await room(page, id);
        const at = r2.rows.indexOf('masmon-battle');
        check(`${T}⑧ mua: 対戦βの印が真だと「🐾 マスモン」のすぐ下に行が出る`, at > 0 && r2.rows[at - 1] === 'masmon', r2.rows.join(','));
        check(`${T}⑧ mua: 対戦βの行も高さ44px以上・横にはみ出さない`, !r2.small.includes('masmon-battle') && !r2.over.includes('masmon-battle'), JSON.stringify({ small: r2.small, over: r2.over }));
        await closeRoom(page);
        await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonBattleBeta = window.__bbFlags.b; RELEASE_FLAGS.assistantMasmonGrow = window.__bbFlags.g; });
      }
      if (id === 'dra') check(`${T}③ カード部屋のドラは「対戦する」が先頭`, r.rows[0] === 'card', r.rows[0]);
      if (id === 'momosuke') check(`${T}③ ビートのももすけは「ビート」が先頭(券なし)`, r.rows[0] === 'beat', r.rows[0]);
      if (SHOTS && (id === 'dra' || id === 'mua')) await page.screenshot({ path: path.join(shotDir, `check-${v.id}-${id}.png`) });
      await closeRoom(page);
    }
    await page.close();
    // ⑤ 旧UI(設定で前の画面)は今までどおり
    const old = await open(v, false);
    const r = await room(old, 'mua');
    check(`${T}⑤ 旧UI(設定で前の画面)は今までどおり: できることの行は出ない${v.id === 'tate' ? '・縦は6つのボタン' : ''}`, r.rows.length === 0 && r.road === null && (v.id === 'yoko' || r.dock), JSON.stringify(r));
    await old.close();
  }
  // ⑧ 神殿の得: 神殿にいる助手との仲良し度が1日1回だけ上がる・押すと神殿へ行く(画面が閉じる)・旧UIには帯が出ない
  { const v = { id: 'tate', name: '縦 390×844', w: 390, h: 844 };
    const page = await open(v, true);
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, kyuko: { doing: 'idle', place: 'temple' } } } }); });
    await page.waitForTimeout(900);
    const t = await page.evaluate(async () => {
      const before = assistantLifeBondPointsOf('kyuko');
      const a = await assistantLifeTemplePerk(), mid = assistantLifeBondPointsOf('kyuko'), b = await assistantLifeTemplePerk(), after = assistantLifeBondPointsOf('kyuko');
      return { a, b, up: mid - before, again: after - mid, saved: localStorage.getItem('mh_assistant_life_perks_v1') || '' };
    });
    // 神殿の得は旧UIの人にも入る(社長 2026-11-11「全員に入れる」)
    const oldT = await (async () => { const o = await open(v, false); await o.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, kyuko: { doing: 'idle', place: 'temple' } } } }); });
      const r = await o.evaluate(async () => ({ a: await assistantLifeTemplePerk(), saved: localStorage.getItem('mh_assistant_life_perks_v1') })); await o.close(); return r; })();
    check('⑧ 旧UIの人にも神殿で仲良し度が上がり、新しいキーが書かれる(全員に入れる)', oldT.a === 'kyuko' && /kyuko/.test(oldT.saved || ''), JSON.stringify(oldT));
    // ⑨ マーケットの得: 助手が market にいれば、帯に「🛍」の行が出る(開発部の assistantMarketPerkToday が値を返すとき)
    await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, atsu: { doing: 'idle', place: 'market' } } } }); });
    await page.waitForTimeout(5200);
    const mk = await page.evaluate(() => ({ who: assistantLifeMarketWho(), perk: ASSISTANT_LIFE_LINKS.marketPerkToday ? ASSISTANT_LIFE_LINKS.marketPerkToday() : 'なし', row: !!document.querySelector('[data-assistant-life-now-perk="market"]'), more: !!document.querySelector('[data-assistant-life-now-perks-more]'), keys: [...document.querySelectorAll('[data-assistant-life-now-perk]')].map(x => x.getAttribute('data-assistant-life-now-perk')) }));
    check('⑨ 助手がマーケットにいるとき assistantLifeMarketWho が助手を返す', mk.who === 'atsu', JSON.stringify(mk));
    check('⑨ 場所の判定 assistantLifePerkAt が帯と同じ(神殿は受け取り済みなので無し・マーケットは助手がいてできるときだけ)', await page.evaluate(() => assistantLifePerkAt('temple') === false && assistantLifePerkAt('ranch') === false && assistantLifePerkAt('market') === !!(ASSISTANT_LIFE_LINKS.marketPerkToday && (p => p && !p.used)(ASSISTANT_LIFE_LINKS.marketPerkToday()))));
    check('⑨ マーケットのおすすめが出せるとき、帯に🛍の行(3行を超えるときは「ほか」の中)', !mk.perk || mk.perk === 'なし' || mk.perk.used || mk.row || mk.more, JSON.stringify(mk));
    check('⑧ 神殿にいる助手との仲良し度が上がる(1回目)・2回目は上がらない(1日1回)', t.a === 'kyuko' && t.up > 0 && t.b === null && t.again === 0, JSON.stringify(t));
    check('⑧ 「神殿でその日もう受け取ったか」は新しいキー mh_assistant_life_perks_v1 に保存', /kyuko/.test(t.saved), t.saved);
    const gone = await page.evaluate(() => { const l = ASSISTANT_LIFE_STORE.state.life; return !!l; });
    check('⑧ (準備)助手ライフの状態がある', gone);
    await page.close();
    const old = await open(v, false);
    check('⑧ 旧UIには「いま行くと得なこと」を足さない', (await old.locator('[data-assistant-life-now-perks]').count()) === 0);
    await old.close();
  }
  // ⑪ M/B管理の得の見せ方: 助手が ranch にいてトレーニングチケットを使うと「次の修行が1.2倍(今日はこれで終わり)」・その日2回目は「受け取り済み」・M/B管理の画面に帯
  for (const v of [{ id: 'tate', name: '縦 390×844', w: 390, h: 844 }, { id: 'yoko', name: '横 844×390', w: 844, h: 390 }]) {
    const page = await open(v, true);
    const r = await page.evaluate(async () => {
      const had = RELEASE_FLAGS.assistantMasmonGrow; RELEASE_FLAGS.assistantMasmonGrow = true;
      try {
        await AMG_STORE.load();
        const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, atsu: { doing: 'idle', place: 'ranch' } } } });
        const ids = assistantLifeAtPlace(assistantLifeCurrent(), ['atsu'], 'ranch');
        const before = assistantLifePerkAt('ranch');
        const a = assistantLifeRanchPerk(), b = assistantLifeRanchPerk();
        const after = assistantLifePerkAt('ranch');
        return { ids, before, a, b, after };
      } finally { RELEASE_FLAGS.assistantMasmonGrow = had; }
    });
    // M/B管理の画面に帯が出る(止め絵も撮る)
    await page.evaluate(() => { RELEASE_FLAGS.assistantMasmonGrow = true; const l = ASSISTANT_LIFE_STORE.state.life; ASSISTANT_LIFE_STORE.set({ life: { ...l, solo: { ...l.solo, atsu: { doing: 'idle', place: 'ranch' } } } }); });
    await page.locator('[data-assistant-life-close]').first().click().catch(() => {});
    await page.waitForTimeout(700);
    await page.locator('main.mh-home-scene .mh-home-facility.management').first().click({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const band = await page.evaluate(() => { const b = document.querySelector('[data-assistant-life-ranch-band]'); if (!b) return null; const r = b.getBoundingClientRect(); return { state: b.getAttribute('data-assistant-life-ranch-band'), text: b.innerText.replace(/\s+/g, ' '), over: r.right > innerWidth + 1 || r.left < -1 }; });
    check(`${v.name} ⑪ M/B管理の画面に帯(トレーニングすると〜が1.2倍・1日1回/受け取り済み)が出る・はみ出さない`, !!band && !band.over && /1\.2倍/.test(band.text), JSON.stringify(band));
    if (SHOTS) {
      await page.screenshot({ path: path.join(shotDir, `check-${v.id}-ranch-done.png`) });
      await page.evaluate(() => { AMG_STORE.state = { ...AMG_STORE.state, boost: {} }; }); await page.waitForTimeout(3600); // 受け取る前の形も撮る(止め絵用)
      await page.screenshot({ path: path.join(shotDir, `check-${v.id}-ranch.png`) });
    }
    check('⑪ M/B管理の得: 受け取れたとき「次の修行が1.2倍(今日はこれで終わり)」・2回目は「受け取り済み」・済んだら帯の行は消える', r.ids.length === 1 && r.before === true && /次の修行が1\.2倍になりました\(今日はこれで終わり\)/.test(r.a) && /受け取り済み/.test(r.b) && r.after === false, JSON.stringify(r));
    await page.close();
  }
  for (const id of Object.keys(order)) check(`① ${id}: 縦と横で同じ並び`, order[id].tate === order[id].yoko, JSON.stringify(order[id]));
  check('⑥ ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `\n${failed} 件 NG` : '\nすべて OK');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

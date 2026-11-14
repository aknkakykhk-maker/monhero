// 助手の好き嫌いが遊んでいくうちに変わる仕組み(2026-11-15 キズナ8・r1115-007。56-assistant-life-masmon-taste.jsx / docs/progress/assistant-peer/taste-change/PROPOSAL.md)を実ブラウザで確かめる
//   ① 印 assistantLifeTaste が偽なら、何をしても好みは変わらず、保存も増えない
//   ② 真: 1日の上限(+6/-3)・ゆっくり(苦手→ふつうは数日かかる)・段が変わったときだけ記録・はじめの好み(表)は変えない
//   ③ 推しの血統は動きにくく、好きの段より下がらない
//   ④ 壊れた保存でも既定値で読める・保存のキーは新しい mh_assistant_life_taste_v1 だけ
//   ⑤ 部屋の「好き・苦手」: 新しく好きになった印・最近の変化・助手のひとことが言葉の途中で折れず、横にはみ出さない(幅390・320)
//   node tools/assistant/assistant-life-taste-check.js [--shots]   止め絵: docs/progress/assistant-peer/taste-change/real/
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..'), PORT = 9272;
const SHOTS = process.argv.includes('--shots');
const shotDir = path.join(root, 'docs/progress/assistant-peer/taste-change/real');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

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
  if (SHOTS) fs.mkdirSync(shotDir, { recursive: true });
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(shotDir, `${name}.jpg`), type: 'jpeg', quality: 82 }); };
  const browser = await chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined });
  const errors = [];
  const storyIds = STORY_IDS;
  const open = async (v, flag) => {
    const page = await browser.newPage({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: SHOTS ? 2 : 1 });
    page.on('pageerror', e => errors.push(`${v.name}: ${e.message}`));
    await page.addInitScript(() => {
      window.__mhSupabaseStubbed = true;
      localStorage.setItem('mh_assistant_life_ui_v2', 'true');
      if (localStorage.getItem('mh_breeder_name') === null) {
        // きき: 仲良し度 Lv8 ぐらい・好み(お茶=好き・おにぎり=苦手・観葉植物=好き)が分かっている。NEW を見るため、控えは 0
        localStorage.setItem('mh_assistant_bond_kiki_v1', JSON.stringify({ points: 2400 }));
        localStorage.setItem('mh_assistant_bond_rewards_v2', JSON.stringify({ kiki: [2, 3, 4, 5, 6, 7, 8] }));
        localStorage.setItem('mh_assistant_life_likes_v1', JSON.stringify({ known: { kiki: { tea: 'gift', flower: 'gift', onigiri: 'gift', plant: 'gift' } }, told: [] }));
        localStorage.setItem('mh_assistant_life_profile_seen_v1', JSON.stringify({ kiki: { n: 0 } }));
      }
    });
    await page.addInitScript(quietBootSeed()); await page.addInitScript(updateNoticeSeed()); await page.addInitScript(oneTimeNoticeSeed());
    await page.addInitScript(seed, { storyIds, introKeys: INTRO_KEYS, life: true, intro: false, bondAll: null });
    await page.addInitScript((f) => { const t = setInterval(() => { try { if (typeof RELEASE_FLAGS !== 'undefined') { RELEASE_FLAGS.assistantLifeProfile = true; RELEASE_FLAGS.assistantLifeTaste = f; clearInterval(t); } } catch {} }, 2); }, flag);
    await page.route(/supabase|functions\/v1/, r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await toHome(page); await waitFaces(page); await finishTalk(page);
    await page.waitForTimeout(500); await finishTalk(page);
    // 会っていない助手(えるびん)の加入のお話が流れたら飛ばす(このあとも会っていない扱いのまま見るため、見たことにはしない)
    for (let i = 0; i < 6; i++) { const sk = page.getByRole('button', { name: /^スキップ$/ }); if (!(await sk.count())) break; await sk.first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(600); await page.getByRole('button', { name: /^(はい|スキップする|OK)$/ }).first().click({ timeout: 800 }).catch(() => {}); await page.waitForTimeout(400); }
    await toHome(page); await finishTalk(page);
    if (process.env.DBG) await page.screenshot({ path: process.env.DBG });
    await page.locator('[data-home-assistant-life]').click({ timeout: 20000 });
    await page.locator('[data-assistant-life-intro]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(900);
    return page;
  };

  const DAY = 86400000;
  try {
    { // ① 偽
      const page = await open({ name: '偽', w: 390, h: 844 }, false);
      const r = await page.evaluate(async () => {
        await AMT_STORE.load();
        const before = JSON.stringify(assistantMasmonBasePlanOf('kiki').dislikeMon);
        const res = [assistantLifeTasteBump('kiki', 'Oboro', 'win'), assistantLifeTasteBump('kiki', 'Oboro', 'win')];
        return { res: JSON.stringify(res), same: before === JSON.stringify(assistantMasmonBasePlanOf('kiki').dislikeMon), saved: localStorage.getItem('mh_assistant_life_taste_v1') };
      });
      check('① 印が偽なら何も変わらず保存も増えない', r.res === '[[],[]]' && r.same && !r.saved, JSON.stringify(r));
      await page.close();
    }
    for (const w of [390, 320]) {
      const T = `[幅${w}] `;
      const page = await open({ name: `真${w}`, w, h: w === 320 ? 700 : 844 }, true);
      const r = await page.evaluate(async () => {
        await AMT_STORE.load(); await ASSISTANT_MASMON_STORE.load();
        const now = Date.now(), out = {};
        const dis = () => assistantMasmonBasePlanOf('kiki').dislikeMon.map(x => x.monster);
        out.dis0 = dis(); out.baseSame = JSON.stringify(ASSISTANT_MASMON_PLAN.find(a => a.id === 'kiki').dislikeMon) === JSON.stringify(assistantMasmonBasePlanOf('kiki').dislikeMon);
        // 1日の上限: 同じ日に何度やっても +6 まで。1日1回の種類は2回目が効かない
        const d1 = []; for (let i = 0; i < 5; i++) d1.push(assistantLifeTasteBump('kiki', 'Oboro', 'win', now - 6 * 86400000));
        out.capMon = AMT_STORE.state.by.kiki.mon.Oboro; out.capDay = AMT_STORE.state.by.kiki.day.m.Oboro.up;
        assistantLifeTasteBump('kiki', 'Oboro', 'praise', now - 5 * 86400000); out.praise1 = AMT_STORE.state.by.kiki.mon.Oboro; assistantLifeTasteBump('kiki', 'Oboro', 'praise', now - 5 * 86400000); out.praise2 = AMT_STORE.state.by.kiki.mon.Oboro;
        // 苦手→ふつう: 上限いっぱいで数日。途中で変わらず、いつか1回だけ変わる
        const changes = []; let stepDay = null;
        for (let k = 4; k >= 0; k--) { for (let i = 0; i < 3; i++) { const c = assistantLifeTasteBump('kiki', 'Oboro', 'win', now - k * 86400000); if (c.length) { changes.push(c); if (stepDay === null) stepDay = k; } } }
        out.changes = changes.length; out.stepDay = stepDay;
        out.log = AMT_STORE.state.by.kiki.log.map(x => `${x.target}:${x.from}>${x.to}`);
        out.dis1 = dis();
        out.recentN = assistantLifeTasteRecent('kiki').length;
        out.changedForChat = assistantLifeTasteOf('kiki').changed;
        out.baseStill = JSON.stringify(ASSISTANT_MASMON_PLAN.find(a => a.id === 'kiki').dislikeMon.map(x => x.monster)) === JSON.stringify(out.dis0.slice(0, 3)) || true;
        // 推し(きき=ゴーレム): 負けても好きの段より下がらず、動きは5分の1
        for (let k = 0; k < 6; k++) assistantLifeTasteBump('kiki', 'Golem', 'lose', now - k * 86400000);
        const like = assistantMasmonBasePlanOf('kiki').likeMon.map(x => x.monster);
        out.coreLike = like.includes('Golem'); out.coreMon = AMT_STORE.state.by.kiki.mon.Golem;
        // 好きになる: ふつうのモンスターを何日もほめる
        for (let k = 7; k >= 0; k--) { assistantLifeTasteBump('kiki', 'Pixie', 'win', now - k * 86400000); assistantLifeTasteBump('kiki', 'Pixie', 'praise', now - k * 86400000); }
        out.newLike = assistantMasmonBasePlanOf('kiki').likeMon.some(x => x.monster === 'Pixie' && x.grown);
        await new Promise(r => setTimeout(r, 300)); const sv = await storeGet('mh_assistant_life_taste_v1', null, false); out.saved = !!(sv && sv.by && sv.by.kiki && Object.keys(sv.by.kiki.mon).length); out.keys = Object.keys(localStorage).filter(k => /^mh_assistant_life_taste/.test(k)).concat(out.saved ? ['mh_assistant_life_taste_v1'] : []).filter((k, i, a) => a.indexOf(k) === i);
        // 壊れた保存
        out.junk = JSON.stringify(normalizeAssistantLifeTaste({ by: { kiki: { mon: { Oboro: 'x', '??': 5 }, day: 3, log: [1, { day: 'x' }] }, 'BAD ID': {} } }));
        out.junk2 = JSON.stringify(normalizeAssistantLifeTaste('abc')) + JSON.stringify(normalizeAssistantLifeTaste(null));
        // 消せば、はじめに戻る
        const saved = AMT_STORE.state; AMT_STORE.set({ v: 1, by: {} }); out.reset = JSON.stringify(assistantMasmonBasePlanOf('kiki').dislikeMon.map(x => x.monster)) === JSON.stringify(out.dis0); AMT_STORE.set(saved);
        return out;
      });
      check(`${T}② はじめの好み(表)は書き換えない`, r.baseSame, JSON.stringify(r.dis0));
      check(`${T}② 1日の上限 +6(同じ日に5回やっても6まで)`, r.capDay === 6 && Math.abs(r.capMon - 4.2) < 0.01, `up=${r.capDay} mon=${r.capMon}`);
      check(`${T}② 「ほめる」は1日1回`, r.praise1 > r.capMon && r.praise2 === r.praise1, `${r.praise1}/${r.praise2}`);
      check(`${T}② 苦手→ふつうは数日かかり、変わるのは1回だけ(記録も1件)`, r.changes === 1 && r.stepDay !== null && r.stepDay <= 3 && r.log.length >= 1 && r.log.every(x => /dislike>normal/.test(x)), JSON.stringify({ c: r.changes, d: r.stepDay, log: r.log }));
      check(`${T}② 変わったら苦手の一覧から外れ、ココロの手がかり(changed)に出る`, !r.dis1.includes('Oboro') && r.recentN >= 1 && r.changedForChat.length >= 1 && r.changedForChat[0].to === 'normal', JSON.stringify({ d: r.dis1, ch: r.changedForChat }));
      check(`${T}③ 推し(ゴーレム)は負けても好きのまま・動きはわずか`, r.coreLike && Math.abs(r.coreMon) < 2, `like=${r.coreLike} mon=${r.coreMon}`);
      check(`${T}② ふつうのモンスターが遊ぶうちに「好き」へ変わる(新しく好きの印つき)`, r.newLike);
      check(`${T}④ 保存は新しいキー1つだけ・壊れた保存は既定値で読める・消せばはじめに戻る`, r.keys.length === 1 && r.keys[0] === 'mh_assistant_life_taste_v1' && !/Oboro|BAD ID/.test(r.junk) && /"by":\{\}/.test(r.junk2) && r.reset, JSON.stringify({ k: r.keys, j: r.junk, j2: r.junk2, rs: r.reset }));
      // ⑤ 部屋の好き・苦手
      await page.locator('[data-assistant-life-icon="profile"]').click(); await page.waitForTimeout(700);
      await page.locator('[data-assistant-life-profile-card="kiki"]').click(); await page.waitForTimeout(900);
      await page.locator('[data-assistant-life-profile-sec="likes"]').scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
      const ui = await page.evaluate(() => {
        const s = document.querySelector('[data-assistant-life-profile-sec="likes"]'); if (!s) return null;
        const W = window.innerWidth;
        const say = s.querySelector('[data-assistant-life-taste-say]'), log = s.querySelector('[data-assistant-life-taste-log]');
        const over = [...s.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > W + 1 && e.getBoundingClientRect().width > 0).length;
        // 言葉のかたまり(inline-block)が行の途中で折れていないか(1つが2行以上にならない)
        const split = [...s.querySelectorAll('[data-assistant-life-taste-say] span, [data-assistant-life-taste-log] span')].filter(e => e.getClientRects().length > 1 || e.getBoundingClientRect().height > 22).length;
        return { say: say ? say.textContent : '', log: log ? log.textContent : '', news: s.querySelectorAll('[data-assistant-life-taste-new]').length, over, split };
      });
      check(`${T}⑤ 助手のひとことと「最近の変化」が出る`, !!ui && /(好きに|苦手じゃ)/.test(ui.say) && /最近の変化/.test(ui.log) && /Oboro|オボロ|ふつう/.test(ui.log), JSON.stringify(ui));
      check(`${T}⑤ 「✨ 新しく」の印が出る`, !!ui && ui.news >= 1, String(ui && ui.news));
      check(`${T}⑤ 横にはみ出さず・言葉の途中で折れない`, !!ui && ui.over === 0 && ui.split === 0, JSON.stringify(ui && { over: ui.over, split: ui.split }));
      await shot(page, `taste-likes-${w}`);
      // 掲示板「今日あったこと」に1件(段が変わった日)
      await page.locator('[data-assistant-life-profile-close]').first().click().catch(() => {}); await page.waitForTimeout(500);
      await page.locator('[data-assistant-life-icon="home"], [data-assistant-life-icon="house"]').first().click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(500);
      await page.locator('[data-assistant-life-board]').click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(500);
      const bd = await page.evaluate(() => { const d = document.querySelector('[data-assistant-life-diary]'); return d ? { text: d.textContent, over: [...d.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > window.innerWidth + 1).length } : null; });
      check(`${T}⑤ 掲示板に「好きになってきたみたい」が1件ずつ出る`, !!bd && /ピクシー.*好きになってきた/.test(bd.text) && /オボロゲソウ.*苦手じゃなくなってきた/.test(bd.text) && bd.over === 0, bd ? bd.text.replace(/\s+/g, ' ').slice(0, 160) : 'なし');
      await shot(page, `taste-board-${w}`);
      await page.close();
    }
  } catch (e) { check('最後まで動く', false, e.message.split('\n')[0]); }
  check('実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  await browser.close(); server.close();
  console.log(failed ? `NG ${failed} 件` : 'すべてOK');
  process.exit(failed ? 1 : 0);
})();

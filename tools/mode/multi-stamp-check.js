// マルチのスタンプ(39-multi-stamp.jsx)を実際に開いて確かめる(2026-11-11)。
//
//   node tools/mode/multi-stamp-check.js            確かめるだけ
//   MH_SHOT_DIR=<dir> node tools/mode/multi-stamp-check.js   止め絵も撮る(縦・横)
//
// 見張ること:
//   ・はじめの持ち物は助手8顔(1人1表情)× 言葉8。よく使う枠は8つ埋まっている
//   ・モンヒロビートの部屋で、スタンプを送ると相手の板に絵で出て、席の上にも絵の吹き出しが出る
//   ・2秒より早く続けて送れない・同じスタンプは続けて3回まで
//   ・ビートP交換所の「スタンプ」で買うと、ビートPが減ってスタンプが増える(1つの取引)。ビートPが足りないと買えない
//   ・古い版から来た知らせ(番号なし)と知らない番号は、言葉だけ(壊れない)。カードの知らせも同じ
// ★外へはつながない。WebSocket を偽物に差し替える(tools/mode/rhythm-multi-layout-check.js と同じ)
const http = require('http');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
let playwright;
try { playwright = require(path.join(ROOT, 'tools', 'node_modules', 'playwright')); } catch (_) {
  try { playwright = require('playwright'); } catch (e) { console.log('SKIP: playwright が無いので測れません'); process.exit(0); }
}
const SHOT = process.env.MH_SHOT_DIR || '';
if (SHOT) fs.mkdirSync(SHOT, { recursive: true });

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.svg': 'image/svg+xml' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(0, () => resolve(server));
});
const FAKE_WS = () => {
  class FakeWS {
    constructor() { this.readyState = 0; this.topic = null; this.ch = null; setTimeout(() => { this.readyState = 1; if (this.onopen) this.onopen({}); }, 0); }
    deliver(obj) { const data = JSON.stringify(obj); setTimeout(() => { if (this.readyState === 1 && this.onmessage) this.onmessage({ data }); }, 0); }
    send(data) {
      const m = JSON.parse(data);
      if (m.event === 'phx_join') {
        this.topic = m.topic;
        this.ch = new BroadcastChannel(`fake-ws:${m.topic}`);
        this.ch.onmessage = (e) => this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload: e.data } });
        this.deliver({ topic: m.topic, event: 'phx_reply', ref: m.ref, payload: { status: 'ok', response: {} } });
        return;
      }
      if (m.event !== 'broadcast') return;
      const payload = m.payload && m.payload.payload;
      if (this.ch) this.ch.postMessage(payload);
      this.deliver({ topic: this.topic, event: 'broadcast', payload: { type: 'broadcast', event: 'msg', payload } });
    }
    close() { this.readyState = 3; if (this.ch) this.ch.close(); if (this.onclose) this.onclose({}); }
  }
  window.WebSocket = FakeWS;
};

(async () => {
  const server = await serve();
  const PORT = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: SHOT ? 2 : 1 });
  await context.addInitScript(FAKE_WS);
  const errors = [];
  const open = async (name, points = 0) => {
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    await page.addInitScript(([nm, pt]) => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', nm); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_assistant_selected_v1', 'momosuke'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
      put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_hell_story_seen_v1', true); put('mh_inherited_unique_level_compensation_v1', true); put('mh_masu_level_cap_compensation_notice_seen_v1', true);
      if (pt) put('mh_rhythm_event_points_v1', pt);
    }, [name, points]);
    await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.body && document.body.innerText.includes('TAP TO START'), null, { timeout: 60000 });
    await page.getByText('TAP TO START').click();
    await page.waitForTimeout(2500);
    await page.mouse.click(195, 422);
    await page.waitForTimeout(3000);
    await page.evaluate(() => { setInterval(() => { const d = document.querySelector('[role=dialog]'); if (!d || d.closest('[data-multi-stamp-editor]')) return; const b = d.querySelector('button[aria-label="次へ"],button[aria-label="閉じる"]') || [...d.querySelectorAll('button')].find((x) => /閉じる|OK|とじる|あとで/.test(x.innerText)); if (b) b.click(); }, 400); });
    return page;
  };
  const toRhythm = async (page) => {
    await page.waitForFunction(() => document.querySelector('button.mh-home-facility.rhythm') && !document.querySelector('[role=dialog]'), null, { timeout: 40000 });
    await page.locator('button.mh-home-facility.rhythm').click();
    await page.waitForSelector('[data-rhythm-mode-select]', { timeout: 30000 });
    await page.waitForTimeout(800);
  };
  try {
    const A = await open('あ', 20000);
    // ===== ① 純粋な形(はじめの持ち物・古い版の知らせ・カードの知らせ・値段) =====
    const pure = await A.evaluate(() => {
      const st = normalizeMultiStamps(null);
      const bad = normalizeMultiStamps({ owned: ['x', 7, 'stamp_face_kiki'], slots: [{ f: 'a.kiki.angry', w: 'w01' }, { f: 'a.mua.angry', w: 'w01' }, 'zz'] });
      const rOld = rhythmMultiCleanMessage({ t: 'chat', id: 'p1', name: 'た', text: 'ナイス！', cid: 'c1' });
      const rNew = rhythmMultiCleanMessage({ t: 'chat', id: 'p1', name: 'た', text: 'ナイス！', cid: 'c2', sf: 'a.kiki.happy', sw: 'w02' });
      const rBad = rhythmMultiCleanMessage({ t: 'chat', id: 'p1', name: 'た', text: 'ナイス！', cid: 'c3', sf: '../x.png', sw: 'w02' });
      const cNew = cardPvpCleanMessage({ t: 'chat', from: 'f', i: 1, sf: 'a.dra.happy', sw: 'w02' });
      const cX = cardPvpCleanMessage({ t: 'chat', from: 'f', x: 'すごい！', sf: 'a.dra.happy', sw: 'w03' });
      const cOld = cardPvpCleanMessage({ t: 'chat', from: 'f', i: 2 });
      const all = MULTI_STAMP_SHOP_OFFERS.reduce((sum, o) => sum + (o.group === 'faceAll' ? 0 : (o.group === 'slot' ? MULTI_STAMP_PRICE.slot * MULTI_STAMP_SLOT_BUY_MAX : (multiStampOfferCost(o, st) || 0))), 0);
      return {
        start: st.slots.filter(Boolean).length, startFaces: st.slots.every((x) => x && /\.happy$/.test(x.f)), startWords: st.slots.map((x) => x.w).join(','),
        badSlots: bad.slots.filter(Boolean).length, badOwned: bad.owned.join(','),
        rOld: !!rOld && !rOld.sf, rNew: !!rNew && rNew.sf === 'a.kiki.happy' && rNew.sw === 'w02', rBad: !!rBad && !rBad.sf,
        cNew: !!cNew && cNew.i === 1 && cNew.sf === 'a.dra.happy', cX: !!cX && cX.x === 'すごい！' && cX.sw === 'w03', cOld: !!cOld && cOld.i === 2 && !cOld.sf,
        srcs: MULTI_STAMP_ASSISTANT_IDS.every((id) => MULTI_STAMP_EXPRESSIONS.every((e) => !!multiStampFaceSrc(`a.${id}.${e}`))),
        monsters: MULTI_STAMP_MONSTER_SETS.flat().filter((id) => !multiStampFaceSrc(`m.${id}`)),
        all,
      };
    });
    check('はじめは8つ(助手8人の happy × 言葉8)', pure.start === 8 && pure.startFaces && pure.startWords === 'w01,w02,w03,w04,w05,w06,w07,w08', pure.startWords);
    check('壊れた保存値・持っていない顔は枠に入らない', pure.badSlots === 1 && pure.badOwned === 'stamp_face_kiki', `${pure.badSlots} / ${pure.badOwned}`);
    check('ビートのチャット: 古い版の知らせ(番号なし)は言葉だけ・新しい知らせは番号つき・知らない番号は捨てる', pure.rOld && pure.rNew && pure.rBad);
    check('カードの知らせ: 定型の番号・言葉どちらにも番号が乗る・古い版の知らせはそのまま', pure.cNew && pure.cX && pure.cOld);
    check('助手8人×8表情の顔の絵がすべて決まる', pure.srcs);
    check('モンスターの顔セットの30体の絵が決まる', pure.monsters.length === 0, pure.monsters.join(','));
    console.log(`  全部そろえるビートP: ${pure.all.toLocaleString()}P`);
    // 絵が実際に読めるか(道が合っているか)
    const broken = await A.evaluate(async () => {
      const ids = [...MULTI_STAMP_ASSISTANT_IDS.flatMap((id) => MULTI_STAMP_EXPRESSIONS.map((e) => `a.${id}.${e}`)), ...MULTI_STAMP_MONSTER_SETS.flat().map((id) => `m.${id}`)];
      const out = [];
      for (const id of ids) { const ok = await new Promise((r) => { const im = new Image(); im.onload = () => r(im.naturalWidth > 0); im.onerror = () => r(false); im.src = multiStampFaceSrc(id); }); if (!ok) out.push(id); }
      return out;
    });
    check('スタンプの顔の絵がすべて読める', broken.length === 0, broken.slice(0, 6).join(','));

    // ===== ② 買う(ビートPとスタンプを1つの取引で) =====
    const prices = await A.evaluate(() => MULTI_STAMP_PRICE);
    const MULTI_PRICE_FACE = prices.face, MULTI_PRICE_WORDS = prices.words, MULTI_PRICE_ALL_PER = prices.faceAllPer;
    const buy = await A.evaluate(async () => {
      const before = await loadRhythmEventPoints();
      const r1 = await multiStampExchange({ id: 'stamp_face_kiki' });
      const r2 = await multiStampExchange({ id: 'stamp_face_kiki' });
      const r3 = await multiStampExchange({ id: 'stamp_words_feel' });
      const after = await loadRhythmEventPoints();
      const saved = normalizeMultiStamps(await storeGet(MULTI_STAMP_KEY, null, false));
      const allCost = multiStampOfferCost(multiStampOffer('stamp_face_all'), saved);
      return { before, after, r1: r1.ok, r2: r2.reason, r3: r3.ok, owned: saved.owned.join(','), allCost, okSlot: MULTI_STAMP.setSlot(0, { f: 'a.kiki.angry', w: 'f02' }) };
    });
    check('表情セットと言葉パックを買うと、その値段だけビートPが減る・同じ物は2度買えない', buy.r1 && buy.r2 === 'owned' && buy.before - buy.after === MULTI_PRICE_FACE + MULTI_PRICE_WORDS, `${buy.before}→${buy.after} / ${buy.r2}`);
    check('買った顔と言葉が保存され、枠に入れられる', buy.r3 && /stamp_face_kiki/.test(buy.owned) && /stamp_words_feel/.test(buy.owned) && buy.okSlot, buy.owned);
    check('8人まとめては、まだ持っていない人の分だけの値段(7人ぶん)', buy.allCost === 7 * MULTI_PRICE_ALL_PER, String(buy.allCost));
    const poor = await A.evaluate(async () => { await storeSet(RHYTHM_EVENT_POINTS_KEY, 100, false); const r = await multiStampExchange({ id: 'stamp_face_dra' }); const p = await loadRhythmEventPoints(); await storeSet(RHYTHM_EVENT_POINTS_KEY, 20000, false); return { reason: r.reason, p }; });
    check('ビートPが足りないと買えず、ビートPも減らない', poor.reason === 'points' && poor.p === 100, JSON.stringify(poor));

    // ===== ③ 交換所の「スタンプ」 =====
    await A.waitForFunction(() => !document.querySelector('[role=dialog]'), null, { timeout: 30000 }).catch(() => {});
    for (const [w, h, label] of [[390, 844, 'tate'], [844, 390, 'yoko']]) {
      await A.setViewportSize({ width: w, height: h });
      await A.waitForTimeout(400);
      await A.locator('[data-home-market], .mh-home-facility.market').first().click({ timeout: 15000 }).catch(() => {});
      await A.waitForTimeout(1200);
      await A.getByRole('button', { name: /ビートP交換所/ }).first().click({ timeout: 8000 }).catch(() => {});
      await A.waitForTimeout(800);
      await A.getByRole('tab', { name: 'スタンプ' }).first().click({ timeout: 5000 }).catch(() => {});
      await A.waitForTimeout(800);
      const shop = await A.evaluate(() => ({ n: document.querySelectorAll('[data-multi-stamp-offer]').length, owned: document.querySelector('[data-multi-stamp-offer="stamp_face_kiki"]')?.innerText || '' }));
      check(`交換所の「スタンプ」に品が並ぶ(${label})`, shop.n >= 15, `${shop.n}個`);
      if (SHOT) await A.screenshot({ path: path.join(SHOT, `real-shop-${label}.png`) });
      await A.locator('[data-multi-stamp-shop-edit]').click().catch(() => {});
      await A.waitForSelector('[data-multi-stamp-editor]', { timeout: 5000 }).catch(() => {});
      await A.locator('[data-multi-stamp-slot="3"]').click().catch(() => {});
      await A.locator('[data-multi-stamp-who="dra"]').click().catch(() => {});
      await A.waitForTimeout(400);
      const ed = await A.evaluate(() => {
        const root = document.querySelector('[data-multi-stamp-editor] > div');
        if (!root) return { ok: false, why: 'マイスタンプが開かない' };
        const r = root.getBoundingClientRect();
        const out = [...root.querySelectorAll('button')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0 && (x.right > innerWidth + 1 || x.left < -1); }).length;
        return { ok: r.width > 0 && out === 0, why: `はみ出すボタン ${out}` };
      });
      check(`マイスタンプが開き、ボタンが画面からはみ出さない(${label})`, ed.ok, ed.why);
      if (SHOT) await A.screenshot({ path: path.join(SHOT, `real-editor-${label}.png`) });
      await A.locator('[data-multi-stamp-editor-close]').click().catch(() => {});
      await A.goBack().catch(() => {});
      for (let i = 0; i < 4; i++) { const back = A.locator('button[aria-label="戻る"], [data-screen-back]').first(); if (await back.count()) await back.click({ timeout: 1500 }).catch(() => {}); await A.waitForTimeout(400); if (await A.locator('button.mh-home-facility.rhythm').count()) break; }
    }

    // ===== ④ ビートの部屋で送る・届く =====
    await A.setViewportSize({ width: 390, height: 844 });
    await toRhythm(A);
    const B = await open('い');
    await toRhythm(B);
    await A.locator('[data-rhythm-mode-private-open]').click();
    await A.locator('[data-rhythm-multi-create]').click();
    await A.waitForSelector('[data-rhythm-multi-room-code]', { timeout: 15000 });
    const code = (await A.locator('[data-rhythm-multi-room-code]').innerText()).trim();
    await B.locator('[data-rhythm-mode-private-open]').click();
    await B.locator('[data-rhythm-multi-code-input]').fill(code);
    await B.locator('[data-rhythm-multi-join]').click();
    await A.waitForFunction(() => RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2, null, { timeout: 20000 });
    await B.waitForFunction(() => RHYTHM_MULTI.view() && RHYTHM_MULTI.view().members.length === 2, null, { timeout: 20000 });
    await B.waitForTimeout(800);
    await A.evaluate(() => document.querySelector('[data-rhythm-multi-chat-open]')?.click());
    await A.waitForSelector('[data-rhythm-multi-chat]', { timeout: 5000 });
    await A.locator('[data-rhythm-multi-chat-mode-btn="stamp"]').click();
    await A.waitForSelector('[data-multi-stamp-palette]', { timeout: 5000 });
    await A.locator('[data-multi-stamp-send="0"]').click();
    await B.waitForFunction(() => (RHYTHM_MULTI.view().chat || []).some((c) => c.sf === 'a.kiki.angry' && c.sw === 'f02'), null, { timeout: 8000 }).then(() => true, () => false)
      .then((ok) => check('ビート: 送ったスタンプが相手に番号つきで届く', ok));
    await A.locator('[data-multi-stamp-send="1"]').click();
    const quick = await A.evaluate(() => document.querySelector('[data-multi-stamp-why]')?.innerText || '');
    check('ビート: 2秒より早く続けては送れない', /少しあけて/.test(quick), quick);
    await B.waitForTimeout(300);
    const bub = await B.evaluate(() => !!document.querySelector('[data-rhythm-multi-stamp-bubble] img'));
    check('ビート: 相手の席の上に絵の吹き出しが出る', bub);
    if (SHOT) {
      await B.screenshot({ path: path.join(SHOT, 'real-room-bubble-tate.png') });
      await A.screenshot({ path: path.join(SHOT, 'real-chat-tate.png') });
      await A.setViewportSize({ width: 844, height: 390 });
      await A.waitForTimeout(2200);
      await A.locator('[data-multi-stamp-send="2"]').click().catch(() => {});
      await A.waitForTimeout(600);
      await A.screenshot({ path: path.join(SHOT, 'real-chat-yoko.png') });
      await B.setViewportSize({ width: 844, height: 390 });
      await B.waitForTimeout(600);
      await B.screenshot({ path: path.join(SHOT, 'real-room-bubble-yoko.png') });
    }
    // 同じスタンプは続けて3回まで
    const same = await A.evaluate(async () => {
      const slot = MULTI_STAMP.get().slots[0];
      const res = [];
      for (let i = 0; i < 4; i++) { const r = MULTI_STAMP.check(slot); res.push(r.ok); if (r.ok) MULTI_STAMP.sent(slot); await new Promise((ok) => setTimeout(ok, 2050)); }
      return res;
    });
    check('同じスタンプは続けて3回まで', same.join(',') === 'true,true,true,false' || same.join(',') === 'true,true,false,false', same.join(','));
    // 絵で出さない設定
    const off = await B.evaluate(async () => { MULTI_STAMP.setPic(false); await new Promise((r) => setTimeout(r, 200)); const n = document.querySelectorAll('[data-rhythm-multi-chat-list] [data-multi-stamp] img, [data-rhythm-multi-stamp-bubble] img').length; MULTI_STAMP.setPic(true); return n; });
    check('「絵で出す」を切ると、届いたスタンプを絵で出さない', off === 0, String(off));
  } catch (e) {
    check('最後まで動く', false, e && e.message);
  } finally {
    check('ページのエラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
    await browser.close();
    server.close();
    console.log(failed ? `NG: ${failed} 件` : 'すべてOK');
    process.exit(failed ? 1 : 0);
  }
})();

// ポインタとタッチの突き合わせ・消えたタッチの取り戻し(2026-09-30・RHYTHM_TOUCH_BRIDGE)を、実際に曲を流して確かめる。
// ユーザー報告「iPhoneで両手の高速連打のとき、押しても音も光も出ないことがある」。
//
//   node tools/mode/rhythm-touch-bridge-check.js
//
// 本物のタッチ(CDP)で叩き、ブラウザが touchstart を落とした状況は、window の capture で touchstart を止めて作る
// (ポインタ(pointerdown)は届いたまま)。見るもの:
//   ① ふつうに叩くと、全部タッチの経路で1回ずつ入力になり、取り戻しは一度も動かない(ふつうの端末では何も変わらない)
//   ② タッチが落ちた指は、ポインタの経路で1回だけ入力になる(音も判定も出る)
//   ③ 取り戻したあとで同じ指のタッチが遅れて来ても、二度目の入力にしない
//   ④ タッチが先・ポインタがあとで来たときは、取り戻さない(二重にしない)
//   ⑤ 押さえたままの指を取り戻しても、離したら押した印が消える(押しっぱなしにならない)
//   ⑥ 1曲終わると、数えたものが端末に残る(mh_rhythm_touch_diag_v1)
//   ⑦ 部品の突き合わせ(位置・時刻)を、偽の時計で細かく
const path = require('path');
const http = require('http');
const fs = require('fs');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9201;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- ⑦ 部品だけ(偽の時計) ----
{
  const src = fs.readFileSync(path.join(ROOT, 'monster-hero/data/rhythm-mode.js'), 'utf8');
  const start = src.indexOf('const RHYTHM_TOUCH_BRIDGE_WAIT_MS=');
  const end = src.indexOf('const RHYTHM_GESTURE_RUNTIME=(()=>{');
  const ctx = { navigator: { userAgent: 'x' }, console };
  vm.runInNewContext(`${src.slice(start, end)}\nthis.B=RHYTHM_TOUCH_BRIDGE;this.W=RHYTHM_TOUCH_BRIDGE_WAIT_MS;this.miss=rhythmTouchNoInputMisses;`, ctx);
  const B = ctx.B, W = ctx.W;
  // 直し方の切り替え(既定は切ってある・iPhoneだけ)
  {
    const fixCtx = (ua) => { const c = { navigator: { userAgent: ua, maxTouchPoints: 5 }, console }; vm.runInNewContext(`${src.slice(start, end)}\nthis.F=RHYTHM_TOUCH_FIXES;this.on=rhythmTouchFixOn;this.active=rhythmTouchFixesActive;`, c); return c; };
    const pc = fixCtx('Mozilla/5.0 (X11; Linux x86_64)'), ip = fixCtx('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)');
    check('部品: 直し方は既定ですべて切ってある', !ip.on('lateInputEffectDown') && !ip.on('wideEdge') && ip.active().length === 0);
    pc.F.wideEdge = true; ip.F.wideEdge = true;
    check('部品: 入れた直し方は iPhone だけに効く', ip.on('wideEdge') && !pc.on('wideEdge') && ip.active().join() === 'wideEdge');
    pc.F.allPlatforms = true;
    check('部品: 検査用の allPlatforms で、パソコンでも試せる(名前としては返さない)', pc.on('wideEdge') && !pc.on('allPlatforms') && pc.active().join() === 'wideEdge');
  }
  B.reset();
  B.pointerDown(1, 100, 300, 1000, 1000); B.touchStart(11, 100, 300, 1000, 1001, 1);
  check('部品: 同じ位置・時刻のポインタとタッチは組になる', B.snapshot().matched === 1 && B.sweep(1100).length === 0);
  B.reset();
  B.pointerDown(2, 200, 300, 1000, 1000);
  check('部品: 待つあいだは取り戻さない', B.sweep(1000 + W - 1).length === 0);
  const lost = B.sweep(1000 + W);
  check('部品: 待ちきれなかったポインタを1回だけ取り戻す', lost.length === 1 && lost[0].id === 2 && B.sweep(1300).length === 0 && B.snapshot().pointerOnly === 1);
  check('部品: 取り戻したあとに来た同じ指のタッチは無視する', B.touchStart(22, 204, 302, 1100, 1150, 50) === 'ignore' && B.isIgnoredTouch(22));
  check('部品: 別の場所のタッチは無視しない', B.touchStart(23, 500, 300, 1100, 1150, 1) === 'normal');
  B.reset();
  B.touchStart(31, 300, 300, 1000, 1000, 1); B.pointerDown(3, 300, 300, 1030, 1030);
  check('部品: タッチが先・ポインタがあとでも組になり、取り戻さない', B.sweep(2000).length === 0 && B.snapshot().matched === 1);
  B.reset();
  B.pointerDown(4, 100, 100, 1000, 1000); B.pointerUp(4, 1020, 1020);
  const quick = B.sweep(1100);
  check('部品: 取り戻す前に離していた指は、離した印を持って返る(すぐ離す)', quick.length === 1 && quick[0].upAt === 1020 && !B.isRecoveredPointer(4));
  B.reset();
  B.pointerDown(5, 100, 100, 1000, 1000); B.sweep(1100);
  check('部品: 押さえたまま取り戻した指は、離すまで取り戻し中', B.isRecoveredPointer(5) && B.pointerUp(5, 1300, 1300) && !B.isRecoveredPointer(5));
  B.reset();
  B.touchStart(41, 1, 1, 0, 0, 80); B.touchStart(42, 1, 1, 0, 0, 10);
  check('部品: 50msより遅れて届いたタッチを数える', B.snapshot().lateDelivery === 1 && B.snapshot().maxDelayMs === 80);
  const notes = [{ timeMs: 1000, _rhythmFinalJudgment: 'MISS' }, { timeMs: 3000, _rhythmFinalJudgment: 'MISS' }, { timeMs: 5000, _rhythmFinalJudgment: 'MISS' }, { timeMs: 6000, _rhythmFinalJudgment: 'GREAT' }];
  const m = ctx.miss(notes, [600, 1400, 3050, 9000]);
  check('部品: 叩いている最中なのに前後に入力が無いMISSを数える(ふつうの見逃しは数えない)', m.misses === 3 && m.noInput === 1, JSON.stringify(m));
}

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
  put('mh_rhythm_settings_v1', { autoEffectDown: false });
  // タッチを落とす仕掛け: window.__dropTouchStarts が正のあいだ、touchstart をほかの誰にも届けない(ポインタは届く)
  window.__dropTouchStarts = 0;
  window.addEventListener('touchstart', e => { if (window.__dropTouchStarts > 0) { window.__dropTouchStarts--; e.stopImmediatePropagation(); } }, true);
};

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, ''), file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));
  const browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
  try {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    await page.addInitScript(seed);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(300); }
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForTimeout(6500);
    // 入力になった回数を、経路(touch / pointer)ごとに数える
    await page.evaluate(() => {
      window.__inputs = [];
      const orig = RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget;
      RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget = function (key) { if (!RHYTHM_TOUCH_SPAN_RUNTIME.isSyntheticTapKey(key)) window.__inputs.push(String(key).split(':')[0]); return orig.apply(this, arguments); };
    });
    const geo = await page.evaluate(() => { const a = document.querySelector('[data-rhythm-play-area]').getBoundingClientRect(); const l = document.querySelector('[data-rhythm-judgment-line]'); const r = l ? l.getBoundingClientRect() : null; return { l: a.left, w: a.width, y: r ? r.top + r.height / 2 : a.top + a.height * .8 }; });
    const cdp = await page.context().newCDPSession(page);
    const tap = async (id, x, holdMs = 40) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: geo.y, id, radiusX: 1, radiusY: 1 }] });
      await page.waitForTimeout(holdMs);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(90);
    };
    const X = (r) => geo.l + geo.w * r;
    const state = () => page.evaluate(() => ({ inputs: window.__inputs.slice(), bridge: RHYTHM_TOUCH_BRIDGE.snapshot() }));
    const resetCount = () => page.evaluate(() => { window.__inputs.length = 0; RHYTHM_TOUCH_BRIDGE.reset(); });

    // ① ふつう
    await resetCount();
    for (let i = 0; i < 12; i++) await tap(1 + (i % 2), X(.25 + (i % 6) * .1));
    let st = await state();
    check('① ふつうに叩くと、全部タッチの経路で1回ずつ入力になる', st.inputs.length === 12 && st.inputs.every((k) => k === 'touch'), JSON.stringify(st.inputs));
    check('① ふつうの端末では取り戻しは一度も動かない', st.bridge.recovered === 0 && st.bridge.pointerOnly === 0 && st.bridge.matched === 12, JSON.stringify(st.bridge));

    // ② タッチが落ちた指
    await resetCount();
    for (let i = 0; i < 6; i++) { if (i % 2 === 1) await page.evaluate(() => { window.__dropTouchStarts = 1; }); await tap(1 + (i % 2), X(.3 + i * .08)); }
    st = await state();
    const pointerInputs = st.inputs.filter((k) => k === 'pointer').length, touchInputs = st.inputs.filter((k) => k === 'touch').length;
    check('② タッチが落ちた3本は、ポインタの経路で1回ずつ入力になる', pointerInputs === 3 && touchInputs === 3, JSON.stringify(st.inputs));
    check('② 落ちた数を数える', st.bridge.pointerOnly === 3 && st.bridge.recovered === 3, JSON.stringify(st.bridge));

    // ③ 取り戻したあと、同じ指のタッチが遅れて来る
    await resetCount();
    await page.evaluate(() => { window.__dropTouchStarts = 1; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X(.5), y: geo.y, id: 7, radiusX: 1, radiusY: 1 }] });
    await page.waitForFunction(() => RHYTHM_TOUCH_BRIDGE.snapshot().recovered === 1, null, { timeout: 2000 }).catch(() => {});   // 取り戻しが済むまで待つ
    const recoverLag = await page.evaluate(() => { const e = [...RHYTHM_TOUCH_BRIDGE._state.recovered.values()][0]; return e ? Math.round(performance.now() - e.at) : null; });
    await page.evaluate(([x, y]) => {   // 遅れて届いたタッチ(同じ位置)
      const area = document.querySelector('[data-rhythm-play-area]');
      const t = new Touch({ identifier: 4242, target: area, clientX: x, clientY: y, radiusX: 1, radiusY: 1 });
      area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
      area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
    }, [X(.5), geo.y]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
    st = await state();
    check('③ ポインタが来てから、遅くとも数コマのうちに取り戻す', recoverLag !== null && recoverLag < 250, `${recoverLag}ms`);
    check('③ 取り戻したあとで遅れて来た同じ指のタッチは、二度目の入力にしない', st.inputs.length === 1 && st.inputs[0] === 'pointer' && st.bridge.ignoredLateTouches === 1, JSON.stringify({ inputs: st.inputs, b: st.bridge }));

    // ④ タッチが先、ポインタがあと
    await resetCount();
    await page.evaluate(([x, y]) => {
      const area = document.querySelector('[data-rhythm-play-area]');
      const t = new Touch({ identifier: 5151, target: area, clientX: x, clientY: y, radiusX: 1, radiusY: 1 });
      area.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] }));
      setTimeout(() => {
        area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 515, pointerType: 'touch', clientX: x, clientY: y }));
        setTimeout(() => {
          area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 515, pointerType: 'touch', clientX: x, clientY: y }));
          area.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [t] }));
        }, 30);
      }, 25);
    }, [X(.4), geo.y]);
    await page.waitForTimeout(250);
    st = await state();
    check('④ タッチが先でポインタがあとでも、入力は1回だけ(取り戻さない)', st.inputs.length === 1 && st.inputs[0] === 'touch' && st.bridge.recovered === 0, JSON.stringify({ inputs: st.inputs, b: st.bridge }));

    // ⑤ 押さえたまま取り戻した指を離す
    await resetCount();
    await page.evaluate(() => { window.__dropTouchStarts = 1; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: X(.6), y: geo.y, id: 9, radiusX: 1, radiusY: 1 }] });
    await page.waitForTimeout(120);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: X(.62), y: geo.y, id: 9, radiusX: 1, radiusY: 1 }] });
    await page.waitForTimeout(120);
    const held = await page.evaluate(() => { let n = 0; try { const el = document.querySelector('[data-rhythm-play-area]'); n = el.querySelectorAll('[data-rhythm-lane-pressed="true"],[data-pressed="true"]').length; } catch (_) {} return { rec: RHYTHM_TOUCH_BRIDGE.snapshot().recovered, active: RHYTHM_TOUCH_BRIDGE._state.recovered.size }; });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    const released = await page.evaluate(() => ({ stillRecovered: [...RHYTHM_TOUCH_BRIDGE._state.recovered.values()].some((e) => e.upAt == null) }));
    check('⑤ 押さえたままの指も取り戻す', held.rec === 1, JSON.stringify(held));
    check('⑤ 離したら、取り戻し中の指は残らない(押しっぱなしにならない)', released.stillRecovered === false);

    check('実行時エラーが出ていない', errors.length === 0, errors[0] || '');

    // ⑥ 1曲終わると残る(曲の最後まで早送りはせず、finish を待つ代わりに記録の関数を直接見る)
    const saved = await page.evaluate(async () => {
      if (typeof rhythmTouchDiagOf !== 'function') return { err: 'no fn' };
      const d = rhythmTouchDiagOf({ song: { songId: 'mf_ichika_mix' }, difficulty: { id: 'EASY' }, notes: [], inputTimes: [1, 2], assist: false, mirror: false, cleared: true });
      await rhythmTouchDiagRecord(d);
      return { d, list: JSON.parse(localStorage.getItem('mh_rhythm_touch_diag_v1') || '[]') };
    });
    check('⑥ 1曲ぶんのまとめに、系統・突き合わせ・入力の数が入る', saved.d && ['ios', 'android', 'other'].includes(saved.d.platform) && typeof saved.d.stats.pointerOnly === 'number' && saved.d.stats.inputs === 2, JSON.stringify(saved.d || saved));
    check('⑥ まとめが端末に残る(新しいキー mh_rhythm_touch_diag_v1)', Array.isArray(saved.list) && saved.list.length >= 1 && saved.list[saved.list.length - 1].song_id === 'mf_ichika_mix');

    // ⑨ 直し方「wideEdge」: 道の外の受け付けを広げる(既定は切ってある)
    const edge = await page.evaluate(() => {
      const rect = { left: 0, top: 0, width: 1000, height: 1000 };
      const left = rhythmProjectBoundary(0, 1), right = rhythmProjectBoundary(RHYTHM_LANE_COUNT, 1), lw = (right - left) / RHYTHM_LANE_COUNT;
      const x = (left - lw / 2 * 1.5) * 1000;   // サブレーン1.5本ぶん外
      const off = rhythmLaneCoordinateAtPoint(x, 1000, rect);
      RHYTHM_TOUCH_FIXES.wideEdge = true; RHYTHM_TOUCH_FIXES.allPlatforms = true;
      const on = rhythmLaneCoordinateAtPoint(x, 1000, rect);
      const far = rhythmLaneCoordinateAtPoint((left - lw / 2 * 2.5) * 1000, 1000, rect);
      RHYTHM_TOUCH_FIXES.wideEdge = false; RHYTHM_TOUCH_FIXES.allPlatforms = false;
      return { off, on, far, back: rhythmLaneCoordinateAtPoint(x, 1000, rect) };
    });
    check('⑨ 切ってあるときは、サブレーン1.5本ぶん外の指を受け付けない(いまのまま)', edge.off === null && edge.back === null, JSON.stringify(edge));
    check('⑨ 入れると、サブレーン2本ぶんまで受け付ける(それより外は受け付けない)', typeof edge.on === 'number' && edge.far === null, JSON.stringify(edge));

    // ⑩ リザルトの「押したのに反応しないことがあった」: 端末の記録に印を付け、報告の行を作る
    const rep = await page.evaluate(async () => {
      window.__sent = [];
      const origFetch = window.fetch;
      const d = rhythmTouchDiagOf({ song: { songId: 'mf_ichika_mix' }, difficulty: { id: 'EASY' }, notes: [], inputTimes: [], assist: false, mirror: false, cleared: true });
      await rhythmTouchDiagRecord(d);
      const sent = await rhythmTouchDiagReport({ playId: d.stats.playId, song_id: 'mf_ichika_mix', difficulty: 'EASY', note_count: 1, platform: 'android', standalone: false });
      const list = JSON.parse(localStorage.getItem('mh_rhythm_touch_diag_v1') || '[]');
      const hit = list.find((x) => x.stats && x.stats.playId === d.stats.playId);
      return { playId: d.stats.playId, fixes: d.stats.fixes, reported: !!(hit && hit.reported), others: list.filter((x) => x !== hit).every((x) => !x.reported), sent, origFetch: typeof origFetch };
    });
    check('⑩ 1曲ごとに、結ぶための番号(12文字)と、効いていた直し方(いまは空)が入る', /^[0-9a-z]{12}$/.test(rep.playId) && Array.isArray(rep.fixes) && rep.fixes.length === 0, JSON.stringify(rep));
    check('⑩ 報告すると、端末の記録のその曲にだけ印が付く', rep.reported && rep.others, JSON.stringify(rep));
    check('⑩ 手元のサーバーで開いたゲームからは送らない', rep.sent === false, JSON.stringify(rep));
    await page.close();

    // ⑧ 直し方「lateInputEffectDown」: 3秒の枠でタッチが3回以上遅れて届いたら、演出を一段下げる(既定は切ってある)。
    //   「重いときは演出を自動で控えめに」を入れ、画質を固定した端末で見る(画質「自動」は画質から先に下げるため)
    const page2 = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const errors2 = [];
    page2.on('pageerror', (e) => errors2.push(String(e)));
    await page2.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    await page2.addInitScript(seed);
    // リザルトのボタンはタッチで遊ぶ端末(iPhone・Android)だけに出るので、Android として開く(中身は同じ Chromium)
    await page2.addInitScript(() => { Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' }); });
    await page2.addInitScript(() => localStorage.setItem('mh_rhythm_settings_v1', JSON.stringify({ autoEffectDown: true, renderQuality: 'HIGH', stageEffect: 'VIVID', roadFx: true, judgmentFx: true, comboMilestoneFx: true })));
    const clickText2 = (p) => page2.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page2.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page2.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page2.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page2.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText2('受け取る|閉じる|OK|閉じる'))) break; await page2.waitForTimeout(250); }
    await clickText2('モンヒロビート');
    await page2.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText2('^確認$|受け取る|閉じる|OK|閉じる'))) break; await page2.waitForTimeout(300); }
    await page2.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page2.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page2.waitForTimeout(6500);
    // ⑧ 直し方「lateInputEffectDown」: 3秒の枠でタッチが3回以上遅れて届いたら、演出を一段下げる(既定は切ってある)
    const lateStep = async (fixOn) => page2.evaluate(async (fixOn) => {
      RHYTHM_TOUCH_FIXES.lateInputEffectDown = fixOn; RHYTHM_TOUCH_FIXES.allPlatforms = fixOn;
      const level = () => (typeof rhythmAutoEffectMemory !== 'undefined' ? rhythmAutoEffectMemory.level : null);
      const before = level();
      for (let i = 0; i < 4; i++) RHYTHM_TOUCH_BRIDGE.touchStart(800 + i, 5, 5, performance.now(), performance.now(), 120);
      await new Promise((r) => setTimeout(r, 3600));
      const after = level();
      RHYTHM_TOUCH_FIXES.lateInputEffectDown = false; RHYTHM_TOUCH_FIXES.allPlatforms = false;
      return { before, after, stepped: before !== null && after > before };
    }, fixOn);
    const offSteps = await lateStep(false), onSteps = await lateStep(true);
    check('⑧ 切ってあるときは、タッチが遅れても演出を下げない', offSteps.before !== null && !offSteps.stepped, JSON.stringify(offSteps));
    check('⑧ 入れると、タッチの遅れが続いた枠で演出を一段下げる', onSteps.stepped, JSON.stringify(onSteps));


    // ⑪ リザルトの「押したのに反応しないことがあった」(曲を最後まで流してリザルトを開く)
    await page2.waitForSelector('[data-rhythm-result]', { timeout: 300000 });
    const btn = await page2.$('[data-rhythm-touch-report-button]');
    check('⑪ タッチで遊ぶ端末のリザルトに「押したのに反応しないことがあった」が出る', !!btn && /押したのに反応しないことがあった/.test(await btn.innerText()));
    if (btn) {
      const box = await btn.boundingBox();
      check('⑪ ボタンは押しやすい大きさ(高さ44px以上)', !!box && box.height >= 44, JSON.stringify(box));
      await btn.click();
      await page2.waitForSelector('[data-rhythm-touch-report-done]', { timeout: 5000 }).catch(() => null);
      const after = await page2.evaluate(() => {
        const list = JSON.parse(localStorage.getItem('mh_rhythm_touch_diag_v1') || '[]');
        return { done: !!document.querySelector('[data-rhythm-touch-report-done]'), button: !!document.querySelector('[data-rhythm-touch-report-button]'), last: list[list.length - 1] || null };
      });
      check('⑪ 押すとお礼に変わり、もう押せない(同じ曲で1回だけ)', after.done && !after.button, JSON.stringify({ done: after.done, button: after.button }));
      check('⑪ その曲の端末の記録に印が付く', !!after.last && after.last.reported === true && after.last.platform === 'android', JSON.stringify(after.last && { platform: after.last.platform, reported: after.last.reported }));
      if (process.env.SHOT) await page2.screenshot({ path: process.env.SHOT });
    }
    check('⑪ 実行時エラーが出ていない', errors2.length === 0, errors2[0] || '');
    await page2.close();
  } finally {
    await browser.close();
    server.close();
  }
  // 本体の配線(文字列)
  const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
  check('演奏の始まりで突き合わせを空にする', play.includes('RHYTHM_TOUCH_BRIDGE.reset();rhythmFloatingNotesClear();runRef.current={'));
  check('取り戻し済みの指のタッチは、演奏エリアの入力にしない', play.includes('if(RHYTHM_TOUCH_BRIDGE.isIgnoredTouch(touch.identifier))return;'));
  check('デバッグ・練習・タイミング合わせでは診断を送らない', /const touchDiag=!debugPlay&&!tutorial&&!calibrating\?rhythmTouchDiagOf\(/.test(play) && play.includes('if(touchDiag)void rhythmTouchDiagRecord(touchDiag);'));
  const supa = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/26-supabase.jsx'), 'utf8');
  check('手元のサーバーで開いたゲームからは、診断・遊んだ記録を送らない(検査の行を本番へ混ぜない)',
    (supa.match(/typeof fetch !== 'function' \|\| sbTelemetryLocal\(\)\) return false;/g) || []).length === 2);
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

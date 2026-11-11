// 同期の総点検(2026-11-11)で入れた守りと診断を、実際に曲を流して確かめる。
//
//   node tools/mode/rhythm-sync-audit-check.js
//
// 【なぜ要るか】本番のタッチの診断で、iPhone だけ「自分の touchstart なしに、別の指の合図で初めて見える指」が MASTER / HELL で 1000タッチに約23回あった。
//   そのうち「自分の離しの合図なしに指の一覧から消えていた、同じ番号の指」が戻っただけのものは、押し直していないのに新しく押した扱い(空打ち・早取り)になっていた。
//   見るもの:
//   ① iPhone: 一覧から消えて戻った指は、入力にしない(数だけ残す)。一度も見えていなかった指は、今までどおり入力にする
//   ② Android: 番号を使い回すので、今までどおり入力にする(数だけ残す)
//   ③ 自分の離しの合図で消えた指の番号が、あとで別の合図の中に見えたら、今までどおり入力にする(戻った扱いにしない)
//   ④ 曲の時計の止まりは、直し方 smoothSongClock を入れていても、元の時計で数えている
//   ⑤ 足した数が、1曲ぶんの診断の行(stats)に入る大きさである
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9217;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

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

const run = async () => {
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
  const open = async (ua) => {
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, ...(ua ? { userAgent: ua } : {}) });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    // 通信を差し替えたので、ゲーム側の「自動操作では書き込まない」止めを外す(26-supabase.jsx)
    await page.addInitScript(() => { window.__mhSupabaseStubbed = true; });
    await page.evaluate(() => { window.__mhSupabaseStubbed = true; }).catch(() => {});
    await page.route('**/rest/v1/**', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: '[]' }));
    // 助手のおしゃべりの中継(Edge Function)も本物へ届けない。差し替えが無いと本物の中継が AI を呼ぶ(2026-10-27)
    await page.route('**/functions/v1/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.addInitScript(seed);
    // 起動直後に流れるお話(きゅうこの加入など)は見たことにする(2026-10-23 きゅうこの公開で、お話が画面を覆って止まった)
    await page.addInitScript(require('../boot/quiet-boot-seed').eventStorySeed());
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    // 入るとまずモードえらび(2026-10-03)。出ていたらソロライブを押して曲えらびへ
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
    // モンヒロビートは入るとまずモードえらび(2026-10-03)。出ていたらソロライブを押して曲えらびへ
    await page.waitForSelector('[data-rhythm-mode-solo],[data-rhythm-demo-start],[data-rhythm-demo-home]',{timeout:30000}).catch(()=>{});await page.evaluate(()=>document.querySelector('[data-rhythm-mode-solo]')?.click());
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|閉じる'))) break; await page.waitForTimeout(300); }
    await page.evaluate(() => document.querySelector('[data-rhythm-demo-start]').click());
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForTimeout(6500);
    // 入力になった回数を数える(指の番号つき)
    await page.evaluate(() => {
      window.__inputs = [];
      const orig = RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget;
      RHYTHM_TOUCH_SPAN_RUNTIME.recordPhysicalTarget = function (key) { if (!RHYTHM_TOUCH_SPAN_RUNTIME.isSyntheticTapKey(key)) window.__inputs.push(String(key)); return orig.apply(this, arguments); };
      const a = document.querySelector('[data-rhythm-play-area]'), r = a.getBoundingClientRect(), l = document.querySelector('[data-rhythm-judgment-line]'), lr = l ? l.getBoundingClientRect() : null;
      const y = lr ? lr.top + lr.height / 2 : r.top + r.height * .8;
      const mk = (id, fx) => new Touch({ identifier: id, target: a, clientX: r.left + r.width * fx, clientY: y, radiusX: 1, radiusY: 1 });
      // 指の一覧(touches)と、その合図で変わった指(changed)を、番号と横の位置で渡す
      window.__send = (type, touches, changed) => a.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: touches.map(t => mk(t[0], t[1])), targetTouches: touches.map(t => mk(t[0], t[1])), changedTouches: changed.map(t => mk(t[0], t[1])) }));
    });
    return page;
  };
  const scenario = async (page) => page.evaluate(async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const A = [101, .3], B = [102, .6], C = [103, .45], D = [104, .75];
    window.__inputs.length = 0; RHYTHM_TOUCH_BRIDGE.reset();
    __send('touchstart', [A], [A]); await wait(60);                 // A を押す
    __send('touchstart', [B], [B]); await wait(60);                 // B の合図。指の一覧に A が居ない(離しの合図は来ていない)
    __send('touchmove', [A, B], [B]); await wait(60);               // A が一覧に戻る(自分の touchstart は無い)
    const afterBack = window.__inputs.slice();
    __send('touchmove', [A, B, C], [B]); await wait(60);            // C は一度も見えていなかった指
    const afterNew = window.__inputs.slice();
    __send('touchend', [A, C], [B]); await wait(30);
    __send('touchend', [C], [A]); await wait(30);                   // A は自分の離しの合図で消える
    __send('touchstart', [C, D], [D]); await wait(30);
    __send('touchmove', [A, C, D], [D]); await wait(60);            // A の番号が、別の合図の中に見える(離しの合図のあと)
    const afterOwnEnd = window.__inputs.slice();
    __send('touchend', [], [A, C, D]); await wait(30);
    return { afterBack, afterNew, afterOwnEnd, bridge: RHYTHM_TOUCH_BRIDGE.snapshot() };
  });
  try {
    // ① iPhone
    const ios = await open(IPHONE);
    check('前提: iPhone と見分けている', await ios.evaluate(() => rhythmTouchPlatform()) === 'ios');
    const r1 = await scenario(ios);
    const count = (list, id) => list.filter(k => k === `touch:${id}`).length;
    check('① iPhone: 一覧から消えて戻った指は、入力にしない', count(r1.afterBack, 101) === 1 && count(r1.afterBack, 102) === 1, JSON.stringify(r1.afterBack));
    check('① iPhone: 一度も見えていなかった指は、今までどおり入力にする', count(r1.afterNew, 103) === 1, JSON.stringify(r1.afterNew));
    check('③ 自分の離しの合図で消えた指の番号は、戻った扱いにしない(入力にする)', count(r1.afterOwnEnd, 101) === 2, JSON.stringify(r1.afterOwnEnd));
    check('① 数が残る(戻った1・押した扱いにしなかった1・touchmove で見えた2)', r1.bridge.lsBack === 1 && r1.bridge.lsBackGuard === 1 && r1.bridge.lsByMove === 2 && r1.bridge.lateStart === 3, JSON.stringify(r1.bridge));
    // ④ 曲の時計: 直し方を入れても、止まりは元の時計で数える
    const clock = await ios.evaluate(async () => {
      const seen = []; const orig = RHYTHM_TIMING_DIAG.frame;
      RHYTHM_TIMING_DIAG.frame = function (shown, raw) { if (seen.length < 400) seen.push([shown, raw]); return orig.apply(this, arguments); };
      await new Promise(r => setTimeout(r, 700));
      const plain = seen.splice(0);
      rhythmTouchFixSetOverride('smoothSongClock', true);
      await new Promise(r => setTimeout(r, 900));
      const smooth = seen.splice(0);
      rhythmTouchFixSetOverride('smoothSongClock', null);
      RHYTHM_TIMING_DIAG.frame = orig;
      return { plain, smooth, snap: RHYTHM_TIMING_DIAG.snapshot() };
    });
    check('④ 毎コマ、元の時計も診断へ渡している', clock.plain.length > 10 && clock.plain.every(([s, r]) => Number.isFinite(r) && Math.abs(s - r) < .001), `${clock.plain.length}コマ`);
    const differ = clock.smooth.filter(([s, r]) => Number.isFinite(r) && Math.abs(s - r) > .001).length;
    check('④ 直し方を入れると画面の時計はなめらかになるが、診断には元の時計が渡る', clock.smooth.length > 10 && differ > clock.smooth.length * .3 && clock.smooth.every(([s, r]) => Number.isFinite(r) && Math.abs(s - r) < 60), `${differ}/${clock.smooth.length}コマで値が違う`);
    check('④ 診断に、元の時計の止まり(stalls)と画面の時計の止まり(stallsShown)の両方がある', Number.isFinite(clock.snap.stalls) && Number.isFinite(clock.snap.stallsShown));
    // ⑤ 大きさ
    const size = await ios.evaluate(() => JSON.stringify({ ...RHYTHM_TOUCH_BRIDGE.snapshot(), timing: RHYTHM_TIMING_DIAG.snapshot() }).length);
    check('⑤ 突き合わせと時刻の診断を足しても 1KB ほど(行の上限は 4KB)', size < 1300, `${size}文字`);
    await ios.close();
    // ② Android
    const android = await open(null);
    check('前提: iPhone ではないと見分けている', await android.evaluate(() => rhythmTouchPlatform()) !== 'ios');
    const r2 = await scenario(android);
    check('② Android: 一覧から消えて戻った指は、今までどおり入力にする(数だけ残す)', count(r2.afterBack, 101) === 2 && r2.bridge.lsBack === 1 && r2.bridge.lsBackGuard === 0, JSON.stringify({ inputs: r2.afterBack, lsBack: r2.bridge.lsBack, guard: r2.bridge.lsBackGuard }));
    await android.close();
  } finally { await browser.close(); server.close(); }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};
run().catch((e) => { console.error(e); process.exit(1); });

// 演奏中、演奏エリアの外に触れた指でもブラウザの既定の動きを止めているかを、実際に開いて確かめる(2026-09-29)。
// ユーザー報告「iPhoneだけだと思うんだけど両手操作で連続押しとかしてるときにたまにタップがきかなくなる」。
//
//   node tools/mode/rhythm-ios-touch-guard-check.js
//
// 横持ちのiPhoneでは、ノッチとホームバーの余白が演奏エリアの外にある。そこへ触れた指を放っておくと、
// もう1本とそろったときに Safari が二本指のジェスチャー(ピンチ)と見て、全部の指を取り消す(touchcancel)ことがある。
// 見るもの:
//   ・演奏中、演奏エリアの外で触れた指の touchstart / touchmove を止める
//   ・ポーズボタンの上は止めない(iPhone は touchstart を止めると click が来なくなる)
//   ・Safari だけにある gesturestart / gesturechange を止める
//   ・ポーズ中と、演奏画面を出たあとは何も止めない(ポーズの中の操作や、ほかの画面のスクロールを邪魔しない)
//   ・デバッグの性能計測が、端末に指を取り消された回数・エリアの外に触れた回数・ジェスチャーの回数を数える
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 9198;
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', '🐣'); put('mh_intro_done', true); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_assistant_selected_v1', 'mua'); put('mh_assistant_unlock_seen_v1', true); put('mh_update_notice_seen_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true); put('mh_rhythm_play_defaults_restored_v1', true); put('mh_rhythm_six_lane_seen_v1', true);
  put('mh_inherited_unique_level_compensation_v1', true); put('mh_rhythm_look_intro_seen_v1', true);
};

// ページの中で、指定した要素へ合成のタッチ・ジェスチャーを送り、止められたか(defaultPrevented)を返す
const fire = (page, kind, selector) => page.evaluate(([kind, selector]) => {
  if (kind === 'gesturestart' || kind === 'gesturechange') {
    const ev = new Event(kind, { bubbles: true, cancelable: true });
    document.dispatchEvent(ev);
    return ev.defaultPrevented;
  }
  const el = selector === 'document' ? document.body : document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const touch = new Touch({ identifier: 900 + Math.floor(Math.random() * 1000), target: el, clientX: r.left + 2, clientY: r.top + 2 });
  const ev = new TouchEvent(kind, { bubbles: true, cancelable: true, touches: kind === 'touchend' || kind === 'touchcancel' ? [] : [touch], changedTouches: [touch] });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}, [kind, selector || '']);

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
    await page.addInitScript(seed);
    const clickText = (p) => page.evaluate((s) => { const rx = new RegExp(s); const x = [...document.querySelectorAll('button')].find((b) => rx.test((b.innerText || '').replace(/\s+/g, ' ').trim())); if (!x) return false; x.click(); return true; }, p);
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true, timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('モンヒロビート'), null, { timeout: 40000 });
    for (let i = 0; i < 6; i++) { if (!(await clickText('受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(250); }
    await clickText('モンヒロビート');
    await page.waitForSelector('[data-rhythm-demo-start]', { timeout: 30000 });
    for (let i = 0; i < 5; i++) { if (!(await clickText('^確認$|受け取る|閉じる|OK|とじる'))) break; await page.waitForTimeout(300); }

    // 曲えらび(演奏前)では止めない
    check('演奏前(曲えらび)は、画面の外側のタッチを止めない', (await fire(page, 'touchstart', 'document')) === false);

    await page.evaluate(() => { RHYTHM_PERF.setEnabled(false); document.querySelector('[data-rhythm-demo-start]').click(); });   // 計測OFFのままでも指の記録は数える
    await page.waitForSelector('[data-rhythm-play-area]', { timeout: 30000 });
    await page.waitForTimeout(6000);   // カウントダウンが終わって演奏が始まるまで
    await page.evaluate(() => RHYTHM_PERF.reset());

    check('演奏中、演奏エリアの外で触れた指の touchstart を止める', (await fire(page, 'touchstart', 'document')) === true);
    check('演奏中、演奏エリアの外で動かした指の touchmove を止める', (await fire(page, 'touchmove', 'document')) === true);
    check('演奏中、Safari の gesturestart を止める', (await fire(page, 'gesturestart')) === true);
    check('演奏中、Safari の gesturechange を止める', (await fire(page, 'gesturechange')) === true);
    check('ポーズボタンの上のタッチは止めない(click が来なくなるため)', (await fire(page, 'touchstart', '[data-rhythm-pause]')) === false);
    check('演奏エリアの中のタッチは、これまでどおり演奏エリアが止める', (await fire(page, 'touchstart', '[data-rhythm-play-area]')) === true);
    await fire(page, 'touchcancel', '[data-rhythm-play-area]');
    const stats = await page.evaluate(() => RHYTHM_PERF.snapshot().touch);
    check('性能計測が、端末に指を取り消された回数を数える', stats && stats.cancels === 1 && stats.cancelledTouches === 1, JSON.stringify(stats));
    check('性能計測が、演奏エリアの外に触れた回数を数える', stats && stats.outside === 2, JSON.stringify(stats));
    check('性能計測が、二本指ジェスチャーの回数を数える', stats && stats.gestures === 2, JSON.stringify(stats));
    check('性能計測が、演奏エリアで指が触れた数を数える', stats && stats.starts === 1 && stats.maxTouches === 1, JSON.stringify(stats));
    check('道の外（演奏エリアのすみ）に触れた指を「無視した」と数える', stats && stats.ignored === 1, JSON.stringify(stats));
    check('指の記録は、性能計測をOFFにしていても数える', stats && stats.starts >= 1);

    await page.evaluate(() => document.querySelector('[data-rhythm-pause]').click());
    await page.waitForTimeout(400);
    check('ポーズ中は、演奏エリアの外のタッチを止めない', (await fire(page, 'touchstart', 'document')) === false);
    check('ポーズ中は、gesturestart を止めない', (await fire(page, 'gesturestart')) === false);
    await page.close();
  } finally {
    await browser.close();
    server.close();
  }
  // 本体の配線(文字列)。止める範囲を広げすぎていないか
  const play = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/30-rhythm-play.jsx'), 'utf8');
  check('止めるのは演奏中だけ(ポーズ中・終わったあとは止めない)', /const playing=\(\)=>\{const run=runRef\.current;return !!run&&!run\.finished&&!run\.paused;\};/.test(play));
  check('ボタン・リンク・入力欄の上は止めない', play.includes(`target.closest('button,a,input,select,textarea,label,[role="button"]')`));
  check('外したときに、足したものを全部外す', /touchTypes\.forEach\(type=>document\.removeEventListener\(type,blockTouch/.test(play) && /gestureTypes\.forEach\(type=>document\.removeEventListener\(type,blockGesture/.test(play));
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

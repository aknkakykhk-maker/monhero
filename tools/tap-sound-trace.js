// 「TAP TO START を押した直後に一瞬別の音が鳴る」の調査用。
// タップからの音まわりの出来事を時系列で並べる。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node tap-sound-trace.js
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テストブリーダー'));
    localStorage.setItem('mh_intro_done', JSON.stringify(true));
  });
  await page.addInitScript(() => {
    window.__log = [];
    const t0 = () => Math.round(performance.now());
    const put = (what, detail) => window.__log.push({ t: t0(), what, detail: detail || '' });
    ['pointerdown', 'pointerup', 'click', 'touchstart', 'touchend'].forEach(type =>
      document.addEventListener(type, (e) => {
        const el = e.target;
        const btn = el && el.closest && el.closest('button');
        put('イベント:' + type, [
          el && el.tagName,
          'ボタン=' + (btn ? '「' + (btn.innerText || '').replace(/\s+/g, ' ').slice(0, 20) + '」' : 'なし'),
          ((el && el.innerText) || '').replace(/\s+/g, ' ').slice(0, 24),
        ].join(' / '));
      }, true));
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      put('audio.play()', (this.src || '').split('/').pop());
      return origPlay.call(this);
    };
    const origPause = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () {
      put('audio.pause()', (this.src || '').split('/').pop());
      return origPause.call(this);
    };
    // Web Audio側: ノードの生成と接続を記録する
    const proto = (window.AudioContext || window.webkitAudioContext).prototype;
    ['createMediaElementSource', 'createGain', 'createOscillator', 'createBufferSource'].forEach(name => {
      const orig = proto[name];
      if (!orig) return;
      proto[name] = function (...a) {
        put('WebAudio:' + name, name === 'createMediaElementSource' ? (a[0] && a[0].src || '').split('/').pop() : '');
        return orig.apply(this, a);
      };
    });
    const origResume = proto.resume;
    proto.resume = function () { put('ctx.resume() 開始', this.state); return origResume.call(this).then(r => { put('ctx.resume() 完了', this.state); return r; }); };
  });

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  // ここまでの記録は消して、タップ以降だけを見る
  await page.evaluate(() => { window.__log = []; window.__tap = performance.now(); });
  // 音を出す仕組み(Tone.js)側のSEも記録する
  await page.evaluate(() => {
    try {
      const se = (typeof Audio_ !== 'undefined') && Audio_.se;
      if (se) Object.keys(se).forEach(k => {
        const orig = se[k];
        se[k] = function (...a) { window.__log.push({ t: Math.round(performance.now()), what: 'SE:' + k, detail: '' }); return orig.apply(this, a); };
      });
    } catch (e) { window.__log.push({ t: 0, what: 'SEの記録に失敗', detail: String(e) }); }
  });

  const box = await page.getByRole('button', { name: 'TAP TO START' }).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(4000);

  const log = await page.evaluate(() => ({ log: window.__log, tap: window.__tap }));
  console.log('タップからの経過ミリ秒 / 出来事');
  log.log.forEach(e => console.log(`  ${String(Math.round(e.t - log.tap)).padStart(6)} ms  ${e.what}${e.detail ? '  (' + e.detail + ')' : ''}`));

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

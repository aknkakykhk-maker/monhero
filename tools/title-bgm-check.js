// タイトルBGMが「最初のタップだけで」鳴るかを確認する。
//
// PCのブラウザは自動再生の制限がゆるく、ユーザー操作から少し遅れて play() を呼んでも
// 鳴ってしまうため、そのままではiPhone等で起きる不具合を再現できない。
// そこで iOS と同じ厳しさを再現する:
//
//   ・音声のロックが外れるのは「ユーザー操作と同じ処理の流れの中で呼ばれた play()」だけ
//   ・await などで待ってから呼んだ play() は拒否される(NotAllowedError)
//   ・一度ロックが外れれば、以降は自由に鳴らせる
//
// この条件で「タップ → タイトルBGMが鳴る」ことを確かめる。
// 修正前は resume() の完了を待ってから play() を呼んでいたため、ここで拒否され、
// 次のタップ(=別ページへの移動)でようやく鳴り出す状態になっていた。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node title-bgm-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テストブリーダー'));
    localStorage.setItem('mh_intro_done', JSON.stringify(true));
  });
  // iOS相当の自動再生制限を再現する
  await page.addInitScript(() => {
    window.__audio = { unlocked: false, rejected: 0 };
    // iOSでは、ユーザー操作の最中に作ったAudioContextでも「止まった状態」から始まり、
    // resume() は音声スレッドとのやり取りぶんだけ実際に待たされる。
    // PCのChromiumは操作中に作れば即座に動き出すため、そのままでは不具合を再現できない。
    // ここで state と resume() を差し替えて、iOSと同じ「止まった状態から始まり、
    // 再開には一呼吸かかる」挙動にする(実際の音は本物のcontextで鳴らす)
    const ACProto = (window.AudioContext || window.webkitAudioContext).prototype;
    // state/resume は AudioContext ではなく BaseAudioContext 側に定義されているので、
    // プロトタイプの鎖をたどって本物を探す
    const findDesc = (name) => {
      for (let p = ACProto; p; p = Object.getPrototypeOf(p)) {
        const d = Object.getOwnPropertyDescriptor(p, name);
        if (d) return d;
      }
      return null;
    };
    const stateDesc = findDesc('state');
    const suspended = new WeakSet();
    const seen = new WeakSet();
    Object.defineProperty(ACProto, 'state', {
      configurable: true,
      get() {
        if (!seen.has(this)) { seen.add(this); suspended.add(this); }
        return suspended.has(this) ? 'suspended' : stateDesc.get.call(this);
      },
    });
    const origResume = findDesc('resume').value;
    ACProto.resume = function () {
      const self = this;
      return new Promise((resolve) => setTimeout(() => {
        suspended.delete(self);
        try { origResume.call(self).then(resolve, resolve); } catch (e) { resolve(); }
      }, 0));
    };
    // window.event は「イベントを配る処理が動いている最中」だけ値が入る。
    // await をひとつでも挟むと null に戻るので、「操作と同じ流れの中で呼ばれたか」を
    // これで判定できる(iOSの自動再生制限とほぼ同じ条件になる)
    const inGesture = () => {
      const e = window.event;
      return !!e && /^(pointerdown|pointerup|touchstart|touchend|mousedown|mouseup|click)$/.test(e.type);
    };
    const origPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      const a = window.__audio;
      const g = inGesture();
      if (!a.unlocked && !g) {
        a.rejected++;
        return Promise.reject(new DOMException('play() は操作の直後ではないので拒否されました', 'NotAllowedError'));
      }
      if (g) a.unlocked = true;
      (a.calls = a.calls || []).push({ src: (this.src||'').split('/').pop(), ev: (window.event && window.event.type) || null, g });
      return origPlay.call(this);
    };
  });

  const playing = () => page.evaluate(() => [...document.querySelectorAll('audio')]
    .filter(a => !a.paused).map(a => (a.src || '').split('/').pop()));
  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText.replace(/\s+/g, ' ') : ''));
  const clickText = async (src) => page.evaluate((s) => {
    const rx = new RegExp(s);
    const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (!b) return false;
    b.click();
    return true;
  }, src);

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  check('事前ロードが終わり「TAP TO START」が出る', true);
  check('タップ前は鳴っていない', (await playing()).length === 0);

  // 実際のタップ(信頼できるイベント)で開始する
  const btn = page.getByRole('button', { name: 'TAP TO START' });
  await btn.click({ force: true });

  // タイトルBGMが鳴り出すまで待つ(最大6秒)
  let titleOk = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    if ((await playing()).some(s => s === 'bgm-title.mp3')) { titleOk = true; break; }
  }
  const state = await page.evaluate(() => window.__audio);
  if (process.env.DEBUG_BGM) {
    console.log('  play() 呼び出し:', JSON.stringify(state.calls));
    console.log('  audio要素:', JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('audio')].map(a => ({ src: (a.src||'').split('/').pop(), paused: a.paused, ready: a.readyState })))));
  }
  check('タップだけでタイトルBGMが鳴る(他ページへ移動しなくてよい)', titleOk, `拒否された再生 ${state.rejected}回`);
  check('タイトル画面が表示されている', (await bodyText()).includes('Monster Hero'));

  // 別ページへ行って戻ってきても、タイトルBGMに戻る
  if (await clickText('プロフィール')) {
    await page.waitForTimeout(2000);
    const p = await playing();
    check('プロフィールでプロフィールBGMに切り替わる', p.some(s => s === 'bgm-profile.mp3'), p.join(',') || '(無音)');
    // プロフィールからトップへ戻るボタンは矢印アイコンだけなので、文字では探せない
    await page.evaluate(() => { const b = document.querySelector('button.p-3.text-slate-400'); if (b) b.click(); });
    await page.waitForTimeout(2500);
    const t = await playing();
    check('タイトルへ戻るとタイトルBGMに戻る', t.some(s => s === 'bgm-title.mp3'), t.join(',') || '(無音)');
  }

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(__dirname, 'out', 'title-bgm-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

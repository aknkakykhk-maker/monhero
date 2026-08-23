// BGM(audio/のmp3)が実際に鳴っているかを、実ブラウザのWeb Audioそのもので確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node tools/audio/bgm-check.js
//
// ★このツールは2026年8月に作り直した。
//   以前は document.querySelectorAll('audio') を見ていたが、BGMは2026年7月に
//   HTMLAudioElementをやめてfetch → decodeAudioData → AudioBufferSourceNode へ移行している
//   (iOSの消音スイッチを尊重するため。docs/KNOWN_ISSUES.md の KI-006)。
//   そのため <audio> は1つも存在せず、空配列に対する every() が素通りして
//   「7/13項目が成功」のように一部OKを返しながら、実際には何も観測していなかった。
//   いまは AudioContext / AudioBufferSourceNode を差し替えて、
//   「どのmp3がデコードされ、どれが鳴り始め、そのときAudioContextが動いていたか」を直接見る。
//
// Chromiumは --autoplay-policy=no-user-gesture-required を付けると自動再生を許可するので、
// タップを介さずに再生状態を観測できる。実機ではタップ後に鳴り始める。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const AUDIO_BASE = PAGE_URL.replace(/index\.html$/, 'audio/');
const ICHIKA = ['bgm-home-ichika.mp3', 'bgm-battle-ichika.mp3', 'bgm-boss-ichika.mp3', 'bgm-clear-ichika.mp3'];
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// ページの中でWeb Audioを差し替えて、鳴った/デコードした記録を残す。
// 本体のコードには一切触らず、ブラウザ側のAPIだけを包む
const INSTRUMENT = () => {
  const log = { decoded: [], decodeErrors: [], events: [], resumes: [] };
  window.__bgm = log;
  const urlByBytes = new Map();
  const urlByBuffer = new WeakMap();
  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const url = String(args[0] && args[0].url ? args[0].url : args[0]);
    const p = origFetch.apply(this, args);
    if (/\.mp3(\?|$)/.test(url)) {
      p.then((res) => { try { res.clone().arrayBuffer().then((b) => urlByBytes.set(b.byteLength, url.split('/').pop())).catch(() => {}); } catch (e) {} }).catch(() => {});
    }
    return p;
  };
  const AC = window.AudioContext || window.webkitAudioContext;
  // 本体が作ったAudioContextの実物を掴んでおく(止める/再開させる検査で使う)
  const Wrapped = function () { const ctx = new AC(); window.__lastCtx = ctx; return ctx; };
  Wrapped.prototype = AC.prototype;
  window.AudioContext = Wrapped;
  const origDecode = AC.prototype.decodeAudioData;
  AC.prototype.decodeAudioData = function (data, ok, ng) {
    const bytes = data && data.byteLength;
    const hit = (buf) => {
      try {
        urlByBuffer.set(buf, urlByBytes.get(bytes) || ('bytes:' + bytes));
        log.decoded.push({ url: urlByBytes.get(bytes) || null, bytes, sec: +buf.duration.toFixed(1), sr: buf.sampleRate, ch: buf.numberOfChannels });
      } catch (e) {}
    };
    const miss = (err) => { log.decodeErrors.push({ url: urlByBytes.get(bytes) || null, bytes, err: String((err && err.message) || err) }); };
    return origDecode.call(this, data, (buf) => { hit(buf); if (ok) ok(buf); }, (err) => { miss(err); if (ng) ng(err); });
  };
  const origResume = AC.prototype.resume;
  AC.prototype.resume = function () { log.resumes.push({ before: this.state, at: Date.now() }); return origResume.apply(this, arguments); };
  const BSN = window.AudioBufferSourceNode.prototype;
  const bufDesc = Object.getOwnPropertyDescriptor(BSN, 'buffer');
  Object.defineProperty(BSN, 'buffer', {
    configurable: true, enumerable: bufDesc.enumerable, get: bufDesc.get,
    set(value) { try { this.__url = urlByBuffer.get(value) || null; } catch (e) {} return bufDesc.set.call(this, value); },
  });
  const origStart = BSN.start;
  BSN.start = function () {
    log.events.push({ t: 'start', url: this.__url || null, loop: !!this.loop, ctxState: this.context && this.context.state, at: Date.now() });
    return origStart.apply(this, arguments);
  };
  const origStop = BSN.stop;
  BSN.stop = function () {
    log.events.push({ t: 'stop', url: this.__url || null, at: Date.now() });
    return origStop.apply(this, arguments);
  };
};

// ダイアログの「×」で閉じる(BGMアレンジ画面に「閉じる」という文字のボタンは無い)
const closeDialog = (page) => page.evaluate(() => {
  const head = [...document.querySelectorAll('.mh-dialog-head')].pop();
  const b = head && head.querySelector('button');
  if (b) b.click();
  return !!b;
});
const clickByText = (page, text) => page.evaluate((t) => {
  const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes(t));
  if (b) b.click();
  return !!b;
}, text);

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => {
    localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
    localStorage.setItem('mh_se_volume', JSON.stringify(50));
    localStorage.setItem('mh_bgm_volume', JSON.stringify(50));
  });
  await page.addInitScript(INSTRUMENT);

  // 音声ファイルが実際に配信されているか(オリジナル・いちかの両方)
  for (const f of ['bgm-title-theme.mp3', 'bgm-title.mp3', 'bgm-battle.mp3', ...ICHIKA]) {
    const res = await page.request.head(AUDIO_BASE + f).catch(() => null);
    check(`audio/${f} が配信されている`, !!res && res.ok(), res ? `HTTP ${res.status()}` : '取得できず');
  }

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 }).catch(() => {});
  const startBtn = page.getByRole('button', { name: 'TAP TO START' });
  if (await startBtn.count()) await startBtn.click();
  await page.waitForTimeout(2500);

  const dump = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__bgm)));
  const started = (log, file) => log.events.filter((e) => e.t === 'start' && e.url === file);

  // --- ① オリジナルBGMが実際に鳴り始める ---
  let log = await dump();
  const title = started(log, 'bgm-title-theme.mp3');
  check('タイトルでオリジナルBGMが鳴り始める', title.length >= 1,
    log.events.filter((e) => e.t === 'start').map((e) => e.url).join(',') || '再生開始なし');
  check('AudioContextが動いた状態で鳴らしている', title.every((e) => e.ctxState === 'running'),
    title.map((e) => e.ctxState).join(',') || '—');
  check('BGMはループ再生になっている', title.length >= 1 && title.every((e) => e.loop));
  check('HTMLAudioElementを1つも作っていない', (await page.evaluate(() => document.querySelectorAll('audio').length)) === 0);

  // --- ② いちか4曲のdecodeAudioDataが成功する ---
  //     BGMアレンジ画面を開き、4曲を順に試聴して本体の経路でデコードさせる
  const openArrangement = async () => {
    await clickByText(page, '設定');
    await page.waitForTimeout(600);
    const ok = await clickByText(page, 'BGMアレンジ');
    await page.waitForTimeout(800);
    return ok;
  };
  check('タイトルからBGMアレンジ画面を開ける', await openArrangement());

  // 「ホーム」の欄をいちかへ切り替えて試聴する
  const selectTrack = async (trackId) => page.evaluate((id) => {
    const sel = document.querySelector('select');
    if (!sel) return false;
    sel.value = id;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return sel.value === id;
  }, trackId);
  const tapPreview = async () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === '試聴' || x.textContent.trim() === '停止');
    if (b) b.click();
    return b ? b.textContent.trim() : null;
  });

  const previewOnce = async (trackId, file) => {
    await selectTrack(trackId);
    await page.waitForTimeout(200);
    const before = (await dump()).events.length;
    await tapPreview();
    await page.waitForTimeout(2500);
    const after = await dump();
    return { file, newEvents: after.events.slice(before), log: after };
  };

  const previews = [];
  for (const [trackId, file] of [['ichika_home', ICHIKA[0]], ['ichika_battle', ICHIKA[1]], ['ichika_boss', ICHIKA[2]], ['ichika_clear', ICHIKA[3]]]) {
    previews.push(await previewOnce(trackId, file));
    await tapPreview(); // 停止して次へ
    await page.waitForTimeout(700);
  }
  log = await dump();
  const decodedUrls = log.decoded.map((d) => d.url);
  for (const f of ICHIKA) {
    check(`いちか ${f} のdecodeAudioDataが成功する`, decodedUrls.includes(f),
      log.decodeErrors.filter((e) => e.url === f).map((e) => e.err).join(',') || (decodedUrls.includes(f) ? '' : 'デコード記録なし'));
  }
  check('デコードに失敗した曲が1つも無い', log.decodeErrors.length === 0,
    log.decodeErrors.map((e) => `${e.url}:${e.err}`).join(' / ') || 'エラーなし');

  // --- ③ BGMアレンジ画面からの試聴が実際に鳴る ---
  for (const p of previews) {
    const starts = p.newEvents.filter((e) => e.t === 'start' && e.url === p.file);
    check(`試聴で ${p.file} が鳴り始める`, starts.length >= 1,
      starts.length ? `AudioContext=${starts.map((e) => e.ctxState).join(',')}` : p.newEvents.map((e) => `${e.t}:${e.url}`).join(',') || '何も起きない');
    check(`試聴が動いているAudioContextで鳴る（無音にならない）`, starts.length >= 1 && starts.every((e) => e.ctxState === 'running'),
      starts.map((e) => e.ctxState).join(',') || '—');
  }

  // --- ④ 試聴を止めると元のBGMへ戻る ---
  const beforeBack = (await dump()).events.length;
  await selectTrack('ichika_home');
  await page.waitForTimeout(200);
  await tapPreview();
  await page.waitForTimeout(2000);
  await tapPreview(); // 停止
  await page.waitForTimeout(2000);
  const back = (await dump()).events.slice(beforeBack);
  check('試聴を止めると元のBGMへ戻る',
    back.some((e) => e.t === 'start' && e.url === ICHIKA[0]) && back.some((e) => e.t === 'stop')
    && back.filter((e) => e.t === 'start').some((e) => e.url === 'bgm-title-theme.mp3'),
    back.map((e) => `${e.t}:${e.url}`).join(' → ') || '記録なし');

  // --- ⑤ 何度試聴しても無音・二重再生にならない ---
  const beforeRepeat = (await dump()).events.length;
  for (let i = 0; i < 3; i++) {
    await tapPreview(); await page.waitForTimeout(1200);
    await tapPreview(); await page.waitForTimeout(900);
  }
  const rep = (await dump()).events.slice(beforeRepeat);
  const repStarts = rep.filter((e) => e.t === 'start' && e.url === ICHIKA[0]);
  const repStops = rep.filter((e) => e.t === 'stop');
  check('何度試聴しても毎回鳴り始める（無音にならない）', repStarts.length >= 3, `${repStarts.length}回`);
  check('試聴が二重に鳴らない（鳴らすたび前を止めている）', repStops.length >= repStarts.length - 1,
    `開始 ${repStarts.length}回 / 停止 ${repStops.length}回`);

  // --- ⑥ AudioContextが止められても再開できる ---
  check('BGMアレンジ画面を閉じられる', await closeDialog(page));
  await page.waitForTimeout(600);
  // 端末が省電力や音声フォーカスの奪い合いで止めた状態を、そのまま作る
  const suspended = await page.evaluate(async () => {
    const ctx = window.__lastCtx;
    if (!ctx) return 'context取得できず';
    await ctx.suspend();
    return ctx.state;
  }).catch(() => 'context取得できず');
  check('AudioContextを止めた状態を作れる', suspended === 'suspended', String(suspended));
  if (suspended === 'suspended') {
    const beforeResume = (await dump()).events.length;
    // 復帰にはユーザー操作が要る。画面のどこを押しても画面遷移してしまうので、
    // 画面の中身に影響しないキー入力で「操作した」状態を作る
    await page.keyboard.press('Shift');
    await page.waitForTimeout(2000);
    const state = await page.evaluate(() => window.__lastCtx && window.__lastCtx.state);
    const ev = (await dump()).events.slice(beforeResume);
    check('止まったあとタップすればAudioContextが再開する', state === 'running', String(state));
    // 止める前から鳴っていたソースは、再開すればそのまま鳴り続ける(onendedは起きない)。
    // 無音のまま終わらないこと＝「止められていない」か「鳴り直した」のどちらか
    check('再開後もBGMが鳴っている状態に戻る',
      state === 'running' && (ev.some((e) => e.t === 'start') || !ev.some((e) => e.t === 'stop')),
      ev.map((e) => `${e.t}:${e.url}`).join(',') || '停止も再開もなし(鳴り続けている)');
  }

  // --- ⑦ アレンジとして設定した曲が、その画面で実際に鳴る ---
  await openArrangement();
  await selectTrack('ichika_home'); // 先頭の欄は「ホーム」
  await page.waitForTimeout(300);
  await closeDialog(page);
  await page.waitForTimeout(800);
  const beforeScene = (await dump()).events.length;
  // タイトルを触るとゲームへ入る。ログインボーナスなどのダイアログは閉じて進む
  await page.mouse.click(195, 500);
  await page.waitForTimeout(3500);
  // 初回はログインボーナス・助手えらびを通ってからHOMEへ着く。
  // HOMEに着いたら、それ以上は触らない(案内を開いて別の画面へ行ってしまわないように)
  for (let i = 0; i < 8; i++) {
    const done = await page.evaluate(() => {
      const all = [...document.querySelectorAll('button')];
      if (all.some((x) => /バトル/.test(x.textContent) && !/れんしゅう/.test(x.textContent))) return 'home';
      const b = all.find((x) => x.textContent.includes('この子にする'))
        || all.find((x) => ['確認', '閉じる', 'とじる', 'OK'].includes(x.textContent.trim()));
      if (b) { b.click(); return 'clicked'; }
      return 'none';
    });
    await page.waitForTimeout(1500);
    if (done !== 'clicked') break;
  }
  await page.waitForTimeout(2500);
  const scene = (await dump()).events.slice(beforeScene).filter((e) => e.t === 'start');
  check('アレンジで選んだ曲がHOMEで実際に鳴る', scene.some((e) => e.url === ICHIKA[0]),
    scene.map((e) => e.url).join(',') || '再生開始なし');

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タイトルBGMが「最初のタップだけで」鳴るかを確認する。
//
// PCのブラウザは自動再生の制限がゆるく、ユーザー操作から少し遅れて音を出しても
// 鳴ってしまうため、そのままではiPhone等で起きる不具合を再現できない。
// そこで iOS と同じ厳しさを再現する:
//
//   ・AudioContext を動かせるのは「ユーザー操作と同じ処理の流れの中で呼ばれた resume()」だけ
//   ・await などで待ってから呼んだ resume() は効かず、止まったままになる
//   ・一度ロックが外れれば、以降は自由に鳴らせる
//
// この条件で「タップ → タイトルBGMが鳴る」ことを確かめる。
// 修正前は resume() の完了を待ってから鳴らし始めていたため、ここで止められ、
// 次のタップ(=別ページへの移動)でようやく鳴り出す状態になっていた。
//
// BGMは <audio> ではなく Web Audio で鳴らしているので、鳴っているかどうかは
// ゲーム側が出している window.__mhAudioDebug() から見る。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node audio/title-bgm-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_intro_done', true);
    // ★トップ画面まで進んだときに「はじめての設定」や助手えらびへ落ちないよう、
    //   済みの印もそろえる(名前だけではブリーダーのアイコン待ちで止まる)
    put('mh_breeder_icon', 'Mocchi');
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_masu_migrated', true);
    put('mh_kiki_intro_seen_v1', true);
    put('mh_momosuke_intro_seen_v1', true);
    put('mh_assistant_selected_v1', 'mua');
    put('mh_assistant_unlock_seen_v1', true);
    put('mh_update_notice_seen_v1', true);
    put('mh_rhythm_event_story_v1', ['monbeat_cup_2026_09']);
    put('mh_inherited_unique_level_compensation_v1', true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_masu_level_cap_compensation_notice_seen_v1', true);
  });
  // iOS相当の自動再生制限を再現する
  await page.addInitScript(() => {
    window.__audio = { unlocked: false, rejected: 0, calls: [] };
    // ★BGMは <audio> ではなく Web Audio(AudioBufferSourceNode)で鳴らしている。
    //   以前は HTMLMediaElement.play() を差し替えて「拒否された再生」を数えていたが、
    //   <audio> を1つも使わなくなったので何も捕まえられず、鳴っていなくても素通りしていた。
    //   iOSで実際に効く制限は「AudioContext を動かせるのは、ユーザー操作と同じ処理の
    //   流れの中で呼んだ resume() だけ」という形なので、そこを差し替えて再現する。
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
    // ロックが外れた context だけ、本物の state を見せる。
    // 外れるまでは何度読んでも「止まっている」と答える(iOSと同じ)。
    // PCのChromiumは操作中に作れば即座に動き出すため、そのままでは不具合を再現できない
    const unlockedCtx = new WeakSet();
    Object.defineProperty(ACProto, 'state', {
      configurable: true,
      get() { return unlockedCtx.has(this) ? stateDesc.get.call(this) : 'suspended'; },
    });
    // window.event は「イベントを配る処理が動いている最中」だけ値が入る。
    // await をひとつでも挟むと null に戻るので、「操作と同じ流れの中で呼ばれたか」を
    // これで判定できる(iOSの自動再生制限とほぼ同じ条件になる)
    const inGesture = () => {
      const e = window.event;
      return !!e && /^(pointerdown|pointerup|touchstart|touchend|mousedown|mouseup|click|keydown)$/.test(e.type);
    };
    const origResume = findDesc('resume').value;
    ACProto.resume = function () {
      const self = this;
      const g = inGesture();
      const a = window.__audio;
      a.calls.push({ ev: (window.event && window.event.type) || null, g });
      // 操作の流れから外れて呼ばれた resume() は、iOSでは効かない。
      // 例外にはならず「止まったまま」になるだけなので、ここでも同じ形にする
      if (!a.unlocked && !g) { a.rejected++; return Promise.resolve(); }
      a.unlocked = true;
      // iOSでは resume() は音声スレッドとのやり取りぶんだけ実際に待たされる
      return new Promise((resolve) => setTimeout(() => {
        unlockedCtx.add(self);
        try { origResume.call(self).then(resolve, resolve); } catch (e) { resolve(); }
      }, 0));
    };
  });

  // いま鳴っている曲は、ゲーム側が出している window.__mhAudioDebug() から見る
  // (Web Audio なので document.querySelectorAll('audio') では1つも見えない)。
  // 止まった context のまま start() を呼んでも音にはならないので、
  // ctxState が running のときだけ「鳴っている」と数える
  const playing = () => page.evaluate(() => {
    try {
      const d = window.__mhAudioDebug && window.__mhAudioDebug();
      if (!d || d.ctxState !== 'running') return [];
      return (d.playing || []).map((e) => String(e.src || ''));
    } catch (e) { return []; }
  });
  // 場面ごとに鳴るべき曲は、ゲーム側の既定(DEFAULT_BGM_ARRANGEMENT)から引く。
  // ファイル名(bgm-title.mp3 など)を検査へ書き写すと、既定を変えたときに黙って落ちる
  const expectedSrc = (scene) => page.evaluate((key) => {
    try { return (window.__mhAudioExpectedSrc && window.__mhAudioExpectedSrc(key)) || null; } catch (e) { return null; }
  }, scene);
  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText.replace(/\s+/g, ' ') : ''));
  // 起動画面だけは実機と同じ「指でのタップ」で操作する。
  // 指を離したときのclickがどこへ届くかを確かめたいので、本物の操作でなければ意味がない
  const tapText = async (src) => {
    const box = await page.evaluate((s) => {
      const rx = new RegExp(s);
      const b = [...document.querySelectorAll('button')].find(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, src);
    if (!box) return false;
    await page.touchscreen.tap(box.x, box.y);
    return true;
  };

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  check('事前ロードが終わり「TAP TO START」が出る', true);
  check('タップ前は鳴っていない', (await playing()).length === 0);

  // 起動画面のタップが、その下のトップ画面まで届いていないか調べるための記録。
  // 起動画面は指を触れた瞬間に閉じるので、指を離したときのclickは
  // 「指の位置にあるトップ画面の要素」に対して発生する。
  // 捨てられていれば、この window の listener までは届かない
  await page.evaluate(() => {
    window.__leaked = [];
    window.addEventListener('click', (e) => {
      const btn = e.target && e.target.closest && e.target.closest('button');
      window.__leaked.push(btn ? (btn.innerText || '').replace(/\s+/g, ' ').slice(0, 20) : '(ボタン以外)');
    });
  });

  // 実際のタップ(信頼できるイベント)で開始する
  await tapText('TAP TO START');

  // タイトルBGMが鳴り出すまで待つ(最大6秒)
  const titleSrc = await expectedSrc('title');
  let titleOk = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(500);
    const now = await playing();
    if (now.length && (!titleSrc || now.some(s => s === titleSrc))) { titleOk = true; break; }
  }
  const state = await page.evaluate(() => window.__audio);
  if (process.env.DEBUG_BGM) {
    console.log('  resume() 呼び出し:', JSON.stringify(state.calls));
    console.log('  音の状態:', JSON.stringify(await page.evaluate(() => { try { return window.__mhAudioDebug && window.__mhAudioDebug(); } catch (e) { return null; } })));
  }
  check('タップだけでタイトルBGMが鳴る(他ページへ移動しなくてよい)', titleOk,
    `${titleSrc ? '既定は ' + titleSrc + ' / ' : ''}効かなかった再開 ${state.rejected}回`);
  // ★タイトル画面かどうかは、そこにしか無い表示(PLAYER ID)で見る。
  //   「Monster Hero」は aria-label と画像のaltにしか無いので innerText には出てこない。
  //   BGMは画面の描き替えより先に鳴り出すので、ここで描き上がりを待つ
  await page.waitForFunction(() => !!document.querySelector('.mh-title-gate'), { timeout: 20000 }).catch(() => {});
  check('タイトル画面が表示されている', (await bodyText()).includes('PLAYER ID'));
  const leaked = await page.evaluate(() => window.__leaked || []);
  check('起動タップがトップ画面まで届かない(誤ってボタンを押さない)', leaked.length === 0, leaked.join(',') || 'なし');

  // ★以前はここで「プロフィールへ行って戻るとタイトルBGMに戻る」を見ていた。
  //   いまタイトルは起動時の1画面(bootPhase==='TITLE')で、あとから戻る道が無い。
  //   「場面が変わればBGMも切り替わる」を見る目的は、タイトル→トップ画面で果たせる
  const homeSrc = await expectedSrc('home');
  // ★このボタンは onClick ではなく onPointerDown で動く(user activation を
  //   逃がさないため)。click() では何も起きないので pointerdown を送る
  const entered = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="トップ画面へ進む"]');
    if (!b || b.disabled) return false;
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return true;
  });
  if (entered) {
    await page.waitForTimeout(2500);
    // ログインボーナス・ギフトなど、トップ画面に重なるものを閉じる。
    // 押すのは「重なりの中のボタン」だけ(本文で探すとHOMEのギフトを押して別の画面へ行く)
    for (let i = 0; i < 8; i++) {
      const closed = await page.evaluate(() => {
        const inOverlay = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) {
          const st = getComputedStyle(e); if (st.position === 'fixed' || Number(st.zIndex) > 1000) return true; } return false; };
        const b = [...document.querySelectorAll('button')]
          .find((x) => inOverlay(x) && /^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ|あとで)$/.test((x.innerText || '').trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(600);
      if (!closed) break;
    }
    let homeOk = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      if ((await playing()).some(s => s === homeSrc)) { homeOk = true; break; }
    }
    check('トップ画面へ進むとHOMEのBGMへ切り替わる', homeOk,
      `既定は ${homeSrc} / いま ${(await playing()).join(',') || '(無音)'}`);
  } else {
    check('トップ画面へ進むボタンがある', false, 'button[aria-label="トップ画面へ進む"] が押せません');
  }

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'title-bgm-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

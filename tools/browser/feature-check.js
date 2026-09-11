const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 実ブラウザでゲームを起動し、主要な画面と今回追加した機能が動くかを確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node browser/feature-check.js
//
// React本体はリポジトリに同梱しているので実際に描画まで到達できる。
// Tailwind(見た目)と全国ランキング(Supabase)は外部通信のため、
// 通信が塞がれた環境では見た目が崩れる/ランキングが空になるが、動作確認には支障がない。
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  // 初回起動はプロフィール(名前設定)から始まるため、名前を設定済みにしてトップから始める。
  // データは JSON 文字列で localStorage に入る(storeSet と同じ形式)
  // ★名前だけでは「はじめての設定」からやり直しになる(60-app.jsx の wasOnboarded 判定は
  //   名前とアイコンの両方を見る)。ほかの実ブラウザ検査と同じ顔ぶれをそろえる
  //   (tools/landscape-screens-check.js:51 と同じ)
  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_breeder_icon', '🐣');
    put('mh_intro_done', true);
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_assistant_selected_v1', 'mua');
    put('mh_assistant_unlock_seen_v1', true);
    put('mh_kiki_intro_seen_v1', true);
    put('mh_momosuke_intro_seen_v1', true);
    put('mh_rhythm_tutorial_seen_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
    put('mh_masu_level_cap_compensation_notice_seen_v1', true);
    // ★イベントの回想(週末ゲリラ杯)はHOMEへ着いた直後に全画面で流れる。
    //   見たことにしておかないと、以降の操作がすべてこの会話に吸われる
    put('mh_rhythm_event_story_v1', ['monbeat_cup_2026_09']);
    // 助手からの更新のお知らせ(絵つきで全画面に重なる)も見たことにしておく。
    // 一覧は data/changelog.js の assistantNotice.id なので、増えても拾えるよう
    // ページ側の availableUpdateNotices() から取れる全部を入れる
    put('mh_update_notice_seen_v1', true);
    put('mh_seen_update_notices_v1', []);
  });
  // ★告知のIDは data/changelog.js が持っていて、検査からは名前を決め打ちできない。
  //   ページが読めた時点で availableUpdateNotices() に聞いて、全部を既読にしておく
  //   (助手の告知そのものは tools/assistant/assistant-update-notice-check.js の担当)
  await page.addInitScript(() => {
    const seed = () => {
      try {
        if (typeof availableUpdateNotices !== 'function') return false;
        localStorage.setItem('mh_seen_update_notices_v1',
          JSON.stringify(availableUpdateNotices().map(n => n.id)));
        return true;
      } catch { return false; }
    };
    if (!seed()) {
      let tries = 0;
      const t = setInterval(() => { if (seed() || (tries += 1) > 200) clearInterval(t); }, 20);
    }
  });
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root') && document.getElementById('root').children.length > 0, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // 起動時の事前ロード画面が出るので、「TAP TO START」を押してゲーム本体へ進む
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 30000 }).catch(() => {});
  const startBtn = page.getByRole('button', { name: 'TAP TO START' });
  if (await startBtn.count()) { await startBtn.click(); await page.waitForTimeout(1200); }

  check('ゲームが描画される', true);
  check('起動時に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText : ''));

  // --- バージョン表示 ---
  // ★「TAP TO START」の先はHOMEではなくタイトル画面になった。バージョンはそこに出る。
  //   VERSION と日時は別々の要素なので innerText の連結には頼らず、印で拾う
  //   (以前は 'ver ' + BUILD_DATE をトップ画面の本文から探していたが、その表記はもう無い)
  const build = await page.evaluate(() => (typeof BUILD_DATE !== 'undefined' ? BUILD_DATE : ''));
  const titleBuild = await page.evaluate(() => {
    const el = document.querySelector('.mh-title-build');
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  });
  check('タイトルにバージョンが表示される',
    !!build && titleBuild.includes('VERSION') && titleBuild.includes(build), titleBuild || '(.mh-title-build が無い)');

  // タイトル画面からHOMEへ入る
  const toHome = page.getByRole('button', { name: 'トップ画面へ進む' });
  if (await toHome.count()) { await toHome.click({ timeout: 30000 }).catch(() => {}); await page.waitForTimeout(900); }
  // ログインボーナス・お知らせなど、HOMEに重なるものを閉じる
  for (let i = 0; i < 14; i += 1) {
    const did = await page.evaluate(() => {
      const inOverlay = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) {
        const st = getComputedStyle(e); if (st.position === 'fixed' || Number(st.zIndex) > 1000) return true; } return false; };
      const list = [...document.querySelectorAll('button')]
        .filter(b => inOverlay(b) && /^(確認|閉じる|とじる|OK|受け取る|つぎへ|次へ|わかった|はい|スキップ)$/.test((b.innerText || '').trim()));
      if (!list.length) return false; list[0].click(); return true;
    });
    if (!did) break;
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => !!document.querySelector('.mh-home-scene'), { timeout: 30000 }).catch(() => {});

  // --- 更新履歴 ---
  const changelogBtn = page.getByRole('button', { name: /更新/ }).first();
  const hasBtn = await changelogBtn.count() > 0;
  check('更新履歴ボタンがある', hasBtn);
  if (hasBtn) {
    // ★HOMEの未読の印は「NEW」の文字ではなく、赤い丸に「!」(aria-label="未読あり")。
    //   本文から 'NEW' を探す書き方は、印の見た目を変えたときに空振りしていた
    check('未読の印が出ている',
      await page.locator('.mh-home-update [aria-label="未読あり"]').count() > 0);
    await changelogBtn.click();
    await page.waitForTimeout(700);
    const open = await bodyText();
    check('更新履歴が開く', open.includes('更新履歴'));
    check('更新情報タブの内容が出る', open.includes('大型アップデート'));
    const issueTab = page.getByRole('button', { name: '不具合情報' }).first();
    if (await issueTab.count()) {
      await issueTab.click();
      await page.waitForTimeout(500);
      const issue = await bodyText();
      // ★「修正済み」は status:'fixed' を付けた項目だけに出る飾りで、
      //   最近の項目に無いと空振りする。タブが切り替わったことは
      //   「不具合情報タブにしか出ない種別の見出し」で見る
      //   (CHANGELOG_TYPE_LABELS の issue='調査中' / fix='不具合修正'、
      //    CHANGELOG_STATUS の fixed='修正済み' / investigating='調査中' / known='判明済み')
      check('不具合情報タブに切り替わる',
        /不具合修正|調査中|修正済み|判明済み/.test(issue), issue.slice(0, 60).replace(/\s+/g, ' '));
    } else check('不具合情報タブに切り替わる', false, 'タブが見つからない');
    // 閉じる
    const closeBtns = page.locator('button').filter({ hasText: '' });
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.closest('div') && x.querySelector('svg') && x.textContent.trim() === '');
      if (b) b.click();
    });
    await page.waitForTimeout(600);
    // 既読になったか(再度開かずstorageで確認)
    // ★既読は「日時1つ」から「タブごとのID一覧」へ変わった(mh_changelog_seen_ids_<タブ>)。
    //   旧キー mh_changelog_seen は移行のために読むだけで、もう書かれない
    const seen = await page.evaluate(() => ['update', 'issue']
      .map(type => localStorage.getItem(`mh_changelog_seen_ids_${type}`))
      .filter(Boolean));
    const seenIds = seen.flatMap(v => { try { return JSON.parse(v); } catch { return []; } });
    check('開いたら既読として保存される', seenIds.length > 0, `${seenIds.length}件`);
  }

  // --- 音量: 初期状態がオン(SE/BGMとも1)で、オフ→オンでも1に戻る ---
  // ★音量設定は設定画面の中にある。HOMEの「設定」を開いてからでないと見つからない
  const settingsBtn = page.getByRole('button', { name: '設定' }).first();
  if (await settingsBtn.count()) { await settingsBtn.click().catch(() => {}); await page.waitForTimeout(700); }
  const audioBtn = page.locator('button').filter({ hasText: '音量設定' }).first();
  if (await audioBtn.count()) {
    const label = (await audioBtn.innerText()).trim();
    check('初期状態で音がオンになっている', !label.startsWith('🔇'), label);
    await audioBtn.click();
    await page.waitForTimeout(600);
    // 設定パネルのスライダー横に出ている数値を読む
    const vols = () => page.evaluate(() => {
      // VolumeSlider が値を出しているspan(右寄せ・等幅)だけを拾う
      return [...document.querySelectorAll('span.w-6.text-right.font-mono')]
        .map((e) => e.textContent.trim()).slice(0, 2);
    });
    check('初期音量がSE/BGMとも1', JSON.stringify(await vols()) === '["1","1"]', JSON.stringify(await vols()));
    // ★ミュートの作りが変わった。以前は「オフ→オンで音量を1へ戻す」だったが、
    //   いまは mh_audio_muted の真偽だけを切り替え、**音量の設定はそのまま残す**
    //   (60-app.jsx の toggleQuickMute)。戻したときに自分で決めた音量が
    //   消えないほうが正しいので、そちらを見る
    // ★既定のままだと localStorage には書かれないので、保存値だけを見ると
    //   null→null で必ず通ってしまう(空振り)。画面に出ている数字で見る
    const beforeVols = await vols();
    const muteBtn = page.locator('button').filter({ has: page.locator('text=🔇') }).first();
    const clickMute = () => page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /🔇|🔊/.test(x.textContent || ''));
      if (!b) return false; b.click(); return true;
    });
    const hasMute = await clickMute();
    await page.waitForTimeout(500);
    const muted = await page.evaluate(() => localStorage.getItem('mh_audio_muted'));
    await clickMute();
    await page.waitForTimeout(500);
    const unmuted = await page.evaluate(() => localStorage.getItem('mh_audio_muted'));
    const afterVols = await vols();
    const norm = (v) => String(v).replace(/"/g, '');
    check('ミュートの切り替えが保存される', hasMute && norm(muted) === 'true' && norm(unmuted) === 'false',
      `切→${norm(muted)} / 入→${norm(unmuted)}`);
    check('ミュートしても音量の設定は消えない',
      beforeVols.length === 2 && JSON.stringify(beforeVols) === JSON.stringify(afterVols),
      `${JSON.stringify(beforeVols)}→${JSON.stringify(afterVols)}`);
    void muteBtn;
  } else check('音量設定を開ける', false, 'ボタンが見つからない');

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'feature-check.png'), fullPage: false });

  const ng = results.filter((r) => !r.ok);
  console.log(`\n${results.length - ng.length}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

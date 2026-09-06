// モンビーを開いたままクイック∞周回が続くこと(docs/spec/QUICK_RHYTHM_LINK.md PR4)を
// 実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/rhythm-background-run-check.js
//
// 見ているもの:
//   ① ∞周回中のバトル画面に「モンビーへ」の入口が出る
//   ② モンビーへ移っても周回が止まらない(WAVEかターンが進む)
//   ③ 敵を倒しても画面がバトルへ飛び戻らない
//   ④ モンビーからバトルへ戻れる(段階の続きから)
//
// 「止まらないこと」は静的検査では拾えない。条件式が正しくても動かないことがあるので、
// ここは必ず実ブラウザで見る。
// 「演奏中は止まる」「曲が終わると再開する」は、演奏を最後まで通す必要があり
// この環境では時間がかかりすぎるので、battle/run-stage-check.js の静的検査で押さえている
// (RHYTHM_PLAY を裏回しの対象へ入れていないこと・進行が止まること)。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 進んだかどうかを見る時間。×1速でもWAVEかターンのどちらかは必ず動く長さ
const WATCH_MS = 12000;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', (r) => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  const pointerDown = (find) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find((x) => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, find);
  const clickExact = (label) => page.evaluate((wanted) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText || '').trim() === wanted);
    if (b) b.click();
    return !!b;
  }, label);
  const clickMatching = (pattern) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find((x) => new RegExp(p).test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (b) b.click();
    return !!b;
  }, pattern);
  const clickSelector = (selector) => page.evaluate((s) => {
    const b = document.querySelector(s);
    if (b) b.click();
    return !!b;
  }, selector);
  const dismissOverlays = async () => {
    for (let i = 0; i < 12; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => /^(確認|受け取る|閉じる|とじる|OK)$/.test((x.innerText || '').trim()));
        if (b) { b.click(); return true; }
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) { (dialog.querySelector('button') || dialog).click(); return true; }
        return false;
      });
      if (!closed) break;
      await page.waitForTimeout(450);
    }
  };
  // WAVE と TURN は「ランがどこまで進んだか」の唯一の手がかり。
  // バトル画面を描いていないあいだは読めないので、いったんバトルへ戻してから読む
  const readProgress = () => page.evaluate(() => {
    const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
    return {
      turn: Number((text.match(/TURN\s*(\d+)/) || [])[1] || 0),
      wave: Number((text.match(/WAVE\s*(\d+)/) || [])[1] || 0),
    };
  });
  const onRhythmHome = () => page.evaluate(() => !!document.querySelector('[data-rhythm-demo-home]'));

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // クイックモードで1ラン始める
    await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('article')].find((a) => a.textContent.includes('クイックモード'));
      const b = card && [...card.querySelectorAll('button')].find((x) => /難易度を選ぶ/.test(x.textContent));
      b?.click();
    });
    await page.waitForTimeout(1300);
    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find((x) => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickMatching('勇者モンに選ぶ');
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300);
    await dismissOverlays();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickExact('習得する');
    await page.waitForTimeout(1800);

    // 一括実行だとブラウザが重く、待ち時間だけでは間に合わないことがある。
    // バトル画面(AUTOボタン)が出るまで待ってから先へ進む
    await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 25000 }).catch(() => {});
    // AUTO を ∞ まで回す(OFF → ON → ∞)
    const autoLabel = async () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
    for (let i = 0; i < 3 && (await autoLabel()) !== 'AUTO ∞'; i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(900);
    }
    check('クイックで∞周回を始められる', (await autoLabel()) === 'AUTO ∞', await autoLabel());

    // ---- ① 入口が出る ----
    const hasEntry = await page.evaluate(() => !!document.querySelector('[data-quick-to-rhythm]'));
    check('∞周回中のバトル画面にモンビーへの入口が出る', hasEntry);

    // ---- ② モンビーへ移っても周回が止まらない ----
    const before = await readProgress();
    await clickSelector('[data-quick-to-rhythm]');
    // openRhythmDemo は設定・記録の読み込みを待ってから画面を切り替える。
    // 助手の告知などが重なることもあるので、出るまで待ってから確かめる
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('モンビーへ移れる（周回を止めずに）', await onRhythmHome());
    await page.waitForTimeout(WATCH_MS);
    // ★このあいだに敵を何体か倒しているはず。倒したときの段階の切り替えで
    //   画面がバトルへ飛び戻らないことを確かめる。
    //   advanceRunStage が古い値を掴んでいると、ここでモンビーから追い出される
    //   (2026-09-06・ユーザー報告「モンビーを押すと一瞬で戻る」)
    check('敵を倒しても画面がバトルへ飛び戻らない', await onRhythmHome(),
      await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 60)));
    // いったんバトルへ戻して、進んだかどうかを読む
    await clickSelector('[data-rhythm-back]');
    await page.waitForTimeout(2000);
    const afterRhythm = await readProgress();
    // WAVE10のあと次の周へ入るとWAVEが1へ戻る。「減った」もまた進んだ証拠として数える
    const advancedInRhythm = afterRhythm.wave > before.wave || afterRhythm.turn > before.turn || afterRhythm.wave < before.wave;
    check('モンビーを開いているあいだも周回が進む', advancedInRhythm,
      `W${before.wave}/T${before.turn} → W${afterRhythm.wave}/T${afterRhythm.turn}`);
    check('モンビーからクイックのバトルへ戻れる', await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]')));

    // ---- ⑤ 超省エネでもモンビーへ行ける ----
    // 超省エネは画面ごと簡易表示へ差し替わる。入口を通常のバトル画面にしか置いていなかったため
    // 「超省エネではまだいけない」状態だった(2026-09-06・ユーザー報告)
    const ecoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.getAttribute('aria-label'));
    for (let i = 0; i < 4 && (await ecoLabel()) !== '省エネ 超'; i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.click());
      await page.waitForTimeout(700);
    }
    check('超省エネに切り替えられる', (await ecoLabel()) === '省エネ 超', await ecoLabel());
    check('超省エネの画面にもモンビーへの入口が出る',
      await page.evaluate(() => !!document.querySelector('[data-ultra-battle-view] [data-quick-to-rhythm]')));
    await clickSelector('[data-quick-to-rhythm]');
    await page.waitForFunction(() => !!document.querySelector('[data-rhythm-demo-home]'), { timeout: 15000 }).catch(() => {});
    await dismissOverlays();
    check('超省エネからモンビーへ移れる', await onRhythmHome());
    // 超省エネの暗幕はバトルを見ないためのもの。モンビーでは外れていないと譜面が暗くて遊べない
    check('モンビーでは超省エネの暗幕が外れている',
      await page.evaluate(() => !document.querySelector('[data-ultra-eco-session-dimmer]')));

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK（見た目の寸法はこの環境では測れないため未確認）`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

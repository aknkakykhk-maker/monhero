// クイックモードのAUTOが、実ブラウザで本当に進むことを確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/battle/auto-run-browser-check.js
//
// ラン進行のループは docs/spec/QUICK_RHYTHM_LINK.md の連携で作り替えていくところ。
// 静的検査(battle/run-stage-check.js)は「どの条件で回すか」しか見られないので、
// **実際にターンとWAVEが進むこと**はここで押さえる。
// 止まっていることは静的検査では気づけない(条件式は正しいのに動かない、が起こりうる)。
//
// このサンドボックスはTailwindのCDNへ出られないため、見た目(px)は再現できない。
// ここで見るのは進行だけで、実機での確認の代わりにはならない。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// AUTOを見張る時間。×1速でもWAVEかターンのどちらかは必ず動く長さにしてある
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
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  // クイックのBeginnerは同じ難易度のクリア記録で解放される
  put('mh_clears_Beginner', 3);
  put('mh_quick_clears_Beginner', 3);
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));
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
  // ログインボーナス・お詫び配布などの重なりは、押せるものが無くなるまで閉じる
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

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // HOME → バトル → クイックモードの難易度選択
    await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
    await page.waitForTimeout(1200);
    const openedQuick = await page.evaluate(() => {
      const card = [...document.querySelectorAll('article')].find((a) => a.textContent.includes('クイックモード'));
      const b = card && [...card.querySelectorAll('button')].find((x) => /難易度を選ぶ/.test(x.textContent));
      if (b) { b.click(); return true; }
      return false;
    });
    await page.waitForTimeout(1300);
    check('クイックモードの難易度選択を開ける', openedQuick);

    await clickMatching('この難易度で挑戦');
    await page.waitForTimeout(1500);
    // 勇者モン → 距離 → アシストカード
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

    const inBattle = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
    check('バトル画面へ入れる', inBattle);
    if (!inBattle) throw new Error('バトル画面へ入れませんでした');

    // AUTOをONにする(OFF → ON → ∞ の順に回るので1回押すとON)
    await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
    await page.waitForTimeout(900);
    const autoLabel = await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
    check('AUTOをONにできる', autoLabel === 'AUTO ON', autoLabel);

    // 見張っているあいだにターンかWAVEのどちらかが必ず動く
    const sample = () => page.evaluate(() => {
      const text = (document.body ? document.body.innerText : '').replace(/\s+/g, ' ');
      return {
        turn: Number((text.match(/TURN\s*(\d+)/) || [])[1] || 0),
        wave: Number((text.match(/WAVE\s*(\d+)/) || [])[1] || 0),
      };
    });
    const before = await sample();
    await page.waitForTimeout(WATCH_MS);
    const after = await sample();
    const advanced = after.wave > before.wave || after.turn > before.turn;
    check('AUTOでランが自動で進む', advanced, `W${before.wave}/T${before.turn} → W${after.wave}/T${after.turn}`);
    check('進行が止まっていない（WAVEかターンのどちらかが動く）', advanced);
    check('AUTO中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK（見た目の寸法はこの環境では測れないため未確認）`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

// AUTO∞(超省エネ)でバトル中の「🎵 BGM」を開いたときの振る舞いを実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/audio/auto-bgm-picker-browser-check.js
//
// 見ているもの:
//   ① 開いたまま周回が進む(止まらない)
//   ② 進んで画面が変わってもパネルは開いたまま(曲を選びきれる)
//   ③ 閉じられる／閉じたあとも進み続ける
//
// この2つは、2026-09-06 に**逆向きの報告を続けて受けた**ところ。
//   ・「敵を倒すと設定画面から戻されて曲を選ぶ時間がない」→ パネルを出し続ける形で直す
//   ・「超省エネでBGM選択中にオートが止まる」→ いちど進行も止めたが、放置で回すのに邪魔なので戻した
// 静的検査(audio/auto-bgm-runtime-picker-check.js)は条件式しか見られないので、
// 「開いたまま進み、しかも閉じない」の両立はここで実際に動かして確かめる。
const { chromium } = require('playwright');
const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 進んだかどうかを見る時間。×1速でもWAVEかターンのどちらかは必ず動く長さ
const WATCH_MS = 12000;
// 進んだかどうか。WAVE10のあと次の周へ入るとWAVEが1へ戻るので、
// 「減った」もまた進んだ証拠として数える(∞周回をまたぐと数字だけでは追えない)
const advanced = (before, after) => after.wave > before.wave || after.turn > before.turn || after.wave < before.wave;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };
const seed = () => {
  const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true); put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_rhythm_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro','Mocchi']);
  put('mh_clears_Beginner', 3); put('mh_quick_clears_Beginner', 3);
};
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = []; page.on('pageerror', e => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
  await page.addInitScript(seed);
  const pointerDown = (f) => page.evaluate((f) => {
    const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(f.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b;
  }, f);
  const clickMatching = (p) => page.evaluate((p) => {
    const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test((x.innerText||'').replace(/\s+/g,' ').trim()));
    if (b) b.click(); return !!b;
  }, p);
  const clickExact = (w) => page.evaluate((w) => {
    const b = [...document.querySelectorAll('button')].find(x => (x.innerText||'').trim() === w);
    if (b) b.click(); return !!b;
  }, w);
  const dismiss = async () => { for (let i=0;i<12;i++) {
    const c = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|とじる|OK)$/.test((x.innerText||'').trim()));
      if (b) { b.click(); return true; }
      const d = document.querySelector('[role="dialog"]'); if (d) { (d.querySelector('button')||d).click(); return true; }
      return false; });
    if (!c) break; await page.waitForTimeout(400); } };
  const progress = () => page.evaluate(() => {
    const t = (document.body?document.body.innerText:'').replace(/\s+/g,' ');
    return { turn:Number((t.match(/TURN\s*(\d+)/)||[])[1]||0), wave:Number((t.match(/WAVE\s*(\d+)/)||[])[1]||0) };
  });
  try {
    await page.goto(PAGE_URL, { waitUntil:'load', timeout:60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length>0, { timeout:60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout:40000 }).catch(()=>{});
    await pointerDown({ text:'TAP TO START' }); await page.waitForTimeout(2200);
    await pointerDown({ aria:'トップ画面へ進む' }); await page.waitForTimeout(2200);
    await dismiss();
    await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
    await page.waitForTimeout(1200);
    await page.evaluate(() => {
      const c = [...document.querySelectorAll('article')].find(a => a.textContent.includes('クイックモード'));
      const b = c && [...c.querySelectorAll('button')].find(x => /難易度を選ぶ/.test(x.textContent)); b?.click();
    });
    await page.waitForTimeout(1300);
    await clickMatching('この難易度で挑戦'); await page.waitForTimeout(1500);
    await page.evaluate(() => { [...document.querySelectorAll('article,button')].find(x => /スエゾー/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900);
    await clickMatching('勇者モンに選ぶ'); await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /近距離|中距離|零距離|遠距離/.test(x.textContent))?.click(); });
    await page.waitForTimeout(1300); await dismiss();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /新規習得/.test(x.textContent))?.click(); });
    await page.waitForTimeout(900); await clickExact('習得する'); await page.waitForTimeout(1800);
    const autoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.getAttribute('aria-label'));
    for (let i=0;i<3 && (await autoLabel())!=='AUTO ∞';i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click()); await page.waitForTimeout(900); }
    check('クイックで∞周回を始められる', (await autoLabel())==='AUTO ∞', await autoLabel());
    const ecoLabel = () => page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.getAttribute('aria-label'));
    for (let i=0;i<4 && (await ecoLabel())!=='省エネ 超';i++) {
      await page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.click()); await page.waitForTimeout(700); }
    check('超省エネに切り替えられる', (await ecoLabel())==='省エネ 超', await ecoLabel());

    const opened = () => page.evaluate(() => !!document.querySelector('[data-auto-bgm-picker]'));
    const before = await progress();
    await page.evaluate(() => document.querySelector('[data-auto-bgm-button]')?.click());
    await page.waitForTimeout(600);
    check('バトル中にBGM設定を開ける', await opened());
    await page.waitForTimeout(WATCH_MS);
    const during = await progress();
    // ★開いているあいだも進むこと。止めてしまうと、放置で回す超省エネの意味が薄れる
    check('BGM設定を開いているあいだも周回が進む', advanced(before, during),
      `W${before.wave}/T${before.turn} → W${during.wave}/T${during.turn}`);
    // ★進んで画面が変わってもパネルは開いたまま。ここが閉じると曲を選びきれない
    check('周回が進んでもBGM設定は開いたまま', await opened());

    await page.evaluate(() => { const p=document.querySelector('[data-auto-bgm-picker]');
      const x=p&&[...p.querySelectorAll('button')].find(b=>(b.innerText||'').trim()==='×'); x?.click(); });
    await page.waitForTimeout(600);
    check('BGM設定を閉じられる', !(await opened()));
    const closed = await progress();
    await page.waitForTimeout(WATCH_MS);
    const after = await progress();
    check('閉じたあとも周回が続く', advanced(closed, after),
      `W${closed.wave}/T${closed.turn} → W${after.wave}/T${after.turn}`);

    check('操作中に致命的なJSエラーが出ない', fatal.length===0, fatal.slice(0,2).join(' / '));
  } finally { await browser.close(); }

  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

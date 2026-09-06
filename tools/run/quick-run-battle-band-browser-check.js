// ∞周回の進捗の帯が、超省エネのバトル画面に実際に出て、動いて、
// ∞を切ると消える(=数えなおし)ことを実ブラウザで確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/run/quick-run-battle-band-browser-check.js
//
// 2026-09-07・ユーザー指示
//   「無限周回時の空いてるスペースにもモンビーの帯のように進捗状況を表示するようにしたい」
//   「止めるまでは増えてくけど止めたらリセットされるみたいな感じで」
//
// 静的検査(quick-run-battle-band-check.js)は「そう書いてあるか」しか見られないので、
// こちらで「本当に出るか・数字が動くか・切ると消えるか」を見る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const WATCH_MS = 14000;
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
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
      await page.waitForTimeout(400);
    }
  };
  // 帯の中身。数字は文字列のままではなく数として取り出す
  const readBand = () => page.evaluate(() => {
    const el = document.querySelector('[data-quick-run-battle-band]');
    if (!el) return null;
    const num = (sel) => {
      const n = el.querySelector(sel);
      if (!n) return null;
      const digits = (n.textContent || '').replace(/[^0-9]/g, '');
      return digits ? Number(digits) : 0;
    };
    return {
      text: (el.innerText || '').replace(/\s+/g, ' ').trim(),
      loops: (() => {
        const n = el.querySelector('[data-quick-run-battle-loops]');
        const m = n && (n.textContent || '').match(/(\d+)\s*周目/);
        return m ? Number(m[1]) : null;
      })(),
      wave: (() => {
        const n = el.querySelector('[data-quick-run-battle-loops]');
        const m = n && (n.textContent || '').match(/WAVE\s*(\d+)/);
        return m ? Number(m[1]) : null;
      })(),
      xp: num('[data-quick-run-battle-xp]'),
      gold: num('[data-quick-run-battle-gold]'),
    };
  });

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // ---- クイックで1ラン始める ----
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
    await page.waitForFunction(() => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 30000 }).catch(() => {});
    const reached = await page.evaluate(() => !!document.querySelector('button[aria-label^="AUTO"]'));
    check('バトル画面まで来られた', reached,
      reached ? '' : (await page.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 120))));

    // 周回していないうちは帯を出さない
    check('∞にする前は帯を出さない', (await readBand()) === null);

    // ---- ∞にする ----
    // ★AUTOを入れた瞬間からバトルが進むので、WAVEを倒して強化フェーズへ移ると
    //   AUTOボタンが一時的に消える。押すたびに「また出るまで待つ」ようにしないと、
    //   押せないまま回り切って ∞ にできない
    const waitAuto = () => page.waitForFunction(
      () => !!document.querySelector('button[aria-label^="AUTO"]'), { timeout: 25000 }).catch(() => {});
    const labelOf = (prefix) => page.evaluate((p) => document.querySelector(`button[aria-label^="${p}"]`)?.getAttribute('aria-label'), prefix);
    const autoLabel = () => labelOf('AUTO');
    for (let i = 0; i < 6; i++) {
      await waitAuto();
      if ((await autoLabel()) === 'AUTO ∞') break;
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(900);
    }
    // ★ラベルを見る前に必ずバトル画面へ戻るのを待つ。
    //   AUTOを入れると勝手に進むので、判定の瞬間にリザルトや強化の画面にいると
    //   AUTOボタンそのものが無く、undefined になってしまう
    await waitAuto();
    check('∞周回にできた', (await autoLabel()) === 'AUTO ∞', String(await autoLabel()));

    // ---- 省エネを「超」まで回す(OFF → 簡易 → 超) ----
    const ecoLabel = () => labelOf('省エネ');
    const waitEco = () => page.waitForFunction(
      () => !!document.querySelector('button[aria-label^="省エネ"]'), { timeout: 25000 }).catch(() => {});
    for (let i = 0; i < 6; i++) {
      await waitEco();
      if ((await ecoLabel()) === '省エネ 超') break;
      await page.evaluate(() => document.querySelector('button[aria-label^="省エネ"]')?.click());
      await page.waitForTimeout(900);
    }
    await waitEco();
    check('超省エネにできた', (await ecoLabel()) === '省エネ 超', String(await ecoLabel()));
    await page.waitForFunction(() => !!document.querySelector('[data-ultra-battle-view]'), { timeout: 25000 }).catch(() => {});
    check('超省エネの画面になっている',
      await page.evaluate(() => !!document.querySelector('[data-ultra-battle-view]')));

    // ---- ここからが本題 ----
    // 帯はバトル画面にいるあいだだけ出る。リザルトを挟んでいたら戻るまで待つ
    await page.waitForFunction(() => !!document.querySelector('[data-quick-run-battle-band]'), { timeout: 25000 }).catch(() => {});
    const first = await readBand();
    check('超省エネの画面に帯が出ている', !!first, first ? first.text.slice(0, 60) : 'なし');
    if (first) {
      // ここへ来るまでに1周終わっていることもあるので「1以上」で見る
      check('周回数を出している', Number.isFinite(first.loops) && first.loops >= 1, `${first.loops}周目`);
      check('WAVEを出している', Number.isFinite(first.wave), `WAVE ${first.wave}`);
      // 空いているところ(敵・味方の下)に置いていて、下のボタン帯には入っていない
      const placed = await page.evaluate(() => {
        const band = document.querySelector('[data-quick-run-battle-band]');
        const ally = document.querySelector('[data-ultra-ally-log]');
        const bgm = document.querySelector('[data-auto-bgm-button]');
        if (!band || !ally || !bgm) return null;
        const b = band.getBoundingClientRect(); const a = ally.getBoundingClientRect(); const g = bgm.getBoundingClientRect();
        return { belowAlly: b.top >= a.bottom - 1, aboveButtons: b.bottom <= g.top + 1, width: Math.round(b.width), height: Math.round(b.height) };
      });
      check('味方の下・ボタンの上（空いているところ）に置いている',
        !!placed && placed.belowAlly && placed.aboveButtons,
        placed ? `${placed.width}×${placed.height}px` : '測れず');

      // ---- 数字が積み上がるか ----
      await page.waitForTimeout(WATCH_MS);
      // 見に行った瞬間がリザルトや強化の画面だと帯が無いので、バトルへ戻るのを待つ
      await page.waitForFunction(() => !!document.querySelector('[data-quick-run-battle-band]'), { timeout: 25000 }).catch(() => {});
      const later = await readBand();
      check('しばらく回すと進捗が動く',
        !!later && (later.wave !== first.wave || later.loops > first.loops || later.xp > first.xp || later.gold > first.gold),
        later ? `WAVE ${first.wave}→${later.wave} / 経験値 ${first.xp}→${later.xp}` : 'なし');

      // ---- ∞を切ったら消える(=次に始めたら0から) ----
      await page.evaluate(() => document.querySelector('button[aria-label^="AUTO"]')?.click());
      await page.waitForTimeout(1500);
      check('∞を切ると帯が消える', (await readBand()) === null);
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

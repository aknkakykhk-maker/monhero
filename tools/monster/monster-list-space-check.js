// モンスターの一覧に、画面のどれだけの高さが使えているかを実ブラウザで測る。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/monster/monster-list-space-check.js
//
// 2026-09-07・ユーザー指摘
//   「モンスターの部分がメインなのに他でスペースを取りすぎて肝心なとこが窮屈で見にくい」
//
// 主役はモンスターの一覧なのに、その上の付帯情報(助手・タブ・セット名・説明・
// 合体のルール)が場所を取り、一覧が画面の3分の1しか残っていなかった。
//
// ★高さの実測はできない。一覧の器は Tailwind の flex-1 / min-h-0 / overflow-y-auto で
//   高さを決めているが、CDN が届かないのでどれも効かず、中身の高さのまま
//   縦へ伸びてしまう(実際に測ったら画面の16倍あった)。
//   そのかわり「一覧より前に出ている説明が、たたまれた状態で始まるか」は確実に分かる。
//   実際の詰まり具合は、本番の画面で見て確かめてもらう。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_monster_roster', ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol', 'Oboro', 'Mocchi']);
  put('mh_masu_mons', [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `test-${n}`, baseId: ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol'][n - 1],
    name: `テスト${n}`, bondXp: 4000 * n, colors: [], rebirthCount: 0, reincarnateCount: 0,
  })));
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
  const clickText = (pattern) => page.evaluate((p) => {
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

  try {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForTimeout(2200);
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2200);
    await dismissOverlays();

    // ---- モンスター編成 ----
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /M\/B管理|MB管理/.test(x.innerText || ''))?.click(); });
    await page.waitForTimeout(1400);
    await dismissOverlays();
    const openedRoster = await clickText('モンスター編成');
    if (openedRoster) {
      await page.waitForTimeout(1400);
      await dismissOverlays();
      // 説明とセット名がたたまれた状態で始まる(＝一覧がすぐ始まる)
      check('編成: 説明がたたまれている',
        await page.evaluate(() => {
          const el = document.querySelector('[data-screen-note="partyPick"]');
          return !!el && el.getBoundingClientRect().height <= 70;
        }));
      check('編成: セット名・コピーがたたまれている',
        await page.evaluate(() => !!document.querySelector('[data-party-set-edit-toggle][aria-expanded="false"]')));
    } else {
      console.log('（モンスター編成へ入れないので飛ばす）');
    }

    // ---- 合体(主を選ぶ) ----
    // 神殿から入る。ルールの箱が5行あって画面の3分の1を占めていた
    await page.evaluate(() => { [...document.querySelectorAll('button[aria-label]')].find(x => /戻る|ホーム/.test(x.getAttribute('aria-label') || ''))?.click(); });
    await page.waitForTimeout(1200);
    await dismissOverlays();
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(x => /神殿/.test(x.innerText || ''))?.click(); });
    await page.waitForTimeout(1400);
    await dismissOverlays();
    if (await clickText('合体')) {
      await page.waitForTimeout(1400);
      await dismissOverlays();
      const note = await page.evaluate(() => {
        const el = document.querySelector('[data-screen-note="fusion"]');
        if (!el) return null;
        return { open: el.querySelector('button')?.getAttribute('aria-expanded'), text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 40) };
      });
      check('合体: ルールがたたまれている', !!note && note.open === 'false', note ? `「${note.text}」` : 'ルールの箱が見つからない');
    } else {
      console.log('（合体へ入れないので飛ばす）');
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

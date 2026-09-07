// マスモンを並べる画面を実際に開いて、どれも同じカードで描かれているかを確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/monster/monster-card-browser-check.js
//
// 2026-09-07・ユーザー指示「各モンスター一覧の表示方法を統一してほしい」。
//
// 静的検査(monster-card-consistency-check.js)は「そう書いてあるか」しか見られない。
// こちらは神殿の各画面を順に開いて、本当にその部品が使われているかと、
// 説明がたたまれた状態で始まるかを見る。
//
// ★幅と高さの実測はできない。Tailwind の CDN がこのサンドボックスへ届かず、
//   grid-cols-3 が効かないのでカードは縦に積まれて画面いっぱいに広がってしまう
//   (実際に測ったら 216〜1262px とばらけた。実装ではなく環境の都合)。
//   そのかわり「同じ部品を通っているか」は確実に分かるので、そちらで見る。
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
  // 一覧に並ぶマスモンを用意する(絆Lvや凸は既定のまま)
  put('mh_masu_mons', [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `test-${n}`, baseId: ['Suezo', 'Golem', 'Tiger', 'Ham', 'Pixie', 'Monol'][n - 1],
    // 転生の回数を入れて、転生バッジが名前に重ならないかも見られるようにする
    // (2026-09-07・ユーザー指摘「3枚目 名前表示がおかしい」)
    name: `テスト${n}`, bondXp: 400 * n, colors: [], rebirthCount: 0, reincarnateCount: n % 2,
  })));
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
  // その画面に並んでいるカードを数える。
  // ★実際の見え方(幅・高さ)はここでは測れない。Tailwind の CDN が届かず
  //   grid-cols-3 が効かないので、カードは縦に積まれて画面いっぱいに広がってしまう。
  //   そのかわり「共通のカードを通っているか」は確実に分かる:
  //     ・名前の行に付く .mh-monster-card-name の数 ＝ 共通カードで描いた枚数
  //     ・器のボタンに MONSTER_CARD_STYLE(96px)が入っているか
  //
  // ★「バッジが名前に重なる」(2026-09-07・ユーザー指摘「3枚目 名前表示がおかしい」)も
  //   ここでは測れない。バッジは絵の枠の `relative` を基準に置いているが、その `relative` も
  //   Tailwind のクラスなので効かず、まったく別の場所へ飛んでしまう
  //   (実際に旧実装へ戻して測ったら、名前 y=2758 に対しバッジ y=842 と1900pxずれた)。
  //   そちらは monster-card-consistency-check.js が「絵の下へ絶対配置しないこと」で見る。
  const cards = () => page.evaluate(() => {
    const names = [...document.querySelectorAll('.mh-monster-card-name')];
    if (!names.length) return null;
    // 名前の行を持つカードの器(高さを直に指定しているもの)を数える
    const shells = names.map((el) => el.closest('[style*="96px"]')).filter(Boolean);
    return { count: names.length, shells: shells.length };
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

    // ---- 神殿の各画面をまわる ----
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /神殿/.test(x.innerText || ''));
      b?.click();
    });
    await page.waitForTimeout(1500);
    await dismissOverlays();
    const onTemple = await page.evaluate(() => /限界突破|転生|寄付/.test(document.body.innerText || ''));
    check('神殿を開ける', onTemple);

    const sizes = [];
    for (const [label, pattern] of [['限界突破', '限界突破'], ['転生', '^転生'], ['寄付', '寄付']]) {
      const opened = await clickText(pattern);
      if (!opened) { console.log(`（${label}の入口が見つからないので飛ばす）`); continue; }
      await page.waitForTimeout(1400);
      await dismissOverlays();
      const measured = await cards();
      check(`${label}: 共通のカードで並んでいる`, !!measured && measured.count > 0, measured ? `${measured.count}枚` : 'カードなし');
      if (measured) {
        // 名前の行を持つカードは、すべて共通の高さ指定の中にあること
        check(`${label}: すべてのカードが共通の器に入っている`, measured.shells === measured.count,
          `${measured.shells}/${measured.count}枚`);
        sizes.push({ label, ...measured });
      }
      // 説明はたたまれていて、いきなり全文が出ていないこと
      const note = await page.evaluate(() => {
        const el = document.querySelector('[data-screen-note]');
        if (!el) return null;
        return { height: Math.round(el.getBoundingClientRect().height), text: (el.innerText || '').replace(/\s+/g, ' ').slice(0, 40) };
      });
      if (note) {
        check(`${label}: 説明が1行にたたまれている`, note.height <= 70, `${note.height}px「${note.text}」`);
      }
      // 神殿へ戻る
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => (x.innerText || '').trim() === '' && x.querySelector('svg'));
        b?.click();
      });
      await page.waitForTimeout(1200);
      await dismissOverlays();
    }

    // ★画面をまたいでも同じ大きさか
    if (sizes.length >= 2) {
      check('どの画面も同じカードを通っている',
        sizes.every((s) => s.shells === s.count && s.count > 0),
        sizes.map((s) => `${s.label} ${s.shells}/${s.count}`).join(' / '));
    }

    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
  } finally {
    await browser.close();
  }

  const ng = results.filter((r) => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

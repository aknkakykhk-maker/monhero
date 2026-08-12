// ウンディーネ／ヤオビクニを実ブラウザで確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node mermaid-browser-check.js
//
// マーケットの6商品 → 購入 → 円盤石でモンスターが解放される → 4つのアイコンが
// プロフィール選択に並びプロフィールへ設定できる → 再読み込みしても残る、までを通しで見る。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// 再読み込みしても消えないよう、初回だけ入れる(上書きすると保存確認にならない)
const seed = () => {
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true);
  put('mh_gold', 99999);
  put('mh_breeder_points', 50);
};

// [商品名, マーケットのタブ, 購入ボタンのaria-label]
const MARKET_ITEMS = [
  ['ウンディーネのアイコン', 'アイコン', 'ウンディーネのアイコンを1ptで購入'],
  ['ウンディーネの円盤石アイコン', 'アイコン', 'ウンディーネの円盤石アイコンを1ptで購入'],
  ['ウンディーネの円盤石', '円盤石', 'ウンディーネの円盤石を1500ダイヤで購入'],
  ['ヤオビクニのアイコン', 'アイコン', 'ヤオビクニのアイコンを1ptで購入'],
  ['ヤオビクニの円盤石アイコン', 'アイコン', 'ヤオビクニの円盤石アイコンを1ptで購入'],
  ['ヤオビクニの円盤石', '円盤石', 'ヤオビクニの円盤石を1500ダイヤで購入'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
  await page.addInitScript(seed);

  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, f);
  const boot = async () => {
    await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await down({ text: 'TAP TO START' });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await down({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 8; i++) {
      const closed = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ/.test(x.textContent));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(700);
      if (!closed) break;
    }
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="マーケット"]'), { timeout: 30000 });
  };
  const clickAria = async (a) => {
    const ok = await page.evaluate((x) => { const b = document.querySelector(`button[aria-label="${x}"]`); if (b) b.click(); return !!b; }, a);
    await page.waitForTimeout(1200);
    return ok;
  };
  const clickText = async (t) => {
    const ok = await page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find(y => y.textContent.trim() === x); if (b) b.click(); return !!b; }, t);
    await page.waitForTimeout(1200);
    return ok;
  };
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

  await boot();

  // --- ① マーケットに6商品が並び、購入できる ---
  // マーケットは「アイコン」「円盤石」…のタブに分かれているので、タブごとに見る
  await clickAria('マーケット');
  const marketByTab = {};
  for (const tab of ['アイコン', '円盤石']) { await clickText(tab); marketByTab[tab] = await text(); }
  for (const [name, tab] of MARKET_ITEMS) check(`マーケットの「${tab}」に「${name}」がある`, marketByTab[tab].includes(name));

  for (const [name, tab, buyLabel] of MARKET_ITEMS) {
    await clickText(tab);
    const found = await page.evaluate((l) => {
      const b = document.querySelector(`button[aria-label="${l}"]`);
      if (!b) return 'ボタンなし';
      if (b.disabled) return '購入不可';
      b.scrollIntoView({ block: 'center' });
      b.click();
      return 'ok';
    }, buyLabel);
    await page.waitForTimeout(900);
    if (found !== 'ok') check(`「${name}」の購入ボタンを押せる`, false, found);
  }

  const store = await page.evaluate(() => ({
    icons: JSON.parse(localStorage.getItem('mh_market_icons') || '[]'),
    monsters: JSON.parse(localStorage.getItem('mh_unlocked_monsters') || '[]'),
  }));
  check('4つのブリーダーアイコンを購入して保存できる',
    ['undine_icon', 'undine_disc_icon', 'yaobikuni_icon', 'yaobikuni_disc_icon'].every(id => store.icons.includes(id)),
    JSON.stringify(store.icons));
  check('円盤石でウンディーネが解放される', store.monsters.includes('Undine'), JSON.stringify(store.monsters));
  check('円盤石でヤオビクニが解放される', store.monsters.includes('Yaobikuni'));

  // --- ② ベースモン一覧に出る ---
  await boot();
  await clickAria('M/B管理');
  await clickText('ベースモン一覧');
  const list = await text();
  check('ベースモン一覧を開けている', list.includes('ベースモン') && !list.includes('円盤石アイコン'), list.slice(0, 40));
  check('ベースモン一覧にウンディーネが出る', list.includes('ウンディーネ'));
  check('ベースモン一覧にヤオビクニが出る', list.includes('ヤオビクニ'));

  // --- ③ プロフィールアイコンに設定できる ---
  await boot();
  await clickAria('プロフィールを開く');
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /アイコンを選ぶ|✓ アイコン/.test(x.textContent))
      || [...document.querySelectorAll('button')].find(x => x.className.includes('rounded-full') && x.querySelector('img'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  const picker = await page.evaluate(() => {
    const modal = [...document.querySelectorAll('div')].find(d => d.textContent.includes('アイコンを選択') && d.querySelector('.grid'));
    if (!modal) return null;
    return [...modal.querySelectorAll('button')].map(b => b.querySelector('img')?.getAttribute('alt') || b.textContent.trim());
  });
  check('アイコン選択ダイアログが開く', Array.isArray(picker), String(picker));
  const hasIcon = (n) => Array.isArray(picker) && picker.includes(n);
  check('プロフィール選択にウンディーネのアイコンが並ぶ', hasIcon('ウンディーネのアイコン'), (picker || []).filter(l => /ウンディーネ|ヤオビクニ/.test(l)).join(' / '));
  check('プロフィール選択にウンディーネの円盤石アイコンが並ぶ', hasIcon('ウンディーネの円盤石アイコン'));
  check('プロフィール選択にヤオビクニのアイコンが並ぶ', hasIcon('ヤオビクニのアイコン'));
  check('プロフィール選択にヤオビクニの円盤石アイコンが並ぶ', hasIcon('ヤオビクニの円盤石アイコン'));

  // ウンディーネの円盤石アイコンを選ぶ(選んだ時点で保存される)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.querySelector('img')?.getAttribute('alt') === 'ウンディーネの円盤石アイコン');
    if (b) b.click();
  });
  await page.waitForTimeout(1200);
  const saved = await page.evaluate(() => localStorage.getItem('mh_breeder_icon'));
  check('プロフィールアイコンに設定できる', String(saved).includes('undine_disc_icon'), String(saved));

  // --- ④ 再読み込みしても残る ---
  await boot();
  const after = await page.evaluate(() => ({
    icon: localStorage.getItem('mh_breeder_icon'),
    icons: JSON.parse(localStorage.getItem('mh_market_icons') || '[]'),
    monsters: JSON.parse(localStorage.getItem('mh_unlocked_monsters') || '[]'),
  }));
  check('再読み込み後もアイコン設定が残る', String(after.icon).includes('undine_disc_icon'), String(after.icon));
  check('再読み込み後も購入状態が残る', after.icons.length >= 4 && after.monsters.includes('Undine') && after.monsters.includes('Yaobikuni'));
  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

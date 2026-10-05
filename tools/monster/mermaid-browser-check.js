// ウンディーネ／ヤオビクニを実ブラウザで確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node monster/mermaid-browser-check.js
//
// マーケットの6商品 → 購入 → 円盤石でモンスターが解放される → 4つのアイコンが
// プロフィール選択に並びプロフィールへ設定できる → 再読み込みしても残る、までを通しで見る。
const path = require('path');
let chromium;
try { ({ chromium } = require(path.join(__dirname, '..', 'node_modules', 'playwright'))); } catch { ({ chromium } = require('playwright')); }
// イベントのお話(閉幕とお礼など)は、ほかのブラウザ検査と同じく「見た扱い」にしてから始める(2026-09-27・マーケットでかぶさって止まっていた)
const { eventStorySeed } = require(path.join(__dirname, '..', 'boot', 'quiet-boot-seed'));

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
  // 円盤石は2026-09-28に150000ダイヤへ値上がりした。2体ぶん買えるだけ持たせる
  put('mh_gold', 999999);
  put('mh_breeder_points', 50);
};

// [商品名, マーケットのタブ, 購入ボタンのaria-label]
// アイコンは同じキャラを1つにまとめて売る(2026-10-03)。「ウンディーネのアイコン」を1つ買うと、円盤石アイコンも一緒に手に入る
const MARKET_ITEMS = [
  ['ウンディーネのアイコン', 'アイコン', 'ウンディーネのアイコンを1ptで購入'],
  ['ウンディーネの円盤石', '円盤石', 'ウンディーネの円盤石を150000ダイヤで購入'],
  ['ヤオビクニのアイコン', 'アイコン', 'ヤオビクニのアイコンを1ptで購入'],
  ['ヤオビクニの円盤石', '円盤石', 'ヤオビクニの円盤石を150000ダイヤで購入'],
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.addInitScript(eventStorySeed());

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
    // お知らせは何枚も続けて出る(ログインボーナス → ギフト → 更新 → 助手の解放のお知らせ)。
    // 助手の解放のお知らせは「次へ」で進み、ほかを閉じたあと少し遅れて出るので、2回続けて何も無いまで送る
    // (2026-09-27・「次へ」を押せずにマーケットを開けないまま止まっていた。battle-menu-browser-check と同じ閉じ方)
    let quiet = 0;
    for (let i = 0; i < 40 && quiet < 2; i++) {
      const closed = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        if (dialog) {
          const inner = [...dialog.querySelectorAll('button')];
          if (inner.length) { inner[inner.length - 1].click(); return true; }
        }
        const b = [...document.querySelectorAll('button')].find(x => /^(受け取る|閉じる|あとで|スキップ|次へ|確認|OK|今は見ない)$/.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(closed ? 500 : 900);
      quiet = closed ? 0 : quiet + 1;
    }
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="マーケット"]'), { timeout: 30000 });
  };
  const clickAria = async (a) => {
    const ok = await page.evaluate((x) => { const b = document.querySelector(`button[aria-label="${x}"]`); if (b) b.click(); return !!b; }, a);
    await page.waitForTimeout(1200);
    return ok;
  };
  const clickText = async (t) => {
    // M/B管理などのボタンは、名前の下に説明を添える形になった。全文か1行目(名前)が合えば押す
    const ok = await page.evaluate((x) => { const b = [...document.querySelectorAll('button')].find(y => y.textContent.trim() === x || ((y.innerText || '').split('\n')[0] || '').trim() === x); if (b) b.click(); return !!b; }, t);
    await page.waitForTimeout(1200);
    return ok;
  };
  const text = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

  await boot();

  // --- ① マーケットに6商品が並び、購入できる ---
  // マーケットは「ダイヤショップ」「ブリーダーP交換所」…の入口に分かれた(2026-09-22)。
  //   アイコン … ブリーダーP交換所(ポイントで交換) / 円盤石 … ダイヤショップの「円盤石」タブ
  // 売り場の中から別の売り場へは、見出しの「戻る」でマーケットの入口へ戻ってから入り直す
  await clickAria('マーケット');
  const openSection = async (tab) => {
    await page.evaluate(() => { const b = [...document.querySelectorAll('button[aria-label="戻る"]')].find(x => x.closest('.mh-screen-head')); if (b && !document.body.innerText.includes('ダイヤで購入')) b.click(); });
    await page.waitForTimeout(600);
    // 入口の名前は2行に分けて書いてある(「ダイヤ／ショップ」)ので、文字ではなく data-market-section で押す
    const entry = tab === 'アイコン' || tab === '円盤石アイコン' ? 'breeder' : 'diamond';
    await page.evaluate((e) => { const b = document.querySelector(`button[data-market-section="${e}"]`); if (b) b.click(); }, entry);
    await page.waitForTimeout(1000);
    // ブリーダーP交換所は「アイコン」「円盤石アイコン」のタブに分かれた(2026-10-01・マーケット全体をタブでそろえた)
    // 売り場を出入りしてもタブは覚えているので、毎回目的のタブを押す
    await clickText(tab);
  };
  const marketByTab = {};
  for (const tab of ['アイコン', '円盤石']) { await openSection(tab); marketByTab[tab] = await text(); }
  for (const [name, tab] of MARKET_ITEMS) check(`マーケットの「${tab}」に「${name}」がある`, marketByTab[tab].includes(name));
  check('円盤石アイコンは別の商品として並ばず、キャラのアイコンにまとまっている(「円盤石アイコン」のタブも無い)',
    !marketByTab['アイコン'].includes('ウンディーネの円盤石アイコン') && !marketByTab['アイコン'].includes('円盤石アイコン'));

  // 「詳細」で、まとめの中身(顔のアイコンと円盤石アイコン)を見られる
  await openSection('アイコン');
  const detailOpened = await page.evaluate(() => { const b = document.querySelector('button[aria-label="ウンディーネのアイコンの中身を見る"]'); if (b) b.click(); return !!b; });
  await page.waitForTimeout(700);
  const members = await page.evaluate(() => [...document.querySelectorAll('[data-market-icon-group-member]')].map(el => el.getAttribute('data-market-icon-group-member')));
  check('「詳細」でまとめの中身(ウンディーネの顔と円盤石アイコン)を見られる', detailOpened && members.join() === 'undine_icon,undine_disc_icon', members.join());
  await page.evaluate(() => { const d = document.querySelector('[data-market-icon-group]'); const b = d && [...d.closest('[role="dialog"]').querySelectorAll('button')].pop(); if (b) b.click(); });
  await page.waitForTimeout(500);
  for (const [name, tab, buyLabel] of MARKET_ITEMS) {
    await openSection(tab);
    const found = await page.evaluate((l) => {
      const b = document.querySelector(`button[aria-label="${l}"]`);
      if (!b) return 'ボタンなし';
      if (b.disabled) return '購入不可';
      b.scrollIntoView({ block: 'center' });
      b.click();
      return 'ok';
    }, buyLabel);
    await page.waitForTimeout(600);
    // 2026-09-28「ショップの作りを全部統一して」から、どの品も確認の窓を通して買う。窓の「購入する」を押す
    const confirmed = found === 'ok' ? await page.evaluate((n) => {
      const dialog = document.querySelector(`[role="dialog"][aria-label="${n}の購入"]`);
      const b = dialog && [...dialog.querySelectorAll('button')].find(x => (x.textContent || '').trim() === '購入する');
      if (!b) return '確認の窓なし';
      if (b.disabled) return '確認の窓で購入不可';
      b.click();
      return 'ok';
    }, name) : found;
    await page.waitForTimeout(900);
    if (confirmed !== 'ok') check(`「${name}」の購入ボタンを押せる`, false, confirmed);
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
    // プロフィールの顔の丸いボタン(aria-label付き)から、アイコン選びの窓(PickerSheet)が開く(2026-10に作り直し)
    const b = document.querySelector('button[aria-label="ブリーダーアイコンを変える"]')
      || [...document.querySelectorAll('button')].find(x => /アイコンを選ぶ|✓ アイコン/.test(x.textContent))
      || [...document.querySelectorAll('button')].find(x => x.className.includes('rounded-full') && x.querySelector('img'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  const picker = await page.evaluate(() => {
    const modal = document.querySelector('[data-picker-sheet="icon"]');
    if (!modal) return null;
    return [...modal.querySelectorAll('button[data-icon-option]')].map(b => b.querySelector('img')?.getAttribute('alt') || b.textContent.trim());
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

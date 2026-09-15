// ランキングに「いまの見た目」が出ることを、実ブラウザで通して確かめる。2026-09-16。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/breeder-profile-browser-check.js
//
// 記録(rankings)にはすべて**昔の見た目**を入れ、プロフィール表(breeder_profiles)だけに
// **いまの見た目**を置く。そのうえで、4つの場合が正しく分かれるかを見る。
//
//   ① IDが付いた記録 + その人が改名済み → IDで当たる。名前まで新しくなる
//   ② IDの無い古い記録 + 名前はそのまま  → 名前で当たる
//   ③ 同じ名前の人が2人いる             → **当てない**(他人の見た目を出さない)
//   ④ プロフィール表に居ない人           → 記録に写した値のまま
//
// あわせて「フレームを変えたその場で送っているか」も見る(遊ばなくても変わること)。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const RANKING_ROWS = [
  { user_name: 'むかしの名前',   hero: 'モッチー', party: [], score: 99999, level: 90, icon: 'Golem', breeder_id: 'bd-1' },
  { user_name: 'ずっと同じさん', hero: 'スエゾー', party: [], score: 88888, level: 80, icon: 'Golem' },
  { user_name: 'かぶり太郎',     hero: 'ゴーレム', party: [], score: 77777, level: 70, icon: 'Golem' },
  { user_name: 'しらない人',     hero: 'ライガー', party: [], score: 66666, level: 60, icon: 'Suezo' },
  // ★同じ人(bd-1)が別の名前でも記録を残している。改名の前後で2行あるのと同じ状態
  { user_name: 'べつの名前',     hero: 'モッチー', party: [], score: 55555, level: 95, icon: 'Golem', breeder_id: 'bd-1' },
];
// 絆Lv・総合力は rankings ではなく bond_levels から読む。
// ★bd-1 は「同じ個体(m-7)」を古い名前と新しい名前の2行で持っている(改名するとこうなる)
const BOND_ROWS = [
  { user_name: 'むかしの名前', individual_id: 'm-7', monster_id: 'Mocchi', mon_name: 'モッチー', bond_level: 70, icon: 'Golem', breeder_id: 'bd-1' },
  { user_name: 'べつの名前',   individual_id: 'm-7', monster_id: 'Mocchi', mon_name: 'モッチー', bond_level: 72, icon: 'Golem', breeder_id: 'bd-1' },
  { user_name: 'しらない人',   individual_id: 'm-8', monster_id: 'Suezo',  mon_name: 'スエゾー', bond_level: 50, icon: 'Suezo' },
];
const PROFILES = [
  { breeder_id: 'bd-1', user_name: 'いまの名前',    icon: 'Mocchi', profile_frame: 'rainbow' },
  { breeder_id: 'bd-9', user_name: 'ずっと同じさん', icon: 'Mocchi', profile_frame: 'blue' },
  { breeder_id: 'bd-2', user_name: 'かぶり太郎',    icon: 'Mocchi', profile_frame: 'gold' },
  { breeder_id: 'bd-3', user_name: 'かぶり太郎',    icon: 'Suezo',  profile_frame: 'pink' },
];

const seed = () => {
  const put = (k, v) => { if (localStorage.getItem(k) === null) localStorage.setItem(k, JSON.stringify(v)); };
  put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true); put('mh_masu_migrated', true);
};

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = []; const posts = []; const gets = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (method !== 'GET') { posts.push({ path: url.pathname, body: route.request().postData() }); return route.fulfill({ status: 201, body: '' }); }
    gets.push({ path: url.pathname, select: url.searchParams.get('select') || '' });
    if (url.pathname.endsWith('/breeder_profiles')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROFILES) });
    if (url.pathname.endsWith('/rankings')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RANKING_ROWS) });
    if (url.pathname.endsWith('/bond_levels')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOND_ROWS) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  }, f);
  const closeModals = async (n = 8) => {
    for (let i = 0; i < n; i++) {
      const c = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /^(確認|受け取る|閉じる|あとで|スキップ|つぎへ|OK)$/.test(x.textContent.trim()));
        if (b) b.click();
        return !!b;
      });
      await page.waitForTimeout(600);
      if (!c) break;
    }
  };

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await down({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await down({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(3000);
  await closeModals();

  // --- フレームを変えたその場で送っているか(遊ばなくても変わること) ---
  await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
  await page.waitForTimeout(1200);
  await closeModals(5);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('フレーム：'))?.click());
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('button[data-profile-frame-option="gold"]')?.click());
  await page.waitForTimeout(1200);
  const sent = posts.filter(x => x.path.endsWith('/breeder_profiles'));
  check('フレームを変えたその場で送る(遊ばなくても変わる)', sent.length > 0, `${sent.length}回`);
  const lastSent = sent.length ? JSON.parse(sent[sent.length - 1].body)[0] : null;
  check('送る中身は1人1行ぶんだけ(ID・名前・アイコン・フレーム)',
    !!lastSent && lastSent.profile_frame === 'gold' && typeof lastSent.breeder_id === 'string' && lastSent.breeder_id.length > 0
    && Object.keys(lastSent).sort().join(',') === 'breeder_id,icon,profile_frame,user_name',
    lastSent ? Object.keys(lastSent).join(',') : '(送っていない)');
  check('記録の側(rankings / bond_levels)へは書いていない',
    !posts.some(x => x.path.endsWith('/rankings') || x.path.endsWith('/bond_levels')),
    posts.map(x => x.path.split('/').pop()).join(',') || 'なし');

  // --- ランキングを開く ---
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる')?.click());
  await page.waitForTimeout(500);
  await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.querySelector('svg') && x.className.includes('text-slate-400')); if (b) b.click(); });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
  await page.waitForTimeout(1500);
  await page.evaluate(() => [...document.querySelectorAll('button')].find(x => /チャレンジモードのランキング/.test(x.textContent))?.click());
  await page.waitForTimeout(4500);

  const cards = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="score"]')].map(el => ({
    text: el.innerText.replace(/\s+/g, ' '),
    icon: el.querySelector('.mh-profile-avatar img')?.getAttribute('src')?.split('/').pop()?.split('?')[0] || 'なし',
    frame: [...el.querySelectorAll('.mh-profile-frame')].map(f => [...f.classList].find(c => c.startsWith('mh-profile-frame-') && c !== 'mh-profile-frame-ring'))[0] || 'なし',
  })));
  check('ランキングの一覧が出る', cards.length === 5, `${cards.length}件`);
  const at = (i) => cards[i] || { text: '', icon: '', frame: '' };

  check('① IDが合えば、改名していても「いまの見た目」で出る(名前も新しくなる)',
    at(0).text.includes('いまの名前') && !at(0).text.includes('むかしの名前')
    && at(0).icon === 'mocchi.png' && at(0).frame === 'mh-profile-frame-rainbow',
    `${at(0).icon} / ${at(0).frame}`);
  check('② IDの無い古い記録も、名前が1人に定まれば「いまの見た目」で出る',
    at(1).text.includes('ずっと同じさん') && at(1).icon === 'mocchi.png' && at(1).frame === 'mh-profile-frame-blue',
    `${at(1).icon} / ${at(1).frame}`);
  check('③ 同じ名前の人が2人いるときは当てない(他人の見た目を出さない)',
    at(2).text.includes('かぶり太郎') && at(2).icon === 'golem.png' && at(2).frame === 'なし',
    `${at(2).icon} / ${at(2).frame}`);
  check('④ プロフィール表に居ない人は、記録に写した値のまま',
    at(3).text.includes('しらない人') && at(3).icon === 'suezo.png' && at(3).frame === 'なし',
    `${at(3).icon} / ${at(3).frame}`);

  check('スコアは1プレイ1行のまま(まとめない)。同じ人の別の記録も「いまの見た目」で出る',
    at(4).text.includes('いまの名前') && at(4).icon === 'mocchi.png' && at(4).frame === 'mh-profile-frame-rainbow',
    `${at(4).icon} / ${at(4).frame}`);

  const rankingGets = gets.filter(g => g.path.endsWith('/rankings'));
  check('記録の取得でブリーダーIDも受け取っている(名前だけに頼らない)',
    rankingGets.length > 0 && rankingGets[0].select.includes('breeder_id'), rankingGets[0]?.select || '(GETなし)');
  check('プロフィール表は何度も読み直さない(間引いている)',
    gets.filter(g => g.path.endsWith('/breeder_profiles')).length <= 2,
    `${gets.filter(g => g.path.endsWith('/breeder_profiles')).length}回`);
  // --- 改名しても1行にまとまること(人を名前でなくIDで見分ける) ---
  // スコアのランキング画面からバトルのタブへ戻る。開いている画面によって
  // 「そのタブが押せる」まで戻る回数が違うので、押せるまで戻ってから押す
  const goBack = () => page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.querySelector('svg') && x.className.includes('text-slate-400'));
    if (b) b.click();
  });
  const clickTab = (t) => page.evaluate((label) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === label);
    if (!b) return false;
    b.click();
    return true;
  }, t);
  const openTab = async (label, kind) => {
    for (let i = 0; i < 4; i++) {
      if (await clickTab(label)) break;
      await goBack();
      await page.waitForTimeout(1500);
    }
    await page.waitForTimeout(4000);
    return page.evaluate((k) => [...document.querySelectorAll(`[data-ranking-kind="${k}"]`)].map(el => ({
      text: el.innerText.replace(/\s+/g, ' '),
      icon: el.querySelector('.mh-profile-avatar img')?.getAttribute('src')?.split('/').pop()?.split('?')[0] || 'なし',
      frame: [...el.querySelectorAll('.mh-profile-frame')].map(f => [...f.classList].find(c => c.startsWith('mh-profile-frame-') && c !== 'mh-profile-frame-ring'))[0] || 'なし',
    })), kind);
  };

  const breederRows = await openTab('ブリーダーLv', 'breeder');
  const bdRows = breederRows.filter(r => r.text.includes('いまの名前'));
  check('ブリーダーLv: 改名しても1人1行にまとまる(名前で分かれない)',
    bdRows.length === 1, `${bdRows.length}行 / 全${breederRows.length}行`);
  check('ブリーダーLv: 残るのは高いほうのレベル(いまの値)',
    bdRows.length === 1 && bdRows[0].text.includes('95'), bdRows[0]?.text || '(なし)');
  check('ブリーダーLv: まとめた行も「いまの見た目」で出る',
    bdRows.length === 1 && bdRows[0].icon === 'mocchi.png' && bdRows[0].frame === 'mh-profile-frame-rainbow',
    `${bdRows[0]?.icon} / ${bdRows[0]?.frame}`);
  check('ブリーダーLv: 古い名前の行は残らない',
    !breederRows.some(r => r.text.includes('むかしの名前') || r.text.includes('べつの名前')),
    breederRows.map(r => r.text.slice(0, 12)).join(' / '));

  const bondRows = await openTab('絆Lv', 'bond');
  const bondMine = bondRows.filter(r => r.text.includes('いまの名前'));
  check('絆Lv: 改名しても同じ個体は1行にまとまる',
    bondMine.length === 1, `${bondMine.length}行 / 全${bondRows.length}行`);
  check('絆Lv: 残るのは高いほうの絆Lv(いまの値)',
    bondMine.length === 1 && bondMine[0].text.includes('72'), bondMine[0]?.text?.slice(0, 40) || '(なし)');
  check('絆Lv: まとめた行も「いまの見た目」で出る',
    bondMine.length === 1 && bondMine[0].icon === 'mocchi.png' && bondMine[0].frame === 'mh-profile-frame-rainbow',
    `${bondMine[0]?.icon} / ${bondMine[0]?.frame}`);
  const bondGets = gets.filter(g => g.path.endsWith('/bond_levels'));
  check('絆Lvの取得でもブリーダーIDを受け取っている',
    bondGets.length > 0 && bondGets[0].select.includes('breeder_id'), bondGets[0]?.select || '(GETなし)');

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));

  await browser.close();
  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件のNGがあります`);
  process.exit(ng === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });

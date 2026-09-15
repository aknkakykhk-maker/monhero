// プロフィールフレームを、実ブラウザで最初から最後まで通して確かめる。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node ranking/profile-frame-browser-check.js
//
// 文字列の検査(profile-frame-check.js)では「開いた瞬間だけ真っ白」「枠が出ていない」
// 「枠が親に切られている」を拾えない。ここでは実際に
//   HOME → プロフィール → フレームを選ぶ → 再読み込み → ランキング
// まで進み、次を見る。
//
//   ① フレームなしのときは、いまと同じ見た目(枠の要素が1つも無い)
//   ② 5種類が選べて、押したその場でHOMEとプロフィールへ反映される
//   ③ 再読み込みしても選んだフレームが残る
//   ④ 未公開の豪華フレームは選択画面に出ない
//   ⑤ ランキングに他プレイヤーのフレームが出る。小さいアイコン(32px)でも潰れない
//   ⑥ 枠が親要素に切られていない / タップを食べない
const { chromium } = require('playwright');

const fs = require('fs');
const path = require('path');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
// 選択画面に並ぶはずのフレーム名と、**並んではいけない**未公開フレームの名前。
// どちらも data/breeder.js から作る(検査へ名前を書き写すと、増やしたときにここだけ古くなる)
const BREEDER_DATA = fs.readFileSync(path.join(__dirname, '../../monster-hero/data/breeder.js'), 'utf8');
const frameNames = (released) => [...BREEDER_DATA
  .matchAll(/\{\s*id:'[a-z0-9_]+',\s*name:'([^']+)',\s*kind:'(?:none|css|image)',\s*released:(true|false)/g)]
  .filter(m => (m[2] === 'true') === released).map(m => m[1]);
const EXPECTED_FRAMES = frameNames(true);
const HIDDEN_FRAMES = frameNames(false);
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

// ブリーダーLvランキング用の行。フレームを選んでいる人・いない人・知らないidの人を混ぜる
const RANKING_ROWS = [
  { user_name: '金枠さん',   level: 90, icon: 'Mocchi', profile_frame: 'gold' },
  { user_name: '桃枠さん',   level: 80, icon: 'Mocchi', profile_frame: 'pink' },
  { user_name: '枠なしさん', level: 70, icon: 'Mocchi' },
  { user_name: '未公開さん', level: 60, icon: 'Mocchi', profile_frame: 'ornate_not_released_yet' },
];

const seed = () => {
  const put = (key, value) => { if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value)); };
  put('mh_breeder_name', 'テスト');
  put('mh_breeder_icon', 'Mocchi');
  put('mh_onboarded', true);
  put('mh_tutorial_seen_v1', true);
  put('mh_battle_tutorial_seen_v1', true);
  put('mh_battle_tutorial_guide_shown_v1', true);
  put('mh_masu_migrated', true);
};

const frameInfo = (page) => page.evaluate(() => [...document.querySelectorAll('.mh-profile-frame')].map(el => {
  const r = el.getBoundingClientRect();
  const parent = el.parentElement.getBoundingClientRect();
  const style = getComputedStyle(el);
  return {
    cls: [...el.classList].find(c => c.startsWith('mh-profile-frame-') && c !== 'mh-profile-frame-ring') || '',
    w: Math.round(r.width), parentW: Math.round(parent.width),
    pointer: style.pointerEvents, visible: r.width > 0 && r.height > 0,
    // 親のどこかで切られていないか(枠は円の外へ出るので、切られると見えなくなる)
    clipped: (() => {
      let n = el.parentElement;
      while (n && n !== document.body) {
        const s = getComputedStyle(n);
        if (s.overflow !== 'visible' && s.overflowX !== 'visible') {
          const b = n.getBoundingClientRect();
          if (r.left < b.left - 0.5 || r.right > b.right + 0.5) return true;
        }
        n = n.parentElement;
      }
      return false;
    })(),
  };
}));

async function run() {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  // iPhoneの縦画面。小さいアイコンでも判別できるかをこの幅で見る
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', e => fatal.push(e.message));
  await page.addInitScript(seed);
  await page.route('**/rest/v1/**', async (route) => {
    if (route.request().method() !== 'GET') { await route.fulfill({ status: 201, body: '' }); return; }
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/rankings')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RANKING_ROWS) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  const down = (f) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, f);
  const clickText = (text) => page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(t));
    if (b) b.click();
    return !!b;
  }, text);

  const boot = async () => {
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
      await page.waitForTimeout(600);
      if (!closed) break;
    }
  };

  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await boot();

  // ① フレームなし = いまと同じ見た目(枠の要素が1つも無い)
  check('HOMEに着く', await page.evaluate(() => !!document.querySelector('button[aria-label="プロフィールを開く"]')));
  check('フレームなしのときは枠を描かない(いまと同じ見た目)', (await frameInfo(page)).length === 0);
  check('HOMEの金色の縁はそのまま残る',
    await page.evaluate(() => {
      const el = document.querySelector('.mh-home-avatar');
      return !!el && !el.classList.contains('is-framed') && getComputedStyle(el).borderTopColor !== 'rgba(0, 0, 0, 0)';
    }));

  // ② プロフィール → フレームを選ぶ
  await page.evaluate(() => document.querySelector('button[aria-label="プロフィールを開く"]')?.click());
  await page.waitForTimeout(1200);
  check('プロフィールが開く', await page.evaluate(() => document.body.innerText.includes('プロフィール')));
  check('フレームのボタンがあり、はじめは「フレームなし」',
    await page.evaluate(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('フレーム：フレームなし'))));
  await clickText('フレーム：');
  await page.waitForTimeout(800);

  const options = await page.evaluate(() => [...document.querySelectorAll('button[data-profile-frame-option]')].map(b => b.textContent.trim()));
  // 並ぶ数と名前は data/breeder.js の公開フレームと一致していること(画面側へ書き写さない)
  check('公開フレームが全部並ぶ', options.length === EXPECTED_FRAMES.length,
    `画面 ${options.length}件 / データ ${EXPECTED_FRAMES.length}件`);
  check('名前がデータどおり', EXPECTED_FRAMES.every(n => options.includes(n)), options.join(' / '));
  check('④ 未公開の豪華フレームは出ない',
    HIDDEN_FRAMES.length > 0 && !options.some(n => HIDDEN_FRAMES.includes(n)),
    `隠すべき ${HIDDEN_FRAMES.length}件: ${HIDDEN_FRAMES.join(' / ') || '(1件も無い)'}`);

  // ゴールドを押す
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button[data-profile-frame-option]')].find(x => x.textContent.trim() === 'ゴールド');
    if (b) b.click();
  });
  await page.waitForTimeout(600);
  const picked = await frameInfo(page);
  check('押したその場でプレビューへ反映される', picked.some(f => f.cls === 'mh-profile-frame-gold'), picked.map(f => f.cls).join(','));
  check('枠はタップを食べない(pointer-events:none)', picked.length > 0 && picked.every(f => f.pointer === 'none'));
  check('枠が親要素に切られていない', picked.length > 0 && picked.every(f => !f.clipped));
  check('枠はアイコンより大きい(外側まで描く)', picked.every(f => f.w > f.parentW), picked.map(f => `${f.w}/${f.parentW}`).join(' '));
  check('保存された', (await page.evaluate(() => localStorage.getItem('mh_profile_frame_v1'))) === '"gold"');

  await clickText('閉じる');
  await page.waitForTimeout(600);
  check('② プロフィールのアイコンに反映される',
    (await frameInfo(page)).some(f => f.cls === 'mh-profile-frame-gold'));

  // HOMEへ戻って反映を見る
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.querySelector('svg') && x.className.includes('text-slate-400'));
    if (b) b.click();
  });
  await page.waitForTimeout(1200);
  const homeFrames = await frameInfo(page);
  check('② HOMEのプロフィールアイコンに反映される',
    homeFrames.some(f => f.cls === 'mh-profile-frame-gold'), homeFrames.map(f => f.cls).join(','));
  check('フレームを選ぶと、もとの金色の縁は消える(二重にならない)',
    await page.evaluate(() => {
      const el = document.querySelector('.mh-home-avatar');
      return !!el && el.classList.contains('is-framed');
    }));

  // ③ 再読み込みしても残る
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await boot();
  check('③ 再読み込みしても選んだフレームが残る',
    (await frameInfo(page)).some(f => f.cls === 'mh-profile-frame-gold'));

  // ⑤ ランキング(ブリーダーLv)。他の人のフレームが出る
  await page.evaluate(() => { const b = document.querySelector('button[aria-label="バトル"]'); if (b) b.click(); });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'ブリーダーLv');
    if (b) b.click();
  });
  await page.waitForTimeout(3500);
  const rows = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="breeder"]')].map(el => ({
    text: el.innerText.replace(/\s+/g, ' '),
    frame: [...el.querySelectorAll('.mh-profile-frame')].map(f => [...f.classList].find(c => c.startsWith('mh-profile-frame-') && c !== 'mh-profile-frame-ring') || '?'),
    iconW: Math.round((el.querySelector('.mh-profile-avatar')?.getBoundingClientRect().width) || 0),
  })));
  check('ランキングの一覧が出る', rows.length >= 3, `${rows.length}件`);
  const byName = (n) => rows.find(r => r.text.includes(n)) || { frame: [] };
  check('⑤ 他プレイヤーのフレームが出る(ゴールド)', byName('金枠さん').frame.includes('mh-profile-frame-gold'), byName('金枠さん').frame.join(','));
  check('⑤ 他プレイヤーのフレームが出る(ピンク)', byName('桃枠さん').frame.includes('mh-profile-frame-pink'), byName('桃枠さん').frame.join(','));
  check('フレームを選んでいない人には出ない', byName('枠なしさん').frame.length === 0);
  check('未公開・知らないidは描かない', byName('未公開さん').frame.length === 0, byName('未公開さん').frame.join(','));
  const rankFrames = await page.evaluate(() => [...document.querySelectorAll('[data-ranking-kind="breeder"] .mh-profile-frame')]
    .map(el => { const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
      return { out: +((r.width - p.width) / 2).toFixed(2), parent: Math.round(p.width) }; }));
  // 2026-09-15にユーザー指摘「太すぎてかっこ悪い」を受けて細くした。細くしすぎて
  // 32pxで消えてしまわないこと(はみ出し1.5px以上)を、実寸で見張る
  check('小さいランキングアイコンでも枠が見える(32px前後で1.5px以上はみ出す)',
    rankFrames.length > 0 && rankFrames.every(f => f.parent <= 40 && f.out >= 1.5),
    rankFrames.map(f => `${f.parent}px/+${f.out}`).join(' '));
  check('iPhone縦画面で横にはみ出さない',
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    await page.evaluate(() => `${document.documentElement.scrollWidth} / ${window.innerWidth}`));

  check('実行時エラーが出ていない', fatal.length === 0, fatal.slice(0, 2).join(' | '));
  await browser.close();

  const ng = results.filter(r => !r).length;
  console.log(ng === 0 ? '\nすべてOK' : `\n${ng}件のNGがあります`);
  process.exit(ng === 0 ? 0 : 1);
}

run().catch(e => { console.error(e); process.exit(1); });

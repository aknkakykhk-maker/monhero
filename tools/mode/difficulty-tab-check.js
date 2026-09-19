const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 難易度選択の「通常 / 極限」タブを確かめる(2026-09-19 ユーザー指示)。
//
// クイックは15段階、種族チャレンジは14段階あり、一続きに並べると目当ての難易度まで遠い。
// そこでタブで分ける。極限を持たないモード(チャレンジ・プロ)ではタブ自体を出さないので、
// これまでどおり1つの並びに見える。
//
//   ① 分け方そのもの(本体の純関数をそのまま動かす)
//   ② 実ブラウザ: クイックにタブが出て、押すと極限の並びへ切り替わる
//   ③ 実ブラウザ: 極限を持たないモードにはタブが出ない
//   ④ 開くたびに「通常」から始まる(極限タブのままノーマルを選んでいる状態を作らない)
//   ⑤ スコアランキングのタブは、チャレンジで16段階(通常9＋極限7)がひと続きに並ぶ
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const PORT = 8994;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);
const slice = (from, to) => {
  const i = source.indexOf(from);
  const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした（${from}）`); process.exit(1); }
  return source.slice(i, j);
};

// --- ① 分け方(純関数) ---
const sandbox = { Math, console };
vm.createContext(sandbox);
vm.runInContext(
  slice('const DIFFICULTY_SETTINGS = {', 'const isExtremeDifficultyId')
    + slice('const isExtremeDifficultyId', 'const extremeDistanceBreakRule')
    + ';globalThis.api={DIFFICULTY_SETTINGS,isExtremeDifficultyId,splitDifficultyEntries,'
    + 'difficultyTabOf,DIFFICULTY_TAB_NORMAL,DIFFICULTY_TAB_EXTREME};', sandbox);
const api = sandbox.api;

check('通常の9段階は極限扱いにしない',
  Object.keys(api.DIFFICULTY_SETTINGS).every(id => api.isExtremeDifficultyId(id) === false),
  Object.keys(api.DIFFICULTY_SETTINGS).join(','));
check('極限の段階は極限扱いになる',
  ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY', 'GOD', 'RAGNAROK'].every(id => api.isExtremeDifficultyId(id) === true));
check('空の値は極限扱いにしない', api.isExtremeDifficultyId(null) === false && api.isExtremeDifficultyId('') === false);
// クイックの並び(通常9 + 極限6)を実際に分ける
const quickEntries = [...Object.keys(api.DIFFICULTY_SETTINGS), 'EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY', 'GOD'].map(id => [id, {}]);
const split = api.splitDifficultyEntries(quickEntries);
check('通常と極限へ分けられる', split.normal.length === 9 && split.extreme.length === 6,
  `通常${split.normal.length} / 極限${split.extreme.length}`);
check('分けても並び順は変わらない',
  split.normal[0][0] === 'Beginner' && split.extreme[0][0] === 'EXTREME'
    && split.extreme[split.extreme.length - 1][0] === 'GOD');
check('1枚も欠けない', split.normal.length + split.extreme.length === quickEntries.length);
check('極限を持たない並びでは extreme が空',
  api.splitDifficultyEntries(Object.keys(api.DIFFICULTY_SETTINGS).map(id => [id, {}])).extreme.length === 0);
check('壊れた値でも落ちない',
  api.splitDifficultyEntries(null).normal.length === 0 && api.splitDifficultyEntries(undefined).extreme.length === 0);
check('難易度からタブを決められる',
  api.difficultyTabOf('Normal') === api.DIFFICULTY_TAB_NORMAL && api.difficultyTabOf('GOD') === api.DIFFICULTY_TAB_EXTREME);

// --- 実装側の結線 ---
check('開くたびにタブも通常から始まる', has('setDifficultySelectTab(difficultyTabOf(start));'),
  '極限タブのままノーマルを選んでいる状態を作らない');
check('極限を持たないモードではタブを出さない', has('const hasExtremeTab=difficultyGroups.extreme.length>0||challengeExtremeTab;'));
// ★pro を定義より前で参照すると難易度選択がまるごとエラー画面に落ちる(実際に落ちた)
check('チャレンジ判定は pro を先に参照しない', has('const challengeExtremeTab=!species&&!quick&&!isProMode(battleMode);'));
check('タブを切り替えたらその並びの先頭を選ぶ', has('if(group[0])chooseDifficulty(group[0][0]);'),
  '見えていない難易度のまま開始できてしまうのを防ぐ');

// --- ⑤ ランキングのタブ(16段階をまとめる / 2026-09-19 ユーザー指示) ---
// 並べ方だけを変える。記録の保存先(mh_hs_* / mh_extreme_hs_*)も Supabase へ送る difficulty も
// これまでどおりなので、過去の記録はそのまま並ぶ
check('チャレンジのランキングは通常9段階に極限を続けて並べる',
  has("const rankingTabs = isExtreme")
    && has("...(mode === BATTLE_MODE_CHALLENGE ? PUBLIC_EXTREME_DIFFICULTIES.map(setting => [setting.id, setting]) : [])]"));
check('極限チャレンジの入口から開いたときは極限だけ並べる',
  has("? PUBLIC_EXTREME_DIFFICULTIES.map(setting => [setting.id, setting])"));
// ★ここを mode だけで決めると、チャレンジのまま極限タブを押したとき
//   normalizeBattleDifficulty が GOD を Normal へ落とし、通常の記録を見せてしまう
check('極限のタブは極限のランキングキーを引く',
  has("const keyOf = (diff) => rankingDifficultyKey(isExtremeDifficultyId(diff)")
    && has("? rankingDifficultyForMode(EXTREME_MODE.id, diff)"));
check('タブの描画は1か所にまとめる', has('data-score-ranking-tabs'));
check('極限のタブはその段階の色で出す', has('style={extremeTab?{background'));

// --- ②③④ 実ブラウザ ---
const MIME = { '.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.svg':'image/svg+xml', '.mp3':'audio/mpeg', '.ico':'image/x-icon' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

(async () => {
  let playwright;
  try { playwright = require('playwright'); }
  catch {
    console.log('SKIP: playwright が入っていないのでブラウザぶんは確認できません');
    console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
    process.exit(failed ? 1 : 0);
  }
  const server = await serve();
  const errors = [];
  let browser;
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
      // 極限タブを実際に押せる状態にする(解放条件は Grand Master 以上のクリア)
      localStorage.setItem('mh_clears_GrandMaster', JSON.stringify(1));
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: `
      .snap-mandatory { display:flex; overflow-x:auto; width:100%; scroll-snap-type:x mandatory; }
      .snap-mandatory > article { flex:0 0 82%; scroll-snap-align:center; }
    ` });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.getByRole('button', { name: 'バトル' }).dispatchEvent('click', {}, { timeout: 15000 });
    await page.getByText('BATTLE MODE').first().waitFor({ timeout: 15000 });

    // モードのカードから難易度選択を開く
    const openDifficulty = async (label) => {
      await page.evaluate((name) => {
        const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes(name));
        const card = cards[Math.floor(cards.length / 2)] || cards[0];
        [...card.querySelectorAll('button')].find(b => b.textContent.includes('難易度を選ぶ'))?.click();
      }, label);
      await page.waitForTimeout(1500);
    };
    const back = async () => {
      await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
      await page.waitForTimeout(1200);
    };
    const tabLabels = () => page.evaluate(() =>
      [...document.querySelectorAll('[data-difficulty-tabs] button')].map(b => b.textContent.trim()));
    // ★「タブが出ない」は、画面がまるごとエラーで落ちていても真になってしまう。
    //   実際にそれで見逃しかけたので、難易度選択が開けていること自体を先に確かめる
    const difficultyScreenOk = async () => {
      const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      return !text.includes('画面の表示でエラーが起きました') && /BATTLE DIFFICULTY|難易度を選択/.test(text);
    };
    const cardTitles = () => page.evaluate(() =>
      [...document.querySelectorAll('article h3')].map(h => h.textContent.trim()));

    // --- ② クイック: タブが出て、押すと極限へ切り替わる ---
    await openDifficulty('クイックモード');
    check('クイックの難易度選択が開ける（エラー画面に落ちていない）', await difficultyScreenOk());
    const quickTabs = await tabLabels();
    check('クイックに「通常 / 極限」タブが出る', quickTabs.length === 2 && /通常/.test(quickTabs[0]) && /極限/.test(quickTabs[1]),
      quickTabs.join(' | '));
    const normalTitles = await cardTitles();
    check('はじめは通常の並び', normalTitles.includes('Beginner') && !normalTitles.includes('EXTREME'),
      normalTitles.slice(0, 4).join(','));
    await page.evaluate(() => {
      [...document.querySelectorAll('[data-difficulty-tabs] button')].find(b => b.textContent.includes('極限'))?.click();
    });
    await page.waitForTimeout(1200);
    const extremeTitles = await cardTitles();
    check('極限タブへ切り替えられる', extremeTitles.includes('EXTREME') && !extremeTitles.includes('Beginner'),
      extremeTitles.slice(0, 4).join(','));
    check('極限タブにクイックの極限が並ぶ', extremeTitles.includes('GOD'), extremeTitles.join(','));
    // 開き直すと通常から
    await back();
    await openDifficulty('クイックモード');
    const reopened = await cardTitles();
    check('開き直すと通常から始まる', reopened.includes('Beginner'), reopened.slice(0, 3).join(','));
    await back();

    // --- ③ 極限を持たないモードにはタブが出ない ---
    await openDifficulty('プロモード');
    check('プロの難易度選択が開ける（エラー画面に落ちていない）', await difficultyScreenOk());
    check('プロにはタブが出ない', (await tabLabels()).length === 0);
    await back();

    // --- ④ チャレンジ: 極限タブから極限の難易度へ行き来できる ---
    await openDifficulty('チャレンジモード');
    check('チャレンジの難易度選択が開ける（エラー画面に落ちていない）', await difficultyScreenOk());
    const challengeTabs = await tabLabels();
    check('チャレンジにも「通常 / 極限」タブが出る', challengeTabs.length === 2, challengeTabs.join(' | '));
    await page.evaluate(() => {
      [...document.querySelectorAll('[data-difficulty-tabs] button')].find(b => b.textContent.includes('極限'))?.click();
    });
    await page.waitForTimeout(1500);
    const jumped = await page.evaluate(() => !!document.querySelector('[data-extreme-difficulties]'));
    // 解放していない端末では押せない。そのときはタブが無効になっていることを見る
    const lockedTab = await page.evaluate(() =>
      [...document.querySelectorAll('[data-difficulty-tabs] button')].some(b => b.textContent.includes('極限') && b.disabled));
    check('極限タブから極限の難易度へ移れる（未解放なら押せない）', jumped || lockedTab,
      jumped ? '移れた' : lockedTab ? '未解放なので押せない' : 'どちらでもない');
    if (jumped) {
      const backTabs = await tabLabels();
      check('極限の画面にも同じタブが出る', backTabs.length === 2, backTabs.join(' | '));
      await page.evaluate(() => {
        [...document.querySelectorAll('[data-difficulty-tabs] button')].find(b => b.textContent.includes('通常'))?.click();
      });
      await page.waitForTimeout(1500);
      const returned = await page.evaluate(() => [...document.querySelectorAll('article h3')].map(h => h.textContent.trim()));
      check('通常タブで9段階へ戻れる', returned.includes('Beginner'), returned.slice(0, 3).join(','));
    }
    await back();

    // --- ⑤ チャレンジのランキングに16段階のタブが並ぶ ---
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('チャレンジモード'));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('ランキング'))?.click();
    });
    await page.waitForTimeout(1800);
    const rankTabs = await page.evaluate(() =>
      [...document.querySelectorAll('[data-score-ranking-tabs] button')].map(b => b.textContent.trim()));
    check('チャレンジのランキングに通常9段階が並ぶ',
      ['Beginner', 'Normal', 'Grand Master'].every(label => rankTabs.includes(label)),
      rankTabs.slice(0, 4).join(','));
    check('同じ並びに極限の段階も続く',
      ['EXTREME', 'GOD', 'RAGNAROK'].every(label => rankTabs.includes(label)),
      rankTabs.slice(-4).join(','));
    check('タブは16段階', rankTabs.length === 16, `${rankTabs.length}枚`);
    // 極限のタブを押しても画面が落ちない(押した先で引くキーが ExtremeGOD などになる)
    await page.evaluate(() => {
      [...document.querySelectorAll('[data-score-ranking-tabs] button')].find(b => b.textContent.trim() === 'GOD')?.click();
    });
    await page.waitForTimeout(1200);
    const afterExtremeTab = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('極限のタブを押しても表示が壊れない',
      !afterExtremeTab.includes('画面の表示でエラーが起きました') && afterExtremeTab.includes('GOD'),
      afterExtremeTab.slice(0, 60));
    await back();

    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } catch (e) {
    check('最後まで確認できた', false, String(e && e.message ? e.message : e).slice(0, 160));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 新難易度(Grand Master / Hell / Legend)と、トレーニングチケット・重トレーニングチケットのまとめ使いを確認する。
//
//   python3 tools/serve.py   でリポジトリのルートを配信した状態で
//   node mode/difficulty-item-check.js
const path = require('path');
const { chromium } = require('playwright');

const URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const fatal = [];
  page.on('pageerror', (e) => fatal.push(e.message));

  await page.addInitScript(() => {
    const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    put('mh_breeder_name', 'テストブリーダー');
    put('mh_intro_done', true);
    put('mh_gold', 99999);
    // 絆経験値チケットを所持した状態のマスモンを1体用意する
    put('mh_masu_mons', [{
      id: 'masu_t', baseId: 'Mocchi', name: 'チケ検証', bondXp: 0,
      distAptPoints: 0, distApt: ['C', 'C', 'C', 'C'],
      statPoints: { hp: 0, atk: 0, def: 0, guts: 0 }, createdAt: Date.now(),
    }]);
    put('mh_owned_items', { training_ticket: 30, training_ticket_l: 5 });
    put('mh_monster_roster', ['masu:masu_t', 'Suezo', 'Golem']);
  });

  const clickText = async (src, nth = 0) => page.evaluate(([s, n]) => {
    const rx = new RegExp(s);
    const list = [...document.querySelectorAll('button')].filter(x => rx.test((x.innerText || '').replace(/\s+/g, ' ').trim()));
    if (!list[n]) return false;
    list[n].click();
    return true;
  }, [src, nth]);
  const bodyText = () => page.evaluate(() => (document.body ? document.body.innerText.replace(/\s+/g, ' ') : ''));

  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => !!document.body && document.body.innerText.includes('TAP TO START'), { timeout: 40000 });
  await page.getByRole('button', { name: 'TAP TO START' }).click({ force: true });
  await page.waitForTimeout(1600);

  // --- 新難易度 ---
  const title = await bodyText();
  check('Grand Master が選べる', title.includes('Grand Master'));
  check('Hell が選べる', title.includes('Hell'));
  check('Legend が選べる', title.includes('Legend'));
  // 未選択の難易度は、その難易度の色の文字になっている
  const colors = await page.evaluate(() => {
    const want = ['Beginner', 'Hell', 'Legend'];
    const out = {};
    [...document.querySelectorAll('button')].forEach(b => {
      const t = (b.innerText || '').trim();
      if (want.includes(t)) out[t] = getComputedStyle(b).color;
    });
    return out;
  });
  const distinct = new Set(Object.values(colors));
  check('難易度ごとに文字色が違う', Object.keys(colors).length >= 3 && distinct.size >= 3, JSON.stringify(colors));

  // 選ぶとハイスコア表示が切り替わる
  await clickText('^Legend$');
  await page.waitForTimeout(500);
  check('Legend を選ぶとハイスコア表示が切り替わる', (await bodyText()).includes('HIGH SCORE (Legend)'));

  // --- 絆経験値チケット ---
  await clickText('プロフィール');
  await page.waitForTimeout(1200);
  await clickText('アイテム');
  await page.waitForTimeout(1000);
  const inv = await bodyText();
  check('アイテム欄にトレーニングチケットがある', inv.includes('トレーニングチケット'));
  // 旧「修行チケット」は表示名だけを「重トレーニングチケット」へ変えた(ID・効果・所持数は据え置き)
  check('アイテム欄に重トレーニングチケットがある', inv.includes('重トレーニングチケット'));
  check('重トレーニングチケットも絆経験値の用途で説明されている', inv.includes('絆経験値を150'));
  check('旧名称の「修行チケット」が残っていない', !inv.includes('修行チケット'));

  const used = await clickText('使う');
  await page.waitForTimeout(800);
  check('「使う」から対象選択へ進める', used && (await bodyText()).includes('使う対象を選択'));

  await clickText('チケ検証');
  await page.waitForTimeout(800);
  const useScreen = await bodyText();
  check('枚数を決める画面が出る', useScreen.includes('使う枚数'));
  check('もらえる絆経験値が出る', useScreen.includes('もらえる絆経験値'));

  // スライダーを最大にすると、経験値と到達レベルが増える
  const before = await page.evaluate(() => {
    const m = document.body.innerText.match(/\+([\d,]+)/);
    return m ? m[1] : '';
  });
  await clickText('^最大$');
  await page.waitForTimeout(600);
  const afterTxt = await bodyText();
  check('最大にすると増える経験値が変わる', !afterTxt.includes(`+${before} `) || afterTxt.includes('+300'), `1枚=${before} → 最大`);
  check('絆レベルの変化が出る', /絆Lv\.\d+ → Lv\.\d+/.test(afterTxt) || /Lv\.\d+ \(\+\d+\)/.test(afterTxt), afterTxt.match(/絆Lv\.\d+[^。]{0,24}/)?.[0] || '');

  // 使うとレベルが上がり、所持数が減る
  await clickText('枚 使う');
  await page.waitForTimeout(1200);
  const done = await bodyText();
  check('使ったあとアイテム欄に戻る', done.includes('トレーニングチケット') || done.includes('アイテム'));
  const remain = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_owned_items') || '{}'));
  const masu = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_masu_mons') || '[]')[0]);
  check('チケットが消費される', (remain.training_ticket || 0) === 0, `残り ${remain.training_ticket}枚`);
  check('絆経験値が入る', (masu?.bondXp || 0) === 300, `絆XP ${masu?.bondXp}`);

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'difficulty-item-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

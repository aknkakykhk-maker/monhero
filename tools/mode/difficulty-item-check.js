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
    // アイコンまで決まっていないと「はじめての設定」がHOMEに重なって進めない
    put('mh_breeder_icon', '🐣');
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
    // 起動直後に重なる案内(初回の助手えらび・お詫び配布)は、先に済ませた状態にしておく。
    // ここが出るとHOMEのボタンへ届かず、検査が1つも進まない
    put('mh_onboarded', true);
    put('mh_tutorial_seen_v1', true);
    put('mh_battle_tutorial_seen_v1', true);
    put('mh_battle_tutorial_guide_shown_v1', true);
    put('mh_assistant_selected_v1', 'mua');
    put('mh_assistant_unlock_seen_v1', true);
    put('mh_inherited_unique_level_compensation_v1', true);
    put('mh_inherited_unique_level_compensation_pending_v1', false);
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
  await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
  await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 30000 });
  // ログインボーナスなどの重なりを閉じてHOMEを出す
  for (let i = 0; i < 6; i++) {
    const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
    if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
    await btn.dispatchEvent('click').catch(() => {});
    await page.waitForTimeout(300);
  }

  // --- 新難易度 ---
  // 難易度は HOME → バトル → BATTLE MODE → チャレンジモード → 難易度を選ぶ の先にある
  await page.getByRole('button', { name: 'バトル' }).dispatchEvent('click');
  await page.getByText('BATTLE MODE').first().waitFor({ timeout: 20000 });
  await page.locator('article').filter({ hasText: 'チャレンジモード' }).first()
    .getByRole('button', { name: '難易度を選ぶ' }).dispatchEvent('click');
  await page.getByText('BATTLE DIFFICULTY').first().waitFor({ timeout: 20000 });
  const title = await bodyText();
  check('Grand Master が選べる', title.includes('Grand Master'));
  check('Hell が選べる', title.includes('Hell'));
  check('Legend が選べる', title.includes('Legend'));
  check('9難易度がカードで並ぶ', await page.locator('.snap-mandatory > article').count() === 9,
    `${await page.locator('.snap-mandatory > article').count()}枚`);
  // 難易度の名前は、その難易度の色の文字になっている
  const colors = await page.evaluate(() => {
    const want = ['Beginner', 'Grand Master', 'Hell', 'Legend'];
    const out = {};
    [...document.querySelectorAll('.snap-mandatory > article')].forEach(card => {
      const label = [...card.querySelectorAll('*')]
        .find(el => el.children.length === 0 && want.includes((el.textContent || '').trim()));
      if (label) out[label.textContent.trim()] = getComputedStyle(label).color;
    });
    return out;
  });
  const distinct = new Set(Object.values(colors));
  check('難易度ごとに文字色が違う', Object.keys(colors).length >= 3 && distinct.size >= 3, JSON.stringify(colors));

  // 難易度ごとに自己ベストとクリア報酬が出る(以前の「HIGH SCORE (Legend)」の役割)
  const legendCard = page.locator('.snap-mandatory > article').filter({ hasText: 'Legend' }).first();
  await legendCard.scrollIntoViewIfNeeded();
  const legendText = (await legendCard.textContent()).replace(/\s+/g, ' ');
  check('Legendのカードに自己ベストとクリア報酬が出る',
    legendText.includes('自己ベストスコア') && legendText.includes('虹のプシュケー：25個'), legendText.slice(0, 80));

  // --- 絆経験値チケット ---
  // アイテムは HOME → プロフィール の先にある
  await page.locator('button[aria-label="戻る"]').first().dispatchEvent('click');
  await page.waitForTimeout(600);
  await page.locator('button[aria-label="戻る"]').first().dispatchEvent('click').catch(() => {});
  await page.getByRole('button', { name: 'バトル' }).waitFor({ timeout: 20000 });
  await page.getByRole('button', { name: 'プロフィール' }).first().dispatchEvent('click');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /アイテム/ }).first().dispatchEvent('click');
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
  // 1枚あたりの絆経験値はアイテムの説明が正本なので、そこから読んだ値×所持数と突き合わせる
  // (数値を検査側へ書き写すと、値を変えたときにここだけ古くなる)
  const perTicket = Number((inv.match(/トレーニングチケット[^。]*?絆経験値を(\d+)/) || [])[1] || 0);
  check('絆経験値が入る', perTicket > 0 && (masu?.bondXp || 0) === perTicket * 30,
    `絆XP ${masu?.bondXp} / 1枚=${perTicket} × 30枚`);

  check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));

  await page.screenshot({ path: path.join(TOOLS_DIR, 'out', 'difficulty-item-check.png') }).catch(() => {});
  const ng = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

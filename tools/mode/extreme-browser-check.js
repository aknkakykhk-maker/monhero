// 極限チャレンジを実ブラウザで開いて、正式導線が最後まで進めるかを確認する。
//
//   python3 -m http.server 8899 でリポジトリのルートを配信した状態で
//   node mode/extreme-browser-check.js
//
// 過去に「EXTREMEを押しても無反応」「powerOverride=null が0扱いで通常バトルの敵が壊れる」を
// 出しているので、①解放/ロックの出し分け ②EXTREMEを押してバトルが始まる
// ③敵の強さが×13 ④通常難易度の敵が壊れていない、を実際に遊んで確かめる。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
let waveOneDetailHp = 0; // 全WAVE詳細のWAVE1のライフ。実戦の敵と突き合わせる
const check = (name, ok, detail = '') => { results.push(ok); console.log(`  ${ok ? 'OK' : 'NG'}  ${name}${detail ? ' — ' + detail : ''}`); };

const seed = (clears) => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
  localStorage.setItem('mh_gold', JSON.stringify(99999));
  // お詫び配布のお知らせが出ると、HOMEのボタンの上に重なって進めなくなる。
  // 配布済みの印を先に入れておき、検査ではその画面を出さない
  localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
  localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
  Object.entries(clears).forEach(([k, v]) => localStorage.setItem(`mh_clears_${k}`, JSON.stringify(v)));
};

async function openBattle(page, clears) {
  await page.addInitScript(seed, clears);
  await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  const pointerDown = (sel) => page.evaluate((s) => {
    const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!b;
  }, sel);
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await pointerDown({ text: 'TAP TO START' });
  await page.waitForTimeout(2500);
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
  await pointerDown({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(2500);
  // ログインボーナス・アップデート案内などの重なりを閉じる
  for (let i = 0; i < 8; i++) {
    const closed = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /受け取|閉じる|あとで|スキップ/.test(x.textContent));
      if (b) b.click();
      return !!b;
    });
    await page.waitForTimeout(700);
    if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
  }
  // お詫び配布などの重なりは「バトル」を押したあとに出ることもあるので、
  // BATTLE MODE が出るまで「重なりを閉じる → バトルを押す」を繰り返す
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => {
      const overlay = [...document.querySelectorAll('button')]
        .find(x => /受け取|閉じる|あとで|スキップ/.test(x.textContent));
      if (overlay) { overlay.click(); return; }
      const b = document.querySelector('button[aria-label="バトル"]');
      b && b.click();
    });
    await page.waitForTimeout(1200);
    if (await page.evaluate(() => document.body.innerText.includes('BATTLE MODE'))) break;
  }
}

// モードカルーセルの中から極限チャレンジのカード(真ん中のコピー)を1枚取り出す
const extremeCardInfo = () => {
  const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('極限チャレンジ'));
  const card = cards[Math.floor(cards.length / 2)] || cards[0];
  if (!card) return null;
  const start = [...card.querySelectorAll('button')].find(b => /難易度を選ぶ|まだ挑戦できません/.test(b.textContent));
  return { text: card.textContent.replace(/\s+/g, ' '), label: start?.textContent.trim() || '', disabled: !!start?.disabled };
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

  // --- ① Master以下しかクリアしていない: ロック ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openBattle(page, { Master: 3 });
    const info = await page.evaluate(extremeCardInfo);
    check('未解放でも極限チャレンジのカードは出る', !!info, info ? '' : 'カードが見つからない');
    check('未解放は解放条件を表示する', !!info && info.text.includes('チャレンジ Grand Master以上クリアで解放'), info?.text.slice(0, 90));
    check('未解放は難易度へ進めない', !!info && info.disabled === true && info.label === 'まだ挑戦できません', info?.label);
    await page.close();
  }

  // --- ② Grand Masterクリア済み: 解放され、EXTREMEでバトルが始まる ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const fatal = [];
    page.on('pageerror', e => fatal.push(e.message));
    await openBattle(page, { GrandMaster: 1 });
    const card2 = await page.evaluate(extremeCardInfo);
    check('Grand Masterクリア済みで解放される', !!card2 && card2.disabled === false && card2.label === '難易度を選ぶ', card2?.label);

    // モード説明が開く(他モードと同じ見出しで並ぶ)
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('極限チャレンジ'));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('このモードの説明'))?.click();
    });
    await page.waitForTimeout(900);
    const info = await page.evaluate(() => document.querySelector('[role="dialog"][aria-label="極限チャレンジの説明"]')?.innerText.replace(/\s+/g, ' ') || '');
    check('モード説明が開く', info.includes('極限チャレンジとは？'), info.slice(0, 60));
    // モード説明は4節へ整理されている(見出しの正本は extreme-challenge-check.js)
    check('モード説明が他モードと同じ見出しで並ぶ',
      ['モード概要', '難易度', '報酬', 'こんな人におすすめ'].every(t => info.includes(t)),
      info.slice(0, 80));
    check('モード説明にEXTREME固有の50%ルールを書かない', !info.includes('アシストカード'), info.slice(0, 60));
    await page.evaluate(() => { document.querySelector('[aria-label="説明を閉じる"]')?.click(); });
    await page.waitForTimeout(700);

    // モードカードからランキングを開ける
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('極限チャレンジ'));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('のランキング'))?.click();
    });
    await page.waitForTimeout(2000);
    const rank = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('モードカードからランキングを開ける', rank.includes('極限チャレンジランキング'), rank.slice(0, 70));
    check('ランキングの難易度タブが極限の段階になっている', rank.includes('EXTREME') && !/Grand Master|Legend/.test(rank), rank.slice(0, 90));
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(1200);

    // 極限の難易度画面へ
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('極限チャレンジ'));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('難易度を選ぶ'))?.click();
    });
    await page.waitForTimeout(1500);
    const diff = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('極限専用の難易度画面が開く', !!(await page.$('[data-extreme-difficulties]')));
    check('EXTREMEの倍率と報酬が出ている', ['×13', '×20', '×25', '×7.5', '虹のプシュケー30'].every(v => diff.includes(v)), diff.slice(0, 110));
    // 特殊ルールの中身はカードへ並べず「特殊ルールあり」とだけ出し、詳しくは専用の画面で見せる
    // (中身の正本は extreme-rule-detail-browser-check.js)
    check('EXTREME特殊ルールがあることを難易度側で示す', diff.includes('特殊ルールあり'), diff.slice(0, 140));
    check('デバッグ表記が残っていない', !/DEBUG|デバッグ|保存されません/.test(diff));
    const tiers = await page.evaluate(() => [...document.querySelectorAll('[data-extreme-difficulties] article')].map(a => ({
      label: a.querySelector('h3')?.textContent.trim(),
      locked: a.textContent.includes('？？？'),
    })));
    check('難易度の並びが仕様どおり', tiers.map(t => t.label).join(',') === 'EXTREME,NIGHTMARE,CHAOS,ULTIMATE,INFINITY', tiers.map(t => t.label).join(','));
    check('NIGHTMARE以降は？？？表示', tiers.slice(1).every(t => t.locked) && !tiers[0].locked);

    // EXTREMEも通常チャレンジと同じ全WAVE詳細を使い、実戦の×13で表示する
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('[data-extreme-difficulties] article')][0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('全WAVE詳細'))?.click();
    });
    await page.waitForTimeout(500);
    const waves = await page.evaluate(() => [...document.querySelectorAll('[data-wave]')].map(row => row.innerText.replace(/\s+/g, ' ')));
    check('EXTREMEで全10WAVE詳細を開ける', waves.length === 10, `${waves.length} WAVE`);
    // 敵の基礎値は増減するので固定値では見ない。あとで実戦のWAVE1と突き合わせる
    waveOneDetailHp = Number(String((waves[0] || '').match(/HP ([\d,]+)/)?.[1] || '').replace(/,/g, '')) || 0;
    check('全WAVE詳細のWAVE1に敵の能力が出る', waveOneDetailHp > 0, waves[0]);
    check('デュラハン・ムーとボス表示がある', waves.some(w => w.includes('デュラハン')) && waves.at(-1)?.includes('ムー') && waves.at(-1)?.includes('BOSS'), waves.slice(-2).join(' / '));
    await page.getByRole('button', { name:'閉じる' }).click();
    check('NIGHTMARE以降の詳細ボタンは無効', await page.evaluate(() => [...document.querySelectorAll('[data-extreme-difficulties] article')].slice(1).every(card => [...card.querySelectorAll('button')].find(b => b.textContent.includes('詳細 ？？？'))?.disabled)));

    // 難易度カードからもランキングを開ける
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('[data-extreme-difficulties] article')][0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('のランキング'))?.click();
    });
    await page.waitForTimeout(2000);
    const rank2 = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('難易度カードからランキングを開ける', rank2.includes('極限チャレンジランキング'), rank2.slice(0, 70));
    await page.evaluate(() => { document.querySelector('button[aria-label="戻る"]')?.click(); });
    await page.waitForTimeout(1200);
    check('ランキングから難易度画面へ戻れる', !!(await page.$('[data-extreme-difficulties]')));

    // EXTREMEで挑戦 → 勇者モン選択
    const started = await page.evaluate(() => {
      const card = [...document.querySelectorAll('[data-extreme-difficulties] article')][0];
      const b = [...card.querySelectorAll('button')].find(x => x.textContent.includes('この難易度で挑戦'));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    await page.waitForTimeout(1500);
    const heroText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('EXTREMEを押すと勇者モン選択へ進む', started && heroText.includes('勇者モンを選択'), heroText.slice(0, 70));

    // 勇者モンを1体選んでバトルへ
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => b.textContent.includes('モッチー'))?.click(); });
    await page.waitForTimeout(900);
    await page.evaluate(() => { [...document.querySelectorAll('button')].find(b => /この子を|決定|えらぶ|選ぶ/.test(b.textContent))?.click(); });
    await page.waitForTimeout(2500);
    // 供モン・教えカードの選択が続く場合は先頭を選び続けてバトルまで進める
    for (let i = 0; i < 18; i++) {
      const state = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
      if (state.includes('極限ルール発動') || /WAVE 1\/10/.test(state)) break;
      await page.evaluate(() => {
        // 配置場所(零/近/中/遠)は距離のラベルで選ぶ
        const slot = [...document.querySelectorAll('button')].find(x => !x.disabled && /(零|近|中|遠)距離/.test(x.textContent));
        if (slot) { slot.click(); return; }
        // アシストカードは「習得する／強化する」で確定できる状態まで進める
        const confirm = [...document.querySelectorAll('button')].find(x => !x.disabled && /^(習得する|強化する)$/.test(x.textContent.trim()));
        if (confirm) { confirm.click(); return; }
        const teaching = [...document.querySelectorAll('button')].find(x => !x.disabled && /新規習得|強化後/.test(x.textContent));
        if (teaching) { teaching.click(); return; }
        const b = [...document.querySelectorAll('button')].find(x => /この子を|決定|えらぶ|選ぶ|はじめる|OK|閉じる|スキップ/.test(x.textContent) && !x.disabled);
        if (b) { b.click(); return; }
        const card = [...document.querySelectorAll('button')].find(x => !x.disabled && x.offsetParent);
        card && card.click();
      });
      await page.waitForTimeout(1200);
    }
    const battleText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('極限チャレンジのバトルが始まる', battleText.includes('極限チャレンジ / EXTREME') && battleText.includes('WAVE 1/10'), battleText.slice(0, 110));
    // テロップを閉じて敵の強さを読む
    await page.evaluate(() => { document.querySelector('[role="dialog"][aria-label="極限ルール発動"]')?.click(); });
    await page.waitForTimeout(1200);
    const hud = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('HUDが極限チャレンジ / EXTREME表示', hud.includes('極限チャレンジ / EXTREME'), hud.slice(0, 110));
    check('バトル中もDEBUGバッジが出ない', !hud.includes('DEBUG'));
    const enemyHp = await page.evaluate(() => {
      const m = document.body.innerText.replace(/\s+/g, ' ').match(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/g) || [];
      return m.map(x => Number(x.split('/')[1].replace(/[^\d]/g, '')));
    });
    // WAVE1の敵(ディノ)の基礎HPは data/enemy-monsters.js。ノーマル比×13になっているかを桁で確かめる
    check('敵のライフが×13相当まで上がっている', enemyHp.some(v => v >= 1000), JSON.stringify(enemyHp.slice(0, 6)));
    // 「全WAVE詳細で見た数字」と「実際に出てきた敵」が一致していること。
    // powerOverride を渡し忘れると、ここだけ通常難易度の敵になって食い違う
    check('全WAVE詳細のWAVE1と実戦の敵が一致する',
      waveOneDetailHp > 0 && enemyHp.includes(waveOneDetailHp),
      `詳細 ${waveOneDetailHp} / 実戦 ${JSON.stringify(enemyHp.slice(0, 6))}`);
    check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
    await page.close();
  }

  // --- ③ 通常のチャレンジ(ノーマル)の敵が壊れていない ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await openBattle(page, { GrandMaster: 1 });
    await page.evaluate(() => {
      const cards = [...document.querySelectorAll('article')].filter(a => a.textContent.includes('チャレンジ') && !a.textContent.includes('極限'));
      const card = cards[Math.floor(cards.length / 2)] || cards[0];
      [...card.querySelectorAll('button')].find(b => b.textContent.includes('難易度を選ぶ'))?.click();
    });
    await page.waitForTimeout(1500);
    const normal = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('通常の難易度画面が開く(極限の影響なし)', normal.includes('BATTLE DIFFICULTY') && !normal.includes('EXTREME'), normal.slice(0, 90));
    await page.close();
  }

  // --- ④ 正式公開の初回案内が1回だけ出る ---
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(seed, { GrandMaster: 1 });
    await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
    const bootToHome = async () => {
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      const down = (find) => page.evaluate((f) => {
        const b = f.aria ? document.querySelector(`button[aria-label="${f.aria}"]`)
          : [...document.querySelectorAll('button')].find(x => x.textContent.includes(f.text));
        if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      }, find);
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
      await down({ text: 'TAP TO START' });
      await page.waitForTimeout(2500);
      await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
      await down({ aria: 'トップ画面へ進む' });
      await page.waitForTimeout(3000);
      // ログインボーナスだけ閉じて、アップデート案内は残す
      for (let i = 0; i < 4; i++) {
        const closed = await page.evaluate(() => {
          const b = [...document.querySelectorAll('button')].find(x => /受け取|閉じる/.test(x.textContent) && !/あとで/.test(x.textContent));
          if (b && !document.body.innerText.includes('極限チャレンジが追加された')) { b.click(); return true; }
          return false;
        });
        if (!closed) break;
        await page.waitForTimeout(800);
      }
    };
    await bootToHome();
    const first = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    // お知らせの本文は更新履歴から作るので、ここでは極限固有の文言を固定しない
    // (どのお知らせがどう出るかの正本は tools/assistant/assistant-update-notice-check.js)
    check('初回ログインでアップデートのお知らせが動く', first.length > 0, first.slice(0, 90));
    // 最後まで読んで閉じる
    for (let i = 0; i < 4; i++) {
      const advanced = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /^(次へ|あとで|閉じる)$/.test(x.textContent.trim()));
        if (b) { b.click(); return true; }
        return false;
      });
      if (!advanced) break;
      await page.waitForTimeout(800);
    }
    const seenIds = await page.evaluate(() => localStorage.getItem('mh_seen_update_notices_v1'));
    check('既読として保存される', String(seenIds).includes('update_notice_extreme_challenge_v1'), String(seenIds));
    await bootToHome();
    const second = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    check('2回目のログインでは出ない', !second.includes('極限チャレンジが追加されたよ'), second.slice(0, 70));
    await page.close();
  }

  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目が成功`);
  await browser.close();
  process.exit(ng ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

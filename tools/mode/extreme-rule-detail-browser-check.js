// 極限チャレンジの「ルール詳細」を実ブラウザで開いて、押せて・正しい中身が出て・
// 閉じても難易度の選択が変わらないことを確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/extreme-rule-detail-browser-check.js
//
// このサンドボックスはTailwindのCDNへ出られないため、クラスによる**見た目(px)は再現できない**。
// そのためここでは「操作できるか」「出る内容が難易度ごとに正しいか」だけを実際に触って確かめ、
// iPhone縦画面での寸法は tools/mode/ultimate-card-layout-check.js の静的検査で担保する。
// 実機での見た目確認の代わりにはならない。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

// 記録は「そこまでクリア済み」の状態を作る。壊れた値を混ぜないよう既存の保存形式のまま入れる
const seed = (extremeClears) => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_clears_GrandMaster', JSON.stringify(3));
  Object.entries(extremeClears).forEach(([id, count]) => localStorage.setItem(`mh_extreme_clears_${id}`, JSON.stringify(count)));
};

const openDifficultySelect = async (page, extremeClears) => {
  await page.addInitScript(seed, extremeClears);
  await page.route('**cdn.tailwindcss.com**', r => r.abort()).catch(() => {});
  await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
  const tap = (sel) => page.evaluate((s) => {
    const btn = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
      : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
    if (btn) btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    return !!btn;
  }, sel);
  await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
  await tap({ text: 'TAP TO START' });
  await page.waitForTimeout(2200);
  await tap({ aria: 'トップ画面へ進む' });
  await page.waitForTimeout(2200);
  // ログインボーナス・きき加入・アップデート案内などの重なりを、出なくなるまで閉じる
  for (let i = 0; i < 40; i++) {
    const closed = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;
      const button = [...dialog.querySelectorAll('button')]
        .find(x => /受け取|閉じる|とじる|あとで|つぎへ|次へ|OK/.test(x.textContent)) || dialog.querySelector('button');
      if (button) button.click(); else dialog.click();
      return true;
    });
    if (!closed) break;
    await page.waitForTimeout(450);
  }
  await page.evaluate(() => document.querySelector('button[aria-label="バトル"]')?.click());
  await page.waitForTimeout(1200);
  // モード選択のカルーセルから極限チャレンジへ入る
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('極限チャレンジ'));
    const button = card && [...card.querySelectorAll('button')].find(x => /挑戦|難易度/.test(x.textContent));
    (button || card?.querySelector('button'))?.click();
  });
  await page.waitForTimeout(1200);
};

const cardsInfo = () => [...document.querySelectorAll('[data-extreme-difficulty-card]')]
  .map(card => ({
    id: card.getAttribute('data-extreme-difficulty-card'),
    text: card.innerText.replace(/\s+/g, ' ').trim(),
    ruleSummary: card.querySelector('[data-extreme-special-rules]')?.innerText.replace(/\s+/g, ' ').trim() || '',
    buttons: [...card.querySelectorAll('button')].map(b => b.textContent.trim()),
    detailDisabled: card.querySelector('[data-extreme-rule-detail-open]')?.disabled ?? null,
  }));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // ---- ① 全難易度が解放済みの状態 ----
    const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await openDifficultySelect(page, { EXTREME: 3, NIGHTMARE: 3, CHAOS: 3, ULTIMATE: 3 });
    const cards = await page.evaluate(cardsInfo);
    check('極限の難易度カードが5枚出る', cards.length === 5, cards.map(c => c.id).join(', '));
    check('INFINITYのカードがある', cards.some(c => c.id === 'INFINITY'));
    check('ULTIMATEクリア済みならINFINITYのルール詳細を押せる',
      cards.find(c => c.id === 'INFINITY')?.detailDisabled === false);
    check('どのカードにもルール詳細・全WAVE詳細・挑戦・ランキングがある',
      cards.every(c => c.buttons.some(t => t.includes('ルール詳細')) && c.buttons.some(t => t.includes('全WAVE詳細'))
        && c.buttons.some(t => t.includes('この難易度で挑戦')) && c.buttons.some(t => t.includes('ランキング'))));
    check('カードには特殊ルールの本文を並べず、あることだけを出す',
      cards.every(c => /特殊ルールあり/.test(c.ruleSummary))
      && cards.find(c => c.id === 'INFINITY')?.ruleSummary.includes('複合特殊ルールあり')
      && cards.every(c => !c.text.includes('累計Tごと') && !c.text.includes('経過Tごと')),
      cards.find(c => c.id === 'INFINITY')?.ruleSummary);

    // ---- ② 5難易度すべてでルール詳細を開く ----
    const opened = {};
    for (const id of ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY']) {
      await page.evaluate((target) => {
        document.querySelector(`[data-extreme-rule-detail-open="${target}"]`)?.click();
      }, id);
      await page.waitForTimeout(400);
      opened[id] = await page.evaluate(() => {
        const sheet = document.querySelector('[data-extreme-rule-detail]');
        if (!sheet) return null;
        const body = sheet.querySelector('[data-extreme-rule-detail-body]');
        return {
          id: sheet.getAttribute('data-extreme-rule-detail'),
          heading: sheet.querySelector('h2')?.textContent.trim() || '',
          groups: [...sheet.querySelectorAll('h3')].map(h => h.textContent.trim()),
          text: body?.innerText.replace(/\s+/g, ' ').trim() || '',
          // このサンドボックスはTailwindのCDNへ出られず overflow-y-auto が効かないため、
          // 実際のスクロール可否ではなく「本文がその入れ物の中にあるか」だけを見る
          scrollable: !!body && body.className.includes('overflow-y-auto') && body.className.includes('min-h-0'),
          closeButtons: [...sheet.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()),
        };
      });
      await page.evaluate(() => {
        const sheet = document.querySelector('[data-extreme-rule-detail]');
        [...sheet.querySelectorAll('button')].find(b => b.textContent.trim() === '閉じる')?.click();
      });
      await page.waitForTimeout(300);
    }
    check('5難易度すべてでルール詳細が開く',
      ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY'].every(id => opened[id]?.id === id));
    check('見出しにその難易度の名前が出る',
      ['EXTREME', 'NIGHTMARE', 'CHAOS', 'ULTIMATE', 'INFINITY'].every(id => opened[id]?.heading.includes(id)));
    check('難易度ごとに違う内容が出る',
      new Set(Object.values(opened).map(o => o?.text)).size === 5);
    check('INFINITYの詳細に主要ルールがすべて載る',
      ['アシストカード効果', '距離強化', '消費ガッツ', '最低10%', '30%で停止', '25Tごと', '安全距離']
        .every(text => opened.INFINITY?.text.includes(text)),
      opened.INFINITY?.groups.join(' / '));
    check('本文は縦スクロールできる入れ物に入っている（CSS未適用のため実スクロールは未確認）',
      Object.values(opened).every(o => o?.scrollable));
    check('閉じる操作が2つある（右上の×と下の閉じるボタン）',
      Object.values(opened).every(o => o?.closeButtons.includes('閉じる') && o.closeButtons.filter(t => t === '閉じる').length >= 2));

    // ---- ③ 閉じたあとに選択中の難易度が変わっていない ----
    await page.evaluate(() => document.querySelector('[data-extreme-rule-detail-open="CHAOS"]')?.click());
    await page.waitForTimeout(400);
    const beforeClose = await page.evaluate(() => [...document.querySelectorAll('[data-extreme-page-dots] button')]
      .findIndex(b => b.className.includes('bg-fuchsia-300')));
    await page.evaluate(() => {
      const sheet = document.querySelector('[data-extreme-rule-detail]');
      sheet.querySelector('button[aria-label="閉じる"]')?.click();
    });
    await page.waitForTimeout(400);
    const afterClose = await page.evaluate(() => ({
      dot: [...document.querySelectorAll('[data-extreme-page-dots] button')].findIndex(b => b.className.includes('bg-fuchsia-300')),
      sheet: !!document.querySelector('[data-extreme-rule-detail]'),
      onSelect: !!document.querySelector('[data-extreme-difficulties]'),
    }));
    check('ルール詳細を閉じるとシートだけ消えて難易度選択に戻る', afterClose.sheet === false && afterClose.onSelect === true);
    check('ルール詳細を開いても選択中の難易度が変わらない', beforeClose === afterClose.dot, `${beforeClose} → ${afterClose.dot}`);
    await page.close();

    // ---- ④ ULTIMATE未クリアならINFINITYはロック ----
    const locked = await browser.newPage({ viewport: { width: 393, height: 852 } });
    await openDifficultySelect(locked, { EXTREME: 3, NIGHTMARE: 3, CHAOS: 3 });
    const lockedCards = await locked.evaluate(cardsInfo);
    const lockedInfinity = lockedCards.find(c => c.id === 'INFINITY');
    check('ULTIMATE未クリアならINFINITYは選べない', lockedInfinity?.detailDisabled === true);
    check('INFINITYの解放条件が読める', /ULTIMATEクリアで解放/.test(lockedInfinity?.text || ''), lockedInfinity?.text.slice(0, 60));
    check('ULTIMATEまでの解放状態は変わらない',
      lockedCards.find(c => c.id === 'ULTIMATE')?.detailDisabled === false
      && lockedCards.find(c => c.id === 'CHAOS')?.detailDisabled === false);
    await locked.close();
  } finally {
    await browser.close();
  }
  const failed = results.filter(ok => !ok).length;
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK（見た目の寸法はこの環境では測れないため未確認）');
  process.exit(failed ? 1 : 0);
})();

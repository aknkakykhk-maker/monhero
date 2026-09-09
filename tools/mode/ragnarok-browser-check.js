// RAGNAROKを実ブラウザで開き、カードが解放され・ルール詳細に黄昏と不死が出て・
// 選んでもほかの難易度の状態が壊れないことを確かめる。
//
//   python3 tools/serve.py を起動した状態で
//   node tools/mode/ragnarok-browser-check.js
//
// このサンドボックスはTailwindのCDNへ出られないため、見た目(px)は再現できない。
// ここで見るのは「操作できるか」「出る中身が正しいか」だけで、実機確認の代わりにはならない。
const { chromium } = require('playwright');

const PAGE_URL = process.env.SMOKE_URL || 'http://localhost:8899/monster-hero/index.html';
const results = [];
const check = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ' — ' + detail : ''}`); };

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
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('article')].find(a => a.textContent.includes('極限チャレンジ'));
    const button = card && [...card.querySelectorAll('button')].find(x => /挑戦|難易度/.test(x.textContent));
    (button || card?.querySelector('button'))?.click();
  });
  await page.waitForTimeout(1200);
};

const cardsInfo = () => [...document.querySelectorAll('[data-extreme-difficulty-card]')].map(card => ({
  id: card.getAttribute('data-extreme-difficulty-card'),
  text: card.innerText.replace(/\s+/g, ' ').trim(),
  ruleSummary: card.querySelector('[data-extreme-special-rules]')?.innerText.replace(/\s+/g, ' ').trim() || '',
  detailDisabled: card.querySelector('[data-extreme-rule-detail-open]')?.disabled ?? null,
}));

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  try {
    // ---- ① GOD未クリア: RAGNAROKは並ぶが選べない ----
    {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      await openDifficultySelect(page, { EXTREME: 3, NIGHTMARE: 3, CHAOS: 3, ULTIMATE: 3, INFINITY: 3 });
      const cards = await page.evaluate(cardsInfo);
      const ragnarok = cards.find(c => c.id === 'RAGNAROK');
      check('RAGNAROKのカードが並ぶ', !!ragnarok, cards.map(c => c.id).join(', '));
      check('GOD未クリアではRAGNAROKを選べない', ragnarok?.detailDisabled !== false && ragnarok?.text.includes('GODクリアで解放'), ragnarok?.text.slice(0, 80));
      check('GODはINFINITYクリアで解放されたまま', cards.find(c => c.id === 'GOD')?.detailDisabled === false);
      check('この時点で致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
      await page.close();
    }

    // ---- ② GODクリア済み: 解放され、ルール詳細に黄昏と不死が出る ----
    {
      const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
      const fatal = [];
      page.on('pageerror', (e) => fatal.push(e.message));
      await openDifficultySelect(page, { EXTREME: 3, NIGHTMARE: 3, CHAOS: 3, ULTIMATE: 3, INFINITY: 3, GOD: 1 });
      const cards = await page.evaluate(cardsInfo);
      const god = cards.find(c => c.id === 'GOD');
      const ragnarok = cards.find(c => c.id === 'RAGNAROK');
      check('GODを1回クリアするとRAGNAROKが解放される', ragnarok?.detailDisabled === false, ragnarok?.text.slice(0, 80));
      check('GODのカードに勇者の証1個を表示する', god?.text.replace(/\s+/g,'').includes('🏅勇者の証：1個'), god?.text.slice(0, 100));
      check('RAGNAROKのカードに勇者の証2個を表示する', ragnarok?.text.replace(/\s+/g,'').includes('🏅勇者の証：2個'), ragnarok?.text.slice(0, 100));
      check('カードには特殊ルールがあることだけを出す',
        /複合特殊ルールあり/.test(ragnarok?.ruleSummary || '') && !/累計Tごと|経過Tごと/.test(ragnarok?.text || ''),
        ragnarok?.ruleSummary);

      // ルール詳細を開く
      await page.evaluate(() => {
        const card = document.querySelector('[data-extreme-difficulty-card="RAGNAROK"]');
        card?.querySelector('[data-extreme-rule-detail-open]')?.click();
      });
      await page.waitForTimeout(700);
      const sheet = await page.evaluate(() => {
        const el = document.querySelector('[data-extreme-rule-detail]') || document.querySelector('[role="dialog"]');
        return el ? el.innerText.replace(/\s+/g, ' ').trim() : '';
      });
      check('ルール詳細が開く', sheet.length > 0);
      check('見出しにRAGNAROKが出る', sheet.includes('RAGNAROK'), sheet.slice(0, 60));
      check('黄昏の説明が出る', sheet.includes('黄昏') && sheet.includes('+20% / +40% / +60% / +80% / +100%'));
      check('不死の説明が出る', sheet.includes('死者の再起') && sheet.includes('WAVE5（1回） / WAVE10（2回）'));
      check('安全距離なしと書いてある', sheet.includes('なし（4距離すべて弱体化する）'));
      check('操作中に致命的なJSエラーが出ない', fatal.length === 0, fatal.slice(0, 2).join(' / '));
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const ng = results.filter(r => !r).length;
  console.log(`\n${results.length - ng}/${results.length} 項目OK（見た目の寸法はこの環境では測れないため未確認）`);
  process.exit(ng ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

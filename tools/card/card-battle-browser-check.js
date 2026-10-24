// MFバトルカード(CARD_TOP / CARD_BATTLE。いまはデバッグ設定からだけ入れる)を、実際のブラウザで通して確かめる。
//
//   node tools/card/card-battle-browser-check.js            確かめる
//   CARD_SHOT_DIR=<フォルダ> node tools/card/card-battle-browser-check.js   画面の写真も撮る(社長に見せる用)
//
// 見るもの
//   ① デバッグ設定の入口(data-debug-card-battle)から開ける。はじめてはスターター選びが出る
//   ② スターターを選ぶと、カード53枚・デッキ1つ・カードポイント300が保存される(mh_card_* の新しいキーだけ)
//   ③ もう一度開いても、スターター選びは出ない(二度と配らない)
//   ④ 相手えらび → 対戦が始まり、手札5枚・場の6体・相手の帯が出る。カードの絵が読める
//   ⑤ 自分の番を何ターンか進められる(技を出す・守る/守らない・ガッツにする)。どこでも実行時エラーが出ない
//   ⑥ 長押しで詳しい画面・捨て札の一覧が開いて閉じる
//   ⑦ 投了すると結果が出て、カードポイントは増えない・戦績に投了が1つ付く
//   ⑧ 既存の保存キー(mh_card_ 以外)を1つも書き換えていない
const http = require('http');
const path = require('path');
const fs = require('fs');
const { eventStorySeed } = require(path.resolve(__dirname, '..', 'boot/quiet-boot-seed'));

const root = path.resolve(__dirname, '..', '..');
const PORT = 8994;
const SHOT = process.env.CARD_SHOT_DIR || '';
// 画面の大きさ(既定は iPhone 13 の 390×844。SE は CARD_VIEWPORT=375x667)
const [VW, VH] = (process.env.CARD_VIEWPORT || '390x844').split('x').map(Number);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.PNG': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const serve = () => new Promise((resolve) => {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  server.listen(PORT, () => resolve(server));
});

let failed = 0;
let lastPage = null;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

(async () => {
  let playwright;
  try { playwright = require('playwright'); } catch { console.log('SKIP: playwright が入っていないので確認できません'); process.exit(0); }
  const server = await serve();
  const errors = [];
  let browser;
  // 対戦の画面で、相手の場・まんなか・自分の場・手札・下のボタンが上から順に並び、重なっていないか
const layoutIssues = async (page) => page.evaluate(() => {
  const box = (sel) => { const els = [...document.querySelectorAll(sel)]; if (!els.length) return null; const r = els.map((e) => e.getBoundingClientRect()); return { top: Math.min(...r.map((x) => x.top)), bottom: Math.max(...r.map((x) => x.bottom)) }; };
  const opp = box('[data-card-mon^="1-"]'), stage = box('[data-card-stage]'), me = box('[data-card-mon^="0-"]'), hand = box('[data-card-hand]'), foot = box('[data-card-footer]');
  const out = [];
  if (!opp || !stage || !me || !hand || !foot) return ['部品が見つからない'];
  if (opp.bottom > stage.top + 1) out.push('相手の場がまんなかにかかる');
  if (stage.bottom > me.top + 1) out.push('まんなかが自分の場にかかる');
  if (me.bottom > hand.top + 1) out.push(`自分の場が手札にかかる(${Math.round(me.bottom - hand.top)}px)`);
  if (hand.bottom > foot.top + 1) out.push('手札がボタンにかかる');
  if (foot.bottom > window.innerHeight + 1) out.push('ボタンが画面の外');
  if (stage.bottom - stage.top < 60) out.push(`まんなかが狭い(${Math.round(stage.bottom - stage.top)}px)`);
  return out;
});
const layoutSeen = [];
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`) }).catch(() => {}); } };
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: VW, height: VH } });
    lastPage = page;
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      if (sessionStorage.getItem('__cardSeeded')) return;
      sessionStorage.setItem('__cardSeeded', '1');
      localStorage.setItem('mh_breeder_name', JSON.stringify('検査ブリーダー'));
      localStorage.setItem('mh_breeder_icon', JSON.stringify('🐣'));
      localStorage.setItem('mh_onboarded', JSON.stringify(true));
      localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
      localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_v1', JSON.stringify(true));
      localStorage.setItem('mh_inherited_unique_level_compensation_pending_v1', JSON.stringify(false));
    });
    await page.addInitScript(eventStorySeed());
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'TAP TO START' }).click({ timeout: 60000 });
    await page.getByRole('button', { name: 'トップ画面へ進む' }).click({ timeout: 30000 });
    await page.getByRole('button', { name: 'モンヒロバトル' }).waitFor({ timeout: 30000 });
    for (let i = 0; i < 6; i++) {
      const btn = page.getByRole('button', { name: /受け取る|閉じる|はじめる|OK/ }).first();
      if (await btn.count() === 0 || !(await btn.isVisible().catch(() => false))) break;
      await btn.dispatchEvent('click').catch(() => {});
      await page.waitForTimeout(250);
    }
    // ここまでの保存(既存のキー)を控える。カードバトルが書くのは mh_card_* だけのはず
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])));
    const openCard = async () => {
      await page.getByRole('button', { name: '設定' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'ヘルプ' }).first().waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: 'ヘルプ' }).first().dispatchEvent('click');
      await page.getByRole('button', { name: 'わかった！冒険に戻る' }).waitFor({ timeout: 20000 });
      await page.locator('footer button[aria-label=""]').dispatchEvent('click');
      await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
      await page.locator('summary').filter({ hasText: '⚔️ バトル' }).first().click();
      await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    };
    await openCard();
    await page.locator('[data-card-top="starter"]').waitFor({ timeout: 20000 });
    check('① デバッグ設定から開ける・はじめてはスターター選びが出る', true);
    await page.waitForTimeout(600);
    await shot(page, '01-starter');
    await page.locator('[data-card-kit="powerful"]').click();
    await page.getByRole('button', { name: /にする$/ }).click();
    // ⑪ スターターを選ぶと、そのまま練習試合(チュートリアル)。5つの段を操作で通す
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await shot(page, '11-tutorial-start');
    const tutorSeen = new Set();
    const tutorIssues = new Set();
    const tutorNoFocus = new Set();
    const tutorShot = new Set();
    const focusShot = new Set();
    let noFocusPrev = null; // 切り替わりの一瞬は数えない(2回続けて光っていないときだけ)
    let wrongShown = false;
    const tDeadline = Date.now() + 120000;
    while (Date.now() < tDeadline) {
      if (await page.locator('[data-card-top="result"]').count()) break;
      const stageId = await page.locator('[data-card-tutor]').getAttribute('data-card-tutor').catch(() => null);
      if (stageId) tutorSeen.add(stageId);
      // ドラの窓が画面の中に全部入っていて、ほかの物の下に隠れていないか(社長の実機で、窓が切れて「次へ」が押せなかった)
      const panelIssue = await page.evaluate(() => {
        const el = document.querySelector('[data-card-tutor]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        if (r.top < 0 || r.bottom > window.innerHeight + 1) return `窓が画面の外(${Math.round(r.top)}〜${Math.round(r.bottom)})`;
        for (const [x, y] of [[r.left + 8, r.top + 4], [r.left + 8, r.bottom - 4], [r.left + r.width / 2, r.top + r.height / 2]]) {
          const hit = document.elementFromPoint(x, y);
          if (!hit || !el.contains(hit)) return `窓の上に別の物(${hit ? hit.tagName : 'なし'})`;
        }
        const b = el.querySelector('[data-card-tutor-next]');
        if (b) { const q = b.getBoundingClientRect(); const hit = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2); if (!hit || !b.contains(hit)) return '「次へ」が押せない'; }
        return '';
      });
      if (panelIssue) tutorIssues.add(`${stageId}: ${panelIssue}`);
      const next = page.locator('[data-card-tutor-next]');
      if (await next.count()) { await next.click(); await page.waitForTimeout(250); continue; }
      // 操作の段では、教えている所(カードか下のボタン)が光っている
      const focused = await page.locator('[data-card-tutor-focus], [data-card-battle] button.animate-pulse').count();
      if (!focused && !(await page.locator('[data-card-bubble]').count()) && ['guts', 'guard', 'attack', 'deckEnd'].includes(stageId) && (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) !== 'wait') { if (noFocusPrev === stageId && SHOT && !tutorNoFocus.size) await shot(page, `zz-nofocus-${stageId}`); if (noFocusPrev === stageId) tutorNoFocus.add(`${stageId}(${await page.locator('[data-card-battle]').getAttribute('data-card-mode')})`); noFocusPrev = stageId; } else noFocusPrev = null;
      // 光った瞬間ごとの写真(段・手番・光っている物の組が変わるたび。社長に「何が光っているか」を見せる)
      if (SHOT && focused) {
        const sig = `${stageId}-${await page.locator('[data-card-battle]').getAttribute('data-card-mode')}-${await page.locator('[data-card-tutor-focus]').count()}`;
        if (!focusShot.has(sig)) { focusShot.add(sig); await shot(page, `f-${String(focusShot.size).padStart(2, '0')}-${sig}`); }
      }
      if (SHOT && stageId && !tutorShot.has(stageId)) { tutorShot.add(stageId); await shot(page, `t-${String(tutorShot.size).padStart(2, '0')}-${stageId}`); }
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
      const handCard = (name) => page.locator('[data-card-hand-card]').filter({ hasText: name }).first();
      if (stageId === 'guts' && mode === 'attack') {
        if (!wrongShown) { // ちがうカード(パンチ)を押すと、ドラが案内する
          await handCard('パンチ').click(); await page.waitForTimeout(150);
          wrongShown = /光ってる所/.test(await page.locator('[data-card-battle]').innerText());
          if (wrongShown) await shot(page, '12-tutorial-wrong');
        }
        const b = page.getByRole('button', { name: '攻撃おわり → ガッツへ' }); if (await b.isEnabled()) await b.click(); await page.waitForTimeout(250); continue;
      }
      if (stageId === 'guts' && mode === 'guts') { if (!(await page.locator('[data-card-tutor-focus]').count()) && !(await page.getByRole('button', { name: /ターン終了$/ }).isEnabled())) { await page.waitForTimeout(250); continue; } await handCard('キック').click(); await handCard('チョップ').click(); await page.getByRole('button', { name: /ターン終了$/ }).click(); await page.waitForTimeout(300); continue; }
      if (stageId === 'guard' && mode === 'guard') {
        if (await page.locator('[data-card-bubble]').count()) { await page.waitForTimeout(250); continue; }
        if (await page.getByRole('button', { name: 'これで守る' }).count()) { const b = page.getByRole('button', { name: 'これで守る' }); if (await b.isEnabled()) await b.click(); }
        else { await shot(page, '13-tutorial-guard'); await handCard('ステップ').click(); }
        await page.waitForTimeout(300); continue;
      }
      if (stageId === 'attack' && mode === 'attack') {
        if (!(await handCard('パンチ').count())) { await page.waitForTimeout(250); continue; }
        await handCard('パンチ').click(); await page.waitForTimeout(150);
        const tgt = page.locator('[data-card-mon].ring-rose-400').first();
        if (await tgt.count()) await tgt.click();
        await page.waitForTimeout(400); continue;
      }
      if (stageId === 'deckEnd' && mode === 'attack') { const b = page.getByRole('button', { name: '攻撃おわり → ガッツへ' }); if (await b.isEnabled()) await b.click(); await page.waitForTimeout(250); continue; }
      if (stageId === 'deckEnd' && mode === 'guts') { const b = page.getByRole('button', { name: /ターン終了$/ }); if (await b.isEnabled()) await b.click(); await page.waitForTimeout(400); continue; }
      await page.waitForTimeout(250);
    }
    const tutOutcome = await page.locator('[data-card-top="result"]').getAttribute('data-card-outcome').catch(() => null);
    await shot(page, '14-tutorial-result');
    check('⑪ 練習試合を最後まで操作で通せる(5つの段)', tutOutcome === 'tutorialDone' && ['draw', 'guts', 'guard', 'attack', 'deckEnd', 'finish'].every((k) => tutorSeen.has(k)), `${tutOutcome}・${[...tutorSeen].join('→')}`);
    check('⑪ ちがう所を押すと、ドラが「光ってる所」と案内する', wrongShown);
    check(`⑪ ${VW}×${VH} で、ドラの窓が全部見えて「次へ」が押せる(どの台詞でも)`, tutorIssues.size === 0, [...tutorIssues].slice(0, 4).join(' / '));
    check('⑪ 操作の段では、教えている所が光っている', tutorNoFocus.size === 0, [...tutorNoFocus].join('・'));
    const tut = await page.evaluate(() => ({ t: JSON.parse(localStorage.getItem('mh_card_tutorial_v1') || 'null'), point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0') }));
    check('⑪ はじめて最後までやると 100(印 done・rewarded)', tut.t && tut.t.done && tut.t.rewarded && tut.point === 400, JSON.stringify(tut));
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // もう一度 → 飛ばす: 100 は二度ともらえない
    await page.locator('[data-card-tutorial-again]').click();
    await page.locator('[data-card-tutor]').waitFor({ timeout: 20000 });
    await page.locator('[data-card-quit]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '飛ばす' }).click();
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    const tut2 = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'));
    check('⑪ もう一度やっても(飛ばしても)100 は二度ともらえない', tut2 === 400, String(tut2));
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    const saved = await page.evaluate(() => ({
      col: JSON.parse(localStorage.getItem('mh_card_collection_v1') || '{}'),
      decks: JSON.parse(localStorage.getItem('mh_card_decks_v1') || 'null'),
      point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'),
      starter: JSON.parse(localStorage.getItem('mh_card_starter_v1') || 'null'),
    }));
    const total = Object.values(saved.col).reduce((s, v) => s + v, 0);
    check('② スターターを選ぶとカード53枚・デッキ1つ・カードポイント300(＋練習試合の100)', total === 53 && saved.decks && saved.decks.decks.length === 1 && saved.point === 400 && saved.starter && saved.starter.kit === 'powerful', JSON.stringify({ total, point: saved.point, starter: saved.starter }));
    check('② トップにカードポイント400(300＋練習試合の100)と出る', (await page.locator('[data-card-point]').innerText()).trim() === '400');
    await shot(page, '02-top');
    // ③ 戻ってもう一度開く
    await page.getByRole('button', { name: 'デバッグ設定へ戻る' }).click();
    await page.getByText('DEBUG MENU').first().waitFor({ timeout: 20000 });
    await page.locator('[data-debug-card-battle]').dispatchEvent('click');
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    check('③ 2回目はスターター選びが出ない', await page.locator('[data-card-top="starter"]').count() === 0);
    // ④ 相手えらび → 対戦
    await page.locator('[data-card-cpu]').click();
    await page.locator('[data-card-top="foe"]').waitFor({ timeout: 10000 });
    const foes = await page.locator('[data-card-foe]').count();
    check('④ 相手の助手が並ぶ', foes >= 4, `${foes}人`);
    await page.locator('[data-card-foe="momosuke"]').click();
    await page.waitForTimeout(500);
    await shot(page, '03-foe');
    await page.locator('[data-card-start]').click();
    await page.locator('[data-card-battle]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    const hand = await page.locator('[data-card-hand-card]').count();
    const mons = await page.locator('[data-card-mon]').count();
    check('④ 対戦が始まり、手札5枚・場の6体が出る', hand === 5 && mons === 6, `手札${hand}・場${mons}`);
    await shot(page, '04-battle-start');
    layoutSeen.push(...(await layoutIssues(page)).map((x) => `始まり: ${x}`));
    // ⑥ 長押しで詳しい画面
    const card0 = page.locator('[data-card-hand-card="0"]');
    const box = await card0.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 30);
    await page.mouse.down(); await page.waitForTimeout(650); await page.mouse.up();
    const detailOpen = await page.locator('[data-card-detail]').count();
    check('⑥ 手札の長押しで詳しい画面が開く', detailOpen === 1);
    await page.waitForTimeout(400);
    await shot(page, '05-detail');
    await page.locator('[data-card-detail]').click({ position: { x: 20, y: 20 } });
    check('⑥ 詳しい画面はタップで閉じる', await page.locator('[data-card-detail]').count() === 0);

    // ⑤ 自分の番を進める(使えるカードを出す → 狙える相手 → 攻撃おわり → ガッツ)
    let myActions = 0, guards = 0, gutsTurns = 0, shotGuard = false, shotTarget = false, motionSeen = false, poseSeen = new Set();
    // ⑫ 運ぶ操作: 指(マウス)で手札を持って、置ける所まで運んで離す
    let dragAttack = null, dragGuts = null, dragNoGlow = null, dragTries = 0;
    const center = async (loc) => { const b = await loc.boundingBox(); return b ? { x: b.x + b.width / 2, y: b.y + b.height / 2 } : null; };
    const carry = async (from, to, mid = null, onMid = null) => {
      await page.mouse.move(from.x, from.y); await page.mouse.down();
      await page.mouse.move(from.x + 4, from.y - 20, { steps: 4 });
      if (mid) { await page.mouse.move(mid.x, mid.y, { steps: 6 }); if (onMid) await onMid(); }
      await page.mouse.move(to.x, to.y, { steps: 8 });
      const glow = await page.locator('[data-card-mon].ring-emerald-300, [data-card-guts-drop].ring-emerald-300').count();
      if (SHOT && !dragAttack) await shot(page, '15-drag');
      await page.mouse.up();
      return glow;
    };
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline && gutsTurns < 6) {
      const mode = await page.locator('[data-card-battle]').getAttribute('data-card-mode').catch(() => null);
      if (mode === null) break;
      (await page.locator('[data-card-pose]').evaluateAll((els) => els.map((e) => e.getAttribute('data-card-pose')))).forEach((x) => poseSeen.add(x));
      if ((await page.locator('[data-card-mon] [data-skill-fx]').count()) > 0) poseSeen.add('attack');
      if (mode === 'wait') { await page.waitForTimeout(150); continue; }
      if (mode === 'setup') { await page.getByRole('button', { name: /始める$/ }).click(); continue; }
      if (mode === 'discard') { const n = await page.locator('[data-card-hand-card]').count(); for (let i = 0; i < n; i++) await page.locator(`[data-card-hand-card="${i}"]`).click(); await page.getByRole('button', { name: /捨てる$/ }).click().catch(() => {}); continue; }
      if (mode === 'guard') {
        if (!shotGuard) { await shot(page, '07-guard'); layoutSeen.push(...(await layoutIssues(page)).map((x) => `守りの番: ${x}`)); shotGuard = true; }
        guards += 1;
        await page.getByRole('button', { name: '守らない' }).click();
        continue;
      }
      if (mode === 'guts' && dragGuts === null) {
        const card = page.locator('[data-card-hand-card="0"]');
        const from = await center(card); const to = await center(page.locator('[data-card-guts-drop]'));
        const glow = await carry(from, to);
        await page.waitForTimeout(150);
        dragGuts = glow > 0 && /-translate-y-3/.test(await card.getAttribute('class'));
        await page.getByRole('button', { name: /ターン終了$/ }).click();
        gutsTurns += 1;
        continue;
      }
      if (mode === 'guts') {
        const n = await page.locator('[data-card-hand-card]').count();
        if (n > 2) await page.locator('[data-card-hand-card="0"]').click();
        await page.getByRole('button', { name: /ターン終了$/ }).click();
        gutsTurns += 1;
        continue;
      }
      if (mode === 'attack') {
        // 明るい(使える)手札を1枚出す
        const usable = await page.locator('[data-card-hand-card]').evaluateAll((els) => els.map((e, i) => (e.className.includes('opacity-45') ? -1 : i)).filter((i) => i >= 0));
        let acted = false;
        if (dragAttack === null && usable.length) {
          // 技を相手のモンスターまで運ぶ。途中で自分の場(置けない所)の上を通るときは光らない
          const logBefore = await page.locator('[data-card-log]').innerText();
          const from = await center(page.locator(`[data-card-hand-card="${usable[0]}"]`));
          const mine = await center(page.locator('[data-card-mon="0-0"]'));
          let midGlow = 0;
          const tries = ['1-0', '1-1', '1-2'];
          for (const t of tries) {
            const to = await center(page.locator(`[data-card-mon="${t}"]`));
            const glow = await carry(from, to, mine, async () => { midGlow += await page.locator('[data-card-mon].ring-emerald-300').count(); });
            await page.waitForTimeout(300);
            const changed = (await page.locator('[data-card-log]').innerText()) !== logBefore || (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) !== 'attack';
            // 自分の子に使う札(回復など)は相手の上で光らないので、光って使えたときだけ成功にする(ほかは次の札で試し直す)
            if (changed) { myActions += 1; if (glow > 0) { dragAttack = true; dragNoGlow = midGlow === 0; } break; }
          }
          if (dragAttack === null) { dragTries += 1; if (dragTries >= 3) dragAttack = false; else { await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click().catch(() => {}); } }
          continue;
        }
        for (const i of usable) {
          await page.locator(`[data-card-hand-card="${i}"]`).click();
          await page.waitForTimeout(150);
          // 使う子を選ぶ必要があれば最初の子
          const user = page.locator('[data-card-mon].ring-amber-300').first();
          if (await user.count()) { await user.click(); await page.waitForTimeout(150); }
          const target = page.locator('[data-card-mon].ring-rose-400').first();
          if (await target.count()) {
            if (!shotTarget) { await shot(page, '06-target'); layoutSeen.push(...(await layoutIssues(page)).map((x) => `狙う相手を選ぶ: ${x}`)); shotTarget = true; }
            await target.click(); acted = true;
            // ⑩ 技の動き: 攻撃した子の絵が、モンヒロの技の動き(SkillFxMotion)に差しかわる
            if (!motionSeen) {
              motionSeen = await page.locator('[data-card-mon] [data-skill-fx]').count() > 0;
              if (motionSeen && SHOT) for (const [t, nm] of [[120, 'a'], [260, 'b'], [420, 'c']]) { await page.waitForTimeout(t === 120 ? 0 : 150); await shot(page, `10-motion-${nm}`); }
            }
            break;
          }
          const use = page.getByRole('button', { name: '使う' });
          if (await use.count()) { await use.click(); acted = true; break; }
          await page.locator(`[data-card-hand-card="${i}"]`).click().catch(() => {});
        }
        if (acted) { myActions += 1; await page.waitForTimeout(400); continue; }
        await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click();
        continue;
      }
      await page.waitForTimeout(300);
    }
    check('⑫ 技を相手のモンスターまで運んで離すと使える(置ける所の上で光る)', dragAttack === true, `${dragAttack}(試した回数 ${dragTries + (dragAttack === true ? 1 : 0)})`);
    check('⑫ 置けない所(自分の場)の上では光らない', dragNoGlow !== false, String(dragNoGlow));
    check('⑫ ガッツの置き場まで運ぶと、そのカードをガッツにする組に入れる', dragGuts === true, String(dragGuts));
    check(`⑨ ${VW}×${VH} で相手の場・まんなか・自分の場・手札・ボタンが重ならない`, layoutSeen.length === 0, layoutSeen.join(' / '));
    check('⑩ 技を出すと、攻撃した子がモンヒロの技の動きをする', motionSeen || poseSeen.has('attack'), `見えた動き: ${[...poseSeen].join('・')}`);
    check('⑤ 自分の番を何ターンも進められる(技・守り・ガッツ)', gutsTurns >= 3 && errors.length === 0, `技 ${myActions} 回・守りの番 ${guards} 回・ターン終了 ${gutsTurns} 回`);
    // 捨て札の一覧
    await page.getByRole('button', { name: /^捨て札/ }).last().click();
    await page.locator('[data-card-discard]').waitFor({ timeout: 5000 });
    await shot(page, '08-discard');
    check('⑥ 捨て札の一覧が開く(自分/相手のタブ)', await page.getByRole('button', { name: /相手の捨て札/ }).count() === 1);
    await page.getByRole('button', { name: '閉じる' }).click();
    // ⑦ 投了
    const result = await page.locator('[data-card-top="result"]').count();
    if (!result) {
      await page.getByRole('button', { name: '投了' }).click();
      await page.getByRole('button', { name: '投了する' }).click();
    }
    await page.locator('[data-card-top="result"]').waitFor({ timeout: 20000 });
    await page.waitForTimeout(500);
    await shot(page, '09-result');
    const after = await page.evaluate(() => ({
      point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'),
      record: JSON.parse(localStorage.getItem('mh_card_record_v1') || 'null'),
      all: Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith('mh_')).map((k) => [k, localStorage.getItem(k)])),
    }));
    const outcome = await page.locator('[data-card-top="result"]').getAttribute('data-card-outcome');
    if (outcome === 'surrender') check('⑦ 投了ではカードポイントが増えない・戦績に投了が1つ', after.point === 400 && after.record && after.record.cpu.surrender === 1, JSON.stringify({ point: after.point, cpu: after.record && after.record.cpu }));
    else check(`⑦ 決着(${outcome})で結果が出て戦績が付く`, after.record && after.record.cpu[outcome] === 1);
    // ⑧ 既存のキーを書き換えていない(時刻・起動のたびに変わる記録は除く)
    const volatile = /^mh_(debug_entry|last_|play_|session|boot|reload|device|playtime|visit|bgm_|se_|audio|login|daily_|mission|update|seen_build|build)/;
    const changed = Object.keys(before).filter((k) => !k.startsWith('mh_card_') && !volatile.test(k) && before[k] !== after.all[k]);
    check('⑧ カードバトル以外の保存キーを書き換えていない', changed.length === 0, changed.join(', '));
    const added = Object.keys(after.all).filter((k) => !(k in before) && !k.startsWith('mh_card_') && !volatile.test(k));
    check('⑧ 新しく増えた保存キーは mh_card_* だけ', added.length === 0, added.join(', '));
    check('どこでも実行時エラーが出ない', errors.length === 0, errors.slice(0, 3).join(' / '));
  } catch (e) {
    if (lastPage) await shot(lastPage, 'zz-fail').catch(() => {});
    check('最後まで動く', false, String(e).slice(0, 300));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
  console.log(failed ? `\nNG ${failed}件` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
})();

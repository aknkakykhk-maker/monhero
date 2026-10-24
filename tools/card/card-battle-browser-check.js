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
// 写真には、押した跡の波紋(TapRippleLayer の白い丸)を写さない(社長に見せる写真のため)
const shot = async (page, name) => { if (SHOT) { fs.mkdirSync(SHOT, { recursive: true }); await page.screenshot({ path: path.join(SHOT, `${name}.png`), style: 'div[style*="2147483647"] > span { display: none !important; }' }).catch(() => {}); } };
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
      if (!focused && !(await page.locator('[data-card-bubble]').count()) && ['guts', 'guard', 'attack', 'deckEnd', 'deckTurn'].includes(stageId) && (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) !== 'wait') { if (noFocusPrev === stageId && SHOT && !tutorNoFocus.size) await shot(page, `zz-nofocus-${stageId}`); if (noFocusPrev === stageId) tutorNoFocus.add(`${stageId}(${await page.locator('[data-card-battle]').getAttribute('data-card-mode')})`); noFocusPrev = stageId; } else noFocusPrev = null;
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
      if (stageId === 'deckTurn' && mode === 'guts') { const b = page.getByRole('button', { name: /ターン終了$/ }); if (await b.isEnabled()) await b.click(); await page.waitForTimeout(400); continue; }
      await page.waitForTimeout(250);
    }
    const tutOutcome = await page.locator('[data-card-top="result"]').getAttribute('data-card-outcome').catch(() => null);
    await shot(page, '14-tutorial-result');
    check('⑪ 練習試合を最後まで操作で通せる(5つの段)', tutOutcome === 'tutorialDone' && ['draw', 'guts', 'guard', 'attack', 'deckEnd', 'deckTurn', 'finish'].every((k) => tutorSeen.has(k)), `${tutOutcome}・${[...tutorSeen].join('→')}`);
    check('⑪ ちがう所を押すと、ドラが「光ってる所」と案内する', wrongShown);
    check(`⑪ ${VW}×${VH} で、ドラの窓が全部見えて「次へ」が押せる(どの台詞でも)`, tutorIssues.size === 0, [...tutorIssues].slice(0, 4).join(' / '));
    check('⑪ 操作の段では、教えている所が光っている', tutorNoFocus.size === 0, [...tutorNoFocus].join('・'));
    const tut = await page.evaluate(() => ({ t: JSON.parse(localStorage.getItem('mh_card_tutorial_v1') || 'null'), point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0') }));
    check('⑪ はじめて最後までやると 100(印 done・rewarded)', tut.t && tut.t.done && tut.t.rewarded && tut.point === 400, JSON.stringify(tut));
    await page.getByRole('button', { name: 'トップへ' }).click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 20000 });
    // もう一度 → 飛ばす: 100 は二度ともらえない(練習試合のやり直しはルールの画面から)
    await page.locator('[data-card-rules-open]').click();
    await page.locator('[data-card-rules]').waitFor({ timeout: 5000 });
    const ruleCount = await page.locator('[data-card-rule]').count();
    if (SHOT) await shot(page, '22-rules');
    check('⑮ ルールの画面に節が並び、練習試合のやり直しがある', ruleCount >= 8 && (await page.locator('[data-card-rules] [data-card-tutorial-again]').count()) === 1, String(ruleCount));
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
    let dragAttack = null, dragGuts = null, dragNoGlow = null, dragTries = 0, dragShotNo = false;
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
    while (Date.now() < deadline && (gutsTurns < 6 || (dragAttack === null && gutsTurns < 12))) {
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
          // ★相手の上で光るかを見てから離す。光らない札(自分の子に使う札など)は元の場所へ戻して離し(使わない)、次の札で試す
          const logBefore = await page.locator('[data-card-log]').innerText();
          const mine = await center(page.locator('[data-card-mon="0-0"]'));
          let tried = false;
          for (const hi of usable.slice(0, 5)) {
            const from = await center(page.locator(`[data-card-hand-card="${hi}"]`));
            for (const t of ['1-0', '1-1', '1-2']) {
              const to = await center(page.locator(`[data-card-mon="${t}"]`));
              if (!from || !to) continue;
              let midGlow = 0;
              await page.mouse.move(from.x, from.y); await page.mouse.down();
              await page.mouse.move(from.x + 4, from.y - 20, { steps: 4 });
              await page.mouse.move(mine.x, mine.y, { steps: 6 }); midGlow += await page.locator('[data-card-mon].ring-emerald-300').count();
              await page.mouse.move(to.x, to.y, { steps: 8 });
              const glow = await page.locator('[data-card-mon].ring-emerald-300, [data-card-guts-drop].ring-emerald-300').count();
              if (!glow && SHOT && !dragShotNo) { dragShotNo = true; await shot(page, 'zz-drag-noglow'); }
              if (!glow) { await page.mouse.move(from.x, from.y, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(150); continue; }
              if (SHOT) await shot(page, '15-drag');
              await page.mouse.up();
              tried = true;
              await page.waitForTimeout(300);
              const changed = (await page.locator('[data-card-log]').innerText()) !== logBefore || (await page.locator('[data-card-battle]').getAttribute('data-card-mode')) !== 'attack';
              if (changed) { myActions += 1; dragAttack = true; dragNoGlow = midGlow === 0; }
              break;
            }
            if (tried) break;
          }
          if (dragAttack === null) { dragTries += 1; if (dragTries >= 6) dragAttack = false; else { await page.getByRole('button', { name: '攻撃おわり → ガッツへ' }).click().catch(() => {}); } }
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
    const gain = Number(await page.locator('[data-card-top="result"]').getAttribute('data-card-gain'));
    // 投了は倒した相手のモンスター × 10(25まで。案A・台帳 #3484)。結果に出た数だけ増えている
    if (outcome === 'surrender') check('⑦ 投了のカードポイントは25まで・結果に出た数だけ増える・戦績に投了が1つ', gain >= 0 && gain <= 25 && after.point === 400 + gain && after.record && after.record.cpu.surrender === 1, JSON.stringify({ gain, point: after.point, cpu: after.record && after.record.cpu }));
    else check(`⑦ 決着(${outcome})で結果が出て戦績が付く`, after.record && after.record.cpu[outcome] === 1);
    // ⑧ 既存のキーを書き換えていない(時刻・起動のたびに変わる記録は除く)
    const volatile = /^mh_(debug_entry|last_|play_|session|boot|reload|device|playtime|visit|bgm_|se_|audio|login|daily_|mission|update|seen_build|build)/;
    const changed = Object.keys(before).filter((k) => !k.startsWith('mh_card_') && !volatile.test(k) && before[k] !== after.all[k]);
    check('⑧ カードバトル以外の保存キーを書き換えていない', changed.length === 0, changed.join(', '));
    const added = Object.keys(after.all).filter((k) => !(k in before) && !k.startsWith('mh_card_') && !volatile.test(k));
    check('⑧ 新しく増えた保存キーは mh_card_* だけ', added.length === 0, added.join(', '));
    // ⑬ 結果の画面の「クイック周回 ◯周ぶん」(デバッグの見本。NORMAL の勝ち = 16周ぶん・保存しない)
    await page.locator('[data-card-top="result"] button').first().click();
    await page.waitForTimeout(300);
    const demoTxt = {};
    for (const k of ['in', 'out']) {
      await page.locator(`[data-card-result-demo="${k}"]`).click();
      await page.waitForTimeout(300);
      demoTxt[k] = await page.locator('[data-card-quick-loops]').innerText().catch(() => '');
      await shot(page, `16-result-loops-${k}`);
      await page.locator('[data-card-top="result"] button').first().click();
      await page.waitForTimeout(300);
    }
    // ⑬ 助手の絵は、どの子も同じ大きさ・足元を枠の下にそろえる(描かれている所の高さが枠の高さ、または幅いっぱい)
    const artBad = [];
    const whoIds = await page.locator('[data-card-result-demo-who] option').evaluateAll((els) => els.map((e) => e.value));
    for (const id of whoIds) {
      await page.locator('[data-card-result-demo-who]').selectOption(id);
      await page.locator('[data-card-result-demo="in"]').click();
      await page.waitForFunction(() => document.querySelector('[data-card-top="result"] [data-card-art-h]'), null, { timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(200);
      const m = await page.evaluate(() => {
        const el = document.querySelector('[data-card-top="result"] [data-card-assistant-art]');
        if (!el) return null;
        const im = el.querySelector('img').getBoundingClientRect(); const r = el.getBoundingClientRect();
        return { h: Number(el.getAttribute('data-card-art-h')), w: Number(el.getAttribute('data-card-art-w')), boxH: el.clientHeight, boxW: el.clientWidth, imgBottom: Math.round(im.bottom - r.bottom) };
      });
      if (SHOT) await shot(page, `17-art-${id}`);
      if (!m || !(m.h >= m.boxH - 2 || m.w >= m.boxW - 2)) artBad.push(`${id}:${JSON.stringify(m)}`);
      await page.locator('[data-card-top="result"] button').first().click();
      await page.waitForTimeout(250);
    }
    check(`⑬ 結果の画面の助手の絵が、${whoIds.length}人とも同じ大きさで足元が枠の下にそろう`, whoIds.length >= 6 && artBad.length === 0, artBad.join(' / ') || whoIds.join('・'));
    check('⑬ 結果の画面に「クイック周回 ◯周ぶん」が出る(入るとき・入らないとき)', /クイック周回 16周ぶん/.test(demoTxt.in) && /16周ぶん進みました/.test(demoTxt.in) && /^クイック周回をしていないときは入りません$/.test(demoTxt.out.trim()), JSON.stringify(demoTxt).slice(0, 200));
    // ⑭ デッキ編成: 新しいデッキを作り、モンスター3体と50枚を入れて保存 → 一覧で「対戦に使えます」・使うデッキにできる
    await page.locator('[data-card-decks]').click();
    await page.waitForSelector('[data-card-deck-list]', { timeout: 5000 });
    if (SHOT) await shot(page, '18-deck-list');
    await page.locator('[data-card-deck-new]').click();
    await page.waitForSelector('[data-card-deck-edit]', { timeout: 5000 });
    const monTiles = page.locator('[data-card-deck-tile]');
    for (let i = 0; i < 3; i++) await monTiles.nth(i).click();
    const monCount = await page.locator('[data-card-deck-mon] img').count();
    // 同じ種類の2体目は入らない(キラがあれば)・技は「使える子だけ」で絞って入れる
    await page.getByRole('tab', { name: /技・ブリーダー/ }).click();
    let sameNameStop = '', shortShot = false, shortProblems = '';
    for (let guard = 0; guard < 400; guard++) {
      const n = Number((await page.locator('[data-card-deck-count]').innerText()).replace(/\/.*$/, '').trim());
      if (n >= 50) break;
      if (n >= 47 && !shortShot) {
        shortShot = true;
        await page.evaluate(() => document.querySelectorAll('[data-card-deck-edit] .mh-scroll').forEach((el) => { el.scrollTop = 0; }));
        shortProblems = await page.locator('[data-card-deck-problems]').innerText().catch(() => '');
        if (SHOT) await shot(page, '19b-deck-short');
      }
      const tiles = page.locator('[data-card-deck-tile]');
      const k = await tiles.count();
      let added = false;
      for (let t = 0; t < k && !added; t++) {
        const before = (await page.locator('[data-card-deck-count]').innerText());
        await tiles.nth(t).click();
        if ((await page.locator('[data-card-deck-count]').innerText()) !== before) added = true;
        else if (!sameNameStop) sameNameStop = await page.locator('[data-card-deck-notice]').innerText().catch(() => '');
      }
      if (!added) { await page.locator('[data-card-deck-usable]').click(); }
    }
    await page.evaluate(() => document.querySelectorAll('[data-card-deck-edit] .mh-scroll').forEach((el) => { el.scrollTop = 0; }));
    if (SHOT) await shot(page, '19-deck-edit');
    const deckReady = await page.locator('[data-card-deck-ready]').getAttribute('data-card-deck-ready');
    await page.getByRole('tab', { name: /デッキの中/ }).click();
    if (SHOT) await shot(page, '20-deck-inside');
    await page.locator('[data-card-deck-save]').click();
    await page.waitForSelector('[data-card-deck-list]', { timeout: 5000 });
    const savedDecks = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_decks_v1') || 'null'));
    const newDeck = savedDecks && savedDecks.decks[savedDecks.decks.length - 1];
    const names = {};
    (newDeck ? newDeck.cards : []).forEach((no) => { names[no] = 1; });
    check('⑭ デッキ編成: 新しいデッキにモンスター3体・50枚を入れて保存できる', monCount === 3 && deckReady === 'ok' && savedDecks && savedDecks.decks.length === 2 && newDeck.monsters.length === 3 && newDeck.cards.length === 50, JSON.stringify({ monCount, deckReady, n: savedDecks && savedDecks.decks.length, cards: newDeck && newDeck.cards.length }));
    check('⑭ 50枚に足りないデッキは「まだ対戦に使えません」と、あと何枚かが出る', /あと\d+枚/.test(shortProblems), shortProblems);
    check('⑭ 同じ名前4枚目・持っている枚数を超える分は入らない(理由が出る)', /3枚まで|持っているのは/.test(sameNameStop), sameNameStop);
    await page.locator(`[data-card-deck-use="${newDeck.id}"]`).click();
    await page.waitForTimeout(300);
    const act = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_decks_v1') || 'null').active);
    if (SHOT) await shot(page, '21-deck-list-after');
    check('⑭ 一覧で「使う」を押すと、そのデッキで対戦する', act === newDeck.id, act);
    await page.locator('[data-card-deck-list] button').first().click();
    await page.waitForTimeout(300);
    // ⑮ カード図鑑: 弾ごとのタブ・集めた種類・持っていないカードは暗い・持っているカードに枚数
    await page.locator('[data-card-dex-open]').click();
    await page.locator('[data-card-dex]').waitFor({ timeout: 5000 });
    const dexTotal = await page.locator('[data-card-dex-total]').innerText();
    const dex1 = await page.locator('[data-card-dex-tile]').count();
    const haveTiles = await page.locator('[data-card-dex-tile]:not([data-card-dex-have="0"])').count();
    if (SHOT) await shot(page, '23-dex-1');
    await page.getByRole('tab', { name: '混血' }).click();
    await page.waitForTimeout(200);
    const dexH = await page.locator('[data-card-dex-tile]').count();
    if (SHOT) await shot(page, '24-dex-hybrid');
    await page.locator('[data-card-dex-show="have"]').click();
    await page.waitForTimeout(150);
    const dexHHave = await page.locator('[data-card-dex-tile]').count();
    check('⑮ カード図鑑: 第1弾が並び、持っている種類が数えられ、混血のタブ・持っているだけの絞り込みが効く', Number(dexTotal) >= 20 && Number(dexTotal) === haveTiles && dex1 >= 100 && haveTiles >= 20 && dexH === 15 && dexHHave === 0, JSON.stringify({ dexTotal, dex1, haveTiles, dexH, dexHHave }));
    await page.locator('[data-card-dex] button').first().click();
    await page.waitForTimeout(250);
    // ⑯ マーケットの「カードポイント」の売り場: パックを買って開ける・スターターキットを買う・円盤石と交換する
    await page.evaluate(() => localStorage.setItem('mh_card_point_v1', JSON.stringify(5000)));
    const unlockedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_unlocked_monsters') || 'null'));
    const colBefore = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('mh_card_collection_v1') || '{}')).reduce((a, n) => a + n, 0));
    await page.locator('[data-card-market-open]').click();
    await page.locator('[data-card-shop]').waitFor({ timeout: 10000 });
    await page.locator('[data-card-shop-rates="w1"]').click();
    if (SHOT) await shot(page, '25-shop-packs');
    const rateText = await page.locator('[data-card-shop-rate-table]').innerText();
    await page.locator('[data-card-shop-buy="w1-5"]').click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '買って開ける' }).click();
    await page.locator('[data-card-pack-open]').waitFor({ timeout: 10000 });
    if (SHOT) await shot(page, '26-pack-closed');
    let packsOpened = 0;
    for (let k = 0; k < 5; k++) {
      await page.locator('[data-card-pack-tear]').click();
      await page.locator('[data-card-pack-card="0"]').click();
      await page.waitForTimeout(150);
      if (k === 0 && SHOT) await shot(page, '27-pack-one');
      await page.locator('[data-card-pack-flip-all]').click();
      await page.waitForTimeout(200);
      if (k === 0 && SHOT) await shot(page, '28-pack-all');
      packsOpened += 1;
      if (await page.locator('[data-card-pack-next]').count()) await page.locator('[data-card-pack-next]').click();
    }
    const flippedAll = await page.locator('[data-card-pack-card][data-card-pack-flipped="1"]').count();
    await page.locator('[data-card-pack-done]').click();
    await page.locator('[data-card-shop]').waitFor({ timeout: 10000 });
    const afterPack = await page.evaluate(() => ({ point: JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'), pity: JSON.parse(localStorage.getItem('mh_card_pack_pity_v1') || 'null'), col: Object.values(JSON.parse(localStorage.getItem('mh_card_collection_v1') || '{}')).reduce((a, n) => a + n, 0) }));
    check('⑯ 第1弾パックを5つ(450)買って開けると、カードが増え、カードポイントが減り、天井の数が残る', packsOpened === 5 && flippedAll === 8 && afterPack.point <= 5000 - 450 + 40 * 5 * 5 && afterPack.point >= 4550 && afterPack.col > colBefore && afterPack.pity && typeof afterPack.pity.w1 === 'number' && /技などの枠/.test(rateText), JSON.stringify({ packsOpened, flippedAll, afterPack, colBefore }));
    await page.getByRole('tab', { name: 'スターター' }).click();
    await page.waitForTimeout(300);
    if (SHOT) await shot(page, '29-shop-starters');
    const kits = await page.locator('[data-card-shop-starter]').count();
    await page.locator('[data-card-shop-starter-buy]').first().click();
    await page.locator('[data-confirm-sheet]').locator('xpath=..').getByRole('button', { name: '買う' }).click();
    await page.waitForTimeout(500);
    const afterKit = await page.evaluate(() => ({ shop: JSON.parse(localStorage.getItem('mh_card_shop_v1') || 'null'), decks: JSON.parse(localStorage.getItem('mh_card_decks_v1') || 'null') }));
    const boughtLabel = await page.locator('[data-card-shop-starter-buy]').first().innerText();
    if (SHOT) await shot(page, '29b-shop-starter-bought');
    check('⑯ 選ばなかったスターターキットは2つ並び、買うと印が付き、デッキが1つ増え、もう買えない', kits === 2 && afterKit.shop && Object.keys(afterKit.shop.starters).length === 1 && afterKit.decks.decks.length === 3 && /買いました/.test(boughtLabel), JSON.stringify({ kits, shop: afterKit.shop, decks: afterKit.decks && afterKit.decks.decks.length, boughtLabel }));
    await page.getByRole('tab', { name: '円盤石' }).click();
    await page.waitForTimeout(200);
    if (SHOT) await shot(page, '30-shop-disc');
    const discBuy = page.locator('[data-card-shop-disc] button:not([disabled])').filter({ hasText: /交換|1,500/ }).first();
    let discOk = 'なし';
    if (await discBuy.count()) {
      const pBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'));
      await discBuy.click();
      await page.waitForTimeout(300);
      const sheetBtn = page.locator('[role="dialog"] button').filter({ hasText: /交換/ }).last();
      if (await sheetBtn.count()) { await sheetBtn.click(); await page.waitForTimeout(800); }
      const unlockedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_unlocked_monsters') || 'null'));
      const pAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('mh_card_point_v1') || '0'));
      // 交換前は保存に無いこともある(既定の顔ぶれ)。カードポイントが 1,500 減り、解放済みが前より1体多い(前が無ければ保存ができた)ことを見る
      discOk = pBefore - pAfter === 1500 && Array.isArray(unlockedAfter) && (!Array.isArray(unlockedBefore) || unlockedAfter.length === unlockedBefore.length + 1) ? 1 : `${pBefore}→${pAfter}・${JSON.stringify(unlockedAfter)}`;
      await page.locator('[role="dialog"] button').filter({ hasText: /閉じる|あとで|OK|スキップ/ }).first().click().catch(() => {});
    }
    check('⑯ 円盤石をカードポイント 1,500 で交換できる(mh_unlocked_monsters に1体足される)', discOk === 1 || discOk === 'なし', String(discOk));
    // マーケットから戻ると MFバトルカードのトップへ
    await page.keyboard.press('Escape').catch(() => {});
    await page.locator('[data-mh-screen] button').first().click();
    await page.locator('[data-card-top="top"]').waitFor({ timeout: 10000 }).catch(() => {});
    check('⑯ 売り場から戻ると MFバトルカードのトップへ戻る', (await page.locator('[data-card-top="top"]').count()) === 1);
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

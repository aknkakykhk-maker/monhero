const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// タクティクスの敵の作戦AI(試作・2026-11-11 社長の材料「タクティクス・NPCの戦術AI強化」)を見張る。
//
//   node tools/battle/tactics-enemy-ai-debug-check.js [--shots <フォルダ>]
//   (配信 serve.py はこの検査が自分で立てる。--shots を付けると止め絵を撮る)
//
// ★社長が決めるまで、本番の敵の強さ・ランキング対象のモードは変えない。試作はデバッグ戦の中だけ。
// ① ソース: 試作の選び方は debugBattleRef(デバッグ戦)のタクティクスで段を選んだときだけ通る。ふだんは chooseEnemyAction のまま。
//    本番のくじ(chooseEnemyAction・TACTICS_ACTION_DEFINITIONS の重み)は書き換えていない
// ② 純粋な部品: 段 0 は本番と同じくじ・段 1 以上の移動先は「味方の攻めがいちばん弱い間合い」・段 2 以上は様子見をしない
// ③ 実ブラウザ: デバッグ戦の設定に「敵の作戦AI」がタクティクスのときだけ出る。段 3 でタクティクスを戦い始められる(エラーなし)
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const PORT = 8907;
const PAGE_URL = process.env.SMOKE_URL || `http://localhost:${PORT}/monster-hero/index.html`;
const SHOTS = (() => { const i = process.argv.indexOf('--shots'); return i >= 0 ? path.resolve(process.argv[i + 1]) : null; })();

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// --- ① ソース ---
const has = (text) => source.includes(text);
check('試作はデバッグ戦のタクティクスで段を選んだときだけ', has('if (!debugBattleRef.current || !isTacticsMode(runMode) || !(level > 0)) return {};'));
check('ふだんの敵の手は今までどおりのくじ', has('return chooseEnemyAction(ent,currentDist,Math.random,{...enemyActionStateFrom(lastIntent), ...(extraState||{})});'));
check('段の選択は保存しない(useState だけ・mh_ のキーを作らない)', has('const [debugEnemyAiLevel, setDebugEnemyAiLevel] = useState(0);') && !/mh_[a-z_]*enemy_ai/.test(source));
check('本番の行動表の重みはそのまま(通常攻撃30・様子見10・移動10)',
  has("{id:'normal',type:'ATTACK',category:'通常攻撃',noticeLabel:'通常攻撃',weight:30,") && has("{id:'wait',type:'WAIT',category:'特殊行動',noticeLabel:'様子見',weight:10,")
  && has("{id:'move',type:'MOVE',category:'移動',noticeLabel:'間合い移動',weight:10,"));

// --- ② 純粋な部品(シミュレーターと同じ読み込み方) ---
const { loadGame } = require(path.join(TOOLS_DIR, 'playbot/sim/load-game'));
const G = loadGame();
const ent = { id: 'Delpiero', hp: 1000, maxHp: 1000, atk: 100, difficulty: 'Hard' };
const defs = G.enemyActionDefinitionsFor('tacticsPro', 'Delpiero', 'Hard');
let s = 7; const rng = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
let s2 = 7; const rng2 = () => { s2 = (s2 * 16807) % 2147483647; return s2 / 2147483647; };
const same = Array.from({ length: 200 }, () => JSON.stringify(G.chooseTacticsEnemyActionAi(ent, 1, rng, { definitions: defs }, { level: 0 }))
  === JSON.stringify(G.chooseEnemyAction(ent, 1, rng2, { definitions: defs }))).every(Boolean);
check('段 0 は本番のくじと1手ずつ同じ', same);
const pressure = [400, 900, 300, 100]; // 間合い3がいちばん楽
const ai = { level: 1, pressure, aliveSlots: [0, 1, 2, 3], lowCount: 0, maxDef: 0 };
const moves = Array.from({ length: 400 }, () => G.chooseTacticsEnemyActionAi(ent, 1, Math.random, { definitions: defs }, ai)).filter((x) => x && x.type === 'MOVE');
check('段 1 の移動先は味方の攻めがいちばん弱い間合い', moves.length > 0 && moves.every((m) => m.targetDist === 3 && m.label === `移動: ${G.RANGE_LABELS[3]}`), `移動 ${moves.length} 回`);
const stay = Array.from({ length: 400 }, () => G.chooseTacticsEnemyActionAi(ent, 3, Math.random, { definitions: defs }, ai)).filter((x) => x && x.type === 'MOVE');
check('段 1 はいまの間合いが一番ましなら動かない', stay.length === 0);
const waits = Array.from({ length: 400 }, () => G.chooseTacticsEnemyActionAi(ent, 1, Math.random, { definitions: defs }, { ...ai, level: 2 })).filter((x) => x && x.type === 'WAIT');
check('段 2 は様子見をしない', waits.length === 0);
const charged = G.chooseTacticsEnemyActionAi(ent, 1, Math.random, { definitions: defs, charging: true }, { ...ai, level: 3 });
check('ためた次は段が上でも必ず必殺技(予告を裏切らない)', charged && charged.type === 'SPECIAL');

// --- ③ 実ブラウザ ---
const seed = () => {
  localStorage.setItem('mh_breeder_name', JSON.stringify('テスト'));
  localStorage.setItem('mh_breeder_icon', JSON.stringify('Mocchi'));
  localStorage.setItem('mh_onboarded', JSON.stringify(true));
  localStorage.setItem('mh_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_seen_v1', JSON.stringify(true));
  localStorage.setItem('mh_battle_tutorial_guide_shown_v1', JSON.stringify(true));
  localStorage.setItem('mh_masu_migrated', JSON.stringify(true));
};

(async () => {
  const server = spawn('python3', [path.join(TOOLS_DIR, 'serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const openDebugBattle = async (page) => {
      const pointerDown = (sel) => page.evaluate((s) => {
        const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`)
          : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
        if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        return !!b;
      }, sel);
      const clickText = (re) => page.evaluate((pattern) => {
        const b = [...document.querySelectorAll('button')].find(x => new RegExp(pattern).test(x.textContent));
        if (b) b.click();
        return !!b;
      }, re);
      await page.addInitScript(seed);
      await page.goto(PAGE_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 60000 });
      await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
      await pointerDown({ text: 'TAP TO START' });
      await page.waitForTimeout(2500);
      await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
      await pointerDown({ aria: 'トップ画面へ進む' });
      await page.waitForTimeout(2500);
      for (let i = 0; i < 8; i++) {
        const closed = await clickText('受け取|閉じる|あとで|スキップ');
        await page.waitForTimeout(700);
        if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
      }
      // HOME → 設定 → ヘルプ → 💊 → デバッグ設定 → デバッグ戦
      await page.evaluate(() => document.querySelector('button[aria-label="設定"]')?.click());
      await page.waitForTimeout(900);
      await clickText('^ヘルプ');
      await page.waitForTimeout(900);
      await clickText('💊');
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.querySelector('[data-debug-battle-setup]')?.click());
      await page.waitForTimeout(900);
      return page.evaluate(() => !!document.querySelector('[data-debug-battle-setup-screen]'));
    };
    const click = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    // 止め絵の前に、上に重なったお話(イベントの会話)を閉じる
    const closeOverlays = async (page) => {
      for (let i = 0; i < 6; i++) {
        const hit = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /^(スキップ|閉じる|あとで|確認)$/.test(x.textContent.trim())); if (b) b.click(); return !!b; });
        await page.waitForTimeout(600);
        if (!hit) break;
        await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /はい|スキップする|OK/.test(x.textContent.trim())); if (b) b.click(); });
        await page.waitForTimeout(400);
      }
    };
    if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: SHOTS ? 2 : 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    check('デバッグ戦の設定を開ける', await openDebugBattle(page));
    await click(page, '[data-debug-battle-mode-option="quick"]');
    await page.waitForTimeout(300);
    check('クラシックのモードでは敵の作戦AIを出さない', !(await page.evaluate(() => !!document.querySelector('[data-debug-enemy-ai]'))));
    await click(page, '[data-debug-battle-mode-option="tactics"]');
    await page.waitForTimeout(300);
    const opts = await page.evaluate(() => [...document.querySelectorAll('[data-debug-enemy-ai-option]')].map((b) => b.getAttribute('data-debug-enemy-ai-option')));
    check('タクティクスでは敵の作戦AIの段が4つ並ぶ', opts.join(',') === '0,1,2,3', opts.join(','));
    await click(page, '[data-debug-battle-difficulty="Hard"]');
    await click(page, '[data-debug-battle-enemy="Delpiero"]');
    await click(page, '[data-debug-enemy-ai-option="3"]');
    await page.waitForTimeout(300);
    if (SHOTS) {
      await closeOverlays(page);
      await page.evaluate(() => document.querySelector('[data-debug-enemy-ai]')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(SHOTS, 'enemy-ai-1-debug-setting.png') });
    }
    const label = await page.evaluate(() => document.querySelector('[data-debug-battle-start]')?.textContent || '');
    check('開始ボタンに選んだ段が出る', label.includes('敵AI 3'), label);
    const strongest = await page.evaluate(() => document.querySelector('[data-debug-strongest-monster]')?.getAttribute('aria-pressed'));
    if (strongest !== 'true') await click(page, '[data-debug-strongest-monster]');
    await click(page, '[data-debug-battle-start]');
    await page.waitForTimeout(4000);
    const st = await page.evaluate(() => ({ board: !!document.querySelector('[data-tactics-look]'), text: document.body.innerText }));
    check('段 3 でタクティクスを戦い始められる(エラーなし)', st.board && st.text.includes('デルピエロ') && errors.length === 0, errors[0] ? errors[0].slice(0, 160) : '');
    if (SHOTS) { await closeOverlays(page); await page.waitForTimeout(800); await page.screenshot({ path: path.join(SHOTS, 'enemy-ai-2-battle-L3.png') }); }
    await page.close();
  } catch (e) {
    check('実ブラウザで最後まで確かめられた', false, String(e).slice(0, 200));
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exitCode = failed ? 1 : 0;
})();

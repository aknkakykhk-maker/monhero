#!/usr/bin/env node
// ユグドラシル種の「技ごとの動き」を見張る(2026-09-29 ユーザー指示「これにあった技モーション作って」)。
//
//   node tools/battle/skill-motion-check.js
//
// ユグドラシル種は技の名前ごとに別の動きを持つ(参考の技画像: docs/spec/YGGDRASIL_SKILLS.md)。
// 技の名前 → 型(23-rpg-debug.jsx の SKILL_ATTACK_THEMES)→ 見た目の組み合わせ(24-battle-fx.jsx の SKILL_FX_SPECS)
// → 動き(70-bootstrap.jsx の .skfx-◯◯)と3か所に分かれているので、どこか1つ書き忘れても画面はふつうに動いてしまう
// (型が無ければ体当たりに戻り、CSSが無ければ小片が出ないだけ)。ここでつながりを1本ずつ確かめる。
//   ① 技の名前(通常技・固有技の9段階)は全部、型を持つ
//   ② 型は全部、尺(THEMED_ATTACK_MS)と見た目の組み合わせを持ち、使っている動き・形・道すじのCSSがある
//   ③ 実ブラウザ: デバッグの「新モンスター確認」→ 攻撃アクションで、技を押すとその技の型が出る
// バトルの待ち時間とプレビューの長さが技ごとに同じかは tools/battle/attack-preview-parity-check.js が見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
let failed = 0;
const check = (label, ok, note = '') => { if (!ok) failed++; console.log(`${ok ? 'OK' : 'NG'}: ${label}${note ? ` — ${note}` : ''}`); };
const slice = (text, from, to) => { const i = text.indexOf(from), j = text.indexOf(to, i); return i >= 0 && j > i ? text.slice(i, j) : ''; };

const rpg = read('monster-hero/src/parts/23-rpg-debug.jsx');
const fx = read('monster-hero/src/parts/24-battle-fx.jsx');
const css = read('monster-hero/src/parts/70-bootstrap.jsx');
const debugScreen = read('monster-hero/src/parts/74-screen-monster-check-debug.jsx');

// --- ① ② データのつながり ---
const ctx = { Object, Array, Math, String };
vm.createContext(ctx);
vm.runInContext(read('monster-hero/data/images/images-ally.js'), ctx);
vm.runInContext(read('monster-hero/data/ally-monsters.js'), ctx);
vm.runInContext(slice(rpg, 'const DEFAULT_ATTACK_THEMES =', 'const rpgMotionName =')
  + '\nthis.__r = { SKILL_ATTACK_THEMES, SKILL_ATTACK_THEME_MONSTERS, SKILL_ATTACK_FALLBACK, THEMED_ATTACK_MS, skillAttackThemeOf };', ctx);
vm.runInContext(slice(fx, 'const SKFX_RING =', 'const SkillFxMotion =') + '\nthis.__f = { SKILL_FX_SPECS };', ctx);
const { SKILL_ATTACK_THEMES, SKILL_ATTACK_THEME_MONSTERS, SKILL_ATTACK_FALLBACK, THEMED_ATTACK_MS, skillAttackThemeOf } = ctx.__r;
const { SKILL_FX_SPECS } = ctx.__f;
const HERO_ATK_NAMES = vm.runInContext('HERO_ATK_NAMES', ctx);
const ALL = vm.runInContext('ALL_PLAYER_MONSTERS', ctx);
const DRAFTS = vm.runInContext('UPCOMING_MONSTER_DRAFTS', ctx);

check('技ごとに動きを変える種族がいる', SKILL_ATTACK_THEME_MONSTERS.length >= 2, SKILL_ATTACK_THEME_MONSTERS.join('・'));
for (const id of SKILL_ATTACK_THEME_MONSTERS) {
  const mon = ALL[id] || DRAFTS[id];
  const normal = HERO_ATK_NAMES[id] || [];
  const unique = mon?.unique?.names || mon?.draftUniqueNames || [];
  const missing = [...normal, ...unique].filter(n => !SKILL_ATTACK_THEMES[n]);
  check(`${id}: 通常技・固有技の9段階がそろい、どの技も型を持つ`, normal.length === 9 && unique.length === 9 && missing.length === 0,
    missing.length ? `型が無い: ${missing.join('・')}` : `通常${normal.length} / 固有${unique.length}`);
  check(`${id}: 技名が分からないときも動きがある(図鑑の攻撃アクション)`,
    skillAttackThemeOf(id, null, false) === SKILL_ATTACK_FALLBACK.normal && skillAttackThemeOf(id, null, true) === SKILL_ATTACK_FALLBACK.unique);
}
check('ほかの種族は技名で動きが変わらない(今までどおり種族の型)', skillAttackThemeOf('Mocchi', '頭突き', false) === null && skillAttackThemeOf('Plant', 'スターボム', true) === null);

const kinds = [...new Set(Object.values(SKILL_ATTACK_THEMES))];
const noMs = kinds.filter(k => !(THEMED_ATTACK_MS[k] > 0));
const noSpec = kinds.filter(k => !SKILL_FX_SPECS[k]);
check('どの型も尺を持つ(THEMED_ATTACK_MS)', noMs.length === 0, noMs.join('・') || `${kinds.length}型`);
check('どの型も見た目の組み合わせを持つ(SKILL_FX_SPECS)', noSpec.length === 0, noSpec.join('・') || `${kinds.length}型`);
const late = kinds.filter(k => SKILL_FX_SPECS[k] && !(SKILL_FX_SPECS[k].hit < THEMED_ATTACK_MS[k] && (!SKILL_FX_SPECS[k].hit2 || SKILL_FX_SPECS[k].hit2 < THEMED_ATTACK_MS[k])));
check('着弾はどれも尺の中に収まる', late.length === 0, late.join('・'));
// 飛ぶものが尺のうちに届き終わる(はみ出すと、次の動きに入ってから小片が飛ぶ)
const overrun = kinds.filter(k => {
  const f = SKILL_FX_SPECS[k]?.fx; if (!f) return false;
  return f.items.some(b => (b.d || 0) + f.dur > THEMED_ATTACK_MS[k] + 20);
});
check('飛ぶものは尺のうちに届き終わる', overrun.length === 0, overrun.join('・'));

const has = (sel) => css.includes(sel);
const specs = kinds.map(k => SKILL_FX_SPECS[k]).filter(Boolean);
const need = new Set();
for (const s of specs) {
  need.add(`.skfx-body--${s.body} .thm-atk__monster`);
  if (s.line) need.add(`.skfx-line--${s.line} i`);
  if (s.over) need.add(`.skfx-over--${s.over} i`);
  if (s.fx) { need.add(`.skfx-p--${s.fx.shape} `); need.add(`.skfx-path--${s.fx.path} `); }
  if (s.burst) need.add(`.skfx-p--${s.burst} `);
}
const noCss = [...need].filter(sel => !has(sel));
check('使っている動き・帯・形・道すじのCSSがそろっている', noCss.length === 0, noCss.join(' / ') || `${need.size}か所`);
check('端末の「動きを減らす」では、敵に重ねる大きな絵も出さない', /prefers-reduced-motion[\s\S]{0,400}\.skfx-over \{ display:none; \}|\.thm-atk__bit, \.skfx-over \{ display:none; \}/.test(css));
check('バトルは技名を演出へ渡す', read('monster-hero/src/parts/60-app.jsx').includes("sakura: motion==='eikiSakuraCombo', skillName: hit.skillName});"));
// 技を選ぶ行は図鑑とデバッグで共通の部品(SkillMotionPicker)。対象の子を SKILL_ATTACK_THEME_MONSTERS へ
// 足せば両方に出る(2026-09-29 ユーザー指示「図鑑で技ごとのモーションが見れない」「いずれは全モンスター実装予定」)
const fxPart = read('monster-hero/src/parts/24-battle-fx.jsx');
const dexPart = read('monster-hero/src/parts/57-screen-monster-dex.jsx');
check('技を選ぶ行は共通の部品で、技ごとに動きが違う子だけに出る',
  fxPart.includes('const skillMotionListsOf =') && fxPart.includes('const SkillMotionPicker =')
  && fxPart.includes("!SKILL_ATTACK_THEME_MONSTERS.includes(mon.id)) return null;") && fxPart.includes('data-monster-check-skill-motion={name}'));
check('デバッグの攻撃アクションで、技を1つずつ選んで再生できる',
  debugScreen.includes('skillMotionListsOf(mon, { draft: true })') && debugScreen.includes('onPlay={(kind, name) => onPlayPreview(mon, kind, atkMotion, name)}'));
check('図鑑の攻撃アクションでも、技を1つずつ選んで再生できる',
  dexPart.includes('const skillMotionLists=skillMotionListsOf(mon);') && dexPart.includes('<SkillMotionPicker lists={skillMotionLists}')
  && dexPart.includes('await onPlayPreview(mon,kind,atkMotion,skillName);'));

// --- ③ 実ブラウザ ---
(async () => {
  let playwright;
  try { playwright = require(path.join(ROOT, 'tools/node_modules/playwright')); }
  catch { console.log('SKIP: playwright が入っていないので実ブラウザでは確認できません'); finish(); return; }
  const PORT = 8963;
  const server = spawn('python3', [path.join(ROOT, 'tools/serve.py'), String(PORT)], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  let browser;
  const errors = [];
  try {
    browser = await playwright.chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.addInitScript(() => {
      const put = (k, v) => localStorage.setItem(k, JSON.stringify(v));
      put('mh_breeder_name', 'テスト'); put('mh_breeder_icon', 'Mocchi'); put('mh_onboarded', true); put('mh_intro_done', true);
      put('mh_tutorial_seen_v1', true); put('mh_battle_tutorial_seen_v1', true); put('mh_battle_tutorial_guide_shown_v1', true);
      put('mh_masu_migrated', true); put('mh_update_notice_seen_v1', true);
    });
    await page.goto(`http://localhost:${PORT}/monster-hero/index.html`, { waitUntil: 'load', timeout: 60000 });
    const pointerDown = (sel) => page.evaluate((s) => {
      const b = s.aria ? document.querySelector(`button[aria-label="${s.aria}"]`) : [...document.querySelectorAll('button')].find(x => x.textContent.includes(s.text));
      if (b) b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); return !!b;
    }, sel);
    const clickText = (re) => page.evaluate((p) => { const b = [...document.querySelectorAll('button')].find(x => new RegExp(p).test(x.textContent)); if (b) b.click(); return !!b; }, re);
    const clickSel = (sel) => page.evaluate((s) => { const b = document.querySelector(s); if (b) b.click(); return !!b; }, sel);
    await page.waitForFunction(() => document.body.innerText.includes('TAP TO START'), { timeout: 40000 }).catch(() => {});
    await pointerDown({ text: 'TAP TO START' });
    await page.waitForFunction(() => !!document.querySelector('button[aria-label="トップ画面へ進む"]'), { timeout: 40000 });
    await pointerDown({ aria: 'トップ画面へ進む' });
    await page.waitForTimeout(2500);
    for (let i = 0; i < 8; i++) {
      const closed = await clickText('受け取|閉じる|あとで|スキップ|^確認$');
      await page.waitForTimeout(600);
      if (!closed && !(await page.evaluate(() => !!document.querySelector('[role="dialog"]')))) break;
    }
    await clickSel('button[aria-label="設定"]'); await page.waitForTimeout(900);
    await clickText('^ヘルプ$'); await page.waitForTimeout(900);
    await clickText('💊'); await page.waitForTimeout(1200);
    await clickSel('[data-debug-monster-check]'); await page.waitForTimeout(1500);
    for (const id of SKILL_ATTACK_THEME_MONSTERS) {
      await clickSel(`[data-monster-check-option="${id}"]`); await page.waitForTimeout(1200);
      for (let i = 0; i < 4; i++) { const c = await clickText('^確認$|^閉じる$'); await page.waitForTimeout(300); if (!c) break; }
      await clickSel('[data-monster-check-open-motion]'); await page.waitForTimeout(800);
      const names = await page.evaluate(() => [...document.querySelectorAll('[data-monster-check-skill-motion]')].map(b => b.getAttribute('data-monster-check-skill-motion')));
      check(`${id}: 攻撃アクションに技のボタンが18個並ぶ`, names.length === 18, `${names.length}個`);
      const wrong = [];
      for (const name of names) {
        await page.evaluate((n) => { const b = document.querySelector(`[data-monster-check-skill-motion="${n}"]`); if (b) b.click(); }, name);
        const shown = await page.waitForSelector('[data-skill-fx]', { timeout: 4000 }).then(h => h.getAttribute('data-skill-fx')).catch(() => null);
        if (shown !== SKILL_ATTACK_THEMES[name]) wrong.push(`${name}→${shown}`);
        await page.waitForFunction(() => !document.querySelector('[data-skill-fx]') && !document.querySelector('[data-monster-check-skill-motion]:disabled'), { timeout: 8000 }).catch(() => {});
        await page.waitForTimeout(150);
      }
      check(`${id}: どの技も押すとその技の動きが出る`, wrong.length === 0, wrong.join(' / '));
      await clickSel('button[aria-label="詳細へ戻る"]'); await page.waitForTimeout(400);
      await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /一覧/.test(x.getAttribute('aria-label') || '')); if (b) b.click(); });
      await page.waitForTimeout(800);
    }
    check('実行時エラーが出ていない', errors.length === 0, errors.slice(0, 2).join(' / '));
  } finally { if (browser) await browser.close(); server.kill(); }
  finish();
})().catch((e) => { console.error(e); process.exit(1); });

function finish() {
  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
}

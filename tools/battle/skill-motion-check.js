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
  + '\nthis.__r = { SKILL_ATTACK_THEMES, SKILL_ATTACK_THEME_MONSTERS, SKILL_ATTACK_FALLBACK, THEMED_ATTACK_MS, skillAttackThemeOf, skillAttackMotionOf, themedAttackMotionMs };', ctx);
vm.runInContext(slice(fx, 'const SKFX_RING =', 'const SkillFxMotion =') + '\nthis.__f = { SKILL_FX_SPECS, SKILL_MOTION_SETS, SKM_SIG, skillFxSpecOf };', ctx);
const { SKILL_ATTACK_THEMES, SKILL_ATTACK_THEME_MONSTERS, SKILL_ATTACK_FALLBACK, THEMED_ATTACK_MS, skillAttackThemeOf, skillAttackMotionOf, themedAttackMotionMs } = ctx.__r;
const { SKILL_FX_SPECS, SKILL_MOTION_SETS, SKM_SIG, skillFxSpecOf } = ctx.__f;
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
// ==== 全モンスター(2026-09-29 ユーザー指示「全モンスターも技別の攻撃アクション作って」「技ごとに全部別の動きにする」) ====
// ユグドラシル種以外は、段階の順に通常技9つ・固有技9つの動きを持つ(SKILL_MOTION_SETS)。
// 'sig' はその子の見せ場の動き(atkMotion・型)をそのまま使う段階。1体につき通常・固有それぞれ1つまで
const others = Object.keys(ALL).filter(id => !SKILL_ATTACK_THEME_MONSTERS.includes(id));
const noSet = others.filter(id => !SKILL_MOTION_SETS[id] || SKILL_MOTION_SETS[id].normal?.length !== 9 || SKILL_MOTION_SETS[id].unique?.length !== 9);
check('ほかの全モンスターも通常技9つ・固有技9つの動きを持つ', noSet.length === 0, noSet.join('・') || `${others.length}体`);
const tooManySig = others.filter(id => ['normal', 'unique'].some(k => (SKILL_MOTION_SETS[id]?.[k] || []).filter(sp => sp === SKM_SIG).length > 1));
check('見せ場の動き(sig)は、通常・固有それぞれ1つまで', tooManySig.length === 0, tooManySig.join('・'));
const specialIds = others.filter(id => ALL[id].atkMotion && ALL[id].atkMotion !== 'default');
const noSig = specialIds.filter(id => !['normal', 'unique'].some(k => (SKILL_MOTION_SETS[id]?.[k] || []).includes(SKM_SIG)));
check('専用の動きを持つ子は、見せ場の動きをどれか1つの技に残している', noSig.length === 0, noSig.join('・') || `${specialIds.length}体`);
const wrongKind = [];
for (const id of others) {
  const normal = HERO_ATK_NAMES[id] || [], unique = ALL[id].unique?.names || [];
  normal.forEach((n, i) => { const want = SKILL_MOTION_SETS[id].normal[i] === SKM_SIG ? null : `${id}-n${i}`; if (skillAttackThemeOf(id, n, false) !== want) wrongKind.push(`${id}:${n}`); });
  unique.forEach((n, i) => { const want = SKILL_MOTION_SETS[id].unique[i] === SKM_SIG ? null : `${id}-u${i}`; if (skillAttackThemeOf(id, n, true) !== want) wrongKind.push(`${id}:${n}`); });
}
check('技の名前から、その段階の動きが選ばれる(見せ場の段階は元の動き)', wrongKind.length === 0, wrongKind.slice(0, 6).join('・'));
check('継承した固有技は、覚えた子ではなく出自の子の動きで出る', skillAttackThemeOf('Golem', ALL.Pixie.unique.names[1], true) === 'Pixie-u1');
check('技に動きがあれば見せ場の動きの代わりに型の動きで出す(ミーアのメロディレイ)', skillAttackMotionOf('Mia', 'miaSongNotes', HERO_ATK_NAMES.Mia[1], false) === 'default'
  && skillAttackMotionOf('Mia', 'miaSongNotes', HERO_ATK_NAMES.Mia[0], false) === 'miaSongNotes');
check('技名が無い攻撃(連撃・追撃など)は今までどおり', skillAttackThemeOf('Zan', '連撃', false) === null && skillAttackThemeOf('Mocchi', null, false) === null);

const generated = others.flatMap(id => ['normal', 'unique'].flatMap(k => SKILL_MOTION_SETS[id][k].map((sp, i) => (sp === SKM_SIG ? null : `${id}-${k === 'unique' ? 'u' : 'n'}${i}`)).filter(Boolean)));
const kinds = [...new Set([...Object.values(SKILL_ATTACK_THEMES), ...generated])];
const msOf = (k) => THEMED_ATTACK_MS[k] || skillFxSpecOf(k)?.ms;
const noMs = kinds.filter(k => !(msOf(k) > 0));
const noSpec = kinds.filter(k => !skillFxSpecOf(k));
check('どの型も尺を持つ(THEMED_ATTACK_MS か組み合わせの ms)', noMs.length === 0, noMs.join('・') || `${kinds.length}型`);
check('どの型も見た目の組み合わせを持つ(SKILL_FX_SPECS / SKILL_MOTION_SETS)', noSpec.length === 0, noSpec.join('・') || `${kinds.length}型`);
check('本番の待ち時間は、組み合わせの尺と同じ(themedAttackMotionMs)', generated.every(k => { const [id, rest] = k.split('-'); const i = Number(rest.slice(1)); const unique = rest[0] === 'u';
  const name = unique ? ALL[id].unique.names[i] : HERO_ATK_NAMES[id][i]; return themedAttackMotionMs(id, 'default', name, unique) === skillFxSpecOf(k).ms; }));
const late = kinds.filter(k => { const sp = skillFxSpecOf(k); return sp && !(sp.hit < msOf(k) && (!sp.hit2 || sp.hit2 < msOf(k))); });
check('着弾はどれも尺の中に収まる', late.length === 0, late.join('・'));
const longOnes = generated.filter(k => skillFxSpecOf(k).ms > 1200);
check('どの動きも1.2秒以内(ターンが長くなりすぎない)', longOnes.length === 0, longOnes.join('・'));
// 飛ぶものが尺のうちに届き終わる(はみ出すと、次の動きに入ってから小片が飛ぶ)
const overrun = kinds.filter(k => {
  const f = skillFxSpecOf(k)?.fx; if (!f) return false;
  return f.items.some(b => (b.d || 0) + f.dur > msOf(k) + 20);
});
check('飛ぶものは尺のうちに届き終わる', overrun.length === 0, overrun.join('・'));

const has = (sel) => css.includes(sel);
const specs = kinds.map(k => skillFxSpecOf(k)).filter(Boolean);
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
  && fxPart.includes("(!SKILL_ATTACK_THEME_MONSTERS.includes(mon.id) && !hasSet)) return null;") && fxPart.includes('data-monster-check-skill-motion={name}'));
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
    // 実ブラウザは、ユグドラシル種と、見せ場の出し方が違う代表(型の子・歌・連撃・水)だけ見る(全22体だと数分かかる)
    for (const id of [...SKILL_ATTACK_THEME_MONSTERS, 'Mocchi', 'Mia', 'Zan', 'Undine']) {
      await clickSel(`[data-monster-check-option="${id}"]`); await page.waitForTimeout(1200);
      for (let i = 0; i < 4; i++) { const c = await clickText('^確認$|^閉じる$'); await page.waitForTimeout(300); if (!c) break; }
      await clickSel('[data-monster-check-open-motion]'); await page.waitForTimeout(800);
      const names = await page.evaluate(() => [...document.querySelectorAll('[data-monster-check-skill-motion]')].map(b => b.getAttribute('data-monster-check-skill-motion')));
      check(`${id}: 攻撃アクションに技のボタンが18個並ぶ`, names.length === 18, `${names.length}個`);
      const wrong = [];
      for (const name of names) {
        await page.evaluate((n) => { const b = document.querySelector(`[data-monster-check-skill-motion="${n}"]`); if (b) b.click(); }, name);
        const unique = !(HERO_ATK_NAMES[id] || []).includes(name);
        const want = skillAttackThemeOf(id, name, unique);
        const shown = await page.waitForSelector('[data-skill-fx]', { timeout: want ? 4000 : 1800 }).then(h => h.getAttribute('data-skill-fx')).catch(() => null);
        if (shown !== want) wrong.push(`${name}→${shown}`);
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

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 画面ライフサイクルの登録簿(useScreenEffects)の約束ごとを固定する。
//
//   node tools/ui/screen-effects-check.js
//
// 【なぜ要るか】
// 画面を切り出していくと「画面を離れたのにタイマーだけ生き残る」が起きる。かといって
// 一律に止めると、MonsterHeroGame の setTimeout 62 箇所のうち 31 箇所——処理中フラグを戻す・
// WAVE リザルトへ進める・await を resolve する——が止まり、フラグが立ったまま操作できなくなる
// (docs/refactor/REFACTOR_MASTER_PLAN.md STEP 6 の注意書き)。
// 「画面専用は止める / 進行は止めない」がこの登録簿の全てなので、実際に動かして確かめる。
//
// 【見かた】
// ① 登録簿: 偽のタイマーを入れて createScreenEffectsRegistry を動かし、画面を離れたときに
//    何が止まって何が生き残るかを見る。既定(種別を書き忘れたとき)が「止めない」側であることも見る
// ② hook: useScreenEffects が画面(scope)ごとに区切っていること、描画のたびに現在地を更新していること
// ③ 分類表: docs/refactor/SCREEN_EFFECTS_MAP.md の各行の目印が 60-app.jsx にちょうど1つあり、
//    表の件数と本体の setTimeout の数が一致すること(表が古くなったらここで落ちる)
const fs = require('fs');
const path = require('path');
const { loadDyeModule, REPO_ROOT, readAppSource } = require(path.join(TOOLS_DIR, 'harness'));
const api = loadDyeModule();

let failed = 0;
const check = (label, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${label}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

// ---- 偽のタイマー。手で進めるので、待たずに「発火した/止まった」を確かめられる ----
function makeHost() {
  let seq = 1;
  const timers = new Map();   // id -> { fn, kind }
  const cleared = [];
  const listeners = [];
  const host = {
    setTimeout: (fn) => { const id = seq++; timers.set(id, { fn, kind: 'timeout' }); return id; },
    clearTimeout: (id) => { cleared.push(id); timers.delete(id); },
    setInterval: (fn) => { const id = seq++; timers.set(id, { fn, kind: 'interval' }); return id; },
    clearInterval: (id) => { cleared.push(id); timers.delete(id); },
    requestAnimationFrame: (fn) => { const id = seq++; timers.set(id, { fn, kind: 'raf' }); return id; },
    cancelAnimationFrame: (id) => { cleared.push(id); timers.delete(id); },
  };
  return {
    host, cleared, listeners,
    alive: () => Array.from(timers.keys()),
    fire: (id) => { const t = timers.get(id); if (!t) return false; if (t.kind !== 'interval') timers.delete(id); t.fn(0); return true; },
    fireAll: () => { Array.from(timers.keys()).forEach((id) => { const t = timers.get(id); if (!t) return; if (t.kind !== 'interval') timers.delete(id); t.fn(0); }); },
    target: () => {
      const bound = [];
      return {
        bound,
        addEventListener: (type, handler, options) => bound.push({ type, handler, options }),
        removeEventListener: (type, handler) => { const i = bound.findIndex((b) => b.type === type && b.handler === handler); if (i >= 0) bound.splice(i, 1); },
      };
    },
  };
}

check('登録簿と hook が本体にある',
  typeof api.createScreenEffectsRegistry === 'function' && typeof api.useScreenEffects === 'function');
check('種別が2つだけ宣言されている(画面専用 / 進行)',
  api.SCREEN_EFFECT_SCOPES && api.SCREEN_EFFECT_SCOPES.SCREEN === 'screen' && api.SCREEN_EFFECT_SCOPES.PROGRESS === 'progress'
  && Object.keys(api.SCREEN_EFFECT_SCOPES).length === 2);

// ---- ① 画面を離れたとき: 画面専用は止まり、進行は止まらない ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('HOME');
  const fired = [];
  reg.timeout(() => fired.push('screen'), 100, 'screen');
  const progressId = reg.timeout(() => fired.push('progress'), 100, 'progress');
  const result = reg.releaseScope('HOME');

  check('画面を離れると画面専用は止まる', result.stopped === 1 && h.cleared.length === 1);
  check('画面を離れても進行は止めない(登録簿から手を離すだけ)', result.kept === 1 && h.alive().length === 1);
  h.fireAll();
  check('止めなかった進行はそのあと必ず発火する', fired.length === 1 && fired[0] === 'progress');
  check('発火し終えた進行は登録簿に残らない', reg.stats().total === 0);
  check('進行の番号は使えなくなっている(二重に止めない)', reg.cancel(progressId) === false);
}

// ---- ① 種別を書き忘れたときは「止めない」側へ倒れる ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('BATTLE');
  const fired = [];
  reg.timeout(() => fired.push('omitted'), 100);
  reg.timeout(() => fired.push('typo'), 100, 'Screen'); // 綴り違い
  const result = reg.releaseScope('BATTLE');
  check('種別を書き忘れた timeout は止めない(既定は進行)', result.kept === 2 && result.stopped === 0);
  h.fireAll();
  check('書き忘れた timeout も必ず発火する', fired.length === 2);
}

// ---- ① interval / raf / listen は種別を取らず、必ず止まる ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('SETTINGS');
  const fired = [];
  reg.interval(() => fired.push('interval'), 50);
  reg.raf(() => fired.push('raf'));
  const target = h.target();
  const handler = () => fired.push('listen');
  reg.listen(target, 'click', handler);
  check('リスナーが実際に付く', target.bound.length === 1);
  const result = reg.releaseScope('SETTINGS');
  check('interval / raf は画面を離れたら必ず止まる(進行にはできない)', result.stopped === 3 && result.kept === 0);
  check('リスナーは画面を離れたら必ず外れる', target.bound.length === 0);
  h.fireAll();
  check('止めたものは1つも発火しない', fired.length === 0);
}

// ---- ① 画面ごとに区切る: 別の画面のぶんは巻き込まない ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('HOME');
  reg.timeout(() => {}, 100, 'screen');
  reg.setCurrentScope('BATTLE');           // 先に新しい画面へ切り替わってから
  reg.timeout(() => {}, 100, 'screen');    // 新しい画面が登録し
  const result = reg.releaseScope('HOME'); // そのあと古い画面の後始末が走る
  check('後始末は自分の画面のぶんだけ止める', result.stopped === 1 && reg.stats().screen === 1);
}

// ---- ① token: 画面を離れたら alive が false になる ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('MASU_TEMPLE');
  const token = reg.token();
  check('token は最初は生きている', token.alive === true);
  reg.setCurrentScope('HOME');
  const other = reg.token();
  reg.releaseScope('MASU_TEMPLE');
  check('画面を離れた token は死ぬ', token.alive === false);
  check('別の画面の token は生きたまま', other.alive === true);
}

// ---- ① 個別に止める / 全部の後始末 ----
{
  const h = makeHost();
  const reg = api.createScreenEffectsRegistry(h.host);
  reg.setCurrentScope('GIFT_BOX');
  const fired = [];
  const id = reg.timeout(() => fired.push('x'), 100, 'progress');
  check('進行でも自分で止めれば止まる(cancel)', reg.cancel(id) === true);
  h.fireAll();
  check('止めた進行は発火しない', fired.length === 0);

  reg.timeout(() => fired.push('keep'), 100, 'progress');
  reg.timeout(() => {}, 100, 'screen');
  const all = reg.releaseAll();
  check('画面そのものが外れたら残った画面専用を全部止める', all.stopped === 1 && all.kept === 1);
  h.fireAll();
  check('全部の後始末でも進行は発火する', fired.filter((x) => x === 'keep').length === 1);
}

// ---- ① 待ち時間 0 で即座に呼ばれる作りでも、登録簿に幽霊が残らない ----
{
  const immediate = {
    setTimeout: (fn) => { fn(); return 1; },
    clearTimeout: () => {}, setInterval: () => 2, clearInterval: () => {},
    requestAnimationFrame: (fn) => { fn(0); return 3; }, cancelAnimationFrame: () => {},
  };
  const reg = api.createScreenEffectsRegistry(immediate);
  reg.setCurrentScope('HOME');
  const fired = [];
  reg.timeout(() => fired.push('t'), 0, 'screen');
  reg.raf(() => fired.push('r'));
  check('その場で発火しても登録簿に残らない', reg.stats().total === 0, JSON.stringify(reg.stats()));
  check('その場で発火した処理はちゃんと走っている', fired.length === 2);
}

// ---- ② hook の形 ----
const source = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/40-screen-effects.jsx'), 'utf8');
check('hook は画面(scope)を受け取る', /function useScreenEffects\(scopeKey\)/.test(source));
check('描画のたびに現在の画面を入れ直す(新しい画面の登録を古い画面のぶんにしない)',
  /registry\.setCurrentScope\(key\);\n\s*useEffect/.test(source));
check('画面が変わったら、その画面のぶんだけ後始末する', /return \(\) => \{ registry\.releaseScope\(key\); \};/.test(source));
check('アンマウントでは残りを全部止める', /useEffect\(\(\) => \(\) => \{ registry\.releaseAll\(\); \}, \[\]\)/.test(source));
check('画面へ渡す口に releaseScope / releaseAll を出さない(他の画面の進行を巻き込ませない)',
  /const api = \{ timeout, interval, raf, listen, token, cancel, stats,/.test(source)
  && !/const api = \{[^}]*release/.test(source));

// ---- ③ 分類表と本体の突き合わせ ----
const MAP_PATH = path.join(REPO_ROOT, 'docs/refactor/SCREEN_EFFECTS_MAP.md');
// STEP 6 で画面が切り出されると、そこにあったタイマーも画面ファイルへ移る。
// 本体だけを見ると「表にあるのに本体に無い」で落ちるので、本体と
// 「MonsterHeroGame から切り出した画面」だけを合わせて数える。
// 登録簿そのもの(40-screen-effects.jsx)と、もともと共有層にあった画面(29-rhythm-screens.jsx)は
// この表の対象ではないので混ぜない
const app = [
  fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8'),
  ...fs.readdirSync(path.join(REPO_ROOT, 'monster-hero/src/parts'))
    .filter((f) => /^\d+-screen-.+\.jsx$/.test(f) && f !== '40-screen-effects.jsx').sort()
    .map((f) => fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/parts', f), 'utf8')),
].join('\n');
const mapText = fs.readFileSync(MAP_PATH, 'utf8');
const KINDS = new Set(['screen', 'progress', '対象外']);
const rows = [];
for (const line of mapText.split('\n')) {
  const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+?)\s*\|/);
  if (!m) continue;
  const kind = m[2].trim();
  if (!KINDS.has(kind)) continue;
  rows.push({ mark: m[1], kind });
}
check('分類表に行がある', rows.length > 0, `${rows.length} 行`);

const marks = rows.map((r) => r.mark);
check('目印が重複していない', new Set(marks).size === marks.length,
  marks.filter((m, i) => marks.indexOf(m) !== i).slice(0, 3).join(' / '));

const missing = rows.filter((r) => app.split(r.mark).length - 1 !== 1);
check('表の目印はすべて本体か切り出した画面にちょうど1つある', missing.length === 0,
  missing.slice(0, 3).map((r) => `${r.mark}(${app.split(r.mark).length - 1}件)`).join(' / '));

// setTimeout の実際の呼び出し数。コメント中の「setTimeout」は数えない
const callCount = app.split('\n').reduce((n, line) => (/^\s*\/\//.test(line) ? n : n + (line.split('setTimeout').length - 1)), 0);
check('表の件数と setTimeout の数が合っている', callCount === rows.length,
  `本体と画面で ${callCount} 箇所 / 表 ${rows.length} 行`);

const counts = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc; }, {});
console.log(`   内訳: 画面専用 ${counts.screen || 0} / 進行 ${counts.progress || 0} / 対象外 ${counts['対象外'] || 0}`);
check('「進行」が「画面専用」より多い(一律に止めてはいけない理由が表に残っている)',
  (counts.progress || 0) > (counts.screen || 0));

console.log(failed === 0 ? '\nすべてOK' : `\nNG ${failed} 件`);
process.exit(failed === 0 ? 0 : 1);

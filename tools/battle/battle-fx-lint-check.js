#!/usr/bin/env node
const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// バトル画面の CSS と「重さの見張り」を、書いた時点で点検する(ブラウザを開かない。1秒で終わる)。
//
//   node tools/battle/battle-fx-lint-check.js
//
// 【なぜ要るか】(2026-09-28 ユーザー指示「モンビーみたいに重さチェックやその他点検ツールを取り入れて
// 軽くて見た目が良く出来る仕組みを作って」)
// タクティクス新画面の飾りを足していくうちに、iPhone で発熱・かくつき・固まりが出た(2026-09-24〜25)。
// 調べると原因は「見た目は同じでも、ブラウザに毎コマ描き直させる書き方」だった。
//   ・キーフレームで filter / box-shadow / 円すいの角度(--mh-ang) を動かす → 毎コマ描き直し(CPU 13%→41%)
//   ・マスク・合成モード(mix-blend-mode) → メモリが足りないと外れて、枠やカードが塗りつぶされ固まる
//   ・:is() の中に ::before を書く → その規則が丸ごと無効になり、飾りが消える
// どれも手元の速い端末では分からず、実機で熱くなってから気づく。モンヒロビートの
// rhythm-keyframe-blur-check.js と同じく、**書いた時点で**止める。
//
// 【何を見るか】
//   ① バトルの飾りが使うキーフレームで、描き直しになるもの(filter・影・マスク・背景の位置・大きさ・位置・
//      CSS の変数)を動かさない。動かしてよいのは transform と opacity だけ
//   ② バトルの飾りに、マスクと合成モードを使わない
//   ③ バトルの飾りの transition に filter・影を入れない
//   ④ :is() / :where() の中に ::before などを書かない(規則が丸ごと無効になる)
//   ⑤ 休止・画面の軽さの CSS の土台が残っている(消すと「軽め」を選んでも軽くならない)
//   ⑥ 重さの見張り(71-screen-battle)が、モンヒロビートと同じ線で数え、計測OFFのあいだは何もしない
//
// 既にある書き方のうち、いまは直さないものは KNOWN_* に理由つきで置く(増やさないための控え)。
// 控えにあるものが直ったら、控えからも消すこと(消し忘れは「控えが古い」と出る)。
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(TOOLS_DIR, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const CSS_FILE = 'monster-hero/src/parts/70-bootstrap.jsx';
const BATTLE_FILE = 'monster-hero/src/parts/71-screen-battle.jsx';
const css = read(CSS_FILE);
const battle = read(BATTLE_FILE);
const rhythmSettings = read('monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// バトル画面(タクティクス新画面・WAVE のあとの画面)の飾りを指す印
const BATTLE_MARK = /\[data-(enemy|moo|slot|strike|impact|em-|tactics|card-(frame|shine|gem)|fx-|mh-ph)|\.mh-ph-|\.mon-idle/;
// キーフレームで動かすと毎コマ描き直しになるもの
const REPAINT_PROP = /(^|[;{\s])(filter|backdrop-filter|-webkit-backdrop-filter|box-shadow|text-shadow|mask[\w-]*|-webkit-mask[\w-]*|clip-path|background(-position|-size|-image)?|width|height|top|left|right|bottom|--[\w-]+)\s*:/;

// いまは直さないもの(名前 → 理由)。**増やさない**
const KNOWN_KEYFRAMES = {};
const KNOWN_MASK_RULES = {};

// --- キーフレームを取り出す(括弧を数えて本体を切る) ---
const keyframes = new Map();
{
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let depth = 1, i = re.lastIndex;
    const end = Math.min(css.length, i + 6000);
    for (; i < end && depth > 0; i++) { const c = css[i]; if (c === '{') depth++; else if (c === '}') depth--; }
    keyframes.set(m[1], (keyframes.get(m[1]) || '') + css.slice(re.lastIndex, i - 1));
  }
}
// --- ふつうの規則(セレクタ { 本体 })。キーフレームの中身は除いてから拾う ---
const cssNoKf = css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
const rules = [];
{
  const re = /([^{};]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(cssNoKf))) {
    const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!sel || sel.length > 600 || /[=]{2,}|=>|\breturn\b|\bconst\b/.test(sel)) continue;
    rules.push({ sel, body: m[2] });
  }
}
const battleRules = rules.filter((r) => BATTLE_MARK.test(r.sel));
check('バトルの飾りの CSS 規則を拾えた', battleRules.length >= 50, `${battleRules.length}件`);

// --- ① バトルの飾りが使うキーフレーム ---
const animNames = new Set();
const addNames = (text) => {
  for (const m of text.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+/).find((w) => keyframes.has(w));
      if (name) animNames.add(name);
    }
  }
};
battleRules.forEach((r) => addNames(r.body));
// バトル画面の JSX に直に書いた animation(style={{animation:'…'}})
for (const m of battle.matchAll(/animation\s*:\s*[`'"]([^`'"]+)[`'"]/g)) addNames(`animation:${m[1]}`);
check('バトルの飾りが使うキーフレームを拾えた', animNames.size >= 30, `${animNames.size}個`);
const repaintKf = [];
for (const name of animNames) {
  const body = keyframes.get(name) || '';
  // 各コマ({ } の中)ごとに見る
  const props = new Set();
  for (const m of body.matchAll(/\{([^{}]*)\}/g)) {
    for (const decl of m[1].split(';')) { const p = decl.match(REPAINT_PROP); if (p) props.add(p[2]); }
  }
  if (props.size) repaintKf.push(`${name}(${[...props].join('・')})`);
}
const newKf = repaintKf.filter((x) => !(x.split('(')[0] in KNOWN_KEYFRAMES));
check('① バトルの飾りのキーフレームは transform と opacity だけを動かす', newKf.length === 0, newKf.slice(0, 12).join(' / '));
const staleKf = Object.keys(KNOWN_KEYFRAMES).filter((k) => !repaintKf.some((x) => x.startsWith(`${k}(`)));
check('① 控え(KNOWN_KEYFRAMES)が古くない', staleKf.length === 0, staleKf.join(' / '));

// --- ② マスク・合成モード ---
const maskRules = battleRules.filter((r) => /(^|[;\s])(-webkit-)?mask(-image)?\s*:(?!\s*none)|mix-blend-mode\s*:(?!\s*normal)/.test(r.body));
const newMask = maskRules.filter((r) => !(r.sel in KNOWN_MASK_RULES));
check('② バトルの飾りにマスク・合成モードを使わない', newMask.length === 0, newMask.slice(0, 6).map((r) => r.sel.slice(0, 80)).join(' / '));
// JSX に直に書いたもの(style={{maskImage:…}} / mixBlendMode)
const jsxMask = [...battle.matchAll(/\b(WebkitMask\w*|mask\w*|mixBlendMode)\s*:\s*['"`](?!none|normal)/g)].map((m) => m[1]);
check('② バトル画面の JSX にマスク・合成モードを直に書かない', jsxMask.length === 0, jsxMask.join(' / '));

// --- ③ transition に filter・影 ---
const heavyTransition = battleRules.filter((r) => /transition(?:-property)?\s*:[^;}]*\b(filter|box-shadow|backdrop-filter)\b/.test(r.body));
check('③ バトルの飾りの transition に filter・影を入れない', heavyTransition.length === 0, heavyTransition.slice(0, 6).map((r) => r.sel.slice(0, 80)).join(' / '));

// --- ④ :is() / :where() の中の疑似要素 ---
const badIs = rules.filter((r) => /:(is|where)\([^)]*::/.test(r.sel));
check('④ :is() / :where() の中に ::before などを書かない', badIs.length === 0, badIs.slice(0, 6).map((r) => r.sel.slice(0, 80)).join(' / '));

// --- ⑤ 休止・画面の軽さの土台 ---
check('⑤ 休止中(data-fx-rest)はバトルの動きをすべて止める',
  /\[data-tactics-look\]\[data-fx-rest\] \*, \[data-tactics-look\]\[data-fx-rest\] \*::before, \[data-tactics-look\]\[data-fx-rest\] \*::after \{ animation-play-state: paused !important; \}/.test(css));
for (const level of ['STANDARD', 'LIGHT', 'MINIMAL']) {
  check(`⑤ 画面の軽さ「${level}」の CSS がある`, css.includes(`[data-fx-level="${level}"]`));
}

// --- ⑥ 重さの見張り ---
const num = (src, name) => { const m = src.match(new RegExp(`const ${name}\\s*=\\s*([\\d.]+)`)); return m ? Number(m[1]) : NaN; };
check('⑥ 数える枠の長さはモンヒロビートと同じ', num(battle, 'BATTLE_AUTO_LOAD_WINDOW_MS') === num(rhythmSettings, 'RHYTHM_AUTO_QUALITY_WINDOW_MS'),
  `${num(battle, 'BATTLE_AUTO_LOAD_WINDOW_MS')} / ${num(rhythmSettings, 'RHYTHM_AUTO_QUALITY_WINDOW_MS')}`);
check('⑥ 「重い」とみなす割合はモンヒロビートと同じ', num(battle, 'BATTLE_AUTO_LOAD_SLOW_RATIO') === num(rhythmSettings, 'RHYTHM_AUTO_QUALITY_SLOW_RATIO'),
  `${num(battle, 'BATTLE_AUTO_LOAD_SLOW_RATIO')} / ${num(rhythmSettings, 'RHYTHM_AUTO_QUALITY_SLOW_RATIO')}`);
check('⑥ 判断に要るコマ数はモンヒロビートと同じ', num(battle, 'BATTLE_AUTO_LOAD_MIN_FRAMES') === num(rhythmSettings, 'RHYTHM_AUTO_QUALITY_MIN_FRAMES'));
// 最軽量は並びごと変わるので、自動では下げない(選んだ人だけ)
check('⑥ 自動で下げるのは「軽め」まで', /const BATTLE_AUTO_LOAD_FLOOR = 'LIGHT';/.test(battle));
check('⑥ 遅いコマの線は「1.8倍かつ20ms超、または50ms以上」', /const battleSlowFrame = \(gap, minGap\) => \(gap > Math\.max\(5, minGap\) \* 1\.8 && gap > 20\) \|\| gap >= 50;/.test(battle));
// 休んでいる間は rAF も回さない(回すとスマホが休めない)
check('⑥ 一時停止のあいだは見張りの rAF を回さない', /const watchFrames = tacticsNewLayout && !\(fxRestEnabled && fxRest\) && \(autoLoadOn \|\| perfOn\);/.test(battle));
check('⑥ 設定「下げない」のときは自動で下げない', /battleFx\.autoLoad !== 'OFF'/.test(battle));
// 計測OFFのあいだは何もしない
const perfBody = (battle.match(/const BATTLE_PERF = \(\(\) => \{([\s\S]*?)\n\}\)\(\);/) || [])[1] || '';
check('⑥ 性能計測(BATTLE_PERF)がある', !!perfBody);
check('⑥ 計測OFFのあいだは1コマごとの記録をしない', /frame\(nowMs\) \{\s*if \(!on\) return;/.test(perfBody));
check('⑥ 計測OFFのあいだは要約も作らない', /snapshot\(\) \{\s*if \(!on\) return null;/.test(perfBody));
check('⑥ 計測OFFのあいだは長い処理も見張らない', /if \(on\) watchLongTasks\(\); else if \(observer\)/.test(perfBody));
check('⑥ 計測のパネルは計測ONのときだけ出す', /\{perfOn&&tacticsNewLayout&&perfSnap&&\(/.test(battle));

console.log(`\n(参考) バトルの飾りの規則 ${battleRules.length}件 / 使うキーフレーム ${animNames.size}個`);
if (failed) { console.log(`\n${failed}件のNGがあります`); process.exit(1); }
console.log('\nすべてOK');

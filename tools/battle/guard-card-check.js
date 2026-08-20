// デッキに入るガードカードの枚数を確かめる。
//
// 【なぜ道具にするか】
// 枚数は「丈夫さ → ガードレベル → 枚数」と2段階で決まるうえ、
// デッキを組む処理・レベルアップの案内文・強化画面の予告と、3か所が同じ式を見ている。
// どれかがずれても例外は出ず、遊んでいて「思ったより守れない」と感じるまで気付けない。
// 実際に「枚数の計算にガードレベルではなく別の値を渡していた」ことがあったので、
// 式そのものと、画面が同じ関数を使っているかをここで見張る。
const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('monster-hero/src/game-system.jsx', 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// 枚数の式だけを切り出して動かす
const from = source.indexOf('const MAX_GUARD_CARD_COUNT');
const to = source.indexOf('const buildDeck =');
check('枚数の式を取り出せる', from >= 0 && to > from);
if (from < 0 || to <= from) { console.log('\n1件のNGがあります'); process.exit(1); }
const ctx = { Math };
vm.createContext(ctx);
vm.runInContext(`${source.slice(from, to)};globalThis.api={guardCardCount,MAX_GUARD_CARD_COUNT,GUARD_LEVELS_PER_EXTRA_CARD};`, ctx);
const { guardCardCount, MAX_GUARD_CARD_COUNT, GUARD_LEVELS_PER_EXTRA_CARD } = ctx.api;

check('最初は2枚', guardCardCount(0) === 2, `${guardCardCount(0)}枚`);
check('ガードが2段階進化するごとに1枚増える', GUARD_LEVELS_PER_EXTRA_CARD === 2);
check('上限は4枚', MAX_GUARD_CARD_COUNT === 4);
const table = [0, 1, 2, 3, 4, 5, 6, 7].map(l => guardCardCount(l));
check('ガードレベルごとの枚数', JSON.stringify(table) === JSON.stringify([2, 2, 3, 3, 4, 4, 4, 4]),
  [0, 1, 2, 3, 4, 5, 6, 7].map((l, i) => `Lv${l}→${table[i]}枚`).join(' / '));
// 丈夫さは100ごとにガードレベルが1上がる
const levelOf = (defVal) => Math.max(0, Math.min(7, Math.floor(defVal / 100)));
const byDef = [0, 100, 200, 300, 400, 500].map(d => guardCardCount(levelOf(d)));
check('丈夫さごとの枚数', JSON.stringify(byDef) === JSON.stringify([2, 2, 3, 3, 4, 4]),
  [0, 100, 200, 300, 400, 500].map((d, i) => `丈夫さ${d}→${byDef[i]}枚`).join(' / '));
// 変な値でも落ちず、範囲から出ないこと
const odd = [null, undefined, NaN, -5, 999, '3'].map(v => guardCardCount(v));
check('変な値でも2〜4枚に収まる', odd.every(n => Number.isInteger(n) && n >= 2 && n <= MAX_GUARD_CARD_COUNT),
  JSON.stringify(odd));

// --- 画面側が同じ式を見ているか ---
const has = (t) => source.includes(t);
check('デッキを組むときに同じ式を使う', has('for(let i=0;i<guardCardCount(gBonus);i++)'));
check('デッキへ渡すのはガードレベル', has('const nGB = nGrdL;'));
check('レベルアップの案内も同じ式を使う', /guardCardCount\(nGrdL\)>guardCardCount\(currentGuardLevel\)/.test(source));
check('強化画面の予告も同じ式を使う', /ガード枚数 \{guardCardCount\(curGL\)\} → \{guardCardCount\(nextGL\)\}/.test(source));
// 「最大3枚」のような、式と食い違う数の直書きが残っていないこと
check('案内文に古い枚数が直書きされていない', !/カード枚数は最大3枚/.test(source));
check('案内文が上限を式から出している', has('最大${MAX_GUARD_CARD_COUNT}枚です'));

// --- ヘルプ ---
const help = fs.readFileSync('monster-hero/data/help.js', 'utf8');
check('ヘルプが新しい枚数を説明している',
  /最初2枚/.test(help) && /2段階進化するごとに1枚増え/.test(help) && /最大4枚/.test(help));
check('ヘルプに古い「最大3枚」が残っていない', !/ガードカードは最大3枚/.test(help));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exitCode = failed ? 1 : 0;

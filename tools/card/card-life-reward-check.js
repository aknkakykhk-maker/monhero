// MFバトルカード: カード部屋にいる助手と対戦すると、ごほうびが 1.5倍(2026-11-07 社長・カード部ルールくん)。ブラウザなしで 82・96・84 を見る。
//
//   node tools/card/card-life-reward-check.js [--verbose]
//
// 見るもの
//   A. ビートP: MASTER の勝ち 200 → 300。その日初めての勝ちの +50 は倍にしない(300+50)。倍率なしは今のまま。0 は 0(帯を出さない印 lifeUp も立たない)
//   B. 負け・投了も、もらえた分だけ 1.5倍(四捨五入)。自分の番が3回より少ない試合は 0 のまま
//   C. クイック周回も 1.5倍。0 は 0
//   D. カードランクの経験値: 勝ち負けの分だけ 1.5倍(MASTER 18 → 27)。その日初めての勝ちの +30 は倍にしない。オートは倍にしない
//   E. 84: 上がるかは対戦を始めた時点で決める(game.lifeUp)。みんなのデッキ・杯・オートは上げない。口が無いときは上げない(typeof で確かめる)
//   F. 84: 結果の帯は 1.5倍で増えたときだけ(cardResultLifeUp)。「〜の勝ち」の行は倍にする前の数
//   G. 保存のキーを増やしていない(82 の CARD_KEYS に新しい mh_ が無い)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${src('src/parts/18-player-rank.jsx')}\n;\n${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/96-card-tactics.jsx')}\n;\n`
  + 'this.E = { cardCpuReward, cardCpuLoops, cardLifeUpApply, CARD_LIFE_UP_MULT, cardLevelAfter, cardNormalizeDaily, CARD_AI_LEVELS };', ctx);
const E = ctx.E;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);
const M = E.CARD_LIFE_UP_MULT;
const today = '2026-11-07';
const fresh = () => E.cardNormalizeDaily(null, today);
const used = () => ({ ...fresh(), firstWin: true });
const facts = (ownTurns, kos = 0) => ({ ownTurns, kos });

// ---- A ----
check('A 倍率は 1.375(移動12回で +0.5 → +0.375。台帳 #5328)', M === 1.375, M);
{
  const r = E.cardCpuReward(used(), 'master', 'win', facts(10), M);
  check('A MASTER の勝ち 200 → 275(ふだん 200 を base に持つ)', r.got === 275 && r.base === 200 && r.total === 275 && r.lifeUp === true, J(r));
  const r1 = E.cardCpuReward(fresh(), 'master', 'win', facts(10), M);
  check('A その日はじめての +50 は倍にしない(275+50)', r1.got === 275 && r1.bonus === 50 && r1.total === 325, J(r1));
  const r0 = E.cardCpuReward(used(), 'master', 'win', facts(10));
  check('A 倍率なしは今のまま(200・lifeUp なし)', r0.got === 200 && r0.total === 200 && r0.lifeUp === false, J(r0));
  check('A 日ごとの数(cpuPoint)には 倍にしたあとの数を足す', r.daily.cpuPoint === 275, J(r.daily));
  for (const lv of Object.keys(E.CARD_AI_LEVELS)) {
    const a = E.cardCpuReward(used(), lv, 'win', facts(10), M);
    check(`A ${lv} の勝ち ${E.CARD_AI_LEVELS[lv].point} → ${Math.round(E.CARD_AI_LEVELS[lv].point * M)}`, a.got === Math.round(E.CARD_AI_LEVELS[lv].point * M), J(a));
  }
}
// ---- B ----
{
  const s = E.cardCpuReward(used(), 'master', 'surrender', facts(1, 0), M);
  check('B すぐの投了は 0 のまま(lifeUp も立たない=帯を出さない)', s.got === 0 && s.total === 0 && s.lifeUp === false, J(s));
  const short = E.cardCpuReward(used(), 'master', 'win', facts(2), M);
  check('B 自分の番が3回より少ない勝ちは 0 のまま', short.got === 0 && short.lifeUp === false, J(short));
  const l = E.cardCpuReward(used(), 'master', 'lose', facts(10), M);
  const l0 = E.cardCpuReward(used(), 'master', 'lose', facts(10));
  check('B 負けも、もらえた分だけ 倍にする(四捨五入)', l.got === Math.round(l0.got * M) && l.lifeUp === (l0.got > 0), `${l0.got} → ${l.got}`);
  const l5 = E.cardCpuReward(used(), 'normal', 'lose', facts(5), M);
  const l50 = E.cardCpuReward(used(), 'normal', 'lose', facts(5));
  check('B 番が少ない負けも 倍にする(四捨五入)', l5.got === Math.round(l50.got * M), `${l50.got} → ${l5.got}`);
}
// ---- C ----
{
  const w0 = E.cardCpuLoops('master', 'win', facts(10));
  const w = E.cardCpuLoops('master', 'win', facts(10), M);
  check('C クイック周回も 倍にする', w === Math.round(w0 * M) && w > w0, `${w0} → ${w}`);
  check('C 周回 0 は 0 のまま', E.cardCpuLoops('master', 'win', facts(2), M) === 0);
  check('C 倍率なしは今のまま', E.cardCpuLoops('easy', 'win', facts(10)) === E.CARD_AI_LEVELS.easy.loops);
  check('C 壊れた倍率は無視', E.cardLifeUpApply(200, NaN) === 200 && E.cardLifeUpApply(200, 0.5) === 200 && E.cardLifeUpApply(NaN, M) === 0);
}
// ---- D ----
{
  const w = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'win', today, mult: M });
  check('D MASTER の勝ち 18 → 25・その日はじめての +30 は倍にしない(55)', w.add === 55, J({ add: w.add, parts: w.parts }));
  check('D 内わけに「カード部屋の助手と対戦(1.375倍)」が出る', w.parts.some((p) => /カード部屋.*1\.375倍/.test(p.label) && p.xp === 7), J(w.parts));
  const w2 = E.cardLevelAfter(w.next, { kind: 'cpu', level: 'master', outcome: 'win', today, mult: M });
  check('D 同じ日の2勝目は 25 だけ', w2.add === 25, w2.add);
  const n = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'win', today });
  check('D 倍率なしは今のまま(48)', n.add === 48 && !n.parts.some((p) => /カード部屋/.test(p.label)), n.add);
  const a = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'win', today, auto: true, mult: M });
  check('D オートは倍にしない(半分の 9)', a.add === 9, a.add);
  const s = E.cardLevelAfter(null, { kind: 'cpu', level: 'master', outcome: 'surrender', today, mult: M });
  check('D 投了(0)は 0 のまま', s.add === 0, s.add);
}
// ---- E・F(84 の書き方) ----
{
  const s84 = src('src/parts/84-screen-card-battle.jsx');
  check('E 始めた時点で決める: みんなのデッキ・杯・オートは上げない', /const lifeUp = !share && !cup && !auto && cardLifeAtCard\(pick\.who\) && cardLifeRewardLeft\(pick\.who\);/.test(s84));
  check('E game.lifeUp に持つ', /\.\.\.\(lifeUp \? \{ lifeUp: true, lifeSlot \} : \{\}\)/.test(s84));
  check('E 終わりは game.lifeUp で倍率を決め、ビートP・周回・経験値に同じ倍率を渡す',
    /const lifeMult = game\.lifeUp && !game\.demo \? CARD_LIFE_UP_MULT : 1;/.test(s84)
    && /cardCpuReward\(fresh\.daily, game\.level, outcome, facts, lifeMult\)/.test(s84)
    && /cardCpuLoops\(game\.level, outcome, facts, lifeMult\)/.test(s84)
    && /cardLevelEntries\(\{ kind: 'cpu', level: game\.level, outcome, debug, mult: lifeMult \}\)/.test(s84));
  check('E 口は typeof で確かめてから呼ぶ(口が無ければ上げない)',
    /typeof assistantLifeAtCard === 'function' \? assistantLifeAtCard\(id\) === true : false/.test(s84) && /typeof assistantLifeCardIds === 'function'/.test(s84) && /typeof assistantLifeOnCardMatch === 'function'/.test(s84));
  check('E 対戦の画面から assistantLifeNow を呼ばない', !/assistantLifeNow\s*\(/.test(s84));
  check('E 助手ライフへ「対戦した」を知らせる', /cardLifeOnMatch\(\{ assistantId: game\.who, won: outcome === 'win', at: Date\.now\(\) \}\)/.test(s84));
  check('F 帯は 1.5倍で増えたときだけ', /const cardResultLifeUp = \(r\) => [^\n]*r\.got > r\.base/.test(s84) && /\{cardResultLifeUp\(r\) && <div data-card-result-life-up/.test(s84));
  check('F 「〜の勝ち」の行は倍にする前の数', /: \{cardResultCut\(r\) \? `\$\{r\.full\} → \$\{cardResultPlain\(r\)\}` : cardResultPlain\(r\)\}/.test(s84));
}
// ---- G ----
{
  const s82 = src('src/parts/82-card-battle-core.jsx');
  const s84 = src('src/parts/84-screen-card-battle.jsx');
  const s56 = src('src/parts/56-assistant-life-house.jsx');
  // 2026-11-08 社長の上限(1つの時間帯で助手1人1回)で、回数のキー mh_card_life_reward_v1 を1つだけ足した。ほかは足さない
  const keys = [s82, s84, s56].flatMap((t) => t.match(/mh_card_life\w*|mh_assistant_life_card\w*/g) || []);
  check('G 足した保存のキーは回数の mh_card_life_reward_v1 だけ', keys.length > 0 && keys.every((k) => k === 'mh_card_life_reward_v1'), keys.join(','));
}

if (fails.length) {
  console.error(`カード部屋の助手と対戦のごほうびアップ: NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`カード部屋の助手と対戦のごほうびアップ: OK ${passed}件`);

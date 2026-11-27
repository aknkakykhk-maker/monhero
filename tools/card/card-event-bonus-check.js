// MFバトルカード: イベント期間のごほうびの倍(クリスマスイベント 2026・台帳 r1119-172 追記・追跡 r1125-044)。ブラウザなしで 82・96・84・91 を見る
//
//   node tools/card/card-event-bonus-check.js
//
// 見るもの
//   A. 期間: 2026-11-28 10:00(JST・r1126-063)から 1.5倍、12-31 4:00 から 1倍。境目の1ミリ秒前・ちょうど
//   B. ビートP: 期間だけ MASTER の勝ち 200 → 300。カード部屋(×1.375)とは掛け算(200 → 413)。その日はじめての +50 は倍にしない。0 は 0
//   C. クイック周回: 掛け算(22 → 33・部屋と重ねて 45)
//   D. 経験値: 勝ち負けの分だけ掛け算。内わけに「カード部屋」と「クリスマスイベント」が別に出る。+30 は倍にしない。オートは半分のあとに 1.5倍
//   E. マルチ: 2倍のあとに 1.5倍(勝ち 800 → 1200)
//   F. 84・91 が倍を渡している(始めた時点の game.eventMult・杯は 1・結果の帯)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map, Date });
vm.runInContext(`${src('src/parts/18-player-rank.jsx')}\n;\n${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/82-card-event-bonus.jsx')}\n;\n${src('src/parts/96-card-tactics.jsx')}\n;\n`
  + 'this.E = { cardCpuReward, cardCpuLoops, CARD_LIFE_UP_MULT, cardLevelAfter, cardNormalizeDaily, CARD_PVP_REWARD, CARD_EVENT_BONUS, cardEventBonusMult, cardEventBonusApply, cardEventBonusOn };', ctx);
const E = ctx.E;
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) passed++; else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);
const T = (s) => Date.parse(s);
const ev = E.CARD_EVENT_BONUS.mult;
const room = E.CARD_LIFE_UP_MULT;

// A
check('A 倍は 1.5', ev === 1.5);
check('A 始まる前は 1', E.cardEventBonusMult(T('2026-11-28T09:59:59.999+09:00')) === 1);
check('A 11/28 10:00 ちょうどから 1.5', E.cardEventBonusMult(T('2026-11-28T10:00:00+09:00')) === 1.5);
check('A 期間中 1.5', E.cardEventBonusMult(T('2026-12-24T20:00:00+09:00')) === 1.5);
check('A 12/31 4:00 ちょうどで 1 に戻る', E.cardEventBonusMult(T('2026-12-31T04:00:00+09:00')) === 1 && E.cardEventBonusMult(T('2026-12-31T03:59:59.999+09:00')) === 1.5);
check('A おかしな時刻は 1', E.cardEventBonusMult(NaN) === 1);

// B
const daily = (firstWin) => ({ ...E.cardNormalizeDaily(null, '2026-12-01'), firstWin });
const f10 = { ownTurns: 10, kos: 0 };
{
  const r = E.cardCpuReward(daily(true), 'master', 'win', f10, ev);
  check('B MASTER の勝ち 200 → 300', r.got === 300 && r.base === 200, J(r));
  const r2 = E.cardCpuReward(daily(true), 'master', 'win', f10, room * ev);
  check('B カード部屋と掛け算 200 → 413(200×1.375×1.5)', r2.got === Math.round(200 * room * ev) && r2.got === 413, J(r2));
  const r3 = E.cardCpuReward(daily(false), 'master', 'win', f10, ev);
  check('B その日はじめての +50 は倍にしない', r3.got === 300 && r3.bonus === 50 && r3.total === 350, J(r3));
  const r4 = E.cardCpuReward(daily(true), 'master', 'win', { ownTurns: 2, kos: 0 }, ev);
  check('B 0 は 0', r4.got === 0, J(r4));
  check('B 期間外(倍 1)は今のまま', E.cardCpuReward(daily(true), 'master', 'win', f10, 1).got === 200);
}
// C
check('C 周回 22 → 33', E.cardCpuLoops('master', 'win', f10, ev) === 33);
check('C 部屋と重ねて 22 → 45', E.cardCpuLoops('master', 'win', f10, room * ev) === Math.round(22 * room * ev));
// D
{
  const g0 = E.cardLevelAfter({ xp: 0, day: '2026-12-01', dayWin: true }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01' });
  const base0 = g0.add;
  const g = E.cardLevelAfter({ xp: 0, day: '2026-12-01', dayWin: true }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01', mult: room, event: ev });
  check('D 経験値は掛け算', g.add === Math.round(base0 * room * ev), `${base0} → ${g.add}`);
  check('D 内わけに部屋とイベントが別に出る', g.parts.some((p) => /カード部屋/.test(p.label)) && g.parts.some((p) => /クリスマスイベント/.test(p.label)) && g.parts.reduce((a, p) => a + p.xp, 0) === g.add, J(g.parts));
  const ge = E.cardLevelAfter({ xp: 0, day: '2026-12-01', dayWin: true }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01', event: ev });
  check('D イベントだけ', ge.add === Math.round(base0 * ev) && !ge.parts.some((p) => /カード部屋/.test(p.label)), J(ge.parts));
  const ga0 = E.cardLevelAfter({ xp: 0 }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01', auto: true });
  const ga = E.cardLevelAfter({ xp: 0 }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01', auto: true, event: ev });
  check('D オートは半分のあとに 1.5倍', ga.add === Math.round(ga0.add * ev), `${ga0.add} → ${ga.add}`);
  check('D 倍なしは今のまま', E.cardLevelAfter({ xp: 0, day: '2026-12-01', dayWin: true }, { kind: 'cpu', level: 'master', outcome: 'win', today: '2026-12-01', event: 1 }).add === base0);
}
// E
{
  const x = E.CARD_PVP_REWARD.x;
  const win = E.CARD_PVP_REWARD.win.point * x;
  check('E マルチの勝ち 2倍のあとに 1.5倍', E.cardEventBonusApply(win, ev) === Math.round(win * 1.5), `${win} → ${E.cardEventBonusApply(win, ev)}`);
}
// F
{
  const s84 = src('src/parts/84-screen-card-battle.jsx');
  const s91 = src('src/parts/91-card-battle-multi.jsx');
  check('F 始めた時点の倍を game に持つ(杯は 1)', /eventMult: cup \? 1 : cardEventBonusMult\(\)/.test(s84));
  check('F 助手と対戦は部屋と掛け算', /cardCpuReward\(fresh\.daily, game\.level, outcome, facts, lifeMult \* evMult\)/.test(s84) && /cardCpuLoops\(game\.level, outcome, facts, lifeMult \* evMult\)/.test(s84));
  check('F みんなのデッキ・オート・マルチにも渡す', (s84.match(/event: evMult/g) || []).length >= 3 && /event: pvpEv/.test(s84));
  check('F 結果の帯', /data-card-result-event-bonus/.test(s84) && /data-card-pvp-event-bonus/.test(s91));
}
if (fails.length) { console.log(`NG ${fails.length} 件 / OK ${passed} 件`); fails.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }
console.log(`OK: イベント期間のごほうびの倍 ${passed} 件`);

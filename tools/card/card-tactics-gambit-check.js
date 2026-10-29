// MFバトルカード: 戦術カード(ガンビット型)の中身(2026-10-29 社長「条件カード ▶ 行動カードを上から優先」)。ブラウザなしで 82 と 82-card-tactics-core を動かす。
//
//   node tools/card/card-tactics-gambit-check.js [--verbose]
//
// 見るもの
//   A. カードの表: 154枚(条件98・基本15・ブリーダー12・モンスター29)・N91・R57・SR6・はじめに配る9枚・id が重ならない
//   B. 枠を読める形にする: 知らないカード・枠と区分の取り違え・種族の無い「種族を決めた相手」は捨てる・ブリーダー3行・モンスター5行まで
//   C. 枠が無いときは今と同じ手(助手と対戦・マルチの助手は変わらない)
//   D. 上から優先: 当たった行の手をする。当たらない・場面が違う・出せる手が無い行は飛ばす。OFF の行は飛ばす。モンスターの枠はその子の手だけ
//   H. 基本カード: メインはそのまま・サブは3分の1。メインだけで助手の型と同じくせ。慎重型は効きを半分に
//   E. 標的: 「相手のライフ◯%以下」▶「攻める」は、その子を攻める
//   F. 守り: 守らない・ダメージ◯以上だけ守る・倒されるときだけ守る / ガッツ: ◯枚だけ置く・守り札を残す
//   G. すべての条件と行動が、いろいろな場で投げずに動く(助手どうしの対戦を、並びを持たせて最後まで打つ)
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME = path.resolve(__dirname, '..', '..', 'monster-hero');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_TACTIC_CARDS, CARD_TACTIC_START, CARD_TACTIC_GROUPS, cardTacticNormalizeFrames, cardTacticHabitOf, cardTacticFilled, cardTacticDecide, cardTacticCond, cardTacticOf, cardCreateGame, cardApplyAction, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardOther, cardGuardOptions };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);

// ---- A ----
{
  const C = E.CARD_TACTIC_CARDS;
  const n = (f) => C.filter(f).length;
  const cat = (k) => n((c) => c.cat === k);
  check('A 154枚', C.length === 154, C.length);
  check('A 条件98・基本15・ブリーダー12・モンスター29', cat('cond') === 98 && cat('base') === 15 && cat('breeder') === 12 && cat('monster') === 29, `${cat('cond')}/${cat('base')}/${cat('breeder')}/${cat('monster')}`);
  check('A N91・R57・SR6', n((c) => c.r === 'N') === 91 && n((c) => c.r === 'R') === 57 && n((c) => c.r === 'SR') === 6, `${n((c) => c.r === 'N')}/${n((c) => c.r === 'R')}/${n((c) => c.r === 'SR')}`);
  check('A はじめに配る9枚', E.CARD_TACTIC_START.length === 9, J(E.CARD_TACTIC_START));
  check('A id が重ならない', new Set(C.map((c) => c.id)).size === C.length);
  check('A 名前に◯が残らない', C.every((c) => !c.name.includes('◯')), C.filter((c) => c.name.includes('◯')).map((c) => c.id).join(','));
  check('A 行動には場面がある', C.filter((c) => c.cat === 'breeder' || c.cat === 'monster').every((c) => ['attack', 'guard', 'guts'].includes(c.phase)));
}

// ---- B ----
{
  const f = E.cardTacticNormalizeFrames({ base: ['tDisrupt', 'atk', 'nope'], breeder: [{ c: 'any', a: 'save' }, { c: 'any', a: 'atk' }, { c: 'any', a: 'stop' }, { c: 'ko', a: 'ace' }, { c: 'any', a: 'save' }],
    mons: [[{ c: 'any', a: 'atk' }, { c: 'atk', a: 'any' }, { c: 'nope', a: 'atk' }, null, { c: 'species', a: 'atk' }, { c: 'species', a: 'atk', sp: 'mocchi', on: false },
      { c: 'foeLife.50', a: 'guard' }, { c: 'any', a: 'save' }, { c: 'ko', a: 'atk' }, { c: 'any', a: 'kind.ちから' }, { c: 'any', a: 'noGuard' }]] });
  check('B 基本は基本カードだけ・3枠', J(f.base) === J(['tDisrupt', null, null]), J(f.base));
  check('B ブリーダーの枠はブリーダーカードだけ・3行まで', f.breeder.length === 3 && f.breeder.every((r) => ['save', 'stop', 'ace'].includes(r.a)), J(f.breeder));
  check('B モンスターの枠はモンスターカードだけ・5行まで', f.mons[0].length === 5 && f.mons[0][1].sp === 'mocchi' && f.mons[0][1].on === false && f.mons[0].every((r) => r.a !== 'save'), J(f.mons[0]));
  check('B 壊れた値なら空の枠', J(E.cardTacticNormalizeFrames('x')) === J({ base: [null, null, null], breeder: [], mons: [[], [], []] }));
  check('B 入れた数(基本+ON の行)', E.cardTacticFilled(f) === 1 + 3 + 4, E.cardTacticFilled(f));
}

// ---- 場 ----
const MOCCHI = Object.values(db.monsters).filter((m) => m.species === 'mocchi' && !m.main && !m.variant).map((m) => m.no)[0];
const scene = () => {
  let st = E.cardCreateGame(db, { decks: [{ monsters: [MOCCHI, 'C-006', 'C-001'], cards: Array(50).fill('100') }, { monsters: ['C-003', 'C-006', 'C-001'], cards: Array(50).fill('100') }], seed: 7, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl) => { pl.guts = Array(10).fill('100'); });
  st.players[0].hand = ['105', '100']; // モッチー砲(6)・もちき(3)
  st.players[1].mons.forEach((m) => { m.max = 20; m.life = 20; });
  return st;
};
const pol = (rows, extra = {}) => ({ ...E.cardAiPolicy('kyuko', 'master'), gambit: { mons: [rows, rows, rows], ...extra } });
const polB = (breeder, extra = {}) => ({ ...E.cardAiPolicy('kyuko', 'master'), gambit: { breeder, ...extra } });
const zero = () => 0;
const targetOf = (a) => (a && a.target ? a.target.m : null);

// ---- C ----
{
  const st = scene();
  const a0 = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master'), zero);
  const a1 = E.cardAiChooseAction(db, st, pol([]), zero);
  const a2 = E.cardAiChooseAction(db, st, polB([{ c: 'turnGe.15', a: 'stop' }]), zero);
  check('C 並びが空なら今と同じ手', J(a0) === J(a1), `${J(a0)} / ${J(a1)}`);
  check('C 当たる行が無ければ今と同じ手', J(a0) === J(a2), `${J(a0)} / ${J(a2)}`);
}

// ---- D ----
{
  const st = scene();
  const a = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'stop' }]), zero);
  check('D 「いつでも ▶ 攻撃を止める」で攻撃を終える', a && a.type === 'endAttacks', J(a));
  const off = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'stop', on: false }]), zero);
  check('D OFF の行は飛ばす', off && off.type !== 'endAttacks', J(off));
  const phase = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'noGuard' }], { breeder: [{ c: 'any', a: 'stop' }] }), zero);
  check('D 場面が違う行(守り)は飛ばして次の行', phase && phase.type === 'endAttacks', J(phase));
  const cannot = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'fieldCard' }, { c: 'any', a: 'stop' }]), zero);
  check('D 出せる手が無い行(全体カード)は飛ばして次の行', cannot && cannot.type === 'endAttacks', J(cannot));
  const order = E.cardAiChooseAction(db, st, pol([{ c: 'myGuts.7', a: 'cost.軽い技(ガッツ0〜1)' }, { c: 'any', a: 'cost.大技(4以上)' }]), zero);
  const only1 = E.cardAiChooseAction(db, st, { ...E.cardAiPolicy('kyuko', 'master'), gambit: { mons: [[], [{ c: 'any', a: 'atk' }], []] } }, zero);
  const base0 = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master'), zero);
  check('D 真ん中の子(モッチーの技を使えない)の枠の「攻める」は飛ばす', J(only1) === J(base0), `${J(only1)} / ${J(base0)}`);
  const big1 = E.cardAiChooseAction(db, st, { ...E.cardAiPolicy('kyuko', 'master'), gambit: { mons: [[{ c: 'any', a: 'cost.大技(4以上)' }], [], []] } }, zero);
  check('D 左の子の枠の大技は、左の子が出す', big1 && big1.type === 'attack' && big1.mon === 0 && st.players[0].hand[big1.hand[0]] === '105', J(big1));
  check('D 上の行(当たらない)を飛ばし、下の行の大技を出す', order && order.type === 'attack' && st.players[0].hand[order.hand[0]] === '105', J(order));
}

// ---- E ----
{
  const st = scene();
  st.players[1].mons[2].life = 3; // 3体目だけ 15%
  const a = E.cardAiChooseAction(db, st, pol([{ c: 'foeLife.20', a: 'atk' }]), zero);
  check('E 「相手のライフ20%以下」▶「攻める」は、その子を攻める', targetOf(a) === 2, J(a));
  const b = E.cardAiChooseAction(db, st, pol([{ c: 'leader', a: 'atk' }]), zero);
  check('E 「相手のリーダー」▶「攻める」は1体目を攻める', targetOf(b) === 0, J(b));
  const sp = st.players[1].mons[1].species;
  const c = E.cardAiChooseAction(db, st, pol([{ c: 'species', a: 'atk', sp }]), zero);
  check('E 「種族を決めた相手」は選んだ種族の子を攻める', targetOf(c) === 1, J(c));
  const none = E.cardTacticCond(db, st, 0, E.cardTacticOf('foeLife.10'), null);
  check('E 当たる子がいなければ条件は当たらない', none === null, J(none));
}

// ---- F ----
{
  // 攻撃を受けている場を作る(相手=0 が自分=1 を攻撃。自分は守りの札を持つ)
  const guardScene = (dmgLife) => {
    let st = scene();
    const guards = Object.values(db.cards).filter((c) => (c.kind === 'blk' || c.kind === 'dge') && c.user === 'any' && c.ready && (c.guts || 0) <= 2).map((c) => c.no);
    st.players[1].hand = guards.slice(0, 2);
    st.players[1].mons[0].life = dmgLife;
    const opt = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master'), zero);
    st = E.cardApplyAction(db, st, { type: 'attack', mon: 0, hand: [st.players[0].hand.indexOf('100')], target: { p: 1, m: 0 } });
    return { st, guards, opt };
  };
  const g = guardScene(20);
  if (g.st && g.st.pending && E.cardGuardOptions(db, g.st).length) {
    const st = g.st;
    const no = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'noGuard' }]), zero);
    check('F 守らない', no.type === 'pass', J(no));
    const yes = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'guard' }]), zero);
    check('F 守る(小さい攻撃でも守る)', yes.type === 'guard', J(yes));
    const over = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'guardOver.7' }]), zero);
    check('F ダメージ7以上だけ守る(3の攻撃は受ける)', over.type === 'pass', J(over));
    const die = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'guardDie' }]), zero);
    check('F 倒されるときだけ守る(20のライフに3は受ける)', die.type === 'pass', J(die));
    const mine = E.cardAiChooseAction(db, st, pol([{ c: 'myLife.10', a: 'noGuard' }, { c: 'any', a: 'guard' }]), zero);
    check('F 守る相手が決まっていて、狙われたのが別の子なら次の行', mine.type === 'guard', J(mine));
  } else {
    check('F 攻撃を受けている場を作れる', false, '守りの場を作れなかった');
  }
  const d = guardScene(2);
  if (d.st && d.st.pending && E.cardGuardOptions(db, d.st).length) {
    const die = E.cardAiChooseAction(db, d.st, pol([{ c: 'any', a: 'guardDie' }]), zero);
    check('F 倒されるときは守る', die.type === 'guard', J(die));
  }
  // ガッツの番
  let st = scene();
  st = E.cardApplyAction(db, st, { type: 'endAttacks' });
  st.players[0].hand = ['100', '105', ...Object.values(db.cards).filter((c) => c.kind === 'blk' && c.user === 'any' && c.ready).map((c) => c.no).slice(0, 1)];
  st.players[0].guts = [];
  if (st.phase === 'guts') {
    const zeroG = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'gutsN.0' }]), zero);
    check('F ガッツを0枚だけ置く', zeroG.type === 'guts' && zeroG.hand.length === 0, J(zeroG));
    const one = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'gutsN.1' }]), zero);
    check('F ガッツを1枚だけ置く', one.type === 'guts' && one.hand.length === 1, J(one));
    const keep = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'save' }, { c: 'any', a: 'keepGuard' }]), zero);
    const keep2 = E.cardAiChooseAction(db, st, polB([{ c: 'any', a: 'keepGuard' }]), zero);
    check('F 守り札を残して置く(守りの札をガッツにしない)', keep2.type === 'guts' && !keep2.hand.includes(2), J(keep2));
    check('F ガッツをためる', keep.type === 'guts', J(keep));
  } else {
    check('F ガッツの番を作れる', false, st.phase);
  }
}

// ---- G ----
{
  const conds = E.CARD_TACTIC_CARDS.filter((c) => c.cat === 'cond');
  const brs = E.CARD_TACTIC_CARDS.filter((c) => c.cat === 'breeder');
  const mons = E.CARD_TACTIC_CARDS.filter((c) => c.cat === 'monster');
  const bases = E.CARD_TACTIC_CARDS.filter((c) => c.cat === 'base');
  const who = ['mua', 'momosuke', 'kiki', 'kyuko', 'dra', 'atsu', 'sorashido'];
  let games = 0, errors = 0, done = 0;
  const firstErr = [];
  for (let gi = 0; gi < 24; gi++) {
    const rand = E.cardAiSeededRand(`gambit-${gi}`);
    const pick = (list, k, n) => [0, 1, 2, 3, 4].slice(0, n).map((j) => {
      const c = conds[(gi * 7 + (k * 5 + j) * 13) % conds.length], a = list[(gi * 5 + (k * 5 + j) * 11) % list.length];
      return { c: c.id, a: a.id, ...(c.g === 'species' ? { sp: 'mocchi' } : {}) };
    });
    const rows = { base: [bases[gi % bases.length].id, bases[(gi + 4) % bases.length].id, gi % 3 ? bases[(gi + 9) % bases.length].id : null],
      breeder: pick(brs, 0, 3), mons: [pick(mons, 1, 5), pick(mons, 2, 5), pick(mons, 3, 5)] };
    const w0 = who[gi % who.length], w1 = who[(gi + 3) % who.length];
    const decks = [E.cardAiBuildDeck(db, w0, 'master', rand), E.cardAiBuildDeck(db, w1, 'master', rand)];
    let st = E.cardCreateGame(db, { decks, seed: 100 + gi, first: gi % 2 });
    const pols = [{ ...E.cardAiPolicy(w0, 'master'), gambit: rows, aces: decks[0].cards.slice(0, 2) }, E.cardAiPolicy(w1, 'master')];
    games++;
    try {
      for (let step = 0; step < 900 && st.winner === null; step++) {
        const who2 = st.pending ? st.pending.defender : st.pendingChoice ? st.pendingChoice.p : st.pendingDiscard ? st.pendingDiscard.p : st.phase === 'setup' ? E.cardOther(st.first) : st.active;
        const a = E.cardAiChooseAction(db, st, pols[who2], rand);
        const nx = E.cardApplyAction(db, st, a);
        if (!nx) throw new Error(`できない手 ${J(a)}`);
        st = nx;
      }
      if (st.winner !== null) done++;
    } catch (e) { errors++; if (firstErr.length < 3) firstErr.push(`${gi}: ${e.message}`); }
  }
  check('G 並びを持たせた対戦が投げずに動く', errors === 0, firstErr.join(' / '));
  check('G ほとんどの対戦が最後まで終わる', done >= games - 2, `${done}/${games}`);
}

// ---- H ----
{
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const h = E.cardTacticHabitOf(['tDisrupt', null, null]);
  const mo = E.CARD_AI_HABITS.momosuke;
  check('H メインだけなら助手の型と同じくせ(崩し型=ももすけ)', ['attack', 'keepGuard', 'saveGuts', 'big', 'disrupt', 'area', 'finish'].every((d) => near(h[d], Math.min(2, Math.max(0.3, mo[d])))), J(h));
  const s1 = E.cardTacticHabitOf(['tBalance', 'tBig', null]);
  check('H サブは3分の1(大技型 ×1.6 → ×1.2)', near(s1.big, 1.2), s1.big);
  const s2 = E.cardTacticHabitOf(['tBig', 'tBig', 'tBig']);
  check('H 同じ向きを重ねても ×2 まで', s2.big <= 2 && s2.big > 1.6, s2.big);
  const calm = E.cardTacticHabitOf(['tCalm', 'tBig', null]);
  check('H 慎重型(メイン)はほかの効きを半分に', near(calm.big, 1.1), calm.big);
  check('H 臨機応変型・持久型(メイン)', E.cardTacticHabitOf(['tFlex', null, null]).flex === true && E.cardTacticHabitOf(['tMill', null, null]).mill === 1);
  check('H 基本カードが無ければ null', E.cardTacticHabitOf([null, null, null]) === null);
}

console.log(`card-tactics-gambit-check: ${passed} OK / ${fails.length} NG`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); process.exit(1); }

// MFバトルカード: 戦術カード(ガンビット型)の中身(2026-10-29 社長「条件カード ▶ 行動カードを上から優先」)。ブラウザなしで 82 と 82-card-tactics-core を動かす。
//
//   node tools/card/card-tactics-gambit-check.js [--verbose]
//
// 見るもの
//   A. カードの表: 246枚(条件132・基本20・ブリーダー38・モンスター56)・N146・R86・SR14・はじめに配る10枚・id が重ならない
//   B. 枠を読める形にする: 知らないカード・枠と区分の取り違え・種族の無い「種族を決めた相手」は捨てる・ブリーダー3行・モンスター5行まで
//   C. 枠が無いときは今と同じ手(助手と対戦・マルチの助手は変わらない)
//   D. 上から優先: 当たった行の手をする。当たらない・場面が違う・出せる手が無い行は飛ばす。OFF の行は飛ばす。モンスターの枠はその子の手だけ
//   H. 基本カード: メインはそのまま・サブは3分の1。メインだけで助手の型と同じくせ。慎重型は効きを半分に
//   J. 賢さ(基本の枚数が上限・行の数で上がる)・みんなのデッキに載せる短い形(行き来できる・いちばん長くても2000バイトに収まる)・何も入れていないとランダム
//   I. 増やしたカード: この子の条件・守るときの条件・立ち回り・ブリーダーのカードを温存・基本カードの細かいくせ(速攻・一点集中・手札温存・守り方)
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
  + 'this.E = { cardTacticSmartLevel, cardTacticUncounted, cardTacticPackFrames, cardTacticUnpackFrames, cardTacticKnobsOf, CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_TACTIC_CARDS, CARD_TACTIC_START, CARD_TACTIC_GROUPS, cardTacticNormalizeFrames, cardTacticHabitOf, cardTacticFilled, cardTacticDecide, cardTacticCond, cardTacticOf, cardCreateGame, cardApplyAction, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardOther, cardGuardOptions, CARD_AI_TACTIC_BASE };', ctx);
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
  check('A 246枚', C.length === 246, C.length);
  check('A 条件132・基本20・ブリーダー38・モンスター56', cat('cond') === 132 && cat('base') === 20 && cat('breeder') === 38 && cat('monster') === 56, `${cat('cond')}/${cat('base')}/${cat('breeder')}/${cat('monster')}`);
  check('A N146・R86・SR14', n((c) => c.r === 'N') === 146 && n((c) => c.r === 'R') === 86 && n((c) => c.r === 'SR') === 14, `${n((c) => c.r === 'N')}/${n((c) => c.r === 'R')}/${n((c) => c.r === 'SR')}`);
  check('A はじめに配る10枚', E.CARD_TACTIC_START.length === 10, J(E.CARD_TACTIC_START));
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
const pol = (rows, extra = {}) => ({ ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: { mons: [rows, rows, rows], ...extra } });
const polB = (breeder, extra = {}) => ({ ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: { breeder, ...extra } });
const zero = () => 0;
const targetOf = (a) => (a && a.target ? a.target.m : null);

// ---- C ----
{
  const st = scene();
  const a0 = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master', { noTactics: true }), zero);
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
  const only1 = E.cardAiChooseAction(db, st, { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: { mons: [[], [{ c: 'any', a: 'atk' }], []] } }, zero);
  const base0 = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master', { noTactics: true }), zero);
  check('D 真ん中の子(モッチーの技を使えない)の枠の「攻める」は飛ばす', J(only1) === J(base0), `${J(only1)} / ${J(base0)}`);
  const big1 = E.cardAiChooseAction(db, st, { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: { mons: [[{ c: 'any', a: 'cost.大技(4以上)' }], [], []] } }, zero);
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
    const opt = E.cardAiChooseAction(db, st, E.cardAiPolicy('kyuko', 'master', { noTactics: true }), zero);
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
    // 手が詰まったとき(2026-11-02 社長「案A + 案B」): その番に何も使わず手札が5枚なら、ガッツが足りていても入れ替える
    const guardsAny = Object.values(db.cards).filter((c) => (c.kind === 'blk' || c.kind === 'dge') && c.user === 'any' && c.ready).map((c) => c.no);
    const stuck = JSON.parse(JSON.stringify(st));
    stuck.players[0].hand = guardsAny.slice(0, 5);
    stuck.players[0].guts = Array(20).fill('100');
    const nGuard = (act) => stuck.players[0].hand.filter((_, i) => !act.hand.includes(i)).length;
    const z0 = E.cardAiChooseAction(db, stuck, polB([{ c: 'any', a: 'gutsN.0' }]), zero);
    check('F2 手札をガッツにしない: 守りの札だけで手札5枚・何も使えなかった番は、守り2枚だけ残して入れ替える', z0.type === 'guts' && z0.hand.length >= 1 && nGuard(z0) === 2, J(z0));
    const kg = E.cardAiChooseAction(db, stuck, polB([{ c: 'any', a: 'keepGuard' }]), zero);
    check('F2 守りのカードを3枚まで残す: 守りの札だけで手札5枚・何も使えなかった番は、守り3枚だけ残す', kg.type === 'guts' && nGuard(kg) === 3, J(kg));
    const plain = E.cardAiChooseAction(db, stuck, E.cardAiPolicy('kyuko', 'master'), zero);
    check('F2 戦術カードの無い AI も、ガッツがたまっていても、何も使えなかった番は入れ替える', plain.type === 'guts' && plain.hand.length >= 1, J(plain));
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

// ---- I ----
{
  const P = (g) => ({ ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: g });
  let st = scene();
  st.players[0].mons[0].life = 1; // モッチー(左の子)のライフ少し
  const c1 = E.cardTacticCond(db, st, 0, E.cardTacticOf('selfLife.30'), null, { mi: 0, phase: 'attack' });
  const c2 = E.cardTacticCond(db, st, 0, E.cardTacticOf('selfLife.30'), null, { mi: 1, phase: 'attack' });
  const c3 = E.cardTacticCond(db, st, 0, E.cardTacticOf('selfLife.30'), null, { mi: null, phase: 'attack' });
  check('I 「この子のライフ30%以下」はその枠の子だけを見る', !!c1 && c2 === null && c3 === null, `${J(c1)} ${J(c2)} ${J(c3)}`);
  check('I 守るときの条件は守るときだけ', E.cardTacticCond(db, st, 0, E.cardTacticOf('incoming.3'), null, { mi: 0, phase: 'attack' }) === null);
  const skip = E.cardAiChooseAction(db, st, P({ mons: [[{ c: 'any', a: 'stance.この子は攻撃しない' }], [], []] }), zero);
  check('I 立ち回り「この子は攻撃しない」(モッチーしか攻撃できない場なので攻撃を終える)', skip && skip.type === 'endAttacks', J(skip));
  const light = E.cardAiChooseAction(db, st, P({ base: ['tRush', null, null] }), zero);
  check('I 速攻型は軽い技だけ(モッチー砲6は出さない)', light && (light.type === 'endAttacks' || st.players[0].hand[light.hand[0]] !== '105'), J(light));
  const keep = E.cardAiChooseAction(db, st, P({ base: ['tHand', null, null] }), zero);
  check('I 手札を残す型は手札を2枚残す(2枚しかないので攻撃しない)', keep && keep.type === 'endAttacks', J(keep));
  st = scene();
  st.players[1].mons[2].life = 4;
  const focus = E.cardAiChooseAction(db, st, P({ base: ['tFocus', null, null] }), zero);
  check('I 一点集中型はいちばん弱った子を狙う', focus && focus.type === 'attack' && focus.target && focus.target.m === 2, J(focus));
  check('I サブのくせは3回に1回の番だけ', JSON.stringify(E.cardTacticKnobsOf(['tBalance', 'tRush', null], { ...st, turn: 1, first: 0 }, 0)) === '{}', J(E.cardTacticKnobsOf(['tBalance', 'tRush', null], { ...st, turn: 1, first: 0 }, 0)));
}

// ---- J ----
{
  // 別々の条件のセット(同じものは1つと数えるので、ちがう条件を並べる)。n 番目から始める
  const CONDS = ['any', 'ko', 'lowest', 'highest', 'strongest', 'attacker', 'leader', 'foeLife.90', 'foeLife.80', 'foeLife.70', 'foeLife.60', 'foeLife.50', 'foeLife.40', 'foeLife.30', 'foeLife.20'];
  let ci = 0;
  const rows = (n) => Array.from({ length: n }, () => ({ c: CONDS[(ci++) % CONDS.length], a: 'atk' }));
  const F = (base, n) => ({ base, mons: [rows(Math.min(5, n)), rows(Math.min(5, Math.max(0, n - 5))), rows(Math.max(0, n - 10))] });
  const L = (base, n) => { ci = 0; return E.cardTacticSmartLevel(F(base, n)); };
  // 2026-10-30 社長「戦術カードなしでエキスパートクラスで、そこから上がっていってマスター超え」(段の名前は本編のチャレンジモード)
  check('J 何も無ければ EXPERT(でたらめにしない)・効く戦術カード4枚で MASTER', L([], 0) === 'expert' && L([], 3) === 'expert' && L([], 4) === 'master');
  check('J 基本1枚: 0〜3枚 EXPERT・4枚から MASTER(基本2枚でないと MASTER を超えない)', L(['tBalance'], 3) === 'expert' && L(['tBalance'], 4) === 'master' && L(['tBalance'], 15) === 'master');
  // 2026-11-04 社長 案B: GRAND MASTER・HELL は基本2枚から(前は基本3枚。3枚目はカードランク30まで開かないので、みんな MASTER で止まっていた)
  const B2 = ['tBalance', 'tBig'];
  check('J 基本2枚: 0〜5枚 MASTER・6〜8 GRAND MASTER・9〜 HELL(LEGEND にはならない)', L(B2, 0) === 'master' && L(B2, 5) === 'master' && L(B2, 6) === 'grandmaster' && L(B2, 8) === 'grandmaster' && L(B2, 9) === 'hell' && L(B2, 15) === 'hell',
    [0, 5, 6, 8, 9, 15].map((n) => L(B2, n)).join(' '));
  const B = ['tBalance', 'tBig', 'tArea'];
  check('J 基本3枚: 0〜5枚 MASTER・6〜8 GRAND MASTER・9 HELL・10〜 LEGEND', L(B, 5) === 'master' && L(B, 6) === 'grandmaster' && L(B, 8) === 'grandmaster' && L(B, 9) === 'hell' && L(B, 10) === 'legend' && L(B, 15) === 'legend',
    [5, 6, 8, 9, 10, 15].map((n) => L(B, n)).join(' '));
  // いちばん長い名前のカードで、全部の枠を埋めたとき
  const longest = (cat) => E.CARD_TACTIC_CARDS.filter((c) => c.cat === cat).sort((a, b) => Buffer.byteLength(b.id) - Buffer.byteLength(a.id))[0].id;
  const row = (cat) => ({ c: 'species', a: longest(cat), sp: 'colorpandora', on: false });
  const full = { base: ['tComeback', 'tComeback', 'tComeback'], breeder: [0, 1, 2].map(() => row('breeder')), mons: [0, 1, 2].map(() => [0, 1, 2, 3, 4].map(() => row('monster'))) };
  const packed = E.cardTacticPackFrames(full);
  const bytes = Buffer.byteLength(JSON.stringify({ name: 'あいうえおかきくけこさしすせそたちつてと', habit: 'sorashido', tilt: { attack: 0, keepGuard: 0, saveGuts: 0, big: 0, disrupt: 0, area: 0, finish: 0 }, aces: ['111', '222', '333'], f: packed }));
  check('J いちばん長くても表の上限 2000 バイトに収まる', bytes <= 2000, bytes);
  check('J 短い形は行き来できる', JSON.stringify(E.cardTacticUnpackFrames(packed)) === JSON.stringify(E.cardTacticNormalizeFrames(full)));
  const st = scene();
  let moved = 0;
  for (let i = 0; i < 20; i++) { const a = E.cardAiChooseAction(db, st, { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: {}, gambitRandom: true }, Math.random); if (a && (a.type === 'attack' || a.type === 'endAttacks')) moved++; }
  check('J 何も入れていないデッキはランダムに打つ(できる手を返す)', moved === 20, moved);
}

// ---- L. 賢さに数えないセット(2026-10-29 社長 案A「ちゃんと効くカードだけ数える」) ----
{
  const B3 = ['tBalance', 'tFinish', 'tSteady'];
  const lv = (mons, breeder = []) => E.cardTacticSmartLevel({ base: B3, breeder, mons });
  const same = Array.from({ length: 4 }, () => ({ c: 'ko', a: 'atk' }));
  check('L 同じセットを3体の枠に何個入れても1つと数える(GRAND MASTER にならない)', lv([same, same, same]) === 'master');
  const rare = [{ c: 'turnGe.15', a: 'guard' }, { c: 'myLife.10', a: 'atk' }, { c: 'foeLife.10', a: 'atk' }, { c: 'foeStun', a: 'atk' }];
  check('L ほとんど当たらない条件は数えない', lv([rare, rare.map((r) => ({ ...r, a: 'kind.ちから' })), rare.map((r) => ({ ...r, a: 'kind.かしこさ' }))]) === 'master');
  const mis = [{ c: 'incoming.3', a: 'atk' }, { c: 'incomingKo', a: 'kind.ちから' }, { c: 'incoming.5', a: 'cost.大技(4以上)' }, { c: 'incoming.7', a: 'atk' }];
  check('L 守るときの条件を攻める手と組んだセットは数えない', lv([mis, [], []]) === 'master');
  check('L ブリーダーの枠の「この子の◯◯」は数えない', E.cardTacticUncounted({ base: B3, breeder: [{ c: 'selfLife.50', a: 'save' }], mons: [[], [], []] }).breeder[0] === '場面が合わない');
  const good = [{ c: 'incomingKo', a: 'guard' }, { c: 'myGuts.5', a: 'cost.大技(4以上)' }, { c: 'foeAlive.3', a: 'reach.全体攻撃' }, { c: 'foeHandGe.4', a: 'disrupt.手札を捨てさせる' }];
  check('L 意味のあるセット4つは4枚と数える', E.cardTacticUncounted({ base: B3, breeder: [], mons: [good, [], []] }).mons[0].filter((x) => x === null).length === 4);
  const u = E.cardTacticUncounted({ base: B3, breeder: [], mons: [[{ c: 'ko', a: 'atk' }], [{ c: 'ko', a: 'atk' }], [{ c: 'turnGe.15', a: 'atk' }]] });
  check('L 数えない理由が付く(同じもの・ほとんど当たらない)', u.mons[0][0] === null && u.mons[1][0] === '同じものが入っている' && u.mons[2][0] === 'ほとんど当たらない', JSON.stringify(u));
  check('L 数えないセットだけなら EXPERT', E.cardTacticSmartLevel({ base: [], breeder: [], mons: [[{ c: 'turnGe.15', a: 'atk' }], [], []] }) === 'expert');
}

// ---- K. 助手と対戦の基本カード(2026-10-29 社長: EXPERT は2枚・MASTER は3枚。メインは今の型のまま) ----
{
  const who = Object.keys(E.CARD_AI_HABITS);
  check('K 7人とも基本カードの並びがある', who.every((w) => Array.isArray(E.CARD_AI_TACTIC_BASE[w]) && E.CARD_AI_TACTIC_BASE[w].length === 3 && E.CARD_AI_TACTIC_BASE[w].every((id) => E.cardTacticOf(id) && E.cardTacticOf(id).cat === 'base')));
  who.forEach((w) => {
    const ex = E.cardAiPolicy(w, 'expert'), ma = E.cardAiPolicy(w, 'master');
    check(`K ${w}: EXPERT は2枚・MASTER は3枚`, ex.gambit && ex.gambit.base.filter(Boolean).length === 2 && ma.gambit && ma.gambit.base.filter(Boolean).length === 3 && !ma.gambitRandom);
    check(`K ${w}: HARD まではくせだけ(基本カードは持たない)`, ['easy', 'normal', 'hard'].every((lv) => !E.cardAiPolicy(w, lv).gambit));
    check(`K ${w}: プレイヤー役は持たない`, !E.cardAiPolicy(w, 'master', { playerRole: true }).gambit);
    // メインは今のくせのまま: 2枚目・3枚目が無ければ、くせは今の値と同じ
    const h = E.cardTacticHabitOf([ma.gambit.base[0], null, null], null, 0, ma.habit);
    check(`K ${w}: メインの型は今のくせ(強さごとの調整ずみ)のまま`, ['attack', 'keepGuard', 'saveGuts', 'big', 'disrupt', 'area', 'finish'].every((d) => Math.abs(h[d] - Math.min(2, Math.max(0.3, ma.habit[d]))) < 1e-9) && !!h.flex === !!ma.habit.flex);
  });
  check('K メインの細かいくせは足さない(攻め型の「倒れるときだけ守る」が助手に付かない)', !E.cardTacticKnobsOf(['tAttack', null, null], null, 0, true).guardDieOnly && E.cardTacticKnobsOf(['tAttack', null, null], null, 0, false).guardDieOnly === true);
}

// ---- M. 登録デッキの打ち方(2026-11-02 社長 ア+イ+ウ+「倒れるのに守る」) ----
{
  // ア: 基本カードは、登録したくせの上に足す。くせと同じ型の基本カード(くせ みゅあ に攻め型)は二重に足さない
  const mua = E.cardAiPolicy('mua', 'master', { noTactics: true }).habit;
  const keep = E.cardTacticHabitOf(['tAttack', 'tFinish', 'tBig'], null, 0, mua);
  const on = E.cardTacticHabitOf(['tAttack', 'tFinish', 'tBig'], null, 0, mua, null, true, 'mua');
  check('M くせ みゅあ に攻め型・仕留め型・大技型を足すと、助手 MASTER と同じくせになる', ['attack', 'keepGuard', 'saveGuts', 'big', 'disrupt', 'area', 'finish'].every((d) => Math.abs(keep[d] - on[d]) < 1e-9), J({ keep, on }));
  const onDra = E.cardTacticHabitOf(['tAttack', null, null], null, 0, E.cardAiPolicy('dra', 'master', { noTactics: true }).habit, null, true, 'dra');
  check('M くせ ドラ に攻め型を入れると、攻めが強くなる(くせの上に足す)', onDra.attack > E.cardAiPolicy('dra', 'master', { noTactics: true }).habit.attack, J(onDra));
  check('M くせと同じ型の細かいくせは二重に付けない(くせ みゅあ の攻め型に「倒れるときだけ守る」を付けない)', !E.cardTacticKnobsOf(['tAttack', null, null], null, 0, false, 'mua').guardDieOnly && !!E.cardTacticKnobsOf(['tAttack', null, null], null, 0, false, 'dra').guardDieOnly);
  // 倒れるのに守る: 守っても倒れるのが変わらない守り(光の盾で3を1減らしても、ライフ1の子は倒れる)は、「守る」の行でも出さない
  let st = scene();
  st.players[1].hand = ['350'];
  st.players[1].mons[0].life = 1;
  st = E.cardApplyAction(db, st, { type: 'attack', mon: 0, hand: [st.players[0].hand.indexOf('100')], target: { p: 1, m: 0 } });
  if (st && st.pending && E.cardGuardOptions(db, st).length) {
    const a = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'guard' }]), zero);
    check('M 守っても倒れるのが変わらない守りは、「守る」の行でも出さずに受ける', a.type === 'pass', J(a));
    st.players[1].mons[0].life = 3;
    const b = E.cardAiChooseAction(db, st, pol([{ c: 'any', a: 'guard' }]), zero);
    check('M 守れば倒れないなら守る(ライフ3に3を1減らす)', b.type === 'guard', J(b));
  } else check('M 守りの場を作れる', false, '場を作れなかった');
}

// ---- N. ガッツにする順(2026-11-02 社長「防御系ガンガン捨てるくせに、もう死んでるモンスターのカードは残したりする」) ----
{
  const gutsScene = () => {
    const st = scene();
    st.phase = 'guts'; st.active = 0; st.pending = null;
    st.players[0].mons[0].ko = true; st.players[0].mons[0].life = 0; // モッチーが倒れた: もちき(100)はもう出せない
    st.players[0].guts = [];
    st.players[0].hand = ['100', '350']; // もちき(出せない)・光の盾(だれでも使える守り)
    return st;
  };
  const a = E.cardAiChooseAction(db, gutsScene(), E.cardAiPolicy('kyuko', 'master', { noTactics: true }), zero);
  check('N 倒れた子の札を先にガッツにして、使える守りは残す', a.type === 'guts' && a.hand.includes(0) && !a.hand.includes(1), J(a));
  const sloppy = { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }) };
  sloppy.level = { ...sloppy.level, sloppy: 1 };
  const b = E.cardAiChooseAction(db, gutsScene(), sloppy, zero);
  check('N 雑な手の番でも、倒れた子の札はガッツにして、使える守りはでたらめに捨てない', b.type === 'guts' && b.hand.includes(0) && !b.hand.includes(1), J(b));
}

// ---- O. 勝ちになる一撃(2026-11-02 社長「勝ちになる攻撃は、自分が傷つく技でも打つ」) ----
{
  const winScene = (life) => {
    const st = scene();
    st.players[0].hand = ['101']; // もっちゃん(5・当たると自分に1)
    st.players[1].mons.forEach((m, i) => { if (i > 0) { m.ko = true; m.life = 0; } });
    st.players[1].mons[0].life = life;
    st.players[1].hand = [];
    return st;
  };
  const steady = { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }), gambit: { base: ['tSteady', null, null], mons: [[], [], []] } };
  const a = E.cardAiChooseAction(db, winScene(5), steady, zero);
  check('O 堅実型でも、当たれば勝ちの一撃(自分も傷つく技)は打つ', a.type === 'attack', J(a));
  const b = E.cardAiChooseAction(db, winScene(20), steady, zero);
  check('O 堅実型は、勝ちにならないときは自分も傷つく技を出さない', b.type !== 'attack', J(b));
  const sl = { ...E.cardAiPolicy('kyuko', 'master', { noTactics: true }) };
  sl.level = { ...sl.level, sloppy: 1 };
  const c = E.cardAiChooseAction(db, winScene(5), sl, zero);
  check('O 雑な手の番でも、当たれば勝ちの一撃は打つ', c.type === 'attack', J(c));
}

// ---- P. 勝ちの一撃はどの段でも行より先に・GRAND MASTER 以上は攻めを先読み先に(2026-11-03 社長 C・D) ----
{
  const winScene = () => {
    const st = scene();
    st.players[0].hand = ['100']; // もちき(3)
    st.players[1].mons.forEach((m, i) => { if (i > 0) { m.ko = true; m.life = 0; } });
    st.players[1].mons[0].life = 3;
    st.players[1].hand = [];
    return st;
  };
  const stopFirst = pol([{ c: 'any', a: 'stop' }]);
  const a = E.cardAiChooseAction(db, winScene(), stopFirst, zero);
  check('P 「攻撃をやめる」の行があっても、勝ちの一撃は先に打つ', a.type === 'attack', J(a));
  const easy = E.cardAiChooseAction(db, winScene(), E.cardAiPolicy('kyuko', 'easy'), zero);
  check('P EASY でも勝ちの一撃は打つ', easy.type === 'attack', J(easy));
  // 先読みつき: 攻める段は、当たった行の手を「勧める手」にして先読みへ回す(行の手をそのまま返さない)
  const st = scene();
  const sp = { ...pol([{ c: 'any', a: 'atk' }]), search: { k: 3, r: 1, h: 1, eval: 'ko' } };
  const d = E.cardTacticDecide(db, st, sp);
  check('P 先読みつきは、攻める段で行の手を先読みの候補として渡す', !!d && !d.act && !!d.policy && !!d.policy.searchHint, J(d && { act: d.act, hint: d.policy && d.policy.searchHint }));
  const g = E.cardAiChooseAction(db, scene(), sp, () => 0.5);
  check('P 先読みつきで、攻める手を出せる', g.type === 'attack' || g.type === 'endAttacks', J(g));
}

console.log(`card-tactics-gambit-check: ${passed} OK / ${fails.length} NG`);
if (fails.length) { fails.forEach((f) => console.log(`NG: ${f}`)); process.exit(1); }

// MFバトルカードのルールの本体(src/parts/82-card-battle-core.jsx)を、ブラウザなしで動かして確かめる。
// 1) 決まりごとの小さな場面(社長が決めたルールどおりに数字が出るか)
// 2) コンピューターどうしをスターターで何百戦もさせて、止まらない・おかしな状態にならない・勝率が偏りすぎないか
// 使い方: node tools/card/card-rules-check.js [--games 300] [--verbose]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');

const load = () => {
  const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
  const src = `${fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8')}\n;\n${fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8')}\n;\n`
    // 85 は画面の部品(SkillFxMotion)を使うので、ルールだけで動く「動きの見本」の所だけ読む
    + `${fs.readFileSync(path.join(GAME, 'src', 'parts', '85-card-battle-motion.jsx'), 'utf8').split('// ---- 動きの見本')[1].replace(/^[^\n]*\n/, '')}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, cardCreateGame, cardApplyAction, cardLegalActions, cardAttackOptions, cardGuardOptions, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardSimulate, CARD_AI_LEVELS, CARD_AI_HABITS, CARD_AI_DECKS, cardDeckProblems, cardNormalizeCollection, cardNormalizeDecks, cardNormalizePoint, cardNormalizeDaily, cardNormalizeRecord, cardNormalizeCpuUnlocked, cardGrantStarter, cardCpuReward, cardUnlockAfterWin, cardMotionDemo, cardMotionDemoAction };';
  vm.runInContext(src, ctx, { filename: '82-card-battle-core.jsx' });
  return ctx.E;
};

const E = load();
const db = E.CARD_BATTLE_DATA;
const args = process.argv.slice(2);
const GAMES = Number((args[args.indexOf('--games') + 1]) || 0) || 300;
const VERBOSE = args.includes('--verbose');
const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };

// ---- 場面を作るための小さな道具 ----
// 両方とも決まった3体・山札は同じ札で埋め、手札とガッツを指定する
const scene = ({ mons = [['C-001', 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands = [[], []], guts = [0, 0], active = 0 }) => {
  const decks = mons.map((m) => ({ monsters: m, cards: Array(50).fill('100') }));
  let st = E.cardCreateGame(db, { decks, seed: 3, first: 0 });
  st = E.cardApplyAction(db, st, { type: 'setupGuts', hand: [] });
  st.players.forEach((pl, i) => { pl.hand = hands[i].slice(); pl.guts = Array(guts[i]).fill('100'); });
  st.active = active; st.phase = 'main';
  return st;
};
const find = (opts, pred) => opts.find(pred);
const act = (st, a) => { const n = E.cardApplyAction(db, st, a); if (!n) throw new Error(`だめな操作: ${JSON.stringify(a)}`); return n; };

const scenes = () => {
  // 回避されても半分は切り上げ(ガッチャー 4 → 2。5 なら 3)
  {
    let st = scene({ mons: [['C-009', 'C-003', 'C-005'], ['C-008', 'C-003', 'C-005']], hands: [['102'], ['096']], guts: [4, 0] });
    const o = find(E.cardAttackOptions(db, st), (x) => x.target && x.target.m === 0);
    ok(o, 'ガッチャーで相手の1体目を狙えない');
    st = act(st, o);
    ok(st.pending, 'ガッチャーで攻撃中にならない');
    const g = E.cardGuardOptions(db, st);
    ok(g.length === 1, `フットワークで回避できるはず(候補 ${g.length})`);
    st = act(st, g[0]);
    st = act(st, { type: 'pass' });
    ok(st.players[1].mons[0].life === st.players[1].mons[0].max - 2, `回避されたガッチャーは2ダメージのはず(残り ${st.players[1].mons[0].life})`);
  }
  // 1体は1ターンに攻撃1枚まで
  {
    let st = scene({ mons: [['C-009', 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['100', '100'], []], guts: [9, 0] });
    st = act(st, find(E.cardAttackOptions(db, st), (x) => x.mon === 0));
    st = act(st, { type: 'pass' });
    ok(!E.cardAttackOptions(db, st).some((x) => x.mon === 0), 'モッチーが同じターンに2回攻撃できてしまう');
  }
  // 右爪・左爪・ツノを同時に: 3種類で7
  {
    let st = scene({ mons: [['C-001', 'C-003', 'C-005'], ['C-003', 'C-005', 'C-009']], hands: [['001', '002', '003'], []], guts: [0, 0] });
    const o = find(E.cardAttackOptions(db, st), (x) => x.hand.length === 3 && x.target && x.target.m === 0);
    ok(o, '右爪・左爪・ツノの3枚同時が候補にない');
    if (o) { st = act(st, o); st = act(st, { type: 'pass' }); ok(st.players[1].mons[0].life === Math.max(0, st.players[1].mons[0].max - 7), `3種類同時は7ダメージのはず(残り ${st.players[1].mons[0].life})`); }
  }
  // 特殊技は守れない(守りの候補が出ない・攻撃中にならない)
  {
    const spe = Object.values(db.cards).find((c) => c.ready && c.kind === 'spe' && c.user === 'any' && c.effects.some((e) => e.t === 'draw'));
    if (spe) {
      let st = scene({ hands: [[spe.no], ['096']], guts: [9, 0] });
      const o = E.cardAttackOptions(db, st)[0];
      if (o) { st = act(st, o); ok(!st.pending, '特殊技で守りの番になってしまう'); }
    }
  }
  // 最後の1体どうしが同時に倒れたら攻撃した側の勝ち(もっちゃんの反動で自分も倒れる)
  {
    let st = scene({ mons: [['C-009', 'C-003', 'C-005'], ['C-003', 'C-005', 'C-009']], hands: [['101'], []], guts: [3, 0] });
    st.players[0].mons.forEach((m, i) => { if (i) { m.ko = true; m.life = 0; } else m.life = 1; });
    st.players[1].mons.forEach((m, i) => { if (i) { m.ko = true; m.life = 0; } else m.life = 5; });
    st = act(st, find(E.cardAttackOptions(db, st), (x) => x.target && x.target.m === 0));
    st = act(st, { type: 'pass' });
    ok(st.winner === 0, `同時KOは攻撃した側の勝ちのはず(winner=${st.winner})`);
  }
  // デュラハン: 最終奥義はライフ2以下のときだけ・静の構えで次のかしこさ技2倍・精神集中でガッツを減らされない
  {
    let st = scene({ mons: [['C-030', 'C-003', 'C-005'], ['C-003', 'C-005', 'C-009']], hands: [['241'], []], guts: [9, 0] });
    ok(!E.cardAttackOptions(db, st).some((o) => o.mon === 0), '最終奥義がライフ2より多いのに出せてしまう');
    st.players[0].mons[0].life = 2;
    ok(E.cardAttackOptions(db, st).some((o) => o.mon === 0), '最終奥義がライフ2で出せない');
  }
  {
    let st = scene({ mons: [['C-030', 'C-003', 'C-005'], ['C-003', 'C-005', 'C-009']], hands: [['246', '244'], []], guts: [9, 0] });
    st = act(st, E.cardAttackOptions(db, st).find((o) => o.mon === 0 && st.players[0].hand[o.hand[0]] === '246'));
    ok(st.players[0].mons[0].charge && st.players[0].mons[0].charge.n === 2, '静の構えが付かない');
    st.players[0].mons[0].attacks = 0; // 同じターンに続けて試すため
    const o = E.cardAttackOptions(db, st).find((x) => x.mon === 0 && x.target && x.target.m === 0);
    st = act(st, o); st = act(st, { type: 'pass' });
    ok(st.players[1].mons[0].life === Math.max(0, 9 - 14), `静の構えのあとの雷神剣(7)は14ダメージのはず(残り ${st.players[1].mons[0].life})`);
  }
  {
    let st = scene({ mons: [['C-009', 'C-003', 'C-005'], ['C-030', 'C-003', 'C-005']], hands: [['103'], []], guts: [2, 3] });
    st.players[1].gutsGuardUntil = st.turn + 1;
    st = act(st, E.cardAttackOptions(db, st).find((o) => o.target && o.target.m === 0)); st = act(st, { type: 'pass' });
    ok(st.players[1].guts.length === 3, `精神集中のあいだはガッツが減らないはず(${st.players[1].guts.length})`);
  }
  // 山札が引けなければ負け
  {
    let st = scene({ hands: [[], []] });
    st.players[1].deck = [];
    st = act(st, { type: 'endAttacks' });
    st = act(st, { type: 'guts', hand: [] });
    ok(st.winner === 0, `山札が引けない側の負けのはず(winner=${st.winner})`);
  }
  // 手札5枚なら山札の上をガッツへ
  {
    let st = scene({ hands: [[], ['100', '100', '100', '100', '100']] });
    const g0 = st.players[1].guts.length;
    st = act(st, { type: 'endAttacks' });
    st = act(st, { type: 'guts', hand: [] });
    ok(st.players[1].guts.length === g0 + 1 && st.players[1].hand.length === 5, '手札5枚のときは山札の上がガッツになるはず');
  }
};

const sims = () => {
  const ids = Object.keys(db.starters);
  const habits = Object.keys(E.CARD_AI_HABITS);
  const wins = {};
  let steps = 0, stuck = 0, turns = 0;
  for (let g = 0; g < GAMES; g++) {
    const a = ids[g % ids.length], b = ids[Math.floor(g / ids.length) % ids.length];
    const st = E.cardSimulate(db, {
      decks: [E.cardAiBuildDeck(db, a), E.cardAiBuildDeck(db, b)],
      policies: [E.cardAiPolicy(habits[g % habits.length], 'normal'), E.cardAiPolicy(habits[(g + 2) % habits.length], 'normal')],
      seed: 1000 + g, first: g % 2,
    });
    if (st.winner === null) { stuck += 1; if (VERBOSE) console.log('終わらない', a, b, st.turn, st.log.slice(-5).map((l) => l.text)); continue; }
    turns += st.turn;
    const key = st.winner === 0 ? a : b;
    wins[key] = (wins[key] || 0) + 1;
    // 状態のおかしさ: 枚数が減ったり増えたりしていない(手札・山札・ガッツ・捨て札・使った札の合計=50)
    st.players.forEach((pl, i) => {
      const n = pl.hand.length + pl.deck.length + pl.guts.length + pl.discard.length;
      ok(n === 50, `対戦${g} P${i}: カードの合計が ${n} 枚(50枚のはず)`);
      pl.mons.forEach((m) => ok(m.life >= 0 && m.life <= m.max, `対戦${g}: ${m.name}のライフが ${m.life}`));
    });
    steps += st.log.length;
  }
  ok(stuck === 0, `終わらない対戦が ${stuck} 戦`);
  // 難易度の差: 同じスターターどうしで MASTER は EASY に勝ち越すはず
  let hi = 0;
  const N = Math.max(60, Math.floor(GAMES / 3));
  for (let g = 0; g < N; g++) {
    const k = ids[g % ids.length];
    const st = E.cardSimulate(db, { decks: [E.cardAiBuildDeck(db, k), E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy('kyuko', 'master'), E.cardAiPolicy('kyuko', 'easy')], seed: 5000 + g, first: g % 2 });
    if (st.winner === 0) hi += 1;
  }
  const masterRate = hi / N;
  ok(masterRate >= 0.8, `MASTER が EASY に勝ち越さない(勝率 ${(masterRate * 100).toFixed(0)}%)`);
  const total = Object.values(wins).reduce((s, v) => s + v, 0);
  console.log(`対戦 ${GAMES} 戦・平均 ${(turns / Math.max(1, total)).toFixed(1)} ターン・スターターの勝ち数 ${JSON.stringify(wins)}・MASTER 対 EASY の勝率 ${(masterRate * 100).toFixed(0)}%`);
};

const decksAndSaves = () => {
  // スターターと助手のデッキ(全部の難易度)が決まりどおり
  Object.keys(db.starters).forEach((k) => { const p = E.cardDeckProblems(db, E.cardAiBuildDeck(db, k)); ok(!p.length, `スターター ${k}: ${p.join('・')}`); });
  Object.keys(E.CARD_AI_DECKS).forEach((w) => Object.keys(E.CARD_AI_LEVELS).forEach((lv) => {
    const d = E.cardAiBuildDeck(db, w, lv);
    const p = E.cardDeckProblems(db, d);
    ok(!p.length, `助手 ${w}(${lv})のデッキ: ${p.join('・')}`);
    ok(d.cards.every((no) => db.cards[no].ready), `助手 ${w}(${lv})のデッキに準備中のカード`);
  }));
  // 保存の読み込み: 無い・壊れた値でも既定値になる
  [undefined, null, 'x', 5, [], { a: 'b' }].forEach((bad) => {
    ok(JSON.stringify(E.cardNormalizeCollection(bad)) === '{}' || cardIsObj(E.cardNormalizeCollection(bad)), 'コレクションの正規化');
    ok(bad === 5 ? E.cardNormalizePoint(bad) === 5 : E.cardNormalizePoint(bad) === 0, `カードポイントの正規化(${JSON.stringify(bad)})`);
    ok(Array.isArray(E.cardNormalizeDecks(bad).decks), 'デッキの正規化');
    ok(E.cardNormalizeDaily(bad, '2026-10-24').cpuPoint === 0, '1日の記録の正規化');
    ok(E.cardNormalizeRecord(bad).cpu.win === 0, '戦績の正規化');
    ok(E.cardNormalizeCpuUnlocked(bad).hard === false, '難易度の印の正規化');
  });
  ok(E.cardNormalizeCollection({ '001': 3, '999': 2, x: -1, y: 'a' })['999'] === 2, '知らないカード番号を消してしまう');
  ok(E.cardNormalizeDaily({ day: '2026-10-23', cpuPoint: 500 }, '2026-10-24').cpuPoint === 0, '日が変わっても1日の記録が戻らない');
  // スターターは一度きり・300ポイント
  const empty = { collection: {}, decks: E.cardNormalizeDecks(null), point: 0, starter: null };
  const g1 = E.cardGrantStarter(db, empty, 'speed', 1);
  ok(g1 && g1.point === 300 && g1.starter.kit === 'speed' && g1.decks.decks.length === 1, 'スターターを配れない');
  ok(g1 && Object.values(g1.collection).reduce((s, v) => s + v, 0) === 53, 'スターターの枚数が 3体＋50枚 にならない');
  ok(E.cardGrantStarter(db, g1, 'powerful', 2) === null, 'スターターを2回配れてしまう');
  // カードポイント: 1日600まで・はじめての勝ちは+50
  let daily = E.cardNormalizeDaily(null, '2026-10-24');
  const r1 = E.cardCpuReward(daily, 'master', 'win');
  ok(r1.total === 140 && r1.daily.firstWin, `はじめての MASTER の勝ちは 90+50 のはず(${r1.total})`);
  daily = { ...r1.daily, cpuPoint: 580 };
  const r2 = E.cardCpuReward(daily, 'master', 'win');
  ok(r2.got === 20 && r2.capped && r2.bonus === 0, '1日の上限で止まらない');
  ok(E.cardCpuReward(daily, 'easy', 'surrender').total === 0, '降参でカードポイントが出てしまう');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'easy', 'lose').total === 10, '負けは10のはず');
  const u = E.cardUnlockAfterWin(E.cardNormalizeCpuUnlocked(null), 'normal');
  ok(u.hard && !u.expert, 'NORMAL で勝っても HARD が開かない');
  ok(!E.cardUnlockAfterWin(E.cardNormalizeCpuUnlocked(null), 'easy').hard, 'EASY の勝ちで HARD が開いてしまう');
};
const cardIsObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// カードの表が cards.json から作り直した形と同じか・絵(小・大)が1枚ずつそろっているか
const dataAndImages = () => {
  const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'card-data-build.js'), '--check'], { encoding: 'utf8' });
  ok(r.status === 0, `card-battle-cards.js が古い(node tools/card/card-data-build.js で作り直す): ${(r.stdout + r.stderr).trim().slice(0, 200)}`);
  const missing = [];
  [...Object.values(db.cards), ...Object.values(db.monsters)].forEach((c) => ['s', 'l'].forEach((size) => {
    if (!fs.existsSync(path.join(GAME, 'images', 'card-battle', size, `${c.img}.jpg`))) missing.push(`${size}/${c.img}`);
  }));
  ok(!missing.length, `カードの絵が無い ${missing.length} 枚(node tools/card/card-image-build.js --build): ${missing.slice(0, 8).join(', ')}`);
};

// 技の動きの見本(85): 決まった順の手が全部出せて、よける・防ぐ・受ける・倒れるが1回ずつ起きる
const motionDemo = () => {
  let { st, steps } = E.cardMotionDemo(db);
  const seen = new Set();
  for (const s of steps) {
    const a = E.cardMotionDemoAction(db, st, s);
    ok(a, `動きの見本の手が出せない: ${JSON.stringify(s)}`);
    if (!a) return;
    st = E.cardApplyAction(db, st, a);
    ok(st, `動きの見本の手がだめ: ${JSON.stringify(a)}`);
    if (!st) return;
    st.events.forEach((e) => { if (e.t === 'hit') seen.add(e.evaded ? 'よける' : e.guarded ? '防ぐ' : '受ける'); if (e.t === 'ko') seen.add('倒れる'); });
  }
  ok(['よける', '防ぐ', '受ける', '倒れる'].every((k) => seen.has(k)), `動きの見本で出ない動きがある(${[...seen].join('・')})`);
};
scenes();
motionDemo();
decksAndSaves();
dataAndImages();
sims();
if (fails.length) { console.error(`✗ MFバトルカードのルール: ${fails.length} 件\n  ${[...new Set(fails)].slice(0, 30).join('\n  ')}`); process.exit(1); }
console.log('✓ MFバトルカードのルール: 決まりごとの場面とコンピューターどうしの対戦がそろった');

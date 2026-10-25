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
    + `${fs.readFileSync(path.join(GAME, 'src', 'parts', '86-card-tutorial.jsx'), 'utf8')}\n;\n`
    + `${fs.readFileSync(path.join(GAME, 'src', 'parts', '89-card-pack.jsx'), 'utf8')}\n;\n`
    // 85 は画面の部品(SkillFxMotion)を使うので、ルールだけで動く「動きの見本」の所だけ読む
    + `${fs.readFileSync(path.join(GAME, 'src', 'parts', '85-card-battle-motion.jsx'), 'utf8').split('// ---- 動きの見本')[1].replace(/^[^\n]*\n/, '')}\n;\n`
    // よけ方・盾の数字・ブリーダーのカードの見分け(ルールだけで決まる所)も読む
    + `${(() => { const m = fs.readFileSync(path.join(GAME, 'src', 'parts', '85-card-battle-motion.jsx'), 'utf8'); return m.slice(m.indexOf('// ブリーダーのカードか'), m.indexOf('// 動きの長さ')); })()}\n;\n`
    + 'this.E = { CARD_BATTLE_DATA, cardMonType, CARD_THINK_PACE, CARD_RESULT_WAIT_MS, CARD_PRESS_MS, CARD_BUBBLE_PER_TURN, CARD_SETTING_GROUPS, cardOf, cardIsBreederCard, cardDodgeIsJump, cardGuardLabel, cardCreateGame, cardApplyAction, cardLegalActions, cardAttackOptions, cardGuardOptions, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardSimulate, CARD_AI_LEVELS, CARD_AI_HABITS, CARD_AI_DECKS, cardDeckProblems, cardNormalizeCollection, cardNormalizeDecks, cardNormalizePoint, cardNormalizeDaily, cardNormalizeRecord, cardNormalizeCpuUnlocked, cardGrantStarter, cardCpuReward, cardUnlockAfterWin, cardMotionDemo, cardMotionDemoAction, cardTutorialGame, cardTutorialMutate, cardTutorialAllow, cardTutorialDone, cardTutorialCpu, CARD_TUTORIAL_STAGES, cardTutorialCopyProblems, cardTutorialFinish, CARD_TUTORIAL_LINES, cardCpuLoops, cardOwnTurns, cardDeckAddReason, cardDeckReady, cardDecksPut, cardDecksRemove, CARD_PACKS, cardOpenPack, cardBuyPacks, cardPackRates, cardPackCardRates, cardPackIdOf, cardPackAllCards, cardSplitPity, cardBuyStarter, cardMonRarity, cardNormalizePity, cardNormalizeShop, CARD_SAVE_KEYS, cardRecordAfter, cardRankRow, cardWeekKeyJst, normalizeCardBgm, normalizeCardSettings };';
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
  // 公開の条件: EXPERT・MASTER で、どの助手もプレイヤー役(スターター3つ・同じ難易度の考え方)に同じくらい勝つ。
  //   直す前は、みゅあ 33%・ももすけ(MASTER)38% と弱く、弱い子がカードポイントの稼ぎ場になっていた。細かい数は tools/card/card-ai-balance.js
  ['expert', 'master'].forEach((lv) => {
    const rates = Object.keys(E.CARD_AI_HABITS).map((w) => {
      const d = E.cardAiBuildDeck(db, w, lv); let win = 0, n = 0, sd = 1;
      Object.keys(db.starters).forEach((k) => { for (let g = 0; g < 30; g++) { const st = E.cardSimulate(db, { decks: [d, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv), E.cardAiPolicy('kyuko', lv)], seed: 7000 + sd++, first: g % 2 }); if (st.winner === 0) win += 1; n += 1; } });
      return [w, win / n];
    });
    const bad = rates.filter(([, r]) => r < 0.38 || r > 0.65);
    ok(!bad.length, `${lv.toUpperCase()} の助手の強さがそろっていない(プレイヤー役への勝率 38〜65% の外): ${bad.map(([w, r]) => `${w} ${Math.round(r * 100)}%`).join('・')}`);
  });
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
  // 記録とランキング(台帳 #3513): 難易度ごとの勝ち負け・週の勝ち・連勝。ランキングに数えるのは rankable の対戦だけ
  {
    // 2026-10-26(月)5:00 JST = 2026-10-25T20:00Z。その直前(月曜 4:59)は前の週(10-19)。モンヒロビートの週間ランキングと同じ区切り
    ok(E.cardWeekKeyJst(Date.UTC(2026, 9, 25, 19, 59)) === '2026-10-19' && E.cardWeekKeyJst(Date.UTC(2026, 9, 25, 20, 0)) === '2026-10-26', '週の区切りが日本時間の月曜 5:00 になっていない');
    const old = E.cardNormalizeRecord({ cpu: { win: 3, lose: 1, surrender: 0 } });
    ok(old.byLevel.win.master === 0 && old.rank.streak.best === 0 && old.rank.week.key === '' && old.cpu.win === 3, '前からの記録に新しい項目が既定値で補われない');
    const t0 = Date.UTC(2026, 9, 20, 3, 0);
    let rec = E.cardRecordAfter(null, { who: 'mua', level: 'hard', outcome: 'win', at: t0, rankable: false });
    ok(rec.cpu.win === 1 && rec.byLevel.win.hard === 1 && rec.rank.total.hard === 0 && rec.rank.streak.now === 0, 'デバッグ・公開前の勝ちがランキングの数に入ってしまう');
    rec = E.cardRecordAfter(rec, { who: 'mua', level: 'hard', outcome: 'win', at: t0, rankable: true });
    rec = E.cardRecordAfter(rec, { who: 'kiki', level: 'master', outcome: 'win', at: t0 + 1000, rankable: true });
    rec = E.cardRecordAfter(rec, { who: 'kiki', level: 'master', outcome: 'surrender', at: t0 + 2000, rankable: true });
    ok(rec.rank.total.hard === 1 && rec.rank.total.master === 1 && rec.rank.streak.now === 0 && rec.rank.streak.best === 2 && rec.byLevel.lose.master === 1 && rec.cpu.surrender === 1, `連勝・難易度ごとの数が合わない ${JSON.stringify(rec.rank)}`);
    const next = E.cardRecordAfter(rec, { who: 'mua', level: 'hard', outcome: 'win', at: Date.UTC(2026, 9, 27, 3, 0), rankable: true });
    ok(next.rank.week.key === '2026-10-26' && next.rank.week.wins.hard === 1 && next.rank.week.wins.master === 0 && next.rank.total.hard === 2, '週が変わったら週の勝ち数が 0 から数え直されない');
    const row = E.cardRankRow(rec, { dexCount: 30, dexTotal: 405, userName: 'テスト', icon: '🐣', profileFrame: null, breederId: 'b1', now: Date.UTC(2026, 9, 27, 3, 0) });
    ok(row.week_key === '2026-10-26' && row.week_wins_hard === 0 && row.wins_hard === 1 && row.best_streak === 2 && row.current_streak === 0 && row.dex_count === 30 && row.breeder_id === 'b1' && !('profile_frame' in row), `送る行が合わない ${JSON.stringify(row)}`);
    ok(Object.values(E.CARD_SAVE_KEYS).every((k) => /^mh_card_/.test(k)), '保存キーが mh_card_ で始まらない');
    // 対戦の BGM と演出の設定(無い・壊れた・知らない曲は既定へ)
    const tracks = new Set(['melo_toriko', 'ichika_battle']);
    const isT = (id) => tracks.has(id);
    ok(JSON.stringify(E.normalizeCardBgm(null, isT)) === '{"cpu":"auto","pvp":"ichika_battle"}' && E.normalizeCardBgm({ cpu: 'nope', pvp: 'nope' }, isT).cpu === 'auto' && E.normalizeCardBgm({ cpu: 'melo_toriko' }, isT).cpu === 'melo_toriko', '対戦のBGMの読み込みで、既定・知らない曲の戻しが合わない');
    ok(JSON.stringify(E.normalizeCardSettings(null)) === '{"speed":"normal","autoPass":true,"quickAutoStart":false,"think":"NORMAL","resultWait":"NORMAL","motion":"FULL","shake":"ON","damageNum":"ON","bubble":"NORMAL","confirmUse":"OFF","confirmEnd":"OFF","press":"NORMAL","drag":"ON","gutsPick":"OFF","handText":"NORMAL","handSort":"DRAW"}'
      && E.normalizeCardSettings({ quickAutoStart: true }).quickAutoStart === true && E.normalizeCardSettings({ quickAutoStart: 'yes' }).quickAutoStart === false
      // 前の「はやい」(speed:'fast')だけを持つ人は、相手が考える時間「はやい」・結果までの間「短め」で始まる(足す前と同じ速さ)
      && E.normalizeCardSettings({ speed: 'fast', autoPass: false }).think === 'FAST' && E.normalizeCardSettings({ speed: 'fast' }).resultWait === 'SHORT' && E.normalizeCardSettings({ speed: 'fast' }).speed === 'fast'
      && E.normalizeCardSettings({ think: 'SLOW2', motion: 'nope', bubble: 'OFF' }).think === 'SLOW2' && E.normalizeCardSettings({ motion: 'nope' }).motion === 'FULL'
      // 既定は足す前の動きと同じ(考える時間 ×1・結果まで 2.2秒・長押し 0.45秒・ひとこと 1ターン2回)
      && E.CARD_THINK_PACE.NORMAL === 1 && E.CARD_THINK_PACE.FAST === 0.5 && E.CARD_RESULT_WAIT_MS.NORMAL === 2200 && E.CARD_RESULT_WAIT_MS.SHORT === 1200 && E.CARD_PRESS_MS.NORMAL === 450 && E.CARD_BUBBLE_PER_TURN.NORMAL === 2
      // オプションに並べる項目は、どれも normalizeCardSettings が持つ名前・選択肢
      && E.CARD_SETTING_GROUPS.every((g) => g.items.every((it) => it.bool ? typeof E.normalizeCardSettings(null)[it.key] === 'boolean' : it.options.some((o) => o.id === E.normalizeCardSettings(null)[it.key]) && it.options.every((o) => E.normalizeCardSettings({ [it.key]: o.id })[it.key] === o.id))) && E.normalizeCardSettings({ speed: 'fast', autoPass: false }).autoPass === false && E.normalizeCardSettings({ speed: 'x' }).speed === 'normal', '演出の設定の読み込みが合わない');
  }
  // カードポイントとクイック周回(案A・台帳 #3484): 1日の上限なし(台帳 #3531)・はじめての勝ちは+50
  const full = { ownTurns: 10, kos: 0 };
  let daily = E.cardNormalizeDaily(null, '2026-10-24');
  const r1 = E.cardCpuReward(daily, 'master', 'win', full);
  ok(r1.total === 250 && r1.daily.firstWin, `はじめての MASTER の勝ちは 200+50 のはず(${r1.total})`);
  daily = { ...r1.daily, cpuPoint: 1480 };
  const r2 = E.cardCpuReward(daily, 'master', 'win', full);
  ok(r2.got === 200 && !r2.capped && r2.bonus === 0 && r2.total === 200, '1日の上限が残っている(1,480 もらったあとでも満額のはず)');
  ok(E.cardCpuReward(daily, 'easy', 'surrender', { ownTurns: 5, kos: 0 }).total === 0, '倒さずに降参でカードポイントが出てしまう');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'easy', 'surrender', { ownTurns: 5, kos: 2 }).total === 20, '2体倒して降参は20のはず');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'easy', 'surrender', { ownTurns: 5, kos: 5 }).total === 25, '降参は負けの25を超えない');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'master', 'lose', full).total === 25, '負けはどの難易度も25のはず');
  const sh = E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'master', 'win', { ownTurns: 2, kos: 3 });
  ok(sh.total === 0 && sh.short && !sh.daily.firstWin, '自分の番を3回やる前に終わった試合でカードポイントが出る');
  const L = (lv, o, f) => E.cardCpuLoops(lv, o, f);
  ok([['easy', 14], ['normal', 16], ['hard', 18], ['expert', 20], ['master', 22]].every(([lv, n]) => L(lv, 'win', full) === n), '勝ちの周回が案Aと違う');
  ok(L('normal', 'lose', full) === 8 && L('normal', 'lose', { ownTurns: 5, kos: 0 }) === 4, '負けの周回は勝ちの半分×(自分の番÷10)のはず');
  ok(L('normal', 'surrender', { ownTurns: 5, kos: 0 }) === 0 && L('normal', 'surrender', { ownTurns: 5, kos: 1 }) === 3 && L('normal', 'surrender', { ownTurns: 5, kos: 2 }) === 5, '降参の周回は倒した数×負けの3分の1のはず');
  ok(L('master', 'win', { ownTurns: 2, kos: 3 }) === 0, '自分の番を3回やる前に終わった試合で周回が出る');
  const g = E.cardCreateGame(db, { decks: [E.cardAiBuildDeck(db, 'speed'), E.cardAiBuildDeck(db, 'speed')], first: 1 });
  g.turn = 7;
  ok(E.cardOwnTurns(g, 0) === 3 && E.cardOwnTurns(g, 1) === 4, '自分の番の数え方が違う');
  // デッキ編成(区切り2): 同じ名前3枚まで・持っている枚数まで・同じモンスター1体まで・準備中は入らない
  {
    const kit = db.starters.speed;
    const col = {}; [...kit.monsters, ...kit.cards].forEach((no) => { col[no] = (col[no] || 0) + 1; });
    const d = { id: 'x', name: 'x', monsters: [], cards: [] };
    ok(E.cardDeckAddReason(db, d, kit.monsters[0], col) === '', 'デッキにモンスターを入れられない');
    const kira = Object.values(db.monsters).find((m) => m.species === db.monsters[kit.monsters[0]].species && m.no !== kit.monsters[0]);
    if (kira) ok(/同じモンスター/.test(E.cardDeckAddReason(db, { ...d, monsters: [kit.monsters[0]] }, kira.no, { ...col, [kira.no]: 1 })), 'キラも同じモンスターとして止まらない');
    const no = kit.cards[0];
    const three = { ...d, cards: [no, no, no] };
    ok(/3枚まで/.test(E.cardDeckAddReason(db, three, no, { [no]: 9 })), '同じ名前の4枚目が入ってしまう');
    ok(/持っているのは/.test(E.cardDeckAddReason(db, { ...d, cards: [no] }, no, { [no]: 1 })), '持っている枚数を超えて入ってしまう');
    const notReady = Object.values(db.cards).find((c) => !c.ready);
    ok(/準備中/.test(E.cardDeckAddReason(db, d, notReady.no, { [notReady.no]: 3 })), '準備中のカードが入ってしまう');
    const full = { id: 's', name: 's', monsters: kit.monsters.slice(), cards: kit.cards.slice() };
    ok(E.cardDeckReady(db, full, col) && !E.cardDeckReady(db, full, {}), '持っていないカードのデッキが対戦に使えてしまう');
    const ds = E.cardDecksPut({ active: 'a', decks: [{ ...full, id: 'a' }] }, { ...full, id: 'b' });
    ok(ds.decks.length === 2 && ds.active === 'a' && E.cardDecksRemove(ds, 'a').active === 'b', 'デッキの足し方・消し方が違う');
  }
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
    st.events.forEach((e) => {
      if (e.t === 'hit') seen.add(e.reflect ? 'はね返す' : e.evaded ? 'よける' : e.guarded ? '防ぐ' : '受ける');
      if (e.t === 'ko') seen.add('倒れる');
      if (e.t === 'guard' && E.cardDodgeIsJump(E.cardOf(db, e.card))) seen.add('跳んでよける');
      if (e.t === 'guard' && E.cardGuardLabel(E.cardOf(db, e.card)) === '−3') seen.add('盾の数字');
      if (e.t === 'use' && E.cardIsBreederCard(db, e.cards[0])) seen.add('ブリーダー');
      if (e.t === 'use' && (E.cardOf(db, e.cards[0]) || {}).kind === 'spe') seen.add('特殊');
    });
    // ライフが0の子は、どの手のあとでも必ず倒れている(はね返されて0になった子が残っていた・2026-10-24)
    st.players.forEach((pl, p) => pl.mons.forEach((m, i) => ok(m.life > 0 || m.ko, `ライフ0なのに倒れていない(${p}-${i} ${m.name}・${JSON.stringify(s)} のあと)`)));
  }
  ok(['よける', '防ぐ', '受ける', '倒れる', 'はね返す', '跳んでよける', '盾の数字', 'ブリーダー', '特殊'].every((k) => seen.has(k)), `動きの見本で出ない動きがある(${[...seen].join('・')})`);
};
// 練習試合(86): 同じ名前3枚まで・人の手と みゅあの決まった手で最後まで通せる・100 は1回だけ
// パック(区切り2): 中身・確率・天井・だぶり・C-060C と準備中が出ない・スターターを買う
const packs = () => {
  let seed = 12345;
  const rand = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  ok(E.CARD_SAVE_KEYS.pity === 'mh_card_pack_pity_v1' && E.CARD_SAVE_KEYS.shop === 'mh_card_shop_v1' && E.CARD_SAVE_KEYS.pitySplit === 'mh_card_pack_pity_split_v1', 'パックの保存キーの名前が違う');
  // 8弾の分け方(2026-10-25 社長が決めた案。種族3つずつ・第1〜3弾はスターターキットの顔ぶれ・混血はメインの種族の弾)
  const PLAN = { p1: ['dino', 'hare', 'mocchi'], p2: ['golem', 'pixie', 'naga'], p3: ['suezo', 'gali', 'tiger'], p4: ['phoenix', 'monol', 'henger'], p5: ['plant', 'dragon', 'jell'], p6: ['mew', 'worm', 'durahan'], p7: ['zilla', 'metalner', 'joker'], p8: ['arrowhead', 'centaur', 'colorpandora'] };
  const HYBRID = { p1: ['ダークハム', 'ヘルファット'], p2: ['ストライクリパー'], p3: ['バロン', 'アクアリウス', 'プラムラー'], p4: ['ワカクサケンザイ', 'ガーラント'], p5: ['ベニヒメソウ', 'アーマードラゴン', 'ウロコゲル'], p6: ['ミミニャー', 'ムラサキチュウ', 'ケルマディクス'], p7: ['ギガロン'], p8: [] };
  ok(E.CARD_PACKS.length === 8 && E.CARD_PACKS.every((p, i) => p.id === `p${i + 1}` && p.name === `第${i + 1}弾パック` && JSON.stringify(p.species) === JSON.stringify(PLAN[p.id])), '8弾の顔ぶれが決めた案と違う');
  const lost = [...Object.keys(db.cards), ...Object.keys(db.monsters)].filter((no) => !E.cardPackIdOf(db, no));
  ok(!lost.length, `どの弾にも入っていないカードがある: ${lost.slice(0, 8).join('・')}`);
  E.CARD_PACKS.forEach((p) => {
    const all = E.cardPackAllCards(db, p);
    const n = all.monsters.length + all.cards.length;
    ok(n >= 48 && n <= 52, `${p.name}の種類が50前後でない(${n})`);
    const hy = all.monsters.filter((no) => String(db.monsters[no].wave) === 'hybrid').map((no) => db.monsters[no].name).sort();
    ok(JSON.stringify(hy) === JSON.stringify(HYBRID[p.id].slice().sort()), `${p.name}の混血が決めた案と違う(${hy.join('・')})`);
    const shared = all.cards.filter((no) => db.cards[no].user === 'any' || db.cards[no].user === 'breeder').length;
    ok(shared >= 1, `${p.name}に全モンスター・ブリーダーのカードが無い`);
    ok(all.cards.every((no) => ['any', 'breeder', ...PLAN[p.id]].includes(db.cards[no].user)), `${p.name}にほかの種族の技が入っている`);
  });
  // 天井の保存: 以前の w1〜w4 は消さずに残し、新しい弾へ1回だけ写す(新しい弾に数があれば上書きしない)
  const legacy = E.cardNormalizePity({ w1: 3, w2: 5, w4: 1, p9: 2, p1: 'x' });
  ok(JSON.stringify(legacy) === '{"w1":3,"w2":5,"w4":1}', `以前の天井の数を残していない(${JSON.stringify(legacy)})`);
  const sp = E.cardSplitPity({ ...legacy, p2: 6 });
  ok(sp.w1 === 3 && sp.w2 === 5 && sp.p1 === 3 && sp.p2 === 6 && sp.p3 === 3 && sp.p4 === 5 && sp.p5 === 5 && !sp.p6 && sp.p7 === 1 && sp.p8 === 1, `天井の数の写し方が違う(${JSON.stringify(sp)})`);
  E.CARD_PACKS.forEach((pack) => {
    let col = {}; let pity = {}; let maxDry = 0; let dry = 0;
    const rar = { normal: 0, kira: 0, alt: 0 };
    const seen = new Set();
    const N = 3000;
    for (let i = 0; i < N; i++) {
      // 天井を見るときは、持っているカードを毎回空にして「まだ持っていない」状態のまま回す
      const r = E.cardOpenPack(db, pack.id, { collection: col, pity }, rand);
      ok(r.cards.length === pack.tech + pack.mon, `${pack.name}の枚数が違う(${r.cards.length})`);
      r.cards.forEach((c) => {
        seen.add(c.no);
        const card = db.cards[c.no]; const m = db.monsters[c.no];
        ok(card ? card.ready && E.cardPackIdOf(db, c.no) === pack.id : m && m.ready !== false && E.cardPackIdOf(db, c.no) === pack.id, `${pack.name}に別の弾か準備中のカード ${c.no}`);
        ok(c.no !== 'C-060C', 'C-060C が出た');
        if (c.slot === 'mon') rar[c.rarity] += 1;
      });
      ok(r.cards.slice(pack.tech).every((c) => c.slot === 'mon'), 'モンスターの枠が最後になっていない');
      dry = r.hit ? 0 : dry + 1; maxDry = Math.max(maxDry, dry);
      col = r.collection; pity = r.pity;
    }
    ok(pack.pity && maxDry <= 7, `${pack.name}の天井が効いていない(キラなしが${maxDry}パック続いた)`);
    const kiraRate = (rar.kira + rar.alt) / N;
    ok(kiraRate > 0.13 && kiraRate < 0.24, `${pack.name}のキラの出る割合がおかしい(${kiraRate.toFixed(3)})`);
    ok((pack.no <= 3) === (rar.alt > 0), `${pack.name}の別絵キラの出かたが違う(第1〜3弾だけに出る)`);
    const pool = Object.values(db.cards).filter((c) => c.ready && E.cardPackIdOf(db, c.no) === pack.id).length + Object.values(db.monsters).filter((m) => m.ready !== false && E.cardPackIdOf(db, m.no) === pack.id).length;
    ok(seen.size === pool, `${pack.name}で出ないカードがある(${seen.size}/${pool})`);
    ok(Object.entries(col).every(([no, n]) => (db.cards[no] ? n <= 3 : n <= 1)), `${pack.name}で持てる枚数を超えた`);
  });
  // だぶり: 技は4枚目から5、モンスターは2枚目から50
  const one = E.cardOpenPack(db, 'p1', { collection: {}, pity: {} }, () => 0);
  const full = Object.fromEntries(one.cards.map((c) => [c.no, db.cards[c.no] ? 3 : 1]));
  const again = E.cardOpenPack(db, 'p1', { collection: full, pity: {} }, () => 0);
  ok(again.cards.every((c) => c.dup) && again.point === 7 * 5 + (again.cards[7].rarity === 'normal' ? 50 : again.cards[7].rarity === 'kira' ? 100 : 200), `だぶりのカードポイントが違う(${again.point})`);
  // 値段(2026-10-25 社長): どの弾も 1パック300・8枚(技など7・モンスター1)・5パックまとめて1,350 / スターターキット 1,500。混血パックは無い
  ok(E.CARD_PACKS.every((p) => p.price === 300 && p.bundle && p.bundle.n === 5 && p.bundle.price === 1350 && p.tech === 7 && p.mon === 1), 'どの弾も1パック300・8枚・5パック1,350になっていない');
  ok(E.CARD_PACKS.every((p) => JSON.stringify(p.rarity) === JSON.stringify(p.no <= 3 ? { normal: 85, kira: 12, alt: 3 } : { normal: 85, kira: 15, alt: 0 })), 'レア度の割合が違う(第1〜3弾 85/12/3・第4〜8弾 85/15)');
  const b5 = E.cardBuyPacks(db, 'p2', 5, { collection: {}, pity: {}, point: 1400 }, rand);
  ok(b5 && b5.cost === 1350 && b5.packs.length === 5 && b5.point === 50 + b5.dupPoint, '5パックまとめて1,350にならない');
  ok(E.cardBuyPacks(db, 'p2', 1, { collection: {}, pity: {}, point: 299 }, rand) === null, 'カードポイントが足りないのに買えた');
  ok(E.cardBuyPacks(db, 'hybrid', 1, { collection: {}, pity: {}, point: 9999 }, rand) === null, '混血パックが買えてしまう');
  // 混血のだぶりは50(ほかの通常のモンスターと同じ)
  const hyNo = Object.values(db.monsters).find((m) => String(m.wave) === 'hybrid' && E.cardPackIdOf(db, m.no) === 'p3').no;
  let hyDup = null;
  for (let i = 0; i < 400 && hyDup === null; i++) { const r = E.cardOpenPack(db, 'p3', { collection: { [hyNo]: 1 }, pity: {} }, rand); const c = r.cards.find((x) => x.no === hyNo); if (c) hyDup = c; }
  ok(hyDup && hyDup.dup && hyDup.point === 50, `混血のだぶりが50でない(${JSON.stringify(hyDup)})`);
  // 提供割合の表: 1枠ごとの割合を足すと100%・同じレア度のモンスターはどれも同じ割合(持っていない種族の優遇はなくした)
  E.CARD_PACKS.forEach((p) => {
    const r = E.cardPackCardRates(db, p.id);
    ['normal', 'kira', 'alt'].forEach((k) => { const ps = r.mon.filter((x) => x.rarity === k).map((x) => x.p); ok(ps.every((x) => Math.abs(x - ps[0]) < 1e-12), `${p.name}の${k}の割合がそろっていない`); });
    const sum = (xs) => xs.reduce((a, x) => a + x.p, 0);
    ok(Math.abs(sum(r.mon) - 1) < 1e-9 && (p.tech ? Math.abs(sum(r.tech) - 1) < 1e-9 : !r.tech.length), `${p.name}の提供割合を足しても100%にならない`);
    ok(Math.abs(Object.values(r.rarity).reduce((a, x) => a + x, 0) - 1) < 1e-9, `${p.name}のレア度の割合を足しても100%にならない`);
  });
  // 選ばなかったスターターキット: 1,500・1回だけ・選んだキットは買えない
  const base = { collection: {}, decks: { active: 'starter_speed', decks: [{ id: 'starter_speed', name: 's', monsters: [], cards: [] }] }, point: 1600, starter: { kit: 'speed' }, shop: E.cardNormalizeShop(null) };
  ok(E.cardBuyStarter(db, 'speed', base, 1) === null, '選んだスターターキットを買えてしまう');
  const bs = E.cardBuyStarter(db, 'miracle', base, 1);
  ok(bs && bs.point === 100 && bs.decks.decks.length === 2 && bs.shop.starters.miracle, 'スターターキットを1,500で買えない');
  ok(E.cardBuyStarter(db, 'miracle', { ...base, ...bs, starter: base.starter }, 2) === null, 'スターターキットを2回買えてしまう');
  ok(JSON.stringify(E.cardNormalizePity({ w1: 3, w9: 5, w2: 'x', p8: 2 })) === '{"p8":2,"w1":3}', '天井の保存の読み方が違う');
};
const tutorialRun = () => {
  let st = E.cardTutorialGame(db);
  const copy = E.cardTutorialCopyProblems(db, st);
  ok(!copy.length, `練習試合のカードが3枚を超える: ${copy.join('・')}`);
  const S = E.CARD_TUTORIAL_STAGES;
  const human = (id) => {
    if (id === 'guts') return st.phase === 'main' ? { type: 'endAttacks' } : { type: 'guts', hand: [0, 2] };
    if (id === 'guard') return st.pending && !st.pending.evaded ? E.cardGuardOptions(db, st).find((o) => st.players[0].hand[o.hand] === '059') : { type: 'pass' };
    if (id === 'attack') return E.cardAttackOptions(db, st).find((o) => st.players[0].hand[o.hand[0]] === '061');
    if (id === 'deckEnd') return { type: 'endAttacks' };
    if (id === 'deckTurn') return { type: 'guts', hand: [] };
    return null;
  };
  let si = 0;
  for (let n = 0; n < 80 && si < S.length; n++) {
    const stg = S[si];
    // 練習の全部の段で、手札・山札・捨て札・ガッツを合わせて同じ名前が4枚以上にならない(#3478)
    const cp = E.cardTutorialCopyProblems(db, st);
    ok(!cp.length, `練習試合の「${stg.id}」で同じカードが4枚以上: ${cp.join('・')}`);
    if (stg.next) { if (stg.onNext && stg.onNext !== 'finish') st = E.cardTutorialMutate(db, st, stg.onNext); si += 1; continue; }
    const cpuTurn = st.pending ? st.pending.defender === 1 : st.active === 1;
    const act = cpuTurn ? E.cardTutorialCpu(db, stg.id, st) : human(stg.id);
    ok(act, `練習試合が「${stg.id}」で止まる`);
    if (!act) return;
    if (!cpuTurn) ok(E.cardTutorialAllow(db, stg.id, st, act), `練習試合の「${stg.id}」で教えている手が出せない: ${JSON.stringify(act)}`);
    const before = st;
    st = E.cardApplyAction(db, st, act);
    ok(st, `練習試合の手がだめ: ${JSON.stringify(act)}`);
    if (!st) return;
    if (E.cardTutorialDone(stg.id, before, st)) si += 1;
  }
  ok(si === S.length && st.winner === 0, `練習試合を最後まで通せない(段 ${si}/${S.length}・勝ち ${st.winner})`);
  const f1 = E.cardTutorialFinish(null, 'done', 1);
  const f2 = E.cardTutorialFinish(f1.tutorial, 'done', 2);
  const f3 = E.cardTutorialFinish(null, 'skip', 3);
  ok(f1.reward === 100 && f2.reward === 0 && f3.reward === 0 && f3.tutorial.skipped, '練習試合の 100 が1回だけになっていない');
  Object.entries(E.CARD_TUTORIAL_LINES).forEach(([id, t]) => ok(t.length <= 70, `練習試合の台詞 ${id} が長すぎる(${t.length}字)`));
};
// 準備中だった83枚(台帳 #141。一覧: docs/progress/card-battle/pending-83/README.md)を、1枚ずつカードの文どおりに動かす
const pendingCards = () => {
  const ready = (no) => ok(db.cards[no] && db.cards[no].ready, `${no} が使えるになっていない`);
  // 区切り1: 力をためる(034・ゴーレム)・根を張る(210・プラント) … 次の自分のちから技1回が2倍。ダメージを受けたら消える
  [['034', ['C-003', 'C-005', 'C-001'], '026', 5], ['210', ['C-027', 'C-005', 'C-001'], '202', 2]].forEach(([no, mons, atk, base]) => {
    ready(no);
    let st = scene({ mons: [mons, ['C-003', 'C-005', 'C-001']], hands: [[no, atk], []], guts: [9, 0] });
    const o = find(E.cardAttackOptions(db, st), (x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === no);
    ok(o, `${no}: 使えない`); if (!o) return;
    st = act(st, o);
    ok(JSON.stringify(st.players[0].mons[0].charge) === JSON.stringify({ kinds: ['pow'], n: 2 }), `${no}: 次のちから技2倍の印が付かない`);
    ok(!find(E.cardAttackOptions(db, st), (x) => x.mon === 0), `${no}: 同じターンにもう1枚使えてしまう(1ターン1枚)`);
    // 次の自分の番に、ちから技を当てると2倍
    const nx = (s0) => { const s1 = JSON.parse(JSON.stringify(s0)); s1.turn += 2; s1.players[0].mons.forEach((m) => { m.attacks = 0; }); return s1; };
    let s2 = nx(st);
    const a = find(E.cardAttackOptions(db, s2), (x) => x.mon === 0 && x.target && x.target.m === 0);
    ok(a, `${no}: 次の番にちから技を出せない`);
    if (a) {
      const life0 = s2.players[1].mons[0].life;
      s2 = act(act(s2, a), { type: 'pass' });
      ok(life0 - s2.players[1].mons[0].life === Math.min(life0, base * 2), `${no}: 次のちから技が2倍にならない(${life0 - s2.players[1].mons[0].life})`);
      ok(s2.players[0].mons[0].charge === null, `${no}: 1回使ったら印が消えるはず`);
    }
    // ダメージを受けたら消える
    let s3 = JSON.parse(JSON.stringify(st)); s3.active = 1; s3.turn += 1; s3.players[1].hand = ['026']; s3.players[1].guts = Array(3).fill('100'); s3.players[1].mons.forEach((m) => { m.attacks = 0; });
    const h = find(E.cardAttackOptions(db, s3), (x) => x.mon === 0 && x.target && x.target.m === 0);
    ok(h, `${no}: 相手が攻撃できない場面になった`);
    if (h) { s3 = act(act(s3, h), { type: 'pass' }); ok(s3.players[0].mons[0].charge === null, `${no}: ダメージを受けても印が残る`); }
  });
  // 区切り1: 舞い上がる(060・ピクシー)・飛び上がる(236・ドラゴン) … ちから技を回避。次の自分の番の技2倍・それまで空中
  [['060', 'C-005', ['pow']], ['236', 'C-029', ['pow', 'int']]].forEach(([no, mon, kinds]) => {
    ready(no);
    let st = scene({ mons: [['C-003', 'C-005', 'C-001'], [mon, 'C-003', 'C-001']], hands: [['026'], [no]], guts: [3, 2] });
    st = act(st, find(E.cardAttackOptions(db, st), (x) => x.target && x.target.m === 0));
    const g = find(E.cardGuardOptions(db, st), (x) => st.players[1].hand[x.hand] === no);
    ok(g, `${no}: ちから技を回避できない`); if (!g) return;
    const life0 = st.players[1].mons[0].life;
    st = act(act(st, g), { type: 'pass' });
    const m = st.players[1].mons[0];
    ok(m.life === life0, `${no}: 回避したのにダメージを受けた`);
    ok(m.mult && m.mult.turn === st.turn + 1 && JSON.stringify(m.mult.kinds) === JSON.stringify(kinds) && m.mult.n === 2, `${no}: 次の自分の番の2倍が付かない(${JSON.stringify(m.mult)})`);
    ok(m.airUntil === st.turn + 1, `${no}: 次のターン終わりまで空中にならない`);
  });
  // かしこさ技は舞い上がるで回避できない(ちから技だけ)
  {
    let st = scene({ mons: [['C-005', 'C-003', 'C-001'], ['C-005', 'C-003', 'C-001']], hands: [['053'], ['060']], guts: [3, 2] });
    const o = find(E.cardAttackOptions(db, st), (x) => x.target && x.target.m === 0 && db.cards[st.players[0].hand[x.hand[0]]].kind === 'int');
    ok(o, '060: かしこさ技の場面が作れない');
    if (o) { st = act(st, o); ok(!find(E.cardGuardOptions(db, st), (x) => st.players[1].hand[x.hand] === '060'), '060: かしこさ技まで回避できてしまう'); }
  }
  // 区切り1: 緊急回避(109・全モンスター) … ちから技・かしこさ技を回避。自分のガッツを全て失う(精神集中でも失う)
  {
    ready('109');
    let st = scene({ hands: [['026'], ['109']], guts: [3, 4] });
    // ゴーレム(2体目)のキックで、相手の1体目を狙う
    const o = find(E.cardAttackOptions(db, st), (x) => x.mon === 1 && x.target && x.target.m === 0);
    ok(o, '109: 場面が作れない'); if (o) {
      st = act(st, o);
      st.players[1].gutsGuardUntil = st.turn + 5;
      const g = find(E.cardGuardOptions(db, st), (x) => st.players[1].hand[x.hand] === '109');
      ok(g, '109: 回避できない');
      if (g) {
        const d0 = st.players[1].discard.length, life0 = st.players[1].mons[0].life;
        st = act(act(st, g), { type: 'pass' });
        ok(st.players[1].mons[0].life === life0, '109: 回避したのにダメージを受けた');
        ok(st.players[1].guts.length === 0 && st.players[1].discard.length === d0 + 5, `109: ガッツを全て失わない(残り ${st.players[1].guts.length})`);
      }
    }
  }
  // ---- 区切り2: 技と同時に使う札(付ける札) ----
  const monOf = (sp) => Object.values(db.monsters).filter((m) => m.species === sp && !m.main).map((m) => m.no).sort()[0];
  const plainOf = (sp, kind) => Object.values(db.cards).filter((c) => c.ready && c.user === sp && c.kind === kind && !(c.effects || []).length && c.guts > 0).sort((a, b) => a.guts - b.guts || (a.no < b.no ? -1 : 1))[0];
  // 手札の番号の組が、そのカードの番号の組と同じ手(target … 相手の何体目)
  const optWith = (st, nos, m, type = 'attack') => find(E.cardAttackOptions(db, st), (x) => x.type === type && x.hand.length === nos.length
    && JSON.stringify(x.hand.map((i) => st.players[st.active].hand[i]).sort()) === JSON.stringify(nos.slice().sort()) && (m === undefined || (x.target && x.target.m === m)));
  const hitOnce = (st, a) => { const l0 = st.players[1].mons.map((x) => x.life); const s1 = act(act(st, a), { type: 'pass' }); return { st: s1, dmg: l0.map((v, i) => v - s1.players[1].mons[i].life) }; };
  const big = (st) => { st.players[1].mons.forEach((x) => { x.life = 40; x.max = 40; }); return st; };
  const gol = plainOf('golem', 'pow'); // でこぴんなど(ゴーレムの、文の無いちから技)
  ok(gol, '検査の見本: ゴーレムの文の無いちから技が無い');
  // クリティカル(121): +2
  { ready('121'); const st = big(scene({ hands: [[gol.no, '121'], []], guts: [9, 0] })); const a = optWith(st, [gol.no, '121'], 0); ok(a, '121: 技に付けられない');
    if (a) ok(hitOnce(st, a).dmg[0] === gol.damage + 2, '121: ダメージが+2にならない'); }
  // 劇的な幕切れ(124): 山札0のときだけ。3倍
  { ready('124'); const st = big(scene({ hands: [[gol.no, '124'], []], guts: [9, 0] })); ok(!optWith(st, [gol.no, '124'], 0), '124: 山札があるのに付けられる');
    st.players[0].deck = []; const a = optWith(st, [gol.no, '124'], 0); ok(a, '124: 山札0なのに付けられない');
    if (a) ok(hitOnce(st, a).dmg[0] === gol.damage * 3, '124: 3倍にならない'); }
  // 必死(345): 自分のライフ2以下のときだけ +2
  { ready('345'); const st = big(scene({ hands: [[gol.no, '345'], []], guts: [9, 0] })); ok(!optWith(st, [gol.no, '345'], 0), '345: ライフが多いのに付けられる');
    st.players[0].mons[1].life = 2; const a = optWith(st, [gol.no, '345'], 0); ok(a, '345: ライフ2で付けられない');
    if (a) ok(hitOnce(st, a).dmg[0] === gol.damage + 2, '345: +2にならない'); }
  // 捨て身(330・ケンタウロス): 2倍。回避されなかったら自分も2ダメージ
  { ready('330'); const cen = monOf('centaur'); const cp = plainOf('centaur', 'pow'); ok(cen && cp, '330: ケンタウロスの見本が無い');
    if (cen && cp) { const st = big(scene({ mons: [[cen, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[cp.no, '330'], []], guts: [9, 0] }));
      const a = optWith(st, [cp.no, '330'], 0); ok(a, '330: 付けられない');
      if (a) { const l = st.players[0].mons[0].life; const r = hitOnce(st, a); ok(r.dmg[0] === cp.damage * 2, '330: 2倍にならない'); ok(r.st.players[0].mons[0].life === l - 2, '330: 自分が2ダメージ受けない'); } } }
  // 団結(343・コロペンドラ)・光合成(209・プラント): 払うガッツ -1 / -2(ちょうど足りるガッツで出せる)
  [['343', 'colorpandora', 1], ['209', 'plant', 2]].forEach(([no, sp, n]) => {
    ready(no); const mo = monOf(sp); const cp = Object.values(db.cards).filter((c) => c.ready && c.user === sp && (c.kind === 'pow' || c.kind === 'int') && !(c.effects || []).some((e) => ['useWhen', 'combo', 'chain', 'area'].includes(e.t)) && c.guts > n).sort((a, b) => a.guts - b.guts)[0];
    ok(mo && cp, `${no}: 見本が無い`); if (!mo || !cp) return;
    const own = db.cards[no].guts;
    const st = big(scene({ mons: [[mo, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[cp.no, no], []], guts: [cp.guts - n + own, 0] }));
    const a = optWith(st, [cp.no, no], 0); ok(a, `${no}: ガッツ-${n}で出せない`);
    if (a) { const g0 = st.players[0].guts.length; const s1 = act(st, a); ok(g0 - s1.players[0].guts.length === cp.guts - n + own, `${no}: 払ったガッツが合わない`); }
    const st2 = scene({ mons: [[mo, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[cp.no, no], []], guts: [cp.guts - n + own - 1, 0] });
    ok(!optWith(st2, [cp.no, no], 0), `${no}: ガッツが足りないのに出せる`);
  });
  // 急襲(347): 全員に当たる技にだけ付けて、払うガッツが半分(切り上げ)
  { ready('347'); const ar = Object.values(db.cards).filter((c) => c.ready && (c.effects || []).some((e) => e.t === 'area' && e.who === 'enemies' && !e.only) && c.user !== 'any' && c.user !== 'breeder' && c.guts >= 3).sort((a, b) => (a.no < b.no ? -1 : 1))[0];
    ok(ar, '347: 全員に当たる技の見本が無い');
    if (ar) { const mo = monOf(ar.user); const want = Math.ceil(ar.guts / 2) + db.cards['347'].guts;
      const st = big(scene({ mons: [[mo, mo === 'C-003' ? 'C-001' : 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[ar.no, '347', gol.no], []], guts: [want, 0] }));
      ok(find(E.cardAttackOptions(db, st), (x) => JSON.stringify(x.hand.map((i) => st.players[0].hand[i]).sort()) === JSON.stringify([ar.no, '347'].sort())), '347: 半分のガッツで出せない');
      ok(!optWith(st, [gol.no, '347'], 0), '347: 1体を狙う技にも付けられる'); } }
  // 守りの縛り: 集中(274)・挟み撃ち(349)・影縛り(366)・渾身(362)・瞬殺(363)・電光石火(009)・跳躍(070)
  const guardsAfter = (st, a) => { const s1 = act(st, a); return { s1, g: E.cardGuardOptions(db, s1).map((x) => s1.players[1].hand[x.hand]) }; };
  { ready('274'); const st = scene({ hands: [[gol.no, '274'], ['109', '096']], guts: [9, 3] }); const a = optWith(st, [gol.no, '274'], 0);
    ok(a, '274: 付けられない'); if (a) { const { g } = guardsAfter(st, a); ok(!g.includes('109'), '274: 0ガッツの守り(緊急回避)が出せてしまう'); } }
  { ready('349'); const st = scene({ hands: [[gol.no, '349'], ['109']], guts: [9, 3] }); st.players[1].mons[0].guardTurn = st.turn; const a = optWith(st, [gol.no, '349'], 0);
    ok(a, '349: 付けられない'); if (a) ok(!guardsAfter(st, a).g.length, '349: このターンもう守った子が守れてしまう');
    const st2 = scene({ hands: [[gol.no, '349'], ['109']], guts: [9, 3] }); const a2 = optWith(st2, [gol.no, '349'], 0); if (a2) ok(guardsAfter(st2, a2).g.includes('109'), '349: まだ守っていない子まで守れない'); }
  { ready('366'); const st = scene({ hands: [[gol.no, '366'], ['109']], guts: [9, 3] }); const a = optWith(st, [gol.no, '366'], 0);
    ok(a, '366: 付けられない');
    if (a) {
      ok(!E.cardApplyAction(db, st, a), '366: 名指しが無いのに出せる');
      ok(!E.cardApplyAction(db, st, { ...a, bind: 'ない名前' }), '366: 守りの札でない名前を名指しできる');
      const { s1, g } = guardsAfter(st, { ...a, bind: '緊急回避' }); ok(!g.includes('109'), '366: 名指しした札が出せてしまう');
      ok(s1.players[0].breederUsed, '366: ブリーダーのカード1枚に数えない');
      const st2 = scene({ hands: [[gol.no], []], guts: [9, 3] }); ok(!E.cardApplyAction(db, st2, { ...optWith(st2, [gol.no], 0), bind: '緊急回避' }), '366: 影縛りを付けていないのに名指しを持てる');
    } }
  { ready('362'); const dino = monOf('dino'); const dp = plainOf('dino', 'pow'); const red = Object.values(db.cards).find((c) => c.ready && c.user === 'any' && (c.effects || []).some((e) => e.t === 'reduce' && e.kinds.includes('pow')));
    ok(dino && dp && red, '362: 見本が無い');
    if (dino && dp && red) { const st = big(scene({ mons: [[dino, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[dp.no, '362'], [red.no]], guts: [9, 9] }));
      const a = optWith(st, [dp.no, '362'], 0); ok(a, '362: 付けられない');
      if (a) { let s1 = act(st, a); const g = find(E.cardGuardOptions(db, s1), (x) => s1.players[1].hand[x.hand] === red.no); ok(g, '362: 防御は出せるはず');
        if (g) { const l = s1.players[1].mons[0].life; s1 = act(act(s1, g), { type: 'pass' }); ok(l - s1.players[1].mons[0].life === dp.damage, '362: 防御でダメージが減った'); } } } }
  { ready('363'); const naga = monOf('naga'); const np = plainOf('naga', 'pow'); ok(naga && np, '363: 見本が無い');
    if (naga && np) { const st = scene({ mons: [[naga, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[np.no, '363'], ['109']], guts: [9, 9] });
      const a = optWith(st, [np.no, '363'], 0); ok(a, '363: 付けられない'); if (a) ok(!guardsAfter(st, a).g.length, '363: 守りが出せてしまう'); } }
  [['009', 'tiger'], ['070', 'dino']].forEach(([no, sp]) => {
    ready(no); const mo = monOf(sp); const pw = plainOf(sp, 'pow'); ok(mo && pw, `${no}: 見本が無い`); if (!mo || !pw) return;
    const st = scene({ mons: [[mo, mo === 'C-003' ? 'C-001' : 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[pw.no, no], ['109']], guts: [9, 9] });
    const a = optWith(st, [pw.no, no], 0); ok(a, `${no}: 付けられない`);
    if (a) { const { s1, g } = guardsAfter(st, a); ok(!g.includes('109'), `${no}: 回避できてしまう`); ok(s1.players[0].mons[0].attacks === 1, `${no}: 攻撃の回数が2回に数えられた`); }
  });
  // 純血のスピード(346): 純血の子の技に付けて、混血(派生)の子は回避できない。混血の子の技には付けられない
  { ready('346'); const hy = Object.values(db.monsters).find((m) => m.main === 'tiger' || m.sub === 'tiger') || Object.values(db.monsters).find((m) => m.main);
    const st = scene({ mons: [['C-003', 'C-001', 'C-005'], [hy.no, 'C-003', 'C-005']], hands: [[gol.no, '346'], ['109']], guts: [9, 9] });
    const a = optWith(st, [gol.no, '346'], 0); ok(a, '346: 付けられない');
    if (a) ok(!guardsAfter(st, a).g.includes('109'), '346: 混血の子が回避できてしまう');
    const st2 = scene({ mons: [['C-003', 'C-001', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[gol.no, '346'], ['109']], guts: [9, 9] });
    const a2 = optWith(st2, [gol.no, '346'], 0); if (a2) ok(guardsAfter(st2, a2).g.includes('109'), '346: 純血の子まで回避できない');
    const hyAtk = Object.values(db.cards).find((c) => c.ready && c.user === hy.main && c.kind === 'pow' && !(c.effects || []).length);
    if (hyAtk) { const st3 = scene({ mons: [[hy.no, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[hyAtk.no, '346'], []], guts: [9, 0] }); ok(!optWith(st3, [hyAtk.no, '346'], 0), '346: 混血の子の技に付けられる'); } }
  // ジョイのサポート(276): ガッツ3以下のブリーダーのカードに付けて、そのカードは0ガッツ。1ターン1枚のまま
  // その場面ですぐ出せるブリーダーのカード(狙いの要る札・条件のある札は見本にしない)
  const breederFresh = (minG, maxG) => Object.values(db.cards).filter((c) => c.ready && c.user === 'breeder' && c.guts >= minG && c.guts <= maxG && !(c.effects || []).some((e) => ['attach', 'extraAttackTarget', 'unstunTarget', 'useWhenAllies', 'heal'].includes(e.t)))
    .filter((c) => { const t = scene({ hands: [[c.no], []], guts: [9, 0] }); return E.cardAttackOptions(db, t).some((x) => x.type === 'breeder'); }).sort((a, b) => b.guts - a.guts || (a.no < b.no ? -1 : 1));
  { ready('276'); const br = breederFresh(1, 3)[0];
    ok(br, '276: ガッツ3以下のブリーダーのカードの見本が無い');
    if (br) { const st = scene({ hands: [[br.no, '276'], []], guts: [0, 0] });
      const a = find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder' && x.hand.length === 2);
      ok(a, `276: 0ガッツで「${br.name}」に付けて出せない`);
      if (a) { const s1 = act(st, a); ok(s1.players[0].breederUsed && !find(E.cardAttackOptions(db, s1), (x) => x.type === 'breeder'), '276: ブリーダーのカードがもう1枚出せる'); } } }
  // 友情の証(342・コロペンドラ): 出した子の1回に数える。そのターン、ほかの味方の特殊技は0ガッツ
  { ready('342'); const cp = monOf('colorpandora');
    const st = scene({ mons: [[cp, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['342', '034'], []], guts: [0, 0] });
    ok(!optWith(st, ['034']), '342: 友情の証の前に、力をためるが0ガッツで出せる');
    const a = optWith(st, ['342']); ok(a, '342: 出せない');
    if (a) { const s1 = act(st, a); ok(s1.players[0].mons[0].attacks === 1, '342: 出した子の1回に数えない'); ok(optWith(s1, ['034']), '342: ほかの味方の特殊技が0ガッツにならない'); } }
  // ---- 区切り3: もう1回攻撃・攻撃できない・狙いの縛り ----
  const nextTurnOf = (st0, who) => { let s1 = JSON.parse(JSON.stringify(st0)); s1.active = who; s1.turn += 1; s1.phase = 'main'; s1.players[who].mons.forEach((m) => { m.attacks = 0; }); s1.players[who].breederUsed = false; return s1; };
  const canHit = (st, nos, m) => !!optWith(st, nos, m);
  // 孤軍奮闘(250): 味方が1体のときだけ。もう1回攻撃できる
  { ready('250'); let st = scene({ hands: [['250', gol.no], []], guts: [9, 0] }); ok(!optWith(st, ['250']), '250: 味方が3体なのに出せる');
    st.players[0].mons[0].ko = true; st.players[0].mons[2].ko = true; const a = optWith(st, ['250']); ok(a, '250: 味方1体で出せない');
    if (a) { st = act(st, a); ok(canHit(st, [gol.no], 0), '250: もう1回攻撃できない'); } }
  // オイリーオイル(254): もう攻撃した味方にだけ。その子はもう1回
  { ready('254'); let st = scene({ hands: [[gol.no, '254', gol.no], []], guts: [9, 0] }); ok(!find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder' && st.players[0].hand[x.hand[0]] === '254'), '254: まだだれも攻撃していないのに出せる');
    st = act(act(st, optWith(st, [gol.no], 0)), { type: 'pass' }); ok(!canHit(st, [gol.no], 0), '254: 見本: ゴーレムが2回攻撃できてしまう');
    const a = find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder' && st.players[0].hand[x.hand[0]] === '254');
    ok(a && a.target && a.target.m === 1, '254: 攻撃したゴーレムを選べない');
    if (a) { st = act(st, a); ok(canHit(st, [gol.no], 0), '254: もう1回攻撃できない'); } }
  // 吹き飛ばし(273)・吠え(010): 相手は次のターン攻撃できない(守りとブリーダーのカードは出せる)。夏美草(351)でその印を消せる
  { ready('273'); ready('351'); let st = scene({ hands: [['273'], [gol.no, '351']], guts: [9, 9] });
    const a = find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '273' && x.target && x.target.m === 1);
    ok(a, '273: 相手を選べない');
    if (a) { st = act(st, a); let s2 = nextTurnOf(st, 1); ok(!canHit(s2, [gol.no], 0), '273: 吹き飛ばされた子が攻撃できる');
      const n = find(E.cardAttackOptions(db, s2), (x) => x.type === 'breeder' && s2.players[1].hand[x.hand[0]] === '351');
      ok(n && n.target && n.target.m === 1, '273/351: 夏美草で、攻撃できない子を選べない');
      if (n) { s2 = act(s2, n); ok(canHit(s2, [gol.no], 0), '351: 夏美草のあとも攻撃できない'); } } }
  { ready('010'); let st = scene({ mons: [[monOf('tiger'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['010'], [gol.no]], guts: [9, 9] });
    const a = optWith(st, ['010']); ok(a, '010: 出せない');
    if (a) { st = act(st, a); const s2 = nextTurnOf(st, 1); ok(!s2.players[1].mons.some((m, j) => E.cardAttackOptions(db, s2).some((x) => x.mon === j)), '010: 吠えのあとも相手の子が技を出せる'); } }
  // 死亡遊戯(083・ナーガ)・タイムディレイ(294・メタルナー): その子はそのターン何枚でも
  [['083', 'naga'], ['294', 'metalner']].forEach(([no, sp]) => {
    ready(no); const mo = monOf(sp); const pw = plainOf(sp, 'pow') || plainOf(sp, 'int'); ok(mo && pw, `${no}: 見本が無い`); if (!mo || !pw) return;
    let st = big(scene({ mons: [[mo, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[no, pw.no, pw.no, pw.no], []], guts: [20, 0] }));
    st = act(st, optWith(st, [no]));
    for (let k = 0; k < 3; k++) { const a = optWith(st, [pw.no], 0); ok(a, `${no}: ${k + 2}枚目の技が出せない`); if (!a) break; st = act(act(st, a), { type: 'pass' }); }
  });
  // うたうニャ(197・ニャー): このターン、ブリーダーのカードを何枚でも
  { ready('197'); const br = breederFresh(0, 3).slice(-1)[0];
    ok(br, '197: ブリーダーのカードの見本が無い');
    if (br) { let st = scene({ mons: [[monOf('mew'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['197', br.no, br.no], []], guts: [9, 0] });
      st = act(st, optWith(st, ['197']));
      const b1 = find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder'); ok(b1, '197: 1枚目のブリーダーのカードが出せない');
      if (b1) { st = act(st, b1); ok(find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder'), '197: 2枚目のブリーダーのカードが出せない'); } } }
  // 挑発(046)・レロレロ(365): 相手は次の番、この子を狙う技しか出せない(全員に当たる技は出せる)
  // 魅了(057): この子に当たる技を出せない(全員に当たる技も)/ たちはだかる(269): この子を狙う技だけ(全員に当たる技も出せない)
  const areaPow = Object.values(db.cards).find((c) => c.ready && c.user === 'golem' && (c.effects || []).some((e) => e.t === 'area' && e.who === 'enemies' && !e.only));
  [['046', 'suezo', 'only', true], ['365', 'mocchi', 'only', true], ['057', 'pixie', 'not', false], ['269', 'zilla', 'only', false]].forEach(([no, sp, mode, areaOk]) => {
    ready(no); const mo = monOf(sp); ok(mo, `${no}: 見本が無い`); if (!mo) return;
    let st = scene({ mons: [[mo, 'C-001', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[no], [gol.no, ...(areaPow ? [areaPow.no] : [])]], guts: [9, 20] });
    const a = optWith(st, [no]); ok(a, `${no}: 出せない`); if (!a) return;
    st = act(st, a); const s2 = nextTurnOf(st, 1);
    const hitsMe = canHit(s2, [gol.no], 0), hitsOther = canHit(s2, [gol.no], 1);
    if (mode === 'only') ok(hitsMe && !hitsOther, `${no}: 縛った子だけを狙える形になっていない(この子 ${hitsMe}・ほか ${hitsOther})`);
    else ok(!hitsMe && hitsOther, `${no}: 縛った子を狙えてしまう(この子 ${hitsMe}・ほか ${hitsOther})`);
    if (areaPow) ok(!!optWith(s2, [areaPow.no]) === areaOk, `${no}: 全員に当たる技が${areaOk ? '出せない' : '出せてしまう'}`);
    const s3 = nextTurnOf(s2, 1); s3.turn += 1; ok(canHit(s3, [gol.no], 1), `${no}: その次の番まで縛りが残る`);
  });
  // 歌う(047・スエゾー): 相手の次の番を飛ばす(引かない・山札切れも起きない)
  { ready('047'); let st = scene({ mons: [[monOf('suezo'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['047'], []], guts: [9, 0] });
    st.players[1].deck = []; const t0 = st.turn;
    st = act(st, optWith(st, ['047'])); st = act(act(st, { type: 'endAttacks' }), { type: 'guts', hand: [] });
    ok(st.active === 0 && st.turn === t0 + 2 && st.winner === null, `047: 相手の番が飛ばない(番 ${st.active}・ターン ${st.turn - t0}・勝ち ${st.winner})`);
    ok(st.players[1].hand.length === 0, '047: 飛ばされた番に引いている'); }
  // 怒り(251): 次の自分の番まで守れない。次の自分の番のちから技・かしこさ技2倍
  { ready('251'); let st = big(scene({ hands: [['251', gol.no], [gol.no]], guts: [9, 9] }));
    const a = find(E.cardAttackOptions(db, st), (x) => x.mon === 1 && st.players[0].hand[x.hand[0]] === '251'); ok(a, '251: 出せない');
    if (a) { st = act(st, a); st.players[0].hand.push('109'); const s2 = nextTurnOf(st, 1); s2.players[1].guts = Array(9).fill('100');
      const h = optWith(s2, [gol.no], 1); let s3 = act(s2, h); ok(!E.cardGuardOptions(db, s3).length, '251: 怒った子が守れる');
      s3 = act(s3, { type: 'pass' }); const s4 = nextTurnOf(s3, 0); s4.players[1].mons.forEach((x) => { x.life = 40; x.max = 40; });
      const r = hitOnce(s4, optWith(s4, [gol.no], 0)); ok(r.dmg[0] === gol.damage * 2, `251: 次の番の技が2倍にならない(${r.dmg[0]})`); } }
  // ほうり上げる(234・ドラゴン): 相手1体をこのターンだけ空中に。もう1回攻撃できる
  { ready('234'); const dr = monOf('dragon'); const dp = plainOf('dragon', 'pow'); let st = scene({ mons: [[dr, 'C-003', 'C-001'], ['C-001', 'C-003', 'C-005']], hands: [['234', dp.no], []], guts: [9, 0] });
    const a = find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '234' && x.target && x.target.m === 1); ok(a, '234: 相手を選べない');
    if (a) { st = act(st, a); ok(E.cardMonType(st.players[1].mons[1], st.turn) === 'air', '234: 空中にならない'); ok(canHit(st, [dp.no], 0), '234: もう1回攻撃できない');
      ok(E.cardMonType(st.players[1].mons[1], st.turn + 1) === 'ground', '234: ターンが終わっても空中のまま'); } }
};
scenes();
pendingCards();
motionDemo();
tutorialRun();
packs();
decksAndSaves();
dataAndImages();
sims();
if (fails.length) { console.error(`✗ MFバトルカードのルール: ${fails.length} 件\n  ${[...new Set(fails)].slice(0, 30).join('\n  ')}`); process.exit(1); }
console.log('✓ MFバトルカードのルール: 決まりごとの場面とコンピューターどうしの対戦がそろった');

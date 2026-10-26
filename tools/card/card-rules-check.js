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
    + 'this.E = { CARD_BATTLE_DATA, cardUnlockedWithRecord, cardDecider, cardMonType, CARD_THINK_PACE, CARD_RESULT_WAIT_MS, CARD_PRESS_MS, CARD_BUBBLE_PER_TURN, CARD_SETTING_GROUPS, cardOf, cardIsBreederCard, cardDodgeIsJump, cardGuardLabel, cardCreateGame, cardApplyAction, cardLegalActions, cardAttackOptions, cardGuardOptions, cardAiChooseAction, cardAiPolicy, cardAiBuildDeck, cardAiSeededRand, cardAiPickTrio, CARD_AI_FAVORITE, cardAiFavoriteCandidates, CARD_AI_BUILD, cardUsableBy, cardSimulate, CARD_AI_LEVELS, CARD_AI_HABITS, CARD_AI_DECKS, cardDeckProblems, cardNormalizeCollection, cardNormalizeDecks, cardNormalizePoint, cardNormalizeDaily, cardNormalizeRecord, cardNormalizeCpuUnlocked, cardGrantStarter, cardCpuReward, cardUnlockAfterWin, cardMotionDemo, cardMotionDemoAction, cardTutorialGame, cardTutorialMutate, cardTutorialAllow, cardTutorialDone, cardTutorialCpu, CARD_TUTORIAL_STAGES, cardTutorialCopyProblems, cardTutorialFinish, CARD_TUTORIAL_LINES, cardCpuLoops, cardOwnTurns, cardDeckAddReason, cardDeckReady, cardDecksPut, cardDecksRemove, CARD_PACKS, cardOpenPack, cardBuyPacks, cardPackRates, cardPackCardRates, cardPackIdOf, cardPackAllCards, cardSplitPity, cardBuyStarter, cardMonRarity, cardNormalizePity, cardNormalizeShop, CARD_SAVE_KEYS, CARD_POINT_STORE_KEY, cardRecordAfter, cardRankRow, cardWeekKeyJst, normalizeCardBgm, normalizeCardSettings };';
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
      let win = 0, n = 0, sd = 1;
      // 助手のデッキは毎試合組み直す(好きなモンスター ベスト4から3体。2026-10-25)。MASTER はプレイヤー役のデッキを見る
      Object.keys(db.starters).forEach((k) => { for (let g = 0; g < 30; g++) { const d = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`${w}:${lv}:${k}:${g}`), { playerDeck: E.cardAiBuildDeck(db, k) }); const st = E.cardSimulate(db, { decks: [d, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!d.sameBlood }), E.cardAiPolicy('kyuko', lv)], seed: 7000 + sd++, first: g % 2 }); if (st.winner === 0) win += 1; n += 1; } });
      return [w, win / n];
    });
    const bad = rates.filter(([, r]) => r < 0.38 || r > 0.65);
    ok(!bad.length, `${lv.toUpperCase()} の助手の強さがそろっていない(プレイヤー役への勝率 38〜65% の外): ${bad.map(([w, r]) => `${w} ${Math.round(r * 100)}%`).join('・')}`);
  });
  // スターターと助手のデッキ(全部の難易度)が決まりどおり
  Object.keys(db.starters).forEach((k) => { const p = E.cardDeckProblems(db, E.cardAiBuildDeck(db, k)); ok(!p.length, `スターター ${k}: ${p.join('・')}`); });
  // 好きなモンスター(1体・主血統で決める。2026-10-25 社長): どの強さでも必ず1体入る(後の弾の子も EASY から)。
  //   候補はその種族の通常・キラ・別絵キラと、主血統がその種族の混血。毎試合少し変わり、残り2体は別々の種族。EASY はたまに気まぐれ
  const WANT_FAV = { mua: 'mocchi', momosuke: 'metalner', kiki: 'golem', kyuko: 'mew', dra: 'zilla', atsu: 'dragon' };
  ok(JSON.stringify(E.CARD_AI_FAVORITE) === JSON.stringify(WANT_FAV), `好きなモンスターが社長の決めと違う: ${JSON.stringify(E.CARD_AI_FAVORITE)}`);
  const hf = E.cardAiFavoriteCandidates(db, 'mua').map((no) => db.monsters[no].name);
  ok(hf.includes('ヘルファット') && hf.filter((n) => n === 'モッチー').length >= 2, `みゅあの好きなモンスターの候補に、モッチーのキラや派生(ヘルファット)が入っていない: ${hf.join('・')}`);
  Object.keys(E.CARD_AI_HABITS).forEach((w) => {
    const cands = E.cardAiFavoriteCandidates(db, w);
    ok(cands.length >= 1, `助手 ${w} の好きなモンスターの候補が無い`);
    Object.keys(E.CARD_AI_LEVELS).forEach((lv) => {
      const trios = new Set(); const favUsed = new Set(); let favAttack = true;
      for (let g = 0; g < 40; g++) {
        const d = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`fav:${w}:${lv}:${g}`));
        const fm = d.monsters.filter((no) => cands.includes(no));
        ok(fm.length >= 1, `助手 ${w}(${lv})のデッキに好きなモンスターがいない`);
        const sp = d.monsters.map((no) => db.monsters[no].species);
        ok(new Set(sp).size === 3, `助手 ${w}(${lv})の3体の種族が重なっている`);
        trios.add(d.monsters.slice().sort().join(',')); fm.forEach((no) => favUsed.add(no));
        // 好きな子が使える攻撃の技が入っている(後の弾の子でも、EASY から戦える)
        const fmon = db.monsters[fm[0]];
        if (!d.cards.some((no) => { const c = db.cards[no]; return c.user !== 'any' && c.user !== 'breeder' && ['pow', 'int'].includes(c.kind) && E.cardUsableBy(c, { ...fmon, ko: false }); })) favAttack = false;
      }
      ok(favAttack, `助手 ${w}(${lv})で、好きなモンスターの攻撃の技が入らないことがある`);
      if (lv !== 'master') ok(trios.size >= 2, `助手 ${w}(${lv})の3体が毎回同じ`);
      if (lv === 'easy' && cands.length >= 3) ok(favUsed.size >= 2, `助手 ${w}(EASY)の好きな子が毎回同じ(キラや派生も使う)`);
    });
  });
  Object.keys(E.CARD_AI_DECKS).forEach((w) => Object.keys(E.CARD_AI_LEVELS).forEach((lv) => [0, 1, 2, 3, 4].forEach((g) => {
    const d = E.cardAiBuildDeck(db, w, lv, g ? E.cardAiSeededRand(`deck:${w}:${lv}:${g}`) : null);
    const p = E.cardDeckProblems(db, d);
    ok(!p.length, `助手 ${w}(${lv})のデッキ: ${p.join('・')}`);
    ok(d.cards.every((no) => db.cards[no].ready), `助手 ${w}(${lv})のデッキに準備中のカード`);
    // 弾の制限: 全モンスター・ブリーダーのカードは決めた弾まで。各モンスターの技は、その子の弾まで(後の弾の好きな子も EASY から戦える)
    const mw = (m) => (String(m.wave) === 'hybrid' ? Number((Object.values(db.monsters).find((x) => !x.variant && x.species === m.main && String(x.wave) !== 'hybrid') || { wave: 4 }).wave) : Number(m.wave));
    const maxW = E.CARD_AI_BUILD[lv].maxWave;
    const badWave = d.cards.filter((no) => { const c = db.cards[no]; if (c.user === 'any' || c.user === 'breeder') return c.wave > maxW; return !d.monsters.some((mno) => { const m = db.monsters[mno]; return E.cardUsableBy(c, { ...m, ko: false }) && c.wave <= Math.max(maxW, mw(m)); }); });
    ok(!badWave.length, `助手 ${w}(${lv})のデッキに使えない弾のカード: ${[...new Set(badWave)].slice(0, 4).join('・')}`);
  })));
  // 保存の読み込み: 無い・壊れた値でも既定値になる
  [undefined, null, 'x', 5, [], { a: 'b' }].forEach((bad) => {
    ok(JSON.stringify(E.cardNormalizeCollection(bad)) === '{}' || cardIsObj(E.cardNormalizeCollection(bad)), 'コレクションの正規化');
    ok(bad === 5 ? E.cardNormalizePoint(bad) === 5 : E.cardNormalizePoint(bad) === 0, `ポイント(ビートP)の正規化(${JSON.stringify(bad)})`);
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
    // 既定はトップ画面だけ MF × ICHIKA MIX(2026-10-26 社長)。対戦は前のとおり auto・ichika_battle。選んで保存した人の値はそのまま
    ok(JSON.stringify(E.normalizeCardBgm(null, isT)) === '{"top":"atsu_cup_theme","cpu":"auto","pvp":"ichika_battle"}' && E.normalizeCardBgm({ cpu: 'nope', pvp: 'nope' }, isT).cpu === 'auto'
      && E.normalizeCardBgm({ cpu: 'melo_toriko' }, isT).cpu === 'melo_toriko' && JSON.stringify(E.normalizeCardBgm({ cpu: 'melo_toriko', pvp: 'ichika_battle' }, isT)) === '{"top":"atsu_cup_theme","cpu":"melo_toriko","pvp":"ichika_battle"}', '対戦のBGMの読み込みで、既定・知らない曲の戻し・選んだ人の値が合わない');
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
  // 同じ血統の2体・3体(2026-10-26 社長「3体編成も実際あるから組まれるようにして」): 仲間の多いみゅあは出る・仲間のいないももすけは出ない・同じ子は2体入らない
  {
    const blood = (no) => { const m = db.monsters[no]; return String(m.wave) === 'hybrid' ? m.main : m.species; };
    const count = (who, lv) => { let two = 0, three = 0, dup = 0; for (let g = 0; g < 60; g++) { const d = E.cardAiBuildDeck(db, who, lv, E.cardAiSeededRand(`same:${who}:${lv}:${g}`)); const b = d.monsters.map(blood); const same = b.filter((x) => x === b[0]).length; if (same === 2) two += 1; if (same === 3) three += 1; if (new Set(d.monsters.map((no) => db.monsters[no].species)).size < 3) dup += 1; } return { two, three, dup }; };
    const mua = count('mua', 'normal');
    ok(mua.two > 0 && mua.three > 0, `みゅあ(モッチーの仲間が多い)のデッキに同じ血統の2体・3体が出ない(${JSON.stringify(mua)})`);
    const momo = count('momosuke', 'normal');
    ok(momo.two === 0 && momo.three === 0, `ももすけ(メタルナーの仲間がいない)のデッキに同じ血統が出た(${JSON.stringify(momo)})`);
    ok(['mua', 'kyuko', 'dra', 'atsu'].every((w) => ['easy', 'expert', 'master'].every((lv) => count(w, lv).dup === 0)), '助手のデッキに同じ子(キラ・別絵キラを含む)が2体入った');
  }
  // ポイントはビートPと同じ財布(2026-10-26 社長)。保存先はビートPのキーで、CARD_SAVE_KEYS には入れない
  // (デバッグの「カードバトルの記録を消す」が CARD_SAVE_KEYS を全部消すので、入っているとビートPまで消える)
  ok(E.CARD_POINT_STORE_KEY === 'mh_rhythm_event_points_v1', `ポイントの保存先がビートPのキーではない(${E.CARD_POINT_STORE_KEY})`);
  ok(!Object.values(E.CARD_SAVE_KEYS).includes(E.CARD_POINT_STORE_KEY), 'CARD_SAVE_KEYS にビートPのキーが入っている(記録を消すとビートPも消える)');
  ok(E.CARD_SAVE_KEYS.point === 'mh_card_point_v1', '前のカードポイントのキー(mh_card_point_v1)の名前が変わった(消さずに残す)');
  // ビートP(前のカードポイント)とクイック周回(案A・台帳 #3484): 1日の上限なし(台帳 #3531)・はじめての勝ちは+50
  const full = { ownTurns: 10, kos: 0 };
  let daily = E.cardNormalizeDaily(null, '2026-10-24');
  const r1 = E.cardCpuReward(daily, 'master', 'win', full);
  ok(r1.total === 250 && r1.daily.firstWin, `はじめての MASTER の勝ちは 200+50 のはず(${r1.total})`);
  daily = { ...r1.daily, cpuPoint: 1480 };
  const r2 = E.cardCpuReward(daily, 'master', 'win', full);
  ok(r2.got === 200 && !r2.capped && r2.bonus === 0 && r2.total === 200, '1日の上限が残っている(1,480 もらったあとでも満額のはず)');
  ok(E.cardCpuReward(daily, 'easy', 'surrender', { ownTurns: 5, kos: 0 }).total === 0, '倒さずに降参でカードポイントが出てしまう');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'easy', 'surrender', { ownTurns: 5, kos: 2 }).total === 20, '2体倒して降参は20のはず');
  ok(E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'easy', 'surrender', { ownTurns: 10, kos: 7 }).total === 60, '降参は負けの数(EASY 60・自分の番10回)を超えない');
  // 負けは勝ちの 3/4(切り捨て)。2026-10-26 社長「助手とのバトルも負けても報酬もっとあげよう」
  const loseWant = { easy: [60, 10], normal: [82, 12], hard: [105, 13], expert: [127, 15], master: [150, 16] };
  ok(Object.entries(loseWant).every(([lv, [pt]]) => E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), lv, 'lose', full).total === pt), '負けは勝ちの 3/4(60・82・105・127・150)のはず');
  // 負けのビートPも自分の番の数で減る(10回で満額・切り捨て)。投了の最大も減ったあとの負けの数(2026-10-26 社長)
  const d0 = () => E.cardNormalizeDaily(null, 'd');
  ok(E.cardCpuReward(d0(), 'master', 'lose', { ownTurns: 3, kos: 0 }).total === 45 && E.cardCpuReward(d0(), 'master', 'lose', { ownTurns: 7, kos: 0 }).total === 105 && E.cardCpuReward(d0(), 'master', 'lose', { ownTurns: 15, kos: 0 }).total === 150, '負けのビートPが自分の番の数で減らない(MASTER 3回で45・7回で105・10回以上で150のはず)');
  ok(E.cardCpuReward(d0(), 'easy', 'surrender', { ownTurns: 3, kos: 3 }).total === 18, '投了の最大が、減ったあとの負けの数(EASY 3回で18)になっていない');
  const sh = E.cardCpuReward(E.cardNormalizeDaily(null, 'd'), 'master', 'win', { ownTurns: 2, kos: 3 });
  ok(sh.total === 0 && sh.short && !sh.daily.firstWin, '自分の番を3回やる前に終わった試合でカードポイントが出る');
  const L = (lv, o, f) => E.cardCpuLoops(lv, o, f);
  ok([['easy', 14], ['normal', 16], ['hard', 18], ['expert', 20], ['master', 22]].every(([lv, n]) => L(lv, 'win', full) === n), '勝ちの周回が案Aと違う');
  ok(Object.entries(loseWant).every(([lv, [, n]]) => L(lv, 'lose', full) === n) && L('normal', 'lose', { ownTurns: 5, kos: 0 }) === 6, '負けの周回は勝ちの 3/4(10・12・13・15・16)×(自分の番÷10)のはず');
  ok(L('normal', 'surrender', { ownTurns: 5, kos: 0 }) === 0 && L('normal', 'surrender', { ownTurns: 5, kos: 1 }) === 4 && L('normal', 'surrender', { ownTurns: 5, kos: 2 }) === 8, '降参の周回は倒した数×負けの3分の1のはず');
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
    // 準備中のカードは 2026-10-25 に0枚になった(おいのり・全体カード)。準備中の札が増えたときに見る
    const nr = notReady || { ...Object.values(db.cards)[0], no: '__nr', ready: false };
    if (!notReady) db.cards.__nr = nr;
    ok(/準備中/.test(E.cardDeckAddReason(db, d, nr.no, { [nr.no]: 3 })), '準備中のカードが入ってしまう');
    if (!notReady) delete db.cards.__nr;
    const full = { id: 's', name: 's', monsters: kit.monsters.slice(), cards: kit.cards.slice() };
    ok(E.cardDeckReady(db, full, col) && !E.cardDeckReady(db, full, {}), '持っていないカードのデッキが対戦に使えてしまう');
    const ds = E.cardDecksPut({ active: 'a', decks: [{ ...full, id: 'a' }] }, { ...full, id: 'b' });
    ok(ds.decks.length === 2 && ds.active === 'a' && E.cardDecksRemove(ds, 'a').active === 'b', 'デッキの足し方・消し方が違う');
  }
  const u = E.cardUnlockAfterWin(E.cardNormalizeCpuUnlocked(null), 'normal');
  ok(u.hard && !u.expert, 'NORMAL で勝っても HARD が開かない');
  ok(!E.cardUnlockAfterWin(E.cardNormalizeCpuUnlocked(null), 'easy').hard, 'EASY の勝ちで HARD が開いてしまう');
  // 記録から開いているはずの強さを足す(2026-10-26 社長「ハード解放したのにできてない」)。保存値は書き換えない
  {
    const W = E.cardUnlockedWithRecord;
    const recWins = (win) => ({ byLevel: { win, lose: {} } });
    const r1 = W(null, recWins({ normal: 2 }));
    ok(r1.hard && !r1.expert && !r1.master, 'NORMAL で勝った記録があるのに HARD が開かない(または開きすぎる)');
    const r2 = W({ hard: true }, recWins({ normal: 1, hard: 1, expert: 3 }));
    ok(r2.hard && r2.expert && r2.master, 'HARD・EXPERT の勝ちの記録から EXPERT・MASTER が開かない');
    const r3 = W(null, { recent: [{ at: 1, who: 'mua', level: 'normal', outcome: 'win' }] });
    ok(r3.hard && !r3.expert, '最近の対戦の勝ち(NORMAL)から HARD が開かない');
    const r4 = W(null, recWins({ easy: 5 }));
    ok(!r4.hard && !r4.expert && !r4.master, 'EASY の勝ちだけで HARD が開いてしまう');
    const r5 = W({ hard: true, expert: true, master: true }, null);
    ok(r5.hard && r5.expert && r5.master, '開いていた強さが、記録が無いと閉じてしまう');
    ok(JSON.stringify(W('こわれた', 'こわれた')) === JSON.stringify({ hard: false, expert: false, master: false }), '壊れた保存値で落ちる・開いてしまう');
    const saved = { hard: false };
    W(saved, recWins({ normal: 1 }));
    ok(saved.hard === false, '保存値(引数)を書き換えてしまう');
<<<<<<< HEAD
    // 助手の立ち絵の範囲の表(84 の CARD_ART_KNOWN_BOX)が、今の絵と合っている(絵を差し替えたら tools/card/card-art-box-build.js で書き直す)
    {
      const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'card-art-box-build.js'), '--check'], { encoding: 'utf8' });
      ok(r.status === 0, `助手の立ち絵の範囲の表が今の絵と合っていない(${(r.stdout || r.stderr || '').trim().split('\n').pop()})`);
=======
    // デバッグの「技の動きの見本」の対戦は、終わっても投了しても保存しない(結果の保存より前に戻る)
    {
      const p84 = fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '84-screen-card-battle.jsx'), 'utf8');
      const fin = p84.slice(p84.indexOf('if (game.pvp) {'), p84.indexOf('const fresh = await freshCardSave();'));
      ok(/if \(game\.demo\) \{[^}]*setView\('top'\);\s*return;\s*\}/.test(fin) && fin.indexOf('if (game.demo)') < fin.indexOf('persist('), '技の動きの見本の対戦が、終わったときに記録・ビートPを保存してしまう');
>>>>>>> origin/main
    }
    ok(/unlocked: cardUnlockedWithRecord\(unlocked, record\)/.test(fs.readFileSync(path.join(__dirname, '..', '..', 'monster-hero', 'src', 'parts', '84-screen-card-battle.jsx'), 'utf8')), 'カードの画面の読み込みで、記録から開いている強さを足していない');
  }
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
  // 混血・派生は主の種族の弾へ(#3575)。2026-10-25 の派生25枚も同じ決め(立ち絵の無い5枚は図鑑だけで、パックには出ない)
  // 剣士モッチー(2026-10-26)はふつう・キラ・別絵キラの3枚。名前は1つとして数える
  const HYBRID = { p1: ['ダークハム', 'ヘルファット', 'ヴァージアハピ', 'カッチュウサウル', 'ジェントル', 'ヨロイモッチー', 'アンキロックス', '剣士モッチー'], p2: ['ストライクリパー', 'ラベンダーキール', 'エンジェル', 'バズラ', 'ナハトファルター', 'ブルーマウンテン', 'マグナビートル', 'パンドラ'], p3: ['バロン', 'アクアリウス', 'プラムラー', 'ハムライガー', 'メロンボ', 'ヒトツメオウジ', 'ツノマル', 'ギンギライガー'], p4: ['ワカクサケンザイ', 'ガーラント', 'ダークヘンガー', 'ソボロベント'], p5: ['ベニヒメソウ', 'アーマードラゴン', 'ウロコゲル', 'パー・プリン', 'ヒネクレソウ', 'ジハード', 'ムー'], p6: ['ミミニャー', 'ムラサキチュウ', 'ケルマディクス', 'ママニャー', 'コロネ', 'ベスビオス'], p7: ['ギガロン'], p8: [] };
  const DEX_ONLY = ['C-011', 'C-014', 'C-032', 'C-037', 'C-044'];
  ok(DEX_ONLY.every((no) => db.monsters[no] && db.monsters[no].dexOnly) && Object.values(db.monsters).filter((m) => m.dexOnly).length === DEX_ONLY.length, '立ち絵の無い5枚だけが「図鑑だけ」になっていない');
  ok(['C-020', 'C-044', 'C-045'].every((no) => db.monsters[no].sub === 'unknown'), '副が ??? の3枚の副が unknown でない');
  ok(E.CARD_PACKS.length === 8 && E.CARD_PACKS.every((p, i) => p.id === `p${i + 1}` && p.name === `第${i + 1}弾パック` && JSON.stringify(p.species) === JSON.stringify(PLAN[p.id])), '8弾の顔ぶれが決めた案と違う');
  const lost = [...Object.keys(db.cards), ...Object.keys(db.monsters)].filter((no) => !E.cardPackIdOf(db, no));
  ok(!lost.length, `どの弾にも入っていないカードがある: ${lost.slice(0, 8).join('・')}`);
  E.CARD_PACKS.forEach((p) => {
    const all = E.cardPackAllCards(db, p);
    const n = all.monsters.length + all.cards.length;
    // 派生25枚(2026-10-25)で、第1〜3・5弾は少し増えた。第1弾は剣士モッチー3枚(2026-10-26)で59(社長「このまま59にする」)、
    // 第2弾はパンドラ3枚(2026-10-26)で60
    ok(n >= 48 && n <= 60, `${p.name}の種類が50前後でない(${n})`);
    const hy = [...new Set(all.monsters.filter((no) => String(db.monsters[no].wave) === 'hybrid').map((no) => db.monsters[no].name))].sort();
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
    const pool = Object.values(db.cards).filter((c) => c.ready && E.cardPackIdOf(db, c.no) === pack.id).length + Object.values(db.monsters).filter((m) => m.ready !== false && !m.dexOnly && E.cardPackIdOf(db, m.no) === pack.id).length;
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
  // その場面ですぐ出せるブリーダーのカード(狙いの要る札・条件のある札・合体は見本にしない。合体は派生が増えると使える場面が変わる)
  const breederFresh = (minG, maxG) => Object.values(db.cards).filter((c) => c.ready && c.user === 'breeder' && c.guts >= minG && c.guts <= maxG && !(c.effects || []).some((e) => ['attach', 'extraAttackTarget', 'unstunTarget', 'useWhenAllies', 'heal', 'fuse'].includes(e.t)))
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
  // ---- 区切り4: 山札・手札・捨て札・ガッツを動かす ----
  const total = (pl) => pl.hand.length + pl.deck.length + pl.guts.length + pl.discard.length;
  const useSpe = (st, no, pred = () => true) => { const a = find(E.cardAttackOptions(db, st), (x) => st.players[st.active].hand[x.hand[0]] === no && pred(x)); ok(a, `${no}: 出せない`); return a ? act(st, a) : null; };
  const deckOf = (n) => Array.from({ length: n }, (_, i) => (i % 2 ? '026' : '100'));
  // 作戦の指示(022・ガリ): 捨て札から1枚を手札へ。いま使った札は選べない。捨て札が空なら出せない
  { ready('022'); const gali = monOf('gali');
    let st = scene({ mons: [[gali, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['022'], []], guts: [9, 0] });
    ok(!optWith(st, ['022']), '022: 捨て札が空なのに出せる');
    st.players[0].discard = ['109', '026'];
    st = useSpe(st, '022');
    // 候補は、いま使った札(最後に捨て札へ行く)を除く捨て札の全部(払ったガッツも先に捨て札へ行くので入る)
    if (st) { const d = st.players[0].discard; ok(st.pendingChoice && d[d.length - 1] === '022' && JSON.stringify(st.pendingChoice.cands) === JSON.stringify(d.slice(0, -1).map((_, i) => i)), `022: 候補が合わない(${JSON.stringify(st.pendingChoice && st.pendingChoice.cands)})`);
      ok(E.cardDecider(st) === 0 && E.cardLegalActions(db, st).every((x) => x.type === 'choose'), '022: 選ぶ段で、使った人が選ぶ形になっていない');
      st = act(st, { type: 'choose', pick: 0 }); ok(st.players[0].hand.includes('109') && !st.pendingChoice, '022: 選んだ札が手札に入らない');
      ok(!E.cardApplyAction(db, st, { type: 'choose', pick: 0 }), '022: 選ぶ段が終わったのに選べる'); } }
  // 回避プログラム(186・ヘンガー): その子が使える回避だけ / 悪夢(303・ジョーカー): その子が使える攻撃の札だけ
  [['186', 'henger', (c) => c.kind === 'dge'], ['303', 'joker', (c) => ['pow', 'int', 'spe'].includes(c.kind)]].forEach(([no, sp, okKind]) => {
    ready(no); const mo = monOf(sp);
    let st = scene({ mons: [[mo, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[no], []], guts: [9, 0] });
    st.players[0].discard = ['109', '026', '096', plainOf(sp, 'pow') ? plainOf(sp, 'pow').no : '100'];
    st = useSpe(st, no); if (!st) return;
    const want = st.players[0].discard.map((n2, i) => ({ i, c: db.cards[n2] })).filter(({ i, c }) => i < 4 && okKind(c) && (c.user === 'any' || c.user === sp)).map((x) => x.i);
    ok(st.pendingChoice && JSON.stringify(st.pendingChoice.cands) === JSON.stringify(want), `${no}: 候補が合わない(${JSON.stringify(st.pendingChoice && st.pendingChoice.cands)} / ${JSON.stringify(want)})`);
  });
  // 伝説のちから(137・ヒノトリ): 捨て札の1枚を山札の一番下へ
  { ready('137'); let st = scene({ mons: [[monOf('phoenix'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['137'], []], guts: [9, 0] });
    st.players[0].discard = ['109']; st = useSpe(st, '137'); if (st) { st = act(st, { type: 'choose', pick: 0 }); ok(st.players[0].deck[0] === '109', '137: 山札の一番下に戻らない'); } }
  // 最後の切札(122): 手札の1枚を山札に戻して切り、1枚引く / 素早い計算(094・ハム): 手札を1枚捨てて2枚引く
  { ready('122'); let st = scene({ hands: [['122', '109', '026'], []], guts: [9, 0] }); const n0 = total(st.players[0]);
    st = useSpe(st, '122'); if (st) { ok(JSON.stringify(st.pendingChoice.cands) === '[0,1]', '122: 手札の候補が合わない'); const d0 = st.players[0].deck.length; st = act(st, { type: 'choose', pick: 0 });
      ok(st.players[0].hand.length === 2 && st.players[0].deck.length === d0 && total(st.players[0]) === n0, '122: 戻して1枚引く形になっていない'); } }
  { ready('094'); let st = scene({ mons: [['C-008', 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['094', '109'], []], guts: [9, 0] });
    st = useSpe(st, '094'); if (st) { st = act(st, { type: 'choose', pick: 0 }); ok(st.players[0].hand.length === 2 && st.players[0].discard.includes('109'), '094: 1枚捨てて2枚引く形になっていない'); }
    const st2 = scene({ mons: [['C-008', 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['094'], []], guts: [9, 0] }); ok(!optWith(st2, ['094']), '094: ほかに手札が無いのに出せる'); }
  // 死神の力(304・ジョーカー): 相手が手札を見せる段 → こちらが選んで捨てさせる
  { ready('304'); let st = scene({ mons: [[monOf('joker'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['304'], ['109', '026']], guts: [9, 0] });
    st = useSpe(st, '304');
    if (st) { ok(st.pendingReveal && E.cardDecider(st) === 1, '304: 相手が手札を見せる段にならない');
      st = act(st, { type: 'reveal' }); ok(st.pendingChoice && E.cardDecider(st) === 0 && st.pendingChoice.cands.length === 2, '304: 見せたあと、こちらが選ぶ段にならない');
      st = act(st, { type: 'choose', pick: 1 }); ok(st.players[1].hand.join() === '109' && st.players[1].discard.includes('026'), '304: 選んだ札を捨てさせられない'); } }
  // 突進(114): そのターンの最初のカードだけ。山札の上から5枚をガッツ。そのあとは出せない
  { ready('114'); let st = scene({ hands: [['114', gol.no], []], guts: [3, 0] }); st.players[0].deck = deckOf(20);
    st = useSpe(st, '114'); if (st) { ok(st.players[0].guts.length === 3 - db.cards['114'].guts + 5, `114: ガッツが5増えない(${st.players[0].guts.length})`); ok(!E.cardAttackOptions(db, st).length, '114: 突進のあとも出せる'); }
    let st2 = scene({ hands: [[gol.no, '114'], []], guts: [9, 0] }); st2 = act(act(st2, optWith(st2, [gol.no], 0)), { type: 'pass' }); ok(!optWith(st2, ['114']), '114: 最初のカードでないのに出せる'); }
  // 後は頼んだ(125): 自分をKO。残りライフの枚数を、捨て札の新しいほうからガッツへ
  { ready('125'); let st = scene({ hands: [['125'], []], guts: [0, 0] }); st.players[0].discard = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'].map(() => '100'); st.players[0].discard.push('109'); st.players[0].mons[1].life = 4;
    st = useSpe(st, '125', (x) => x.mon === 1); if (st) { ok(st.players[0].mons[1].ko && st.players[0].guts.length === 4 && st.players[0].guts.includes('109'), `125: KO・ガッツ4(新しいほうから)にならない(${st.players[0].guts.length})`); } }
  // 戦意喪失(126): お互いのガッツが0(精神集中の相手は減らない)
  { ready('126'); let st = scene({ hands: [['126'], []], guts: [9, 4] }); st = useSpe(st, '126'); if (st) ok(st.players[0].guts.length === 0 && st.players[1].guts.length === 0, '126: お互い0にならない');
    let st2 = scene({ hands: [['126'], []], guts: [9, 4] }); st2.players[1].gutsGuardUntil = st2.turn + 3; st2 = useSpe(st2, '126'); if (st2) ok(st2.players[0].guts.length === 0 && st2.players[1].guts.length === 4, '126: 精神集中の相手まで減る'); }
  // 最後のきらめき(127): 味方1体のときだけ。山札を全部ガッツ
  { ready('127'); let st = scene({ hands: [['127'], []], guts: [9, 0] }); st.players[0].deck = deckOf(12); ok(!optWith(st, ['127']), '127: 味方3体で出せる');
    st.players[0].mons[0].ko = true; st.players[0].mons[2].ko = true; st = useSpe(st, '127'); if (st) ok(!st.players[0].deck.length && st.players[0].guts.length === 9 - db.cards['127'].guts + 12, '127: 山札が全部ガッツにならない'); }
  // ハテナマーク(149・ゲル): 相手の手札を全部、相手の山札の一番下へ。そのあと相手は4枚引く
  { ready('149'); let st = scene({ mons: [[monOf('jell'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['149'], ['109', '096', '026']], guts: [9, 0] }); st.players[1].deck = deckOf(10);
    st = useSpe(st, '149'); if (st) ok(st.players[1].hand.length === 4 && st.players[1].deck.slice(0, 3).join() === '109,096,026', '149: 一番下へ戻して4枚引く形になっていない'); }
  // 時間稼ぎ(252): ガッツを山札に戻して切る(持ち主の種で切る)
  { ready('252'); let st = scene({ hands: [['252'], []], guts: [6, 0] }); st.players[0].deck = deckOf(10); const n0 = total(st.players[0]); const r0 = st.players[0].rng;
    st = useSpe(st, '252'); if (st) ok(!st.players[0].guts.length && st.players[0].deck.length === 16 && total(st.players[0]) === n0 && st.players[0].rng !== r0, '252: ガッツが山札に戻って切られない'); }
  // 冬虫散(253): 味方1体のライフを1減らして1枚引く(ライフ1ならKO)
  { ready('253'); let st = scene({ hands: [['253'], []], guts: [9, 0] }); st.players[0].mons[2].life = 1;
    st = useSpe(st, '253', (x) => x.target && x.target.m === 2); if (st) ok(st.players[0].mons[2].ko && st.players[0].hand.length === 1, '253: ライフ1の子がKOにならない・引かない'); }
  // 泣き真似(278): 相手のガッツを1 / リフレッシュ(279): 手札を全部捨てて同じ数引く
  { ready('278'); let st = scene({ hands: [['278'], []], guts: [9, 3] }); st = useSpe(st, '278'); if (st) ok(st.players[1].guts.length === 2, '278: 相手のガッツが1減らない'); }
  { ready('279'); let st = scene({ hands: [['279', '109', '026', '096'], []], guts: [9, 0] }); st = useSpe(st, '279'); if (st) ok(st.players[0].hand.length === 3 && ['109', '026', '096'].every((x) => st.players[0].discard.includes(x)), '279: 捨てて同じ数引く形になっていない'); }
  // 大鎌(306・ジョーカー): 相手の山札を3枚捨て札に / 超大声(364・ハム): お互いの手札を全部捨てる
  { ready('306'); let st = scene({ mons: [[monOf('joker'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['306'], []], guts: [9, 0] }); const d0 = st.players[1].deck.length;
    st = useSpe(st, '306'); if (st) ok(st.players[1].deck.length === d0 - 3 && st.players[1].discard.length === 3, '306: 相手の山札が3枚捨て札にならない'); }
  { ready('364'); let st = scene({ mons: [['C-008', 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['364', '109'], ['026', '096']], guts: [9, 0] });
    st = useSpe(st, '364'); if (st) ok(!st.players[0].hand.length && !st.players[1].hand.length && st.players[1].discard.length === 2, '364: お互いの手札が全部捨てられない'); }
  // ---- 区切り5: 守りの新しい形・持ちょうを変える ----
  // 自分(0)のゴーレム(2体目)で、相手の m 体目を、技 no で狙う場面。相手の手札・ガッツ・3体を決める
  const atkScene = ({ no = gol.no, oppMons = ['C-001', 'C-003', 'C-005'], oppHand = [], oppGuts = 9, m = 0, myMons = ['C-001', 'C-003', 'C-005'] } = {}) => {
    let st = big(scene({ mons: [myMons, oppMons], hands: [[no], oppHand], guts: [9, oppGuts] }));
    const a = find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === no && (!x.target || x.target.m === m));
    if (!a) return null;
    return act(st, a);
  };
  const guardWith = (st, no, pred = () => true) => find(E.cardGuardOptions(db, st), (x) => st.players[1].hand[x.hand] === no && pred(x));
  const lifeAfter = (st, g) => { let s1 = g ? act(st, g) : st; while (s1.pending) s1 = act(s1, { type: 'pass' }); return s1; };
  // 隠れる(107・モッチー): 目標を自分から他の味方へ(守る人が選ぶ)。移した先の子はもう守れない
  { ready('107'); const st = atkScene({ oppMons: ['C-009', 'C-003', 'C-005'], oppHand: ['107', '109'] });
    ok(st, '107: 場面が作れない'); if (st) {
      const gs = E.cardGuardOptions(db, st).filter((x) => st.players[1].hand[x.hand] === '107');
      ok(gs.length === 2 && gs.every((x) => x.mon === 0 && (x.to === 1 || x.to === 2)), `107: 移す先の候補が合わない(${JSON.stringify(gs)})`);
      const s1 = act(st, gs.find((x) => x.to === 1)); ok(!E.cardGuardOptions(db, s1).length, '107: 移した先の子がまだ守れる');
      const s2 = lifeAfter(s1); ok(s2.players[1].mons[0].life === 40 && s2.players[1].mons[1].life === 40 - gol.damage, '107: ダメージが移した先に入らない');
      ok(!E.cardApplyAction(db, st, { ...gs[0], to: 0 }), '107: 自分へ移す手が通る'); } }
  // 根性(111): 残りのライフ以上のダメージでも、ライフ1で残る
  { ready('111'); const st = atkScene({ oppHand: ['111'] }); if (st) { st.players[1].mons[0].life = 3; const g = guardWith(st, '111'); ok(g, '111: 出せない');
    if (g) { const s1 = lifeAfter(st, g); ok(s1.players[1].mons[0].life === 1 && !s1.players[1].mons[0].ko, `111: ライフ1で残らない(${s1.players[1].mons[0].life})`); } } }
  // みんな下がれ(123): 全員に当たる技だけ。全員が回避
  { ready('123'); ok(areaPow, '123: 全員に当たる技の見本が無い');
    if (areaPow) { const st = atkScene({ no: areaPow.no, oppHand: ['123'] }); ok(st, '123: 場面が作れない');
      if (st) { const g = guardWith(st, '123'); ok(g, '123: 全員に当たる技に出せない');
        if (g) { const s1 = lifeAfter(st, g); const half = (areaPow.effects || []).some((e) => e.t === 'halfOnEvade'); ok(s1.players[1].mons.every((x) => x.life === 40 - (half ? Math.ceil(areaPow.damage / 2) : 0)), '123: 全員が回避にならない'); } }
      const st2 = atkScene({ oppHand: ['123'] }); if (st2) ok(!guardWith(st2, '123'), '123: 1体を狙う技にも出せる'); } }
  // 盾になる(163・モノリス): 1回の攻撃で味方が受けるダメージを、全部この子が受ける
  { ready('163'); const mono = monOf('monol');
    const st = atkScene({ oppMons: [mono, 'C-003', 'C-005'], oppHand: ['163'], m: 1 }); ok(st, '163: 場面が作れない');
    if (st) { const g = guardWith(st, '163', (x) => x.mon === 0); ok(g, '163: 盾になれない'); if (g) { const s1 = lifeAfter(st, g); ok(s1.players[1].mons[0].life === 40 - gol.damage && s1.players[1].mons[1].life === 40, '163: 盾の子が受けない'); } }
    if (areaPow) { const st2 = atkScene({ no: areaPow.no, oppMons: ['C-003', mono, 'C-005'], oppHand: ['163'] });
      if (st2) { const g = guardWith(st2, '163', (x) => x.mon === 1); ok(g, '163: 全員に当たる技で盾になれない');
        if (g) { const s1 = lifeAfter(st2, g); ok(s1.players[1].mons[1].life === 40 - areaPow.damage * 3 && s1.players[1].mons[0].life === 40 && s1.players[1].mons[2].life === 40, `163: 全員のぶんを盾の子が受けない(${s1.players[1].mons.map((x) => x.life).join(',')})`); } } } }
  // 我慢(275): ガッツ減少を無効
  { ready('275'); const gl = Object.values(db.cards).find((c) => c.ready && c.user !== 'any' && c.user !== 'breeder' && (c.kind === 'pow' || c.kind === 'int') && (c.effects || []).length === 1 && (c.effects || []).some((e) => e.t === 'gutsLossOnHit'));
    ok(gl, '275: ガッツを減らす技の見本が無い');
    if (gl) { const mo = monOf(gl.user); const st = atkScene({ no: gl.no, myMons: [mo, mo === 'C-001' ? 'C-003' : 'C-001', 'C-005'], oppHand: ['275'], oppGuts: 6 });
      ok(st, '275: 場面が作れない'); if (st) { const g = guardWith(st, '275'); ok(g, '275: 出せない'); if (g) { const s1 = lifeAfter(st, g); ok(s1.players[1].guts.length === 6 - db.cards['275'].guts, '275: ガッツが減った'); } } } }
  // 吹き上げる(270・グジラ): 狙われていなくても出せる。自分以外の味方が空中になり、空中に当たらない技は外れる
  { ready('270'); const ch = Object.values(db.cards).find((c) => c.ready && c.kind === 'pow' && (c.effects || []).length === 1 && (c.effects || []).some((e) => e.t === 'cannotHit' && e.type === 'air'));
    ok(ch, '270: 空中に当たらない技の見本が無い');
    if (ch) { const mo = monOf(ch.user); const st = atkScene({ no: ch.no, myMons: [mo, mo === 'C-001' ? 'C-003' : 'C-001', 'C-005'], oppMons: [monOf('zilla'), 'C-003', 'C-001'], oppHand: ['270'], m: 1 });
      ok(st, '270: 場面が作れない'); if (st) { const g = guardWith(st, '270', (x) => x.mon === 0); ok(g, '270: 狙われていないグジラが出せない');
        if (g) { const s1 = lifeAfter(st, g); ok(s1.players[1].mons[1].life === 40, '270: 空中になったのに当たった'); ok(E.cardMonType(s1.players[1].mons[0], s1.turn) !== 'air', '270: 自分まで空中になった'); } } } }
  // ひきずりこむ(318・アローヘッド): 味方を全員このターン水中に。地上にしか当たらない技は外れる
  { ready('318'); const oh = Object.values(db.cards).find((c) => c.ready && c.kind === 'pow' && (c.effects || []).length === 1 && (c.effects || []).some((e) => e.t === 'onlyHit' && e.type === 'ground'));
    ok(oh, '318: 地上にしか当たらない技の見本が無い');
    if (oh) { const mo = monOf(oh.user); const st = atkScene({ no: oh.no, myMons: [mo, mo === 'C-001' ? 'C-003' : 'C-001', 'C-005'], oppMons: [monOf('arrowhead'), 'C-003', 'C-001'], oppHand: ['318'], m: 1 });
      ok(st, '318: 場面が作れない'); if (st) { const g = guardWith(st, '318'); ok(g, '318: 出せない'); if (g) { const s1 = lifeAfter(st, g); ok(s1.players[1].mons[1].life === 40 && E.cardMonType(s1.players[1].mons[1], s1.turn) === 'water' && E.cardMonType(s1.players[1].mons[1], s1.turn + 1) === 'ground', '318: 水中で外れない・次のターンまで水中のまま'); } } } }
  // 肉を切らせて(249): 受けるダメージ2倍。次のターンのちから技3倍
  { ready('249'); const st = atkScene({ oppHand: ['249'] }); if (st) { const g = guardWith(st, '249'); ok(g, '249: 出せない');
    if (g) { const s1 = lifeAfter(st, g); const m0 = s1.players[1].mons[0]; ok(m0.life === 40 - gol.damage * 2 && m0.mult && m0.mult.n === 3 && m0.mult.turn === s1.turn + 1, '249: 2倍で受けて、次のちから技3倍にならない'); } } }
  // ぬいぐるみ(198・ニャー): 次の自分の番まで、どこからのダメージも0
  { ready('198'); let st = scene({ mons: [[monOf('mew'), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['198'], [gol.no]], guts: [9, 9] });
    st = useSpe(st, '198'); if (st) { const s2 = nextTurnOf(st, 1); const h = optWith(s2, [gol.no], 0); ok(h, '198: 相手が狙えない');
      if (h) { const s3 = lifeAfter(act(s2, h)); ok(s3.players[0].mons[0].life === s3.players[0].mons[0].max, '198: ダメージを受けた'); } } }
  // 変形(185・ヘンガー)・トランスフォーム(293・メタルナー): 空中か地上かを選ぶ。1枚引く
  [['185', 'henger'], ['293', 'metalner']].forEach(([no, sp]) => {
    ready(no); const st = scene({ mons: [[monOf(sp), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[no], []], guts: [9, 0] });
    const os = E.cardAttackOptions(db, st).filter((x) => st.players[0].hand[x.hand[0]] === no);
    ok(os.length === 2 && os.some((x) => x.form === 'air') && os.some((x) => x.form === 'ground'), `${no}: 空中・地上の2つの手にならない`);
    const a = os.find((x) => x.form === (db.monsters[monOf(sp)].type === 'air' ? 'ground' : 'air'));
    if (a) { const s1 = act(st, a); ok(s1.players[0].mons[0].type === a.form && s1.players[0].hand.length === 1, `${no}: 持ちょうが変わらない・引かない`); }
    ok(!E.cardApplyAction(db, st, { ...os[0], form: 'water' }), `${no}: 空中・地上のほかを選べる`);
  });
  // ---- 区切り6: 同時に2枚・ダメージの数え方が変わる技 ----
  const meScene = (sp, hand, guts = 20) => big(scene({ mons: [[monOf(sp), 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [hand, []], guts: [guts, 0] }));
  const hitWith = (st, nos, m = 0) => { const a = optWith(st, nos, m); ok(a, `${nos.join('+')}: 出せない`); return a ? hitOnce(st, a) : null; };
  // キック(178・ヘンガー)・しっぽキック(214・ワーム): 1枚ならふつう、2枚同時なら10・12
  [['178', 'henger', 10], ['214', 'worm', 12]].forEach(([no, sp, two]) => {
    ready(no); const r1 = hitWith(meScene(sp, [no]), [no]); if (r1) ok(r1.dmg[0] === db.cards[no].damage, `${no}: 1枚のダメージが違う`);
    const r2 = hitWith(meScene(sp, [no, no]), [no, no]); if (r2) ok(r2.dmg[0] === two, `${no}: 2枚同時で${two}にならない(${r2 && r2.dmg[0]})`);
  });
  // 右掌(285)・左掌(286・メタルナー): 2種類なら4
  { ready('285'); ready('286'); const r = hitWith(meScene('metalner', ['285', '286']), ['285', '286']); if (r) ok(r.dmg[0] === 4, '285/286: 2種類で4にならない'); }
  // コンビネーション(227・ドラゴン): しっぽアタック・かみつきが手札に1枚ずつあるときだけ。払うのは4だけ・相手全員に8
  { ready('227'); const tail = Object.values(db.cards).find((c) => c.user === 'dragon' && c.name === 'しっぽアタック'); const bite = Object.values(db.cards).find((c) => c.user === 'dragon' && c.name === 'かみつき');
    ok(tail && bite, '227: しっぽアタック・かみつきが無い');
    if (tail && bite) {
      ok(!optWith(meScene('dragon', ['227', tail.no]), ['227', tail.no]), '227: かみつきが無いのに出せる');
      const st = meScene('dragon', ['227', tail.no, bite.no], 4);
      const a = find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '227'); ok(a && a.hand.length === 3, '227: 3枚一緒の手にならない(ガッツ4で)');
      if (a) { let s1 = act(st, a); ok(!s1.players[0].guts.length, '227: 払ったガッツが4でない'); while (s1.pending) s1 = act(s1, { type: 'pass' }); ok(s1.players[1].mons.every((m) => m.life === 40 - 8), '227: 相手全員に8にならない'); } } }
  // ポン拳(288・メタルナー): ダメージを与えたら手札へ戻る
  { ready('288'); const r = hitWith(meScene('metalner', ['288']), ['288']); if (r) ok(r.st.players[0].hand.includes('288') && !r.st.players[0].discard.includes('288'), '288: 手札へ戻らない'); }
  // ショットガン(340・コロペンドラ / 054・ピクシー): 1点ずつ割り振る(1体に全部もできる)
  [['340', 'colorpandora'], ['054', 'pixie']].forEach(([no, sp]) => {
    ready(no); const st = meScene(sp, [no]); const n = db.cards[no].damage;
    const os = E.cardAttackOptions(db, st).filter((x) => st.players[0].hand[x.hand[0]] === no && x.mon === 0);
    ok(os.length && os.every((x) => Array.isArray(x.split) && x.split.reduce((a, b) => a + b, 0) === n) && os.some((x) => x.split.filter(Boolean).length === 1), `${no}: 割り振りの手が合わない(${os.length})`);
    const a = os.find((x) => x.split.filter(Boolean).length >= 2);
    if (a) { let s1 = act(st, a); while (s1.pending) s1 = act(s1, { type: 'pass' }); ok(s1.players[1].mons.every((m, j) => m.life === 40 - a.split[j]), `${no}: 割り振ったとおりに入らない`); }
    ok(!E.cardApplyAction(db, st, { ...os[0], split: [n + 1, 0, 0] }), `${no}: 割り振りの合計が違う手が通る`);
  });
  // 魔神ファイナル(358・ガリ): 回避されない。捨て札のガリの攻撃の技の枚数を足す
  { ready('358'); const st = meScene('gali', ['358']); const ga = Object.values(db.cards).filter((c) => c.ready && c.user === 'gali' && ['pow', 'int'].includes(c.kind)).slice(0, 2).map((c) => c.no);
    st.players[0].discard = [...ga, '109']; st.players[1].hand = ['109']; st.players[1].guts = Array(5).fill('100');
    const a = optWith(st, ['358'], 0); if (a) { let s1 = act(st, a); ok(!E.cardGuardOptions(db, s1).some((x) => s1.players[1].hand[x.hand] === '109'), '358: 回避できてしまう'); s1 = act(s1, { type: 'pass' }); ok(40 - s1.players[1].mons[0].life === (db.cards['358'].damage || 0) + ga.length, '358: 捨て札のガリの技の数が足されない'); } }
  // ビッグバン(361・ピクシー): 回避されない。減ったライフのぶんを足す
  { ready('361'); const st = meScene('pixie', ['361']); st.players[0].mons[0].life = st.players[0].mons[0].max - 2;
    const r = hitWith(st, ['361']); if (r) ok(r.dmg[0] === db.cards['361'].damage + 2, '361: 減ったライフのぶんが足されない'); }
  // ものまね(150・ゲル): どの種族のちから技でも、ものまねを付ければゲルが出せる
  { ready('150'); const st = meScene('jell', [gol.no, '150']);
    const a = find(E.cardAttackOptions(db, st), (x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === gol.no);
    ok(a && a.hand.some((i) => st.players[0].hand[i] === '150'), '150: ゲルがゴーレムの技を出せない');
    ok(!find(E.cardAttackOptions(db, st), (x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === gol.no && x.hand.length === 1), '150: ものまねを付けずに出せてしまう'); }
  // ---- 区切り7: モンスターが入れ替わる ----
  // ヒノトリの復活(128): 倒れたヒノトリをライフ4で戻す。そのターンは攻撃できない
  { ready('128'); const ph = monOf('phoenix'); let st = scene({ mons: [[ph, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['128', plainOf('phoenix', 'pow') ? plainOf('phoenix', 'pow').no : gol.no], []], guts: [9, 0] });
    ok(!find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '128'), '128: ヒノトリが倒れていないのに出せる');
    st.players[0].mons[0].ko = true; st.players[0].mons[0].life = 0;
    const a = find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '128' && x.target && x.target.m === 0); ok(a, '128: 倒れたヒノトリを選べない');
    if (a) { st = act(st, a); const m = st.players[0].mons[0]; ok(!m.ko && m.life === 4, '128: ライフ4で戻らない'); ok(!find(E.cardAttackOptions(db, st), (x) => x.mon === 0), '128: 戻ったヒノトリがそのターン攻撃できる'); } }
  // まゆ化(221)・羽化(222・ワーム): まゆ化した子は羽化のほかを出せない。羽化でムラサキチュウ(C-062)になり、ライフは最大
  { ready('221'); ready('222'); const wo = monOf('worm'); const wp = plainOf('worm', 'pow');
    let st = scene({ mons: [[wo, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['221', '222', wp.no], []], guts: [9, 0] });
    ok(!find(E.cardAttackOptions(db, st), (x) => st.players[0].hand[x.hand[0]] === '222'), '222: まゆ化の前に羽化を出せる');
    st = act(st, optWith(st, ['221']));
    const s2 = nextTurnOf(st, 0); s2.turn += 1;
    ok(!optWith(s2, [wp.no], 0), '221: まゆ化した子が技を出せる');
    const e = optWith(s2, ['222']); ok(e, '222: まゆ化した子が羽化を出せない');
    if (e) { const s3 = act(s2, e); const m = s3.players[0].mons[0]; ok(m.no === 'C-062' && m.life === db.monsters['C-062'].life && m.max === m.life && !m.cocoon, `222: ムラサキチュウ(最大ライフ)にならない(${m.no} ${m.life})`); } }
  // 合体(352): 味方2体をKO。メインとサブが合う混血を、メインを出した子の場所に出す(そのターンは攻撃できない)
  { ready('352'); const hy = db.monsters['C-051']; const ma = monOf(hy.main), sb = monOf(hy.sub);
    let st = scene({ mons: [[ma, sb, 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['352'], []], guts: [9, 0] });
    const os = E.cardAttackOptions(db, st).filter((x) => x.type === 'breeder' && x.fuse);
    ok(os.some((x) => x.fuse.a === 0 && x.fuse.b === 1 && x.fuse.no === 'C-051'), `352: 合体の手が出ない(${JSON.stringify(os.map((x) => x.fuse))})`);
    const a = os.find((x) => x.fuse.a === 0 && x.fuse.b === 1);
    if (a) { st = act(st, a); const m0 = st.players[0].mons[0], m1 = st.players[0].mons[1];
      ok(m0.no === 'C-051' && !m0.ko && m0.life === hy.life && m1.ko, '352: 混血が出ない・もう1体がKOにならない');
      ok(!find(E.cardAttackOptions(db, st), (x) => x.mon === 0), '352: 出た子がそのターン攻撃できる'); ok(st.winner === null, '352: 合体で負けになった'); }
    ok(!E.cardApplyAction(db, scene({ mons: [[ma, sb, 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [['352'], []], guts: [9, 0] }), { ...(a || {}), fuse: { a: 0, b: 1, no: 'C-062' } }), '352: 合わない混血を出せる'); }
  // 太古の記憶(348): 混血の子の、サブの種族の特殊技に付けて出せる
  { ready('348'); const hy = Object.values(db.monsters).find((m) => m.main && Object.values(db.cards).some((c) => c.ready && c.user === m.sub && c.kind === 'spe' && c.guts <= 3 && !(c.effects || []).some((e) => ['attach', 'choose', 'peekPick', 'useWhenAllies', 'emerge', 'cocoon'].includes(e.t)) && !(c.effects || []).some((e) => ['extraAttackTarget', 'unstunTarget', 'stunTarget', 'liftTarget', 'heal', 'selfHurt', 'revive'].includes(e.t))));
    const sp = Object.values(db.cards).find((c) => c.ready && c.user === hy.sub && c.kind === 'spe' && c.guts <= 3 && !(c.effects || []).some((e) => ['attach', 'choose', 'peekPick', 'useWhenAllies', 'emerge', 'cocoon', 'extraAttackTarget', 'unstunTarget', 'stunTarget', 'liftTarget', 'heal', 'selfHurt', 'revive'].includes(e.t)));
    ok(hy && sp, '348: 見本が無い');
    if (hy && sp) { const st = scene({ mons: [[hy.no, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']], hands: [[sp.no, '348'], []], guts: [9, 0] });
      ok(!find(E.cardAttackOptions(db, st), (x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === sp.no && x.hand.length === 1), '348: 太古の記憶なしでサブの特殊技が出せる');
      ok(find(E.cardAttackOptions(db, st), (x) => x.mon === 0 && st.players[0].hand[x.hand[0]] === sp.no && x.hand.length === 2), `348: 太古の記憶を付けてサブの特殊技(${sp.name})が出せない`); } }
  // ---- 全体カード(2026-10-25): 場に1枚だけ・両方に効く・入れ替え・おいのり ----
  {
    const F = (no) => { ready(no); return db.cards[no]; };
    const fieldScene = (hand0, hand1 = [], g = [9, 9], mons = [['C-003', 'C-001', 'C-005'], ['C-001', 'C-003', 'C-005']]) => big(scene({ mons, hands: [hand0, hand1], guts: g }));
    // 全体カードを出す。相手に手札があるとおいのりの窓が開くので、ふだんは「使わない」で閉じる(keep で開いたまま返す)
    const place = (st, no, keep = false) => { const a = find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder' && st.players[st.active].hand[x.hand[0]] === no); ok(a, `${no}: 全体カードを出せない`); const s1 = a ? act(st, a) : st; return s1.pendingPray && !keep ? act(s1, { type: 'pray' }) : s1; };
    // 置く・ブリーダーの札は1ターン1枚・入れ替えると前のものは出した人の捨て札へ
    { F('F116'); F('F261'); let st = fieldScene(['F116', 'F261']);
      st = place(st, 'F116'); ok(st.field && st.field.no === 'F116' && st.field.p === 0 && !st.players[0].discard.includes('F116'), 'F116: 場に置かれない・捨て札へ行った');
      ok(!find(E.cardAttackOptions(db, st), (x) => x.type === 'breeder'), '全体カード: 1ターンに2枚出せる(ブリーダーの札は1枚まで)');
      let s2 = nextTurnOf(st, 1); s2.players[1].hand = ['F261']; s2 = place(s2, 'F261');
      ok(s2.field.no === 'F261' && s2.players[0].discard.includes('F116'), '全体カード: 入れ替えたとき、前のものが出した人の捨て札へ行かない'); }
    // 壮絶な戦い(ちから・かしこさ +1)・興奮のるつぼ(かしこさ -2)・飛び散る火花(かしこさ +1)
    { let st = place(fieldScene(['F116', gol.no]), 'F116'); const r = hitOnce(st, optWith(st, [gol.no], 0)); ok(r.dmg[0] === gol.damage + 1, `F116: ちから技のダメージが+1にならない(${r.dmg[0]})`); }
    { const it = Object.values(db.cards).filter((c) => c.ready && c.kind === 'int' && monOf(c.user) && !(c.effects || []).length && c.damage >= 3 && c.guts <= 3).sort((a, b) => (a.no < b.no ? -1 : 1))[0];
      ok(it, 'F117: 文の無いかしこさ技の見本が無い');
      const itMons = it ? [[monOf(it.user), ...['C-001', 'C-005', 'C-003'].filter((x) => x !== monOf(it.user))].slice(0, 3), ['C-001', 'C-003', 'C-005']] : null;
      if (it) { F('F117'); let st = place(fieldScene(['F117', it.no], [], [9, 9], itMons), 'F117'); const a = optWith(st, [it.no], 0); ok(a, 'F117: かしこさ技を出せない');
        if (a) { const r = hitOnce(st, a); ok(r.dmg[0] === it.damage - 2, `F117: かしこさ技が-2にならない(${r.dmg[0]})`); }
        let s3 = place(fieldScene(['F261', it.no], [], [9, 9], itMons), 'F261'); const r3 = hitOnce(s3, optWith(s3, [it.no], 0)); ok(r3.dmg[0] === it.damage + 1, 'F261: かしこさ技が+1にならない'); } }
    // ホリィの声援(-1)・師匠のまなざし(+1): 払うガッツ
    { F('F118'); F('F256'); let st = place(fieldScene(['F118', gol.no], [], [3 + gol.guts - 1, 0]), 'F118');
      ok(st.players[0].guts.length === gol.guts - 1 && optWith(st, [gol.no], 0), 'F118: 1少ないガッツで技が出せない');
      let s2 = place(fieldScene(['F256', gol.no], [], [3 + gol.guts, 0]), 'F256');
      ok(s2.players[0].guts.length === gol.guts && !optWith(s2, [gol.no], 0), 'F256: 1多いガッツが要らない'); }
    // 必殺技の応酬(最終的なダメージ3以下は出せない)・必殺技の封印(4以上は出せない)
    { F('F119'); F('F258'); const plain = (c) => c.ready && c.kind === 'pow' && monOf(c.user) && !(c.effects || []).length && c.guts <= 4;
      const sp = Object.keys(Object.fromEntries(Object.values(db.cards).filter(plain).map((c) => [c.user, 1]))).sort().find((u) => Object.values(db.cards).some((c) => plain(c) && c.user === u && c.damage <= 3) && Object.values(db.cards).some((c) => plain(c) && c.user === u && c.damage >= 4));
      const lo = sp && Object.values(db.cards).find((c) => plain(c) && c.user === sp && c.damage <= 3);
      const hi = sp && Object.values(db.cards).find((c) => plain(c) && c.user === sp && c.damage >= 4);
      ok(lo && hi, 'F119/F258: 見本の技が無い');
      const ms = sp ? [[monOf(sp), ...['C-001', 'C-005', 'C-003'].filter((x) => x !== monOf(sp))].slice(0, 3), ['C-001', 'C-003', 'C-005']] : null;
      if (lo && hi) {
        let st = place(fieldScene(['F119', lo.no, hi.no], [], [12, 9], ms), 'F119'); ok(!optWith(st, [lo.no], 0) && optWith(st, [hi.no], 0), 'F119: ダメージ3以下が出せる・4以上が出せない');
        let s2 = place(fieldScene(['F258', lo.no, hi.no], [], [12, 9], ms), 'F258'); ok(optWith(s2, [lo.no], 0) && !optWith(s2, [hi.no], 0), 'F258: ダメージ4以上が出せる・3以下が出せない'); } }
    // 大混乱: 次の番のドローの前に、その番の人の山札の上から2枚を捨てる
    { F('F120'); let st = place(fieldScene(['F120']), 'F120'); const d0 = st.players[1].deck.length, x0 = st.players[1].discard.length;
      st = act(act(st, { type: 'endAttacks' }), { type: 'guts', hand: [] });
      ok(st.players[1].discard.length === x0 + 2 && st.players[1].deck.length === d0 - 2 - (5 - 0), `F120: 山札の上から2枚を捨てない(${st.players[1].discard.length - x0})`); }
    // 純血のプライド: 純血の子の攻撃に、派生の子は回避を出せない(防御は出せる)
    { F('F255'); const hy = 'C-010'; let st = fieldScene(['F255', gol.no], ['109', '111'], [9, 9], [['C-003', 'C-001', 'C-005'], [hy, 'C-003', 'C-005']]);
      const before = act(st, optWith(st, [gol.no], 0)); ok(E.cardGuardOptions(db, before).some((x) => before.players[1].hand[x.hand] === '109'), 'F255: 見本の場面で回避が出せない');
      st = place(st, 'F255'); const s2 = act(st, optWith(st, [gol.no], 0));
      ok(!E.cardGuardOptions(db, s2).some((x) => s2.players[1].hand[x.hand] === '109') && E.cardGuardOptions(db, s2).some((x) => s2.players[1].hand[x.hand] === '111'), 'F255: 派生の子が回避を出せる・防御まで止まる'); }
    // がんじがらめ: モンスターの特殊技は出せない
    { F('F257'); const sp = Object.values(db.cards).find((c) => c.ready && c.user === 'golem' && c.kind === 'spe');
      if (sp) { const st0 = fieldScene(['F257', sp.no]); const had = E.cardAttackOptions(db, st0).some((x) => x.mon >= 0 && st0.players[0].hand[x.hand[0]] === sp.no);
        const st = place(st0, 'F257'); ok(!had || !E.cardAttackOptions(db, st).some((x) => x.mon >= 0 && st.players[0].hand[x.hand[0]] === sp.no), 'F257: モンスターの特殊技が出せる'); } }
    // 悪天候・空間のひずみ: 全員の持ちょうが変わる。場から無くなると元に戻る
    { F('F259'); F('F262'); const pix = monOf('pixie'); let st = fieldScene(['F259'], [], [9, 9], [[pix, 'C-003', 'C-005'], ['C-001', 'C-003', 'C-005']]);
      st = place(st, 'F259'); ok(st.players.every((pl) => pl.mons.every((m) => E.cardMonType(m, st.turn) === 'ground')), 'F259: 全員が地上にならない');
      let s2 = nextTurnOf(st, 1); s2.players[1].hand = ['F262']; s2 = place(s2, 'F262'); ok(s2.players.every((pl) => pl.mons.every((m) => E.cardMonType(m, s2.turn) === 'air')), 'F262: 全員が空中にならない');
      let s3 = nextTurnOf(s2, 0); s3.players[0].hand = ['F116']; s3 = place(s3, 'F116');
      ok(E.cardMonType(s3.players[0].mons[0], s3.turn) === 'air' && E.cardMonType(s3.players[0].mons[1], s3.turn) === db.monsters['C-003'].type, 'F262: 場から無くなっても、本来の持ちょうに戻らない'); }
    // 灼熱の地: 攻撃を終えたとき、攻撃した側の全員に1ダメージ
    { F('F260'); let st = place(fieldScene(['F260']), 'F260'); const l0 = st.players[0].mons.map((m) => m.life);
      st = act(st, { type: 'endAttacks' }); ok(st.players[0].mons.every((m, i) => m.life === l0[i] - 1) && st.players[1].mons.every((m) => m.life === 40), 'F260: 攻撃した側の全員に1ダメージにならない'); }
    // 長期戦の予感: ガッツの段で2枚まで
    { F('F263'); let st = place(fieldScene(['F263', '100', '100', '100']), 'F263'); st = act(st, { type: 'endAttacks' });
      ok(!E.cardApplyAction(db, st, { type: 'guts', hand: [0, 1, 2] }) && E.cardApplyAction(db, st, { type: 'guts', hand: [0, 1] }), 'F263: 3枚ガッツにできる・2枚にできない'); }
    // 冷静な判断: 出した時に1枚引く
    { F('F115'); const st0 = fieldScene(['F115']); const st = place(st0, 'F115'); ok(st.players[0].hand.length === 1 && st.players[0].deck.length === st0.players[0].deck.length - 1, 'F115: 1枚引かない'); }
    // おいのり: 相手が全体カードを出した瞬間に出せる。その全体カードは効かずに捨て札へ・前から場にあったものはそのまま
    { ready('280'); let st = place(fieldScene(['F261']), 'F261');
      let s2 = nextTurnOf(st, 1); s2.players[1].hand = ['F116']; s2.players[0].hand = ['280', '100'];
      s2 = place(s2, 'F116', true); ok(s2.pendingPray && s2.pendingPray.p === 0 && E.cardDecider(s2) === 0, '280: 相手が全体カードを出したのに、おいのりの窓が開かない');
      const use = E.cardLegalActions(db, s2).find((x) => x.type === 'pray' && x.hand); ok(use, '280: おいのりを出す手が無い');
      if (use) { const s3 = act(s2, use); ok(s3.field && s3.field.no === 'F261' && s3.players[1].discard.includes('F116') && s3.players[0].discard.includes('280') && !s3.pendingPray, '280: 出した全体カードが捨て札へ行かない・前の全体カードが消えた'); }
      const s4 = act(s2, { type: 'pray' }); ok(s4.field.no === 'F116' && s4.players[0].discard.includes('F261'), '280: 使わないとき、全体カードが入れ替わらない');
      // おいのりを持っていない(手札が無い)ときは窓を開かない・助手もおいのりを使う
      let s5 = nextTurnOf(st, 1); s5.players[1].hand = ['F116']; s5.players[0].hand = []; s5 = place(s5, 'F116'); ok(!s5.pendingPray && s5.field.no === 'F116', '280: 手札が無いのに窓が開く');
      ok(E.cardAiChooseAction(db, s2, E.cardAiPolicy('kyuko', 'master'), () => 0.5).hand, '280: 助手がおいのりを使わない'); }
  }
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

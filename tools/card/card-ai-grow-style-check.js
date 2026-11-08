// MFバトルカード: 育つ助手の型(2026-11-08 社長「助手の相談の答えで、助手と対戦のデッキの中身が変わる。強さの段・ごほうびは同じ」・カード部ルールくん)。ブラウザなしで見る。
//
//   node tools/card/card-ai-grow-style-check.js [--verbose]
//
// 見るもの
//   A. 'normal'・型なし(null)・知らない値は、今のデッキとまったく同じ(8人×5段×種20通り)。えるびんは型なしなら今どおり毎試合ランダム
//   B. 'attack'・'guard' で中身が変わる。えるびんは型が今の組み方に当たる(attack=blade・guard=shield・normal=mind。HARD から型の札が入る)
//   C. どの型のデッキも、デッキの決まり(50枚・同じカード3枚まで・使える札)を守る
//   D. 型ごとの強さ: 強さの段ごとの勝率(プレイヤー役=スターター3つ)が、'normal' から 18点より大きく外れない(試合数が少ないので幅を取る。くわしい数は docs/progress/card-grow-style/README.md)(種を決めて測るので毎回同じ数)
//   E. 読むだけの口 cardAssistantDeckPreview(who, styleId, level): 毎回同じ並び・3体と50枚・知らない型は normal・助手でない id は null
//   F. 型を渡すのは 84 の助手と対戦だけ(杯・みんなのデッキは渡さない)。82 から助手ライフの口を読まない。口は呼ぶ時に typeof で確かめる
//   G. 対戦の記録: 助手と対戦の記録に型を残す。古い記録(型なし)・知らない値は 'normal' として読む。マルチの記録には付けない
//   I. 方針の上書き(opts.plan・AI が決める): 幅の外は丸める・候補外(無い番号・場のカードでない名前)は捨てる・全部捨てたら上書きしない・方針の札と場のカードが入る
//   J. 方針の幅の強さ: くせを全部下の端・全部上の端にして、候補から種でえらんだ prefer・field で組むと、EXPERT・MASTER の8人の平均の差が ±10点以内(くわしい数は README)
//   H. サーバの杯の写し(supabase/functions/card-tournament-run/game.js)が、いまの 82 から作り直してある
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/93-card-replay.jsx').split('// ---- 保存(端末の中だけ)')[0]}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_AI_DECKS, CARD_AI_STYLE_IDS, CARD_AI_STYLE_VARIANT, cardAiBuildDeck, cardAiSeededRand, cardAiStyleOf, cardAssistantDeckPreview, cardDeckProblems, cardSimulate, cardAiPolicy, cardReplayNormalizeOne, cardReplayStyleOf, cardAiPlanClean, CARD_AI_PLAN_RANGE, cardAiPlanHabitRange, cardAiDeckHabit, cardAiPlanCandidates };', ctx);
const E = ctx.E;
const db = E.CARD_BATTLE_DATA;
const VERBOSE = process.argv.includes('--verbose');
let passed = 0;
const fails = [];
const check = (name, ok, detail = '') => { if (ok) { passed++; if (VERBOSE) console.log(`OK: ${name}`); } else fails.push(`${name}${detail ? ` — ${detail}` : ''}`); };
const J = (x) => JSON.stringify(x);
const WHO = Object.keys(E.CARD_AI_HABITS);
const LV = ['easy', 'normal', 'hard', 'expert', 'master'];
const build = (w, lv, g, style) => E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`${w}:${lv}:${g}`), style === undefined ? {} : { style });

check('型は3つ(attack・guard・normal)', J(E.CARD_AI_STYLE_IDS) === J(['attack', 'guard', 'normal']));
check('助手は8人', WHO.length === 8, WHO.join(','));
// ---- A ----
{
  const bad = [];
  for (const w of WHO) for (const lv of LV) for (let g = 0; g < 20; g++) {
    const base = J(build(w, lv, g));
    const list = w === 'erubin' ? [null, 'zzz', 0] : ['normal', null, 'zzz', 0];
    for (const st of list) if (J(build(w, lv, g, st)) !== base) bad.push(`${w}:${lv}:${g}:${st}`);
  }
  check('A ふつう・型なし・知らない値は今のデッキとまったく同じ', bad.length === 0, bad.slice(0, 5).join(' '));
}
// ---- B ----
{
  for (const w of WHO.filter((x) => x !== 'erubin')) for (const st of ['attack', 'guard']) {
    let changed = 0;
    for (const lv of LV) for (let g = 0; g < 4; g++) if (J(build(w, lv, g, st)) !== J(build(w, lv, g))) changed++;
    check(`B ${w} の ${st} で中身が変わる`, changed >= 10, `${changed}/20`); // ドラの守りは、もとから守りの助手なので変わり方が小さい
  }
  const vars = E.CARD_AI_DECKS.erubin.variants;
  for (const [st, vid] of Object.entries(E.CARD_AI_STYLE_VARIANT)) {
    const v = vars.find((x) => x.id === vid);
    check(`B えるびんの ${st} は ${vid}`, !!v);
    if (!v) continue;
    const names = new Set(build('erubin', 'master', 1, st).cards.map((no) => db.cards[no].name));
    const hit = v.prefer.filter((n) => names.has(n));
    check(`B えるびんの ${st}(MASTER)に ${vid} の型の札が入る`, hit.length >= 2, `${hit.join('・')} / ${v.prefer.join('・')}`);
  }
}
// ---- C ----
{
  const bad = [];
  for (const w of WHO) for (const lv of LV) for (const st of E.CARD_AI_STYLE_IDS) for (let g = 0; g < 3; g++) {
    const d = build(w, lv, g, st);
    const p = E.cardDeckProblems(db, d);
    if (d.cards.length !== 50 || d.monsters.length !== 3 || p.length) bad.push(`${w}:${lv}:${st} ${d.cards.length}枚 ${p.join('・')}`);
  }
  check('C どの型もデッキの決まりを守る', bad.length === 0, bad.slice(0, 4).join(' / '));
}
// ---- D ----
{
  const games = 12;
  const kits = Object.keys(db.starters);
  const rate = (w, lv, st) => {
    let win = 0, n = 0, seed = 1;
    for (const k of kits) for (let g = 0; g < games; g++) {
      const mine = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(`${w}:${lv}:${k}:${g}`), { playerDeck: E.cardAiBuildDeck(db, k), style: st });
      const s = E.cardSimulate(db, { decks: [mine, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!mine.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 7000 + seed++, first: g % 2 });
      if (s.winner === 0) win++;
      n++;
    }
    return win / n * 100;
  };
  const far = [];
  const rows = [];
  // 1つのます目(36試合)ではぶれが大きいので、助手ごとに5段をならした差で見る(段ごとのくわしい数は README・1組120試合)
  for (const w of WHO) {
    let da = 0, dg = 0;
    for (const lv of LV) { const n = rate(w, lv, 'normal'); da += rate(w, lv, 'attack') - n; dg += rate(w, lv, 'guard') - n; }
    da /= LV.length; dg /= LV.length;
    rows.push(`${w} 攻め ${da.toFixed(1)} / 守り ${dg.toFixed(1)}`);
    if (Math.abs(da) > 15) far.push(`${w} 攻め ${da.toFixed(0)}点`);
    if (Math.abs(dg) > 15) far.push(`${w} 守り ${dg.toFixed(0)}点`);
  }
  if (VERBOSE) console.log(rows.join('\n'));
  check('D 型ごとの勝率が、ふつうから大きく外れない(助手ごとに5段をならした差が ±15点以内・スターター3つ×12戦。12戦ではならしても ±5点ほどぶれるので3倍の幅)', far.length === 0, `${far.join(' / ')} | ${rows.join(' / ')}`);
}
// ---- E ----
{
  const p1 = E.cardAssistantDeckPreview('kiki', 'attack', 'normal');
  const p2 = E.cardAssistantDeckPreview('kiki', 'attack', 'normal');
  check('E プレビューは毎回同じ並び', !!p1 && J(p1) === J(p2), J(p1 && p1.monsters));
  check('E 3体と50枚・型の id・名前(社長の8つ)・ひとこと(いまは null)を返す', !!p1 && p1.monsters.length === 3 && p1.cards.length === 50 && p1.styleId === 'attack' && p1.name === 'ずっしり火力・攻め' && p1.line === null, J(p1 && { name: p1.name, line: p1.line }));
  check('E 8人とも名前がある・既定の名前は型を添える(攻め「・攻め」守り「・守り」ふつうは名前だけ)', WHO.every((w) => typeof E.cardAssistantDeckPreview(w, 'normal').name === 'string') && E.cardAssistantDeckPreview('kiki', 'guard').name === 'ずっしり火力・守り' && E.cardAssistantDeckPreview('kiki', 'normal').name === 'ずっしり火力');
  const pz = E.cardAssistantDeckPreview('kiki', 'zzz');
  const pn = E.cardAssistantDeckPreview('kiki', 'normal');
  check('E 知らない型は normal', !!pz && pz.styleId === 'normal' && J(pz.cards) === J(pn.cards));
  check('E 助手でない id は null', E.cardAssistantDeckPreview('nobody', 'attack') === null);
  check('E 型で並びが変わる(攻め と 守り)', J(E.cardAssistantDeckPreview('mua', 'attack', 'normal').cards) !== J(E.cardAssistantDeckPreview('mua', 'guard', 'normal').cards));
}
// ---- F ----
{
  const s82 = src('src/parts/82-card-battle-core.jsx');
  const s84 = src('src/parts/84-screen-card-battle.jsx');
  check('F 82 から助手ライフの口を読まない', !/assistantLife\w*\s*\(/.test(s82));
  check('F 84: 助手と対戦だけで3つのデッキから選ぶ(みんなのデッキ・杯は選ばない)・印が真のときだけ', /const aiPick = !share && !\(opts && opts\.cup\) && cardGrowStyleOn\(\) && typeof cardAssistantDeckPick === 'function' \? cardAssistantDeckPick\(pick\.who, Math\.random, pick\.level, \{ playerDeck: activeDeck \}, typeof cardAiDeckNextStyle === 'function' \? cardAiDeckNextStyle\(pick\.who\) : null\) : null;/.test(s84));
  check('F 84: 選んだデッキで戦い、選ばないときは今の組み方', /: aiPick \? aiPick\.deck : cardAiBuildDeck\(db, pick\.who, pick\.level, Math\.random, \{ playerDeck: activeDeck \}\);/.test(s84));
  {
    const a = s84.indexOf('const cardGrowStyleOn = ');
    const code = a >= 0 ? s84.slice(a, s84.indexOf('\n', a) + 1) : '';
    const run = (flags) => { const c = vm.createContext({ RELEASE_FLAGS: flags }); vm.runInContext(`${code}\nthis.R = cardGrowStyleOn();`, c); return c.R; };
    check('F 印を読む口: 真のときだけ真(無い・偽・真でない値は偽)', !!code && run({ cardGrowStyle: true }) === true && run({ cardGrowStyle: false }) === false && run({}) === false && run({ cardGrowStyle: 'yes' }) === false);
    const s17 = src('src/parts/17-release-changelog-login-missions.jsx');
    check('F 公開の印 cardGrowStyle は真(2026-11-08 社長「この文で公開」)', /\n  cardGrowStyle: true,/.test(s17));
  }
  const s83 = src('src/parts/83-card-ai-deck.jsx');
  check('F 83: 助手ライフの口は呼ぶ時に typeof で確かめ、知らない値は型なし', /typeof assistantLifeCardStyle === 'function' \? cardAiStyleOf\(assistantLifeCardStyle\(who\)\) : null/.test(s83));
}
// ---- G ----
{
  const base = { v: 1, id: 'c123', kind: 'cpu', at: 1, rules: 1, first: 0, names: ['あなた', 'きき'], decks: [{ monsters: ['C-001', 'C-002', 'C-003'], cards: ['100'] }, { monsters: ['C-001', 'C-002', 'C-003'], cards: ['100'] }], seeds: [1, 0], acts: [], outcome: 'win', reason: '' };
  const old = E.cardReplayNormalizeOne({ ...base, foe: { name: 'きき', who: 'kiki' } });
  const gd = E.cardReplayNormalizeOne({ ...base, foe: { name: 'きき', who: 'kiki', style: 'guard' } });
  const bad = E.cardReplayNormalizeOne({ ...base, foe: { name: 'きき', who: 'kiki', style: 'mega' } });
  const pvp = E.cardReplayNormalizeOne({ ...base, kind: 'pvp', foe: { name: 'あいて' } });
  check('G 古い記録(型なし)は normal として読む', !!old && old.foe.style === 'normal', J(old && old.foe));
  check('G 型を残した記録はその型', !!gd && gd.foe.style === 'guard');
  check('G 知らない値は normal', !!bad && bad.foe.style === 'normal');
  check('G マルチの記録には型を付けない', !!pvp && !('style' in pvp.foe));
  const s84 = src('src/parts/84-screen-card-battle.jsx');
  check('G 84: 助手と対戦の記録に使った型を残す', /style: foeStyle \|\| 'normal'/.test(s84) && /deckName: log\.deckName, style: log\.style, styleName: log\.styleName \}/.test(s84));
}
// ---- I ----
{
  const R = E.CARD_AI_PLAN_RANGE;
  const c = E.cardAiPlanClean(db, { prefer: ['zzz', '011', '011'], field: ['必殺技の応酬', '竜巻アタック', { name: '灼熱の地' }, 'ないカード'], habit: { big: 99, saveGuts: -5, keepGuard: 'x', attack: 3 } });
  check('I 候補外の番号・重なりを捨てる', !!c && J(c.prefer) === J([db.cards['011'].name]), J(c && c.prefer));
  check('I 場のカードの名前だけ残す({name} の形も読む)', !!c && J(c.field) === J(['必殺技の応酬', '灼熱の地']), J(c && c.field));
  check('I くせは 0〜5 に丸め、知らないくせ・数でない値は捨てる(助手ごとの幅は組むときに丸める)', !!c && c.habit.big === 5 && c.habit.saveGuts === 0 && !('keepGuard' in c.habit) && !('attack' in c.habit), J(c && c.habit));
  {
    const r = E.cardAiPlanHabitRange('momosuke', 'master');
    const h = E.cardAiDeckHabit('momosuke', 'master');
    const ok = Object.entries(R.habitMul).every(([k, [lo, hi]]) => Math.abs(r[k][0] - h[k] * lo) < 0.011 && Math.abs(r[k][1] - h[k] * hi) < 0.011);
    check('I くせの幅は、その助手のもとの値 × 倍率の幅', ok, J(r));
    const d1 = E.cardAiBuildDeck(db, 'momosuke', 'master', E.cardAiSeededRand('h'), { plan: { habit: { keepGuard: 5 } } });
    const d2 = E.cardAiBuildDeck(db, 'momosuke', 'master', E.cardAiSeededRand('h'), { plan: { habit: { keepGuard: r.keepGuard[1] } } });
    check('I 幅の外のくせは、組むときに助手ごとの幅の端へ丸める(5 と上の端で同じデッキ)', J(d1) === J(d2));
  }
  check('I 全部捨てたら上書きしない(null)', E.cardAiPlanClean(db, { prefer: ['zzz'], field: ['x'], habit: {} }) === null && E.cardAiPlanClean(db, null) === null && E.cardAiPlanClean(db, 'abc') === null);
  check('I 方針なしは今と同じ', J(build('kiki', 'master', 3)) === J(E.cardAiBuildDeck(db, 'kiki', 'master', E.cardAiSeededRand('kiki:master:3'), { plan: null })));
  const base = build('kiki', 'master', 3);
  const names = (d) => d.cards.map((no) => db.cards[no].name);
  const want = base.monsters.map((no) => Object.values(db.cards).find((x) => x.ready && x.kind !== 'fld' && x.user === db.monsters[no].species && !names(base).includes(x.name))).filter(Boolean).slice(0, 2);
  const withPlan = E.cardAiBuildDeck(db, 'kiki', 'master', E.cardAiSeededRand('kiki:master:3'), { plan: { prefer: want.map((x) => x.no), field: ['灼熱の地'], habit: { big: 0.6 } } });
  check('I 方針の札(HARD から)と場のカードが入る', want.length > 0 && want.every((x) => names(withPlan).includes(x.name)) && names(withPlan).includes('灼熱の地'), `${want.map((x) => x.name).join('・')} / 場 ${names(withPlan).includes('灼熱の地')}`);
  const d = E.cardAiBuildDeck(db, 'mua', 'easy', E.cardAiSeededRand('p'), { plan: { prefer: want.map((x) => x.no), habit: { keepGuard: 1.5 } } });
  check('I 方針を入れてもデッキの決まりを守る', E.cardDeckProblems(db, d).length === 0 && d.cards.length === 50 && E.cardDeckProblems(db, withPlan).length === 0);
}
// ---- J ----
{
  const games = 8;
  const kits = Object.keys(db.starters);
  const fieldsAll = Object.values(db.cards).filter((c) => c.ready && c.kind === 'fld');
  const rateOf = (w, lv, corner) => {
    let win = 0, n = 0, seed = 1;
    for (const k of kits) for (let g = 0; g < games; g++) {
      const rs = `${w}:${lv}:${k}:${g}`;
      const base = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(rs), { playerDeck: E.cardAiBuildDeck(db, k) });
      let mine = base;
      if (corner !== null) {
        const rnd = E.cardAiSeededRand(`j:${corner}:${rs}`);
        const r = E.cardAiPlanHabitRange(w, lv);
        const cand = E.cardAiPlanCandidates(db, w, lv, base.monsters);
        const prefer = []; while (prefer.length < 6 && prefer.length < cand.length) { const c = cand[Math.floor(rnd() * cand.length)]; if (!prefer.includes(c.no)) prefer.push(c.no); }
        const plan = { prefer, field: [fieldsAll[Math.floor(rnd() * fieldsAll.length)].name], habit: Object.fromEntries(Object.entries(r).map(([key, v]) => [key, v[corner]])) };
        mine = E.cardAiBuildDeck(db, w, lv, E.cardAiSeededRand(rs), { playerDeck: E.cardAiBuildDeck(db, k), plan });
      }
      const st = E.cardSimulate(db, { decks: [mine, E.cardAiBuildDeck(db, k)], policies: [E.cardAiPolicy(w, lv, { sameBlood: !!mine.sameBlood }), E.cardAiPolicy('kyuko', lv, { playerRole: true })], seed: 7000 + seed++, first: g % 2 });
      if (st.winner === 0) win++;
      n++;
    }
    return win / n * 100;
  };
  for (const lv of ['expert', 'master']) for (const corner of [0, 1]) {
    let d = 0;
    for (const w of WHO) d += rateOf(w, lv, corner) - rateOf(w, lv, null);
    d /= WHO.length;
    check(`J ${lv} くせを全部${corner ? '上' : '下'}の端にした方針: 8人の平均の差 ${d.toFixed(1)}点が ±10点以内`, Math.abs(d) <= 10);
  }
}
// ---- H ----
{
  const g = path.join(ROOT, 'supabase', 'functions', 'card-tournament-run', 'game.js');
  const t = fs.existsSync(g) ? fs.readFileSync(g, 'utf8') : '';
  check('H サーバの杯の写しに、いまの型の表が入っている', t.includes("const CARD_AI_STYLE_IDS = Object.freeze(['attack', 'guard', 'normal']);") && t.includes('const cardAiStyleOf'));
}

if (fails.length) {
  console.error(`育つ助手の型(デッキ): NG ${fails.length}件(OK ${passed}件)`);
  fails.forEach((f) => console.error(`  NG: ${f}`));
  process.exit(1);
}
console.log(`育つ助手の型(デッキ): OK ${passed}件`);

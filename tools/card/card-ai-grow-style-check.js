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
//   H. サーバの杯の写し(supabase/functions/card-tournament-run/game.js)が、いまの 82 から作り直してある
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const src = (f) => fs.readFileSync(path.join(GAME, f), 'utf8');
const ctx = vm.createContext({ console, Math, JSON, Object, Array, Number, String, Set, Map });
vm.runInContext(`${src('data/card-battle-cards.js')}\n;\n${src('src/parts/82-card-battle-core.jsx')}\n;\n${src('src/parts/82-card-tactics-core.jsx')}\n;\n${src('src/parts/93-card-replay.jsx').split('// ---- 保存(端末の中だけ)')[0]}\n;\n`
  + 'this.E = { CARD_BATTLE_DATA, CARD_AI_HABITS, CARD_AI_DECKS, CARD_AI_STYLE_IDS, CARD_AI_STYLE_VARIANT, cardAiBuildDeck, cardAiSeededRand, cardAiStyleOf, cardAssistantDeckPreview, cardDeckProblems, cardSimulate, cardAiPolicy, cardReplayNormalizeOne, cardReplayStyleOf };', ctx);
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
  check('E 3体と50枚・型の id を返す', !!p1 && p1.monsters.length === 3 && p1.cards.length === 50 && p1.styleId === 'attack' && 'name' in p1);
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
  check('F 84: 助手と対戦だけで型を読む(みんなのデッキ・杯は読まない)', /const foeStyle = !share && !\(opts && opts\.cup\) \? cardLifeCardStyle\(pick\.who\) : null;/.test(s84));
  check('F 84: 組むときに style を渡す', /cardAiBuildDeck\(db, pick\.who, pick\.level, Math\.random, \{ playerDeck: activeDeck, \.\.\.\(foeStyle \? \{ style: foeStyle \} : \{\}\) \}\)/.test(s84));
  check('F 84: 口は呼ぶ時に typeof で確かめ、知らない値は型なし', /typeof assistantLifeCardStyle === 'function' \? cardAiStyleOf\(assistantLifeCardStyle\(id\)\) : null/.test(s84));
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
  check('G 84: 助手と対戦の記録に使った型を残す', /style: foeStyle \|\| 'normal'/.test(s84) && /deckName: log\.deckName, style: log\.style \}/.test(s84));
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

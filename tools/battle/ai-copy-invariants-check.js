// AIコピー(ソラシドのアシカの5人目・2026-10-27 社長の決め)が「いる/いない」で、
// 勝ち負けの判定・倒れた数・山札の枚数・保存が変わらないことを確かめる(バトル部と開発部で最後にいっしょに通す約束の分)。
//
//   node tools/battle/ai-copy-invariants-check.js
//
// 見ること(部品を直接呼ぶ。本体につないだら、ブラウザで1戦流す形を下の ⑥ に足す):
//   ① タクティクスの勝ち負け: コピーが立っていても、盤面(4枠)の全員が倒れたら全滅。コピーのライフは盤面の合計に入らない
//   ② タクティクスの倒れた数: コピーが倒されても(その場で消える)盤面は1つも変わらず、倒れた数にも入らない
//   ③ タクティクスの狙い: コピーがいるときの抽選は「枠の番号」か「コピー」だけ。コピーがいないときは今までと同じ
//   ④ 山札の枚数: プレイヤーの山札・手札・捨て札は、出す・もう一度・切りかえ・コピーの手札・外すのどれでも変わらない
//      (2026-10-27 社長: コピーは自分の山札を持つ。プレイヤーの山札の写しから作り、距離撃・ほかの味方の固有技は抜く)
//   ⑤ 5つの遊び・保存: コピーはライフを持たない。負けの判定・ランキング・報酬はパーティの hp と slots だけを見る。
//      部品は保存に触らず、新しい mh_* の鍵を足していない
//   ⑥ ブラウザで1戦: 本体につながったら tools/battle/ai-copy-invariants-browser-check.js(公開の印をその中でだけ真にして1戦流す)
//
// 部品の名前は 33-ai-copy.jsx(共通)・32-tactics-units.jsx(タクティクスだけ)・32-sorashido-copy.jsx(開発部の計算)。
// 本体から切り出して動かす(検査へ書き写さない)。乱数は決まった値を渡す。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const source = read('monster-hero/src/game-system.jsx');
const slice = (from, to) => {
  const i = source.indexOf(from); const j = source.indexOf(to, i);
  if (i < 0 || j <= i) { console.log(`NG: 本体から切り出せませんでした(${from})`); process.exit(1); }
  return source.slice(i, j);
};

// ---- 部品を読み込む ----
const breeder = read('monster-hero/data/breeder.js');
const grabArray = (name) => { const i = breeder.indexOf(`const ${name} = `); return breeder.slice(i, breeder.indexOf('\n];', i) + 3).replace(/^const /, 'var '); };
const copyCtx = { console, Math, JSON, Object, Array, Number, String };
vm.createContext(copyCtx);
vm.runInContext(`${grabArray('SORASHIDO_TIERS')}
${read('monster-hero/src/parts/32-sorashido-copy.jsx')}
${read('monster-hero/src/parts/33-ai-copy.jsx')}
globalThis.__s = { isAiCopyOut, summonAiCopy, dismissAiCopy, tickAiCopy, planAiCopyTurn };`, copyCtx);
const C = copyCtx.__s;

// タイプ(ヘイトの倍率)は data から来るので「タイプ無し」で動かす(tactics-ai-copy-check.js と同じ)
const tacCtx = { Math, Number, console, monsterTypeOf: () => ({ main: 'attacker', sub: null }), MONSTER_TYPES: {} };
vm.createContext(tacCtx);
vm.runInContext(slice('const TACTICS_START_GUTS_RATE', '// ===== イベント・レイドボス「ジャック」の定義')
  + ';globalThis.api={createTacticsUnit,tacticsTotalHp,isTacticsWipedOut,tacticsDownedSlots,tacticsAliveSlots,chooseTacticsTarget,'
  + 'tacticsTargetChancesWithCopy,TACTICS_AI_COPY_TARGET,isTacticsAiCopyStanding,damageTacticsAiCopy};', tacCtx);
const T = tacCtx.api;

// 決まった乱数(同じ並びを何度でも作れる)
const seeded = (seed) => { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
// 部品はライフを baseHp で受け取り、倒れたかは downed の印で持つ(createTacticsUnit)
const unit = (id, hp = 500, maxHp = 500) => ({ ...T.createTacticsUnit({ id, name: id, baseHp: maxHp, baseAtk: 100, baseDef: 100, baseGuts: 100 }), hp, downed: hp <= 0 });
const downed = (b) => T.tacticsDownedSlots(b).length;

// ---- ① タクティクスの勝ち負け ----
{
  const copy = { name: 'ゴーレム', hp: 250, maxHp: 250, hate: 10, pos: 1 };
  // 盤面ごとの正しい答え(全滅か・ライフの合計・倒れた数)。判定は盤面だけを受け取り、コピーの有無で変わらない
  const boards = [
    ['全員立つ', [unit('a'), unit('b'), unit('c'), unit('d')], { wiped: false, total: 2000, down: 0 }],
    ['2人倒れ', [unit('a', 0), unit('b'), null, unit('d', 0)], { wiped: false, total: 500, down: 2 }],
    ['全員倒れ', [unit('a', 0), unit('b', 0), unit('c', 0), unit('d', 0)], { wiped: true, total: 0, down: 4 }],
    ['1人だけで倒れ', [null, unit('b', 0), null, null], { wiped: true, total: 0, down: 1 }],
  ];
  for (const [label, b, want] of boards) {
    const got = { wiped: T.isTacticsWipedOut(b), total: T.tacticsTotalHp(b), down: downed(b) };
    check(`タクティクス(${label}): 全滅の判定・ライフの合計・倒れた数は盤面だけで決まる(コピーが立っていても同じ)`,
      JSON.stringify(got) === JSON.stringify(want) && T.isTacticsAiCopyStanding(copy), JSON.stringify(got));
  }
  const allDown = boards[2][1];
  check('タクティクス: 盤面が全員倒れたら、コピーが立っていても全滅(負け)', T.isTacticsWipedOut(allDown) === true && T.isTacticsAiCopyStanding(copy));
  check('タクティクス: コピーのライフは盤面の合計に入らない', T.tacticsTotalHp(allDown) === 0);
}

// ---- ② タクティクスの倒れた数: コピーが倒されても盤面は変わらない ----
{
  const b = [unit('a'), unit('b', 120), null, unit('d')];
  const before = JSON.stringify(b);
  const copy = { name: 'ゴーレム', hp: 80, maxHp: 250, hate: 10, pos: 2 };
  const hit = T.damageTacticsAiCopy(copy, 79);
  const gone = T.damageTacticsAiCopy(copy, 500);
  check('タクティクス: 倒れきらない一撃ではコピーは残る', !!hit && hit.hp === 1, JSON.stringify(hit));
  check('タクティクス: 倒されたコピーはその場で消える(null)', gone === null);
  check('タクティクス: コピーが倒れても盤面は1つも変わらない', JSON.stringify(b) === before);
  check('タクティクス: コピーが倒れても倒れた数は変わらない', downed(b) === 0);
}

// ---- ③ タクティクスの狙い ----
{
  const b = [unit('a'), unit('b', 200), null, unit('d', 300)];
  const hate = [40, 0, 0, 20];
  const copy = { name: 'b', hp: 250, maxHp: 250, hate: 10, pos: 2 };
  const COPY = T.TACTICS_AI_COPY_TARGET;
  const rngA = seeded(7); const rngB = seeded(7);
  const without = []; const withCopy = [];
  for (let i = 0; i < 400; i++) { without.push(T.chooseTacticsTarget(b, rngA, undefined, hate)); withCopy.push(T.chooseTacticsTarget(b, rngB, undefined, hate, copy)); }
  check('タクティクス: コピーがいないときの狙いは立っている枠の番号だけ', without.every((n) => Number.isInteger(n) && b[n] && b[n].hp > 0));
  check('タクティクス: コピーがいるときの狙いは「立っている枠」か「コピー」だけ', withCopy.every((n) => n === COPY || (Number.isInteger(n) && b[n] && b[n].hp > 0)),
    [...new Set(withCopy)].join(','));
  check('タクティクス: コピーがいるとき、コピーにも当たることがある', withCopy.includes(COPY));
  const ch = T.tacticsTargetChancesWithCopy(b, hate, undefined, copy);
  const sum = ch.slots.filter((v) => v != null).reduce((x, y) => x + y, 0) + (ch.copy || 0);
  check('タクティクス: 狙われる%は、コピーを入れても合計100', sum === 100, `${JSON.stringify(ch.slots)} + コピー ${ch.copy}`);
  const rngC = seeded(11); const rngD = seeded(11);
  const plainA = []; const plainB = [];
  for (let i = 0; i < 200; i++) { plainA.push(T.chooseTacticsTarget(b, rngC, undefined, hate)); plainB.push(T.chooseTacticsTarget(b, rngD, undefined, hate, null)); }
  check('タクティクス: コピーを渡さない(null)ときの抽選は、渡さない呼び方と1つ残らず同じ', JSON.stringify(plainA) === JSON.stringify(plainB));
}

// ---- ④ 山札の枚数 ----
{
  const card = (n, type = 'atk', guts = 20) => ({ id: `c${n}`, uid: `c${n}`, type, name: `札${n}`, guts });
  const uniqueOf = (id) => ({ id: `u-${id}`, uid: `u-${id}`, type: 'unique', name: `${id}の固有技`, guts: 30 });
  const zones0 = { deck: [card(1), card(2), card(3, 'guard', 0), card(4, 'range_atk'), card(5)], hand: [card(6), card(7)], discard: [card(8)] };
  const ids = (z) => ['deck', 'hand', 'discard'].map((k) => (z[k] || []).map((c) => c.uid).sort().join(',')).join(' | ');
  const count = (z) => ['deck', 'hand', 'discard'].reduce((n, k) => n + (z[k] || []).length, 0);
  const base = count(zones0); const baseIds = ids(zones0);
  const src = { maxHp: 1000, atk: 200, def: 100, maxGuts: 150 };
  for (const mode of ['tactics', 'classic']) {
    // ★2026-10-27 社長: コピーは自分の山札を持つ(プレイヤーの山札・手札・捨て札の写しから作る)。プレイヤーの山札には何も足さない・抜かない
    const s1 = C.summonAiCopy({ aiCopy: null, zones: zones0 }, { srcSlot: 1, srcMonsterId: 'golem', name: 'ゴーレム', level: 0, src, turn: 3, mode });
    check(`${mode}: 出してもプレイヤーの山札・手札・捨て札は変わらない`, s1.zones === zones0 && ids(s1.zones) === baseIds);
    check(`${mode}: コピーの山札は写しから作る(距離撃は抜く)`, Array.isArray(s1.aiCopy.deck) && s1.aiCopy.deck.length === base - 1 && !s1.aiCopy.deck.some((c) => c.type === 'range_atk'));
    const s2 = C.summonAiCopy(s1, { srcSlot: 1, srcMonsterId: 'golem', level: 1, src, turn: 4, mode });
    check(`${mode}: 同じ子にもう一度使っても変わらない`, ids(s2.zones) === baseIds && s2.plan.kind === 'refresh');
    const s3 = C.summonAiCopy(s2, { srcSlot: 2, srcMonsterId: 'tiger', level: 1, src, turn: 5, mode });
    check(`${mode}: 別の子に切りかえても変わらない(コピーの山札は作り直す)`, ids(s3.zones) === baseIds && s3.plan.rebuildDeck === true);
    // コピーの手札を作っても、プレイヤーの山札は減らない(引くのはコピーの山札から)
    const planned = C.planAiCopyTurn(s3.aiCopy, { count: 5, score: () => 1, costOf: (c) => c.guts || 0, rng: seeded(3) });
    check(`${mode}: コピーの手札を作ってもプレイヤーの山札は減らない`, ids(s3.zones) === baseIds && Array.isArray(planned.hand) && planned.hand.length > 0);
    const out = C.dismissAiCopy(s3);
    check(`${mode}: 外してもプレイヤーの山札・手札・捨て札はそのまま`, out.aiCopy === null && ids(out.zones) === baseIds, ids(out.zones));
    // ターン切れで外れる
    let st = s1; let turn = 4; let guard = 0;
    while (st.aiCopy && guard++ < 10) { st = C.tickAiCopy(st, turn); turn += 1; }
    check(`${mode}: 続くターンが切れたら外れ、山札はそのまま`, st.aiCopy === null && ids(st.zones) === baseIds);
    check(`${mode}: コピーを出す前(使ったターン)は数えない`, C.tickAiCopy(s1, 3).aiCopy && C.tickAiCopy(s1, 3).aiCopy.turnsLeft === s1.aiCopy.turnsLeft);
  }
}

// ---- ④-2 本体: みんなの山札の枚数はコピーの有無で変わらない ----
// コピーは自分の山札を持つ(2026-10-27 社長)。本体は summonAiCopy・dismissAiCopy の返す zones を、プレイヤーの山札・手札・捨て札へ書き戻さない
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  const writesBack = (app.match(/set(Deck|Hand|Graveyard)\(\s*res\.zones|set(Deck|Hand|Graveyard)\(\s*out\.zones/g) || []).length;
  check('本体: summonAiCopy・dismissAiCopy の返す zones を山札・手札・捨て札へ書き戻さない', writesBack === 0, `${writesBack}か所`);
}

// ---- ⑤ 5つの遊び・保存 ----
{
  const src = { maxHp: 1000, atk: 200, def: 100, maxGuts: 150 };
  const c = C.summonAiCopy({ aiCopy: null, zones: { deck: [], hand: [], discard: [] } }, { srcSlot: 0, srcMonsterId: 'golem', level: 2, src, uniqueCard: { id: 'u', uid: 'u', type: 'unique' }, turn: 1, mode: 'classic' });
  check('5つの遊び: コピーはライフを持たない(パーティのライフを使う)', c.aiCopy.hp === undefined && c.aiCopy.maxHp === undefined);
  const parts = ['32-sorashido-copy.jsx', '33-ai-copy.jsx'].map((f) => read(`monster-hero/src/parts/${f}`)).join('\n')
    + slice('const TACTICS_AI_COPY_TARGET', 'const tacticsExCopyableBuffs');
  const code = parts.replace(/\/\/[^\n]*/g, '');
  check('保存: コピーの部品は保存に触らない(storeSet・localStorage・mh_ の鍵が無い)', !/storeSet|storeGet|localStorage|['"`]mh_/.test(code));
  const keys = [...new Set(source.match(/['"`]mh_[a-z0-9_]+/g) || [])].filter((k) => /copy|aicopy|ai_copy/i.test(k));
  check('保存: コピーのための新しい mh_* の鍵が無い', keys.length === 0, keys.join(','));
  // 本体につながったあとも、コピーの state が保存・ランキング・報酬・負けの判定に入らないこと
  const app = read('monster-hero/src/parts/60-app.jsx');
  const linesWith = (re) => app.split('\n').filter((l) => re.test(l));
  const copyLines = linesWith(/\b(aiCopy|aiCopyRef|commitAiCopy|clearAiCopy|tacticsCopy)\b/);
  check('保存: コピーの state を保存へ書く行が無い', copyLines.every((l) => !/storeSet\(|localStorage\./.test(l)), `${copyLines.length}行を見た`);
  const fn = (name) => { const i = app.indexOf(`const ${name} = `); if (i < 0) return ''; const j = app.indexOf('\n  const ', i + 10); return app.slice(i, j < 0 ? i + 20000 : j); };
  for (const name of ['submitLocalScore', 'awardRunRewards']) {
    const body = fn(name);
    check(`ランキング・報酬: ${name} はコピーを読まない(送る数・配る数が変わらない)`, !!body && !/\b(aiCopy|aiCopyRef|tacticsCopy)\b/.test(body), body ? '' : '関数が見つからない');
  }
  const loseLines = linesWith(/\bhp\s*<=\s*0\b/);
  check('5つの遊び: 負けの判定(hp <= 0)はコピーを見ない', loseLines.length > 0 && loseLines.every((l) => !/\b(aiCopy|aiCopyRef|tacticsCopy)\b/.test(l)), `${loseLines.length}行`);
}

// ---- ⑥ ブラウザで1戦(本体につながってから) ----
{
  const app = read('monster-hero/src/parts/60-app.jsx');
  // 本体につながった目印: 5つの遊びの summonClassicAiCopy・共通の commitAiCopy(ダイスくん・セコンドくんの名前)の中で summonAiCopy が呼ばれる
  if (!/\bsummonAiCopy\(/.test(app)) {
    console.log('SKIP: ブラウザで1戦流す形 — 本体(60-app.jsx)にまだ summonAiCopy が呼ばれていない。つながったら、公開の印を検査の中でだけ真にして1戦流す形をここへ足す');
  } else {
    // 本体につながった(#4108)。ブラウザで1戦流す分は別の検査にした(重いので分けて回す)
    const browser = path.join(ROOT, 'tools/battle/ai-copy-invariants-browser-check.js');
    check('本体につながったので、ブラウザで1戦流す検査がある(ai-copy-invariants-browser-check.js)', fs.existsSync(browser));
  }
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

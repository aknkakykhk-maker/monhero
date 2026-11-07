// MFバトルカード: 遊んでいる人が1体も倒さずに終わった負け・投了で、助手が「いい勝負だった」「強かった」と言わないかを見張る
// (2026-11-07 検査部ミハリの指摘 C1: 投了・倒したのは0体なのに「勝った！！ でもけっこう強かったよ」と出た)
//
//   node tools/card/card-result-line-quick-check.js
//
// 見ているもの(ブラウザは使わない)
//   ① 対戦の助手(CARD_BATTLE_LINES)の全員に、場面 winQuick(1体も倒されずに助手が勝った)の台詞が2本以上ある
//   ② winQuick の台詞に「いい勝負」「強かった」「強い」「接戦」「ぎりぎり」が入っていない(中身と合わない言葉)
//   ③ 結果画面が、倒した数(facts.kos)が 0 の負け・投了で winQuick を選び、1体でも倒していれば win を選ぶ
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PARTS = path.resolve(__dirname, '..', '..', 'monster-hero', 'src', 'parts');
let fails = 0;
const ok = (c, msg) => { if (!c) { fails += 1; console.log(`NG: ${msg}`); } };
const read = (f) => fs.readFileSync(path.join(PARTS, f), 'utf8');
const cut = (src, name) => {
  const at = src.search(new RegExp(`^const ${name} = `, 'm'));
  if (at < 0) return null;
  let depth = 0, q = null;
  for (let i = at; i < src.length; i++) {
    const ch = src[i];
    if (q) { if (ch === '\\') { i += 1; continue; } if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { q = ch; continue; }
    if (ch === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
    if ('({['.includes(ch)) depth += 1;
    else if (')}]'.includes(ch)) depth -= 1;
    else if (ch === ';' && depth === 0) return src.slice(at, i + 1);
  }
  return null;
};

const lines = read('83-card-battle-lines.jsx');
const screen = read('84-screen-card-battle.jsx');
const tableSrc = cut(lines, 'CARD_BATTLE_LINES');
const quickSrc = cut(screen, 'cardResultLineQuick');
ok(tableSrc, '83 に CARD_BATTLE_LINES が見つからない');
ok(quickSrc, '84 に cardResultLineQuick が見つからない');
if (tableSrc && quickSrc) {
  const ctx = {};
  vm.runInNewContext(`${tableSrc}\n${quickSrc}\nthis.T = CARD_BATTLE_LINES; this.Q = cardResultLineQuick;`, ctx);
  const BAD = ['いい勝負', '強かった', '強い', '接戦', 'ぎりぎり'];
  for (const [who, t] of Object.entries(ctx.T)) {
    const list = (t && t.winQuick) || [];
    ok(list.length >= 2, `① ${who} の winQuick が2本未満(${list.length}本)`);
    for (const e of list) {
      const text = Array.isArray(e) ? e[0] : e;
      ok(typeof text === 'string' && text.length > 0, `① ${who} の winQuick に文字でないものがある`);
      for (const w of BAD) ok(!String(text).includes(w), `② ${who} の winQuick「${text}」に「${w}」が入っている`);
    }
  }
  const Q = ctx.Q;
  ok(Q({ outcome: 'surrender', facts: { kos: 0 } }) === true, '③ 投了・倒した数0 で winQuick にならない');
  ok(Q({ outcome: 'lose', facts: { kos: 0 } }) === true, '③ 負け・倒した数0 で winQuick にならない');
  ok(Q({ outcome: 'lose', facts: { kos: 1 } }) === false, '③ 1体倒した負けで winQuick になる');
  ok(Q({ outcome: 'surrender', facts: { kos: 2 } }) === false, '③ 2体倒した投了で winQuick になる');
  ok(Q({ outcome: 'win', facts: { kos: 0 } }) === false, '③ 勝ちで winQuick になる');
  ok(Q({ outcome: 'lose', facts: null }) === false, '③ 倒した数が無い記録で winQuick になる(古い記録はいままでどおり)');
}
ok(/lineScene=\{win \? 'lose' : cardResultLineQuick\(result\) \? 'winQuick' : 'win'\}/.test(screen), '③ 結果画面の CardResultTalk が cardResultLineQuick で場面を選んでいない');

if (fails) { console.log(`card-result-line-quick-check: NG ${fails}件`); process.exit(1); }
console.log('card-result-line-quick-check: OK(8人の winQuick・選び方)');

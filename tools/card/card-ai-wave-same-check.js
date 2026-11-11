// MFバトルカード: cardAiMonWave の速くした版(種族 → 世代の引き表・2026-11-11 カード部カルク 軽量化)が、
//   前の版(呼ばれるたびに全モンスターを find で探す)と、答えが1つ残らず同じかを確かめる(部長ソランドの条件 ①)。
//   node tools/card/card-ai-wave-same-check.js
//
// 見るもの
//   ① 全モンスター × 全カード(と card なし)で cardAiMonWave が前の版と同じ
//   ② 全助手 × 全難易度(と null)× 全モンスター × 世代 1〜最大+1 で cardAiMonScore が前の版と同じ
//   ③ 新しい版を同じ db で2回呼んでも同じ(表を1回作って使い回す)
// 前の版は、82 の本文の cardAiMonWave の中身を前の find に差し替えた写しを、別の vm で動かして作る
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..', '..');
const GAME = path.join(ROOT, 'monster-hero');
const DATA = fs.readFileSync(path.join(GAME, 'data', 'card-battle-cards.js'), 'utf8');
const CORE = fs.readFileSync(path.join(GAME, 'src', 'parts', '82-card-battle-core.jsx'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const NEW_BODY = /  const t = cardAiBaseWaveTable\(db\);\n  return t\.has\(sp\) \? t\.get\(sp\) : 4;\n/;
const OLD_BODY = "  const base = Object.values(db.monsters).find((x) => !x.variant && x.species === sp && String(x.wave) !== 'hybrid');\n  return base ? Number(base.wave) || 1 : 4;\n";
const load = (src) => {
  const ctx = vm.createContext({ console });
  vm.runInContext(`${DATA}\n;\n${src}\n;\nthis.E = { CARD_BATTLE_DATA, cardAiMonWave, cardAiMonScore, CARD_AI_LEVELS, CARD_AI_HABITS };`, ctx, { filename: '82-card-battle-core.jsx' });
  return ctx.E;
};

check('82 の cardAiMonWave が引き表の形になっている(前の版の写しを作れる)', NEW_BODY.test(CORE));
if (!NEW_BODY.test(CORE)) process.exit(1);
const N = load(CORE);
const O = load(CORE.replace(NEW_BODY, OLD_BODY));
const db = N.CARD_BATTLE_DATA, dbo = O.CARD_BATTLE_DATA;
const mons = Object.keys(db.monsters);
const cards = Object.keys(db.cards);

// ①
let n1 = 0; const bad1 = [];
for (const k of mons) for (const c of [null, ...cards]) {
  const a = N.cardAiMonWave(db, db.monsters[k], c ? db.cards[c] : null);
  const b = O.cardAiMonWave(dbo, dbo.monsters[k], c ? dbo.cards[c] : null);
  n1++; if (a !== b && bad1.length < 5) bad1.push(`${k}/${c}: ${b}→${a}`);
}
check(`① cardAiMonWave が前の版と同じ(${mons.length}体 × ${cards.length + 1} = ${n1}通り)`, !bad1.length, bad1.join(' / '));

// ②
const whos = Object.keys(N.CARD_AI_HABITS);
const levels = [null, ...Object.keys(N.CARD_AI_LEVELS)];
const maxW = Math.max(...Object.values(db.monsters).map((m) => Number(m.wave) || 1)) + 1;
let n2 = 0; const bad2 = [];
for (const who of whos) for (const lv of levels) for (const k of mons) for (let w = 1; w <= maxW; w++) {
  const a = N.cardAiMonScore(db, who, db.monsters[k], w, lv);
  const b = O.cardAiMonScore(dbo, who, dbo.monsters[k], w, lv);
  n2++; if (!(a === b || (Number.isNaN(a) && Number.isNaN(b))) && bad2.length < 5) bad2.push(`${who}/${lv}/${k}/w${w}: ${b}→${a}`);
}
check(`② cardAiMonScore が前の版と同じ(助手${whos.length} × 難易度${levels.length} × ${mons.length}体 × 世代${maxW} = ${n2}通り)`, !bad2.length, bad2.join(' / '));

// ③
const again = mons.every((k) => N.cardAiMonWave(db, db.monsters[k], null) === N.cardAiMonWave(db, db.monsters[k], null));
check('③ 2回呼んでも同じ', again);

console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);

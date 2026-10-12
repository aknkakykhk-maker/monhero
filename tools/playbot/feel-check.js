// モンヒロくんの「反応の点検」(lib/feel.js の analyzeFeel)が、作り物の押下と判定から正しく数えるかを見る(2026-10-07)。
//   ① ±150ms 以内に押したのに MISS → 押したのに取れない ② 判定のずれ − 押したずれ が25ms超 → 判定のずれ
//   ③ 60ms以上離れ、遅れて届いた分で説明がつかない → 早取り ④ 途中で終わりの時刻が前へ動いて MISS → ホールドが切れた
//   ⑤ 受付の端で押さえたホールドの切れは別に数える ⑥ 遅れて届いた分のずれは早取りにしない
//   node tools/playbot/feel-check.js
const { analyzeFeel } = require('./lib/feel');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const notesInfo = [
  { index: 0, type: 'TAP', timeMs: 1000 }, { index: 1, type: 'TAP', timeMs: 2000 }, { index: 2, type: 'TAP', timeMs: 3000 },
  { index: 3, type: 'TAP', timeMs: 4000 }, { index: 4, type: 'HOLD', timeMs: 5000, endTimeMs: 6000 }, { index: 5, type: 'HOLD', timeMs: 7000, endTimeMs: 8000 },
  { index: 6, type: 'TAP', timeMs: 9000 }, { index: 7, type: 'TAP', timeMs: 10000 },
];
const presses = [
  { index: 0, pressSong: 1010 }, { index: 1, pressSong: 2005 }, { index: 2, pressSong: 2990 }, { index: 3, pressSong: 4000 },
  { index: 4, pressSong: 5000, releaseSong: 6000 }, { index: 5, pressSong: 7000, releaseSong: 8000, edgeProbe: true },
  { index: 6, pressSong: 9000, lateMs: 100 }, { index: 7, pressSong: 10000 },
];
const results = [
  { index: 0, done: true, judgment: 'MISS', deltaMs: null },                       // ① 10ms で押したのに MISS
  { index: 1, done: true, judgment: 'GREAT', deltaMs: 40 },                        // ② 5ms で押したのに 40ms
  { index: 2, done: true, judgment: 'MARVELOUS', deltaMs: -12 },                   // ずれ 2ms → 何も数えない
  { index: 3, done: true, judgment: 'GOOD', deltaMs: -150 },                       // ③ 0ms で押したのに -150ms → 早取り
  { index: 4, done: true, judgment: 'MISS', holdJudgment: 'MISS', endTimeMs: 5450 }, // ④ 途中で切れた
  { index: 5, done: true, judgment: 'MISS', holdJudgment: 'MISS', endTimeMs: 7450 }, // ⑤ 受付の端で押さえて切れた
  { index: 6, done: true, judgment: 'EXCELLENT', deltaMs: 70 },                    // ⑥ 100ms 遅れて届いた分。早取りではない
  { index: 7, done: true, judgment: 'MARVELOUS', deltaMs: 0 },
];
const a = analyzeFeel({ notesInfo, presses, results });
check('押したのに取れない', a.summary.tapMissed === 1 && a.tapMissed[0].index === 0, String(a.summary.tapMissed));
check('判定のずれ', a.drift.some((x) => x.index === 1) && !a.drift.some((x) => x.index === 2), JSON.stringify(a.drift.map((x) => x.index)));
check('早取り', a.summary.stolen === 1 && a.stolen[0].index === 3, String(a.summary.stolen));
check('ホールドが切れた(途中で終わりの時刻が前へ動いた)', a.summary.holdBroken === 2, String(a.summary.holdBroken));
check('受付の端で押さえて切れたものは別に数える', a.summary.holdBrokenAtEdge === 1 && a.summary.edgeProbes === 1);
check('遅れて届いた分のずれは早取りにしない', !a.stolen.some((x) => x.index === 6));
check('判定のずれの中央値を出す', Number.isFinite(a.summary.errorMedianMs));
// 手の割り振り(版2・2026-10-12): 押さえている手のそばに来たノーツは反対の手で押す(押さえている親指で別のノーツは叩けない)
{
  const src = require('fs').readFileSync(require('path').join(__dirname, 'scenarios/rhythm.js'), 'utf8');
  check('手の割り振り: その手が HOLD/SLIDE を押さえている最中なら反対の手で押す', /busy\.has\(byPos\) && !busy\.has\(1 - byPos\) \? 1 - byPos : byPos/.test(src));
  check('手の割り振り: 同じ時刻の和音が同じ手に重なり、反対の手があいていれば分ける', src.includes('same.length < 2 || busy.has(1 - h)') && src.includes('move.hand = 1 - h'));
  check('手の割り振り: 押すときの指のくせ・つられも、割り振った手で決める', src.includes('fingerHabit(c, pl.second, pl.hand)'));
  check('手の割り振り: 結果に版の印(playerVersion: 3)を付け、前の記録と混ぜない', src.includes('playerVersion: 3'));
}
console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

// Sheriruth 試作(空中の段): オンプくんの下書き(JSON・作業用の場所だけに置く)を、試作の譜面へ組み立てる
//   node build-sky.js <下書き.json> [交わる版のスライド.json]
// 時刻はゲームの音源の時刻。試作の音源(曲の CUT_MS から切った34秒)に合わせてずらして書く
const fs = require('fs');
const P = '/home/user/monhero/monster-hero/data/rhythm-mode.js';
const CUT_MS = 102500;
const draft = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
let notes = draft.notes;
if (process.argv[3]) {
  const crossing = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const inArc1 = (n) => n.k === 's' && n.pts[0][0] < 120000;
  notes = notes.filter((n) => !inArc1(n)).concat(crossing);
}
const T = (ms) => Math.round(ms - CUT_MS);
const DIR = { '': 0, left: 1, right: 2 };
const out = notes.map((n) => {
  if (n.k === 't') return { t: n.t, text: n.sky ? `T(${T(n.t)},${n.sub},${n.w})` : `t(${T(n.t)},${n.sub},${n.w},0)` };
  if (n.k === 'f') return { t: n.t, text: n.sky ? `F(${T(n.t)},${n.sub},${n.w},${DIR[n.dir || ''] || 0})` : `f(${T(n.t)},${n.sub},${n.w},${DIR[n.dir || ''] || 0})` };
  if (n.k === 'h') return { t: n.t, text: `h(${T(n.t)},${n.sub},${n.w},${T(n.end)})` };
  if (n.k === 's') {
    const pts = n.pts.map(([t, lane, w, sky, ease]) => `[${T(t)},${lane},${w},${sky},${ease || 0}]`).join(',');
    return { t: n.pts[0][0], text: `S(${T(n.pts[0][0])},${T(n.pts[n.pts.length - 1][0])},[${pts}],${n.endFlick ? 1 : 0},'${n.hand}')` };
  }
  throw new Error('知らない種類 ' + n.k);
}).sort((a, b) => a.t - b.t);
const lines = [];
for (let k = 0; k < out.length; k += 4) lines.push('  ' + out.slice(k, k + 4).map((x) => x.text).join(',') + ',');
const src = fs.readFileSync(P, 'utf8');
const re = /(\/\/ <sheriruth-proto-master-notes>\n)[\s\S]*?(\/\/ <\/sheriruth-proto-master-notes>)/;
if (!re.test(src)) throw new Error('試作の入れ物が無い');
fs.writeFileSync(P, src.replace(re, `$1${lines.join('\n')}\n$2`));
const c = {}; notes.forEach((n) => { const k = n.k + (n.sky ? '(空中)' : ''); c[k] = (c[k] || 0) + 1; });
console.log(`試作 ${out.length}ノーツ ${JSON.stringify(c)} ${process.argv[3] ? '・2本のスライドは交わる版' : '・交わらない版'}`);

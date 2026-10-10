// Sheriruth 試作: 自動の MASTER の 104.5〜135.5 秒を取り出し、参考譜面(Arcaea)に寄せて組み替える。
// 出力は試作用の短い音源(曲の CUT_MS から)に合わせて時刻をずらしたノーツ列。
const fs = require('fs');
const P = '/home/user/monhero/monster-hero/data/rhythm-mode.js';
const src = fs.readFileSync(P, 'utf8');
const CUT_MS = 102500, FROM = 104400, TO = 135500;
const BEAT = 324.342, ZERO = 711.6;
const b = (n) => Math.round(ZERO + BEAT * n);            // n 拍目の時刻
const m = src.match(/<sheriruth-v3-master-notes>\n([\s\S]*?)\/\/ <\/sheriruth-v3-master-notes>/)[1];
// 自動のノーツを1つずつ取り出す(スライドは中に [] を含む)
const items = [];
let i = 0;
while (i < m.length) {
  const k = m.slice(i).search(/[thfs]\(/); if (k < 0) break;
  let j = i + k, depth = 0, e = j;
  for (; e < m.length; e++) { if (m[e] === '(') depth++; else if (m[e] === ')') { depth--; if (!depth) break; } }
  const text = m.slice(j, e + 1);
  items.push({ text, t: +text.match(/\((\d+)/)[1], kind: text[0] });
  i = e + 1;
}
// 2本のアークの区間(曲の時刻)。この中の自動ノーツは消して、2本のスライドに置き換える
const ARC1 = [b(333) - 20, b(360) + 40];   // 108.7〜117.5 秒: 交差しながら絡む2本
const ARC2 = [b(397) - 20, TO];            // 129.5 秒〜: 両端から中央へ寄って合わさる2本
const inArc = (t) => (t >= ARC1[0] && t <= ARC1[1]) || (t >= ARC2[0] && t <= ARC2[1]);
const keep = items.filter((x) => x.t >= FROM && x.t <= TO && !inArc(x.t));
// 地上と空中の2段の代わり: 2拍目・4拍目に当たるタップを、上へはじくフリック(=スカイノーツ)にする
const beatOf = (t) => (t - ZERO) / BEAT;
const out = [];
let skyCount = 0;
for (const x of keep) {
  let text = x.text;
  const bt = beatOf(x.t), onBeat = Math.abs(bt - Math.round(bt)) < 0.06, back = Math.round(bt) % 2 === 1;
  if (x.kind === 't' && onBeat && back) {
    const [, tt, sub, w] = text.match(/t\((\d+),([\d.]+),(\d+)/);
    text = `f(${tt},${sub},${w})`; skyCount++;
  }
  out.push({ t: x.t, text });
}
// スライド: [拍, レーン(左端・0.5刻み・0〜4), 幅]。2本とも幅2(=1レーン)
const slide = (pts, endFlick) => {
  const P2 = pts.map(([n, lane, w, ease]) => [b(n), lane, w || 2, ease || 0]);
  const body = P2.map(([t, l, w, e]) => `[${t},${l},${w}${e ? ',' + e : ''}]`).join(',');
  return { t: P2[0][0], text: `s(${P2[0][0]},${P2[P2.length - 1][0]},[${body}]${endFlick ? ',1' : ''})` };
};
// 1つめの区間(参考動画 109〜117.5 秒の位置を、0.5秒ごとに判定ラインで読んだもの)。なめらかに(ease 3 = inout)
const pink1 = slide([[333, 2.5, 2, 3], [335, 1, 2, 3], [337, 4, 2, 3], [339, 1.5, 2, 3], [341, 0.5, 2, 3], [343, 3.5, 2, 3], [345, 2.5, 2, 3], [347, 0, 2, 3],
  [349, 2.5, 2, 3], [351, 3.5, 2, 3], [353, 1, 2, 3], [355, 2.5, 2, 3], [357, 4, 2, 3], [359, 2.5, 2, 3], [360, 4, 2]], true);
const blue1 = slide([[334.5, 3, 2, 3], [335, 3.5, 2, 3], [337, 0.5, 2, 3], [339, 3, 2, 3], [341, 4, 2, 3], [343, 2, 2, 3], [345, 0.5, 2, 3], [347, 3, 2, 3],
  [349, 1.5, 2, 3], [351, 0.5, 2, 3], [353, 3, 2, 3], [355, 1.5, 2, 3], [357, 2.5, 2, 3], [359, 1, 2, 3], [360, 1.5, 2]], true);
// 2つめの区間(参考動画 130〜135 秒): 両端から少しずつ寄って、最後は真ん中で隣り合う
const blue2 = slide([[398, 0, 2], [402, 0.5, 2, 3], [406, 1, 2, 3], [410, 1.5, 2, 3], [414, 2, 2]], true);
const pink2 = slide([[398, 4, 2], [402, 3.5, 2, 3], [406, 3, 2, 3], [410, 2.5, 2, 3], [414, 3, 2]], true);
out.push(pink1, blue1, blue2, pink2);
out.sort((a, c) => a.t - c.t);
// 試作の音源の頭(CUT_MS)に合わせて時刻をずらす
const shift = (text) => text.replace(/\d{5,6}/g, (d) => String(Number(d) - CUT_MS));
const lines = [];
for (let k = 0; k < out.length; k += 4) lines.push('  ' + out.slice(k, k + 4).map((x) => shift(x.text)).join(',') + ',');
const block = lines.join('\n') + '\n';
const re = /(\/\/ <sheriruth-proto-master-notes>\n)[\s\S]*?(\/\/ <\/sheriruth-proto-master-notes>)/;
if (!re.test(src)) throw new Error('試作の入れ物が無い');
fs.writeFileSync(P, src.replace(re, `$1${block}$2`));
console.log(`試作 ${out.length}ノーツ(うちスカイノーツ代わりのフリック ${skyCount}・スライド 4本)/ 区間 ${FROM}〜${TO}ms → 試作の音源では ${FROM - CUT_MS}〜${TO - CUT_MS}ms`);

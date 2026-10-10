// Tier 表の各項目(アシカ・組み合わせ・おすすめパーティ)に付ける「根拠」を組み立てる共通の部品。
// 2026-10-10 社長「表面的に出すだけじゃなくてタップしたらその詳細を出すようにして。ちゃんと根拠があるようにしっかり把握して作って」。
// 形(ハカセくんと決めた): { 出どころ, 回数(1文), 数字: [{ 名前, 値(単位つき), 基準(何と比べたかを言葉で), 差, ぶれ(±標準誤差の2倍) }],
//   効いている機能: [mechanics.md の機能名], だから: 何をすればよいか, まだ分からない: 理由つき1文 or '' }
// ★機能の名前は mechanics.md の表の1列目にあるものだけを使う(無い名前は落とす。手で書いた名前を混ぜない)
'use strict';
const fs = require('fs');
const path = require('path');

const MECH_FILE = path.join(__dirname, '..', '..', 'docs', 'playbot', 'reports', 'tier', 'mechanics.md');
const MECH_NAMES = (() => {
  try {
    return fs.readFileSync(MECH_FILE, 'utf8').split('\n')
      .filter((l) => /^\| /.test(l) && !/^\| (機能|---)/.test(l))
      .map((l) => l.split('|')[1].trim().replace(/\*\*/g, ''));
  } catch (e) { return []; }
})();
// mechanics.md にある名前だけを、重ねずに返す
const mech = (...names) => [...new Set(names.flat().filter((n) => n && MECH_NAMES.includes(n)))];
// その子の勇者特性の行(例: 「もち肌(モッチー・ミタラシ)」)。名前はかっこの中の「(」か「・」の直後から始まるものだけ(モッチーと剣士モッチーを分ける)
const traitOf = (monName) => MECH_NAMES.find((n) => new RegExp(`[(・]${monName}[)・]`).test(n)) || null;

const sgn = (x, f = 2) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(f)}` : '—');
const pm = (x, f = 2) => (Number.isFinite(x) ? `±${Math.abs(x).toFixed(f)}` : '—');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x * 100)}%` : '—');
// 平均と標準誤差(acc = { n, sum, sq })
const meanOf = (c) => (c && c.n ? c.sum / c.n : NaN);
const seOf = (c) => (c && c.n > 1 ? Math.sqrt(Math.max(0, c.sq / c.n - (c.sum / c.n) ** 2) / c.n) : NaN);
const rateSe = (p, n) => (n > 0 ? Math.sqrt(Math.max(0, p * (1 - p)) / n) : NaN);

function evidence({ source = 'シミュレーター', count = '', nums = [], mechs = [], therefore = '', unknown = '' }) {
  return { 出どころ: source, 回数: count, 数字: nums, 効いている機能: mech(mechs), だから: therefore, まだ分からない: unknown || '' };
}
// md に出す形(項目の下に字下げして並べる)
function evidenceMd(ev, indent = '  ') {
  const L = [];
  L.push(`${indent}- 根拠(${ev.出どころ}・回数): ${ev.回数}`);
  for (const x of ev.数字) L.push(`${indent}  - ${x.名前}: ${x.値}(基準: ${x.基準}・差 ${x.差}・ぶれ ${x.ぶれ})`);
  if (ev.効いている機能.length) L.push(`${indent}  - 効いている機能: ${ev.効いている機能.join('・')}`);
  if (ev.だから) L.push(`${indent}  - だから: ${ev.だから}`);
  if (ev.まだ分からない) L.push(`${indent}  - まだ分からない: ${ev.まだ分からない}`);
  return L;
}

module.exports = { MECH_NAMES, mech, traitOf, evidence, evidenceMd, sgn, pm, pct, meanOf, seOf, rateSe };

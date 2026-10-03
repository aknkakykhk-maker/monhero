// 助手みゅあの口調を見張る(2026-10-03)。
//
// 2026-10-03・ユーザー指示「みゅあの喋り資料も添付するから、みゅあの口調更新して」。
// LINE のやりとりのスクリーンショットから読み取った話し方を、みゅあのセリフ全部(約1,000本)へ入れた。
// 決めごとの正本は docs/spec/ASSISTANT_MUA_VOICE.md。
//
// 見るもの
//   ① みゅあのセリフを読めた(1本も拾えていないのに「OK」にならない)
//   ② 前の話し方の名残(「ぢゃん」・半角の ' 入りの顔文字 ( 'ω') )が無い
//   ③ ほかの助手の話し方(ききの「〜でつ」「〜まつ」、ドラの「おで」)が混ざっていない
//   ④ 絵文字は1本に2つまで(説明のセリフが頭に入らなくなる)
//   ⑤ 飾り(顔文字・絵文字・ｗ)は全体の15%〜50%(新しい口調が消えていない/盛りすぎていない)
// 親密度Lv1・2のセリフ(bond:[1,2])は、わざと「ていねい語」にしてある(assistant-bond-check.js)。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistants.js');
const L = fs.readFileSync(FILE, 'utf8').split('\n');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// addAssistantLinePack の範囲と担当(assistantId が無ければみゅあ)
const packRanges = [];
for (let i = 0; i < L.length; i++) {
  if (!/^addAssistantLinePack\(\{/.test(L[i])) continue;
  let j = i;
  while (j < L.length && !/^\}\);/.test(L[j])) j++;
  const owner = (L.slice(i, j + 1).join('\n').match(/assistantId:\s*'(\w+)'/) || [])[1] || 'mua';
  packRanges.push([i, j, owner]);
  i = j;
}
const packOwner = i => { for (const [a, b, o] of packRanges) if (i >= a && i <= b) return o; return null; };
const indent = s => s.match(/^\s*/)[0].length;
// 行の上にある、字下げの浅い「mua: [」「kiki: {」など
const keyOwner = i => {
  const ind = indent(L[i]);
  for (let k = i - 1; k >= 0 && k > i - 400; k--) {
    const m = L[k].match(/^(\s*)(mua|kiki|momosuke|dra)\s*:\s*[[{]/);
    if (m && m[1].length < ind) return m[2];
    if (/^(const|addAssistantLinePack|\}\);)/.test(L[k])) return null;
  }
  return null;
};
const constOf = i => {
  for (let k = i; k >= 0; k--) {
    const m = L[k].match(/^const ([A-Za-z0-9_]+)/);
    if (m) return m[1];
    if (/^addAssistantLinePack/.test(L[k])) return 'PACK';
  }
  return '?';
};

const re = /\bt:\s*'((?:[^'\\]|\\.)*)'/g;
const mua = [];
L.forEach((line, i) => {
  let m; re.lastIndex = 0;
  while ((m = re.exec(line))) {
    const who = line.match(/who:\s*'(\w+)'/);
    let owner = who ? who[1] : keyOwner(i);
    if (!owner) owner = packOwner(i);
    if (!owner && constOf(i) === 'ASSISTANT_SCENES') owner = 'mua';
    if (owner === 'mua') mua.push({ no: i + 1, text: m[1] });
  }
});
const show = arr => arr.slice(0, 5).map(l => `${l.no}行「${l.text}」`).join(' / ');

check('みゅあのセリフを読めた', mua.length >= 800, `${mua.length}本`);
const old = mua.filter(l => /ぢゃ|\\'ω\\'/.test(l.text));
check('前の話し方の名残(「ぢゃん」・( \'ω\') )が無い', old.length === 0, show(old));
const other = mua.filter(l => /でつ|まつ[。！？♪]|おで[はがのも]/.test(l.text));
check('ほかの助手の話し方(でつ・まつ・おで)が混ざっていない', other.length === 0, show(other));
const many = mua.filter(l => (l.text.match(/\p{Extended_Pictographic}/gu) || []).length > 2);
check('絵文字は1本に2つまで', many.length === 0, show(many));
const DECO = /[(（][^()（）]{1,12}[)）][ｦ-ﾟ]|[(（][^()（）]*[ω∀･˘ロ°´｀＾×][^()（）]*[)）]|\p{Extended_Pictographic}|ｗ/u;
const deco = mua.filter(l => DECO.test(l.text)).length;
const rate = mua.length ? deco / mua.length : 0;
check('飾り(顔文字・絵文字・ｗ)は全体の15%〜50%', rate >= 0.15 && rate <= 0.5, `${deco}本(${Math.round(rate * 100)}%)`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

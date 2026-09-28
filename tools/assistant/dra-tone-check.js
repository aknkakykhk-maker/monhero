// 助手ドラの口調を見張る(2026-09-28)。
//
// 2026-09-28・ユーザー指示「ドラの喋り方を記憶しなおして。いま『なんとかなんよ』みたいな喋り方を
// するけど、『なんとかだよ』とか『なんとかだ』みたいな感じだから直して記憶して」。
// 決めごとの正本は data/assistants.js の「ドラ・全画面の基本セリフ」の前のコメント。
//
// 見るもの
//   ① ドラのセリフのどこにも「〜んよ」が無い(「そうなんよ」「変わらんよ」)
//   ② 会話(who:'dra')・告知の読み上げ(dra: [...])・画面の案内(基本セリフ以外のパック)に、
//      続けて使うと関西弁の話し方になってしまう言い回しが無い
//      (「ほんまか」「せやけど」「〜やろ？」「〜とる」「〜へん」「〜ねん」「ええやん」「〜やで」「〜や！」)
// 基本セリフ(draCore / draVariety)は、9/17の決めごと「標準語が土台／要所だけ関西弁」で
// 少しだけ混ぜてあるので②の対象にしない(①は対象)。
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', '..', 'monster-hero', 'data', 'assistants.js');
const lines = fs.readFileSync(FILE, 'utf8').split('\n');
// 基本セリフのパック。ここだけは要所の関西弁を許す
const CORE_PACKS = new Set(['draCore', 'draVariety']);
// 「〜んように」(疲れんように・選べんようになってる)は語尾ではないので除く
const NANYO = /んよ(?!う)/;
// 「いや。」(否定の返事)・「新しなる」は拾わない(「更新しなくても」の「新しな」を誤って拾っていた)
const STRONG_KANSAI = /ほんま|せや|あかん|ねん|とる|とん[ねだ]|とった|ええやん|ええで|やろ(?!う)|やで|(?<!い)や[！。？]|(?<!い)や'|へん[。、！？']|新しなっ|細なる|気ぃ/;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

let pack = null;      // いま読んでいる addAssistantLinePack の id
let packOwner = null; // そのパックの assistantId
let arr = null;       // 告知台本などの「dra: [」の中か
const draLines = [];
lines.forEach((line, i) => {
  if (/^addAssistantLinePack\(/.test(line)) { pack = null; packOwner = null; }
  const id = line.match(/^\s*id:\s*'(\w+)'/);
  if (id && pack === null && packOwner === null) pack = id[1];
  const owner = line.match(/assistantId:\s*'(\w+)'/);
  if (owner) packOwner = owner[1];
  if (/^(const |\}\);)/.test(line)) { pack = null; packOwner = null; }
  const open = line.match(/^\s{4}(\w+):\s*\[\s*$/);
  if (open) arr = open[1];
  if (/^\s{4}\],?\s*$/.test(line)) arr = null;
  const text = line.match(/t:\s*'((?:[^'\\]|\\.)*)'/);
  if (!text) return;
  const who = line.match(/who:\s*'(\w+)'/);
  const isDra = who ? who[1] === 'dra' : (packOwner === 'dra' || arr === 'dra');
  if (!isDra) return;
  draLines.push({ no: i + 1, text: text[1], core: !who && packOwner === 'dra' && CORE_PACKS.has(pack) });
});

check('ドラのセリフを読めた', draLines.length >= 200, `${draLines.length}行`);
const nanyo = draLines.filter(l => NANYO.test(l.text));
check('ドラは「〜なんよ」「〜んよ」と言わない(「〜だよ」「〜だ」で話す)', nanyo.length === 0,
  nanyo.slice(0, 5).map(l => `${l.no}行「${l.text}」`).join(' / '));
const kansai = draLines.filter(l => !l.core && STRONG_KANSAI.test(l.text));
check('会話・告知・案内のドラは関西弁で話さない(標準語のくだけた口調)', kansai.length === 0,
  kansai.slice(0, 5).map(l => `${l.no}行「${l.text}」`).join(' / '));
console.log(`   基本セリフ(要所の関西弁を許す): ${draLines.filter(l => l.core).length}行 / それ以外: ${draLines.filter(l => !l.core).length}行`);

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

// お話の台詞の折り方(storyChunkLines)を確かめる(2026-11-04 社長「セリフの改行の位置がちょこちょこ悪い」)。
//
//   node tools/boot/story-chunk-wrap-check.js
//
// 収まる幅があるのに、文の途中(「見られたくなかった／んじゃないかな」「かせぐも／よし。」)で折れていた。
// 台詞を文の切れ目(。！？の後・空白・「」のまとまり。長い文はさらに「、」の後)のかたまりに分けて、そこで折る。
//   ・かたまりの切れ目が文の切れ目になっているか(文の途中で切らない・「」の中を切らない)
//   ・かたまりで折ると3行を超える台詞は、今までどおりの折り方に戻すか(欄からはみ出さない)
//   ・全部のお話の台詞で、かたまりをつなぐと元の台詞に戻るか(字を落とさない・足さない)
//   ・お話の画面(60-app.jsx)が、台詞の欄と吹き出しの両方でこの折り方を使っているか
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const asSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/21-assistant.jsx'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
const dataSrc = fs.readFileSync(path.join(root, 'monster-hero/data/assistants.js'), 'utf8');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };

const pick = (name) => {
  const i = asSrc.indexOf(`const ${name} = `);
  if (i < 0) return '';
  const j = asSrc.indexOf('\n};\n', i);
  const k = asSrc.indexOf('\n', i);
  // 1行で終わる定義と、複数行の定義の両方
  return asSrc.slice(i, asSrc[k - 1] === ';' ? k + 1 : j + 4);
};
const ctx = {};
vm.createContext(ctx);
vm.runInContext(['storyTextUnits', 'storyTextLines', 'storySplitPages', 'STORY_EMOTICON_HEAD_RE', 'STORY_NOBREAK_SPLIT_RE', 'storyEmoticonParts', 'storyChunkLines'].map(pick).join('\n') + '\nglobalThis.F={storyChunkLines,storySplitPages,storyEmoticonParts};', ctx);
const { storyChunkLines, storySplitPages, storyEmoticonParts } = ctx.F;
check('storyChunkLines が 21-assistant.jsx にある', typeof storyChunkLines === 'function');
const joined = (cs) => cs.map((c, i) => (i > 0 && c.sp ? ' ' : '') + c.t).join('');
const heads = (cs) => cs.map((c) => c.t);

// 例(社長が見ていた第1話の台詞。縦390の台詞の欄は1行17字、吹き出しは16字)
let r = storyChunkLines('見られたくなかったんじゃないかな。……無理には開けないほうがいい', 17, 3);
check('「。……」で分けて、文の途中で切らない', !!r && r[0].t === '見られたくなかったんじゃないかな。', r && heads(r).join(' / '));
r = storyChunkLines('古い箱でつね。鎖がぐるぐるに巻かれてまつ。まんなかに、鍵穴がひとつ……。', 17, 3);
check('3つの文は3つのかたまり', !!r && r.length === 3 && r[2].t.startsWith('まんなかに'), r && heads(r).join(' / '));
r = storyChunkLines('長いほうで粘るもよし、ショートで回数かせぐもよし。好きなほうでどうぞ笑', 17, 3);
check('長い文は「、」の後でも分ける', !!r && heads(r).includes('ショートで回数かせぐもよし。'), r && heads(r).join(' / '));
r = storyChunkLines('ねえ、「鍵の向こう側へ」って知ってる？ かっこいいよね', 17, 3);
check('「」の中は切らない・空白で分ける', !!r && heads(r).includes('「鍵の向こう側へ」って知ってる？') && r[r.length - 1].sp === true, r && heads(r).join(' / '));
const nb = (t) => storyEmoticonParts(t).filter((p) => p.emo).map((p) => p.t);
check('顔文字は途中で折らない', nb('好きかもしれまつ(˘ω˘)').join() === '(˘ω˘)', nb('好きかもしれまつ(˘ω˘)').join());
check('数と単位は途中で折らない(5ターン目・1枚)', nb('3ターン目と5ターン目に、1ターンに1枚まで').join() === '3ターン目,5ターン目,1ターン,1枚', nb('3ターン目と5ターン目に、1ターンに1枚まで').join());
check('折らない所以外の字はそのまま残る', storyEmoticonParts('ためて(´ー`*)5倍だよ').map((p) => p.t).join('') === 'ためて(´ー`*)5倍だよ');
check('1行に収まる台詞はそのまま(null)', storyChunkLines('……静かに。', 17, 3) === null);
check('改行(\\n)を書いた台詞はそのまま(null)', storyChunkLines('すばやく攻める\nチーム', 6, 3) === null);
r = storyChunkLines('あ。い。う。え。お。か。き。く。', 2, 3);
check('かたまりで折ると3行を超えるなら null(今までどおり)', r === null, r && heads(r).join(' / '));

// 全部のお話の台詞(ページに分けたあと)で、字を落とさない・3行の見込みを超えない
const dctx = {};
vm.createContext(dctx);
vm.runInContext(dataSrc + '\nglobalThis.R=EVENT_REPLAYS;', dctx);
const lines = [];
for (const ev of dctx.R || []) for (const l of Array.isArray(ev.script) ? ev.script : []) if (l && typeof l.t === 'string') lines.push(l.t);
let bad = [], used = 0;
for (const t of lines) for (const cap of [16, 17, 25, 27]) for (const page of storySplitPages(t, cap - 4, 3)) {
  const cs = storyChunkLines(page, cap, 3);
  if (!cs) continue;
  used++;
  if (joined(cs).replace(/[ 　]/g, '') !== page.replace(/[ 　]/g, '')) bad.push(page);
}
check(`全部のお話の台詞(${lines.length}本)で、かたまりをつなぐと元の台詞に戻る`, lines.length > 100 && bad.length === 0, bad.slice(0, 3).join(' / '));
check('かたまりの折り方が実際に使われている', used > 50, `${used}ページ`);

// お話の画面が使っているか
check('台詞の欄と吹き出しの両方で storyLineNodes を使う', (appSrc.match(/storyLineNodes\(storyTextAt\(/g) || []).length === 2);
check('かたまりは inline-block(そこで折れる)', /data-story-chunk style=\{\{display:'inline-block',maxWidth:'100%'\}\}/.test(appSrc));
check('かたまりで並べるときは balance をやめる', /storyLineStyle=[\s\S]{0,300}textWrap:'wrap'/.test(appSrc));
check('1行の字数は実際の欄の幅から(台詞の欄・吹き出し)', /const storyCapBottom=Math\.floor\(\(storyBoxW-64-/.test(appSrc) && /const storyCapBubble=Math\.floor\(/.test(appSrc));

console.log(failed ? `\n${failed}件 NG` : '\nすべてOK');
process.exit(failed ? 1 : 0);

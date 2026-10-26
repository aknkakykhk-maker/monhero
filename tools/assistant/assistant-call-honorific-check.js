// 助手の呼び方で敬称が重ならないか(2026-10-21 改善部の見直し N1「モンヒロくん」→「モンヒロくんさん」「モンヒロくんちん」)。
//
//   node tools/assistant/assistant-call-honorific-check.js
//
//   ① 名前の終わりが くん・さん・ちゃん・様(ひらがな・カタカナ・漢字の揺れも)なら、どの助手・どの段でも名前だけで呼ぶ
//   ② それ以外の名前は今までどおり(さん・ちん・ちー・っち が付く)
//   ③ 選んだ呼び方(Lv6から)の型でも、{name} のすぐ後ろの敬称だけを付けない。自由に書いた言葉(「先輩」など)は残す。保存値は変えない
//   ④ セリフの {name}(assistantSpeak)・おしゃべり(callName)・呼び方のプレビューが同じ決まりを通る
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..', '..');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failed++; };
const ctx = {};
vm.createContext(ctx);
vm.runInContext(`${fs.readFileSync(path.join(ROOT, 'monster-hero/data/assistants.js'), 'utf8')}
this.o = { assistantCallName, assistantSpeak, assistantFillCallTemplate, assistantCallSuffixes, ASSISTANTS, ASSISTANT_BOND_LEVELS };`, ctx);
const o = ctx.o;
const ids = o.ASSISTANTS.map(a => a.id);
const levels = o.ASSISTANT_BOND_LEVELS.map(s => s.level);
// ①
const honorNames = ['モンヒロくん', 'モンヒロクン', '田中君', 'あつさん', 'ケンサン', 'さくらちゃん', 'サクラチャン', 'タロウ様', 'タロウさま', 'タロウサマ'];
const bad = [];
for (const n of honorNames) for (const id of ids) for (const lv of levels) {
  const call = o.assistantCallName(n, lv, null, id);
  if (call !== n) bad.push(`${id} Lv${lv} ${n}→${call}`);
}
check('① 敬称で終わる名前は、どの助手・どの段でも名前だけで呼ぶ', bad.length === 0, bad.slice(0, 4).join(' / '));
// ②
check('② ふつうの名前は今までどおり(みゅあ Lv1 さん・Lv5 ちん)', o.assistantCallName('あつ', 1, null, 'mua') === 'あつさん' && o.assistantCallName('あつ', 5, null, 'mua') === 'あつちん');
check('② ききは Lv4 から ちー、ももすけは Lv3 から っち', o.assistantCallName('あつ', 4, null, 'kiki') === 'あつちー' && o.assistantCallName('あつ', 3, null, 'momosuke') === 'あつっち');
check('② 「くん」が名前の途中にあるだけなら付ける', o.assistantCallName('くんぺい', 1, null, 'mua') === 'くんぺいさん');
check('② 敬称は呼び方の型から集める(書き写さない)', ['さん', 'ちん', 'ちー', 'っち'].every(x => o.assistantCallSuffixes().includes(x)), o.assistantCallSuffixes().join(','));
// ③
check('③ 選んだ呼び方の型でも敬称を重ねない', o.assistantCallName('モンヒロくん', 8, '{name}ちん', 'mua') === 'モンヒロくん' && o.assistantCallName('モンヒロくん', 8, '{name}さん', 'kiki') === 'モンヒロくん');
check('③ 自由に書いた言葉は残す', o.assistantCallName('モンヒロくん', 8, '{name}先輩', 'mua') === 'モンヒロくん先輩' && o.assistantCallName('モンヒロくん', 8, 'ご主人さま', 'mua') === 'ご主人さま');
check('③ Lv6 未満では選んだ呼び方を使わない(今までどおり)', o.assistantCallName('あつ', 5, '{name}先輩', 'mua') === 'あつちん');
// ④
check('④ セリフの {name} も同じ', o.assistantSpeak('{name}、いこ！ {name}ってば', 'モンヒロくん', 5, null, 'mua') === 'モンヒロくん、いこ！ モンヒロくんってば');
const app = fs.readFileSync(path.join(ROOT, 'monster-hero/src/parts/60-app.jsx'), 'utf8');
check('④ おしゃべりの呼び方は assistantCallName から', /callName=\{assistantCallName\(breederName,lv,assistantCallStyles\[id\]\|\|null,id\)\}/.test(app));
check('④ 呼び方のプレビューも同じ決まりを通る', app.includes("assistantFillCallTemplate(tempCallStyle,breederName||'あなた')"));
console.log(failed ? `\n${failed}件 NG` : '\nすべて OK');
process.exit(failed ? 1 : 0);

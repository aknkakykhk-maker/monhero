// 道具を贈ったときの台詞(コトバ・ツムギ)を data/assistants.js へ取り込む(2026-11-08 オクリモノ・lines/ORDER-GIFT.md)
//   node tools/assistant/life-gift-lines-import.js          取り込む(ASSISTANT_LIFE_GIFT_LINES・ASSISTANT_LIFE_GIFT_HINT_LINES の1行を書き直す)
//   node tools/assistant/life-gift-lines-import.js --check  書き直さずに、ファイルと assistants.js がそろっているかだけ見る
// 読むファイル: docs/progress/assistant-peer/lines/kotoba-gift.txt・tsumugi-gift.txt(無いものは飛ばす)
//   gift <人> item=<key> like=<like|mid|bad> | <表情> <セリフ>   … 好みの表(ASSISTANT_LIFE_GIFT_LIKES)と合わない行は取り込まない(NG で知らせる)
//   hint <人> item=<key> | <表情> <セリフ>                       … 好きな物だけ
//   furn・furnuse・visitfurn は家具(段階B)なので、ここでは読まない
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const DATA = path.join(root, 'monster-hero/data/assistants.js');
const FILES = ['kotoba-gift.txt', 'tsumugi-gift.txt'].map(f => path.join(root, 'docs/progress/assistant-peer/lines', f)).filter(f => fs.existsSync(f));
const EXPR = ['normal', 'happy', 'wink', 'surprise', 'troubled', 'angry', 'crying', 'excited'];
const src = fs.readFileSync(DATA, 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src.slice(src.indexOf('const ASSISTANT_LIFE_GIFTS = '), src.indexOf('// 好みで変わる量')), ctx);
const GIFTS = vm.runInContext('ASSISTANT_LIFE_GIFTS', ctx), LIKES = vm.runInContext('ASSISTANT_LIFE_GIFT_LIKES', ctx);
const likeOf = (who, key) => (LIKES[who].like.includes(key) ? 'like' : LIKES[who].bad.includes(key) ? 'bad' : 'mid');
const keys = new Set(GIFTS.map(g => g.key));
const lines = {}, hints = {}, ng = [];
for (const f of FILES) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
    const l = raw.trim();
    const m = l.match(/^(gift|hint) (\w+) item=(\w+)(?: like=(\w+))? \| (\w+) (.+)$/);
    if (!m) return;
    const [, kind, who, key, like, e, t] = m;
    const at = `${path.basename(f)}:${i + 1}`;
    // 家具を教えてくれるひとこと(hint item=sofa など)は家具の段階Bで取り込む
    const FURN = ['sofa', 'bear', 'plant', 'record', 'nyacushion', 'starpic', 'trophy', 'bookshelf', 'heartmirror', 'lantern', 'mirrorball', 'windbell'];
    if (kind === 'hint' && FURN.includes(key)) return;
    if (!LIKES[who] || !keys.has(key)) { ng.push(`${at} 知らない助手か道具`); return; }
    if (!EXPR.includes(e)) { ng.push(`${at} 表情 ${e}`); return; }
    if (t.length > 60 || /ブリーダー|(この|あの|その)子(?![供ど])/.test(t)) { ng.push(`${at} 60字超えか「ブリーダー」「子」`); return; }
    if (kind === 'gift') {
      if (like !== likeOf(who, key)) { ng.push(`${at} 好みが表と違う(${like}・表は ${likeOf(who, key)})`); return; }
      ((lines[who] = lines[who] || {})[key] = lines[who][key] || []).push({ like, e, t });
    } else {
      if (likeOf(who, key) !== 'like') { ng.push(`${at} 好きな物ではない`); return; }
      (hints[who] = hints[who] || {})[key] = { e, t };
    }
  });
}
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const lineL = `const ASSISTANT_LIFE_GIFT_LINES = Object.freeze(${JSON.stringify(sortObj(lines))});`;
const lineH = `const ASSISTANT_LIFE_GIFT_HINT_LINES = Object.freeze(${JSON.stringify(sortObj(hints))});`;
const reL = /^const ASSISTANT_LIFE_GIFT_LINES = Object\.freeze\(.*\);$/m, reH = /^const ASSISTANT_LIFE_GIFT_HINT_LINES = Object\.freeze\(.*\);$/m;
const n = Object.values(lines).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b.length, 0), 0);
const nh = Object.values(hints).reduce((s, o) => s + Object.keys(o).length, 0);
console.log(`gift ${n}本(${Object.keys(lines).join(' ')})・hint ${nh}本 ・ 取り込まなかった行 ${ng.length}`);
ng.forEach(x => console.log(`NG: ${x}`));
if (process.argv.includes('--check')) {
  const same = (src.match(reL) || [''])[0] === lineL && (src.match(reH) || [''])[0] === lineH;
  console.log(same && !ng.length ? 'OK: 台詞ファイルと assistants.js がそろっている' : 'NG: 台詞ファイルと assistants.js がずれている(取り込み直す)');
  process.exit(same && !ng.length ? 0 : 1);
}
fs.writeFileSync(DATA, src.replace(reL, lineL).replace(reH, lineH));
console.log('assistants.js を書き直しました');

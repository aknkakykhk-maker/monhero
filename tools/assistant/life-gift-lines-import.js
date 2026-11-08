// 道具を贈ったときの台詞(コトバ・ツムギ)を data/assistants.js へ取り込む(2026-11-08 オクリモノ・lines/ORDER-GIFT.md)
//   node tools/assistant/life-gift-lines-import.js          取り込む(ASSISTANT_LIFE_GIFT_LINES・ASSISTANT_LIFE_GIFT_HINT_LINES の1行を書き直す)
//   node tools/assistant/life-gift-lines-import.js --check  書き直さずに、ファイルと assistants.js がそろっているかだけ見る
// 読むファイル: docs/progress/assistant-peer/lines/kotoba-gift.txt・tsumugi-gift.txt(無いものは飛ばす)
//   gift <人> item=<key> like=<like|mid|bad> | <表情> <セリフ>   … 好みの表(ASSISTANT_LIFE_GIFT_LIKES)と合わない行は取り込まない(NG で知らせる)
//   hint <人> item=<key> | <表情> <セリフ>                       … 好きな物だけ(道具も家具も)
//   furn <人> item=<家具> like=… | <表情> <セリフ> … 家具をもらったとき(2026-11-08 段階B)。furnuse・visitfurn は段階C
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
vm.runInContext(src.slice(src.indexOf('const ASSISTANT_LIFE_FURNITURE = '), src.indexOf('const ASSISTANT_LIFE_FURN_PLAYER')), ctx);
const GIFTS = vm.runInContext('ASSISTANT_LIFE_GIFTS', ctx), LIKES = vm.runInContext('ASSISTANT_LIFE_GIFT_LIKES', ctx);
const FURNS = vm.runInContext('ASSISTANT_LIFE_FURNITURE', ctx), FLIKES = vm.runInContext('ASSISTANT_LIFE_FURN_LIKES', ctx);
const fkeys = new Set(FURNS.map(f => f.key));
const likeOf = (who, key) => { const t = fkeys.has(key) ? FLIKES[who] : LIKES[who]; return t.like.includes(key) ? 'like' : t.bad.includes(key) ? 'bad' : 'mid'; };
const keys = new Set(GIFTS.map(g => g.key));
const lines = {}, hints = {}, furn = {}, ng = [];
for (const f of FILES) {
  fs.readFileSync(f, 'utf8').split('\n').forEach((raw, i) => {
    const l = raw.trim();
    const m = l.match(/^(gift|hint|furn) (\w+) item=(\w+)(?: like=(\w+))? \| (.+)$/);
    if (!m) return;
    const [, kind, who, key, like, rest] = m;
    const at = `${path.basename(f)}:${i + 1}`;
    if (!LIKES[who] || !(keys.has(key) || fkeys.has(key)) || (kind === 'gift' && !keys.has(key)) || (kind === 'furn' && !fkeys.has(key))) { ng.push(`${at} 知らない助手か道具・家具`); return; }
    // 1行に「| 表情 セリフ」が1つ(gift・hint)か2つまで(furn)
    const segs = rest.split(' | ').map(x => { const mm = x.trim().match(/^(\w+) (.+)$/); return mm ? { e: mm[1], t: mm[2] } : null; });
    if (segs.some(x => !x) || segs.length > (kind === 'furn' ? 2 : 1)) { ng.push(`${at} 形が違う`); return; }
    if (segs.some(x => !EXPR.includes(x.e))) { ng.push(`${at} 表情`); return; }
    if (segs.some(x => x.t.length > 60 || /ブリーダー|(この|あの|その)子(?![供ど])/.test(x.t))) { ng.push(`${at} 60字超えか「ブリーダー」「子」`); return; }
    if (kind === 'gift' || kind === 'furn') {
      if (like !== likeOf(who, key)) { ng.push(`${at} 好みが表と違う(${like}・表は ${likeOf(who, key)})`); return; }
      if (kind === 'gift') ((lines[who] = lines[who] || {})[key] = lines[who][key] || []).push({ like, ...segs[0] });
      else ((furn[who] = furn[who] || {})[key] = furn[who][key] || []).push({ like, lines: segs });
    } else {
      if (likeOf(who, key) !== 'like') { ng.push(`${at} 好きな物ではない`); return; }
      (hints[who] = hints[who] || {})[key] = segs[0];
    }
  });
}
const sortObj = (o) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
const lineL = `const ASSISTANT_LIFE_GIFT_LINES = Object.freeze(${JSON.stringify(sortObj(lines))});`;
const lineH = `const ASSISTANT_LIFE_GIFT_HINT_LINES = Object.freeze(${JSON.stringify(sortObj(hints))});`;
const lineF = `const ASSISTANT_LIFE_FURN_LINES = Object.freeze(${JSON.stringify(sortObj(furn))});`;
const reF = /^const ASSISTANT_LIFE_FURN_LINES = Object\.freeze\(.*\);$/m;
const reL = /^const ASSISTANT_LIFE_GIFT_LINES = Object\.freeze\(.*\);$/m, reH = /^const ASSISTANT_LIFE_GIFT_HINT_LINES = Object\.freeze\(.*\);$/m;
const n = Object.values(lines).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b.length, 0), 0);
const nh = Object.values(hints).reduce((s, o) => s + Object.keys(o).length, 0);
const nf = Object.values(furn).reduce((s, o) => s + Object.values(o).reduce((a, b) => a + b.length, 0), 0);
console.log(`gift ${n}本(${Object.keys(lines).join(' ')})・hint ${nh}本・furn ${nf}本 ・ 取り込まなかった行 ${ng.length}`);
ng.forEach(x => console.log(`NG: ${x}`));
if (process.argv.includes('--check')) {
  const same = (src.match(reL) || [''])[0] === lineL && (src.match(reH) || [''])[0] === lineH && (src.match(reF) || [''])[0] === lineF;
  console.log(same && !ng.length ? 'OK: 台詞ファイルと assistants.js がそろっている' : 'NG: 台詞ファイルと assistants.js がずれている(取り込み直す)');
  process.exit(same && !ng.length ? 0 : 1);
}
fs.writeFileSync(DATA, src.replace(reL, lineL).replace(reH, lineH).replace(reF, lineF));
console.log('assistants.js を書き直しました');

// ランキングに出すモンスターアイコンが、ID・名前・古い記録のいずれからも解決できるか確認する。
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const a=src.indexOf('const rankingMonsterIdOf'),b=src.indexOf('\nconst splitRankingParty');
const ctx={ALL_PLAYER_MONSTERS:{Mocchi:{name:'モッチー',emoji:'🍡',iconUrl:'MOCCHI'},Suezo:{name:'スエゾー',emoji:'👁️',iconUrl:'SUEZO'}}};
vm.createContext(ctx);
vm.runInContext(`${src.slice(a,b)}\n;globalThis.img=rankingMemberImage;globalThis.idOf=rankingMonsterIdOf;`,ctx);
// 新しい記録(IDあり)
assert.strictEqual(ctx.img({baseId:'Mocchi',name:'モッチー'}),'MOCCHI');
// 古い記録(IDなし・名前だけ) → 名前から同梱の絵を引く
assert.strictEqual(ctx.img({name:'スエゾー'}),'SUEZO');
// 種類が分からない記録 → 埋め込まれた絵をそのまま使う
assert.strictEqual(ctx.img({name:'謎モン',imgUrl:'OLD'}),'OLD');
// どちらも無ければnull(呼び出し側が絵文字にする)
assert.strictEqual(ctx.img({name:'謎モン'}),null);
console.log('OK: ランキングのモンスターアイコン解決(ID/名前/旧記録)');

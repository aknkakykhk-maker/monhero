// 同じ人・同じ種類のマスモンが、個体ID付きの記録と古い記録に分かれて
// 二重に並ばないことを確認する。
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const a=src.indexOf('const collectBondRankingEntries'),b=src.indexOf('\nconst rankingMonsterIdOf');
const ctx={ALL_PLAYER_MONSTERS:{Ham:{name:'ハム',emoji:'🐹',iconUrl:'HAM'},Zan:{name:'ザン',emoji:'🗡️',iconUrl:'ZAN'}}};
vm.createContext(ctx);
vm.runInContext(`${src.slice(a,b)}\n;globalThis.collect=collectBondRankingEntries;`,ctx);

// あつの記録。新しい記録は masuId 付き、古い記録は masuId 無し(名前だけ)。
const pool={Normal:[
  {userName:'あつ',party:[{masuId:'h1',baseId:'Ham',name:'ハム',bondLevel:12},{masuId:'z1',baseId:'Zan',name:'ザン',bondLevel:9}]},
  {userName:'あつ',party:[{name:'ハム',bondLevel:10},{name:'ザン',bondLevel:11}]},
]};
const out=ctx.collect(pool);
const named=n=>out.filter(x=>x.userName==='あつ'&&x.monName===n);
assert.strictEqual(named('ハム').length,1,'ハムが重複している');
assert.strictEqual(named('ザン').length,1,'ザンが重複している');
assert.strictEqual(named('ハム')[0].bondLevel,12);
// 古い記録の方が高いLvなら、その値を個体側へ引き継ぐ
assert.strictEqual(named('ザン')[0].bondLevel,11);
console.log('OK: 個体IDありと古い記録が二重に並ばない');

// 同じ種類でも別個体(masuIdが違う)なら、両方とも並ぶ
const two=ctx.collect({Normal:[{userName:'あつ',party:[{masuId:'h1',baseId:'Ham',name:'ハム',bondLevel:12},{masuId:'h2',baseId:'Ham',name:'ハム',bondLevel:7}]}]});
assert.strictEqual(two.filter(x=>x.monName==='ハム').length,2,'別個体は2件出す');
console.log('OK: 同じ種類でも別個体は2件とも並ぶ');

// 個体IDの記録が無ければ、古い記録はそのまま出す
const legacyOnly=ctx.collect({Normal:[{userName:'あつ',party:[{name:'ハム',bondLevel:5}]}]});
assert.strictEqual(legacyOnly.length,1);
console.log('OK: 古い記録だけのときはそのまま並ぶ');

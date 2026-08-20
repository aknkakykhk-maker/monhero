// スコアランキングの編成に、そのプレイ時点の絆Lvが添えられるか確認する。
// bondLevel は記録にもとから入っているため、表示に追加の通信は発生しない。
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('monster-hero/src/game-system.jsx','utf8');
const a=src.indexOf('const rankingMemberLevel'),b=src.indexOf('\nconst rankingMemberImage');
const ctx={};vm.createContext(ctx);
vm.runInContext(`${src.slice(a,b)}\n;globalThis.lv=rankingMemberLevel;`,ctx);

assert.strictEqual(ctx.lv({bondLevel:12}),12);
assert.strictEqual(ctx.lv({bondLevel:'7'}),7,'文字列でも数値として扱う');
assert.strictEqual(ctx.lv({bondLevel:0}),null,'絆Lv0は出さない');
assert.strictEqual(ctx.lv({bondLevel:null}),null,'マスモンでなければ出さない');
assert.strictEqual(ctx.lv({}),null);
assert.strictEqual(ctx.lv(null),null);
console.log('OK: 編成の絆Lv表示の判定');

// 画面側の結線と、通信が増えていないこと
const has=n=>src.includes(n);
// 絆Lvはパーティー詳細で全員ぶん出す(一覧には編成を出さない)
assert(has('const bond=rankingMemberLevel(m);'),'詳細で絆Lvを読む');
assert(has("{bond!=null?`絆Lv.${bond}`:'絆Lv情報なし'}"),'絆Lvが無い記録でも表示が崩れない');
assert(has("RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon'"),'取得する列は増えていない');
console.log('OK: 勇者モン・供モンの両方に表示し、取得する列は増えていない');

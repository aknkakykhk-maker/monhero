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
// 取得する列を不用意に増やさない。重いのは画像と編成(party)なので、そこを見張る。
// created_at は日時1つぶん(数十バイト)で、同じ人の記録から「最後に分かっている枠」を
// 選ぶのに要る(2026-09-16・docs/spec/BREEDER_PROFILE.md §2.3)。件数の決まっている
// 一覧だけに足しており、全件をページ送りで読むブリーダーLv(RANKING_SELECT_BREEDER)には足さない
assert(has("RANKING_SELECT_FULL = 'user_name,hero,party,score,level,icon,created_at'"),
  '取得する列は created_at までで、それ以上増えていない');
assert(has("RANKING_SELECT_BREEDER = 'user_name,level,icon'"),
  'ブリーダーLvは全件を読むので、列を増やさない');
assert(!/RANKING_SELECT_(FULL|BREEDER|NO_PARTY) = '[^']*(img|image|colors|detail)/.test(src),
  '画像や育成の中身は取得しない(重い)');
console.log('OK: 勇者モン・供モンの両方に表示し、取得する列は増えていない');

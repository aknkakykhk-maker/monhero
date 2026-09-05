#!/usr/bin/env node
// アシストカードの編成が、いつでも「ちょうど6枚」になるかを確かめる。
//
//   node tools/teaching-roster-size-check.js
//
// 【なぜ要るか】
// 編成の保存が無い人の既定値を「解放済みカード全部」にしていたため、
// ブリーダーマーケットでカードを買って解放が7枚以上になると、編成もその枚数になった。
// 画面には「編成中 9/6」と出て「決定」も押せず、バトルでは手札が溢れて
// 6枚ぶんの場所に3枚はみ出していた
// (2026-09-05・ユーザー指摘「6枚しか編成出来ないのに9枚編成になってる」)。
//
// 保存値そのものは壊さず、**読むときに正規化する**方針にしたので、
// その正規化が効いているかをここで見張る。
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const ROOT=path.resolve(__dirname,'..');
let failed=0;
const ok=(name,cond,detail='')=>{console.log(`${cond?'OK':'NG'}: ${name}${detail?` — ${detail}`:''}`);if(!cond)failed++;};

// breeder.js はアイコン画像の定数(images-*.js)に頼っているので、丸ごとは読めない。
// 必要な定義（カード一覧〜正規化まで）だけを切り出して動かす。
const breeder=fs.readFileSync(path.join(ROOT,'monster-hero/data/breeder.js'),'utf8');
const from=breeder.indexOf('const TEACHING_CARDS');
const to=breeder.indexOf('// ブリーダーマーケット:');
if(from<0||to<0||to<=from){console.log('NG: breeder.js からカードの定義を取り出せません');process.exit(1);}
// 切り出した中に出てくるアイコンの定数は画像(images-*.js)なので、ここでは中身を見ない。
// 名前の付け方が一定ではない(◯◯_FACE_ICON / ◯◯_ICON)ので、
// 「icon: に書かれている大文字の名前」をまとめて拾い、空文字で用意して動かす。
const source=breeder.slice(from,to);
const iconNames=[...new Set((source.match(/icon:\s*([A-Z][A-Z0-9_]*)/g)||[])
  .map(hit=>hit.replace(/^icon:\s*/,'')))];
const ctx={console,Object,Number,Math,Array,JSON,String,Boolean,isNaN,parseInt,parseFloat,Set,Map};
vm.createContext(ctx);
vm.runInContext(iconNames.map(name=>`const ${name}='';`).join('\n')+'\n'+source
  +'\nthis.out={TEACHING_CARDS,STARTER_TEACHING_IDS,TEACHING_ROSTER_SIZE,normalizeTeachingRoster};',ctx);
const {TEACHING_CARDS,STARTER_TEACHING_IDS,TEACHING_ROSTER_SIZE,normalizeTeachingRoster}=ctx.out;

ok('持ち込める枚数が独立した定数になっている',TEACHING_ROSTER_SIZE===6,`TEACHING_ROSTER_SIZE=${TEACHING_ROSTER_SIZE}`);
ok('最初から持っているカードはちょうどその枚数',STARTER_TEACHING_IDS.length===TEACHING_ROSTER_SIZE,
  `${STARTER_TEACHING_IDS.length}枚`);

const allIds=TEACHING_CARDS.map(card=>card.id);
// 実際に起こったケース: 解放9枚・保存なし
const unlocked9=allIds.slice(0,9);
ok('解放が9枚でも編成は6枚（保存が無いとき）',
  normalizeTeachingRoster(null,unlocked9).length===TEACHING_ROSTER_SIZE,
  `${normalizeTeachingRoster(null,unlocked9).length}枚`);
ok('解放が9枚でも編成は6枚（保存が9枚のとき）',
  normalizeTeachingRoster(unlocked9,unlocked9).length===TEACHING_ROSTER_SIZE,
  `${normalizeTeachingRoster(unlocked9,unlocked9).length}枚`);
// 全部解放しても増えない
ok('全部解放しても編成は6枚',
  normalizeTeachingRoster(allIds,allIds).length===TEACHING_ROSTER_SIZE,
  `解放${allIds.length}枚 → ${normalizeTeachingRoster(allIds,allIds).length}枚`);

// 壊れた保存でも落ちない・枚数が合う
for(const [label,saved] of [['null',null],['文字列','oryo'],['空配列',[]],
  ['数字まじり',['oryo',1,null,'dra',{},'atsu']],['重複だらけ',['oryo','oryo','oryo']],
  ['知らないid',['nope','oryo','xxx']]]){
  const result=normalizeTeachingRoster(saved,unlocked9);
  ok(`壊れた保存(${label})でも6枚になる`,Array.isArray(result)&&result.length===TEACHING_ROSTER_SIZE,
    `${Array.isArray(result)?result.length:'配列でない'}枚`);
}

// 解放していないカードは持ち込めない
const picked=normalizeTeachingRoster(['nope','ghost',...STARTER_TEACHING_IDS],STARTER_TEACHING_IDS);
ok('解放していないカードは編成に入らない',picked.every(id=>STARTER_TEACHING_IDS.includes(id)),picked.join(','));
ok('同じカードが二重に入らない',new Set(picked).size===picked.length);

// プレイヤーが選んだ並びを勝手に変えない
const reordered=[...STARTER_TEACHING_IDS].reverse();
ok('保存されている並びは変えない',
  normalizeTeachingRoster(reordered,STARTER_TEACHING_IDS).join(',')===reordered.join(','),
  normalizeTeachingRoster(reordered,STARTER_TEACHING_IDS).join(','));

// 本体が正規化を通しているか（通し忘れると保存の生値がそのまま入る）
const game=fs.readFileSync(path.join(ROOT,'monster-hero/src/game-system.jsx'),'utf8');
ok('読み込みで正規化を通している',
  /normalizeTeachingRoster\(\s*\n?\s*await storeGet\('mh_teaching_roster'/.test(game));
ok('読み込みの既定値を「解放済み全部」に戻していない',
  !/storeGet\('mh_teaching_roster', savedUnlockedTeachings/.test(game));
ok('編成画面を開くときも正規化を通している',
  (game.match(/setDraftTeachingRoster\(normalizeTeachingRoster\(/g)||[]).length>=2);
ok('選ぶときに6枚を超えられない',
  /if \(prev\.length >= TEACHING_ROSTER_SIZE\) return prev;/.test(game));
ok('枚数の判断に「最初から持っている枚数」を使い回していない',
  !game.includes('STARTER_TEACHING_IDS.length'));

console.log(failed?`\n${failed}件のNGがあります`:'\nすべてOK');
process.exit(failed?1:0);

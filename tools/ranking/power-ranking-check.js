// 総合力ランキング(バトルモード選択画面のタブ)を確認する。
//
//   node tools/ranking/power-ranking-check.js
//
// 総合力ランキングは、絆Lvランキングとまったく同じ一覧(1人 × 1個体)を
// 「その記録を出したときの総合力」で並べ直したものとして作ってある。
// つまり新しい通信も新しいテーブルも増やしていない。ここで見張るのは次の4点。
//
//   1. 並べ替えの本体(collectPowerRankingEntries)が、実際に総合力の高い順になるか
//   2. 総合力が残っていない古い記録を、参考値で補ったり「情報なし」の行にしたりしていないか
//   3. 種族タブが絆Lvと同じ血統id(dexMainLineages / bondEntryLineageId)で絞れているか
//   4. タブを押したときの取得が levelKind='bond' になっているか
//      (タブ名の 'power' をそのまま渡すと、存在しない取得になって一覧が永久に空になる)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { REPO_ROOT } = require('../harness');

const src = fs.readFileSync(path.join(REPO_ROOT, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// ---- 1・2. 並べ替えの本体を実際に動かす ----
const start = src.indexOf('const collectPowerRankingEntries');
const end = src.indexOf('\n// ランキングに出すモンスターの絵', start);
check('collectPowerRankingEntries が game-system.jsx にある', start >= 0 && end > start);

const context = {};
vm.createContext(context);
// 切り出した末尾が // コメントの場合、続けて書くと同じ行になって無効化されるため改行を挟む
vm.runInContext(`${src.slice(start, end)}\n;globalThis.collect = collectPowerRankingEntries;`, context);

const entry = (userName, monName, bondLevel, power) => ({
  userName, monName, bondLevel, monsterId: 'Mocchi',
  detail: power === undefined ? null : { v: 6, power },
});
const bondEntries = [
  entry('A', 'モッチー', 40, 12000),
  entry('B', 'スエゾー', 90, 35000),   // 絆Lvは低いが総合力はいちばん上
  entry('C', 'ピクシー', 99, undefined), // 古い記録(detail が無い)
  entry('D', 'ミーア', 50, 0),           // 0は「総合力0」ではなく記録なし
  entry('E', 'パンドラ', 50, '18000.4'), // 文字列でも数として読み、丸めて出す
  null,
];
const out = context.collect(bondEntries);
check('総合力の高い順に並ぶ', out.map(x => x.userName).join(',') === 'B,E,A',
  out.map(x => `${x.userName}:${x.power}`).join(' / '));
check('絆Lvの順ではない(絆Lv99のCが先頭に来ない)', out[0].userName === 'B');
check('総合力が残っていない記録は載せない', !out.some(x => ['C', 'D'].includes(x.userName)));
check('総合力は整数へ丸めて持つ', out.find(x => x.userName === 'E')?.power === 18000);
check('元の項目(絆Lv・種ID)はそのまま持ち回る',
  out.every(x => Number.isFinite(x.bondLevel) && x.monsterId === 'Mocchi'));
check('配列でない・空でも落ちない',
  context.collect(null).length === 0 && context.collect(undefined).length === 0);
// 同じ総合力のときは名前順。並びが呼ぶたびに変わると、順位が毎回入れ替わって見える
const tie = context.collect([entry('た', 'モッチー', 1, 100), entry('あ', 'モッチー', 1, 100)]);
check('同じ総合力のときは名前順で安定する', tie.map(x => x.userName).join(',') === 'あ,た');

// ---- 画面側 ----
const has = (needle) => src.includes(needle);

check('画面側は並べ替えの式を書き写さず collectPowerRankingEntries を呼ぶ',
  has('const powerRankingAll = useMemo(() => collectPowerRankingEntries(bondRankingAll), [bondRankingAll]);')
    && !has('.sort((a, b) => b.power - a.power || a.userName.localeCompare'));

// ---- 3. 種族タブ ----
// 絆Lvと同じ血統カタログ・同じ引き当てを使う(画面側へ種族名を書き写さない)
check('種族タブを絆Lvと同じ dexMainLineages から作っている',
  has('...bondRankingLineages.map(l=>({id:l.id,label:`${l.name}種`}))].map(t=><button key={t.id} onClick={()=>setPowerRankMonFilter(t.id)}'));
check('絞り込みを血統idで行っている',
  has("powerRankingAll.filter(x => bondEntryLineageId(x) === powerRankMonFilter)"));
check('「すべて」タブがある', /\{id:'all',label:'すべて'\}[\s\S]{0,200}setPowerRankMonFilter/.test(src));
check('タブを開くたびに「すべて」から見せる',
  has("if(key==='power')setPowerRankMonFilter('all')"));

// ---- 4. 取得 ----
check("取得は絆Lvと同じ levelKind='bond' を呼ぶ",
  has("loadRankings(null,true,false,key==='power'?'bond':key)")
    && !has("loadRankings(null,true,true,'power')"));
check('上のタブに総合力が並んでいる',
  has("['bond','絆Lv'],['power','総合力']") && has('grid grid-cols-4 gap-1 mb-2 shrink-0'));
check('総合力タブの中身が描かれている',
  has("{modeSelectTab==='power'&&") && has('{renderPowerRankingBody()}'));

// 一覧のカードは総合力を主役にする(絆Lvのカードの使い回しで数字が絆Lvのままになっていないか)
const entryStart = src.indexOf('const renderPowerRankingEntry');
const entrySrc = src.slice(entryStart, src.indexOf('\n  };', entryStart));
check('カードは総合力を大きく出す', entrySrc.includes('総合力') && entrySrc.includes('formatMonsterPower(entry?.power)'));
check('カードに絆Lvも添える', entrySrc.includes('絆Lv.{level}'));
check('カードから1体ぶんの詳細を開ける', entrySrc.includes('setRankingMonsterDetail(detailMember)'));
check('総合力の行だと機械的に分かる印がある', entrySrc.includes('data-ranking-kind="power"'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

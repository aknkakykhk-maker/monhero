// モンスター詳細(編成・ベースモン一覧・マスモン一覧・勇者モン選択)が
// 1つの共通表示にまとまっていて、どこから開いても勇者特性まで見られることを確認する。
//
// 以前は画面ごとに別々のJSXで組んでいたため、勇者特性が勇者モン選択(PICK_HERO)でしか出なかった。
// 配信用JS(compiled)は日本語の文字列が \uXXXX へ変換されるので、比較前に元へ戻してから調べる。
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');
const compiledRaw = fs.readFileSync(path.join(root, 'monster-hero/game-system.compiled.js'), 'utf8');
const compiled = compiledRaw.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

for (const [label, code] of [['ソース', source], ['配信用JS', compiled]]) {
  // 共通実装そのもの
  check(`${label}: 共通の詳細表示がある`, code.includes('renderMonsterDetailInfo'));
  const start = code.indexOf('renderMonsterDetailInfo = (mon, opts');
  const body = start > 0 ? code.slice(start, code.indexOf('renderSkillSection = (mon)')) : '';
  check(`${label}: 共通表示に基本ステータスがある`, body.includes('statTitle') && body.includes('mon.baseHp') && body.includes('mon.baseGuts'));
  check(`${label}: 共通表示に勇者特性がある`, body.includes('勇者特性') && body.includes('mon.trait') && body.includes('mon.traitDesc'));
  check(`${label}: 特性名も表示する`, /mon\.trait\s*&&/.test(body));
  check(`${label}: 特性が無いモンスターでも空欄にしない`, body.includes("mon.traitDesc || '特性なし'") || body.includes('mon.traitDesc||\'特性なし\''));
  check(`${label}: 共通表示に合流ボーナスがある`, body.includes('合流ボーナス') && body.includes('formatAptBonus(mon)'));
  check(`${label}: 共通表示に間合い適性がある`, body.includes('間合い適性') && body.includes('getDistAptitude(mon, idx)') || body.includes('getDistAptitude(mon,idx)'));
  check(`${label}: 共通表示に技セクションがある`, body.includes('renderSkillSection(mon)'));
  check(`${label}: 画面ごとの差分を引数で受け取る`,
    body.includes('statValues') && body.includes('aptExtra') && body.includes('aptPointsLabel'));

  // 呼び出し側(3つの詳細すべてが共通実装を使う)
  check(`${label}: 編成・ベースモン一覧の詳細が共通表示を使う`, code.includes('renderMonsterDetailInfo(rosterDetailMon)'));
  check(`${label}: 勇者モン選択・供モン合流の詳細が共通表示を使う`, code.includes('renderMonsterDetailInfo(currentPickingMon,'));
  check(`${label}: マスモン一覧の詳細が共通表示を使う`, code.includes('renderMonsterDetailInfo(mergedMasu,'));

  // 勇者特性を画面で出し分けていた分岐が残っていないこと
  check(`${label}: 勇者特性を勇者モン選択だけに限定していない`,
    !/gameState === 'PICK_HERO' \? \(?[^\n]{0,40}勇者特性/.test(code) && !/gameState==='PICK_HERO'\?\(<div[^\n]{0,80}勇者特性/.test(code));
  check(`${label}: 詳細の勇者特性ブロックは共通実装1か所だけ`,
    (code.match(/uppercase font-bold[^\n]{0,20}>勇者特性|font-bold"\s*\}?,\s*"勇者特性"/g) || []).length <= 2);

  // 画面固有の情報が消えていないこと
  check(`${label}: 勇者モン選択の「現在 → 合流後」表記が残っている`, code.includes('基本ステータス(現在 → 合流後)'));
  check(`${label}: 強化Pの割り振りボタンが残っている`, code.includes('spendAptPoint(currentPickingMon.masuId, idx)') || code.includes('spendAptPoint(currentPickingMon.masuId,idx)'));
  check(`${label}: マスモンの現在ステータス表記が残っている`, code.includes('現在のステータス(強化分込み)'));
  check(`${label}: マスモンの所持固有技Lvが残っている`, code.includes('所持固有技Lv'));
  check(`${label}: マスモンの強化ポイント表示が残っている`, code.includes('masu.distAptPoints'));
  check(`${label}: 編成詳細でも絆Lvゲージを出す`, code.includes('bondGaugeNode(rosterDetailMon.masuId)'));
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

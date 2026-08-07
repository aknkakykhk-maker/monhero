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

  // 呼び出し側: どこから開いても同じマスターUI(外枠・上部サマリー・本文)を通ること。
  // 以前は画面ごとに外枠と上部を書き写していたため、絆ゲージや限界突破の出方が画面で違っていた
  check(`${label}: 詳細の外枠が共通実装にまとまっている`, code.includes('renderMonsterDetailModal = ({'));
  check(`${label}: 上部サマリーが共通実装にまとまっている`, code.includes('renderMonsterSummaryHeader = ({'));
  check(`${label}: 本文の共通表示を呼ぶのはマスターUIの中だけ`,
    (code.match(/renderMonsterDetailInfo\(/g) || []).length === 1,
    `${(code.match(/renderMonsterDetailInfo\(/g) || []).length}回の呼び出し`);
  check(`${label}: 編成・ベースモン一覧の詳細がマスターUIを使う`, /rosterDetailMon\s*&&\s*renderMonsterDetailModal\(/.test(code));
  check(`${label}: 勇者モン選択・供モン合流の詳細がマスターUIを使う`, /currentPickingMon\s*&&\s*renderMonsterDetailModal\(/.test(code));
  check(`${label}: マスモン一覧の詳細がマスターUIを使う`, code.includes('mon: mergedMasu,'));
  check(`${label}: ランキングの詳細もマスターUIを使う`, /return renderMonsterDetailModal\(\{\s*mon,/.test(code));
  // 呼び出し元固有の操作だけを外から渡す形になっていること
  check(`${label}: 呼び出し元固有の操作を引数で受け取る`,
    code.includes('onRename') && code.includes('detailOpts') && code.includes('bodyExtra') && code.includes('footer'));
  check(`${label}: 名前変更は渡された画面だけ`, /onRename: \(\)\s*=>\s*\{\s*setMasuRenameInput\(/.test(code));
  // 上部サマリーの並び(画像→個体名→元のベースモン名→総合力→絆Lv/上限→限界突破→転生→XP)
  check(`${label}: サマリーに総合力がある`, code.includes('const power = monsterPowerOf(mon);') && code.includes('renderPowerBadge(power)'));
  check(`${label}: サマリーに元のベースモン名がある`, code.includes('元：'));
  check(`${label}: サマリーに絆Lvと上限がある`, /絆 Lv\./.test(code) && code.includes('norm.levelCap'));
  check(`${label}: 限界突破は rebirthCount、転生は reincarnateCount のまま`,
    /RebirthStars[^A-Za-z][\s\S]{0,80}norm\.rebirthCount/.test(code) && /ReincarnateBadge[^A-Za-z][\s\S]{0,80}norm\.reincarnateCount/.test(code));
  check(`${label}: 個体の強さと選び方で決まる効果を分けている`,
    code.includes('この個体の強さ') && code.includes('選び方で決まる効果'));
  check(`${label}: 第2段階の合体詳細を置ける枠がある`, code.includes('renderFusionSection') && code.includes('合体回数 '));

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
  // ===== 一覧カードのマスターUI =====
  // 編成・ベースモン一覧・マスモン一覧・放牧設定・勇者モン選択/供モン選択が、同じ1つの実装で
  // 描かれていること。以前は画面ごとにJSXを書き写していたため、勇者モン選択と供モン選択だけ
  // 絆レベルも総合力も限界突破の★も出ず、同じマスモンが画面によって違う見た目になっていた
  check(`${label}: 一覧カードの共通実装がある`, code.includes('renderMonsterCardBody = ({'));
  const bodyStart = code.indexOf('renderMonsterCardBody = ({');
  const cardBody = bodyStart > 0 ? code.slice(bodyStart, code.indexOf('getDistAptitude = (mon, slotIdx)', bodyStart)) : '';
  check(`${label}: 共通カードは丸くくり抜いたiconUrlを使う`,
    /base\.iconUrl\s*\|\|\s*base\.imgUrl/.test(cardBody) && cardBody.includes('MONSTER_CARD_ICON_CLASS') && cardBody.includes('object-cover'));
  check(`${label}: 共通カードは素の立ち絵をそのまま貼らない`, !cardBody.includes('object-contain'));
  check(`${label}: 共通カードにマスモンの限界突破★と転生バッジがある`,
    /RebirthStars[\s\S]{0,120}masu\.rebirthCount/.test(cardBody) && /ReincarnateBadge[\s\S]{0,120}masu\.reincarnateCount/.test(cardBody));
  check(`${label}: 共通カードに名前・絆Lv・総合力・強化P・状態がある`,
    cardBody.includes('monsterCardName(') && cardBody.includes('monsterCardBond(') && cardBody.includes('monsterCardPower(')
    && cardBody.includes('強化P') && cardBody.includes('monsterCardStatus('));
  check(`${label}: マスモンだけふちと名前の色を変える`,
    cardBody.includes('border-pink-400/40') && cardBody.includes('text-pink-200'));
  // カードの行を組む部品は共通実装の中だけで使う(画面ごとに書き写すと今回の食い違いが再発する)
  for (const part of ['monsterCardName(', 'monsterCardInfo(', 'monsterCardPower(', 'monsterCardSub(', 'monsterCardStatus(', 'monsterCardBond(']) {
    const times = (code.split(part).length - 1);
    check(`${label}: ${part.replace('(', '')} を使うのは共通実装だけ`, times === 1, `${times}か所`);
  }
  // 呼び出し側: 一覧を出すすべての画面が共通実装を通ること
  const cardCalls = (code.match(/renderMonsterCardBody\(\{/g) || []).length;
  check(`${label}: すべての一覧画面が共通カードを呼ぶ`, cardCalls === 6, `${cardCalls}か所(編成2・ベースモン一覧・マスモン一覧・放牧設定・勇者モン選択/供モン選択)`);
  const pickStart = code.indexOf('const pickMasu');
  const pickEnd = pickStart > 0 ? code.indexOf('詳細を見る', pickStart) : -1;
  const pick = pickStart > 0 && pickEnd > 0 ? code.slice(pickStart, pickEnd) : '';
  check(`${label}: 勇者モン選択・供モン選択も共通カードを通す`,
    /renderMonsterCardBody\(\{[\s\S]{0,200}masu:\s*pickMasu/.test(pick));
  check(`${label}: 勇者モン選択の固有技名とステータスが残っている`,
    pick.includes('m.unique.name') && pick.includes('m.baseHp') && pick.includes('m.plusStats?.guts'));

  // マスモンの絆XPゲージは共通サマリーの中だけ(ブリーダーLvのゲージは別物なので数えない)
  check(`${label}: マスモンの絆XPゲージは共通サマリーの中に1つだけ`,
    (code.match(/lvl\.xpIntoLevel\.toLocaleString\(\)/g) || []).length === 1,
    `${(code.match(/lvl\.xpIntoLevel\.toLocaleString\(\)/g) || []).length}か所`);
}

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

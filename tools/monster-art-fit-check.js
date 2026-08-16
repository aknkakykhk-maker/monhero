// ウンディーネ・ヤオビクニ(縦長2:3の立ち絵)が、丸枠・正方形枠の一覧で
// 頭のてっぺんや尾びれを欠かさず表示できているかを確認する。
//
//   node tools/monster-art-fit-check.js
//
// 【背景】
// 一覧やアイコンの枠は正方形で、既定の object-cover だと縦長の絵は
// 上下が切り取られる(この2体だけ縦長のため、画像は加工せずobject-containで全身を収める設計)。
// 実際に「供モンを選択」画面でウンディーネの頭が切れて表示される不具合が発生した原因は、
// renderMonsterCardBody の「マスモンではない(ベース種のまま)」分岐だけが
// monsterArtFitStyle を通さず、常に object-cover になっていたため。
// 同じ理由の見落としが今後また起きないよう、対象になり得る箇所をまとめて機械的に見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 対象の定義と挙動 ---
check('縦長の立ち絵を持つ対象がウンディーネ・ヤオビクニに定義されている',
  has("const MONSTER_ART_CONTAIN_IDS = Object.freeze(['Undine', 'Yaobikuni']);"));

const fnCtx = {};
vm.createContext(fnCtx);
const containSrc = source.match(/const MONSTER_ART_CONTAIN_IDS = [^\n]+\n(?:const monsterArtFitStyle = [^\n]+\n)/);
check('monsterArtFitStyleの定義を取り出せる', !!containSrc);
if (containSrc) {
  vm.runInContext(`${containSrc[0]}\nglobalThis.__f = monsterArtFitStyle;`, fnCtx);
  const fit = fnCtx.__f;
  check('ウンディーネはcontainになる', fit('Undine', { width: '64px' }).objectFit === 'contain');
  check('ヤオビクニはcontainになる', fit('Yaobikuni', {}).objectFit === 'contain');
  check('対象外(例: スネグーラチカ)は元のスタイルのまま', fit('Snegurochka', { width: '64px' }).objectFit === undefined);
  check('スタイルが無くても落ちない', fit('Undine', undefined).objectFit === 'contain');
}

// --- 部位分割の染色でも同じ収め方に揃えている(マスクだけ引き伸ばされてズレるのを防ぐ) ---
check('染色マスクのサイズも同じ対象で切り替えている',
  has("const monsterArtMaskSize = (baseId) => (MONSTER_ART_CONTAIN_IDS.includes(baseId) ? 'contain' : '100% 100%');"));

// --- 実際にDyedMonsterImageが内部で必ず通している(マスモン表示はこれで自動的に対応する) ---
check('DyedMonsterImageは表示のたびにmonsterArtFitStyleを通す',
  has('const style = monsterArtFitStyle(baseId, rawStyle);'));

// --- ベース種(マスモン化していない個体)を出す箇所は、DyedMonsterImageを使わないぶん
//     各所で明示的にmonsterArtFitStyleを呼ぶ必要がある。ここが漏れていた ---
check('編成/一覧共通カード(renderMonsterCardBody)のベース種分岐がmonsterArtFitStyleを通す(供モンを選択 画面などで頭が切れる不具合の修正箇所)',
  has('<img src={iconSrc} alt={base.name} draggable={false} style={monsterArtFitStyle(base.id, MONSTER_CARD_NO_SELECT)} className="w-full h-full object-cover"/>'));
check('教え(固有技の元モンスター)アイコンがmonsterArtFitStyleを通す',
  has("<img src={ownerMon.iconUrl} alt={ownerMon.name} style={monsterArtFitStyle(ownerMon.id)} className=\"w-10 h-10 rounded-full object-cover border border-white/10 shrink-0\"/>"));
check('マスモン一覧などのベース種分岐がmonsterArtFitStyleを通す',
  has('<img src={base.iconUrl} alt={base.name} style={monsterArtFitStyle(base.id)} className="w-full h-full object-cover"/>'));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

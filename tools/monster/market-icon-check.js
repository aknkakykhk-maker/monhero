const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// マーケットのアイコン商品を確認する。
//
// アイコンの絵は「base64で埋め込んだもの」と「画像ファイルを指すもの」が混ざっている。
// ファイルを指すほうは綴りを1文字まちがえても手元では気づけず、公開してから
// 画像が出ないことになる(GitHub Pagesは大文字小文字を区別する)。ここで機械的に見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(TOOLS_DIR, '..');
const web = path.join(root, 'monster-hero');
const read = (p) => fs.readFileSync(path.join(web, p), 'utf8');
const source = read('src/game-system.jsx');
const stripCacheKey = (value) => value.split('?')[0];

const ctx = {};
vm.createContext(ctx);
vm.runInContext([
  read('data/images/images-ally.js'),
  read('data/ally-monsters.js'),
  read('data/breeder.js'),
  read('data/assistants.js'),
  'globalThis.__x={BREEDER_MARKET_ITEMS,ASSISTANTS,ASSISTANT_EXPRESSIONS,assistantFaceImage};',
].join('\n'), ctx);
const { BREEDER_MARKET_ITEMS: items, ASSISTANTS, ASSISTANT_EXPRESSIONS, assistantFaceImage } = ctx.__x;

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// --- idの重複 ---
const ids = items.map(i => i.id);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
check('商品idが重複していない', dup.length === 0, dup.join(', '));

// --- 画像ファイルを指すアイコンが実在するか(綴り・大文字小文字も含めて) ---
const fileIcons = items.filter(i => i.type === 'icon' && typeof i.icon === 'string' && !i.icon.startsWith('data:'));
const missing = fileIcons.filter(i => {
  const full = path.join(web, stripCacheKey(i.icon));
  if (!fs.existsSync(full)) return true;
  // 実在しても綴りが違う(大文字小文字だけ違う)場合を弾く
  return !fs.readdirSync(path.dirname(full)).includes(path.basename(full));
});
check('ファイルを指すアイコンは実在する', missing.length === 0, missing.map(i => i.icon).join(', '));
check('ファイルを指すアイコンがある', fileIcons.length > 0, `${fileIcons.length}件`);

// --- 助手の表情アイコンが全種そろっているか ---
// 表情を足したら商品も足す。片方だけ増えて「買えない表情」が出るのを防ぐ。
// 助手を増やしたときも同じ仕様(8表情・各1pt)で追随しているかをここでまとめて見る
const soldFaces = new Set(fileIcons.map(i => stripCacheKey(i.icon)));
for (const who of ASSISTANTS) {
  const wantedFaces = ASSISTANT_EXPRESSIONS.map(e => assistantFaceImage(who, e));
  const notSold = wantedFaces.filter(p => !soldFaces.has(stripCacheKey(p)));
  check(`${who.name}の表情はすべてマーケットに並んでいる`, notSold.length === 0, notSold.join(', '));
}

// --- 値段と名前 ---
const icons = items.filter(i => i.type === 'icon');
check('アイコンはすべてptで買える安さにそろえる', icons.every(i => i.cost === 1), `${icons.length}件`);
// 価格・商品名の付け方も助手ごとにそろっていること(みゅあだけ安い・名前の形が違う、を防ぐ)
for (const who of ASSISTANTS) {
  const own = icons.filter(i => typeof i.icon === 'string'
    && ASSISTANT_EXPRESSIONS.some(e => stripCacheKey(i.icon) === stripCacheKey(assistantFaceImage(who, e))));
  check(`${who.name}の表情アイコンは8種・各1ptで並ぶ`,
    own.length === ASSISTANT_EXPRESSIONS.length && own.every(i => i.cost === 1 && i.name.includes(who.name)),
    `${own.length}件`);
}
const longName = icons.filter(i => (i.name || '').length > 16);
check('名前は16文字まで(カードの枠に収まる長さ)', longName.length === 0, longName.map(i => `${i.name}(${i.name.length})`).join(', '));

// ききは助手画像ではなく、ブリーダーアイコン専用フォルダの正式画像を使う。
const kiki = icons.find(i => i.id === 'kiki_icon');
check('ききのアイコンが正式名称・価格で並ぶ', kiki?.name === 'ききのアイコン' && kiki?.cost === 1);
check('ききの画像はブリーダーアイコン専用フォルダにある', stripCacheKey(kiki?.icon || '') === 'images/breeder-icons/kiki.PNG');
check('対象アイコンを共通部品で拡大・位置調整する',
  source.includes('const MARKET_PROFILE_ICON_STYLES = {')
    && source.includes('ark_icon: { scale: 1.08, x: 0, y: 0 }')
    && source.includes('snegurochka_icon: { scale: 4.28, x: 11, y: 111 }')
    && source.includes('snegurochka_awakened_icon: { scale: 4.28, x: 9, y: 100 }')
    && source.includes('iblis_icon: { scale: 1.42, x: 2, y: -10 }')
    && source.includes('const profileIconTransformStyle = iconAdjustmentTransformStyle')
    && source.includes('const iconAdjustmentTransformStyle = ({ scale=1, x=0, y=0 }={})')
    && source.includes('transform:`translate(${x}%, ${y}%) scale(${scale})`')
    && source.includes('transformOrigin:\'center center\'')
    && source.includes('const BreederIcon =')
    && source.includes('const MarketProductIcon =')
    && source.includes('<MarketProductCard')
    && (source.match(/<BreederIcon /g) || []).length >= 6
    && !source.includes('transform: `scale(${scale}) translate(${x}%, ${y}%)`'));

check('デバッグ画面で全アイコンの数値と4つの本番表示を調整・コピーできる',
  source.includes("gameState==='BREEDER_ICON_DEBUG'")
    && source.includes('const breederIconOptions =')
    && source.includes('breederIconOptions({includeUnowned:true})')
    && source.includes('名前・内部IDで検索')
    && source.includes("slider('scale','拡大率 scale'")
    && source.includes("slider('x','左右位置 X'")
    && source.includes("slider('y','上下位置 Y'")
    && source.includes('const HomeProfileIcon =')
    && (source.match(/<HomeProfileIcon /g) || []).length === 2
    && source.includes('HOME左上プロフィール')
    && source.includes('.mh-home-avatar>span{width:100%;height:100%}')
    && !source.includes('.mh-home-avatar img')
    && source.includes('マーケット一覧')
    && source.includes('商品詳細')
    && source.includes('プロフィール選択')
    && source.includes("navigator.clipboard.writeText(copyText)"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

// マーケットのアイコン商品を確認する。
//
// アイコンの絵は「base64で埋め込んだもの」と「画像ファイルを指すもの」が混ざっている。
// ファイルを指すほうは綴りを1文字まちがえても手元では気づけず、公開してから
// 画像が出ないことになる(GitHub Pagesは大文字小文字を区別する)。ここで機械的に見る。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const web = path.join(root, 'monster-hero');
const read = (p) => fs.readFileSync(path.join(web, p), 'utf8');

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
  const full = path.join(web, i.icon);
  if (!fs.existsSync(full)) return true;
  // 実在しても綴りが違う(大文字小文字だけ違う)場合を弾く
  return !fs.readdirSync(path.dirname(full)).includes(path.basename(full));
});
check('ファイルを指すアイコンは実在する', missing.length === 0, missing.map(i => i.icon).join(', '));
check('ファイルを指すアイコンがある', fileIcons.length > 0, `${fileIcons.length}件`);

// --- 助手の表情アイコンが全種そろっているか ---
// 表情を足したら商品も足す。片方だけ増えて「買えない表情」が出るのを防ぐ
const myua = ASSISTANTS.find(a => a.id === 'mua');
const wantedFaces = ASSISTANT_EXPRESSIONS.map(e => assistantFaceImage(myua, e));
const soldFaces = new Set(fileIcons.map(i => i.icon));
const notSold = wantedFaces.filter(p => !soldFaces.has(p));
check('みゅあの表情はすべてマーケットに並んでいる', notSold.length === 0, notSold.join(', '));

// --- 値段と名前 ---
const icons = items.filter(i => i.type === 'icon');
check('アイコンはすべてptで買える安さにそろえる', icons.every(i => i.cost === 1), `${icons.length}件`);
const longName = icons.filter(i => (i.name || '').length > 14);
check('名前は14文字まで(カードの枠に収まる長さ)', longName.length === 0, longName.map(i => `${i.name}(${i.name.length})`).join(', '));

// ききは助手画像ではなく、ブリーダーアイコン専用フォルダの正式画像を使う。
const kiki = icons.find(i => i.id === 'kiki_icon');
check('ききのアイコンが正式名称・価格で並ぶ', kiki?.name === 'ききのアイコン' && kiki?.cost === 1);
check('ききの画像はブリーダーアイコン専用フォルダにある', kiki?.icon === 'images/breeder-icons/kiki.PNG');

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// 同じ記号は、どの画面でも同じ色で出す。
//
// このゲームは間合い適性(零・近・中・遠のランク)で G〜M の記号を使っていて、
// DIST_APTITUDE_COLOR が「Mは紫、S系は黄、Aは赤、Bはピンク、Cは緑、Dは青緑…」と決めている。
// モンビー(モンヒロビート)のランクも同じ G〜M だが、以前は別の配色だったため、
// 同じ「A」でも画面によって色が違っていた
// (2026-09-13・ユーザー指示「モンビーのランクもこのゲームの距離適性別色にあわせて」)。
//
// ここで見るのは次の3つ。
//   ① モンビーのランク色が、間合い適性の色と同じ色味になっている
//   ② 全ランク(G〜M)ぶんそろっている
//   ③ 図鑑の間合い適性が、共通の色(DIST_APTITUDE_COLOR)で塗られている
//      (図鑑だけ琥珀色1色で、A・C・Dの違いが見分けられなかった)
const fs = require('fs');
const path = require('path');

const root = path.resolve(TOOLS_DIR, '..');
const rhythmSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/13-bgm-and-rhythm-settings.jsx'), 'utf8');
const widgetSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/16-ranking-detail-and-widgets.jsx'), 'utf8');
const dexSrc = fs.readFileSync(path.join(root, 'monster-hero/src/parts/57-screen-monster-dex.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};

// text-red-400 のような色名から「色味」だけを取り出す(濃さの違いは許す)。
// SSとSは並んだときに見分けたいので、同じ黄でも濃さを変えてある。
const hueOf = (className) => {
  const m = String(className || '').match(/text-([a-z]+)-\d+/);
  return m ? m[1] : null;
};

const readMap = (src, name) => {
  const at = src.indexOf(`const ${name} = `);
  if (at < 0) throw new Error(`${name} が見つかりません`);
  const body = src.slice(at, src.indexOf('});', at) >= 0 ? src.indexOf('});', at) + 3 : src.indexOf(' };', at) + 3);
  const map = {};
  for (const m of body.matchAll(/(?:'([^']+)'|([A-Za-z+]+))\s*:\s*"([^"]*)"|(?:'([^']+)'|([A-Za-z+]+))\s*:\s*'([^']*)'/g)) {
    const key = m[1] || m[2] || m[4] || m[5];
    const value = m[3] !== undefined ? m[3] : m[6];
    if (key && value !== undefined) map[key] = value;
  }
  return map;
};

const rankColors = readMap(rhythmSrc, 'RHYTHM_RANK_COLORS');
const aptColors = readMap(widgetSrc, 'DIST_APTITUDE_COLOR');

// --- ② 全ランクぶんそろっている ---
const RANKS = ['G', 'F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'M'];
check('モンビーのランクが G〜M までそろっている',
  RANKS.every(r => rankColors[r]), RANKS.filter(r => !rankColors[r]).join(', ') || '');

// --- ① 間合い適性と同じ色味 ---
const mismatched = RANKS.filter(rank => {
  const apt = aptColors[rank];
  if (!apt) return false; // 間合い適性側に無い記号は見ない
  return hueOf(rankColors[rank]) !== hueOf(apt);
});
check('モンビーのランク色が間合い適性と同じ色味',
  mismatched.length === 0,
  mismatched.map(r => `${r}: ${hueOf(rankColors[r])} ≠ ${hueOf(aptColors[r])}`).join(' / ')
    || RANKS.map(r => `${r}=${hueOf(rankColors[r])}`).join(' '));
// 見分けがつかないと困るところだけ、濃さで分ける
check('SSとSは同じ色味でも濃さで見分けられる',
  hueOf(rankColors.SS) === hueOf(rankColors.S) && rankColors.SS !== rankColors.S,
  `${rankColors.SS} / ${rankColors.S}`);
check('最上位のMだけが紫(間合い適性のMと同じ)',
  hueOf(rankColors.M) === 'fuchsia' && RANKS.filter(r => hueOf(rankColors[r]) === 'fuchsia').length === 1);

// --- ③ 図鑑も共通の色を使う ---
check('図鑑の間合い適性が共通の色で塗られている',
  dexSrc.includes('DIST_APTITUDE_COLOR[grade]'),
  '57-screen-monster-dex.jsx');
check('図鑑の距離ラベルも共通の色で塗られている',
  dexSrc.includes('RANGE_STYLES[i].labelBg'));
check('図鑑に琥珀色の決め打ちが残っていない',
  !dexSrc.includes("font-mono font-black text-amber-200\">{(mon.distAptitude"));

console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
process.exit(failed ? 1 : 0);

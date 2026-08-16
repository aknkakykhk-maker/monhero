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

// --- 「勇者モンを選択」(プロモード一覧)の絵を収める箱 ---
// 立ち絵はほとんどが正方形なので、縦長の箱へcontainで収めると幅で頭打ちになる。
// ところが元絵が縦長(2:3)のウンディーネ・ヤオビクニだけ高さを使い切ってしまい、
// 他より約1.5倍大きく表示されていた。箱を正方形にそろえて全員を幅基準にする。
const PICK_HERO_BOX = (() => {
  const at = source.indexOf("if(gameState==='PICK_HERO'&&isProMode(runMode)) return (");
  if (at < 0) return null;
  const block = source.slice(at, source.indexOf('</article>', at));
  const m = block.match(/style=\{\{width:'(\d+)px',height:'(\d+)px'\}\}/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
})();
check('勇者モンを選択(プロモード一覧)の絵の箱をpx指定で取り出せる', !!PICK_HERO_BOX,
  PICK_HERO_BOX ? `${PICK_HERO_BOX.w}x${PICK_HERO_BOX.h}` : '');
check('その箱が正方形になっている(縦長だと縦長の絵だけ大きくなる)',
  !!PICK_HERO_BOX && PICK_HERO_BOX.w === PICK_HERO_BOX.h,
  PICK_HERO_BOX ? `${PICK_HERO_BOX.w}x${PICK_HERO_BOX.h}` : '');

// --- 文字列ではなく実際の絵から「見た目の大きさ」を測って比べる ---
// 立ち絵ごとに余白の量が違うので、画像の寸法だけでは実際の見え方が分からない。
// 透明でない部分(キャラ本体)の高さが、その箱へcontainで収めたとき何pxになるかを実測し、
// ウンディーネ・ヤオビクニだけ極端に大きく(小さく)なっていないかを見る。
const { createCanvas, loadImage } = require('canvas');
const web = path.join(root, 'monster-hero');
const allySrc = fs.readFileSync(path.join(web, 'data/images/images-ally.js'), 'utf8');
const artFiles = [...allySrc.matchAll(/const\s+(\w+_IMG)\s*=\s*"(images\/[^"?]+)/g)].map(m => ({ name: m[1], rel: m[2] }));

// containで箱へ収めたときの、キャラ本体(透明でない部分)の高さ
const drawnCharHeight = async (rel, box) => {
  const img = await loadImage(path.join(web, rel));
  const cv = createCanvas(img.width, img.height);
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let top = img.height, bottom = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 20) { if (y < top) top = y; if (y > bottom) bottom = y; break; }
    }
  }
  return (bottom - top) * Math.min(box.w / img.width, box.h / img.height);
};

const run = async () => {
  if (PICK_HERO_BOX && artFiles.length > 0) {
    console.log(`\n[勇者モンを選択(プロモード一覧) ${PICK_HERO_BOX.w}x${PICK_HERO_BOX.h} での見た目の高さ]`);
    const measured = [];
    for (const { name, rel } of artFiles) {
      measured.push({ name, h: await drawnCharHeight(rel, PICK_HERO_BOX) });
    }
    const sorted = [...measured].sort((a, b) => a.h - b.h);
    const median = sorted[Math.floor(sorted.length / 2)].h;
    for (const m of sorted) console.log(`   ${m.name.padEnd(22)} ${m.h.toFixed(1)}px  (中央値比 ${(m.h / median).toFixed(2)}倍)`);
    // 元絵の余白の差でどうしても多少はばらつくので、極端なものだけを弾く。
    // 直す前のウンディーネ・ヤオビクニは1.51倍で、ここに引っかかっていた
    const MAX_RATIO = 1.25;
    const tooBig = sorted.filter(m => m.h / median > MAX_RATIO);
    check(`どの立ち絵も中央値の${MAX_RATIO}倍より大きくならない`, tooBig.length === 0,
      tooBig.map(m => `${m.name}=${(m.h / median).toFixed(2)}倍`).join(', '));
    // ★今回の対象2体を名指しでも見る(将来また縦長の絵を足したときに気づけるように)
    for (const id of ['UNDINE_IMG', 'YAOBIKUNI_IMG']) {
      const target = measured.find(m => m.name === id);
      const ratio = target ? target.h / median : 0;
      check(`${id} が他と同じくらいの大きさで並ぶ`, !!target && ratio <= MAX_RATIO,
        target ? `${target.h.toFixed(1)}px / 中央値${median.toFixed(1)}px = ${ratio.toFixed(2)}倍` : '見つからない');
    }
  }

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });

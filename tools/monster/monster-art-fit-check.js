const TOOLS_DIR = require('path').join(__dirname, '..'); // tools/ 直下。分類フォルダから見た1つ上
// ウンディーネ・ヤオビクニ(縦長2:3の立ち絵)が、丸枠・正方形枠の一覧で
// 頭のてっぺんや尾びれを欠かさず表示できているかを確認する。
//
//   node tools/monster/monster-art-fit-check.js
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

const root = path.resolve(TOOLS_DIR, '..');
const source = fs.readFileSync(path.join(root, 'monster-hero/src/game-system.jsx'), 'utf8');

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'OK' : 'NG'}: ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
};
const has = (needle) => source.includes(needle);

// --- 対象の定義と挙動 ---
check('縦長の立ち絵を持つ対象がcontainに定義されている',
  has("const MONSTER_ART_CONTAIN_IDS = Object.freeze(['Undine', 'Yaobikuni', 'Mia', 'Pandora']);"));

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
// 以前は baseId の表で切り替えていたが、表に無い正方形でない絵(プラント1536x1024)で
// マスクだけ枠いっぱいに引き伸ばされ、花のマスクが葉や花びらの途中に掛かる不具合が出た。
// 今は絵の収め方(object-fit)をそのままマスクへ写すので、表の書き忘れでズレることはない。
const maskCtx = {};
vm.createContext(maskCtx);
const maskSrc = source.match(/const monsterArtMaskSize = \(className, style\) => \{[\s\S]*?\n\};\n/);
check('monsterArtMaskSizeの定義を取り出せる', !!maskSrc);
if (maskSrc && containSrc) {
  vm.runInContext(`${containSrc[0]}\n${maskSrc[0]}\nglobalThis.__m = monsterArtMaskSize; globalThis.__f = monsterArtFitStyle;`, maskCtx);
  const maskSize = maskCtx.__m, fitStyle = maskCtx.__f;
  check('object-coverの枠ではマスクもcover', maskSize('w-full h-full object-cover', {}) === 'cover');
  check('object-containの枠ではマスクもcontain', maskSize('w-full h-full object-contain', {}) === 'contain');
  check('収め方の指定が無ければ従来どおり枠いっぱい', maskSize('w-full h-full', {}) === '100% 100%');
  check('sm:object-containのような別条件のクラスは拾わない', maskSize('w-full h-full sm:object-contain', {}) === '100% 100%');
  // 絵の収め方とマスクの収め方が、どのモンスター・どの枠でも必ず一致することを見る。
  // ここがずれると「絵とマスクの縮尺が違う」= 別の場所が染まる、になる。
  for (const baseId of ['Undine', 'Yaobikuni', 'Plant', 'Mocchi', 'Snegurochka']) {
    for (const className of ['w-full h-full object-cover', 'w-full h-full object-contain']) {
      const style = fitStyle(baseId, {});
      const wanted = style.objectFit || (className.includes('object-contain') ? 'contain' : 'cover');
      check(`${baseId} / ${className.includes('contain') ? 'contain' : 'cover'}の枠で絵とマスクの収め方が一致する`,
        maskSize(className, style) === wanted, `マスク=${maskSize(className, style)} / 絵=${wanted}`);
    }
  }
}
check('DyedMonsterImageがマスクの収め方を絵から求めている',
  has('const maskSize = monsterArtMaskSize(className, style);')
    && has('WebkitMaskSize:maskSize, maskSize:maskSize,'));

// --- 実際にDyedMonsterImageが内部で必ず通している(マスモン表示はこれで自動的に対応する) ---
check('DyedMonsterImageは表示のたびにmonsterArtFitStyleを通す',
  has('const style = monsterArtFitStyle(baseId, rawStyle);'));

// --- ベース種(マスモン化していない個体)を出す箇所は、DyedMonsterImageを使わないぶん
//     各所で明示的にmonsterArtFitStyleを呼ぶ必要がある。ここが漏れていた ---
check('編成/一覧共通カード(renderMonsterCardBody)のベース種分岐がmonsterArtFitStyleを通す(供モンを選択 画面などで頭が切れる不具合の修正箇所)',
  has('<img src={iconSrc} alt={base.name} draggable={false} style={monsterArtFitStyle(base.id, MONSTER_CARD_NO_SELECT)} className="w-full h-full object-cover"/>'));
check('教え(固有技の元モンスター)アイコンがmonsterArtFitStyleを通す',
  has("<img src={ownerMon.iconUrl} alt={ownerMon.name} style={monsterArtFitStyle(ownerMon.id)} className=\"w-10 h-10 rounded-full object-cover border border-white/10 shrink-0\"/>"));
// モンスター図鑑。血統チップは24pxほどの小さな丸なので、通し忘れると
// ウンディーネの頭が切れて体だけが写る(実際にそうなった)
// 図鑑の丸アイコンは、monsterArtFitStyle(ウンディーネ・ヤオビクニだけcontain)では足りない。
// 丸く切り抜くと、円の外側へかかる部分がどのモンスターでも切れる
// (アークの冠と翼、ザンの腕、ゴーレムの肩が実際に切れていた)。
// 全モンスターを object-contain にしたうえで、円の内側へ収まるよう内側の余白を取る。
check('モンスター図鑑の一覧アイコンが円の内側へ収まる',
  /data-dex-entry-icon=\{!lineage\|\|undefined\}[\s\S]{0,180}padding:'10%'/.test(source));
check('モンスター図鑑の血統チップのアイコンが円の内側へ収まる',
  /data-dex-lineage-icon=\{lineage\|\|undefined\}[\s\S]{0,180}padding:'10%'/.test(source));
check('図鑑の丸アイコンで object-cover を使っていない（切れる原因）',
  !/data-dex-(?:entry|lineage)-icon[^>]*object-cover/.test(source));
check('マスモン一覧などのベース種分岐がmonsterArtFitStyleを通す',
  has('<img src={base.iconUrl} alt={base.name} style={monsterArtFitStyle(base.id)} className="w-full h-full object-cover"/>'));

// --- プロモードの横長カード(「勇者モンを選択」と「供モンの候補」)の絵を収める箱 ---
// 立ち絵はほとんどが正方形なので、縦長の箱へcontainで収めると幅で頭打ちになる。
// ところが元絵が縦長(2:3)のウンディーネ・ヤオビクニだけ高さを使い切ってしまい、
// 他より約1.5倍大きく表示されていた。箱を正方形にそろえて全員を幅基準にする。
//
// ★この2画面は以前ほぼ同じJSXを別々に持っていて、片方だけ直した結果
//   もう片方が古いまま残る事故が起きた。共通部品(renderProMonsterRow)へ
//   まとめてあること自体もここで見張る。
check('プロモードの横長カードが共通部品にまとまっている',
  has('const renderProMonsterRow = ({ mon, selected = false, disabled = false, onSelect, onDetail, selectLabel, activeClass, extraButtonClass = \'\' }) => ('));
{
  // カード本体のJSX(3カラムのグリッド)が2か所以上に書かれていたら、また重複している
  const rowMarkup = (source.match(/grid grid-cols-\[64px_minmax\(0,1fr\)_74px\]/g) || []).length;
  check('カード本体のJSXが1か所だけ(画面ごとに複製していない)', rowMarkup === 1, `${rowMarkup}か所`);
}
check('勇者モンを選択が共通部品を使っている',
  has("onSelect: ()=>{if(proHeroPreset?.heroBaseId===m.id){setupMon(m,proHeroPreset.heroDistance);return;}setProHeroPreset(null);setCurrentPickingMon(m);setGameState('PICK_SLOT');},"));
check('供モンの候補が共通部品を使っている',
  has('onSelect:()=>changeAlly(m)') && has('onDetail:()=>setProAllyDetail(m)'));

const PICK_HERO_BOX = (() => {
  const m = source.match(/const PRO_MON_ROW_ART_BOX = \{ width: '(\d+)px', height: '(\d+)px' \};/);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : null;
})();
check('プロモードの横長カードの絵の箱をpx指定で取り出せる', !!PICK_HERO_BOX,
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

// containで箱へ収めたときの、キャラ本体(透明でない部分)の高さと幅
const drawnCharSize = async (rel, box) => {
  const img = await loadImage(path.join(web, rel));
  const cv = createCanvas(img.width, img.height);
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let top = img.height, bottom = 0, left = img.width, right = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (d[(y * img.width + x) * 4 + 3] > 20) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  const scale = Math.min(box.w / img.width, box.h / img.height);
  return { h: (bottom - top) * scale, w: (right - left) * scale };
};

const run = async () => {
  if (PICK_HERO_BOX && artFiles.length > 0) {
    console.log(`\n[プロモードの横長カード ${PICK_HERO_BOX.w}x${PICK_HERO_BOX.h} での見た目の高さ]`);
    const measured = [];
    for (const { name, rel } of artFiles) {
      const size = await drawnCharSize(rel, PICK_HERO_BOX);
      // 縦長のモンスターも横長のモンスターも同じものさしで比べたいので、長いほうの辺で見る。
      // 高さだけで測ると、プラントのように横へ広い絵が実際より小さく判定されてしまう
      measured.push({ name, h: size.h, w: size.w, long: Math.max(size.h, size.w) });
    }
    const sorted = [...measured].sort((a, b) => a.long - b.long);
    const median = sorted[Math.floor(sorted.length / 2)].long;
    for (const m of sorted) {
      console.log(`   ${m.name.padEnd(22)} 高${m.h.toFixed(1)}px 幅${m.w.toFixed(1)}px 長辺${m.long.toFixed(1)}px  (中央値比 ${(m.long / median).toFixed(2)}倍)`);
    }
    // 元絵の余白の差でどうしても多少はばらつくので、極端なものだけを弾く。
    // 直す前のウンディーネ・ヤオビクニは1.51倍で、上限に引っかかっていた
    const MAX_RATIO = 1.25;
    const tooBig = sorted.filter(m => m.long / median > MAX_RATIO);
    check(`どの立ち絵も中央値の${MAX_RATIO}倍より大きくならない`, tooBig.length === 0,
      tooBig.map(m => `${m.name}=${(m.long / median).toFixed(2)}倍`).join(', '));

    // 立ち絵が正方形でないと、正方形の枠(丸アイコン・一覧)では縮尺が短いほうの辺で決まり、
    // その絵だけ小さく並ぶ。プラント(元は1536x1024で左右に広い余白つき)が実際にそうなっていた。
    // 「絵が小さめに描かれている」(スエゾー・ライガーなど)のは別の話なので下限はここに掛けず、
    // 枠の形のせいで縮んでいないかだけを、正方形でない絵と過去に直した対象へ掛ける
    const MIN_RATIO = 0.9;
    const nonSquare = [];
    for (const { name, rel } of artFiles) {
      const img = await loadImage(path.join(web, rel));
      if (img.width !== img.height) nonSquare.push({ name, size: `${img.width}x${img.height}` });
    }
    console.log(`   正方形でない立ち絵: ${nonSquare.length ? nonSquare.map(n => `${n.name}=${n.size}`).join(', ') : 'なし'}`);
    const watched = new Set([...nonSquare.map(n => n.name), 'UNDINE_IMG', 'YAOBIKUNI_IMG', 'PLANT_IMG']);
    for (const id of watched) {
      const target = measured.find(m => m.name === id);
      const ratio = target ? target.long / median : 0;
      check(`${id} が他と同じくらいの大きさで並ぶ`, !!target && ratio <= MAX_RATIO && ratio >= MIN_RATIO,
        target ? `長辺${target.long.toFixed(1)}px / 中央値${median.toFixed(1)}px = ${ratio.toFixed(2)}倍` : '見つからない');
    }
  }

  console.log(failed ? `\n${failed}件のNGがあります` : '\nすべてOK');
  process.exit(failed ? 1 : 0);
};

run().catch(e => { console.error(e); process.exit(1); });

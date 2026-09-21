// ==================== 敵モンスターの立ち絵 ====================
// 絵の実体は monster-hero/images/enemies/<名前>.png。ここにはそのパスだけを書く
// (monster-hero/index.html から見た相対パス)。
// 以前は base64 で直接埋め込んでいたが、2026年8月にPNGファイルへ移した
// (tools/extract-images.js)。パスの綴り間違い・置き忘れは
// tools/image-asset-check.js が拾う。

const DINO_IMG = "images/enemies/dino.png?v=75352243f211";

const GEL_IMG = "images/enemies/gel.png?v=d222e94eff5b";

const BLACKDINO_IMG = "images/enemies/blackdino.png?v=59ee42098b91";

const JAAKUSOU_IMG = "images/enemies/jaakusou.png?v=8f219a50db79";

const BLUEMOUNTAIN_IMG = "images/enemies/bluemountain.png?v=f8409f1401ca";

const GALI_IMG = "images/enemies/gali.png?v=4dae1c1c20e3";

const NAGA_IMG = "images/enemies/naga.png?v=318937e614cf";

const LILIM_IMG = "images/enemies/lilim.png?v=f44ed650b4b0";

const DURAHAN_IMG = "images/enemies/durahan.png?v=0e3efd4f697c";

const MOO_IMG_DATA = "images/enemies/moo.png?v=7a627d848865";

// ムーは立ち絵とフル表示で同じ絵を使うため、パスを2度書かず参照にしている。
// 同じ絵を使い回す場合は必ずこの書き方にすること(同じPNGを2枚置かないため)
const MOO_FULL = MOO_IMG_DATA;

// ==================== タクティクスバトル専用の敵 ====================
// クラシック・クイックの敵(上の10体)とは**別の並び**。絵の原本は
// tools/art-sources/enemies-tactics/ にあり、切り抜きは tools/image/cutout-enemy-art.js が行う。
const KAWAZUMO_IMG = "images/enemies/kawazumo.png?v=08c8b262b58f";
const METALNER_IMG = "images/enemies/metalner.png?v=38cc7430f2c9";
const INARI_IMG = "images/enemies/inari.png?v=ea15b3514b74";
const KOINOBORI_IMG = "images/enemies/koinobori.png?v=7bb85f621400";
const DELPIERO_IMG = "images/enemies/delpiero.png?v=da77811b0ed6";
const DOKUDOKU_IMG = "images/enemies/dokudoku.png?v=726ce32b496f";
const LAMIA_IMG = "images/enemies/lamia.png?v=020567f78d11";
const NYARLATHOTEP_IMG = "images/enemies/nyarlathotep.png?v=1c06ecec5d28";
const SPLATTER_IMG = "images/enemies/splatter.png?v=d06aa3857300";
const AWAKENED_MOO_IMG = "images/enemies/awakened-moo.png?v=d54b0b0eb47b";

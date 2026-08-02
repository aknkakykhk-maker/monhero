// ==================== 敵モンスターの立ち絵 ====================
// 絵の実体は monster-hero/images/enemies/<名前>.png。ここにはそのパスだけを書く
// (monster-hero/index.html から見た相対パス)。
// 以前は base64 で直接埋め込んでいたが、2026年8月にPNGファイルへ移した
// (tools/extract-images.js)。パスの綴り間違い・置き忘れは
// tools/image-asset-check.js が拾う。

const DINO_IMG = "images/enemies/dino.png?v=81319f130d3e";

const GEL_IMG = "images/enemies/gel.png?v=689cfe44fc1d";

const BLACKDINO_IMG = "images/enemies/blackdino.png?v=735a31f5c218";

const JAAKUSOU_IMG = "images/enemies/jaakusou.png?v=dd4434a9037e";

const BLUEMOUNTAIN_IMG = "images/enemies/bluemountain.png?v=199e8150d301";

const GALI_IMG = "images/enemies/gali.png?v=3ade248f7009";

const NAGA_IMG = "images/enemies/naga.png?v=30c8748fe732";

const LILIM_IMG = "images/enemies/lilim.png?v=3e44b5ba6448";

const DURAHAN_IMG = "images/enemies/durahan.png?v=46bef967b6b2";

const MOO_IMG_DATA = "images/enemies/moo.png?v=0160c034481a";

// ムーは立ち絵とフル表示で同じ絵を使うため、パスを2度書かず参照にしている。
// 同じ絵を使い回す場合は必ずこの書き方にすること(同じPNGを2枚置かないため)
const MOO_FULL = MOO_IMG_DATA;

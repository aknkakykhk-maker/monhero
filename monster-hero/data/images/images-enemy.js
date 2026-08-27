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

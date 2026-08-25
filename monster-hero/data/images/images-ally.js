// ==================== 全身アイコン・立ち絵 (imgUrl / iconUrl) ====================
// imgUrl: バトル画面の立ち絵。iconUrl: ロースター一覧等で使う全身アイコン。
// 新モンスター追加時は、このセクションに imgUrl/iconUrl を必ず追加すること。
//
// 【画像の置き場所】絵の実体は monster-hero/images/ 以下のPNGファイルで、ここには
// そのパスだけを書く(monster-hero/index.html から見た相対パス)。
//   立ち絵     images/monsters/<名前>.png
//   全身アイコン images/monster-icons/<名前>.png
//   顔アイコン   images/monster-icons/face/<名前>.png
// 以前はここへ base64 で直接埋め込んでいたが、実データより約33%大きくなるうえ、
// 1枚差し替えるだけでこのファイル(4.3MB)を丸ごと落とし直すことになっていたため、
// 2026年8月にPNGファイルへ移した(tools/extract-images.js)。
//
// 【重要】同じ絵を使い回す場合はパスを2回書かず、先に定義した変数を参照すること
// (例: const SUEZO_ICON = SUEZO_IMG;)。同じ絵のファイルを2枚置かないための決まりで、
// 崩れていないかは tools/image-report.js で確認できる。
// パスの綴り間違い・置き忘れは tools/image-asset-check.js が拾う。
const MOCCHI_IMG = "images/monsters/mocchi.png?v=f8d4f69ac32c";
const MOCCHI_DYE_MASK = "images/monsters/mocchi-dye-mask.PNG?v=9ae119148b72";
const HAM_IMG = "images/monsters/ham.png?v=40397c7cc50e";
const TIGER_ROLLBACK_IMG = "images/monsters/tiger.png?v=7066f58deafb";
const TIGER_ROLLBACK_ICON = "images/monster-icons/tiger.png?v=d45553b8bd12";
const TIGER_IMG = "images/monsters/tiger.PNG?v=c5e09bb1f395";
const PIXIE_IMG = "images/monsters/pixie.png?v=a8b45bbc0312";
const MIA_IMG = "images/monsters/mia.PNG?v=883e25c3717a";
const SUEZO_IMG = "images/monsters/suezo.png?v=979846ef01a1";
const GOLEM_IMG = "images/monsters/golem.png?v=497d87ab23d5";
const MONOL_IMG = "images/monsters/monol.png?v=5527c974fa3e";
const OBORO_IMG = "images/monsters/oboro.png?v=fb0ab6eb992f";
const PLANT_IMG = "images/monsters/plant.PNG?v=3a97c9d64bd7";
const PLANT_DYE_MASK = "images/monsters/plant-dye-mask.PNG?v=474534e5b930";
const ZAN_IMG = "images/monsters/zan.png?v=1d798611b6bd";
const MITARASHI_IMG = "images/monsters/mitarashi.png?v=2a637bc237b6";
const ARK_IMG = "images/monsters/ark.png?v=4f978d873f99";
const IBLIS_IMG = "images/monsters/iblis.png?v=9b2efa1e0744";
const SNEGUROCHKA_IMG = "images/monsters/snegurochka.png?v=81fb95247bc6";
// 2026年8月に追加した人魚2体。いただいた立ち絵をそのまま使い、丸いアイコンでの見え方は
// 画像を作り直さず MARKET_PROFILE_ICON_STYLES の scale/x/y で寄せている
const UNDINE_IMG = "images/monsters/undine.PNG?v=5cb4df81fcb7";
const YAOBIKUNI_IMG = "images/monsters/yaobikuni.PNG?v=efbd9d5dd6fa";
const YAOBIKUNI_DYE_MASK = "images/monsters/yaobikuni-dye-mask2.PNG?v=c641333fe3c6";

const MOCCHI_ICON = MOCCHI_IMG;
const HAM_ICON = HAM_IMG;
const TIGER_ICON = TIGER_IMG;
const PIXIE_ICON = PIXIE_IMG;
const MIA_ICON = MIA_IMG;
const SUEZO_ICON = SUEZO_IMG;
const GOLEM_ICON = GOLEM_IMG;
const MONOL_ICON = "images/monster-icons/monol.png?v=7e8c9c35fd62";
const OBORO_ICON = "images/monster-icons/oboro.png?v=d8d0981d2921";
const PLANT_ICON = PLANT_IMG;
const ZAN_ICON = ZAN_IMG;
const MITARASHI_ICON = MITARASHI_IMG;
const ARK_ICON = ARK_IMG;
const IBLIS_ICON = IBLIS_IMG;
const SNEGUROCHKA_ICON = SNEGUROCHKA_IMG;
const UNDINE_ICON = UNDINE_IMG;
const YAOBIKUNI_ICON = YAOBIKUNI_IMG;

// ==================== 顔アイコン (faceIconUrl) ====================
// プロフィールアイコン選択画面・ロースター詳細等で使う顔クロップ画像。
// 新モンスター追加時は、このセクションに faceIconUrl を必ず追加すること
// (data/breeder.js 側には置かない。ally-monsters.js より後に読み込まれるため、
// faceIconUrl として参照すると load-order エラーになる)。
// 顔アイコンは 256x256。立ち絵から顔の範囲を切り出して作る(tools/make-face-icons.js に
// モンスターごとの切り出し範囲を実測値で持たせてある。範囲を直したら再実行すれば作り直せる)。
// ライガー・モノリス・オボロゲソウ・ザンのように元絵が顔中心の構図で、全身アイコンを
// そのまま顔アイコンとして使えるモンスターだけ、base64 を重複させず変数参照にしている。
const MOCCHI_FACE_ICON = "images/monster-icons/face/mocchi.png?v=13f5804c1dd1";
const HAM_FACE_ICON = "images/monster-icons/face/ham.png?v=a267da2b457e";
const TIGER_FACE_ICON = TIGER_ICON;
const PIXIE_FACE_ICON = "images/monster-icons/face/pixie.png?v=91ad4058896a";
const MIA_FACE_ICON = MIA_IMG;
const SUEZO_FACE_ICON = "images/monster-icons/face/suezo.png?v=90766f3c0cb1";
const GOLEM_FACE_ICON = "images/monster-icons/face/golem.png?v=708a1f656fc7";
const MONOL_FACE_ICON = MONOL_ICON;
const OBORO_FACE_ICON = OBORO_ICON;
const PLANT_FACE_ICON = PLANT_IMG;
const ZAN_FACE_ICON = "images/monster-icons/face/zan.png?v=f6a88d1769df";
const MITARASHI_FACE_ICON = "images/monster-icons/face/mitarashi.png?v=5176f031b2ce";
const ARK_FACE_ICON = "images/monster-icons/face/ark.png?v=222959bd0def";
const IBLIS_FACE_ICON = "images/monster-icons/face/iblis.png?v=46d9d96874ae";
const SNEGUROCHKA_FACE_ICON = "images/monster-icons/face/snegurochka.png?v=c3b4e8213dd1";
// 顔クロップ画像は作らず、立ち絵をそのまま使う(表示側で寄せる方針)
const UNDINE_FACE_ICON = UNDINE_IMG;
const YAOBIKUNI_FACE_ICON = YAOBIKUNI_IMG;

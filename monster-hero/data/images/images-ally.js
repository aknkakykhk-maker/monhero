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
const HAM_IMG = "images/monsters/ham.png?v=513e9b26e67a";
const TIGER_IMG = "images/monsters/tiger.png?v=7066f58deafb";
const PIXIE_IMG = "images/monsters/pixie.png?v=a8b45bbc0312";
const SUEZO_IMG = "images/monsters/suezo.png?v=979846ef01a1";
const GOLEM_IMG = "images/monsters/golem.png?v=497d87ab23d5";
const MONOL_IMG = "images/monsters/monol.png?v=5527c974fa3e";
const OBORO_IMG = "images/monsters/oboro.png?v=fb0ab6eb992f";
const ZAN_IMG = "images/monsters/zan.png?v=190a2cd61c75";
const MITARASHI_IMG = "images/monsters/mitarashi.png?v=2a637bc237b6";
const ARK_IMG = "images/monsters/ark.png?v=8e498956946e";
const IBLIS_IMG = "images/monsters/iblis.png?v=9b2efa1e0744";

const MOCCHI_ICON = MOCCHI_IMG;
const HAM_ICON = "images/monster-icons/ham.png?v=b8e74464588e";
const TIGER_ICON = "images/monster-icons/tiger.png?v=d45553b8bd12";
const PIXIE_ICON = PIXIE_IMG;
const SUEZO_ICON = SUEZO_IMG;
const GOLEM_ICON = GOLEM_IMG;
const MONOL_ICON = "images/monster-icons/monol.png?v=7e8c9c35fd62";
const OBORO_ICON = "images/monster-icons/oboro.png?v=d8d0981d2921";
const ZAN_ICON = "images/monster-icons/zan.png?v=56d9a300b038";
const MITARASHI_ICON = MITARASHI_IMG;
const ARK_ICON = "images/monster-icons/ark.png?v=299cb6faf32a";
const IBLIS_ICON = IBLIS_IMG;

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
const HAM_FACE_ICON = "images/monster-icons/face/ham.png?v=de97b54fa6f6";
const TIGER_FACE_ICON = TIGER_ICON;
const PIXIE_FACE_ICON = "images/monster-icons/face/pixie.png?v=91ad4058896a";
const SUEZO_FACE_ICON = "images/monster-icons/face/suezo.png?v=90766f3c0cb1";
const GOLEM_FACE_ICON = "images/monster-icons/face/golem.png?v=708a1f656fc7";
const MONOL_FACE_ICON = MONOL_ICON;
const OBORO_FACE_ICON = OBORO_ICON;
const ZAN_FACE_ICON = "images/monster-icons/face/zan.png?v=7b6032acfa5d";
const MITARASHI_FACE_ICON = "images/monster-icons/face/mitarashi.png?v=5176f031b2ce";
const ARK_FACE_ICON = "images/monster-icons/face/ark.png?v=44703e0069d2";
const IBLIS_FACE_ICON = "images/monster-icons/face/iblis.png?v=46d9d96874ae";

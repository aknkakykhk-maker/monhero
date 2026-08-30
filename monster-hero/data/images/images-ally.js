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
const MOCCHI_IMG = "images/monsters/mocchi.png?v=6313d2c2226d";
const MOCCHI_DYE_MASK = "images/monsters/mocchi-dye-mask.PNG?v=564423bd0e32";
const HAM_IMG = "images/monsters/ham.png?v=106321d09a72";
const TIGER_ROLLBACK_IMG = "images/monsters/tiger.png?v=38f7f50cd68b";
const TIGER_ROLLBACK_ICON = "images/monster-icons/tiger.png?v=4519062c1312";
const TIGER_IMG = "images/monsters/tiger.PNG?v=774d21917ef1";
const PIXIE_IMG = "images/monsters/pixie.png?v=ecd7433b3190";
const MIA_IMG = "images/monsters/mia.PNG?v=a2b1a26f451c";
const PANDORA_IMG = "images/monsters/pandora.PNG?v=f8009b5d2b5e";
const PANDORA_DYE_MASK = "images/monsters/pandora-dye-mask.PNG?v=3dae0c26d9a1";
const SUEZO_IMG = "images/monsters/suezo.png?v=979846ef01a1";
const GOLEM_IMG = "images/monsters/golem.png?v=8106dff84f6b";
const MONOL_IMG = "images/monsters/monol.png?v=b5fb70799e42";
const OBORO_IMG = "images/monsters/oboro.png?v=fb0ab6eb992f";
const PLANT_IMG = "images/monsters/plant.PNG?v=398cacbadab3";
const PLANT_DYE_MASK = "images/monsters/plant-dye-mask.PNG?v=cad1fda53cf2";
const ZAN_IMG = "images/monsters/zan.png?v=2293b346833c";
const MITARASHI_IMG = "images/monsters/mitarashi.png?v=192d9cc253d8";
const ARK_IMG = "images/monsters/ark.png?v=a9dce68b24d4";
const IBLIS_IMG = "images/monsters/iblis.png?v=c3ce989b339d";
const SNEGUROCHKA_IMG = "images/monsters/snegurochka.png?v=9843be5ed231";
// 2026年8月に追加した人魚2体。いただいた立ち絵をそのまま使い、丸いアイコンでの見え方は
// 画像を作り直さず MARKET_PROFILE_ICON_STYLES の scale/x/y で寄せている
const UNDINE_IMG = "images/monsters/undine.PNG?v=bf5593ae061a";
const YAOBIKUNI_IMG = "images/monsters/yaobikuni.PNG?v=e23821f9d695";
const YAOBIKUNI_DYE_MASK = "images/monsters/yaobikuni-dye-mask2.PNG?v=33881ea3c9bf";
// 2026年8月に追加準備中のレア「エイキ」(ザン×？？？)。正式実装まではデバッグ専用。
// 染色マスクは承認済みマスクの範囲そのままで、色だけリポジトリ仕様(赤=①/緑=②/青=③)へ
// 置き換えたもの(tools/image/convert-dye-mask.js)。形は1画素も描き直していない
const EIKI_IMG = "images/monsters/eiki.png?v=0105e40f8d1a";
const EIKI_DYE_MASK = "images/monsters/eiki-dye-mask.PNG?v=6b5ab28ef5b4";

const MOCCHI_ICON = MOCCHI_IMG;
const HAM_ICON = HAM_IMG;
const TIGER_ICON = TIGER_IMG;
const PIXIE_ICON = PIXIE_IMG;
const MIA_ICON = MIA_IMG;
const PANDORA_ICON = PANDORA_IMG;
const SUEZO_ICON = SUEZO_IMG;
const GOLEM_ICON = GOLEM_IMG;
const MONOL_ICON = "images/monster-icons/monol.png?v=4cf3dfdabd37";
const OBORO_ICON = "images/monster-icons/oboro.png?v=fe961f0622a4";
const PLANT_ICON = PLANT_IMG;
const ZAN_ICON = ZAN_IMG;
const MITARASHI_ICON = MITARASHI_IMG;
const ARK_ICON = ARK_IMG;
const IBLIS_ICON = IBLIS_IMG;
const SNEGUROCHKA_ICON = SNEGUROCHKA_IMG;
const UNDINE_ICON = UNDINE_IMG;
const YAOBIKUNI_ICON = YAOBIKUNI_IMG;
const EIKI_ICON = EIKI_IMG;

// ==================== 顔アイコン (faceIconUrl) ====================
// プロフィールアイコン選択画面・ロースター詳細等で使う顔クロップ画像。
// 新モンスター追加時は、このセクションに faceIconUrl を必ず追加すること
// (data/breeder.js 側には置かない。ally-monsters.js より後に読み込まれるため、
// faceIconUrl として参照すると load-order エラーになる)。
// 顔アイコンは 256x256。立ち絵から顔の範囲を切り出して作る(tools/make-face-icons.js に
// モンスターごとの切り出し範囲を実測値で持たせてある。範囲を直したら再実行すれば作り直せる)。
// ライガー・モノリス・オボロゲソウ・ザンのように元絵が顔中心の構図で、全身アイコンを
// そのまま顔アイコンとして使えるモンスターだけ、base64 を重複させず変数参照にしている。
const MOCCHI_FACE_ICON = "images/monster-icons/face/mocchi.png?v=96be4cbc1468";
const HAM_FACE_ICON = "images/monster-icons/face/ham.png?v=fbe8e4f70214";
const TIGER_FACE_ICON = TIGER_ICON;
const PIXIE_FACE_ICON = "images/monster-icons/face/pixie.png?v=d33b92e39fa0";
const MIA_FACE_ICON = MIA_IMG;
const PANDORA_FACE_ICON = PANDORA_IMG;
const SUEZO_FACE_ICON = "images/monster-icons/face/suezo.png?v=696938ca7d63";
const GOLEM_FACE_ICON = "images/monster-icons/face/golem.png?v=8ef71840d1d5";
const MONOL_FACE_ICON = MONOL_ICON;
const OBORO_FACE_ICON = OBORO_ICON;
const PLANT_FACE_ICON = PLANT_IMG;
const ZAN_FACE_ICON = "images/monster-icons/face/zan.png?v=a1486779c37f";
const MITARASHI_FACE_ICON = "images/monster-icons/face/mitarashi.png?v=36f1cf509e8e";
const ARK_FACE_ICON = "images/monster-icons/face/ark.png?v=1ddd19baef6b";
const IBLIS_FACE_ICON = "images/monster-icons/face/iblis.png?v=9663afec97f9";
const SNEGUROCHKA_FACE_ICON = "images/monster-icons/face/snegurochka.png?v=b30d920ec35a";
// 顔クロップ画像は作らず、立ち絵をそのまま使う(表示側で寄せる方針)
const UNDINE_FACE_ICON = UNDINE_IMG;
const YAOBIKUNI_FACE_ICON = YAOBIKUNI_IMG;
// 立ち絵から切り出した顔クロップ(tools/image/make-face-icons.js)
const EIKI_FACE_ICON = "images/monster-icons/face/eiki.png?v=9605be0feb75";

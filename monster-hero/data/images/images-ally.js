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
const MOCCHI_DYE_MASK = "images/monsters/mocchi-dye-mask.PNG?v=2e735893ce54";
const HAM_IMG = "images/monsters/ham.png?v=106321d09a72";
const TIGER_ROLLBACK_IMG = "images/monsters/tiger.png?v=38f7f50cd68b";
const TIGER_ROLLBACK_ICON = "images/monster-icons/tiger.png?v=4519062c1312";
const TIGER_IMG = "images/monsters/tiger.PNG?v=774d21917ef1";
const PIXIE_IMG = "images/monsters/pixie.png?v=ecd7433b3190";
const MIA_IMG = "images/monsters/mia.PNG?v=a2b1a26f451c";
// ミーアの待機アニメ(翼の羽ばたき)用の切り抜きマスク。本体画像と同じ比率(2:3)で、白い所が見える所。
// 左翼・右翼は境目の継ぎ目が出ないよう少し太らせてあり、本体側は翼を除いた残り
const MIA_WING_LEFT_MASK = "images/monsters/mia-wing-left.png?v=691e69ca7c0c";
const MIA_WING_RIGHT_MASK = "images/monsters/mia-wing-right.png?v=8c9771e0c3f6";
const MIA_WING_BODY_MASK = "images/monsters/mia-wing-body.png?v=478633cf794b";
// ==== 待機アニメのマスク(tools/monster/idle-rig-build.js が書く。手で直さない) ====
const IDLE_GOLEM_ARM_L_MASK = "images/monsters/idle/golem-arm-l.png?v=638331d61615";
const IDLE_GOLEM_ARM_R_MASK = "images/monsters/idle/golem-arm-r.png?v=35881a33b040";
const IDLE_GOLEM_BODY_MASK = "images/monsters/idle/golem-body.png?v=989b36ba8cb5";
const IDLE_TIGER_TAIL_MASK = "images/monsters/idle/tiger-tail.png?v=6dc019bea847";
const IDLE_TIGER_BODY_MASK = "images/monsters/idle/tiger-body.png?v=f13ab91f7985";
const IDLE_HAM_EAR_L_MASK = "images/monsters/idle/ham-ear-l.png?v=e824cbd162de";
const IDLE_HAM_EAR_R_MASK = "images/monsters/idle/ham-ear-r.png?v=b1b0a61c6c94";
const IDLE_HAM_BODY_MASK = "images/monsters/idle/ham-body.png?v=9456a5a70416";
const IDLE_PIXIE_WING_L_MASK = "images/monsters/idle/pixie-wing-l.png?v=825733a32e5b";
const IDLE_PIXIE_WING_R_MASK = "images/monsters/idle/pixie-wing-r.png?v=696a08b674da";
const IDLE_PIXIE_TAIL_MASK = "images/monsters/idle/pixie-tail.png?v=97d36fc218b5";
const IDLE_PIXIE_BODY_MASK = "images/monsters/idle/pixie-body.png?v=0fa45b2a7912";
const IDLE_MIA_WING_L_MASK = "images/monsters/idle/mia-wing-l.png?v=f2465c6a341b";
const IDLE_MIA_WING_R_MASK = "images/monsters/idle/mia-wing-r.png?v=0c92def0fd61";
const IDLE_MIA_BODY_MASK = "images/monsters/idle/mia-body.png?v=b0a31496c22d";
const IDLE_PANDORA_WING_L_MASK = "images/monsters/idle/pandora-wing-l.png?v=0ab419eb6d6c";
const IDLE_PANDORA_WING_R_MASK = "images/monsters/idle/pandora-wing-r.png?v=991ebd8130cf";
const IDLE_PANDORA_TAIL_L_MASK = "images/monsters/idle/pandora-tail-l.png?v=8bcabe9075e7";
const IDLE_PANDORA_TAIL_R_MASK = "images/monsters/idle/pandora-tail-r.png?v=26eba902c248";
const IDLE_PANDORA_BODY_MASK = "images/monsters/idle/pandora-body.png?v=5b2440d7fe51";
const IDLE_OBORO_FLOWER_T_MASK = "images/monsters/idle/oboro-flower-t.png?v=5509b15bbd93";
const IDLE_OBORO_FLOWER_L_MASK = "images/monsters/idle/oboro-flower-l.png?v=8945c216a458";
const IDLE_OBORO_FLOWER_R_MASK = "images/monsters/idle/oboro-flower-r.png?v=f45fac8bae1f";
const IDLE_OBORO_BODY_MASK = "images/monsters/idle/oboro-body.png?v=3c0f4c3f8549";
const IDLE_PLANT_FLOWER_T_MASK = "images/monsters/idle/plant-flower-t.png?v=6ad1fcb8b2cc";
const IDLE_PLANT_FLOWER_L_MASK = "images/monsters/idle/plant-flower-l.png?v=96ab23f2bc4e";
const IDLE_PLANT_FLOWER_R_MASK = "images/monsters/idle/plant-flower-r.png?v=4e6daa14b567";
const IDLE_PLANT_BODY_MASK = "images/monsters/idle/plant-body.png?v=0add8bfa9a7b";
const IDLE_ZAN_BLADE_L_MASK = "images/monsters/idle/zan-blade-l.png?v=90b1a7413f73";
const IDLE_ZAN_BLADE_R_MASK = "images/monsters/idle/zan-blade-r.png?v=a45f8f5860c3";
const IDLE_ZAN_BODY_MASK = "images/monsters/idle/zan-body.png?v=1b642fe86de9";
const IDLE_MITARASHI_WING_L_MASK = "images/monsters/idle/mitarashi-wing-l.png?v=aaa9f00601e7";
const IDLE_MITARASHI_WING_R_MASK = "images/monsters/idle/mitarashi-wing-r.png?v=56a7346f4d00";
const IDLE_MITARASHI_BODY_MASK = "images/monsters/idle/mitarashi-body.png?v=9f4b15d818c7";
const IDLE_ARK_CROWN_MASK = "images/monsters/idle/ark-crown.png?v=145d71b2169c";
const IDLE_ARK_HALO_MASK = "images/monsters/idle/ark-halo.png?v=7bf9d3ffb71a";
const IDLE_ARK_BODY_MASK = "images/monsters/idle/ark-body.png?v=9fcf6f2e737f";
const IDLE_IBLIS_WING_L_MASK = "images/monsters/idle/iblis-wing-l.png?v=7365c45b6415";
const IDLE_IBLIS_WING_R_MASK = "images/monsters/idle/iblis-wing-r.png?v=5e0c16118a9b";
const IDLE_IBLIS_ORB_MASK = "images/monsters/idle/iblis-orb.png?v=d8a65e3e5bc8";
const IDLE_IBLIS_BODY_MASK = "images/monsters/idle/iblis-body.png?v=ac60a979e7a3";
const IDLE_SNEGUROCHKA_FIN_MASK = "images/monsters/idle/snegurochka-fin.png?v=2afccd8c6480";
const IDLE_SNEGUROCHKA_BODY_MASK = "images/monsters/idle/snegurochka-body.png?v=d0e512471f7b";
const IDLE_UNDINE_FIN_MASK = "images/monsters/idle/undine-fin.png?v=2c6e12c3af55";
const IDLE_UNDINE_BODY_MASK = "images/monsters/idle/undine-body.png?v=3cc4dcdf1aa5";
const IDLE_YAOBIKUNI_FIN_MASK = "images/monsters/idle/yaobikuni-fin.png?v=6cbb59116f5e";
const IDLE_YAOBIKUNI_BODY_MASK = "images/monsters/idle/yaobikuni-body.png?v=9b2bd587b918";
const IDLE_KENSHI_MOCCHI_SWORD_L_MASK = "images/monsters/idle/kenshi-mocchi-sword-l.png?v=f8c00ae74cb6";
const IDLE_KENSHI_MOCCHI_SWORD_R_MASK = "images/monsters/idle/kenshi-mocchi-sword-r.png?v=12c5dc690c0f";
const IDLE_KENSHI_MOCCHI_BODY_MASK = "images/monsters/idle/kenshi-mocchi-body.png?v=a0b84fe94ad6";
// ==== 待機アニメのマスク ここまで ====
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
// 2026年9月に追加準備中のレア「剣士モッチー」(モッチー×？？？)。正式実装まではデバッグ専用。
// 染色は5部位で、承認済みマスクの色分けがそのままリポジトリ仕様に合っている
// (赤=①肌 / 緑=②コート・ブーツ / 青=③髪 / 黄=④左手の剣 / マゼンタ=⑤右手の剣)。
// 配信しているPNGは、その承認済みマスクを本番と同じ判定(_exactDyeMaskRegion)で読み直し、
// 純色へそろえただけのもの(node tools/image/convert-dye-mask.js --snap)。
// どの画素がどの染色になるかは1画素も変わらず、色数が減ったぶん953KB→37KBになっている。
// 描き直していない原本は tools/art-sources/dye-masks/kenshi-mocchi-dye-mask.PNG に置いてある
const KENSHI_MOCCHI_IMG = "images/monsters/kenshi-mocchi.png?v=63509132e701";
const KENSHI_MOCCHI_DYE_MASK = "images/monsters/kenshi-mocchi-dye-mask.PNG?v=25a6a1282265";

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
const KENSHI_MOCCHI_ICON = KENSHI_MOCCHI_IMG;

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
const UNDINE_FACE_ICON = "images/monster-icons/face/undine.png?v=fe1ba930173b";
const YAOBIKUNI_FACE_ICON = "images/monster-icons/face/yaobikuni.png?v=32838d8bdd5a";
// 立ち絵から切り出した顔クロップ(tools/image/make-face-icons.js)
const EIKI_FACE_ICON = "images/monster-icons/face/eiki.png?v=9605be0feb75";
const KENSHI_MOCCHI_FACE_ICON = "images/monster-icons/face/kenshi-mocchi.png?v=fed887e4c278";

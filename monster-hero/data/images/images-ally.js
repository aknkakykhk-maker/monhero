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
const IDLE_YGGDRASIL_LEAF_TOP_MASK = "images/monsters/idle/yggdrasil-leaf-top.png?v=c467be4a9cca";
const IDLE_YGGDRASIL_LEAF_SIDE_MASK = "images/monsters/idle/yggdrasil-leaf-side.png?v=4aa91a581ac5";
const IDLE_YGGDRASIL_BODY_MASK = "images/monsters/idle/yggdrasil-body.png?v=af0d075f168e";
const IDLE_MEL_WHIP_UMBRELLA_MASK = "images/monsters/idle/mel-whip-umbrella.png?v=591894879058";
const IDLE_MEL_WHIP_BODY_MASK = "images/monsters/idle/mel-whip-body.png?v=819b121a5e2d";
const IDLE_GHOST_TAIL_MASK = "images/monsters/idle/ghost-tail.png?v=f9686155b6d3";
const IDLE_GHOST_BODY_MASK = "images/monsters/idle/ghost-body.png?v=a9a4123c0caf";
const IDLE_SPOOKY_TAIL_MASK = "images/monsters/idle/spooky-tail.png?v=9589d97affb5";
const IDLE_SPOOKY_HAT_TIP_MASK = "images/monsters/idle/spooky-hat-tip.png?v=f02d9a623af0";
const IDLE_SPOOKY_BODY_MASK = "images/monsters/idle/spooky-body.png?v=c3cb8ed1d676";
const IDLE_MELODY_TAIL_MASK = "images/monsters/idle/melody-tail.png?v=579615044fc8";
const IDLE_MELODY_BODY_MASK = "images/monsters/idle/melody-body.png?v=3869ff0db58d";
const IDLE_KUROMY_TAIL_MASK = "images/monsters/idle/kuromy-tail.png?v=a02f098899c3";
const IDLE_KUROMY_BODY_MASK = "images/monsters/idle/kuromy-body.png?v=583be302c81f";
const IDLE_ILLUMINE_HAIR_L_MASK = "images/monsters/idle/illumine-hair-l.png?v=42f83fd1c48c";
const IDLE_ILLUMINE_HAIR_R_MASK = "images/monsters/idle/illumine-hair-r.png?v=3422e29ad168";
const IDLE_ILLUMINE_BODY_MASK = "images/monsters/idle/illumine-body.png?v=21237b3cdd06";
const IDLE_DREAMY_BEADS_L_MASK = "images/monsters/idle/dreamy-beads-l.png?v=0eab9c502bfa";
const IDLE_DREAMY_BEADS_R_MASK = "images/monsters/idle/dreamy-beads-r.png?v=b454bc9f0327";
const IDLE_DREAMY_BODY_MASK = "images/monsters/idle/dreamy-body.png?v=6b6215543408";
// ==== 待機アニメのマスク ここまで ====
const PANDORA_IMG = "images/monsters/pandora.PNG?v=f8009b5d2b5e";
const PANDORA_DYE_MASK = "images/monsters/pandora-dye-mask.PNG?v=3dae0c26d9a1";
// パンドラの箱(タクティクスEX)の間だけ出す、悪魔・天使の姿。起動時には読まない(箱を使うときに先読みする)
const PANDORA_DEVIL_IMG = "images/monsters/pandora-devil.PNG?v=5ce010729f00";
const PANDORA_ANGEL_IMG = "images/monsters/pandora-angel.PNG?v=d3dedf0b3d90";
const SUEZO_IMG = "images/monsters/suezo.png?v=979846ef01a1";
const GOLEM_IMG = "images/monsters/golem.png?v=8106dff84f6b";
const MONOL_IMG = "images/monsters/monol.png?v=b5fb70799e42";
const OBORO_IMG = "images/monsters/oboro.png?v=fb0ab6eb992f";
const PLANT_IMG = "images/monsters/plant.PNG?v=398cacbadab3";
const PLANT_DYE_MASK = "images/monsters/plant-dye-mask.PNG?v=cad1fda53cf2";
const ZAN_IMG = "images/monsters/zan.png?v=4a2cee9000f3";
const MITARASHI_IMG = "images/monsters/mitarashi.png?v=b9c0850e77ce";
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
// 2026年9月に近日公開予定として絵だけ先に入れた2体(2026-09-28)。能力値・技はまだ決まっていないので
// ALL_PLAYER_MONSTERS には入れていない。マーケットとビートP交換所には近日公開(available:false)で並ぶ。
//   ユグドラシル … 新しい血統(ユグドラシル×ユグドラシル)
//   メルホイップ … ユグドラシル×？？？のレア
// 染色マスクは、いただいた3色マスクを立ち絵と同じ座標へ合わせて純色へそろえたもの
// (赤=① / 緑=② / 青=③。原本は tools/art-sources/dye-masks/ に置いてある)
const YGGDRASIL_IMG = "images/monsters/yggdrasil.png?v=8dddbfc4328f";
const YGGDRASIL_DYE_MASK = "images/monsters/yggdrasil-dye-mask.PNG?v=296998e6622f";
const MEL_WHIP_IMG = "images/monsters/mel-whip.png?v=629452e35b02";
const MEL_WHIP_DYE_MASK = "images/monsters/mel-whip-dye-mask.PNG?v=b7353a79a018";
// ゴースト(2026-10-05・新しい血統ゴーストの純血)。染色マスクは、いただいた3色の見本で部位を決め、
// 塗る範囲は絵の色のかたまりで決めたもの(tools/image/finish-dye-mask-components.js ghost)
const GHOST_IMG = "images/monsters/ghost.png?v=a8ded23fd634";
const GHOST_DYE_MASK = "images/monsters/ghost-dye-mask.PNG?v=253996bd5187";
// スプーキー(2026-10-05・ゴースト×？？？のレア)。染色マスクは5部位(①帽子・服 / ②手・しっぽ / ③かぼちゃの顔 /
// ④帽子のリボン・胸元の飾り / ⑤しっぽの先の枝)。ゴーストと同じ道具で作った(tools/image/finish-dye-mask-components.js spooky)
const SPOOKY_IMG = "images/monsters/spooky.png?v=cc8ebc4b6425";
const SPOOKY_DYE_MASK = "images/monsters/spooky-dye-mask.PNG?v=e981a71afc3c";
// メロディー(2026-10-07・案の段階・ユグドラシル×？？？)。染色マスクは5部位(①傘・象の頭と尻尾の毛 / ②帽子(頭巾)と襟 /
// ③白い所(顔・体・傘の羊の顔・フリル・象の爪) / ④象の体・リボン / ⑤象の耳の内側)。原本は tools/art-sources/dye-masks/melody-dye-mask-received.png
const MELODY_IMG = "images/monsters/melody.png?v=fe4dca0cce33";
const MELODY_DYE_MASK = "images/monsters/melody-dye-mask.PNG?v=54d7600776ef";
// クロミー(2026-10-07・案の段階・ユグドラシル×？？？)。染色マスクは5部位(①傘のピンク・どくろ・玉とリボン / ②傘のフリル /
// ③黒い帽子(頭巾・耳・ケープ・しっぽ) / ④乗っている子の白い所 / ⑤下の生き物の濃い紫)。原本は tools/art-sources/dye-masks/kuromy-dye-mask-received.png
const KUROMY_IMG = "images/monsters/kuromy.png?v=02bdee0dc9f6";
const KUROMY_DYE_MASK = "images/monsters/kuromy-dye-mask.PNG?v=7e06f8e564b2";
// イルミネ・ドリーミィ(2026-10-22・案の段階・イルミネ×イルミネ / イルミネ×ニャー)。
// 元絵は tools/art-sources/new-monsters-2026-10-22/。透明な余白を切って高さ916pxへ縮め、256色へ減色(グラデーションの段が出ないよう誤差拡散)
const ILLUMINE_IMG = "images/monsters/illumine.png?v=856c3192a848";
const ILLUMINE_DYE_MASK = "images/monsters/illumine-dye-mask.PNG?v=f129752bb07a";
const DREAMY_DYE_MASK = "images/monsters/dreamy-dye-mask.PNG?v=0a38c9def40d";
const DREAMY_IMG = "images/monsters/dreamy.png?v=14e1f738cec9";
// 新しい16種(2026-10-24・まだ味方には入れていない)。ファイル名はカードの種族名(data/card-battle-cards.js の species)。
// 元絵は tools/art-sources/new-monsters-2026-10-24/。透明な余白を切って高さ916pxへ縮め、256色へ減色。
// ケンタウロスは背景に散ったごく薄い光の画素(不透明度64未満)を消してから取り込んだ
const MF_DINO_IMG = "images/monsters/dino.png?v=ac797293f479";
const MF_GALI_IMG = "images/monsters/gali.png?v=802cb6ce6f64";
const MF_NAGA_IMG = "images/monsters/naga.png?v=07114a6c8886";
const MF_DRAGON_IMG = "images/monsters/dragon.png?v=3c00722a5a78";
const MF_HENGER_IMG = "images/monsters/henger.png?v=87f6df286ad0";
const MF_DURAHAN_IMG = "images/monsters/durahan.png?v=9cbb4a00954c";
const MF_ARROWHEAD_IMG = "images/monsters/arrowhead.png?v=64f1d371ad4d";
const MF_ZILLA_IMG = "images/monsters/zilla.png?v=1d39343cc42d";
const MF_PHOENIX_IMG = "images/monsters/phoenix.png?v=c9a5b27b642f";
const MF_JOKER_IMG = "images/monsters/joker.png?v=6b89ffd17807";
const MF_JELL_IMG = "images/monsters/jell.png?v=7d1a439b82e5";
const MF_MEW_IMG = "images/monsters/mew.png?v=ade472351a21";
const MF_METALNER_IMG = "images/monsters/metalner.png?v=a975f4a4dee2";
const MF_WORM_IMG = "images/monsters/worm.png?v=ea6dcafd645b";
const MF_CENTAUR_IMG = "images/monsters/centaur.png?v=55e31863fe99";
const MF_COLORPANDORA_IMG = "images/monsters/colorpandora.png?v=9deee820503c";
// 混血モンスター(2026-10-24・まだ味方には入れていない)。MFバトルカードの混血15体(C-051〜C-065。C-060C は作らない)。
// ファイル名はカード番号(カード部と決めた)。元絵は tools/art-sources/hybrid-2026-10-24/。余白を切って高さ916px・256色。
// カードの対戦画面は HYBRID_MONSTER_IMGS だけを読む(番号 → 絵)。届いた分から足す
const HYBRID_C051_IMG = "images/monsters/c051.png?v=c0a0df62c4f7";
const HYBRID_C052_IMG = "images/monsters/c052.png?v=ef445601b28a";
const HYBRID_C053_IMG = "images/monsters/c053.png?v=ffa75a7fabaa";
const HYBRID_C054_IMG = "images/monsters/c054.png?v=94f20e8b1d54";
const HYBRID_C055_IMG = "images/monsters/c055.png?v=ce688625bfa6";
const HYBRID_C056_IMG = "images/monsters/c056.png?v=c83f29cf8474";
const HYBRID_C057_IMG = "images/monsters/c057.png?v=7ab1f75096ae";
const HYBRID_C058_IMG = "images/monsters/c058.png?v=596afc1e78b0";
const HYBRID_C059_IMG = "images/monsters/c059.png?v=1964b2187f85";
const HYBRID_C060_IMG = "images/monsters/c060.png?v=6c8364b880c5";
const HYBRID_C061_IMG = "images/monsters/c061.png?v=4e015080a484";
const HYBRID_C062_IMG = "images/monsters/c062.png?v=090cdd583324";
const HYBRID_C063_IMG = "images/monsters/c063.png?v=97693bd14c3a";
const HYBRID_MONSTER_IMGS = Object.freeze({
  'C-051': HYBRID_C051_IMG,
  'C-052': HYBRID_C052_IMG,
  'C-053': HYBRID_C053_IMG,
  'C-054': HYBRID_C054_IMG,
  'C-055': HYBRID_C055_IMG,
  'C-056': HYBRID_C056_IMG,
  'C-057': HYBRID_C057_IMG,
  'C-058': HYBRID_C058_IMG,
  'C-059': HYBRID_C059_IMG,
  'C-060': HYBRID_C060_IMG,
  'C-061': HYBRID_C061_IMG,
  'C-062': HYBRID_C062_IMG,
  'C-063': HYBRID_C063_IMG,
});

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
const YGGDRASIL_ICON = YGGDRASIL_IMG;
const MEL_WHIP_ICON = MEL_WHIP_IMG;
const GHOST_ICON = GHOST_IMG;
const SPOOKY_ICON = SPOOKY_IMG;
const MELODY_ICON = MELODY_IMG;
const KUROMY_ICON = KUROMY_IMG;
const ILLUMINE_ICON = ILLUMINE_IMG;
const DREAMY_ICON = DREAMY_IMG;
const ZAN_FACE_ICON = "images/monster-icons/face/zan.png?v=f341b74babb9";
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
const YGGDRASIL_FACE_ICON = "images/monster-icons/face/yggdrasil.png?v=da9792f6708f";
const MEL_WHIP_FACE_ICON = "images/monster-icons/face/mel-whip.png?v=5016f704506c";
const GHOST_FACE_ICON = "images/monster-icons/face/ghost.png?v=fdbc8d32d2cd";
const SPOOKY_FACE_ICON = "images/monster-icons/face/spooky.png?v=2c047a771ffe";
const MELODY_FACE_ICON = "images/monster-icons/face/melody.png?v=95bbe06158e4";
const KUROMY_FACE_ICON = "images/monster-icons/face/kuromy.png?v=29d41f754746";
// イルミネ・ドリーミィ(2026-10-22・案の段階)。顔アイコンは社長が選んだ案(範囲は tools/image/make-face-icons.js の FACE_BOXES)
const ILLUMINE_FACE_ICON = "images/monster-icons/face/illumine.png?v=68f84dc1972f";
const DREAMY_FACE_ICON = "images/monster-icons/face/dreamy.png?v=ff318780a036";
// 新しい16種(2026-10-24)。社長が A〜D の4案から選んだもの。範囲は tools/image/make-face-icons.js の FACE_BOXES
const MF_DINO_FACE_ICON = "images/monster-icons/face/dino.png?v=49ae7bf49bd7";
const MF_NAGA_FACE_ICON = "images/monster-icons/face/naga.png?v=3e34d760941f";
const MF_HENGER_FACE_ICON = "images/monster-icons/face/henger.png?v=0485ba6e277c";
const MF_ARROWHEAD_FACE_ICON = "images/monster-icons/face/arrowhead.png?v=92e7ed5fa2c1";
const MF_ZILLA_FACE_ICON = "images/monster-icons/face/zilla.png?v=baa8882d641e";
const MF_JOKER_FACE_ICON = "images/monster-icons/face/joker.png?v=44f6f8edaccc";
const MF_JELL_FACE_ICON = "images/monster-icons/face/jell.png?v=f775b1f7a7c9";
const MF_MEW_FACE_ICON = "images/monster-icons/face/mew.png?v=8c5f6a06b720";
const MF_METALNER_FACE_ICON = "images/monster-icons/face/metalner.png?v=ac30798baf9a";
const MF_CENTAUR_FACE_ICON = "images/monster-icons/face/centaur.png?v=90c8aff29500";
const MF_COLORPANDORA_FACE_ICON = "images/monster-icons/face/colorpandora.png?v=5b510b687438";
const MF_GALI_FACE_ICON = "images/monster-icons/face/gali.png?v=a793d773b628";
const MF_DRAGON_FACE_ICON = "images/monster-icons/face/dragon.png?v=411efc44bf8a";
const MF_DURAHAN_FACE_ICON = "images/monster-icons/face/durahan.png?v=475b35a2e468";
const MF_PHOENIX_FACE_ICON = "images/monster-icons/face/phoenix.png?v=7e70faa2de7a";
const MF_WORM_FACE_ICON = "images/monster-icons/face/worm.png?v=2edd20512375";

// 血統別のアイコン(エンブレム・144x146・金の枠つき)。2026-10-05・ユーザー提供の37個(blood-icons.zip)。
// 血統のid(MONSTER_LINEAGES)との対応は、このファイルの下の MONSTER_LINEAGE_ICONS。ゲームにまだ無い血統のぶんも先に入れてある(使うのは血統を足すとき)。
const LINEAGE_ICON_ARC = "images/lineage-icons/arc.png?v=4f256c2605d5";
const LINEAGE_ICON_ARROWHEAD = "images/lineage-icons/arrowhead.png?v=b7f1fb78b532";
const LINEAGE_ICON_CENTAUR = "images/lineage-icons/centaur.png?v=2955c68a245b";
const LINEAGE_ICON_DINO = "images/lineage-icons/dino.png?v=ee9a283c4162";
const LINEAGE_ICON_DRAGON = "images/lineage-icons/dragon.png?v=c975ba486f66";
const LINEAGE_ICON_DULLAHAN = "images/lineage-icons/dullahan.png?v=621b216348a4";
const LINEAGE_ICON_GALI = "images/lineage-icons/gali.png?v=f1abdcbd5897";
const LINEAGE_ICON_GEL = "images/lineage-icons/gel.png?v=35dc31692033";
const LINEAGE_ICON_GHOST = "images/lineage-icons/ghost.png?v=554b9cfa2d8a";
const LINEAGE_ICON_GOLEM = "images/lineage-icons/golem.png?v=bff6b81259a0";
const LINEAGE_ICON_GUJIRA = "images/lineage-icons/gujira.png?v=e6943f667162";
const LINEAGE_ICON_HAMU = "images/lineage-icons/hamu.png?v=77411bb1a419";
const LINEAGE_ICON_HENGER = "images/lineage-icons/henger.png?v=caabf81fae57";
const LINEAGE_ICON_HINOTORI = "images/lineage-icons/hinotori.png?v=e958afc3a95e";
const LINEAGE_ICON_ILLUMINE = "images/lineage-icons/illumine.png?v=50d4a6ccafc0";
const LINEAGE_ICON_JOKER = "images/lineage-icons/joker.png?v=4ad2d79131f2";
const LINEAGE_ICON_KAWAZUMO = "images/lineage-icons/kawazumo.png?v=7f19291da113";
const LINEAGE_ICON_KIJIN = "images/lineage-icons/kijin.png?v=78bacdd09da1";
const LINEAGE_ICON_KYUBI = "images/lineage-icons/kyubi.png?v=4de7bcf7c677";
const LINEAGE_ICON_LIGER = "images/lineage-icons/liger.png?v=b0f0c6f6000a";
const LINEAGE_ICON_LORD = "images/lineage-icons/lord.png?v=58e18dc44676";
const LINEAGE_ICON_METALNER = "images/lineage-icons/metalner.png?v=3750f738a637";
const LINEAGE_ICON_MOCCHI = "images/lineage-icons/mocchi.png?v=27db3dc6c682";
const LINEAGE_ICON_MONOLITH = "images/lineage-icons/monolith.png?v=bde2bf787815";
const LINEAGE_ICON_NAGA = "images/lineage-icons/naga.png?v=e5cf63063f8f";
const LINEAGE_ICON_NENDORO = "images/lineage-icons/nendoro.png?v=baa51ce3b5d3";
const LINEAGE_ICON_NOBLE = "images/lineage-icons/noble.png?v=cbc850ea9a66";
const LINEAGE_ICON_NYAA = "images/lineage-icons/nyaa.png?v=e9f36a0cbaba";
const LINEAGE_ICON_PIXIE = "images/lineage-icons/pixie.png?v=3b9050fe7617";
const LINEAGE_ICON_PLANT = "images/lineage-icons/plant.png?v=efb4f8fb8227";
const LINEAGE_ICON_RAREMON = "images/lineage-icons/raremon.png?v=d9b13d66ceda";
const LINEAGE_ICON_SHINRYU = "images/lineage-icons/shinryu.png?v=c2923e34d42c";
const LINEAGE_ICON_SUEZO = "images/lineage-icons/suezo.png?v=e25782aef2a4";
const LINEAGE_ICON_UNDINE = "images/lineage-icons/undine.png?v=9728d3a8bbe7";
const LINEAGE_ICON_WORM = "images/lineage-icons/worm.png?v=3b39e38ca672";
const LINEAGE_ICON_YGGDRASIL = "images/lineage-icons/yggdrasil.png?v=612ee0b767e7";
const LINEAGE_ICON_ZAN = "images/lineage-icons/zan.png?v=be0f440b9156";

// ---------- 血統のアイコン(エンブレム) ----------
// 血統のid(data/lineages.js の MONSTER_LINEAGES)→ 血統別のアイコンの画像(上の LINEAGE_ICON_*)。
// 2026-10-05・ユーザー提供。まだ画面では使っていない(ここは対応表だけ。どこへ出すかはこれから決める)。
// ★ファイル名の綴りが血統のidと違うもの: tiger=liger / ham=hamu / monol=monolith / ark=arc / unknown=raremon(「？」のアイコン)
// ★ゲームにまだ無い血統用の画像(naga・nendoro・lord・dino ほか)は、血統を足すときにここへ1行足して使う。
const MONSTER_LINEAGE_ICONS = Object.freeze({
  mocchi: LINEAGE_ICON_MOCCHI,
  suezo: LINEAGE_ICON_SUEZO,
  golem: LINEAGE_ICON_GOLEM,
  tiger: LINEAGE_ICON_LIGER,
  ham: LINEAGE_ICON_HAMU,
  pixie: LINEAGE_ICON_PIXIE,
  monol: LINEAGE_ICON_MONOLITH,
  zan: LINEAGE_ICON_ZAN,
  ark: LINEAGE_ICON_ARC,
  undine: LINEAGE_ICON_UNDINE,
  yggdrasil: LINEAGE_ICON_YGGDRASIL,
  ghost: LINEAGE_ICON_GHOST,
  illumine: LINEAGE_ICON_ILLUMINE,
  nya: LINEAGE_ICON_NYAA,
  dragon: LINEAGE_ICON_DRAGON,
  joker: LINEAGE_ICON_JOKER,
  plant: LINEAGE_ICON_PLANT,
  gel: LINEAGE_ICON_GEL,
  // 新しい16種(2026-10-24・案の段階)の血統。絵は前から置いてあったもの
  dino: LINEAGE_ICON_DINO,
  gali: LINEAGE_ICON_GALI,
  naga: LINEAGE_ICON_NAGA,
  henger: LINEAGE_ICON_HENGER,
  durahan: LINEAGE_ICON_DULLAHAN,
  arrowhead: LINEAGE_ICON_ARROWHEAD,
  zilla: LINEAGE_ICON_GUJIRA,
  phoenix: LINEAGE_ICON_HINOTORI,
  metalner: LINEAGE_ICON_METALNER,
  worm: LINEAGE_ICON_WORM,
  centaur: LINEAGE_ICON_CENTAUR,
  unknown: LINEAGE_ICON_RAREMON,
});

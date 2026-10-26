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
const TIGER_DYE_MASK = "images/monsters/tiger-dye-mask.PNG?v=ac56746b5791";
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
const IDLE_OBORO_FLOWER_T_MASK = "images/monsters/idle/oboro-flower-t.png?v=56abad0ca1cc";
const IDLE_OBORO_FLOWER_L_MASK = "images/monsters/idle/oboro-flower-l.png?v=1eeac7b05dbd";
const IDLE_OBORO_FLOWER_R_MASK = "images/monsters/idle/oboro-flower-r.png?v=fb48a6c02d4c";
const IDLE_OBORO_BODY_MASK = "images/monsters/idle/oboro-body.png?v=b223480121b7";
const IDLE_PLANT_FLOWER_T_MASK = "images/monsters/idle/plant-flower-t.png?v=6ad1fcb8b2cc";
const IDLE_PLANT_FLOWER_L_MASK = "images/monsters/idle/plant-flower-l.png?v=96ab23f2bc4e";
const IDLE_PLANT_FLOWER_R_MASK = "images/monsters/idle/plant-flower-r.png?v=4e6daa14b567";
const IDLE_PLANT_BODY_MASK = "images/monsters/idle/plant-body.png?v=0add8bfa9a7b";
const IDLE_ZAN_BLADE_L_MASK = "images/monsters/idle/zan-blade-l.png?v=d988979ee3f3";
const IDLE_ZAN_BLADE_R_MASK = "images/monsters/idle/zan-blade-r.png?v=211c111c42d3";
const IDLE_ZAN_BODY_MASK = "images/monsters/idle/zan-body.png?v=1975513b862d";
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
const PANDORA_DYE_MASK = "images/monsters/pandora-dye-mask.PNG?v=3bacac1187f6";
// パンドラの箱(タクティクスEX)の間だけ出す、悪魔・天使の姿。起動時には読まない(箱を使うときに先読みする)
const PANDORA_DEVIL_IMG = "images/monsters/pandora-devil.PNG?v=5ce010729f00";
const PANDORA_ANGEL_IMG = "images/monsters/pandora-angel.PNG?v=d3dedf0b3d90";
const SUEZO_IMG = "images/monsters/suezo.png?v=979846ef01a1";
const SUEZO_DYE_MASK = "images/monsters/suezo-dye-mask.PNG?v=ce9b0ee85836";
const GOLEM_IMG = "images/monsters/golem.png?v=8106dff84f6b";
const MONOL_IMG = "images/monsters/monol.png?v=64e141b7fbb1";
const OBORO_IMG = "images/monsters/oboro.png?v=b9f9b77e528d";
const PLANT_IMG = "images/monsters/plant.PNG?v=398cacbadab3";
const PLANT_DYE_MASK = "images/monsters/plant-dye-mask.PNG?v=cad1fda53cf2";
const ZAN_IMG = "images/monsters/zan.png?v=0f19757037c8";
const MITARASHI_IMG = "images/monsters/mitarashi.png?v=b9c0850e77ce";
const ARK_IMG = "images/monsters/ark.png?v=a9dce68b24d4";
const IBLIS_IMG = "images/monsters/iblis.png?v=c3ce989b339d";
const SNEGUROCHKA_IMG = "images/monsters/snegurochka.png?v=9843be5ed231";
// 2026年8月に追加した人魚2体。いただいた立ち絵をそのまま使い、丸いアイコンでの見え方は
// 画像を作り直さず MARKET_PROFILE_ICON_STYLES の scale/x/y で寄せている
const UNDINE_IMG = "images/monsters/undine.PNG?v=bf5593ae061a";
const UNDINE_DYE_MASK = "images/monsters/undine-dye-mask.PNG?v=6c4f4f4c6f53";
const YAOBIKUNI_IMG = "images/monsters/yaobikuni.PNG?v=e23821f9d695";
const YAOBIKUNI_DYE_MASK = "images/monsters/yaobikuni-dye-mask2.PNG?v=c4c739ed5b60";
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
const ILLUMINE_DYE_MASK = "images/monsters/illumine-dye-mask.PNG?v=ecdc51013525";
const DREAMY_DYE_MASK = "images/monsters/dreamy-dye-mask.PNG?v=c6419eaba43c";
const DREAMY_IMG = "images/monsters/dreamy.png?v=14e1f738cec9";
// 新しい16種(2026-10-24・まだ味方には入れていない)。ファイル名はカードの種族名(data/card-battle-cards.js の species)。
// 元絵は tools/art-sources/new-monsters-2026-10-24/。透明な余白を切って高さ916pxへ縮め、256色へ減色。
// ケンタウロスは背景に散ったごく薄い光の画素(不透明度64未満)を消してから取り込んだ
// キュービ・オリヒメ(2026-10-27・案の段階)。元絵は tools/art-sources/kyubi-orihime-2026-10-27/。高さ916px・256色(sharp)
const KYUBI_IMG = "images/monsters/kyubi.png?v=f3711a72a817";
const KYUBI_DYE_MASK = "images/monsters/kyubi-dye-mask.PNG?v=fc6210422555";
const ORIHIME_DYE_MASK = "images/monsters/orihime-dye-mask.PNG?v=5868e56697c0";
const ORIHIME_IMG = "images/monsters/orihime.png?v=86ff26c44dcb";
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
const HYBRID_C056_IMG = "images/monsters/c056.png?v=56ec6e0a965c";
const HYBRID_C057_IMG = "images/monsters/c057.png?v=7ab1f75096ae";
const HYBRID_C058_IMG = "images/monsters/c058.png?v=596afc1e78b0";
const HYBRID_C059_IMG = "images/monsters/c059.png?v=1964b2187f85";
const HYBRID_C060_IMG = "images/monsters/c060.png?v=6c8364b880c5";
const HYBRID_C061_IMG = "images/monsters/c061.png?v=4e015080a484";
const HYBRID_C062_IMG = "images/monsters/c062.png?v=090cdd583324";
const HYBRID_C063_IMG = "images/monsters/c063.png?v=97693bd14c3a";
const HYBRID_C064_IMG = "images/monsters/c064.png?v=7e039c580e69";
const HYBRID_C065_IMG = "images/monsters/c065.png?v=651de4a99a0b";
// 派生モンスター20体(2026-10-25 社長から。C-010〜C-019 の一部。名前は本編の図鑑の名前)
const HYBRID_C010_IMG = "images/monsters/c010.png?v=e53142331a97";
const HYBRID_C012_IMG = "images/monsters/c012.png?v=38661b85c0b6";
const HYBRID_C013_IMG = "images/monsters/c013.png?v=fca923cd46e8";
const HYBRID_C015_IMG = "images/monsters/c015.png?v=8a8916e3668f";
const HYBRID_C016_IMG = "images/monsters/c016.png?v=197d7b651aea";
const HYBRID_C017_IMG = "images/monsters/c017.png?v=13408279524c";
const HYBRID_C018_IMG = "images/monsters/c018.png?v=47a9f8c64bb3";
const HYBRID_C019_IMG = "images/monsters/c019.png?v=2ca0d628318e";
const HYBRID_C033_IMG = "images/monsters/c033.png?v=6640e061ae35";
const HYBRID_C034_IMG = "images/monsters/c034.png?v=994f5cc54350";
const HYBRID_C035_IMG = "images/monsters/c035.png?v=eb9c14059560";
const HYBRID_C036_IMG = "images/monsters/c036.png?v=d592da5899f7";
const HYBRID_C038_IMG = "images/monsters/c038.png?v=8819b3a3dcdd";
const HYBRID_C039_IMG = "images/monsters/c039.png?v=9dfd1759dd1a";
const HYBRID_C040_IMG = "images/monsters/c040.png?v=143432d34282";
const HYBRID_C041_IMG = "images/monsters/c041.png?v=1ca881589d31";
const HYBRID_C042_IMG = "images/monsters/c042.png?v=e5a483c55e02";
const HYBRID_C020_IMG = "images/monsters/c020.png?v=81b9fd3f3ec0";
const HYBRID_C043_IMG = "images/monsters/c043.png?v=71b585e27dc5";
const HYBRID_C045_IMG = "images/monsters/c045.png?v=86b2b98d136d";
// 2026-10-26 社長から届いた5体(案の子・図鑑の「未実装」に並ぶ)。元絵は tools/art-sources/<名前>-2026-10-26/。
// MFバトルカードの画面にはまだつながない(社長に聞いてから HYBRID_MONSTER_IMGS へ足す)
const HYBRID_C011_IMG = "images/monsters/c011.png?v=44e731f843ea";
const HYBRID_C032_IMG = "images/monsters/c032.png?v=5b63d78632ff";
const HYBRID_C014_IMG = "images/monsters/c014.png?v=dde0b6c82d78";
const HYBRID_C037_IMG = "images/monsters/c037.png?v=8479c3319aac";
const HYBRID_C044_IMG = "images/monsters/c044.png?v=997468609578";
const HYBRID_MONSTER_IMGS = Object.freeze({
  'C-010': HYBRID_C010_IMG,
  'C-012': HYBRID_C012_IMG,
  'C-013': HYBRID_C013_IMG,
  'C-015': HYBRID_C015_IMG,
  'C-016': HYBRID_C016_IMG,
  'C-017': HYBRID_C017_IMG,
  'C-018': HYBRID_C018_IMG,
  'C-019': HYBRID_C019_IMG,
  'C-033': HYBRID_C033_IMG,
  'C-034': HYBRID_C034_IMG,
  'C-035': HYBRID_C035_IMG,
  'C-036': HYBRID_C036_IMG,
  'C-038': HYBRID_C038_IMG,
  'C-039': HYBRID_C039_IMG,
  'C-040': HYBRID_C040_IMG,
  'C-041': HYBRID_C041_IMG,
  'C-042': HYBRID_C042_IMG,
  'C-020': HYBRID_C020_IMG,
  'C-043': HYBRID_C043_IMG,
  'C-045': HYBRID_C045_IMG,
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
  'C-064': HYBRID_C064_IMG,
  'C-065': HYBRID_C065_IMG,
  // 剣士モッチー(2026-10-26 パックに追加)。立ち絵はゲームのモンスターのもの(KENSHI_MOCCHI_IMG)。キラ・別絵キラも同じ
  'C-066': KENSHI_MOCCHI_IMG, 'C-066S': KENSHI_MOCCHI_IMG, 'C-066V': KENSHI_MOCCHI_IMG,
  // パンドラ(2026-10-26 パックに追加)。立ち絵はゲームのモンスターのもの(PANDORA_IMG)。キラ・別絵キラも同じ
  'C-067': PANDORA_IMG, 'C-067S': PANDORA_IMG, 'C-067V': PANDORA_IMG,
});

const MOCCHI_ICON = MOCCHI_IMG;
const HAM_ICON = HAM_IMG;
const TIGER_ICON = TIGER_IMG;
const PIXIE_ICON = PIXIE_IMG;
const MIA_ICON = MIA_IMG;
const PANDORA_ICON = PANDORA_IMG;
const SUEZO_ICON = SUEZO_IMG;
const GOLEM_ICON = GOLEM_IMG;
const MONOL_ICON = "images/monster-icons/monol.png?v=849c58f7025b";
const OBORO_ICON = "images/monster-icons/oboro.png?v=3a736ad4ffae";
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
const TIGER_FACE_ICON = "images/monster-icons/face/tiger.png?v=1557ff181186";
const PIXIE_FACE_ICON = "images/monster-icons/face/pixie.png?v=d33b92e39fa0";
const MIA_FACE_ICON = "images/monster-icons/face/mia.png?v=35b65c9e07c6";
const PANDORA_FACE_ICON = "images/monster-icons/face/pandora.png?v=2f1277f1d3bb";
const SUEZO_FACE_ICON = "images/monster-icons/face/suezo.png?v=696938ca7d63";
const GOLEM_FACE_ICON = "images/monster-icons/face/golem.png?v=8ef71840d1d5";
const MONOL_FACE_ICON = MONOL_ICON;
const OBORO_FACE_ICON = OBORO_ICON;
const PLANT_FACE_ICON = "images/monster-icons/face/plant.png?v=b79e75dedc41";
const YGGDRASIL_ICON = YGGDRASIL_IMG;
const MEL_WHIP_ICON = MEL_WHIP_IMG;
const GHOST_ICON = GHOST_IMG;
const SPOOKY_ICON = SPOOKY_IMG;
const MELODY_ICON = MELODY_IMG;
const KUROMY_ICON = KUROMY_IMG;
const ILLUMINE_ICON = ILLUMINE_IMG;
const DREAMY_ICON = DREAMY_IMG;
const ZAN_FACE_ICON = "images/monster-icons/face/zan.png?v=b4a2ad9cdd58";
const MITARASHI_FACE_ICON = "images/monster-icons/face/mitarashi.png?v=36f1cf509e8e";
const ARK_FACE_ICON = "images/monster-icons/face/ark.png?v=b5e3a96b27c0";
const IBLIS_FACE_ICON = "images/monster-icons/face/iblis.png?v=bdd570ce943a";
const SNEGUROCHKA_FACE_ICON = "images/monster-icons/face/snegurochka.png?v=31dc864654c1";
// 顔クロップ画像は作らず、立ち絵をそのまま使う(表示側で寄せる方針)
const UNDINE_FACE_ICON = "images/monster-icons/face/undine.png?v=fe1ba930173b";
const YAOBIKUNI_FACE_ICON = "images/monster-icons/face/yaobikuni.png?v=32838d8bdd5a";
// 立ち絵から切り出した顔クロップ(tools/image/make-face-icons.js)
const EIKI_FACE_ICON = "images/monster-icons/face/eiki.png?v=9605be0feb75";
const KENSHI_MOCCHI_FACE_ICON = "images/monster-icons/face/kenshi-mocchi.png?v=fed887e4c278";
const YGGDRASIL_FACE_ICON = "images/monster-icons/face/yggdrasil.png?v=32b08d1fc0cd";
const MEL_WHIP_FACE_ICON = "images/monster-icons/face/mel-whip.png?v=a4f626c0fde8";
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
// 混血モンスター(2026-10-24)。社長が A〜D から選んだ案。範囲は tools/image/make-face-icons.js の FACE_BOXES
const HYBRID_C051_FACE_ICON = "images/monster-icons/face/c051.png?v=4853c5670318";
const HYBRID_C052_FACE_ICON = "images/monster-icons/face/c052.png?v=6b18c1fd8234";
const HYBRID_C053_FACE_ICON = "images/monster-icons/face/c053.png?v=b662c2469e1b";
const HYBRID_C054_FACE_ICON = "images/monster-icons/face/c054.png?v=3963d6c624b6";
const HYBRID_C056_FACE_ICON = "images/monster-icons/face/c056.png?v=ed4aac02295a";
const HYBRID_C057_FACE_ICON = "images/monster-icons/face/c057.png?v=13230681ef1d";
const HYBRID_C058_FACE_ICON = "images/monster-icons/face/c058.png?v=3bfcaaa0ceaf";
const HYBRID_C059_FACE_ICON = "images/monster-icons/face/c059.png?v=106d33ba40e0";
const HYBRID_C060_FACE_ICON = "images/monster-icons/face/c060.png?v=6068ebe63111";
const HYBRID_C061_FACE_ICON = "images/monster-icons/face/c061.png?v=920ea9e836ad";
const HYBRID_C062_FACE_ICON = "images/monster-icons/face/c062.png?v=07f17eb1dfee";
const HYBRID_C055_FACE_ICON = "images/monster-icons/face/c055.png?v=a71918e0b84b";
const HYBRID_C063_FACE_ICON = "images/monster-icons/face/c063.png?v=c15a3b0c53cf";
const HYBRID_C064_FACE_ICON = "images/monster-icons/face/c064.png?v=59768761cc69";
const HYBRID_C065_FACE_ICON = "images/monster-icons/face/c065.png?v=c0a6301e2c2a";
// 派生モンスター8体(2026-10-25)。社長が A〜D から選んだ案(位置の直しつき)
const HYBRID_C010_FACE_ICON = "images/monster-icons/face/c010.png?v=42dbe96e69c5";
const HYBRID_C012_FACE_ICON = "images/monster-icons/face/c012.png?v=5722ee95967f";
const HYBRID_C013_FACE_ICON = "images/monster-icons/face/c013.png?v=02afe2e9ef57";
const HYBRID_C015_FACE_ICON = "images/monster-icons/face/c015.png?v=0eddb061d2fd";
const HYBRID_C016_FACE_ICON = "images/monster-icons/face/c016.png?v=c58049c89c0a";
const HYBRID_C017_FACE_ICON = "images/monster-icons/face/c017.png?v=d1de20f8a221";
const HYBRID_C018_FACE_ICON = "images/monster-icons/face/c018.png?v=12c34f21808e";
const HYBRID_C019_FACE_ICON = "images/monster-icons/face/c019.png?v=acd3ad2ca397";
const HYBRID_C033_FACE_ICON = "images/monster-icons/face/c033.png?v=20db388e2920";
const HYBRID_C034_FACE_ICON = "images/monster-icons/face/c034.png?v=ec1be7dcb7a6";
const HYBRID_C035_FACE_ICON = "images/monster-icons/face/c035.png?v=895f6b37c7db";
const HYBRID_C036_FACE_ICON = "images/monster-icons/face/c036.png?v=cb3c4f4a19a6";
const HYBRID_C038_FACE_ICON = "images/monster-icons/face/c038.png?v=4eaeb9ce0c27";
const HYBRID_C039_FACE_ICON = "images/monster-icons/face/c039.png?v=673f2f41e714";
const HYBRID_C040_FACE_ICON = "images/monster-icons/face/c040.png?v=c09a8d93ef8e";
const HYBRID_C041_FACE_ICON = "images/monster-icons/face/c041.png?v=e5b9e37dddf1";
const HYBRID_C042_FACE_ICON = "images/monster-icons/face/c042.png?v=9331e5dd8316";
const HYBRID_C020_FACE_ICON = "images/monster-icons/face/c020.png?v=12bdba21a409";
const HYBRID_C043_FACE_ICON = "images/monster-icons/face/c043.png?v=656a46dd72a0";
const HYBRID_C045_FACE_ICON = "images/monster-icons/face/c045.png?v=cbe99cc190ae";
// 2026-10-26 社長が選んだ顔アイコン(案の子・カードの画面の HYBRID_MONSTER_FACE_ICONS へはまだ入れない)
const HYBRID_C044_FACE_ICON = "images/monster-icons/face/c044.png?v=8c4395c28bd3";
const HYBRID_C011_FACE_ICON = "images/monster-icons/face/c011.png?v=b3722ab1b74e";
const HYBRID_C037_FACE_ICON = "images/monster-icons/face/c037.png?v=9fcfee53438b";
const HYBRID_C014_FACE_ICON = "images/monster-icons/face/c014.png?v=4ee1ce8f7085";
const HYBRID_C032_FACE_ICON = "images/monster-icons/face/c032.png?v=ca64158c5e7b";
const KYUBI_FACE_ICON = "images/monster-icons/face/kyubi.png?v=6648b970a72f";
const ORIHIME_FACE_ICON = "images/monster-icons/face/orihime.png?v=887beb2d000f";
// カードの対戦画面などが番号から引く顔アイコンの表(立ち絵の HYBRID_MONSTER_IMGS と同じ番号)
const HYBRID_MONSTER_FACE_ICONS = Object.freeze({
  'C-010': HYBRID_C010_FACE_ICON,
  'C-012': HYBRID_C012_FACE_ICON,
  'C-013': HYBRID_C013_FACE_ICON,
  'C-015': HYBRID_C015_FACE_ICON,
  'C-016': HYBRID_C016_FACE_ICON,
  'C-017': HYBRID_C017_FACE_ICON,
  'C-018': HYBRID_C018_FACE_ICON,
  'C-019': HYBRID_C019_FACE_ICON,
  'C-033': HYBRID_C033_FACE_ICON,
  'C-034': HYBRID_C034_FACE_ICON,
  'C-035': HYBRID_C035_FACE_ICON,
  'C-036': HYBRID_C036_FACE_ICON,
  'C-038': HYBRID_C038_FACE_ICON,
  'C-039': HYBRID_C039_FACE_ICON,
  'C-040': HYBRID_C040_FACE_ICON,
  'C-041': HYBRID_C041_FACE_ICON,
  'C-042': HYBRID_C042_FACE_ICON,
  'C-020': HYBRID_C020_FACE_ICON,
  'C-043': HYBRID_C043_FACE_ICON,
  'C-045': HYBRID_C045_FACE_ICON,
  'C-051': HYBRID_C051_FACE_ICON,
  'C-052': HYBRID_C052_FACE_ICON,
  'C-053': HYBRID_C053_FACE_ICON,
  'C-054': HYBRID_C054_FACE_ICON,
  'C-055': HYBRID_C055_FACE_ICON,
  'C-056': HYBRID_C056_FACE_ICON,
  'C-057': HYBRID_C057_FACE_ICON,
  'C-058': HYBRID_C058_FACE_ICON,
  'C-059': HYBRID_C059_FACE_ICON,
  'C-060': HYBRID_C060_FACE_ICON,
  'C-061': HYBRID_C061_FACE_ICON,
  'C-062': HYBRID_C062_FACE_ICON,
  'C-063': HYBRID_C063_FACE_ICON,
  'C-064': HYBRID_C064_FACE_ICON,
  'C-065': HYBRID_C065_FACE_ICON,
  // 剣士モッチー(2026-10-26 パックに追加)。立ち絵・顔はゲームのモンスターのものを使う。キラ・別絵キラも同じ
  'C-066': KENSHI_MOCCHI_FACE_ICON, 'C-066S': KENSHI_MOCCHI_FACE_ICON, 'C-066V': KENSHI_MOCCHI_FACE_ICON,
  // パンドラ(2026-10-26 パックに追加)。顔はゲームと同じ(PANDORA_FACE_ICON)。キラ・別絵キラも同じ
  'C-067': PANDORA_FACE_ICON, 'C-067S': PANDORA_FACE_ICON, 'C-067V': PANDORA_FACE_ICON,
});

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
  kyubi: LINEAGE_ICON_KYUBI,
  unknown: LINEAGE_ICON_RAREMON,
});

// 顔アイコンが全身絵そのものの子(顔アイコンを作っていない)。モノリスは顔のない板、オボロゲソウ・プラントは顔が体の下にあるので、全身のほうが分かりやすい。
// ライガー・ミーア・パンドラは顔アイコンの案を社長が選ぶまでのあいだ。ここに無い子の顔アイコンが全身絵だと、tools/image/art-anchor-check.js が止める
const ART_FACE_FULL_BODY = Object.freeze(['MONOL', 'OBORO']);
// 顔のまんなか(2026-10-26 社長「顔アイコンと全身絵のずれが出ない仕組み」)。全身絵(◯◯_IMG)の中で、顔アイコンの丸のまんなかに来る点(0〜1)。
// 顔(目のあいだ・鼻)のまんなかを書く。顔アイコンは tools/image/make-face-icons.js がこの点を丸のまんなかに置いて作る。
// 新しい子を足したら、ここにも書く(tools/image/art-anchor-check.js が、書いていない子を止める)。書き出しは tools/image/art-anchors.js
const ART_ANCHORS = Object.freeze({
  MOCCHI: Object.freeze({ face: Object.freeze([0.5, 0.246]) }),
  SUEZO: Object.freeze({ face: Object.freeze([0.5, 0.465]) }),
  PIXIE: Object.freeze({ face: Object.freeze([0.494, 0.232]) }),
  GOLEM: Object.freeze({ face: Object.freeze([0.492, 0.155]) }),
  MITARASHI: Object.freeze({ face: Object.freeze([0.493, 0.259]) }),
  IBLIS: Object.freeze({ face: Object.freeze([0.476, 0.32]), zoom: 1.15 }),
  ZAN: Object.freeze({ face: Object.freeze([0.5, 0.229]) }),
  ARK: Object.freeze({ face: Object.freeze([0.5, 0.393]) }),
  HAM: Object.freeze({ face: Object.freeze([0.51, 0.356]) }),
  SNEGUROCHKA: Object.freeze({ face: Object.freeze([0.461, 0.24]), zoom: 1.185 }),
  EIKI: Object.freeze({ face: Object.freeze([0.5, 0.119]) }),
  KENSHI_MOCCHI: Object.freeze({ face: Object.freeze([0.5, 0.272]) }),
  UNDINE: Object.freeze({ face: Object.freeze([0.472, 0.148]) }),
  YAOBIKUNI: Object.freeze({ face: Object.freeze([0.482, 0.145]) }),
  YGGDRASIL: Object.freeze({ face: Object.freeze([0.505, 0.324]), zoom: 1.218 }),
  TIGER: Object.freeze({ face: Object.freeze([0.49, 0.304]) }),
  MIA: Object.freeze({ face: Object.freeze([0.497, 0.214]) }),
  PANDORA: Object.freeze({ face: Object.freeze([0.482, 0.208]) }),
  PLANT: Object.freeze({ face: Object.freeze([0.5, 0.522]), zoom: 1.302 }),
  MEL_WHIP: Object.freeze({ face: Object.freeze([0.549, 0.333]), zoom: 1.341 }),
  GHOST: Object.freeze({ face: Object.freeze([0.5, 0.387]) }),
  SPOOKY: Object.freeze({ face: Object.freeze([0.5, 0.337]) }),
  MELODY: Object.freeze({ face: Object.freeze([0.51, 0.312]) }),
  KUROMY: Object.freeze({ face: Object.freeze([0.57, 0.378]) }),
  ILLUMINE: Object.freeze({ face: Object.freeze([0.49, 0.238]) }),
  DREAMY: Object.freeze({ face: Object.freeze([0.45, 0.147]) }),
  MF_DINO: Object.freeze({ face: Object.freeze([0.347, 0.168]) }),
  MF_NAGA: Object.freeze({ face: Object.freeze([0.5, 0.166]) }),
  MF_HENGER: Object.freeze({ face: Object.freeze([0.5, 0.5]) }),
  MF_ARROWHEAD: Object.freeze({ face: Object.freeze([0.499, 0.637]) }),
  MF_ZILLA: Object.freeze({ face: Object.freeze([0.421, 0.241]) }),
  MF_JOKER: Object.freeze({ face: Object.freeze([0.52, 0.246]) }),
  MF_JELL: Object.freeze({ face: Object.freeze([0.494, 0.133]) }),
  MF_MEW: Object.freeze({ face: Object.freeze([0.426, 0.368]) }),
  MF_METALNER: Object.freeze({ face: Object.freeze([0.511, 0.199]) }),
  MF_CENTAUR: Object.freeze({ face: Object.freeze([0.553, 0.279]) }),
  MF_COLORPANDORA: Object.freeze({ face: Object.freeze([0.5, 0.314]) }),
  MF_GALI: Object.freeze({ face: Object.freeze([0.485, 0.169]) }),
  MF_DRAGON: Object.freeze({ face: Object.freeze([0.496, 0.13]) }),
  MF_DURAHAN: Object.freeze({ face: Object.freeze([0.434, 0.239]) }),
  MF_PHOENIX: Object.freeze({ face: Object.freeze([0.494, 0.377]) }),
  MF_WORM: Object.freeze({ face: Object.freeze([0.5, 0.683]) }),
  HYBRID_C051: Object.freeze({ face: Object.freeze([0.4, 0.277]) }),
  HYBRID_C052: Object.freeze({ face: Object.freeze([0.5, 0.184]) }),
  HYBRID_C053: Object.freeze({ face: Object.freeze([0.485, 0.36]) }),
  HYBRID_C054: Object.freeze({ face: Object.freeze([0.5, 0.159]) }),
  HYBRID_C056: Object.freeze({ face: Object.freeze([0.497, 0.205]) }),
  HYBRID_C057: Object.freeze({ face: Object.freeze([0.509, 0.135]) }),
  HYBRID_C058: Object.freeze({ face: Object.freeze([0.5, 0.5]) }),
  HYBRID_C059: Object.freeze({ face: Object.freeze([0.5, 0.525]) }),
  HYBRID_C060: Object.freeze({ face: Object.freeze([0.515, 0.435]) }),
  HYBRID_C061: Object.freeze({ face: Object.freeze([0.5, 0.475]) }),
  HYBRID_C062: Object.freeze({ face: Object.freeze([0.5, 0.649]) }),
  HYBRID_C055: Object.freeze({ face: Object.freeze([0.5, 0.387]) }),
  HYBRID_C063: Object.freeze({ face: Object.freeze([0.521, 0.26]) }),
  HYBRID_C064: Object.freeze({ face: Object.freeze([0.44, 0.184]) }),
  HYBRID_C065: Object.freeze({ face: Object.freeze([0.485, 0.235]) }),
  HYBRID_C010: Object.freeze({ face: Object.freeze([0.356, 0.25]) }),
  HYBRID_C012: Object.freeze({ face: Object.freeze([0.5, 0.425]) }),
  HYBRID_C013: Object.freeze({ face: Object.freeze([0.5, 0.15]) }),
  HYBRID_C015: Object.freeze({ face: Object.freeze([0.5, 0.328]) }),
  HYBRID_C016: Object.freeze({ face: Object.freeze([0.487, 0.185]) }),
  HYBRID_C017: Object.freeze({ face: Object.freeze([0.49, 0.2]) }),
  HYBRID_C018: Object.freeze({ face: Object.freeze([0.5, 0.45]) }),
  HYBRID_C019: Object.freeze({ face: Object.freeze([0.5, 0.19]) }),
  HYBRID_C033: Object.freeze({ face: Object.freeze([0.5, 0.185]) }),
  HYBRID_C034: Object.freeze({ face: Object.freeze([0.35, 0.2]) }),
  HYBRID_C035: Object.freeze({ face: Object.freeze([0.505, 0.275]) }),
  HYBRID_C036: Object.freeze({ face: Object.freeze([0.5, 0.2]) }),
  HYBRID_C038: Object.freeze({ face: Object.freeze([0.5, 0.5]) }),
  HYBRID_C039: Object.freeze({ face: Object.freeze([0.381, 0.3]) }),
  HYBRID_C040: Object.freeze({ face: Object.freeze([0.5, 0.45]) }),
  HYBRID_C041: Object.freeze({ face: Object.freeze([0.5, 0.625]) }),
  HYBRID_C042: Object.freeze({ face: Object.freeze([0.5, 0.18]) }),
  HYBRID_C020: Object.freeze({ face: Object.freeze([0.5, 0.25]) }),
  HYBRID_C043: Object.freeze({ face: Object.freeze([0.41, 0.165]) }),
  HYBRID_C045: Object.freeze({ face: Object.freeze([0.5, 0.15]) }),
  HYBRID_C044: Object.freeze({ face: Object.freeze([0.335, 0.21]) }),
  HYBRID_C032: Object.freeze({ face: Object.freeze([0.5, 0.11]) }),
  HYBRID_C037: Object.freeze({ face: Object.freeze([0.5, 0.5]) }),
  HYBRID_C014: Object.freeze({ face: Object.freeze([0.359, 0.21]) }),
  HYBRID_C011: Object.freeze({ face: Object.freeze([0.503, 0.11]) }),
});
// <monster-thumbs>
// 小さい枠(64px 以下)で使うモンスターの小さい版。tools/image/make-monster-thumbs.js が作る(手で書かない)
const MONSTER_THUMBS = {
  "Ark": "images/monster-thumbs/ark.png?v=7c0bea019d24",
  "Dreamy": "images/monster-thumbs/dreamy.png?v=52dd72eedb84",
  "Eiki": "images/monster-thumbs/eiki.png?v=16fc18f0557a",
  "Ghost": "images/monster-thumbs/ghost.png?v=2f425d0bdb0c",
  "Golem": "images/monster-thumbs/golem.png?v=0f4c785f6be0",
  "Ham": "images/monster-thumbs/ham.png?v=ebd15987815c",
  "Iblis": "images/monster-thumbs/iblis.png?v=03f0805f8042",
  "Illumine": "images/monster-thumbs/illumine.png?v=34fc3f9c816a",
  "KenshiMocchi": "images/monster-thumbs/kenshimocchi.png?v=7bbc8093cc81",
  "Kuromy": "images/monster-thumbs/kuromy.png?v=535ef98e1c61",
  "Melody": "images/monster-thumbs/melody.png?v=05b88d6a561e",
  "MelWhip": "images/monster-thumbs/melwhip.png?v=539bb81b4667",
  "Mia": "images/monster-thumbs/mia.png?v=43ee24870aa3",
  "Mitarashi": "images/monster-thumbs/mitarashi.png?v=46c8880e15ea",
  "Mocchi": "images/monster-thumbs/mocchi.png?v=eaf570b00efc",
  "Monol": "images/monster-thumbs/monol.png?v=0d4176ea4f28",
  "Oboro": "images/monster-thumbs/oboro.png?v=7afb7f26ae0a",
  "Pandora": "images/monster-thumbs/pandora.png?v=ec9af7e742ec",
  "Pixie": "images/monster-thumbs/pixie.png?v=34c3db90a5e0",
  "Plant": "images/monster-thumbs/plant.png?v=03fa6abc2b43",
  "Snegurochka": "images/monster-thumbs/snegurochka.png?v=153ac32620dd",
  "Spooky": "images/monster-thumbs/spooky.png?v=e6e5ff907240",
  "Suezo": "images/monster-thumbs/suezo.png?v=9886bc06c718",
  "Tiger": "images/monster-thumbs/tiger.png?v=695831514b53",
  "Undine": "images/monster-thumbs/undine.png?v=f78c64c06d9f",
  "Yaobikuni": "images/monster-thumbs/yaobikuni.png?v=888eb3250dfd",
  "Yggdrasil": "images/monster-thumbs/yggdrasil.png?v=b92e61bd9054",
  "Zan": "images/monster-thumbs/zan.png?v=2cfc30f16541",
};
// </monster-thumbs>

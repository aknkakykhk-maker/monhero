const ENEMY_DATA = {
  Dino:         { name:"ディノ",         emoji:"🦖", imgUrl:DINO_IMG, baseHp:400,   baseAtk:60,  normal:"しっぽビンタ",  special:"ひざげり" },
  Gel:          { name:"ゲル",           emoji:"💧", imgUrl:GEL_IMG, baseHp:550,   baseAtk:70,  normal:"ムチ",          special:"パラポラビーム" },
  BlackDino:    { name:"ブラックディノ", emoji:"🖤", imgUrl:BLACKDINO_IMG, baseHp:1300,  baseAtk:110, normal:"かみつき投げ",  special:"炎の体当たり" },
  Jaakusou:     { name:"ジャアクソウ",   emoji:"🥀", imgUrl:JAAKUSOU_IMG, baseHp:1600,  baseAtk:140, normal:"ミツ",          special:"蒼花爆散" },
  BlueMountain: { name:"ブルーマウンテン",emoji:"🏔️",imgUrl:BLUEMOUNTAIN_IMG, baseHp:3800,  baseAtk:180, normal:"パンチ",        special:"竜巻アタック" },
  Gali:         { name:"ガリ",           emoji:"🎭", imgUrl:GALI_IMG, baseHp:4200,  baseAtk:220, normal:"ストレート",    special:"ゴッドファイナル" },
  Naga:         { name:"ナーガ",         emoji:"🐍", imgUrl:NAGA_IMG, baseHp:5800,  baseAtk:260, normal:"魔眼光",        special:"デスリーパー" },
  Lilim:        { name:"リリム",         emoji:"😈", imgUrl:LILIM_IMG, baseHp:7500,  baseAtk:310, normal:"サンダー",      special:"ビッグバン" },
  Durahan:      { name:"デュラハン",     emoji:"🏇", imgUrl:DURAHAN_IMG, baseHp:9500,  baseAtk:360, normal:"居合斬り",      special:"冥王剣" },
  Moo:          { name:"ムー",           emoji:"🐲", imgUrl:MOO_IMG_DATA, baseHp:35000, baseAtk:700, normal:"スカイシャドウ", special:"ルインクロス" }
};

const ENEMY_SEQUENCE = ['Dino','Gel','BlackDino','Jaakusou','BlueMountain','Gali','Naga','Lilim','Durahan','Moo'];

// ==================== タクティクスバトル専用の敵 ====================
// ★クラシック・クイックの並び(ENEMY_SEQUENCE)は1つも変えない。
//   あちらを差し替えると、いま遊んでいる人のチャレンジ・プロの手ごたえが同時に変わるため。
//
// 【強さの決め方】(2026-09-21)
// WAVE1→10 の上がり方の総量は既存とそろえてある(合計ライフ 68,580 / 合計こうげき 2,497。
// 既存は 69,650 / 2,410)。難易度の倍率はこの上に乗るので、総量を崩すと極限だけ極端に重くなる。
// そのうえで、敵ごとに「硬い／一撃が重い」の性格を付けた。タクティクスはライフを1体ずつ持つので、
// 攻撃の高い敵は「誰を守るか」、ライフの高い敵は「どう削り切るか」の判断になる。
const TACTICS_ENEMY_DATA = {
  Kawazumo:     { name:"カワズモー",       emoji:"🐸", imgUrl:KAWAZUMO_IMG,     baseHp:480,   baseAtk:52,  normal:"はりて",        special:"つっぱり" },
  Metalner:     { name:"メタルナー",       emoji:"🤖", imgUrl:METALNER_IMG,     baseHp:550,   baseAtk:70,  normal:"はなムチ",      special:"メタルブロー" },
  Inari:        { name:"イナリ",           emoji:"🦊", imgUrl:INARI_IMG,        baseHp:1050,  baseAtk:130, normal:"ひっかき",      special:"きつね火" },
  Koinobori:    { name:"コイノボリ",       emoji:"🎏", imgUrl:KOINOBORI_IMG,    baseHp:2000,  baseAtk:120, normal:"たいあたり",    special:"ふきながし" },
  Delpiero:     { name:"デルピエロ",       emoji:"💀", imgUrl:DELPIERO_IMG,     baseHp:3200,  baseAtk:215, normal:"かまなぎ",      special:"デスサイズ" },
  Dokudoku:     { name:"ドクドク",         emoji:"🟣", imgUrl:DOKUDOKU_IMG,     baseHp:4600,  baseAtk:200, normal:"どくづき",      special:"ポイズンハート" },
  Lamia:        { name:"ラミア",           emoji:"🐍", imgUrl:LAMIA_IMG,        baseHp:5000,  baseAtk:300, normal:"ひれうち",      special:"まどわしの歌" },
  Nyarlathotep: { name:"ニャルラトホテプ", emoji:"🦑", imgUrl:NYARLATHOTEP_IMG, baseHp:8500,  baseAtk:290, normal:"しょくしゅ",    special:"混沌の爪" },
  Splatter:     { name:"スプラッター",     emoji:"🪓", imgUrl:SPLATTER_IMG,     baseHp:8200,  baseAtk:420, normal:"おのふり",      special:"断罪の一撃" },
  AwakenedMoo:  { name:"覚醒ムー",         emoji:"🐉", imgUrl:AWAKENED_MOO_IMG, baseHp:35000, baseAtk:700, normal:"ゴッドクロー",  special:"覚醒ルイン" }
};

const TACTICS_ENEMY_SEQUENCE = ['Kawazumo','Metalner','Inari','Koinobori','Delpiero','Dokudoku','Lamia','Nyarlathotep','Splatter','AwakenedMoo'];

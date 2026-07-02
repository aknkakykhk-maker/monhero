const HERO_ATK_NAMES = {
  Mocchi: ["もんた","もちき","ガッチョ","もっちゃん","ガッチャー","桜吹雪","もっさん","枝垂れ桜","もっさま"],
  Golem:  ["でこぴん","パンチ","キック","チョップ","ハエタタキ","大でこぴん","大パンチ","大キック","大ハエタタキ"],
  Ham:    ["ワンツー","飛び蹴り","バックナックル","正拳","後ろ蹴り","回し蹴り","ドラゴンパンチ","超飛び蹴り","ドラゴンキック"],
  Pixie:  ["はり手","レイ","サンダー","ハイキック","ヒールレイド","ライトニング","メガレイ","なげキッス","ディープキッス"],
  Suezo:  ["しっぽアタック","ツバはき","テレポート","なめる","キッス","かみつき","なめキッス","タンはき","ベロビンタ"],
  Tiger:  ["たいあたり","ひっかき","突進","つながるワンツー","影撃","空中回転アタック","無制限バースト","炎撃","コンビネーション"],
  Monol:  ["たおれこみ","針ぶっ刺し","大たおれこみ","わらわら","針かみつき","2連アタック","超たおれこみ","超針ぶっ刺し","3連アタック"],
  Oboro:  ["ビンタ","つっつき","根っこ","コンビネーション","捕食","雑草魂","フェイスドリル","超捕食","ドリルコンビネーション"],
  Zan:    ["シングルショット","ミラージュシフト","サマーソルト","レッグアーク","ソニックナイフ","ダブルサマー","ダブルショット","トリプルサマー","アサルトダンス"]
};

const ALL_PLAYER_MONSTERS = {
  Mocchi: { id:'Mocchi', name:"モッチー", emoji:"🍡", imgUrl:MOCCHI_IMG, iconUrl:MOCCHI_ICON, trait:"もち肌", traitDesc:"勇者モン選択時：被ダメージ20%軽減", baseHp:600, baseGuts:100, baseAtk:120, baseDef:120, plusStats:{hp:250,atk:30,def:30,guts:10}, unique:{name:"モッチ砲",icon:"💣",monId:"Mocchi",baseMult:2.2,baseGuts:44,evoLevel:0,names:["モッチ砲","大モッチ砲","超モッチ砲","超モッチ砲2","超モッチ砲3","超モッチ砲ゴッド","超モッチ砲ブルー","身勝手のモッチ砲 兆","身勝手のモッチ砲 極"],effectDesc:"攻防一体：味方丈夫さ3%増＆敵被ダメ10%増(永続)"}},
  Suezo:  { id:'Suezo',  name:"スエゾー", emoji:"👁️", imgUrl:SUEZO_IMG, iconUrl:SUEZO_ICON, trait:"眼力", traitDesc:"勇者モン選択時：40%の確率で敵を行動不能にする", baseHp:500, baseGuts:120, baseAtk:140, baseDef:90, plusStats:{hp:150,atk:50,def:0,guts:25}, unique:{name:"サイコキネシス",icon:"👅",monId:"Suezo",baseMult:2.5,baseGuts:48,evoLevel:0,names:["サイコキネシス","熱視線","食う","クロノキネシス","歌う","超熱視線","超食う","超歌う","瞬間移動熱視線"],effectDesc:"吸収：最大ガッツの50%を回復"}},
  Golem:  { id:'Golem',  name:"ゴーレム", emoji:"🗿", imgUrl:GOLEM_IMG, iconUrl:GOLEM_ICON, trait:"怪力", traitDesc:"勇者モン選択時：与ダメージ20%増加", baseHp:650, baseGuts:70, baseAtk:250, baseDef:160, plusStats:{hp:400,atk:80,def:0,guts:0}, unique:{name:"合掌",icon:"🪨",monId:"Golem",baseMult:3.2,baseGuts:68,evoLevel:0,names:["合掌","フライングプレス","竜巻アタック","ぐるぐるアタック","大岩落とし","隕石落とし","超竜巻アタック","超ぐるぐるアタック","銀河破壊"],effectDesc:"闘志：味方攻撃力10%アップ(永続)"}},
  Tiger:  { id:'Tiger',  name:"ライガー", emoji:"🐺", imgUrl:TIGER_IMG, iconUrl:TIGER_ICON, trait:"俊足", traitDesc:"勇者モン選択時：50%の確率で攻撃を回避", baseHp:400, baseGuts:110, baseAtk:150, baseDef:80, plusStats:{hp:200,atk:50,def:50,guts:0}, unique:{name:"雷撃",icon:"⚡",monId:"Tiger",baseMult:2.3,baseGuts:46,evoLevel:0,names:["雷撃","冷気弾","超雷撃","ブリザード","突き刺し","落雷共鳴","かがやきいき","ライジングブースト","氷雷突殺"],effectDesc:"ロックオン：次ターン会心確定＆会心率+2%・会心ダメージ+2%(永続/重複可)"}},
  Ham:    { id:'Ham',    name:"ハム", emoji:"🐹", imgUrl:HAM_IMG, iconUrl:HAM_ICON, trait:"連続攻撃", traitDesc:"勇者モン選択時：同時使用可能枚数+1", baseHp:350, baseGuts:120, baseAtk:110, baseDef:70, plusStats:{hp:150,atk:60,def:0,guts:20}, unique:{name:"おなら",icon:"💨",monId:"Ham",baseMult:2.0,baseGuts:40,evoLevel:0,names:["おなら","瞬撃","大放屁","暗けい","フラフラダンス","超放屁","超暗けい","デンプシーロール","マジワンツー"],effectDesc:"スタン：このターン、敵を行動不能にする"}},
  Pixie:  { id:'Pixie',  name:"ピクシー", emoji:"🧚", imgUrl:PIXIE_IMG, iconUrl:PIXIE_ICON, trait:"魔力開放", traitDesc:"勇者モン選択時：固有技のダメージが2倍", baseHp:250, baseGuts:140, baseAtk:160, baseDef:50, plusStats:{hp:100,atk:20,def:0,guts:60}, unique:{name:"バン",icon:"🌟",monId:"Pixie",baseMult:2.1,baseGuts:42,evoLevel:0,names:["バン","ギガレイ","ギガサンダー","ビッグバン","ギガライトニング","コズミッグバン","テラレイ","テラバン","ドラゴ・ノヴァ"],effectDesc:"魔法空間：次ターン、カード消費ガッツ0"}},
  Monol:  { id:'Monol',  name:"モノリス", emoji:"⬛", imgUrl:MONOL_IMG, iconUrl:MONOL_ICON, trait:"反射", traitDesc:"勇者モン選択時：被弾時30%の確率でダメージを反射", baseHp:700, baseGuts:80, baseAtk:100, baseDef:250, plusStats:{hp:400,atk:0,def:100,guts:0}, unique:{name:"トリオビームX",icon:"📐",monId:"Monol",baseMult:2.2,baseGuts:44,evoLevel:0,names:["トリオビームX","サケビ声","トリオビームY","怪光線","超おんぱ","ファームアルファ","トリオビームZ","フォームガンマ","トリオビーム∞"],effectDesc:"障壁：味方丈夫さUP(永続)＆敵攻DOWN(WAVE限定)＆次ターン反射"}},
  Oboro:  { id:'Oboro',  name:"オボロゲソウ", emoji:"🌾", imgUrl:OBORO_IMG, iconUrl:OBORO_ICON, trait:"吸収", traitDesc:"勇者モン選択時：30%の確率で被ダメをHP(100%)とG(10%)へ変換", baseHp:900, baseGuts:115, baseAtk:90, baseDef:60, plusStats:{hp:600,atk:0,def:0,guts:10}, unique:{name:"種ガン",icon:"🍃",monId:"Oboro",baseMult:2.0,baseGuts:40,evoLevel:0,names:["種ガン","葉っぱブレード","花粉","キンプン","種マシンガン","フラワービーム","乱れ咲き","蒼花爆散","クリスマスツリー"],effectDesc:"ドレイン：与ダメの50%ライフ回復、与ダメの5%ガッツ回復"}},
  Zan:    { id:'Zan',    name:"ザン", emoji:"⚔️", imgUrl:ZAN_IMG, iconUrl:ZAN_ICON, trait:"連撃", traitDesc:"勇者モン選択時：ザンで攻撃した場合、与ダメの30%で連撃", baseHp:380, baseGuts:130, baseAtk:150, baseDef:50, plusStats:{hp:100,atk:40,def:0,guts:40}, unique:{name:"リバースレイド",icon:"⚔️",monId:"Zan",baseMult:2.5,baseGuts:50,evoLevel:0,names:["リバースレイド","ソニックレイヴ","メテオドライブ","アサルトレイド","ライジングレイヴ","アクシズバレット","ダークホウスト","アサルトライジング","ブラッディクロス"],effectDesc:"連斬：連撃ヒットがもう1回追加(与ダメ20%)＆連撃ダメージ+3%(永続/重複可)"}}
};

// 初期から無料で使えるモンスターのid一覧(固定)。
// 今後ALL_PLAYER_MONSTERSに新規モンスターを追加しても、ここに含めない限り
// 自動では解放されず、ブリーダーマーケットで円盤石を購入して解放する対象になる。
const STARTER_MONSTER_IDS = ['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro'];

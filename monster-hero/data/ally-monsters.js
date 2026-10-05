const HERO_ATK_NAMES = {
  Mocchi: ["もんた","もちき","ガッチョ","もっちゃん","ガッチャー","桜吹雪","もっさん","枝垂れ桜","もっさま"],
  Golem:  ["でこぴん","パンチ","キック","チョップ","ハエタタキ","大でこぴん","大パンチ","大キック","大ハエタタキ"],
  Ham:    ["ワンツー","飛び蹴り","バックナックル","正拳","後ろ蹴り","回し蹴り","ドラゴンパンチ","超飛び蹴り","ドラゴンキック"],
  Pixie:  ["はり手","レイ","サンダー","ハイキック","ヒールレイド","ライトニング","メガレイ","なげキッス","ディープキッス"],
  // ミーア(2026-09-29 ユーザー指示「技アクションにあわせて少し変更したい」→ 案B「ピクシーらしさを残す」)。
  // 歌って音符を飛ばす動きに合わせ、ピクシーの系統が分かる言葉(レイ・サンダー・ライトニング)を残して歌の言葉を足した
  Mia:    ["ハミング","メロディレイ","サンダービート","ハイキック","ヒールソング","ライトニング","メガメロディ","なげキッス","アンコールキッス"],
  Pandora: ["デュアルスラップ","ルミナスレイ","ナイトサンダー","セラフキック","アビスレイド","ホーリーライトニング","カオスメガレイ","エクリプスキッス","デュアルキッス"],
  Suezo:  ["しっぽアタック","ツバはき","テレポート","なめる","キッス","かみつき","なめキッス","タンはき","ベロビンタ"],
  Tiger:  ["たいあたり","ひっかき","突進","つながるワンツー","影撃","空中回転アタック","無制限バースト","炎撃","コンビネーション"],
  Monol:  ["たおれこみ","針ぶっ刺し","大たおれこみ","わらわら","針かみつき","2連アタック","超たおれこみ","超針ぶっ刺し","3連アタック"],
  Oboro:  ["ビンタ","つっつき","根っこ","コンビネーション","捕食","雑草魂","フェイスドリル","超捕食","ドリルコンビネーション"],
  Plant:  ["ビンタ","つっつき","根っこ","コンビネーション","捕食","雑草魂","フェイスドリル","超捕食","ドリルコンビネーション"],
  Zan:    ["シングルショット","ミラージュシフト","サマーソルト","レッグアーク","ソニックナイフ","ダブルサマー","ダブルショット","トリプルサマー","アサルトダンス"],
  Eiki:   ["桜牙","花裂き","桜風刃","花霞斬","桜月輪","桜嵐刃","千花連刃","桜閃爪","桜華絶閃爪"],
  // ミタラシ(2026-09-29 ユーザー指示「ミタラシも同じイメージで少し変えて」→「ほぼモッチーでちょっと火炎要素いれるぐらいでいい」)。
  // 口から炎のビームを吐く動きに合わせ、モッチーの技名のうち桜の2つだけを炎に置き換えた
  Mitarashi: ["もんた","もちき","ガッチョ","もっちゃん","ガッチャー","火の粉吹雪","もっさん","枝垂れ炎","もっさま"],
  KenshiMocchi: ["エッジもんた","もちき・リープ","ガッチョスラント","エアリアルもっちゃん","ガッチャー・クロス","黒桜吹雪","もっさんスピン","枝垂れクロス","バーストもっさま"],
  Ark:    ["我が瞳の真理を見よ","闇を裂く刃となれ","神剣よ断罪を下せ","星屑の記憶よ甦れ","世界を揺らせ","終わりなき祈りよ響け","白き誓い切なる願い","神光よ汚れを祓え","蒼き荊よ咎を穿て"],
  Iblis:  ["我が瞳の真理を見よ","闇を裂く刃となれ","神剣よ断罪を下せ","星屑の記憶よ甦れ","世界を揺らせ","終わりなき祈りよ響け","白き誓い切なる願い","神光よ汚れを祓え","蒼き荊よ咎を穿て"],
  Snegurochka: ["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","ジングルベル"],
  Undine: ["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","アクアゲイザー"],
  Yaobikuni: ["アイスブレード","アクアウィップ","アクアウェイブ","スプラッシュ","超アイスブレード","超アクアウィップ","ドルフィンブロー","ブラッドミスト","アクアゲイザー"],
  // ユグドラシル種(2026-09-29 ユーザーが送った参考の技画像から当てはめた)。通常技は「ちから」の技を
  // 進化段階(技の★1〜5)と消費ガッツの順に並べ、9つ目は★1のかしこさ技「グリーンライト」で埋めた。
  // メルホイップはユグドラシルと同じ並びで、★4の「苺大噴」の代わりにオリジナル技「ケーキ入刀」を持つ。
  // 固有技の9段階名は ALL_PLAYER_MONSTERS の unique.names(2026-09-29 正式実装)。
  // 技ごとの元の値(技種・消費ガッツ・ダメージなど)は docs/spec/YGGDRASIL_SKILLS.md
  Yggdrasil: ["頭突き","空中脳天撃","グリーンライト","ぴろぴろ舌","大玉転がし","月面水爆","キャンディボム","苺大噴","シャドウレギオン"],
  MelWhip:   ["頭突き","空中脳天撃","グリーンライト","ぴろぴろ舌","大玉転がし","月面水爆","キャンディボム","ケーキ入刀","シャドウレギオン"],
  // ゴースト(2026-10-05・案の段階)。並びと決めた経緯は docs/spec/GHOST_SKILLS.md
  Ghost:  ["ピコピコハンマー","ソウルビーム","ハトのおとしもの","びっくり","体当たり","カード","すてきステッキ","大パンチ","コンビネーション"],
  // スプーキー: ゴーストと同じ並びで、カード→カード・クラブ、コンビネーション→グリンネーション(オリジナル技)
  Spooky: ["ピコピコハンマー","ソウルビーム","ハトのおとしもの","びっくり","体当たり","カード・クラブ","すてきステッキ","大パンチ","グリンネーション"],
};

// atkMotion: 通常技・固有技のモーション種別。全モンスターに必須(新規追加時も必ず明示すること)。
// 'default'=共通の汎用モーション(attackFly/specialLunge)。それ以外は専用モーション種別
// (game-system.jsxの攻撃アニメーション分岐・CSS @keyframesに対応する識別子を追加すること)。
const ALL_PLAYER_MONSTERS = {
  Mocchi: { id:'Mocchi', name:"モッチー", emoji:"🍡", imgUrl:MOCCHI_IMG, iconUrl:MOCCHI_ICON, faceIconUrl:MOCCHI_FACE_ICON, atkMotion:'default', trait:"もち肌", traitDesc:"勇者モン選択時：被ダメージ20%軽減", baseHp:720, baseGuts:140, baseAtk:140, baseDef:140, plusStats:{hp:250,atk:30,def:30,guts:10}, distAptitude:['C','C','C','C'], unique:{name:"モッチ砲",icon:MOCCHI_ICON,monId:"Mocchi",baseMult:2.2,baseGuts:44,evoLevel:0,names:["モッチ砲","大モッチ砲","超モッチ砲","超モッチ砲2","超モッチ砲3","超モッチ砲ゴッド","超モッチ砲ブルー","身勝手のモッチ砲 兆","身勝手のモッチ砲 極"],effectDesc:"攻防一体：敵被ダメ10%増(WAVE限定/このターンから)＆味方の被ダメージ3%軽減(永続/次のターンから)"}},
  Suezo:  { id:'Suezo',  name:"スエゾー", emoji:"👁️", imgUrl:SUEZO_IMG, iconUrl:SUEZO_ICON, faceIconUrl:SUEZO_FACE_ICON, atkMotion:'default', trait:"眼力", traitDesc:"勇者モン選択時：40%の確率で敵を行動不能にする", baseHp:500, baseGuts:120, baseAtk:140, baseDef:90, plusStats:{hp:150,atk:50,def:0,guts:25}, distAptitude:['E','D','C','B'], unique:{name:"サイコキネシス",icon:SUEZO_ICON,monId:"Suezo",baseMult:2.5,baseGuts:48,evoLevel:0,names:["サイコキネシス","熱視線","食う","クロノキネシス","歌う","超熱視線","超食う","超歌う","瞬間移動熱視線"],effectDesc:"吸収：最大ガッツの50%を回復"}},
  // ゴーレムは「一撃が重い代わりにガッツが続かず、零距離でしか戦えない」重量級。
  // ライフ600・ちから220・丈夫さ150・ガッツ70・間合い適性A/E/G/Gと、固有技「合掌」の
  // 効果(闘志)7.5%はユーザー指定の値。変えるときは指示を確認すること。
  // 合掌の消費ガッツ68と供モンのちから加算+80も、ユーザーの指示で元の値に戻したもの。
  //
  // 合掌はガッツを貯めるだけの場合、初めて撃てるのが11ターン目になる(最大70・開始35・
  // 自動回復3/ターンで消費68)。他の11種は1ターン目に撃てるので、これはゴーレムだけの
  // 「重い」性格として意図した値。tools/golem-balance-check.js が実測して表示する。
  Golem:  { id:'Golem',  name:"ゴーレム", emoji:"🗿", imgUrl:GOLEM_IMG, iconUrl:GOLEM_ICON, faceIconUrl:GOLEM_FACE_ICON, atkMotion:'default', trait:"怪力", traitDesc:"勇者モン選択時：与ダメージ20%増加", baseHp:600, baseGuts:70, baseAtk:220, baseDef:150, plusStats:{hp:400,atk:80,def:0,guts:0}, distAptitude:['A','E','G','G'], unique:{name:"合掌",icon:GOLEM_ICON,monId:"Golem",baseMult:3.2,baseGuts:68,evoLevel:0,names:["合掌","フライングプレス","竜巻アタック","ぐるぐるアタック","大岩落とし","隕石落とし","超竜巻アタック","超ぐるぐるアタック","銀河破壊"],effectDesc:"闘志：味方の与ダメージ7.5%アップ(永続)"}},
  Tiger:  { id:'Tiger',  name:"ライガー", emoji:"🐺", imgUrl:TIGER_IMG, iconUrl:TIGER_ICON, faceIconUrl:TIGER_FACE_ICON, atkMotion:'default', trait:"俊足", traitDesc:"勇者モン選択時：50%の確率で攻撃を回避", baseHp:400, baseGuts:110, baseAtk:150, baseDef:80, plusStats:{hp:200,atk:50,def:50,guts:0}, distAptitude:['C','B','D','D'], unique:{name:"雷撃",icon:TIGER_ICON,monId:"Tiger",baseMult:2.3,baseGuts:46,evoLevel:0,names:["雷撃","冷気弾","超雷撃","ブリザード","突き刺し","落雷共鳴","かがやきいき","ライジングブースト","氷雷突殺"],effectDesc:"狩撃：次ターン会心確定＆会心率+2%・会心ダメージ+2%(永続/重複可/次のターンから)"}},
  Ham:    { id:'Ham',    name:"ハム", emoji:"🐹", imgUrl:HAM_IMG, iconUrl:HAM_ICON, faceIconUrl:HAM_FACE_ICON, atkMotion:'default', trait:"連続攻撃", traitDesc:"勇者モン選択時：同時使用可能枚数+1", baseHp:350, baseGuts:120, baseAtk:110, baseDef:70, plusStats:{hp:150,atk:60,def:0,guts:20}, distAptitude:['B','B','D','D'], unique:{name:"おなら",icon:HAM_ICON,monId:"Ham",baseMult:2.0,baseGuts:40,evoLevel:0,names:["おなら","瞬撃","大放屁","暗けい","フラフラダンス","超放屁","超暗けい","デンプシーロール","マジワンツー"],effectDesc:"スタン：このターン、敵を行動不能にする"}},
  Pixie:  { id:'Pixie',  name:"ピクシー", emoji:"🧚", imgUrl:PIXIE_IMG, iconUrl:PIXIE_ICON, faceIconUrl:PIXIE_FACE_ICON, atkMotion:'default', trait:"魔力開放", traitDesc:"勇者モン選択時：固有技のダメージが2倍", baseHp:250, baseGuts:170, baseAtk:160, baseDef:50, plusStats:{hp:100,atk:20,def:0,guts:60}, distAptitude:['G','F','B','A'], unique:{name:"バン",icon:PIXIE_ICON,monId:"Pixie",baseMult:2.1,baseGuts:42,evoLevel:0,names:["バン","ギガレイ","ギガサンダー","ビッグバン","ギガライトニング","コズミッグバン","テラレイ","テラバン","ドラゴ・ノヴァ"],effectDesc:"魔法空間：次ターン、カード消費ガッツ0"}},
  Mia:    { id:'Mia',    name:"ミーア", emoji:"🧚", imgUrl:MIA_IMG, iconUrl:MIA_ICON, faceIconUrl:MIA_FACE_ICON, atkMotion:'miaSongNotes', trait:"魔力開放", traitDesc:"勇者モン選択時：固有技のダメージが2倍", baseHp:300, baseGuts:180, baseAtk:175, baseDef:60, plusStats:{hp:120,atk:30,def:10,guts:65}, distAptitude:['G','C','A','B'], unique:{name:"ボイスバン",icon:MIA_ICON,monId:"Mia",baseMult:2.1,baseGuts:42,evoLevel:0,names:["ボイスバン","ギガメロディ","ギガサンダー","ビッグバンライブ","ギガライトニング","コズミックライブ","テラメロディ","テラボイスバン","ノヴァ・フィナーレ"],effectDesc:"魔法空間：次ターン、カード消費ガッツ0"}},
  Pandora: { id:'Pandora', name:"パンドラ", emoji:"😈", imgUrl:PANDORA_IMG, iconUrl:PANDORA_ICON, faceIconUrl:PANDORA_FACE_ICON, atkMotion:'pandoraDualThunder', trait:"禁忌解錠", traitDesc:"勇者モン選択時：自身の固有技は連撃100%、引き継いだ固有技は通常ダメージ+50%", baseHp:360, baseGuts:135, baseAtk:180, baseDef:100, plusStats:{hp:130,atk:35,def:25,guts:40}, distAptitude:['B','B','B','B'], unique:{name:"デュアルバン",icon:PANDORA_ICON,monId:"Pandora",baseMult:2.3,baseGuts:52,evoLevel:0,names:["デュアルバン","セイクリッドレイ","アビスサンダー","ツインビッグバン","ダークライトニング","カオスコズミック","アストラルクロスレイ","エクリプスノヴァ","ダイスキライライ"],effectDesc:"双極共振：使用後、次の2ターンのカード消費ガッツ50%減"}},
  Monol:  { id:'Monol',  name:"モノリス", emoji:"⬛", imgUrl:MONOL_IMG, iconUrl:MONOL_ICON, faceIconUrl:MONOL_FACE_ICON, atkMotion:'default', trait:"反射", traitDesc:"勇者モン選択時：被弾時30%の確率でダメージを反射", baseHp:700, baseGuts:80, baseAtk:100, baseDef:250, plusStats:{hp:400,atk:0,def:100,guts:0}, distAptitude:['B','C','D','C'], unique:{name:"トリオビームX",icon:MONOL_ICON,monId:"Monol",baseMult:2.2,baseGuts:44,evoLevel:0,names:["トリオビームX","サケビ声","トリオビームY","怪光線","超おんぱ","ファームアルファ","トリオビームZ","フォームガンマ","トリオビーム∞"],effectDesc:"障壁：次のターンから、味方丈夫さ3%増(永続)＆敵攻10%DOWN(WAVE限定)＆反射"}},
  Oboro:  { id:'Oboro',  name:"オボロゲソウ", emoji:"🌾", imgUrl:OBORO_IMG, iconUrl:OBORO_ICON, faceIconUrl:OBORO_FACE_ICON, atkMotion:'default', trait:"吸収", traitDesc:"勇者モン選択時：30%の確率で被ダメをライフ(100%)とガッツ(10%)へ変換", baseHp:900, baseGuts:115, baseAtk:90, baseDef:60, plusStats:{hp:600,atk:0,def:0,guts:10}, distAptitude:['D','E','B','C'], unique:{name:"種ガン",icon:OBORO_ICON,monId:"Oboro",baseMult:2.0,baseGuts:40,evoLevel:0,names:["種ガン","葉っぱブレード","花粉","キンプン","種マシンガン","フラワービーム","乱れ咲き","蒼花爆散","クリスマスツリー"],effectDesc:"ドレイン：与ダメの50%ライフ回復、与ダメの5%ガッツ回復"}},
  Plant:  { id:'Plant',  name:"プラント", emoji:"🌱", imgUrl:PLANT_IMG, iconUrl:PLANT_ICON, faceIconUrl:PLANT_FACE_ICON, atkMotion:'default', trait:"吸収", traitDesc:"勇者モン選択時：30%の確率で被ダメをライフ(100%)とガッツ(10%)へ変換", baseHp:930, baseGuts:120, baseAtk:100, baseDef:65, plusStats:{hp:620,atk:10,def:0,guts:15}, distAptitude:['C','D','F','A'], unique:{name:"種ガン",icon:PLANT_ICON,monId:"Plant",baseMult:2.0,baseGuts:40,evoLevel:0,names:["種ガン","葉っぱブレード","花粉","キンプン","種マシンガン","フラワービーム","乱れ咲き","蒼花爆散","クリスマスツリー"],effectDesc:"ドレイン：与ダメの50%ライフ回復、与ダメの5%ガッツ回復"}},
  Zan:    { id:'Zan',    name:"ザン", emoji:"⚔️", imgUrl:ZAN_IMG, iconUrl:ZAN_ICON, faceIconUrl:ZAN_FACE_ICON, atkMotion:'zanCombo', trait:"連撃", traitDesc:"勇者モン選択時：ザンで攻撃した場合、与ダメの30%で連撃", baseHp:300, baseGuts:115, baseAtk:125, baseDef:30, plusStats:{hp:100,atk:40,def:0,guts:40}, distAptitude:['C','A','B','E'], unique:{name:"リバースレイド",icon:ZAN_ICON,monId:"Zan",baseMult:2.5,baseGuts:50,evoLevel:0,names:["リバースレイド","ソニックレイヴ","メテオドライブ","アサルトレイド","ライジングレイヴ","アクシズバレット","ダークホウスト","アサルトライジング","ブラッディクロス"],effectDesc:"連斬：与ダメ20%で連撃＆連撃ダメージ+3%(永続/重複可/次のターンから)"}},
  // エイキ(ザン×？？？のレア)。★正式実装まではデバッグ専用(debugOnly:true)。
  //   ・debugOnly により図鑑(dexMonsterList)・RPG一覧・マスモン登録から外れる
  //   ・通常ロースターは unlockedMonsterIds で絞るので、解放しない限り出てこない
  //   ・マーケット(円盤石300000ダイヤ)は正式実装時に登録する。いまは商品化しない
  // 勇者特性「桜花連舞」と固有効果「緋桜連華」の連撃は、ザンの既存 rollCombo をそのまま使う。
  // 攻撃モーションはザンの zanCombo を土台にした専用種別(桜の花びらを攻撃時だけ重ねる)。
  Eiki:   { id:'Eiki',   name:"エイキ", emoji:"🌸", imgUrl:EIKI_IMG, iconUrl:EIKI_ICON, faceIconUrl:EIKI_FACE_ICON, atkMotion:'eikiSakuraCombo', trait:"桜花連舞", traitDesc:"勇者モン選択時：攻撃後、与ダメ10%の連撃を2回。自身の固有技使用時は、さらに与ダメ30%の連撃を1回追加。", baseHp:400, baseGuts:135, baseAtk:165, baseDef:20, plusStats:{hp:150,atk:50,def:20,guts:45}, distAptitude:['A','A','C','C'], unique:{name:"華影緋閃",icon:EIKI_ICON,monId:"Eiki",baseMult:2.8,baseGuts:56,evoLevel:0,names:["華影緋閃","氷花一閃","桜月斬華","緋雪乱刃","花氷双牙","千華氷嵐","緋桜六華閃","絶影桜華乱舞","絶華緋閃・零桜"],effectDesc:"緋桜連華：与ダメ15%で連撃×2＆連撃ダメージ+3%・攻撃力+3%(永続/重複可/次のターンから)"}},
  // 剣士モッチー(モッチー×？？？のレア)。2026年9月に正式実装。
  // ★2026-09-25 ユーザー指示で ちから185→135 / 丈夫さ25→75 に調整した(ライフ・ガッツはそのまま)。
  //   タクティクスのEX「ソード・コンバージョン」(片手剣・片手盾・二刀流)を入れたのに合わせたもの。
  //   種の基礎値なので、ほかのモードと、すでに持っている剣士モッチー(個体差は差分で持っている)にも効く
  // 「高火力・低耐久・近接向けの攻撃特化型」。基礎総合力はエイキ付近で、エイキより攻撃へ寄せてある。
  // 勇者特性「黒の剣士」(2026-09-25 に「二刀流」から改名。タクティクスのEXのスタイル「二刀流」と別物)と
  // 固有効果「ソードスキル」の実体は次の3か所。
  //   ・カード枚数+1 … 60-app.jsx の heroCardBonus(HERO_CARD_BONUS_MONSTER_IDS)。ハムと同じ共通ルールを通る
  //   ・通常攻撃の50%+50%、自身の固有技での10%連撃×3、ソードスキルの20%連撃×2、
  //     連撃パワーで増える永久10%連撃 … 22-enemy-and-bond-entries.jsx の buildAttackHits(ヒット列の正本)
  //   ・連撃ダメージ+3%・連撃パワー・永久追加連撃の積み上げ … 60-app.jsx の固有技効果ブロック
  // 連撃はどれも「分割前の基準ダメージ」基準で、直前のヒットからは計算しない。
  KenshiMocchi: { id:'KenshiMocchi', name:"剣士モッチー", emoji:"🗡️", imgUrl:KENSHI_MOCCHI_IMG, iconUrl:KENSHI_MOCCHI_ICON, faceIconUrl:KENSHI_MOCCHI_FACE_ICON, atkMotion:'kenshiTwinBlade', trait:"黒の剣士", traitDesc:"勇者モン選択時：同時使用可能枚数+1。通常攻撃のダメージが50%になる代わりに、与ダメージ50%の連撃を行う。自身の固有技使用時は、与ダメージ10%の連撃を3回追加。", baseHp:350, baseGuts:130, baseAtk:135, baseDef:75, plusStats:{hp:200,atk:55,def:20,guts:25}, distAptitude:['A','A','C','D'], unique:{name:"ソニック・リープ",icon:KENSHI_MOCCHI_ICON,monId:"KenshiMocchi",baseMult:2.4,baseGuts:48,evoLevel:0,names:["ソニック・リープ","ホリゾンタル・スクエア","ヴォーパル・ストライク","デュアル・サーキュラー","ブラック・テンペスト","ブラック・チェイン","ナイトメア・レイド","ジ・エクリプス","スターバースト・ストリーム"],effectDesc:"ソードスキル：与ダメ20%で連撃×2＆連撃ダメージ+3%・連撃パワー+1(永続/重複可/次のターンから)。連撃パワーが3たまるごとに与ダメ10%の連撃+1(上限なし)"}},
  Mitarashi: { id:'Mitarashi', name:"ミタラシ", emoji:"🐉", imgUrl:MITARASHI_IMG, iconUrl:MITARASHI_ICON, faceIconUrl:MITARASHI_FACE_ICON, atkMotion:'default', trait:"もち肌", traitDesc:"勇者モン選択時：被ダメージ20%軽減", baseHp:680, baseGuts:120, baseAtk:150, baseDef:115, plusStats:{hp:250,atk:30,def:30,guts:10}, distAptitude:['D','D','B','B'], unique:{name:"モッチ砲",icon:MITARASHI_ICON,monId:"Mitarashi",baseMult:2.2,baseGuts:44,evoLevel:0,names:["モッチ砲","大モッチ砲","超モッチ砲","超モッチ砲2","超モッチ砲3","超炎モッチ砲ゴッド","超蒼炎モッチ砲","身勝手のモッチ砲 兆","身勝手のモッチ砲 極"],effectDesc:"攻防一体：敵被ダメ10%増(WAVE限定/このターンから)＆味方の被ダメージ3%軽減(永続/次のターンから)"}},
  Ark:    { id:'Ark',    name:"アーク", emoji:"🦊", imgUrl:ARK_IMG, iconUrl:ARK_ICON, faceIconUrl:ARK_FACE_ICON, atkMotion:'arkHolyRain', trait:"中二病", traitDesc:"勇者モン選択時：敵の攻撃を2回まで被ダメージ50%カット(WAVE毎に回数リセット)＆固有技使用時、消費ガッツ10%増・ダメージ倍率+0.1(永続/重複可/次のターンから)", baseHp:440, baseGuts:120, baseAtk:130, baseDef:90, plusStats:{hp:210,atk:50,def:30,guts:30}, distAptitude:['E','B','C','B'], unique:{name:"祈れ輪廻の環よ",icon:ARK_ICON,monId:"Ark",baseMult:2.8,baseGuts:56,evoLevel:0,names:["祈れ輪廻の環よ","裁きの光よ下れ","今こそ真なる目醒め","聖夜の鐘を鳴響け","熾天の剣よ降り立て","聖光よ奇跡を灯せ","終焉に救いを与えよ","天の慈悲を示されよ","永劫の贖いを全うせよ"],effectDesc:"贖罪：与ダメの20%で追撃＆次ターン消費ガッツ15%増・被ダメージ50%減(1回)"}},
  Iblis:  { id:'Iblis',  name:"イブリース", emoji:"🐏", imgUrl:IBLIS_IMG, iconUrl:IBLIS_ICON, faceIconUrl:IBLIS_FACE_ICON, atkMotion:'arkHolyRain', trait:"中二病", traitDesc:"勇者モン選択時：敵の攻撃を2回まで被ダメージ50%カット(WAVE毎に回数リセット)＆固有技使用時、消費ガッツ10%増・ダメージ倍率+0.1(永続/重複可/次のターンから)", baseHp:360, baseGuts:125, baseAtk:145, baseDef:75, plusStats:{hp:180,atk:60,def:25,guts:35}, distAptitude:['D','B','E','B'], unique:{name:"祈れ輪廻の環よ",icon:IBLIS_ICON,monId:"Iblis",baseMult:2.8,baseGuts:56,evoLevel:0,names:["祈れ輪廻の環よ","裁きの光よ下れ","今こそ真なる目醒め","聖夜の鐘を鳴響け","熾天の剣よ降り立て","聖光よ奇跡を灯せ","終焉に救いを与えよ","天の慈悲を示されよ","永劫の贖いを全うせよ"],effectDesc:"贖罪：与ダメの20%で追撃＆次ターン消費ガッツ15%増・被ダメージ50%減(1回)"}},
  Snegurochka: { id:'Snegurochka', name:"スネグーラチカ", emoji:"❄️", imgUrl:SNEGUROCHKA_IMG, iconUrl:SNEGUROCHKA_ICON, faceIconUrl:SNEGUROCHKA_FACE_ICON, atkMotion:'waterBurst', trait:"氷海の支配者", traitDesc:"勇者モン選択時：絶氷の楔発動中かつ敵と同じ距離の場合、自動ガッツ回復率+50%（上限100%）", baseHp:400, baseGuts:150, baseAtk:135, baseDef:80, plusStats:{hp:150,atk:40,def:10,guts:40}, distAptitude:['D','E','B','A'], unique:{name:"アイスアロー",icon:SNEGUROCHKA_ICON,monId:"Snegurochka",baseMult:2.2,baseGuts:44,evoLevel:0,names:["アイスアロー","ダブルバレッド","アイスコフィン","プレゼントキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","メリークリスマス"],effectDesc:"絶氷の楔：次のターンから5ターン、敵の距離移動を封じ、敵の与ダメージを30%減少。距離撃による強制移動は有効。使用するたび消費ガッツ3%減（永続・重複可・次のターンから）。"}},
  // スネグーラチカと同系統の人魚。専用モーション・勇者特性・固有効果はすべて同じ実装を共有する
  Undine: { id:'Undine', name:"ウンディーネ", emoji:"💧", imgUrl:UNDINE_IMG, iconUrl:UNDINE_ICON, faceIconUrl:UNDINE_FACE_ICON, atkMotion:'waterBurst', trait:"氷海の支配者", traitDesc:"勇者モン選択時：絶氷の楔発動中かつ敵と同じ距離の場合、自動ガッツ回復率+50%（上限100%）", baseHp:350, baseGuts:170, baseAtk:160, baseDef:50, plusStats:{hp:100,atk:45,def:0,guts:60}, distAptitude:['G','D','C','C'], unique:{name:"アイスアロー",icon:UNDINE_ICON,monId:"Undine",baseMult:2.2,baseGuts:44,evoLevel:0,names:["アイスアロー","ダブルバレッド","アイスコフィン","アクアキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","オーシャンノヴァ"],effectDesc:"絶氷の楔：次のターンから5ターン、敵の距離移動を封じ、敵の与ダメージを30%減少。距離撃による強制移動は有効。使用するたび消費ガッツ3%減（永続・重複可・次のターンから）。"}},
  Yaobikuni: { id:'Yaobikuni', name:"ヤオビクニ", emoji:"🍃", imgUrl:YAOBIKUNI_IMG, iconUrl:YAOBIKUNI_ICON, faceIconUrl:YAOBIKUNI_FACE_ICON, atkMotion:'waterBurst', trait:"氷海の支配者", traitDesc:"勇者モン選択時：絶氷の楔発動中かつ敵と同じ距離の場合、自動ガッツ回復率+50%（上限100%）", baseHp:450, baseGuts:125, baseAtk:125, baseDef:105, plusStats:{hp:150,atk:30,def:30,guts:30}, distAptitude:['D','B','E','C'], unique:{name:"アイスアロー",icon:YAOBIKUNI_ICON,monId:"Yaobikuni",baseMult:2.2,baseGuts:44,evoLevel:0,names:["アイスアロー","ダブルバレッド","アイスコフィン","アクアキッス","クリスタルアロー","アクアブラスト","ホワイトエレジー","アクアドーム","オーシャンノヴァ"],effectDesc:"絶氷の楔：次のターンから5ターン、敵の距離移動を封じ、敵の与ダメージを30%減少。距離撃による強制移動は有効。使用するたび消費ガッツ3%減（永続・重複可・次のターンから）。"}},
  // ユグドラシル種(2026-09-29 正式実装)。数値・特性・固有技・EXはユーザーと決めた値(docs/spec/YGGDRASIL_SKILLS.md)。
  // どちらもライフ・丈夫さ型で、ユグドラシルのほうが丈夫さ寄り、メルホイップのほうが少し攻撃寄り。
  // 固有技は消費64(×3.2)の重い一撃。勇者特性「生命の源」と固有技の効果「大樹の加護」は2体で同じ。
  // 技は技の名前ごとに別の動き(23-rpg-debug.jsx の SKILL_ATTACK_THEMES)なので atkMotion は 'default'
  Yggdrasil: { id:'Yggdrasil', name:"ユグドラシル", emoji:"🌳", imgUrl:YGGDRASIL_IMG, iconUrl:YGGDRASIL_ICON, faceIconUrl:YGGDRASIL_FACE_ICON, atkMotion:'default', trait:"生命の源", traitDesc:"勇者モン選択時：1〜5ターン目は被ダメージ30%軽減。6ターン目以降、3ターン毎にガッツ30%回復(ターン数はWAVE毎にリセット)", baseHp:800, baseGuts:115, baseAtk:100, baseDef:180, plusStats:{hp:380,atk:10,def:80,guts:5}, distAptitude:['B','D','E','A'], unique:{name:"スターボム",icon:YGGDRASIL_ICON,monId:"Yggdrasil",baseMult:3.2,baseGuts:64,evoLevel:0,names:["スターボム","ワンダーブレイズ","メニーウィング","メテオストーム","パピヨンバースト","ヘビーレイン","エターナルアーク","オーロラハック","コスモフルーツ"],effectDesc:"大樹の加護：最大ガッツの20%回復＆被ダメージ30%軽減(このターンから2ターン)"}},
  MelWhip:   { id:'MelWhip', name:"メルホイップ", emoji:"🍰", imgUrl:MEL_WHIP_IMG, iconUrl:MEL_WHIP_ICON, faceIconUrl:MEL_WHIP_FACE_ICON, atkMotion:'default', trait:"生命の源", traitDesc:"勇者モン選択時：1〜5ターン目は被ダメージ30%軽減。6ターン目以降、3ターン毎にガッツ30%回復(ターン数はWAVE毎にリセット)", baseHp:780, baseGuts:120, baseAtk:130, baseDef:150, plusStats:{hp:350,atk:30,def:50,guts:10}, distAptitude:['E','C','A','B'], unique:{name:"スターボム",icon:MEL_WHIP_ICON,monId:"MelWhip",baseMult:3.2,baseGuts:64,evoLevel:0,names:["スターボム","ワンダーブレイズ","ライスシャワー","メテオストーム","パピヨンバースト","ヘビーレイン","エターナルアーク","オーロラハック","コスモフルーツ"],effectDesc:"大樹の加護：最大ガッツの20%回復＆被ダメージ30%軽減(このターンから2ターン)"}},
  // ゴースト種(2026-10-05 正式実装)。数値・特性・固有技・EXはユーザーと決めた値(docs/spec/GHOST_SKILLS.md)。
  // 新しい血統ゴースト。ゴーストは純血、スプーキーはゴースト×？？？のレア。2体とも打たれ弱い魔法寄りで、ガッツ多め。
  // 勇者特性「トリックスタート」は2体で同じ。固有技の効果だけ違う(ゴースト=運命のコイン / スプーキー=運命の輪)。
  // 固有技の倍率はコイン・輪の上乗せを入れて決めた(ゴースト2.0倍・スプーキー2.4倍。消費は倍率×20)
  Ghost:     { id:'Ghost', name:"ゴースト", emoji:"👻", imgUrl:GHOST_IMG, iconUrl:GHOST_ICON, faceIconUrl:GHOST_FACE_ICON, atkMotion:'default', trait:"トリックスタート", traitDesc:"勇者モン選択時：WAVEの1ターン目から3ターン毎に、ちから+20%・丈夫さ+20%・毎ターンライフ5%回復をそれぞれ50%で付与(重複あり・そのWAVEのあいだ)。攻撃が当たると、その技の消費ガッツの半分を回復", baseHp:450, baseGuts:150, baseAtk:130, baseDef:50, plusStats:{hp:150,atk:35,def:10,guts:45}, distAptitude:['C','C','A','C'], unique:{name:"連続カード",icon:GHOST_ICON,monId:"Ghost",baseMult:2.0,baseGuts:40,evoLevel:0,names:["連続カード","ドクロビーム","大きなおとしもの","びっくりドクロ","スリーセブン","Woフォーチュン","RSF","運命のコイン","グランドイリュージョン"],effectDesc:"運命のコイン：コインを投げ、表ならダメージ4倍＆この子の連撃+10%、裏ならダメージ0.5倍＆固有技の消費ガッツ+20%(連撃と消費ガッツの増減はバトル中ずっと残り、重なる)"}},
  Spooky:    { id:'Spooky', name:"スプーキー", emoji:"🎃", imgUrl:SPOOKY_IMG, iconUrl:SPOOKY_ICON, faceIconUrl:SPOOKY_FACE_ICON, atkMotion:'default', trait:"トリックスタート", traitDesc:"勇者モン選択時：WAVEの1ターン目から3ターン毎に、ちから+20%・丈夫さ+20%・毎ターンライフ5%回復をそれぞれ50%で付与(重複あり・そのWAVEのあいだ)。攻撃が当たると、その技の消費ガッツの半分を回復", baseHp:510, baseGuts:160, baseAtk:150, baseDef:55, plusStats:{hp:160,atk:40,def:5,guts:50}, distAptitude:['B','D','B','A'], unique:{name:"連続カード",icon:SPOOKY_ICON,monId:"Spooky",baseMult:2.4,baseGuts:48,evoLevel:0,names:["連続カード","ドクロビーム","大きなおとしもの","びっくりドクロ","スリーセブン","Woフォーチュン","RSF","運命のコイン","グランドイリュージョン"],effectDesc:"運命の輪：当てると6つから1つがランダムで出る。敵の与ダメージ−30%(2ターン)／敵の被ダメージ+30%(2ターン)／ダメージ3倍／ダメージ2倍／この子の連撃+10%(バトル中ずっと・重なる)／この子のちから+15%(バトル中ずっと・重なる)"}},
};

// 初期から無料で使えるモンスターのid一覧(固定)。
// 今後ALL_PLAYER_MONSTERSに新規モンスターを追加しても、ここに含めない限り
// 自動では解放されず、ブリーダーマーケットで円盤石を購入して解放する対象になる。
const STARTER_MONSTER_IDS = ['Mocchi','Suezo','Golem','Tiger','Ham','Pixie','Monol','Oboro'];

// ===== 案の段階のモンスター(デバッグの「新モンスター確認」にだけ並ぶ) =====
// 2026-09-28・ユーザー指示「新モンスターの案が出た段階でデバッグには追加して、いま入れられるぶんは入れて。
// 確認しやすいように。そこで足りないのも確認して補完できるし、いまの現状も見れるから」。
// **ALL_PLAYER_MONSTERS には入れない**(図鑑・ロースター・マーケット・保存のどこにも出ない)。
// デバッグの確認画面(74-screen-monster-check-debug.jsx)だけが、本体の一覧のうしろへ足して並べる。
// 決まっていない項目(能力値・技・勇者特性・攻撃モーション)は書かない。画面で「未設定」と赤く出るので、
// 何が足りないかがそのまま一覧になる。正式に実装したら ALL_PLAYER_MONSTERS へ移し、ここからは消す。
//   draftLineage … 血統の案。本体の MONSTER_LINEAGE_MAP へ足すのは正式実装のとき(lineage-dex-check.js の決まり)
// ユグドラシルとメルホイップは 2026-09-29、ゴーストとスプーキーは 2026-10-05 に正式実装したので ALL_PLAYER_MONSTERS へ移した(ここは空)。
//   draftUniqueNames … 固有技の9段階名(正式実装のとき unique.names へ移す)
const UPCOMING_MONSTER_DRAFTS = Object.freeze({
});

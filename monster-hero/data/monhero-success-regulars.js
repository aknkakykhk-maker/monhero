// モンヒロサクセス 台本 第3弾: 大会の常連の名前の案(TOURNAMENT.md の大会ごとに、常連3人+王者1体)
// 大会の顔ぶれの表は芯(クラフト)が作る。ここは名前の案だけ。強さは「大会の相手を作る部品」(TOURNAMENT §9)が決める。
// (2026-11-12 data 側へ移した・画面と計算の芯が読む)
// 種は公開ずみの子だけ(コラボの子・下書きの子は使わない)。間合いの大会はその間合いの適性 A の種、タイプの大会はそのタイプ(メインかサブ)の種。
// 名前はモンスターヒーローのオリジナル(実在の人・ほかのゲームの人物は使わない)。
//   cup     … 大会の id の系統の部分(TOURNAMENT §3・§4・§4b・§6)
//   breeder … 育てている人の名前 / mon … モンスターの名前 / species … ALL_PLAYER_MONSTERS の id
//   champ   … true がその大会の王者(1大会に1体)/ note … 解説や紹介で使える一言の目安
const MONSUC_REGULAR_CUPS = Object.freeze({
  debut:'デビュー戦', str:'ちから自慢', int:'かしこさ自慢', aim:'狙い自慢', dodge:'かわし自慢', hard:'かたさ自慢', life:'しぶとさ自慢',
  dist0:'間合い(零)', dist1:'間合い(近)', dist2:'間合い(中)', dist3:'間合い(遠)',
  attacker:'タイプ(アタッカー)', tank:'タイプ(タンク)', supporter:'タイプ(サポーター)', healer:'タイプ(ヒーラー)', shadow:'タイプ(シャドウ)',
  spring:'春の大会', summer:'夏の大会', autumn:'秋の大会', winter:'冬の大会', normal:'ふつうの大会',
  herosummer:'夏のヒーロー記念', herowinter:'冬のヒーロー記念', peak:'ヒーローズファイナル', scmua:'笑顔の大会(みゅあのシナリオ)', scatsu:'格上への挑戦(あつのシナリオ)',
});
const MONSUC_REGULARS = Object.freeze([
  { id:'reg.debut.1', cup:'debut', breeder:'小春ひより', mon:'おもち丸', species:'Mocchi', note:'初めての大会で緊張ぎみ' },
  { id:'reg.debut.2', cup:'debut', breeder:'早川ススム', mon:'ちゅるぴ', species:'Ham', note:'とにかく元気に走り回る' },
  { id:'reg.debut.3', cup:'debut', breeder:'星野ミツル', mon:'ルミナ', species:'Pixie', note:'羽の手入れがじまん' },
  { id:'reg.debut.c', cup:'debut', breeder:'大門ハジメ', mon:'ハジマリ', species:'Mocchi', champ:true, note:'デビュー戦の名物。新人の壁' },

  { id:'reg.str.1', cup:'str', breeder:'岩城ゴウタ', mon:'ガンテツ', species:'Golem', note:'一撃に全てをかける' },
  { id:'reg.str.2', cup:'str', breeder:'剣持サクラ', mon:'紅一閃', species:'Eiki', note:'まっすぐな太刀筋' },
  { id:'reg.str.3', cup:'str', breeder:'箱崎レイ', mon:'ドンガラ', species:'Pandora', note:'ふたを開けたら大暴れ' },
  { id:'reg.str.c', cup:'str', breeder:'力丸ダイゴ', mon:'ゴウリキ', species:'Golem', champ:true, note:'ちから自慢を何度も制した怪力' },

  { id:'reg.int.1', cup:'int', breeder:'水瀬シズク', mon:'セセラギ', species:'Undine', note:'流れを読んで動く' },
  { id:'reg.int.2', cup:'int', breeder:'猫田メイ', mon:'ミャコ', species:'Mia', note:'相手のくせを覚える' },
  { id:'reg.int.3', cup:'int', breeder:'白樺ユキノ', mon:'ユキアカリ', species:'Snegurochka', note:'静かに先を読む' },
  { id:'reg.int.c', cup:'int', breeder:'知念サトル', mon:'ハカセイ', species:'Pixie', champ:true, note:'読み合いで負けたことがない' },

  { id:'reg.aim.1', cup:'aim', breeder:'黒羽ジン', mon:'ノクターン', species:'Iblis', note:'遠くからでも外さない' },
  { id:'reg.aim.2', cup:'aim', breeder:'方舟ワタル', mon:'アルクス', species:'Ark', note:'狙いを定めるまでが長い' },
  { id:'reg.aim.3', cup:'aim', breeder:'的場ナツメ', mon:'ピタリ', species:'Mia', note:'的当ての遊びから育った' },
  { id:'reg.aim.c', cup:'aim', breeder:'一ツ目ヒカル', mon:'センリガン', species:'Suezo', champ:true, note:'大きな目でどこまでも見通す' },

  { id:'reg.dodge.1', cup:'dodge', breeder:'疾風カイ', mon:'ハヤテ', species:'Tiger', note:'目にも止まらぬ足' },
  { id:'reg.dodge.2', cup:'dodge', breeder:'朧月セイ', mon:'カゲロウ', species:'Zan', note:'気づけば後ろにいる' },
  { id:'reg.dodge.3', cup:'dodge', breeder:'宵宮フウカ', mon:'ふわり', species:'Ghost', note:'つかもうとしてもすり抜ける' },
  { id:'reg.dodge.c', cup:'dodge', breeder:'灯野マドカ', mon:'ホタルビ', species:'Illumine', champ:true, note:'光の残像で相手を惑わす' },

  { id:'reg.hard.1', cup:'hard', breeder:'石田カタシ', mon:'イシガキ', species:'Monol', note:'一歩も下がらない' },
  { id:'reg.hard.2', cup:'hard', breeder:'森永ミドリ', mon:'オオネ', species:'Yggdrasil', note:'根を張ってびくともしない' },
  { id:'reg.hard.3', cup:'hard', breeder:'甘利クリム', mon:'ホイップ姫', species:'MelWhip', note:'やわらかそうで実はかたい' },
  { id:'reg.hard.c', cup:'hard', breeder:'堅田マモル', mon:'フドウ', species:'Monol', champ:true, note:'倒れたところを見た人はいない' },

  { id:'reg.life.1', cup:'life', breeder:'種田ハル', mon:'ネバリ草', species:'Plant', note:'しおれても起き上がる' },
  { id:'reg.life.2', cup:'life', breeder:'霞ミヤビ', mon:'ユラメキ', species:'Oboro', note:'粘り強くかわし続ける' },
  { id:'reg.life.3', cup:'life', breeder:'餅月ツキ', mon:'もちもち大将', species:'Mocchi', note:'何度でも立ち上がる' },
  { id:'reg.life.c', cup:'life', breeder:'根本タエ', mon:'ジュモク', species:'Plant', champ:true, note:'最後まで立っている大ベテラン' },

  { id:'reg.dist0.1', cup:'dist0', breeder:'金剛テツ', mon:'ブチカマシ', species:'Golem', note:'組みついたら離さない' },
  { id:'reg.dist0.2', cup:'dist0', breeder:'抜刀アヤメ', mon:'ハバキリ', species:'Eiki', note:'ふところに飛びこむ' },
  { id:'reg.dist0.3', cup:'dist0', breeder:'柏木モチオ', mon:'もち侍', species:'KenshiMocchi', note:'間合いゼロの剣' },
  { id:'reg.dist0.c', cup:'dist0', breeder:'鬼塚ゲンジ', mon:'ゼロセン', species:'KenshiMocchi', champ:true, note:'零の間合いの主' },

  { id:'reg.dist1.1', cup:'dist1', breeder:'織部アヤ', mon:'ツムギ', species:'Orihime', note:'近くで舞うように戦う' },
  { id:'reg.dist1.2', cup:'dist1', breeder:'影山シノブ', mon:'クナイ', species:'Zan', note:'一歩で間合いを詰める' },
  { id:'reg.dist1.3', cup:'dist1', breeder:'刃鳥ミサキ', mon:'ツバメガエシ', species:'Eiki', note:'返しの技が鋭い' },
  { id:'reg.dist1.c', cup:'dist1', breeder:'夜霧カゲミツ', mon:'シラヌイ', species:'Zan', champ:true, note:'近の間合いで負けなし' },

  { id:'reg.dist2.1', cup:'dist2', breeder:'甘粕ミルク', mon:'クリームパフ', species:'MelWhip', note:'ほどよい距離を保つ' },
  { id:'reg.dist2.2', cup:'dist2', breeder:'柳ユウレイ', mon:'ヒュードロ', species:'Ghost', note:'近づくと消える' },
  { id:'reg.dist2.3', cup:'dist2', breeder:'光岡ネオン', mon:'キラメキ', species:'Illumine', note:'中くらいの距離が得意' },
  { id:'reg.dist2.c', cup:'dist2', breeder:'鈴音ミユ', mon:'ニャンバリ', species:'Mia', champ:true, note:'中の間合いの名手' },

  { id:'reg.dist3.1', cup:'dist3', breeder:'花園ツボミ', mon:'タネボウ', species:'Plant', note:'遠くから種を飛ばす' },
  { id:'reg.dist3.2', cup:'dist3', breeder:'氷室シロ', mon:'フブキ', species:'Snegurochka', note:'遠くから冷気を送る' },
  { id:'reg.dist3.3', cup:'dist3', breeder:'夢見ネムル', mon:'まどろみ', species:'Dreamy', note:'相手を眠りにさそう' },
  { id:'reg.dist3.c', cup:'dist3', breeder:'怪堂クロウ', mon:'オバケダン', species:'Spooky', champ:true, note:'遠の間合いの支配者' },

  { id:'reg.attacker.1', cup:'attacker', breeder:'丸井モチコ', mon:'アンコ', species:'Mocchi', note:'攻めて攻めて攻めまくる' },
  { id:'reg.attacker.2', cup:'attacker', breeder:'目黒ギョロ', mon:'ジロリ', species:'Suezo', note:'すきを見つけたら即攻撃' },
  { id:'reg.attacker.3', cup:'attacker', breeder:'大福マメ', mon:'ちびハム', species:'Ham', note:'小さな体で大きな一撃' },
  { id:'reg.attacker.c', cup:'attacker', breeder:'狐坂ホムラ', mon:'九尾丸', species:'Kyubi', champ:true, note:'炎のような攻めの王者' },

  { id:'reg.tank.1', cup:'tank', breeder:'霧島オボロ', mon:'カスミ', species:'Oboro', note:'受け流しが上手' },
  { id:'reg.tank.2', cup:'tank', breeder:'砂糖ナツ', mon:'シフォン', species:'MelWhip', note:'仲間の前に立つ' },
  { id:'reg.tank.3', cup:'tank', breeder:'岩戸ヒラク', mon:'イワオ', species:'Monol', note:'壁そのもの' },
  { id:'reg.tank.c', cup:'tank', breeder:'大樹ミコト', mon:'セカイジュ', species:'Yggdrasil', champ:true, note:'守りの道をきわめた' },

  { id:'reg.supporter.1', cup:'supporter', breeder:'舟木ノア', mon:'ハコブネ', species:'Ark', note:'仲間を運ぶように支える' },
  { id:'reg.supporter.2', cup:'supporter', breeder:'人魚川ナギ', mon:'ウタカタ', species:'Yaobikuni', note:'歌で流れを変える' },
  { id:'reg.supporter.3', cup:'supporter', breeder:'眠田ユメ', mon:'ふわゆめ', species:'Dreamy', note:'相手のペースを崩す' },
  { id:'reg.supporter.c', cup:'supporter', breeder:'天野ナナセ', mon:'タナバタ', species:'Orihime', champ:true, note:'支える戦い方の第一人者' },

  { id:'reg.healer.1', cup:'healer', breeder:'若葉ミノリ', mon:'ハッパ', species:'Plant', note:'自分で傷を治す' },
  { id:'reg.healer.2', cup:'healer', breeder:'夕霧ヨル', mon:'オボロヅキ', species:'Oboro', note:'ゆっくり回復しながら粘る' },
  { id:'reg.healer.3', cup:'healer', breeder:'雪代マシロ', mon:'コナユキ', species:'Snegurochka', note:'冷たい手で痛みを止める' },
  { id:'reg.healer.c', cup:'healer', breeder:'泉ミズホ', mon:'イヤシノミズ', species:'Undine', champ:true, note:'癒やしの水の使い手' },

  { id:'reg.shadow.1', cup:'shadow', breeder:'虎沢キバ', mon:'ブチ', species:'Tiger', note:'物陰から飛び出す' },
  { id:'reg.shadow.2', cup:'shadow', breeder:'墓守トモシ', mon:'ヨミ', species:'Ghost', note:'影にまぎれる' },
  { id:'reg.shadow.3', cup:'shadow', breeder:'月影ルナ', mon:'ツキアカリ', species:'Illumine', note:'光と影を使い分ける' },
  { id:'reg.shadow.c', cup:'shadow', breeder:'無音ハヤト', mon:'ムソウ', species:'Zan', champ:true, note:'影の道の王者' },

  { id:'reg.spring.1', cup:'spring', breeder:'桜井サクラコ', mon:'ハナビラ', species:'Plant', note:'春になると元気が出る' },
  { id:'reg.spring.2', cup:'spring', breeder:'野原チョウコ', mon:'モンシロ', species:'Pixie', note:'花畑育ち' },
  { id:'reg.spring.3', cup:'spring', breeder:'猫柳ハルカ', mon:'ハルニャン', species:'Mia', note:'日なたぼっこが日課' },
  { id:'reg.spring.c', cup:'spring', breeder:'芽吹ソウタ', mon:'メブキ', species:'Yggdrasil', champ:true, note:'春の大会の顔' },

  { id:'reg.summer.1', cup:'summer', breeder:'渚ウミ', mon:'サザナミ', species:'Undine', note:'夏の海が大好き' },
  { id:'reg.summer.2', cup:'summer', breeder:'日焼ゴロウ', mon:'シマシマ', species:'Tiger', note:'暑さに強い' },
  { id:'reg.summer.3', cup:'summer', breeder:'花火ヤスオ', mon:'ドドン', species:'Suezo', note:'夏祭りの人気者' },
  { id:'reg.summer.c', cup:'summer', breeder:'磯辺サヨ', mon:'ミナソコ', species:'Yaobikuni', champ:true, note:'夏の大会の顔' },

  { id:'reg.autumn.1', cup:'autumn', breeder:'紅葉カエデ', mon:'モミジ', species:'Kyubi', note:'落ち葉の中で舞う' },
  { id:'reg.autumn.2', cup:'autumn', breeder:'月見ススキ', mon:'オツキミ', species:'Oboro', note:'秋の夜長が好き' },
  { id:'reg.autumn.3', cup:'autumn', breeder:'灯籠トモ', mon:'ヒトダマ', species:'Ghost', note:'秋祭りに出没する' },
  { id:'reg.autumn.c', cup:'autumn', breeder:'天川オリエ', mon:'アマノガワ', species:'Orihime', champ:true, note:'秋の大会の顔' },

  { id:'reg.winter.1', cup:'winter', breeder:'冬木コオリ', mon:'ツララ', species:'Snegurochka', note:'寒いほど調子が上がる' },
  { id:'reg.winter.2', cup:'winter', breeder:'雪村カマクラ', mon:'ユキダルマ', species:'Monol', note:'雪の上でも動じない' },
  { id:'reg.winter.3', cup:'winter', breeder:'夜長ヒイラギ', mon:'ブルブル', species:'Spooky', note:'冬の夜にあらわれる' },
  { id:'reg.winter.c', cup:'winter', breeder:'白銀ミフユ', mon:'ギンセカイ', species:'Snegurochka', champ:true, note:'冬の大会の顔' },

  { id:'reg.normal.1', cup:'normal', breeder:'団子坂タレ', mon:'みたらし丸', species:'Mitarashi', note:'あまからい戦い方' },
  { id:'reg.normal.2', cup:'normal', breeder:'小麦パン', mon:'もぐもぐ', species:'Ham', note:'食いしんぼう' },
  { id:'reg.normal.3', cup:'normal', breeder:'帆村ミナト', mon:'コウカイ', species:'Ark', note:'どこへでも出かける' },
  { id:'reg.normal.c', cup:'normal', breeder:'町田ツネオ', mon:'いつものモチ', species:'Mocchi', champ:true, note:'どの大会にも顔を出す名物' },

  { id:'reg.herosummer.1', cup:'herosummer', breeder:'武蔵野ガイ', mon:'ダイモンジ', species:'Golem', note:'夏の大舞台の常連' },
  { id:'reg.herosummer.2', cup:'herosummer', breeder:'焔ミコ', mon:'カグラ', species:'Kyubi', note:'舞台映えする戦い方' },
  { id:'reg.herosummer.3', cup:'herosummer', breeder:'星宮カナタ', mon:'ホシアカリ', species:'Orihime', note:'星に願いをかける' },
  { id:'reg.herosummer.c', cup:'herosummer', breeder:'黒鉄リュウガ', mon:'ヤミノツバサ', species:'Iblis', champ:true, note:'夏のヒーロー記念の王者' },

  { id:'reg.herowinter.1', cup:'herowinter', breeder:'森羅シン', mon:'ミズホノキ', species:'Yggdrasil', note:'冬でも青々としている' },
  { id:'reg.herowinter.2', cup:'herowinter', breeder:'刀祢ジュウゾウ', mon:'ムラクモ', species:'Eiki', note:'一年の締めに強い' },
  { id:'reg.herowinter.3', cup:'herowinter', breeder:'雪華セツナ', mon:'スノウドロップ', species:'Snegurochka', note:'静かな冬の女王' },
  { id:'reg.herowinter.c', cup:'herowinter', breeder:'不動イワオ', mon:'テンジクボウ', species:'Golem', champ:true, note:'冬のヒーロー記念の王者' },

  { id:'reg.peak.1', cup:'peak', breeder:'高嶺ソラ', mon:'イタダキ', species:'Kyubi', note:'1回戦の壁' },
  { id:'reg.peak.2', cup:'peak', breeder:'雲井アオイ', mon:'クモノウエ', species:'Yggdrasil', note:'準決勝で待つ' },
  { id:'reg.peak.3', cup:'peak', breeder:'天城タケル', mon:'テンカ', species:'Golem', note:'決勝までは負けない' },
  { id:'reg.peak.c', cup:'peak', breeder:'勇崎ヒイロ', mon:'イチバンボシ', species:'Orihime', champ:true, note:'ヒーローズファイナルの決勝で待つ' },

  { id:'reg.scmua.1', cup:'scmua', breeder:'笑原ニコ', mon:'ニコニコ', species:'Pixie', note:'いつも笑っている' },
  { id:'reg.scmua.2', cup:'scmua', breeder:'陽向ポカ', mon:'ポカポカ', species:'Mia', note:'まわりを明るくする' },
  { id:'reg.scmua.3', cup:'scmua', breeder:'楽田ユウ', mon:'ルンルン', species:'Dreamy', note:'楽しそうに戦う' },
  { id:'reg.scmua.c', cup:'scmua', breeder:'福笑フク', mon:'ニッコリ大福', species:'Mocchi', champ:true, note:'笑顔の大会の名物王者' },

  { id:'reg.scatsu.1', cup:'scatsu', breeder:'挑戸タカシ', mon:'ノボリリュウ', species:'Eiki', note:'上の星から下りてきた' },
  { id:'reg.scatsu.2', cup:'scatsu', breeder:'闇沢クロエ', mon:'ハテナキヨル', species:'Iblis', note:'格上の貫禄' },
  { id:'reg.scatsu.3', cup:'scatsu', breeder:'朱雀アカネ', mon:'ベニホムラ', species:'Kyubi', note:'挑戦者をはね返す' },
  { id:'reg.scatsu.c', cup:'scatsu', breeder:'峰ゴウキ', mon:'ハガネヤマ', species:'Golem', champ:true, note:'格上への挑戦の門番' },
]);

if (typeof module !== 'undefined') module.exports = { MONSUC_REGULAR_CUPS, MONSUC_REGULARS };
// 画面(開いたときにだけ読む)は window から読む(const はトップレベルでも window に載らないため・2026-11-12 回3)
if (typeof window !== 'undefined') { window.MONSUC_REGULARS = MONSUC_REGULARS; window.MONSUC_REGULAR_CUPS = MONSUC_REGULAR_CUPS; }

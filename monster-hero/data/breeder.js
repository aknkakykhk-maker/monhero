// ==================== 教えカード用アイコン ====================
// TEACHING_CARDSのicon欄(教えカードの表示アイコン)として使用。モンスターとは無関係。
const ORYO_FACE_ICON = "images/breeder-icons/oryo.png?v=a5ec60be5094";
const DRA_FACE_ICON = "images/breeder-icons/dra.png?v=423f4119d101";
const MYARU_FACE_ICON = "images/breeder-icons/myaru.png?v=88a5201c9b51";
const ATSU_FACE_ICON = "images/breeder-icons/atsu.png?v=3df879752dee";
const MUA_FACE_ICON = "images/breeder-icons/mua.png?v=7b9524560573";
const MOCCHI_PET_ICON = "images/breeder-icons/mocchi-pet.png?v=b0e61758fca4";
const GEZUDERO_ICON = "images/breeder-icons/gezudero.png?v=d79a38ee0679";
const MELOPANMAN_ICON = "images/breeder-icons/melopanman.png?v=1eba631f1832";
const CADMIUM_FACE_ICON = "images/breeder-icons/cadmium.png?v=bfaf6e5ecfad";

// ==================== モンスター円盤石アイコン ====================
// DISC_STONE_BASE: 円盤石の土台画像(全モンスター共通)。作り方の詳細はBREEDER_MARKET_ITEMS手前のコメント参照。
const DISC_STONE_BASE = "images/disc-icons/stone-base.png?v=fda820864674";
const ZAN_DISC_ICON = "images/disc-icons/zan.png?v=168e92b11f79";
const MITARASHI_DISC_ICON = "images/disc-icons/mitarashi.png?v=4fe8d8d99525";
const ARK_DISC_ICON = "images/disc-icons/ark.png?v=1c124027f057";
const IBLIS_DISC_ICON = "images/disc-icons/iblis.png?v=8202f75a06f1";

const BREEDER_EVO_NAMES = {
  oryo: ["おりょうの力", "おりょうの気合", "おりょうの憤怒"],
  dra: ["ドラの緑膝", "ドラの黒膝臭", "ドラの毒膝地獄"],
  cadmium: ["かどみうむの計算", "かどみうむの理論", "かどみうむの叡智"],
  mua: ["みゅあの愛", "みゅあの深愛", "みゅあの慈愛"],
  atsu: ["あつの挑発", "あつの暴言", "あつの怒号"],
  myaru: ["みゃるの薬", "みゃるの怪薬", "みゃるの禁薬"]
};

// かどみうむ(guts_buff)の進化段階ごとの効果量。
// 効果が「自動回復」と「上限アップ」の2系統×ライフ/ガッツの4項目あり、
// 実装側に条件分岐で散らばっていると表示との食い違いが起きやすいため、
// ここに1か所でまとめて持たせ、効果の適用も説明文の生成もこの値を参照する。
//   計算: 自動ガッツ回復0.5%・ガッツ上限3%
//   理論: 自動ライフ/ガッツ回復0.5%・ライフ/ガッツ上限5%
//   叡智: 自動ライフ/ガッツ回復1%・ライフ/ガッツ上限7%
const CADMIUM_TIERS = [
  { autoHp:0,     autoGuts:0.005, hpLimit:0,    gutsLimit:0.03 },
  { autoHp:0.005, autoGuts:0.005, hpLimit:0.05, gutsLimit:0.05 },
  { autoHp:0.01,  autoGuts:0.01,  hpLimit:0.07, gutsLimit:0.07 },
];

const TEACHING_CARDS = [
  { id:'oryo',    baseName:"おりょうの力",    icon:ORYO_FACE_ICON,    type:'buff',   subType:'atk_buff',    baseValue:0.1, step:0.1,  desc:"攻撃アップ",   evoLevel:0, guts:20 },
  { id:'dra',     baseName:"ドラの緑膝",      icon:DRA_FACE_ICON,     type:'buff',   subType:'dmg_cut_buff', baseValue:0.03,step:0.03, desc:"被ダメージダウン",     evoLevel:0, guts:20 },
  { id:'cadmium', baseName:"かどみうむの計算", icon:CADMIUM_FACE_ICON, type:'buff',   subType:'guts_buff',   baseValue:1.3, step:0.2,  desc:"自動回復・上限アップ",   evoLevel:0, guts:20 },
  { id:'mua',     baseName:"みゅあの愛",      icon:MUA_FACE_ICON,     type:'heal',   subType:'heal_mua',    baseValue:0.5, step:0.2,  desc:"回復・能力永続アップ",   evoLevel:0, guts:20 },
  { id:'atsu',    baseName:"あつの挑発",      icon:ATSU_FACE_ICON,    type:'debuff', subType:'stun_atsu',   baseValue:1.5, step:1.5,  desc:"敵の行動を無効・攻撃", evoLevel:0, guts:20 },
  { id:'myaru',   baseName:"みゃるの薬",      icon:MYARU_FACE_ICON,   type:'buff',   subType:'buff_myaru',  baseValue:2.0, step:0.5, selfDmg:0.5, dmgStep:0.1, desc:"次ターン攻撃2倍・自傷", evoLevel:0, guts:20 }
];

// 初期から無料で使えるブリーダーカード(教えカード)のid一覧(固定)。
// 今後TEACHING_CARDSに新規カードを追加しても、ここに含めない限り
// 自動では解放されず、ブリーダーマーケットで購入して解放する対象になる。
const STARTER_TEACHING_IDS = ['oryo','dra','cadmium','mua','atsu','myaru'];

// ブリーダーマーケット: ブリーダーレベルアップで得たポイントで購入できるアイテム
// type:'icon' はプロフィールアイコン、type:'disc' はモンスターの円盤石(購入でそのモンスターが解放される)、
// type:'breeder' はブリーダーカードの解放アイテム。idはicon以外の場合、解放対象(モンスター/カード)のidと一致させる。
// type:'item' はマスモンに使う消耗アイテム(ダイヤで購入・何度でも買える。所持数はownedItemsで管理し、
// マスモン詳細画面から使用する)。iconの代わりにemojiを指定してよい。
// 円盤石のiconは必ずDISC_STONE_BASE(円盤石の土台画像、模様入り)を土台にして、その上に
// 新モンスターの全身を重ねて作る(土台の模様を消したり塗りつぶしたりしない)。他モンスターとキャラの
// 縦位置(センタリング)が揃うように配置する。
// 新モンスター実装時は、プロフィールアイコン選択用の顔アイコン(type:'icon')と円盤石(type:'disc')を
// 必ず同時に追加し、両方とも available:false にする(正式実装まで同じ近日公開予定タイミングで揃える)。
// 【実装フロー】(1)全身アイコンと顔アイコンをまず作ってユーザーに提示、OKが出るまで確定しない→
// (2)OKが出たら円盤石(DISC_STONE_BASEに全身を重ねたもの)を作ってユーザーに提示、OKが出るまで確定しない→
// (3)OKが出たらBREEDER_MARKET_ITEMSに追加。
// 本体(ALL_PLAYER_MONSTERS)の実装は別途行う。

// 助手みゅあの顔アイコンを、プロフィール画像としても選べるようにする。
// 画像は data/assistants.js が吹き出しに使っているものと同じ(images/assistant/face/)。
// ただし index.html では breeder.js のほうが先に読み込まれるため、assistants.js の
// 関数は使えない。ファイル名を変えるときは両方を直すこと。
//
// 既存の「みゅあのアイコン」(id:'mua') は別の絵で、購入済みの人がいるのでそのまま残す。
// こちらは id を myua_* に分けているので、既存の保存データには影響しない。
const MYUA_ICON_EXPRESSIONS = [
  ['normal',   'ふつう'],
  ['happy',    '笑顔'],
  ['wink',     'ウィンク'],
  ['excited',  'ごきげん'],
  ['surprise', 'びっくり'],
  ['troubled', '困り顔'],
  ['angry',    'おこ'],
  ['crying',   'なみだ'],
];
const MYUA_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `myua_${key}`,
  name: `みゅあ（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/myua_${key}.PNG`,
  cost: 1,
}));

const BREEDER_MARKET_ITEMS = [
  // プロフィール用の追加画像は助手画像と分け、images/breeder-icons/ に置く。
  { id:'kiki_icon', name:"ききのアイコン", type:'icon', icon:'images/breeder-icons/kiki.PNG?v=35362d7b6e3e', cost:1 },
  { id:'oryo',    name:"おりょうのアイコン",     type:'icon', icon:ORYO_FACE_ICON,    cost:1 },
  { id:'dra',     name:"ドラのアイコン",        type:'icon', icon:DRA_FACE_ICON,     cost:1 },
  { id:'cadmium', name:"かどみうむのアイコン",   type:'icon', icon:CADMIUM_FACE_ICON, cost:1 },
  { id:'mua',     name:"みゅあのアイコン",      type:'icon', icon:MUA_FACE_ICON,     cost:1 },
  { id:'atsu',    name:"あつのアイコン",        type:'icon', icon:ATSU_FACE_ICON,    cost:1 },
  { id:'myaru',   name:"みゃるのアイコン",      type:'icon', icon:MYARU_FACE_ICON,   cost:1 },
  { id:'mocchi_pet', name:"モッチー_2のアイコン",  type:'icon', icon:MOCCHI_PET_ICON,   cost:1 },
  { id:'gezudero', name:"ゲズデロのアイコン",    type:'icon', icon:GEZUDERO_ICON,     cost:1 },
  { id:'melopanman', name:"メロぱんまんのアイコン", type:'icon', icon:MELOPANMAN_ICON,   cost:1 },
  { id:'zan_icon', name:"ザンのアイコン", type:'icon', icon:ZAN_FACE_ICON, cost:1 },
  { id:'Zan', name:"ザンの円盤石", type:'disc', icon:ZAN_DISC_ICON, cost:1500 },
  { id:'mitarashi_icon', name:"ミタラシのアイコン", type:'icon', icon:MITARASHI_FACE_ICON, cost:1 },
  { id:'Mitarashi', name:"ミタラシの円盤石", type:'disc', icon:MITARASHI_DISC_ICON, cost:500 },
  { id:'ark_icon', name:"アークのアイコン", type:'icon', icon:ARK_FACE_ICON, cost:1 },
  { id:'Ark', name:"アークの円盤石", type:'disc', icon:ARK_DISC_ICON, cost:1500 },
  { id:'iblis_icon', name:"イブリースのアイコン", type:'icon', icon:IBLIS_FACE_ICON, cost:1 },
  { id:'Iblis', name:"イブリースの円盤石", type:'disc', icon:IBLIS_DISC_ICON, cost:1500 },
  { id:'snegurochka_icon', name:"スネグーラチカのアイコン", type:'icon', icon:'images/monsters/SNEGUROCHKA.PNG?v=21ee3cd2a444', cost:1 },
  { id:'snegurochka_awakened_icon', name:"スネグーラチカ（覚醒）のアイコン", type:'icon', icon:'images/monsters/SNEGUROCHKA_AWAKENED.PNG?v=3a71bfe44e3d', cost:1 },
  { id:'bond_reset_scroll', name:"絆ポイントリセットの書", type:'item', emoji:"📜", cost:500, desc:"マスモンに使うと、そのマスモンが使用した強化ポイント(間合い適性・ステータス強化)がすべて未使用に戻る。絆レベル・絆経験値はそのまま。" },
  // 説明は実際の機能に合わせて更新すること。導入時は6色から全身を1色に変えるだけだったが、
  // その後アイコンごとの部位分け・プリセット27色・カスタムカラーに対応している
  { id:'dye_mock', name:"染色もどき", type:'item', emoji:"🎨", cost:500, desc:"マスモンに使うと、見た目の色を変えられる。モンスターによっては体・目・口などの部位ごとに別々の色を選べる。プリセット27色に加えて、色相・鮮やかさ・明るさを自分で決めるカスタムカラーも使える。" },
  // bondXp を持つアイテムは「マスモンに絆経験値を与える」もの。まとめて使えるので、
  // 使う個数を決める画面(何個でレベルがいくつ上がるか)が出る
  { id:'training_ticket', name:"トレーニングチケット", type:'item', emoji:"🎫", cost:100, bondXp:15, desc:"マスモンに使うと絆経験値を15もらえる。まとめて使えるので、使う個数に応じて絆レベルがどこまで上がるかを確かめながら使える。" },
  { id:'training_ticket_l', name:"修行チケット", type:'item', emoji:"🎟️", cost:1000, bondXp:150, desc:"マスモンに使うと絆経験値を150もらえる。トレーニングチケット10枚ぶん。まとめて使えるので、使う個数に応じて絆レベルがどこまで上がるかを確かめながら使える。" },
  // usage:'battleSkip' はマスモンに使うアイテムではなく、バトルの難易度選択から使う消耗アイテム。
  // skipDifficulty はそのチケットで飛ばせる難易度(DIFFICULTY_SETTINGSのキー)。
  // 1枚消費してボス撃破まで到達したのと同じ絆経験値・ブリーダー経験値・ダイヤを受け取る。
  // スコア・ランキング・クリア回数・マスモン登録は対象外(通常のクリアとは別扱い)。
  //
  // 販売価格は序=3300 / 破=5900 / 急=8500。報酬計算とは独立した固定価格。
  { id:'skip_ticket_jo',  name:"スキップチケット・序", type:'item', emoji:"⏩", cost:3300, usage:'battleSkip', skipDifficulty:'Normal', desc:"バトルのNormalで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_ha',  name:"スキップチケット・破", type:'item', emoji:"⏭️", cost:5900, usage:'battleSkip', skipDifficulty:'Hard',   desc:"バトルのHardで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_kyu', name:"スキップチケット・急", type:'item', emoji:"⚡", cost:8500, usage:'battleSkip', skipDifficulty:'Expert', desc:"バトルのExpertで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  // 限界突破専用のアイテム。マーケットでは売らない(shop:false)ので、
  // 入手はチャレンジモード・クイックモードのクリア報酬だけ。
  // 必要数は限界突破1回ごとに増える(1回目10個・以降+5個)。計算は game-system.jsx の
  // breakthroughItemCost が正本で、ここには説明だけを書く。
  { id:'rainbow_psyche', name:"虹のプシュケー", type:'item', emoji:"🌈", cost:0, shop:false, usage:'breakthrough',
    desc:"マスモンの限界突破に使う。必要数は1回目が10個で、限界突破1回ごとに5個ずつ増える(2回目15個、3回目20個…)。チャレンジモード・クイックモードをクリアすると、選んだ難易度に応じてもらえる。" },
  // 助手みゅあの表情アイコン(8種)。アイコンタブの最後に並ぶ
  ...MYUA_MARKET_ICONS
];
// 難易度キー → その難易度で使えるスキップチケットのid
const SKIP_TICKET_BY_DIFFICULTY = Object.freeze(Object.fromEntries(
  BREEDER_MARKET_ITEMS.filter(item => item.usage === 'battleSkip').map(item => [item.skipDifficulty, item.id])
));

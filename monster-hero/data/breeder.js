// ==================== 教えカード用アイコン ====================
// TEACHING_CARDSのicon欄(教えカードの表示アイコン)として使用。モンスターとは無関係。
// ニコラオ(旧おりょう)。2026-09-18にキャラクターを差し替えた。
// id は 'oryo' のまま据え置く。持ち込み中のアシストカード(mh_teaching_roster)と、
// 攻撃バフの種別キー(ゴーレムの固有技も同じキーを使う)がこのIDで保存されているため。
const NICOLAO_FACE_ICON = "images/breeder-icons/nicolao.png?v=fc5a1318af2d";
const DRA_FACE_ICON = "images/breeder-icons/dra.png?v=423f4119d101";
const MYARU_FACE_ICON = "images/breeder-icons/myaru.png?v=88a5201c9b51";
const ATSU_FACE_ICON = "images/breeder-icons/atsu.png?v=3df879752dee";
const MUA_FACE_ICON = "images/breeder-icons/mua.png?v=7b9524560573";
const MOCCHI_PET_ICON = "images/breeder-icons/mocchi-pet.png?v=b0e61758fca4";
const GEZUDERO_ICON = "images/breeder-icons/gezudero.png?v=d79a38ee0679";
const MELOPANMAN_ICON = "images/breeder-icons/melopanman.png?v=1eba631f1832";
const CADMIUM_FACE_ICON = "images/breeder-icons/cadmium.png?v=bfaf6e5ecfad";
const KIKI_FACE_ICON = "images/breeder-icons/kiki.PNG?v=35362d7b6e3e";
const POLTZ_FACE_ICON = "images/breeder-icons/poltz.PNG?v=a17ca7fa2869";
// マーケットのアイコン商品だけで使う立ち絵。
// 本体の絵(images-ally.js の SNEGUROCHKA_IMG)とは別ファイルなので、ここで持つ
const SNEGUROCHKA_MARKET_ICON = "images/monsters/SNEGUROCHKA.PNG?v=54c9540841fe";
const SNEGUROCHKA_AWAKENED_MARKET_ICON = "images/monsters/SNEGUROCHKA_AWAKENED.PNG?v=52c8eda68793";

// ==================== モンスター円盤石アイコン ====================
// DISC_STONE_BASE: 円盤石の土台画像(全モンスター共通)。作り方の詳細はBREEDER_MARKET_ITEMS手前のコメント参照。
const DISC_STONE_BASE = "images/disc-icons/disc-stone-base.PNG?v=2cf55b47492a";
const ZAN_DISC_ICON = "images/disc-icons/zan.png?v=dd757e49f636";
const MITARASHI_DISC_ICON = "images/disc-icons/mitarashi.png?v=39933ff87253";
const ARK_DISC_ICON = "images/disc-icons/ark.png?v=55e7c1c5d1e9";
const IBLIS_DISC_ICON = "images/disc-icons/iblis.png?v=4d6d7f7f7234";
const SNEGUROCHKA_DISC_ICON = "images/disc-icons/snegurochka-disc.PNG?v=5404026ef24a";
const UNDINE_DISC_ICON = "images/disc-icons/undine-disc.PNG?v=3829b6f730f5";
const YAOBIKUNI_DISC_ICON = "images/disc-icons/yaobikuni-disc.PNG?v=99f34b0b4228";
const PLANT_DISC_ICON = "images/disc-icons/plant-disc.PNG?v=23d828f69f14";
const MIA_DISC_ICON = "images/disc-icons/mia-disc.PNG?v=da09c07c8624";
const PANDORA_DISC_ICON = "images/disc-icons/pandora-disc.PNG?v=adee72203d0a";
const EIKI_DISC_ICON = "images/disc-icons/eiki-disc.PNG?v=0b8dca1d94c0";
// 剣士モッチーの円盤石。絵は node tools/image/make-disc-icon.js が共通の土台へ重ねて作ったもの
const KENSHI_MOCCHI_DISC_ICON = "images/disc-icons/kenshi-mocchi-disc.PNG?v=57ec53a942c7";

const BREEDER_EVO_NAMES = {
  oryo: ["ニコラオの力", "ニコラオの気合", "ニコラオの憤怒"],
  dra: ["ドラの緑膝", "ドラの黒膝臭", "ドラの毒膝地獄"],
  cadmium: ["かどみうむの計算", "かどみうむの理論", "かどみうむの叡智"],
  mua: ["みゅあの愛", "みゅあの深愛", "みゅあの慈愛"],
  atsu: ["あつの挑発", "あつの暴言", "あつの怒号"],
  myaru: ["みゃるの薬", "みゃるの怪薬", "みゃるの禁薬"],
  kiki: ["ききの応援", "ききの本気", "ききの全力全開"],
  meloso: ["メロソの解析", "メロソの予測", "メロソの最適解"],
  poltz: ["ポルツの弁当", "ポルツの挫折", "ポルツの目覚め"]
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

// ポルツ(buff_poltz)の進化段階ごとの効果量。かどみうむと同じく、効果の適用も説明文の生成も
// この表だけを見るようにして、実装と表示の食い違いを防ぐ。
//   charges     : カードを使ったあと、待機して発動できる敵攻撃の回数(Lvが上がるほど増える)
//   healGuts    : 1回発動するごとに回復する、実効最大ガッツに対する割合
//   gutsRecover : 1回発動するごとに加算する自動ガッツ回復(バトル中永続)
//   atk         : 1回発動するごとに加算する攻撃アップ(バトル中永続)。Lv3だけ
// 累計は charges 倍になる: 弁当=回復1%、挫折=回復5%、目覚め=回復10.5%・攻撃30%
const POLTZ_TIERS = [
  { charges:1, healGuts:0.2, gutsRecover:0.01,  atk:0 },
  { charges:2, healGuts:0.2, gutsRecover:0.025, atk:0 },
  { charges:3, healGuts:0.2, gutsRecover:0.035, atk:0.10 },
];

const TEACHING_CARDS = [
  { id:'oryo',    baseName:"ニコラオの力",    icon:NICOLAO_FACE_ICON,    type:'buff',   subType:'atk_buff',    baseValue:0.1, step:0.1,  desc:"攻撃アップ",   evoLevel:0, guts:20 },
  { id:'dra',     baseName:"ドラの緑膝",      icon:DRA_FACE_ICON,     type:'buff',   subType:'dmg_cut_buff', baseValue:0.03,step:0.03, desc:"被ダメージダウン",     evoLevel:0, guts:20 },
  { id:'cadmium', baseName:"かどみうむの計算", icon:CADMIUM_FACE_ICON, type:'buff',   subType:'guts_buff',   baseValue:1.3, step:0.2,  desc:"自動回復・上限アップ",   evoLevel:0, guts:20 },
  { id:'mua',     baseName:"みゅあの愛",      icon:MUA_FACE_ICON,     type:'heal',   subType:'heal_mua',    baseValue:0.5, step:0.2,  desc:"回復・能力永続アップ",   evoLevel:0, guts:20 },
  { id:'atsu',    baseName:"あつの挑発",      icon:ATSU_FACE_ICON,     type:'debuff', subType:'stun_atsu',   baseValue:1.5, step:1.5,  desc:"敵の行動を無効・攻撃", evoLevel:0, guts:20 },
  { id:'myaru',   baseName:"みゃるの薬",      icon:MYARU_FACE_ICON,   type:'buff',   subType:'buff_myaru',  baseValue:2.0, step:0.5, selfDmg:0.5, dmgStep:0.1, desc:"次ターン攻撃2倍・自傷", evoLevel:0, guts:20 },
  { id:'kiki',    baseName:"ききの応援",      icon:KIKI_FACE_ICON,    type:'buff',   subType:'buff_kiki',   baseValue:0.03, step:0.02, desc:"次ターンからカード上限アップ・全体連撃", evoLevel:0, guts:20 },
  // メロソの回復量はレベルで変わらない(強化で増えるのは次ターンの予約効果)。
  // step が無いと強化時の baseValue+step が NaN になるため、増えない意味で 0 を明示する
  { id:'meloso',  baseName:"メロソの解析",      icon:MELOPANMAN_ICON,   type:'heal',   subType:'heal_guard_meloso', baseValue:0.3, step:0,  desc:"緊急回復相当・現在ガード・次ターン予約", evoLevel:0, guts:20 },
  // ポルツの効果量はレベルで変わる部分をすべて POLTZ_TIERS に置いてあるので、
  // baseValue は1回あたりの回復割合(表示・検査用)だけを持ち、step は増えない意味の 0 を明示する
  { id:'poltz',   baseName:"ポルツの弁当",      icon:POLTZ_FACE_ICON,   type:'buff',   subType:'buff_poltz', baseValue:0.2, step:0,  desc:"敵の攻撃を受けるたびガッツ回復・自動ガッツ回復アップ", evoLevel:0, guts:20 }
];

// 初期から無料で使えるアシストカード(教えカード)のid一覧(固定)。
// 今後TEACHING_CARDSに新規カードを追加しても、ここに含めない限り
// 自動では解放されず、ブリーダーマーケットで購入して解放する対象になる。
const STARTER_TEACHING_IDS = ['oryo','dra','cadmium','mua','atsu','myaru'];

// バトルへ持ち込めるアシストカードの枚数。**ちょうどこの枚数**を選ぶ。
// これまでは STARTER_TEACHING_IDS.length を上限として使い回していたが、
// 「最初から持っているカードの枚数」と「持ち込める枚数」は別物なので独立させた。
// (2026-09-05・ユーザー指摘「6枚しか編成出来ないのに9枚編成になってる」)
const TEACHING_ROSTER_SIZE = 6;

// 編成の保存値を読むときは必ずここを通す。
// 保存が無い人の既定値を「解放済みカード全部」にしていたため、マーケットでカードを
// 買って解放が7枚以上になると編成もその枚数になり、バトルの手札が溢れていた。
// 解放していないカード・重複・余りを落として、常にちょうど TEACHING_ROSTER_SIZE 枚にする。
const normalizeTeachingRoster = (saved, unlocked) => {
  const available = Array.isArray(unlocked) && unlocked.length ? unlocked : STARTER_TEACHING_IDS;
  const source = Array.isArray(saved) ? saved : [];
  const picked = [];
  const take = (id) => {
    if (picked.length >= TEACHING_ROSTER_SIZE) return;
    if (typeof id !== 'string' || !id) return;
    if (!available.includes(id)) return;   // 解放していないカードは持ち込めない
    if (picked.includes(id)) return;       // 同じカードを二重に持たない
    picked.push(id);
  };
  // 保存されている並びを優先する。プレイヤーが選んだ順は変えない
  for (const id of source) take(id);
  // 足りないぶんは解放済みから前から補う(保存が空・壊れている場合の保険)
  for (const id of available) take(id);
  return picked;
};

// ブリーダーマーケット: ブリーダーレベルアップで得たポイントで購入できるアイテム
// type:'icon' はプロフィールアイコン、type:'disc' はモンスターの円盤石(購入でそのモンスターが解放される)、
// type:'assist' はアシストカードの解放アイテム。idはicon以外の場合、解放対象(モンスター/カード)のidと一致させる。
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

// 助手ききの顔アイコンも、みゅあと同じ仕様(8表情・各1pt)でプロフィール画像として選べるようにする。
// 表情の並び・ラベルはみゅあと共通(MYUA_ICON_EXPRESSIONS)のものをそのまま使う。
// 既存の「ききのアイコン」(id:'kiki_icon', images/breeder-icons/kiki.PNG)は別の絵で、
// 購入済みの人がいるのでそのまま残す。こちらは id を kiki_* に分けているので影響しない。
const KIKI_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `kiki_${key}`,
  name: `きき（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/kiki_${key}.PNG`,
  cost: 1,
}));

// 助手ももすけの顔アイコンも、みゅあ・ききと同じ仕様(8表情・各1pt)で並べる。
// 画像は吹き出しに使っているもの(images/assistant/face/)をそのまま使い、
// マーケット用に別のファイルを作らない(同じ絵を二重に配信しないため)。
const MOMOSUKE_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `momosuke_${key}`,
  name: `ももすけ（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/momosuke_${key}.PNG`,
  cost: 1,
}));

const BREEDER_MARKET_ITEMS = [
  // プロフィール用の追加画像は助手画像と分け、images/breeder-icons/ に置く。
  { id:'kiki_icon', name:"ききのアイコン", type:'icon', icon:KIKI_FACE_ICON, cost:1 },
  { id:'kiki', name:"アシストカード「きき」", type:'assist', icon:KIKI_FACE_ICON, cost:1500, desc:"次ターンから使用可能カード枚数+1・バトル中永続で全体連撃を強化" },
  { id:'meloso', name:"アシストカード「メロソ」", type:'assist', icon:MELOPANMAN_ICON, cost:1500, desc:"緊急回復相当＋現在ガード。複数枚使用で次ターンを強化" },
  { id:'poltz', name:"アシストカード「ポルツ」", type:'assist', icon:POLTZ_FACE_ICON, cost:1500, desc:"敵の攻撃を受けるたびガッツ回復・自動ガッツ回復アップ（Lv3は攻撃アップも）" },
  { id:'oryo',    name:"ニコラオのアイコン",     type:'icon', icon:NICOLAO_FACE_ICON, cost:1 },
  { id:'dra',     name:"ドラのアイコン",        type:'icon', icon:DRA_FACE_ICON,     cost:1 },
  { id:'cadmium', name:"かどみうむのアイコン",   type:'icon', icon:CADMIUM_FACE_ICON, cost:1 },
  { id:'mua',     name:"みゅあのアイコン",      type:'icon', icon:MUA_FACE_ICON,     cost:1 },
  { id:'atsu',    name:"あつのアイコン",        type:'icon', icon:ATSU_FACE_ICON,    cost:1 },
  { id:'myaru',   name:"みゃるのアイコン",      type:'icon', icon:MYARU_FACE_ICON,   cost:1 },
  { id:'mocchi_pet', name:"モッチー_2のアイコン",  type:'icon', icon:MOCCHI_PET_ICON,   cost:1 },
  { id:'gezudero', name:"ゲズデロのアイコン",    type:'icon', icon:GEZUDERO_ICON,     cost:1 },
  { id:'melopanman', name:"メロぱんまんのアイコン", type:'icon', icon:MELOPANMAN_ICON,   cost:1 },
  // ポルツのアイコン。カードと同じ絵を使うので、id を分けて両方を並べられるようにしている
  // (きき/kiki_icon と同じ作り)。顔が中央にある正方形の絵なので寄せ調整は不要
  { id:'poltz_icon', name:"ポルツのアイコン",      type:'icon', icon:POLTZ_FACE_ICON,   cost:1 },
  { id:'zan_icon', name:"ザンのアイコン", type:'icon', icon:ZAN_FACE_ICON, cost:1 },
  { id:'Zan', name:"ザンの円盤石", type:'disc', icon:ZAN_DISC_ICON, cost:1500 },
  { id:'mitarashi_icon', name:"ミタラシのアイコン", type:'icon', icon:MITARASHI_FACE_ICON, cost:1 },
  { id:'Mitarashi', name:"ミタラシの円盤石", type:'disc', icon:MITARASHI_DISC_ICON, cost:500 },
  { id:'ark_icon', name:"アークのアイコン", type:'icon', icon:ARK_FACE_ICON, cost:1 },
  { id:'Ark', name:"アークの円盤石", type:'disc', icon:ARK_DISC_ICON, cost:1500 },
  { id:'iblis_icon', name:"イブリースのアイコン", type:'icon', icon:IBLIS_FACE_ICON, cost:1 },
  { id:'Iblis', name:"イブリースの円盤石", type:'disc', icon:IBLIS_DISC_ICON, cost:1500 },
  { id:'snegurochka_icon', name:"スネグーラチカのアイコン", type:'icon', icon:SNEGUROCHKA_MARKET_ICON, cost:1 },
  { id:'snegurochka_awakened_icon', name:"スネグーラチカ（覚醒）のアイコン", type:'icon', icon:SNEGUROCHKA_AWAKENED_MARKET_ICON, cost:1 },
  { id:'Snegurochka', name:"スネグーラチカの円盤石", type:'disc', icon:SNEGUROCHKA_DISC_ICON, cost:1500 },
  // ウンディーネ。本人アイコン・円盤石アイコン・解放用の円盤石の3商品。
  // アイコンは立ち絵/円盤石の絵をそのまま使い、丸い枠での見え方は
  // MARKET_PROFILE_ICON_STYLES の scale/x/y で寄せる(画像は複製しない)
  // 本人アイコンは立ち絵ではなく顔クロップ(UNDINE_FACE_ICON)を使う。立ち絵は尾ひれまで
  // 入っていて頭が小さく写っており、丸枠でどう寄せても「顔が小さい」か「耳が切れる」の
  // どちらかにしかならなかった(2026-09-19)。エイキ・剣士モッチーと同じ扱い。
  { id:'undine_icon', name:"ウンディーネのアイコン", type:'icon', icon:UNDINE_FACE_ICON, cost:1 },
  { id:'undine_disc_icon', name:"ウンディーネの円盤石アイコン", type:'icon', icon:UNDINE_DISC_ICON, cost:1 },
  { id:'Undine', name:"ウンディーネの円盤石", type:'disc', icon:UNDINE_DISC_ICON, cost:1500 },
  // ヤオビクニ
  // ウンディーネと同じ理由で顔クロップを使う
  { id:'yaobikuni_icon', name:"ヤオビクニのアイコン", type:'icon', icon:YAOBIKUNI_FACE_ICON, cost:1 },
  { id:'yaobikuni_disc_icon', name:"ヤオビクニの円盤石アイコン", type:'icon', icon:YAOBIKUNI_DISC_ICON, cost:1 },
  { id:'Yaobikuni', name:"ヤオビクニの円盤石", type:'disc', icon:YAOBIKUNI_DISC_ICON, cost:1500 },
  // プラント。既存の本体画像と専用円盤石画像を、加工・複製せず各商品で共用する。
  { id:'plant_icon', name:"プラントのアイコン", type:'icon', icon:PLANT_IMG, cost:1 },
  { id:'plant_disc_icon', name:"プラントの円盤石アイコン", type:'icon', icon:PLANT_DISC_ICON, cost:1 },
  { id:'Plant', name:"プラントの円盤石", type:'disc', icon:PLANT_DISC_ICON, cost:1500 },
  // ミーア。正式な本体画像と専用円盤石画像を、加工・複製せず各商品で共用する。
  { id:'mia_icon', name:"ミーアのアイコン", type:'icon', icon:MIA_IMG, cost:1 },
  { id:'mia_disc_icon', name:"ミーアの円盤石アイコン", type:'icon', icon:MIA_DISC_ICON, cost:1 },
  { id:'Mia', name:"ミーアの円盤石", type:'disc', icon:MIA_DISC_ICON, cost:1500 },
  // パンドラ。保存済みの本体・円盤石画像を各商品で共用する。
  { id:'pandora_icon', name:"パンドラのアイコン", type:'icon', icon:PANDORA_IMG, cost:1 },
  { id:'pandora_disc_icon', name:"パンドラの円盤石アイコン", type:'icon', icon:PANDORA_DISC_ICON, cost:1 },
  { id:'Pandora', name:"パンドラの円盤石", type:'disc', icon:PANDORA_DISC_ICON, cost:3000 },
  // エイキ。ザン・ミタラシ・アーク・イブリースと同じく専用の顔クロップ(EIKI_FACE_ICON)を
  // 商品アイコンにも使うため、パンドラ・ミーアのような MARKET_PROFILE_ICON_STYLES の
  // 拡大・位置調整は不要(元から丸枠向けに切り出し済み)。
  { id:'eiki_icon', name:"エイキのアイコン", type:'icon', icon:EIKI_FACE_ICON, cost:1 },
  { id:'eiki_disc_icon', name:"エイキの円盤石アイコン", type:'icon', icon:EIKI_DISC_ICON, cost:1 },
  { id:'Eiki', name:"エイキの円盤石", type:'disc', icon:EIKI_DISC_ICON, cost:3000 },
  // 剣士モッチー。エイキと同じく専用の顔クロップ(KENSHI_MOCCHI_FACE_ICON)を商品アイコンにも使うため、
  // 本人アイコン側の MARKET_PROFILE_ICON_STYLES は不要(元から丸枠向けに切り出し済み)。
  { id:'kenshi_mocchi_icon', name:"剣士モッチーのアイコン", type:'icon', icon:KENSHI_MOCCHI_FACE_ICON, cost:1 },
  { id:'kenshi_mocchi_disc_icon', name:"剣士モッチーの円盤石アイコン", type:'icon', icon:KENSHI_MOCCHI_DISC_ICON, cost:1 },
  { id:'KenshiMocchi', name:"剣士モッチーの円盤石", type:'disc', icon:KENSHI_MOCCHI_DISC_ICON, cost:3000 },
  { id:'bond_reset_scroll', name:"絆ポイントリセットの書", type:'item', emoji:"📜", cost:500, desc:"マスモンに使うと、そのマスモンが使用した強化ポイント(間合い適性・ステータス強化)がすべて未使用に戻る。絆レベル・絆経験値はそのまま。" },
  { id:'transcend_reset_scroll', name:"超越ポイントリセットの書", type:'item', emoji:"🌠", cost:10000, usage:'transcendReset', desc:"マスモンに使うと、超越強化へ使った超越ポイントがすべて未使用の超越Pへ戻る。絆レベル・絆経験値・通常の強化・超越済みかどうかは変わらない。虹のプシュケーは戻らない。" },
  { id:'soul_rank_respec_scroll', name:"魂格再編の書", type:'item', emoji:"🌀", cost:1000000, usage:'soulRankRespec', desc:"マスモンの魂格特性に使った魂格Pをすべて未使用へ戻す。魂格段階・Lv・最高初到達Lvは変わらない。マーケットでは100万ダイヤ、または勇者の証1個と交換できる。" },
  { id:'unique_skill_reset_ticket', name:"スキルポイントリセット券", type:'item', emoji:"🎟️", cost:1000, usage:'uniqueSkillReset', desc:"マスモン詳細の「固有技強化」で使うと、その個体の固有技に配分したポイントをすべて未使用の固有技Pへ戻せる。固有技以外の育成状態は変わらない。" },
  // 説明は実際の機能に合わせて更新すること。導入時は6色から全身を1色に変えるだけだったが、
  // その後アイコンごとの部位分け・プリセット27色・カスタムカラーに対応している
  { id:'dye_mock', name:"染色もどき", type:'item', emoji:"🎨", cost:500, desc:"マスモンに使うと、見た目の色を変えられる。モンスターによっては体・目・口などの部位ごとに別々の色を選べる。プリセット27色に加えて、色相・鮮やかさ・明るさを自分で決めるカスタムカラーも使える。" },
  // bondXp を持つアイテムは「マスモンに絆経験値を与える」もの。まとめて使えるので、
  // 使う個数を決める画面(何個でレベルがいくつ上がるか)が出る
  { id:'training_ticket', name:"トレーニングチケット", type:'item', emoji:"🎫", cost:100, bondXp:15, desc:"マスモンに使うと絆経験値を15もらえる。まとめて使えるので、使う個数に応じて絆レベルがどこまで上がるかを確かめながら使える。" },
  { id:'training_ticket_l', name:"重トレーニングチケット", type:'item', emoji:"🎟️", cost:1000, bondXp:150, desc:"マスモンに使うと絆経験値を150もらえる。トレーニングチケット10枚ぶん。まとめて使えるので、使う個数に応じて絆レベルがどこまで上がるかを確かめながら使える。" },
  // usage:'battleSkip' はマスモンに使うアイテムではなく、バトルの難易度選択から使う消耗アイテム。
  // skipDifficulty はそのチケットで飛ばせる難易度(DIFFICULTY_SETTINGSのキー)。
  // 1枚消費してボス撃破まで到達したのと同じ絆経験値・ブリーダー経験値・ダイヤを受け取る。
  // スコア・ランキング・クリア回数・マスモン登録は対象外(通常のクリアとは別扱い)。
  //
  // 販売価格は序=3000 / 破=5000 / 急=7000 / 極=15000 / 覇=30000。報酬計算とは独立した固定価格。
  { id:'skip_ticket_jo',  name:"スキップチケット・序", type:'item', emoji:"⏩", cost:3000, usage:'battleSkip', skipDifficulty:'Normal', desc:"バトルのNormalで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_ha',  name:"スキップチケット・破", type:'item', emoji:"⏭️", cost:5000, usage:'battleSkip', skipDifficulty:'Hard',   desc:"バトルのHardで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_kyu', name:"スキップチケット・急", type:'item', emoji:"⚡", cost:7000, usage:'battleSkip', skipDifficulty:'Expert', desc:"バトルのExpertで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_kiwami', name:"スキップチケット・極", type:'item', emoji:"🔥", cost:15000, usage:'battleSkip', skipDifficulty:'Master', desc:"バトルのMasterで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  { id:'skip_ticket_haou', name:"スキップチケット・覇", type:'item', emoji:"👑", cost:30000, usage:'battleSkip', skipDifficulty:'GrandMaster', desc:"バトルのGrand Masterで使う。1枚消費して、ボスまで倒したときと同じ絆経験値・ブリーダー経験値・ダイヤを受け取れる。まとめて使うこともでき、その場合は枚数ぶん受け取れる。スコアとランキングには記録されない。" },
  // 限界突破専用のアイテム。マーケットでは売らない(shop:false)ので、
  // 入手はチャレンジモード・クイックモードのクリア報酬だけ。
  // 必要数は限界突破1回ごとに増える(1回目5個・以降+1個)。計算は game-system.jsx の
  // breakthroughItemCost が正本で、ここには説明だけを書く。
  { id:'rainbow_psyche', name:"虹のプシュケー", type:'item', emoji:"🌈", cost:0, shop:false, usage:'breakthrough',
    desc:"マスモンの限界突破に使う。必要数は1回目が5個で、限界突破1回ごとに1個ずつ増える(2回目6個、3回目7個…)。チャレンジモード・クイックモードをクリアすると、選んだ難易度に応じてもらえる。" },
  // 助手みゅあの表情アイコン(8種)。アイコンタブの最後に並ぶ
  ...MYUA_MARKET_ICONS,
  // 助手ききの表情アイコン(8種)。みゅあと同じ並びで続ける
  ...KIKI_MARKET_ICONS,
  ...MOMOSUKE_MARKET_ICONS
];
// 難易度キー → その難易度で使えるスキップチケットのid
const SKIP_TICKET_BY_DIFFICULTY = Object.freeze(Object.fromEntries(
  BREEDER_MARKET_ITEMS.filter(item => item.usage === 'battleSkip').map(item => [item.skipDifficulty, item.id])
));
// ==================== プロフィールフレーム(2026-09-15) ====================
//
// ブリーダーアイコンの「外側」へ重ねる飾り枠。アイコン画像そのものには一切手を触れない
// (下層=これまでのアイコン / 上層=フレーム、の2枚重ね)。顔の位置調整
// (MARKET_PROFILE_ICON_STYLES)も、フレームの有無に関係なくそのまま効く。
//
// 【最初から全員が選べるもの】
//   画像を1枚も増やさずに済むよう、シルバー・ゴールド・ブルー・ピンクは CSS だけで描く
//   (kind:'css')。太さは「アイコンの大きさに対する割合」で決まるので、
//   ランキングの32pxでも、プロフィールの80pxでも同じ見え方になる。
//
// 【まだ公開しないもの】
//   豪華フレームは kind:'image' + released:false で登録する。released:false のものは
//   normalizeProfileFrameId が 'none' へ倒すので、
//     ・選択画面に出ない
//     ・保存値に入っても「フレームなし」になる
//     ・ランキングで他人の記録に入っていても描画されない
//   の3つがまとめて成り立つ。公開するときは released:true へ変えるだけでよい。
//   (画像は monster-hero/images/profile-frames/ へ置く。base64にはしない)
const PROFILE_FRAME_NONE_ID = 'none';
// 選んでいるフレームの保存キー。既存の mh_breeder_icon とは別に持つ(アイコンとフレームは独立した設定)
const PROFILE_FRAME_KEY = 'mh_profile_frame_v1';
// ★助手ごとの飾り枠は unlock:{assistantId, bondLevel} で結び付ける。
//   ドラ(2026-09-17に加入)のぶんは**まだ無い**。後日対応と決めてある(ユーザー指示)。
//   無くても画面は壊れない(nextProfileFrameForAssistant が null を返し、
//   プロフィールの「次にもらえる枠」ボタンが出ないだけ)。足すときはここへ3枠。
const PROFILE_FRAMES = [
  { id:'none',   name:'フレームなし', kind:'none', released:true,
    desc:'飾り枠を付けません。これまでと同じ見た目です。' },
  // ★既存のidは消さない・変えない(選んでいる人がいるし、ランキングの記録にも入っている)。
  //   色を増やすときは、この並びへ足すだけにする。
  { id:'silver', name:'シルバー', kind:'css', released:true, className:'mh-profile-frame-silver',
    desc:'落ち着いた銀色の細い輪。どのアイコンにも合わせやすい枠です。' },
  { id:'gold',   name:'ゴールド', kind:'css', released:true, className:'mh-profile-frame-gold',
    desc:'金色の輪。少しだけ華やかに見せたいときに。' },
  { id:'white',  name:'ホワイト', kind:'css', released:true, className:'mh-profile-frame-white',
    desc:'白い輪。色の濃いアイコンをすっきり見せます。' },
  { id:'black',  name:'ブラック', kind:'css', released:true, className:'mh-profile-frame-black',
    desc:'黒い輪。明るいアイコンを引き締めます。' },
  { id:'red',    name:'レッド',   kind:'css', released:true, className:'mh-profile-frame-red',
    desc:'赤い輪。いちばん目を引く色です。' },
  { id:'orange', name:'オレンジ', kind:'css', released:true, className:'mh-profile-frame-orange',
    desc:'橙色の輪。あたたかい印象になります。' },
  { id:'green',  name:'グリーン', kind:'css', released:true, className:'mh-profile-frame-green',
    desc:'緑の輪。落ち着いた自然な色合いです。' },
  { id:'aqua',   name:'アクア',   kind:'css', released:true, className:'mh-profile-frame-aqua',
    desc:'水色の輪。涼しげで明るい色です。' },
  { id:'blue',   name:'ブルー',   kind:'css', released:true, className:'mh-profile-frame-blue',
    desc:'澄んだ青の輪。暗い背景でもはっきり見えます。' },
  { id:'purple', name:'パープル', kind:'css', released:true, className:'mh-profile-frame-purple',
    desc:'紫の輪。落ち着いた華やかさがあります。' },
  { id:'pink',   name:'ピンク',   kind:'css', released:true, className:'mh-profile-frame-pink',
    desc:'やわらかい桃色の輪。明るい印象になります。' },
  { id:'rainbow',name:'レインボー', kind:'css', released:true, className:'mh-profile-frame-rainbow',
    desc:'七色がぐるりと回る輪。いちばん目立つ色です。' },
  // ==================== 豪華フレーム(2026-09-15) ====================
  // ユーザーから受け取った透過PNG。
  // ★hole は「穴の直径 ÷ 画像の幅」の実測値(360方向の中央値)。位置合わせに使う。
  //   tools/ranking/profile-frame-check.js が実際のPNGを測って突き合わせる。
  // ★元絵は 1254px / 0.9〜2.2MB だったものを 384px へ落として入れてある。
  //   表示は最大80pxなので、これで足りる(CLAUDE.md ⑥-2)。
  //
  // 【released と unlock の役割はまったく別】(2026-09-16)
  //   released … **描いてよいか**。false のものは選択画面にも出ないし、
  //               ランキングで他人の記録に入っていても描かれない
  //   unlock   … **自分が選べるか**。書いてあるものは条件を満たすまで選べない
  //               (描くのは自由。持っている人の枠は、他人の画面でもちゃんと出る)
  //   ★ここを一緒にすると「解放した人の枠が他人の画面で消える」ので、必ず分けること。
  // モンスターの3枚は助手とは無関係。配り方を決めていないので未公開のまま
  // (released:false。選択画面に出ず、他人の記録に入っていても描かれない)
  { id:'frame_mocchi', name:'モッチー', kind:'image', released:false, hole:0.656,
    src:'images/profile-frames/mocchi.png?v=7c842f6ed7bf',
    desc:'桜の花びらと桜もちをあしらった、モッチーの和風フレーム。' },
  { id:'frame_moo', name:'ムー', kind:'image', released:false, hole:0.682,
    src:'images/profile-frames/moo.png?v=fc64f9da9806',
    desc:'紫の宝玉と金の角をいただく、ラスボス「ムー」のフレーム。' },
  { id:'frame_suezo_beat', name:'スエゾービート', kind:'image', released:false, hole:0.724,
    src:'images/profile-frames/suezo-beat.png?v=0b43f621dd89',
    desc:'スエゾーと音符が跳ねる、モンヒロビートのフレーム。' },
  // ==================== 助手の仲良し度でもらえる枠(2026-09-16) ====================
  // 助手1人につき3枚。その助手との仲良し度が Lv2 / Lv5 / Lv7 になると自動でもらえる。
  // ★unlock を書いた枠は「もらうまで選べない」だけで、描くのは自由(released:true)。
  // ★並びは助手の登場順(みゅあ → きき → ももすけ)。Lvの小さい順に3枚ずつ。
  //
  // みゅあの3枚。呼び分けはアシストカードの3段階
  // (BREEDER_EVO_NAMES.mua の 愛 → 深愛 → 慈愛)にそろえてある。
  { id:'frame_mua_1', name:'みゅあ・愛', kind:'image', released:true, hole:0.669,
    unlock:{ assistantId:'mua', bondLevel:2 },
    src:'images/profile-frames/mua-1.png?v=cf21c351ff0a',
    desc:'桜色のリボンと星をあしらった、みゅあの細いリース。' },
  { id:'frame_mua_2', name:'みゅあ・深愛', kind:'image', released:true, hole:0.745,
    unlock:{ assistantId:'mua', bondLevel:5 },
    src:'images/profile-frames/mua-2.png?v=ec2adae9b6f6',
    desc:'金の飾りと真珠、虹のリボンで華やかにした、みゅあのリース。' },
  { id:'frame_mua_3', name:'みゅあ・慈愛', kind:'image', released:true, hole:0.719,
    unlock:{ assistantId:'mua', bondLevel:7 },
    src:'images/profile-frames/mua-3.png?v=d18cf1740410',
    desc:'みゅあ本人が寄り添って眠る、いちばん特別なリース。' },
  // ききの3枚。同じ意匠を段階的に豪華にしたもので、呼び分けは教えカードの3段階
  // (BREEDER_EVO_NAMES.kiki の 応援 → 本気 → 全力全開)にそろえてある。
  { id:'frame_kiki_ouen', name:'きき・応援', kind:'image', released:true, hole:0.755,
    unlock:{ assistantId:'kiki', bondLevel:2 },
    src:'images/profile-frames/kiki-ouen.png?v=09b871ec464c',
    desc:'紅いリボンと白いくつ下をあしらった、ききのフレーム。' },
  { id:'frame_kiki_honki', name:'きき・本気', kind:'image', released:true, hole:0.698,
    unlock:{ assistantId:'kiki', bondLevel:5 },
    src:'images/profile-frames/kiki-honki.png?v=fb89e34bd92b',
    desc:'金の縁飾りと桜、幾重ものリボンで華やかにした、ききのフレーム。' },
  { id:'frame_kiki_zenryoku', name:'きき・全力全開', kind:'image', released:true, hole:0.677,
    unlock:{ assistantId:'kiki', bondLevel:7 },
    src:'images/profile-frames/kiki-zenryoku.png?v=88238cde0306',
    desc:'髪とリボンが渦を巻き、星とハートが輝く、ききのいちばん豪華なフレーム。' },
  // ももすけの3枚。ももすけにはまだアシストカードが無いので、呼び分けを先に決めてある
  // (2026-09-16・ユーザーが選択)。おねだり → だだこね → 独り占め。
  // カードを実装するときも、この3段階をそのまま使う
  // (BREEDER_EVO_NAMES へ momosuke:['ももすけのおねだり','ももすけのだだこね','ももすけの独り占め'])。
  { id:'frame_momosuke_1', name:'ももすけ・おねだり', kind:'image', released:true, hole:0.737,
    unlock:{ assistantId:'momosuke', bondLevel:2 },
    src:'images/profile-frames/momosuke-1.png?v=85af4bc2f2e2',
    desc:'黒とピンクのリボンに、うさぎと三日月をあしらった細い輪。' },
  { id:'frame_momosuke_2', name:'ももすけ・だだこね', kind:'image', released:true, hole:0.714,
    unlock:{ assistantId:'momosuke', bondLevel:5 },
    src:'images/profile-frames/momosuke-2.png?v=9c1adfb2e8b6',
    desc:'大きな三日月と魔法陣、こうもりの羽で飾った、ももすけの輪。' },
  { id:'frame_momosuke_3', name:'ももすけ・独り占め', kind:'image', released:true, hole:0.714,
    unlock:{ assistantId:'momosuke', bondLevel:7 },
    src:'images/profile-frames/momosuke-3.png?v=15ed59e8cf51',
    desc:'ももすけ本人がうさぎのぬいぐるみを抱えて陣取る、いちばん特別な輪。' },
];
const PROFILE_FRAME_MAP = Object.freeze(Object.fromEntries(PROFILE_FRAMES.map(frame => [frame.id, frame])));
// 画像フレームの「穴」を、アイコンの円のどこに合わせるか。
// 1.00 でちょうど重なり、小さくするほど枠がアイコンへかぶさる。
// 0.98 は「アイコンをほとんど隠さず、境目だけ少し重ねる」値
// (公開のしかたを決めるときに、ここだけ変えれば6枚まとめて寄り引きできる)。
const PROFILE_FRAME_HOLE_FIT = 0.98;
// 画像フレームを重ねる大きさと位置。絵ごとに穴の大きさ(hole)が違うので、1つのCSSではそろわない。
// hole は「穴の直径 ÷ 画像の幅」で、tools/ranking/profile-frame-check.js が
// 実際のPNGを測って書いてある値と合っているかを確かめる(絵を差し替えたらそこで気づく)。
//
// ★width / height を必ず書く。<img> は位置指定(inset)だけでは広がらず、
//   さらに Tailwind の img{max-width:100%} でアイコンと同じ大きさに抑えられてしまう
//   (2026-09-15・実際にそうなって枠が拡大されなかった)。maxWidth:'none' もここで外す。
const PROFILE_FRAME_IMAGE_FALLBACK_BOX = 1.32; // hole が読めないときの大きさ(アイコン比)
const profileFrameImageStyle = (frame) => {
  const hole = Number(frame && frame.hole);
  const box = (Number.isFinite(hole) && hole > 0.2 && hole < 1)
    ? (PROFILE_FRAME_HOLE_FIT / hole) : PROFILE_FRAME_IMAGE_FALLBACK_BOX;
  const size = `${(box * 100).toFixed(2)}%`;
  const offset = `${(-((box - 1) / 2) * 100).toFixed(2)}%`;
  return { width: size, height: size, left: offset, top: offset, right: 'auto', bottom: 'auto', maxWidth: 'none' };
};
// idからフレームの定義を引く。未公開のものもそのまま返す(デバッグの見た目確認はこちらを使う)
const profileFrameById = (id) => (typeof id === 'string' && PROFILE_FRAME_MAP[id]) || null;
// 保存値・ランキングから受け取った値を「いま画面に出してよいid」へそろえる。
// 知らないid・未公開のid・壊れた値はすべて 'none'(フレームなし)へ倒す。
// ★この関数だけが「出してよいか」を決める。画面ごとに判定を書かない
const normalizeProfileFrameId = (value) => {
  const frame = profileFrameById(value);
  return (frame && frame.released === true) ? frame.id : PROFILE_FRAME_NONE_ID;
};
// 全国ランキングへ送る値。フレームなしのときは null を返し、呼ぶ側は列ごと付けない
// (既存の記録と同じくNULLのままにしておく。NULL = フレームなし)
const rankingProfileFrameValue = (value) => {
  const id = normalizeProfileFrameId(value);
  return id === PROFILE_FRAME_NONE_ID ? null : id;
};
// 選択画面に並べるもの(公開済みのみ。並びは PROFILE_FRAMES のとおり)。
// ★もらっていない枠もここに入る。「選べるか」は profileFrameOwned が別に決める
//   (絵は見せて鍵を付ける、という見せ方。2026-09-16にユーザーが選択)
const releasedProfileFrames = () => PROFILE_FRAMES.filter(frame => frame.released === true);

// ==================== もらえる枠(2026-09-16) ====================
//
// 助手との仲良し度が Lv2 / Lv5 / Lv7 になると、その助手の枠が1枚ずつもらえる。
//
// ★もらったidは**新しいキー**へ積む。既存の mh_* は読みも書きも変えない(CLAUDE.md ⑦)。
// ★一度もらったら絶対に外さない。助手を切り替えても、あとで条件を変えても残す
//   (取り上げになるため)。だから「いまのLv」ではなく「もらった記録」を持つ。
const PROFILE_FRAME_OWNED_KEY = 'mh_profile_frame_owned_v1';
// 壊れた値・古い形が入っていても必ず文字列の配列へ落とす
const normalizeOwnedProfileFrames = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
};
// その枠にもらう条件が付いているか(付いていなければ最初から誰でも選べる)
const profileFrameUnlock = (frame) => {
  const unlock = frame && frame.unlock;
  const level = Number(unlock && unlock.bondLevel);
  return (unlock && typeof unlock.assistantId === 'string' && Number.isFinite(level))
    ? { assistantId: unlock.assistantId, bondLevel: level } : null;
};
// いま選べるか。条件の無い枠は常に true、条件つきは「もらった記録」にあるときだけ true
const profileFrameOwned = (id, owned) => {
  const frame = profileFrameById(id);
  if (!frame || frame.released !== true) return false;
  if (!profileFrameUnlock(frame)) return true;
  return normalizeOwnedProfileFrames(owned).includes(frame.id);
};
// その助手の枠を、もらえるLvの小さい順に返す(助手の画面・ヘルプの表で使う)
const profileFramesForAssistant = (assistantId) => releasedProfileFrames()
  .filter(frame => (profileFrameUnlock(frame) || {}).assistantId === assistantId)
  .sort((a, b) => profileFrameUnlock(a).bondLevel - profileFrameUnlock(b).bondLevel);
// 仲良し度がLvまで上がったときに、新しくもらえる枠のidを返す(既に持っているものは除く)。
// ★条件は「いまのLv以下」で見る。間のLvを飛ばして上がっても取りこぼさない
const profileFramesEarnedAt = (assistantId, bondLevel, owned) => {
  const level = Number(bondLevel);
  if (!Number.isFinite(level)) return [];
  const have = new Set(normalizeOwnedProfileFrames(owned));
  return profileFramesForAssistant(assistantId)
    .filter(frame => profileFrameUnlock(frame).bondLevel <= level && !have.has(frame.id))
    .map(frame => frame.id);
};
// その助手で「次にもらえる枠」。全部もらっていれば null(助手の画面の1行に使う)
const nextProfileFrameForAssistant = (assistantId, bondLevel, owned) => {
  const level = Number(bondLevel);
  const have = new Set(normalizeOwnedProfileFrames(owned));
  return profileFramesForAssistant(assistantId)
    .find(frame => !have.has(frame.id) && !(Number.isFinite(level) && profileFrameUnlock(frame).bondLevel <= level)) || null;
};

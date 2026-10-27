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
// ももすけのカード用の顔アイコン。助手の表情画像(小さい)をそのまま使う
const MOMOSUKE_FACE_ICON = "images/assistant/face/momosuke_happy.PNG?v=26508bc26c81";
const KIKI_FACE_ICON = "images/breeder-icons/kiki.PNG?v=35362d7b6e3e";
const POLTZ_FACE_ICON = "images/breeder-icons/poltz.PNG?v=a17ca7fa2869";
// きゅうこ(2026-10-22)。顔アイコン(案B)をそのまま使う
const KYUKO_FACE_ICON = "images/assistant/face/kyuko_happy.PNG?v=6ad5eda132bf";
// ソラシド(2026-10-27)。顔の絵は社長があとで送る。届くまでは字のアイコン(公開の印 assistantSorashido が偽のあいだは出ない)。
//   届いたら images/assistant/face/sorashido_happy.PNG にする
const SORASHIDO_FACE_ICON = "🤖";
// スネグーラチカの高解像度の立ち絵。顔アイコン(make-face-icons.js)の元絵で、覚醒のほうはマーケットのアイコン商品で使う。
// 本体の絵(images-ally.js の SNEGUROCHKA_IMG)とは別ファイルなので、ここで持つ
const SNEGUROCHKA_MARKET_ICON = "images/monsters/SNEGUROCHKA.PNG?v=54c9540841fe";
const SNEGUROCHKA_AWAKENED_MARKET_ICON = "images/monsters/SNEGUROCHKA_AWAKENED.PNG?v=52c8eda68793";

// ==================== モンスター円盤石アイコン ====================
// DISC_STONE_BASE: 円盤石の土台画像(全モンスター共通)。作り方の詳細はBREEDER_MARKET_ITEMS手前のコメント参照。
const DISC_STONE_BASE = "images/disc-icons/disc-stone-base.PNG?v=2cf55b47492a";
const ZAN_DISC_ICON = "images/disc-icons/zan.png?v=0f5cf76eb420";
const MITARASHI_DISC_ICON = "images/disc-icons/mitarashi.png?v=39933ff87253";
const ARK_DISC_ICON = "images/disc-icons/ark.png?v=55e7c1c5d1e9";
const IBLIS_DISC_ICON = "images/disc-icons/iblis.png?v=4d6d7f7f7234";
const SNEGUROCHKA_DISC_ICON = "images/disc-icons/snegurochka-disc.PNG?v=f693eca4429a";
const UNDINE_DISC_ICON = "images/disc-icons/undine-disc.PNG?v=974a914257f8";
const YAOBIKUNI_DISC_ICON = "images/disc-icons/yaobikuni-disc.PNG?v=6c1c56545861";
const PLANT_DISC_ICON = "images/disc-icons/plant-disc.PNG?v=491367d07445";
const MIA_DISC_ICON = "images/disc-icons/mia-disc.PNG?v=6ec351898278";
const PANDORA_DISC_ICON = "images/disc-icons/pandora-disc.PNG?v=c0d353e28482";
const EIKI_DISC_ICON = "images/disc-icons/eiki-disc.PNG?v=e26faa4a8580";
// 剣士モッチーの円盤石。絵は node tools/image/make-disc-icon.js が共通の土台へ重ねて作ったもの
const KENSHI_MOCCHI_DISC_ICON = "images/disc-icons/kenshi-mocchi-disc.PNG?v=130c85db1281";
// 近日公開予定のユグドラシル・メルホイップの円盤石(2026-09-28)。作り方は剣士モッチーと同じ
const YGGDRASIL_DISC_ICON = "images/disc-icons/yggdrasil-disc.PNG?v=ceb1014354a3";
// ゴースト・スプーキー(2026-10-05・案の段階)。マーケットにはまだ並べていない
const GHOST_DISC_ICON = "images/disc-icons/ghost-disc.PNG?v=0583141e2a3b";
const SPOOKY_DISC_ICON = "images/disc-icons/spooky-disc.PNG?v=cbd74baebb63";
const MEL_WHIP_DISC_ICON = "images/disc-icons/mel-whip-disc.PNG?v=fe9d907bed9a";
// メロディー・クロミー(2026-10-07・実装予告)。作り方はほかの円盤石と同じ(make-disc-icon.js)。?v= は build.js が打ち直す
const MELODY_DISC_ICON = "images/disc-icons/melody-disc.PNG?v=494f3e2f723a";
const KUROMY_DISC_ICON = "images/disc-icons/kuromy-disc.PNG?v=c7c5ba3d8031";
// イルミネ・ドリーミィ(2026-10-22・案の段階)。円盤石アイコン。商品はこのファイルの下の BREEDER_MARKET_ITEMS(近日追加)
const ILLUMINE_DISC_ICON = "images/disc-icons/illumine-disc.PNG?v=8368da2a70b6";
const DREAMY_DISC_ICON = "images/disc-icons/dreamy-disc.PNG?v=3f5815550d74";
// キュービ・オリヒメ(2026-10-27・案の段階)。マーケットの「近日追加」の商品は開発部が作る
const KYUBI_DISC_ICON = "images/disc-icons/kyubi-disc.PNG?v=3ba6c9096afd";
const ORIHIME_DISC_ICON = "images/disc-icons/orihime-disc.PNG?v=2463cbd1dd9e";

const BREEDER_EVO_NAMES = {
  oryo: ["ニコラオの力", "ニコラオの気合", "ニコラオの憤怒"],
  dra: ["ドラの緑膝", "ドラの黒膝臭", "ドラの毒膝地獄"],
  cadmium: ["かどみうむの計算", "かどみうむの理論", "かどみうむの叡智"],
  mua: ["みゅあの愛", "みゅあの深愛", "みゅあの慈愛"],
  atsu: ["あつの挑発", "あつの暴言", "あつの怒号"],
  myaru: ["みゃるの薬", "みゃるの怪薬", "みゃるの禁薬"],
  kiki: ["ききの応援", "ききの本気", "ききの全力全開"],
  meloso: ["メロソの解析", "メロソの予測", "メロソの最適解"],
  poltz: ["ポルツの弁当", "ポルツの挫折", "ポルツの目覚め"],
  momosuke: ["ももすけのおねだり", "ももすけのだだこね", "ももすけの独り占め"],
  kyuko: ["きゅうこの譜面", "きゅうこの編曲", "きゅうこの交響曲"],
  sorashido: ["ソラシドの自動化", "ソラシドの全自動", "ソラシドの無人運転"]
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

// きゅうこの譜面(cover_kyuko・2026-10-22 社長の決定)。効果の適用も説明文もこの表だけを見る。
//   使ったターンだけ、敵の単体攻撃が「使った子」に向く(タクティクス。全体攻撃は変えない・🔥は上げない)。
//   cut   : 使った子の受けるダメージを減らす割合(タクティクス以外はパーティのライフ全体)
//   turns : 減らすのが続くターン数(使ったターンを含む)。続くのはダメージダウンだけ
const KYUKO_TIERS = [
  { cut:0.30, turns:2 },
  { cut:0.45, turns:3 },
  { cut:0.60, turns:4 },
];

// ソラシドの自動化(copy_sorashido・2026-10-27 社長の決定)。効果の計算も説明文もこの表だけを見る(計算の部品は 32-sorashido-copy.jsx)。
//   使った子の「AIコピー」が、使った次のターンの始まりに5人目の味方として現れ、turns ターンのあいだ戦う。
//   rates     : 元の子に対する強さ(ライフ・ちから・丈夫さ・ガッツ)。ライフはタクティクスだけ(5つの遊びはパーティのライフを使う)
//   turns     : コピーが戦うターン数。出ているあいだにもう一度使うと、ここへ戻る
//   pick      : コピーが「いちばん点の高いカード」を選ぶ見込み。外れたら2番目以降から選ぶ
//   maxCards  : 1ターンに使う枚数の上限。2枚は、コピーのガッツの上限が gutsFor2 以上で、今のガッツが2枚ぶん足りるときだけ
//   hateStart : タクティクスで、出たときの🔥(元の子の🔥に対する割合)。hateGain : 🔥のたまり方の倍率
const SORASHIDO_TIERS = [
  { rates:{ hp:0.5, atk:0.6, def:0.5, guts:0.6 }, turns:2, pick:0.5,  maxCards:1, hateStart:0.5,  hateGain:1.0 },
  { rates:{ hp:0.7, atk:0.8, def:0.7, guts:0.8 }, turns:3, pick:0.65, maxCards:1, hateStart:0.75, hateGain:1.25 },
  { rates:{ hp:0.8, atk:0.9, def:0.8, guts:0.9 }, turns:4, pick:0.8,  maxCards:2, hateStart:1.0,  hateGain:1.5, gutsFor2:120 },
];

// 行動カードの絵(2026-10-15 社長「バトルカードの変更も進めて」。原本は tools/art-sources/card-frames・skill-icons)。
// 枠は5色(攻撃=赤・距離撃=青・守り=緑・支援=紫・固有技=金)、技のマークは攻撃9段階・守り9段階・距離撃は間合い4つ。
// 公開の印 battleCardArt(またはデバッグ設定の切り替え)が立っているときだけ使う。?v= は build が付ける
const BATTLE_CARD_ART = Object.freeze({
  frames: Object.freeze({
    red: 'images/ui/battle-cards/frame-red.webp?v=9237b55a1de5',
    blue: 'images/ui/battle-cards/frame-blue.webp?v=61fc12322033',
    green: 'images/ui/battle-cards/frame-green.webp?v=439f70b776c8',
    purple: 'images/ui/battle-cards/frame-purple.webp?v=7df652da8493',
    // 固有技の金の枠(2026-10-15 社長の決定)。上の大きい丸がほかの4色より大きく、少し下にある(位置は index.html の [data-card-art="gold"])
    gold: 'images/ui/battle-cards/frame-gold.webp?v=37472823143d',
  }),
  atk: Object.freeze(['images/ui/battle-cards/atk-1.webp?v=665df968b172', 'images/ui/battle-cards/atk-2.webp?v=96d0c562a41e', 'images/ui/battle-cards/atk-3.webp?v=78ec160b4a65', 'images/ui/battle-cards/atk-4.webp?v=5b30e9c9cf34', 'images/ui/battle-cards/atk-5.webp?v=1fc8366499a1', 'images/ui/battle-cards/atk-6.webp?v=772a9c75e527', 'images/ui/battle-cards/atk-7.webp?v=067fcf5d7f3d', 'images/ui/battle-cards/atk-8.webp?v=a1ce8f960223', 'images/ui/battle-cards/atk-9.webp?v=20c7c2779a48']),
  guard: Object.freeze(['images/ui/battle-cards/guard-1.webp?v=513b7a5b5476', 'images/ui/battle-cards/guard-2.webp?v=dc4bb98fc08b', 'images/ui/battle-cards/guard-3.webp?v=bfb5bfc72f93', 'images/ui/battle-cards/guard-4.webp?v=aae3cd5ec24b', 'images/ui/battle-cards/guard-5.webp?v=64ad02db25eb', 'images/ui/battle-cards/guard-6.webp?v=6babd9f2c1f1', 'images/ui/battle-cards/guard-7.webp?v=eaae25598a9b', 'images/ui/battle-cards/guard-8.webp?v=e19abed694ec', 'images/ui/battle-cards/guard-9.webp?v=77107591ce9a']),
  range: Object.freeze(['images/ui/battle-cards/range-0.webp?v=960161f8f3a9', 'images/ui/battle-cards/range-1.webp?v=75d975b66cc5', 'images/ui/battle-cards/range-2.webp?v=217c186d914d', 'images/ui/battle-cards/range-3.webp?v=9ab6877fd82d']),
  // 名札(2026-10-15 社長。名前と下の札を載せる台。枠と同じ5色)。真ん中だけを縦に伸ばして使う(index.html の .mh-card-art-plate)
  plates: Object.freeze({
    red: 'images/ui/battle-cards/plate-red.webp?v=223ba9d247d0',
    blue: 'images/ui/battle-cards/plate-blue.webp?v=206a41f4f990',
    green: 'images/ui/battle-cards/plate-green.webp?v=993ea66f8428',
    purple: 'images/ui/battle-cards/plate-purple.webp?v=84fefdb268fe',
    gold: 'images/ui/battle-cards/plate-gold.webp?v=f92a595ad789',
  }),
  // 名前の飾り線(2026-10-15 社長。真ん中の宝石が枠の色)。名前の下に、文字の置き場の幅いっぱいで置く(index.html の [data-card-name]::after)。
  //   原本は tools/art-sources/name-dividers/(約2085×105)。真ん中の宝石と唐草を中心に 8:1(840×105)で切り出し、192×24 にした(手札で高さ約6px。切った両端は透明へぼかす)
  rules: Object.freeze({
    red: 'images/ui/battle-cards/rule-red.webp?v=cb3784b5d724',
    blue: 'images/ui/battle-cards/rule-blue.webp?v=6ea611645122',
    green: 'images/ui/battle-cards/rule-green.webp?v=40a70b55e319',
    purple: 'images/ui/battle-cards/rule-purple.webp?v=39f80f5dd9d5',
    gold: 'images/ui/battle-cards/rule-gold.webp?v=92745a007b55',
  }),
});

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
  { id:'poltz',   baseName:"ポルツの弁当",      icon:POLTZ_FACE_ICON,   type:'buff',   subType:'buff_poltz', baseValue:0.2, step:0,  desc:"敵の攻撃を受けるたびガッツ回復・自動ガッツ回復アップ", evoLevel:0, guts:20 },
  // ももすけは「みゅあのガッツ回復版」。回復と上限アップの量は60-app.jsxのmomosuke分岐と
  // getDynamicDescの2か所に同じ表がある。攻撃アップの代わりに丈夫さ(defPct)を上げる
  { id:'momosuke', baseName:"ももすけのおねだり", icon:MOMOSUKE_FACE_ICON, type:'heal', subType:'heal_momosuke', baseValue:0.5, step:0.2, desc:"ガッツ回復・能力永続アップ", evoLevel:0, guts:20 },
  // きゅうこ(2026-10-22)。加入のお話を見たあとマーケットで買える(BREEDER_MARKET_ITEMS の shop)。効果量は KYUKO_TIERS
  { id:'kyuko', baseName:"きゅうこの譜面", icon:KYUKO_FACE_ICON, type:'buff', subType:'cover_kyuko', baseValue:0.3, step:0.15, desc:"このターン敵の単体攻撃を引き受け・受けるダメージダウン", evoLevel:0, guts:20 },
  // ソラシド(2026-10-27)。公開の印 assistantSorashido が立つまでは、マーケット・ヘルプに出ない(releaseFlag)。効果量は SORASHIDO_TIERS。
  //   baseValue は Lv0 のライフの割合(表示・検査用)。増え方は表が持つので step は 0
  { id:'sorashido', baseName:"ソラシドの自動化", icon:SORASHIDO_FACE_ICON, type:'buff', subType:'copy_sorashido', baseValue:0.5, step:0, desc:"使った子のAIコピーが、次のターンから5人目の味方として戦う", evoLevel:0, guts:20, releaseFlag:'assistantSorashido' }
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

// 助手ドラの顔アイコンも、みゅあ・きき・ももすけと同じ仕様(8表情・各1pt)で並べる(2026-09-27)。
// ドラを助手に足したとき、表情アイコンの商品だけ作り忘れていた(tools/monster/market-icon-check.js が見つけた)。
// 画像は吹き出しに使っているもの(images/assistant/face/dra_*.PNG)をそのまま使う。
// 既存の「ドラのアイコン」(id:'dra', images/breeder-icons/dra.png)は別の絵で、購入済みの人がいるのでそのまま残す。
// こちらは id を dra_* に分けているので、既存の保存データには影響しない。
const DRA_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `dra_${key}`,
  name: `ドラ（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/dra_${key}.PNG`,
  cost: 1,
}));

// 助手きゅうこの顔アイコンも同じ仕様(8表情・各1pt)。画像は吹き出しの face/kyuko_*.PNG をそのまま使う(2026-10-22)。
// 公開の印 assistantKyuko が立つまでは交換所に並べない(見るたびに読む)
const KYUKO_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `kyuko_${key}`,
  name: `きゅうこ（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/kyuko_${key}.PNG`,
  cost: 1,
  get shop() { try { return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantKyuko === true ? undefined : false; } catch { return false; } },
}));

// 助手ソラシドの顔アイコンも同じ仕様(8表情・各1pt)。画像は吹き出しの face/sorashido_*.PNG をそのまま使う(2026-10-27)。
// きゅうこと同じく、公開の印 assistantSorashido が立つまでは交換所に並べない(見るたびに読む)
const SORASHIDO_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `sorashido_${key}`,
  name: `ソラシド（${label}）のアイコン`,
  type: 'icon',
  icon: `images/assistant/face/sorashido_${key}.PNG`,
  cost: 1,
  get shop() { try { return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantSorashido === true ? undefined : false; } catch { return false; } },
}));

// あつの顔アイコンも、助手と同じ仕様(8表情・各1pt)で並べる(2026-10-03)。
// 顔アイコン(256px)は images/breeder-icons/atsu_<表情>.png に直接置いている。
// 2026-10-22 あつが助手になり、絵を助手あつの大きい絵から作った顔(images/assistant/face/atsu_*.PNG と同じ絵)へ差し替えた
// (社長「アイコンも今回の絵に差し替える」。id・パスはそのままなので、買った人のアイコンも新しい絵になる)。
// 既存の「あつのアイコン」(id:'atsu', images/breeder-icons/atsu.png)は別の絵で、購入済みの人がいるのでそのまま残す。
// こちらは id を atsu_* に分けているので、既存の保存データには影響しない。
// (使われていない画像の検査が見つけられるよう、パスは1枚ずつ文字で書いておく)
const ATSU_EXPRESSION_ICONS = {
  normal:   "images/breeder-icons/atsu_normal.png?v=c7743bb24276",
  happy:    "images/breeder-icons/atsu_happy.png?v=c99760be79b6",
  wink:     "images/breeder-icons/atsu_wink.png?v=b5c98359f32b",
  excited:  "images/breeder-icons/atsu_excited.png?v=363fb647aac0",
  surprise: "images/breeder-icons/atsu_surprise.png?v=307aaa394f61",
  troubled: "images/breeder-icons/atsu_troubled.png?v=b5bc115df52f",
  angry:    "images/breeder-icons/atsu_angry.png?v=781bf0aca262",
  crying:   "images/breeder-icons/atsu_crying.png?v=23e2be3f83f9",
};
const ATSU_MARKET_ICONS = MYUA_ICON_EXPRESSIONS.map(([key, label]) => ({
  id: `atsu_${key}`,
  name: `あつ（${label}）のアイコン`,
  type: 'icon',
  icon: ATSU_EXPRESSION_ICONS[key],
  cost: 1,
}));

// ハロウィン・ナイトの衣装のアイコン(2026-10-04・ユーザー指示「みゅあ、きき、もものアイコンの販売。ハロウィンみたいな名称。
// 同じキャラだけど通常のみゅあとかとは混ぜずに販売。ただし表情とかはまとめる。ブリーダーポイント1(イベント後販売)、ビートポイント1000」)。
//   ・通常のアイコン(myua_* / kiki_* / momosuke_*)とは別のまとめ(mua_halloween など)。id が違うので、持っているかも別々に数える
//   ・イベント中(10/4 8:00〜11/1 3:59)はビートP交換所で1000P、終わったあとはブリーダーP交換所で1pt(下の halloweenIconSale が決める)
//   ・どちらで買っても8表情ぜんぶ手に入る(まとめの中身が mh_market_icons に全部入る。新しい保存キーは作らない)
//   ・絵は衣装の顔アイコンをそのまま使う(images/assistant/halloween/face/)。別のファイルを作らない
// 助手(みゅあ・きき・ももすけ)は表情8種、スネグーラチカは通常と覚醒の2種(それぞれ1つのまとまり)。
// ★1つずつの名前は16文字まで(monster/market-icon-check.js)。売り場のカードの名前は、まとまりの名前(BREEDER_ICON_GROUP_NAMES)から作る
// ★名前を _ICON で終わらせない(ヘルプの描画検査が「_ICON の定数」を空にして読むため)
const SNEGUROCHKA_HALLOWEEN_ART = "images/breeder-icons/snegurochka_halloween.png?v=390c7fe41639";
const SNEGUROCHKA_HALLOWEEN_AWAKENED_ART = "images/breeder-icons/snegurochka_halloween_awakened.png?v=7dca63b3fe4c";
const HALLOWEEN_ICON_SETS = Object.freeze([
  ...[
    ['mua', 'myua', 'みゅあ'],
    ['kiki', 'kiki', 'きき'],
    ['momosuke', 'momosuke', 'ももすけ'],
  ].map(([assistantId, prefix, who]) => Object.freeze({
    groupId: `${assistantId}_halloween`,
    assistantId,
    name: `${who}（ハロウィン）`,
    items: Object.freeze(MYUA_ICON_EXPRESSIONS.map(([key, label]) => Object.freeze({
      id: `${prefix}_halloween_${key}`, name: `ハロウィン${who}（${label}）`, icon: `images/assistant/halloween/face/${prefix}_${key}.PNG`,
    }))),
  })),
  // スネグーラチカ(2026-10-04・ユーザー指示「スネグーラチカのアイコン、ハロウィン版の販売。みゅあ、ききとかと同じ仕様で」)。
  // 通常(青緑の髪)と覚醒(黒髪)の2種が1つのまとまり。通常のスネグーラチカのアイコンとは混ぜない
  Object.freeze({
    groupId: 'snegurochka_halloween',
    assistantId: null,
    name: 'スネグーラチカ（ハロウィン）',
    items: Object.freeze([
      Object.freeze({ id: 'snegurochka_halloween_icon', name: 'ハロウィンスネグーラチカ（通常）', icon: SNEGUROCHKA_HALLOWEEN_ART }),
      Object.freeze({ id: 'snegurochka_halloween_awakened_icon', name: 'ハロウィンスネグーラチカ（覚醒）', icon: SNEGUROCHKA_HALLOWEEN_AWAKENED_ART }),
    ]),
  }),
].map(set => Object.freeze({ ...set, memberIds: Object.freeze(set.items.map(item => item.id)) })));
// いまの売り場。'beatPoint'(ビートP交換所)・'breederPoint'(ブリーダーP交換所)・null(まだ売らない)。見るたびに数え直す
const halloweenIconSale = (nowMs = Date.now()) => {
  if (nowMs < Date.parse(ASSISTANT_COSTUME_HALLOWEEN_START_AT)) return null;
  return nowMs < Date.parse(ASSISTANT_COSTUME_HALLOWEEN_END_AT) ? 'beatPoint' : 'breederPoint';
};
const HALLOWEEN_MARKET_ICONS = HALLOWEEN_ICON_SETS.flatMap(set => set.items.map(item => ({
  id: item.id,
  name: item.name,
  type: 'icon',
  icon: item.icon,
  cost: 1,
  // ブリーダーP交換所に並ぶのはイベントが終わってから(それまでは false で出ない)
  get shop() { return halloweenIconSale() === 'breederPoint' ? undefined : false; },
})));

// きゅうこのカードが交換所に並ぶか。公開の印と「加入のお話を見たか」を見るたびに読む。
// 見たかどうかは、ゲーム側が「見終えたお話の id」(mh_rhythm_event_story_v1。新しいキーは作らない)を読んだときに
// setKyukoJoinSeenForShop で知らせる(保存の読み書きは Claude アプリの保存場所も通るので、ここでは直接読まない)
let kyukoJoinSeenForShop = false;
const setKyukoJoinSeenForShop = (seen) => { kyukoJoinSeenForShop = seen === true; };
const kyukoCardOnSale = () => {
  try { return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantKyuko === true && kyukoJoinSeenForShop; } catch { return false; }
};
// ソラシドのカードが交換所に並ぶか(きゅうこと同じ形)。加入のお話(sorashido_join_2026_10_27)を見たかは、ゲーム側が setSorashidoJoinSeenForShop で知らせる
let sorashidoJoinSeenForShop = false;
const setSorashidoJoinSeenForShop = (seen) => { sorashidoJoinSeenForShop = seen === true; };
const sorashidoCardOnSale = () => {
  try { return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS.assistantSorashido === true && sorashidoJoinSeenForShop; } catch { return false; }
};
// 公開の印(releaseFlag)が付いたアシカは、印が立つまでヘルプの表などに出さない
const teachingCardReleased = (card) => {
  if (!card || !card.releaseFlag) return true;
  try { return typeof RELEASE_FLAGS !== 'undefined' && RELEASE_FLAGS[card.releaseFlag] === true; } catch { return false; }
};
const BREEDER_MARKET_ITEMS = [
  // プロフィール用の追加画像は助手画像と分け、images/breeder-icons/ に置く。
  { id:'kiki_icon', name:"ききのアイコン", type:'icon', icon:KIKI_FACE_ICON, cost:1 },
  { id:'kiki', name:"アシストカード「きき」", type:'assist', icon:KIKI_FACE_ICON, cost:150000, desc:"次ターンから使えるカード+1枚・バトル中永続で全体連撃を強化" },
  { id:'meloso', name:"アシストカード「メロソ」", type:'assist', icon:MELOPANMAN_ICON, cost:150000, desc:"緊急回復相当＋現在ガード。複数枚使用で次ターンを強化" },
  { id:'momosuke', name:"アシストカード「ももすけ」", type:'assist', icon:MOMOSUKE_FACE_ICON, cost:150000, desc:"ガッツ回復・ライフ/ガッツ上限と丈夫さが永続アップ" },
  { id:'poltz', name:"アシストカード「ポルツ」", type:'assist', icon:POLTZ_FACE_ICON, cost:150000, desc:"敵の攻撃を受けるたびガッツ回復・自動ガッツ回復アップ（Lv3は攻撃アップも）" },
  // きゅうこ(2026-10-22 社長の決定)。公開の印 assistantKyuko が立ち、加入のお話(kyuko_join_2026_10_22)を見たら並ぶ(kyukoCardOnSale)。150000(ももすけ・ポルツと同じ)
  { id:'kyuko', name:"アシストカード「きゅうこ」", type:'assist', icon:KYUKO_FACE_ICON, cost:150000, desc:"このターン敵の単体攻撃を引き受け、数ターン受けるダメージダウン",
    get shop() { return kyukoCardOnSale() ? undefined : false; } },
  // ソラシド(2026-10-27)。きゅうこと同じく、公開の印が立ち、加入のお話を見たら並ぶ。150000
  { id:'sorashido', name:"アシストカード「ソラシド」", type:'assist', icon:SORASHIDO_FACE_ICON, cost:150000, desc:"使った子のAIコピーが、次のターンから5人目の味方として数ターン戦う",
    get shop() { return sorashidoCardOnSale() ? undefined : false; } },

  { id:'oryo',    name:"ニコラオのアイコン",     type:'icon', icon:NICOLAO_FACE_ICON, cost:1 },
  { id:'dra',     name:"ドラのアイコン",        type:'icon', icon:DRA_FACE_ICON,     cost:1 },
  { id:'cadmium', name:"かどみうむのアイコン",   type:'icon', icon:CADMIUM_FACE_ICON, cost:1 },
  { id:'mua',     name:"みゅあのアイコン",      type:'icon', icon:MUA_FACE_ICON,     cost:1 },
  { id:'atsu',    name:"あつのアイコン",        type:'icon', icon:ATSU_FACE_ICON,    cost:1 },
  { id:'myaru',   name:"みゃるのアイコン",      type:'icon', icon:MYARU_FACE_ICON,   cost:1 },
  { id:'mocchi_pet', name:"ごきげんモッチーのアイコン",  type:'icon', icon:MOCCHI_PET_ICON,   cost:1 },
  { id:'gezudero', name:"ゲズデロのアイコン",    type:'icon', icon:GEZUDERO_ICON,     cost:1 },
  { id:'melopanman', name:"メロぱんまんのアイコン", type:'icon', icon:MELOPANMAN_ICON,   cost:1 },
  // ポルツのアイコン。カードと同じ絵を使うので、id を分けて両方を並べられるようにしている
  // (きき/kiki_icon と同じ作り)。顔が中央にある正方形の絵なので寄せ調整は不要
  { id:'poltz_icon', name:"ポルツのアイコン",      type:'icon', icon:POLTZ_FACE_ICON,   cost:1 },
  { id:'zan_icon', name:"ザンのアイコン", type:'icon', icon:ZAN_FACE_ICON, cost:1 },
  { id:'Zan', name:"ザンの円盤石", type:'disc', icon:ZAN_DISC_ICON, cost:150000 },
  { id:'mitarashi_icon', name:"ミタラシのアイコン", type:'icon', icon:MITARASHI_FACE_ICON, cost:1 },
  { id:'Mitarashi', name:"ミタラシの円盤石", type:'disc', icon:MITARASHI_DISC_ICON, cost:150000 },
  { id:'ark_icon', name:"アークのアイコン", type:'icon', icon:ARK_FACE_ICON, cost:1 },
  { id:'Ark', name:"アークの円盤石", type:'disc', icon:ARK_DISC_ICON, cost:150000 },
  { id:'iblis_icon', name:"イブリースのアイコン", type:'icon', icon:IBLIS_FACE_ICON, cost:1 },
  { id:'Iblis', name:"イブリースの円盤石", type:'disc', icon:IBLIS_DISC_ICON, cost:150000 },
  { id:'snegurochka_icon', name:"スネグーラチカのアイコン", type:'icon', icon:SNEGUROCHKA_FACE_ICON, cost:1 },
  { id:'snegurochka_awakened_icon', name:"スネグーラチカ（覚醒）のアイコン", type:'icon', icon:SNEGUROCHKA_AWAKENED_MARKET_ICON, cost:1 },
  { id:'Snegurochka', name:"スネグーラチカの円盤石", type:'disc', icon:SNEGUROCHKA_DISC_ICON, cost:150000 },
  // ウンディーネ。本人アイコン・円盤石アイコン・解放用の円盤石の3商品。
  // アイコンは立ち絵/円盤石の絵をそのまま使い、丸い枠での見え方は
  // MARKET_PROFILE_ICON_STYLES の scale/x/y で寄せる(画像は複製しない)
  // 本人アイコンは立ち絵ではなく顔クロップ(UNDINE_FACE_ICON)を使う。立ち絵は尾ひれまで
  // 入っていて頭が小さく写っており、丸枠でどう寄せても「顔が小さい」か「耳が切れる」の
  // どちらかにしかならなかった(2026-09-19)。エイキ・剣士モッチーと同じ扱い。
  { id:'undine_icon', name:"ウンディーネのアイコン", type:'icon', icon:UNDINE_FACE_ICON, cost:1 },
  { id:'undine_disc_icon', name:"ウンディーネの円盤石アイコン", type:'icon', icon:UNDINE_DISC_ICON, cost:1 },
  { id:'Undine', name:"ウンディーネの円盤石", type:'disc', icon:UNDINE_DISC_ICON, cost:150000 },
  // ヤオビクニ
  // ウンディーネと同じ理由で顔クロップを使う
  { id:'yaobikuni_icon', name:"ヤオビクニのアイコン", type:'icon', icon:YAOBIKUNI_FACE_ICON, cost:1 },
  { id:'yaobikuni_disc_icon', name:"ヤオビクニの円盤石アイコン", type:'icon', icon:YAOBIKUNI_DISC_ICON, cost:1 },
  { id:'Yaobikuni', name:"ヤオビクニの円盤石", type:'disc', icon:YAOBIKUNI_DISC_ICON, cost:150000 },
  // プラント。既存の本体画像と専用円盤石画像を、加工・複製せず各商品で共用する。
  { id:'plant_icon', name:"プラントのアイコン", type:'icon', icon:PLANT_FACE_ICON, cost:1 },
  { id:'plant_disc_icon', name:"プラントの円盤石アイコン", type:'icon', icon:PLANT_DISC_ICON, cost:1 },
  { id:'Plant', name:"プラントの円盤石", type:'disc', icon:PLANT_DISC_ICON, cost:150000 },
  // ミーア。正式な本体画像と専用円盤石画像を、加工・複製せず各商品で共用する。
  { id:'mia_icon', name:"ミーアのアイコン", type:'icon', icon:MIA_FACE_ICON, cost:1 },
  { id:'mia_disc_icon', name:"ミーアの円盤石アイコン", type:'icon', icon:MIA_DISC_ICON, cost:1 },
  { id:'Mia', name:"ミーアの円盤石", type:'disc', icon:MIA_DISC_ICON, cost:150000 },
  // パンドラ。保存済みの本体・円盤石画像を各商品で共用する。
  { id:'pandora_icon', name:"パンドラのアイコン", type:'icon', icon:PANDORA_FACE_ICON, cost:1 },
  { id:'pandora_disc_icon', name:"パンドラの円盤石アイコン", type:'icon', icon:PANDORA_DISC_ICON, cost:1 },
  { id:'Pandora', name:"パンドラの円盤石", type:'disc', icon:PANDORA_DISC_ICON, cost:300000 },
  // エイキ。ザン・ミタラシ・アーク・イブリースと同じく専用の顔クロップ(EIKI_FACE_ICON)を
  // 商品アイコンにも使うため、パンドラ・ミーアのような MARKET_PROFILE_ICON_STYLES の
  // 拡大・位置調整は不要(元から丸枠向けに切り出し済み)。
  { id:'eiki_icon', name:"エイキのアイコン", type:'icon', icon:EIKI_FACE_ICON, cost:1 },
  { id:'eiki_disc_icon', name:"エイキの円盤石アイコン", type:'icon', icon:EIKI_DISC_ICON, cost:1 },
  { id:'Eiki', name:"エイキの円盤石", type:'disc', icon:EIKI_DISC_ICON, cost:300000 },
  // 剣士モッチー。エイキと同じく専用の顔クロップ(KENSHI_MOCCHI_FACE_ICON)を商品アイコンにも使うため、
  // 本人アイコン側の MARKET_PROFILE_ICON_STYLES は不要(元から丸枠向けに切り出し済み)。
  { id:'kenshi_mocchi_icon', name:"剣士モッチーのアイコン", type:'icon', icon:KENSHI_MOCCHI_FACE_ICON, cost:1 },
  { id:'kenshi_mocchi_disc_icon', name:"剣士モッチーの円盤石アイコン", type:'icon', icon:KENSHI_MOCCHI_DISC_ICON, cost:1 },
  { id:'KenshiMocchi', name:"剣士モッチーの円盤石", type:'disc', icon:KENSHI_MOCCHI_DISC_ICON, cost:300000 },
  // ユグドラシル(新しい血統・ユグドラシル×ユグドラシル)とメルホイップ(ユグドラシル×？？？のレア)。
  // 2026-09-28 ユーザー指示「近日公開予定でマーケットにおいて」で、3件とも available:false(「近日追加」)で並べた。
  // 2026-09-29 に本体を入れ、円盤石はビートP交換所で先に交換できるようにした(data/rhythm-event.js・各1,500P)。
  // 同じ日のユーザー指示「アイコンはもう販売開始してok」で、アイコン2種(本人・円盤石)の available:false を外した。
  // 2026-10-05 ユーザー指示「ゴースト、スプーキーの実装タイミングでユグとメルホイップはダイヤにも販売開始」で、
  // ダイヤショップの円盤石(150,000ダイヤ)の available:false も外した。
  { id:'yggdrasil_icon', name:"ユグドラシルのアイコン", type:'icon', icon:YGGDRASIL_FACE_ICON, cost:1 },
  { id:'yggdrasil_disc_icon', name:"ユグドラシルの円盤石アイコン", type:'icon', icon:YGGDRASIL_DISC_ICON, cost:1 },
  { id:'Yggdrasil', name:"ユグドラシルの円盤石", type:'disc', icon:YGGDRASIL_DISC_ICON, cost:150000 },
  { id:'mel_whip_icon', name:"メルホイップのアイコン", type:'icon', icon:MEL_WHIP_FACE_ICON, cost:1 },
  { id:'mel_whip_disc_icon', name:"メルホイップの円盤石アイコン", type:'icon', icon:MEL_WHIP_DISC_ICON, cost:1 },
  { id:'MelWhip', name:"メルホイップの円盤石", type:'disc', icon:MEL_WHIP_DISC_ICON, cost:150000 },
  // ゴースト(新しい血統・ゴースト×ゴースト)とスプーキー(ゴースト×？？？のレア)。
  // 2026-10-05 ユーザー指示「マーケットに近日追加で並べる」で、6件とも available:false(「近日追加」)で並べた。
  // 値段はユグドラシル種と同じ(円盤石150,000ダイヤ・アイコンは各1)。
  // 2026-10-05 の正式実装で、ユグドラシル種と同じく円盤石はビートP交換所で先行公開(data/rhythm-event.js・各1,500P)し、
  // アイコン2種(本人・円盤石)の available:false を外した。ダイヤショップの円盤石は「近日追加」のまま
  // 2026-10-23 イルミネ・ドリーミィの公開と同時に、ダイヤショップの円盤石も買えるようにした(社長)
  { id:'ghost_icon', name:"ゴーストのアイコン", type:'icon', icon:GHOST_FACE_ICON, cost:1 },
  { id:'ghost_disc_icon', name:"ゴーストの円盤石アイコン", type:'icon', icon:GHOST_DISC_ICON, cost:1 },
  { id:'Ghost', name:"ゴーストの円盤石", type:'disc', icon:GHOST_DISC_ICON, cost:150000 },
  { id:'spooky_icon', name:"スプーキーのアイコン", type:'icon', icon:SPOOKY_FACE_ICON, cost:1 },
  { id:'spooky_disc_icon', name:"スプーキーの円盤石アイコン", type:'icon', icon:SPOOKY_DISC_ICON, cost:1 },
  { id:'Spooky', name:"スプーキーの円盤石", type:'disc', icon:SPOOKY_DISC_ICON, cost:150000 },
  // メロディーとクロミー(ユグドラシル×？？？のレア2体)。
  // 2026-10-07 ユーザー指示「ゴーストのときと同じを一式」で、6件とも available:false(「近日追加」)で並べた。
  // 本体はまだ案の段階(UPCOMING_MONSTER_DRAFTS)。値段はゴースト・スプーキーと同じ(円盤石150,000ダイヤ・アイコンは各1)。
  // 正式実装のときに available:false を外す。
  // 2026-10-08 にいったん正式実装して販売したが、同じ日のユーザー指示「新モンスター実装は早く取り下げて」で、6件とも
  // available:false(近日追加)へ戻した。本体(ALL_PLAYER_MONSTERS)は残すので、交換済みの人はそのまま使える。
  // 同じ日のユーザー指示「公開して」で再公開し、アイコン2種の available:false をまた外した(ダイヤの円盤石は近日追加のまま)
  { id:'melody_icon', name:"メロディーのアイコン", type:'icon', icon:MELODY_FACE_ICON, cost:1 },
  { id:'melody_disc_icon', name:"メロディーの円盤石アイコン", type:'icon', icon:MELODY_DISC_ICON, cost:1 },
  { id:'Melody', name:"メロディーの円盤石", type:'disc', icon:MELODY_DISC_ICON, cost:150000, available:false },
  { id:'kuromy_icon', name:"クロミーのアイコン", type:'icon', icon:KUROMY_FACE_ICON, cost:1 },
  { id:'kuromy_disc_icon', name:"クロミーの円盤石アイコン", type:'icon', icon:KUROMY_DISC_ICON, cost:1 },
  { id:'Kuromy', name:"クロミーの円盤石", type:'disc', icon:KUROMY_DISC_ICON, cost:150000, available:false },
  // イルミネ(イルミネ×イルミネ)とドリーミィ(イルミネ×ニャー)。
  // 2026-10-22 社長「先にモンスター実装予告をいつもの出したい」で、メロディー・クロミーと同じく6件とも available:false(「近日追加」)で並べた。
  // 値段はほかの新モンスターと同じ(円盤石150,000ダイヤ・アイコンは各1)。
  // 2026-10-23 正式実装(新しい助手きゅうこのお話と同時)。ゴースト・スプーキーと同じく、円盤石はビートP交換所で先行公開(data/rhythm-event.js・各1,500P)し、
  // アイコン2種(本人・円盤石)の available:false を外した。ダイヤショップの円盤石は「近日追加」のまま(社長「ダイヤでは近日で、まずはビートポイントでしか買えない」)
  { id:'illumine_icon', name:"イルミネのアイコン", type:'icon', icon:ILLUMINE_FACE_ICON, cost:1 },
  { id:'illumine_disc_icon', name:"イルミネの円盤石アイコン", type:'icon', icon:ILLUMINE_DISC_ICON, cost:1 },
  { id:'Illumine', name:"イルミネの円盤石", type:'disc', icon:ILLUMINE_DISC_ICON, cost:150000, available:false },
  { id:'dreamy_icon', name:"ドリーミィのアイコン", type:'icon', icon:DREAMY_FACE_ICON, cost:1 },
  { id:'dreamy_disc_icon', name:"ドリーミィの円盤石アイコン", type:'icon', icon:DREAMY_DISC_ICON, cost:1 },
  { id:'Dreamy', name:"ドリーミィの円盤石", type:'disc', icon:DREAMY_DISC_ICON, cost:150000, available:false },
  // キュービ・オリヒメ(2026-10-27 社長「キュービの円盤石を近日追加で並べる」)。予告中なので6件とも available:false(「近日追加」)。
  // 値段はほかの新モンスターと同じ(円盤石150,000ダイヤ・アイコンは各1)。ビートP交換所・MFバトルカードのショップにも近日追加で並ぶ(data/rhythm-event.js)
  { id:'kyubi_icon', name:"キュービのアイコン", type:'icon', icon:KYUBI_FACE_ICON, cost:1, available:false },
  { id:'kyubi_disc_icon', name:"キュービの円盤石アイコン", type:'icon', icon:KYUBI_DISC_ICON, cost:1, available:false },
  { id:'Kyubi', name:"キュービの円盤石", type:'disc', icon:KYUBI_DISC_ICON, cost:150000, available:false },
  { id:'orihime_icon', name:"オリヒメのアイコン", type:'icon', icon:ORIHIME_FACE_ICON, cost:1, available:false },
  { id:'orihime_disc_icon', name:"オリヒメの円盤石アイコン", type:'icon', icon:ORIHIME_DISC_ICON, cost:1, available:false },
  { id:'Orihime', name:"オリヒメの円盤石", type:'disc', icon:ORIHIME_DISC_ICON, cost:150000, available:false },
  { id:'bond_reset_scroll', name:"絆ポイントリセットの書", type:'item', emoji:"📜", cost:500, desc:"マスモンに使うと、そのマスモンが使用した強化ポイント(間合い適性・ステータス強化)がすべて未使用に戻る。絆レベル・絆経験値はそのまま。" },
  { id:'transcend_reset_scroll', name:"超越ポイントリセットの書", type:'item', emoji:"🌠", cost:10000, usage:'transcendReset', desc:"マスモンに使うと、超越強化へ使った超越ポイントがすべて未使用の超越Pへ戻る。絆レベル・絆経験値・通常の強化・超越済みかどうかは変わらない。虹のプシュケーは戻らない。" },
  { id:'soul_rank_respec_scroll', name:"魂格再編の書", type:'item', emoji:"🌀", cost:1000000, usage:'soulRankRespec', desc:"マスモンの魂格特性に使った魂格Pをすべて未使用へ戻す。魂格の結晶で増やしたぶんは、結晶として持ち物に戻る。魂格段階・Lv・最高初到達Lvは変わらない。マーケットでは100万ダイヤ、または勇者の証1個と交換できる。" },
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
  // セッション券(docs/spec/RHYTHM_BUDDY.md・2026-10-07)。モンヒロビートのマルチで、マスモンをCPUとして呼ぶ。
  // 1日3回の無料ぶんを使い切ったあとに1枚使う。マーケットでは売らない(ビートP交換所・ログインボーナス・ミッションで手に入る)
  { id:'session_ticket', name:"セッション券", type:'item', emoji:"🎶", cost:0, shop:false, usage:'rhythmBuddy',
    desc:"モンヒロビートのマルチで、マスモンを部屋に呼ぶときに使う。1日3回までは無料で、そのあとは1枚で1回呼べる。呼んだ部屋にいるあいだは何曲でも一緒に遊ぶ。" },
  // 助手みゅあの表情アイコン(8種)。アイコンタブの最後に並ぶ
  ...MYUA_MARKET_ICONS,
  // 助手ききの表情アイコン(8種)。みゅあと同じ並びで続ける
  ...KIKI_MARKET_ICONS,
  ...MOMOSUKE_MARKET_ICONS,
  // 助手ドラの表情アイコン(8種)
  ...DRA_MARKET_ICONS,
  ...ATSU_MARKET_ICONS,
  ...KYUKO_MARKET_ICONS,
  ...SORASHIDO_MARKET_ICONS,
  ...HALLOWEEN_MARKET_ICONS
];
// ==================== アイコンのまとめ売り(2026-10-03・ユーザー指示) ====================
// 同じキャラのアイコンが何種類もある(助手の8表情・モンスターの顔と円盤石など)。
// ショップではキャラごとに1つにまとめて売り、「詳細」で中身を見られる。プロフィールで設定するときは、中身を1つずつ選べる。
//
// ★「どれか1つでも持っている人は、全部持っていることになる」(ユーザー指示)。
//   これは**読むときに広げる**だけで、保存してある mh_market_icons は書き換えない(CLAUDE.md ⑦)。
//   買ったときは、まとめの中身を全部 mh_market_icons へ足す(1つ買うと全部入る)。
// ★値段はまとめ全体で、代表(いちばん先のもの)の値段。いまは全部1pt。
// ★商品そのもの(BREEDER_MARKET_ITEMS)は変えない。id・名前・絵・値段は今までどおりで、
//   「どれとどれが同じキャラか」だけをここで決める。
const breederIconGroupKeyOf = (id) => {
  const key = String(id || '');
  // ハロウィンのアイコンは通常のアイコンと混ぜない(下の通常の判定より先に見る)
  const halloween = /^(myua|kiki|momosuke)_halloween_/.exec(key);
  if (halloween) return `${halloween[1] === 'myua' ? 'mua' : halloween[1]}_halloween`;
  if (/^snegurochka_halloween_/.test(key)) return 'snegurochka_halloween';
  if (key === 'mua' || /^myua_/.test(key)) return 'mua';
  if (key === 'dra' || /^dra_/.test(key)) return 'dra';
  if (key === 'kiki_icon' || /^kiki_/.test(key)) return 'kiki';
  if (/^momosuke_/.test(key)) return 'momosuke';
  if (key === 'atsu' || /^atsu_/.test(key)) return 'atsu';
  if (/^kyuko_/.test(key)) return 'kyuko';
  return key.replace(/_disc_icon$/, '').replace(/_awakened_icon$/, '').replace(/_icon$/, '');
};
const BREEDER_ICON_GROUP_NAMES = Object.freeze({ mua:'みゅあ', dra:'ドラ', kiki:'きき', momosuke:'ももすけ', atsu:'あつ', kyuko:'きゅうこ',
  mua_halloween:'みゅあ（ハロウィン）', kiki_halloween:'きき（ハロウィン）', momosuke_halloween:'ももすけ（ハロウィン）', snegurochka_halloween:'スネグーラチカ（ハロウィン）' });
// 中身が2つ以上あるキャラだけがまとまる(1つしかないアイコンは今までどおり1枚で売る)。並びは商品の並びのまま
const BREEDER_ICON_GROUPS = (() => {
  const order = [];
  const byKey = {};
  BREEDER_MARKET_ITEMS.filter(item => item.type === 'icon').forEach(item => {
    const key = breederIconGroupKeyOf(item.id);
    if (!byKey[key]) { byKey[key] = []; order.push(key); }
    byKey[key].push(item);
  });
  return order.filter(key => byKey[key].length >= 2).map(key => {
    const members = byKey[key];
    const name = BREEDER_ICON_GROUP_NAMES[key] || String(members[0].name || '').replace(/（覚醒）のアイコン$|の円盤石アイコン$|のアイコン$/, '');
    return Object.freeze({ id:key, name, memberIds:Object.freeze(members.map(m => m.id)) });
  });
})();
const BREEDER_ICON_GROUP_BY_MEMBER = Object.freeze(Object.fromEntries(
  BREEDER_ICON_GROUPS.flatMap(group => group.memberIds.map(id => [id, group]))));
// そのアイコンが入っているまとめ。まとまらないアイコンは null
const breederIconGroupOf = (id) => BREEDER_ICON_GROUP_BY_MEMBER[id] || null;
// 持っているアイコンのid一覧を「まとめの中身を全部持っている」形へ広げる。保存値は変えない。
// 壊れた値(配列でない・文字列でない)は捨てる
const expandOwnedMarketIcons = (owned) => {
  const list = Array.isArray(owned) ? owned.filter(id => typeof id === 'string') : [];
  const out = new Set(list);
  list.forEach(id => { const group = BREEDER_ICON_GROUP_BY_MEMBER[id]; if (group) group.memberIds.forEach(m => out.add(m)); });
  return [...out];
};
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
// モンスターの3枚の値段(2026-10-03・ユーザー指示「ブリーダーポイント 1、ビートポイント 100」)。どちらの交換所でも買える
const PROFILE_FRAME_MONSTER_SHOPS = Object.freeze([
  Object.freeze({ shop:'breederPoint', cost:1 }),
  Object.freeze({ shop:'beatPoint', cost:100 }),
]);
// ラグナロクの枠はビートPだけ高い(2026-10-03 ユーザー指示で1000P、のち10000Pへ変更)。ブリーダーPは1P
const PROFILE_FRAME_RAGNAROK_SHOPS = Object.freeze([
  Object.freeze({ shop:'breederPoint', cost:1 }),
  Object.freeze({ shop:'beatPoint', cost:10000 }),
]);
// モンヒロビートの通算クリア回数(「これからの回数」を数える専用キー・2026-10-03)。
// ★既存の mh_rhythm_best_v1 は「曲×難易度ごとにクリアしたか」しか持たないので、回数は別に数える。
//   公開より前の記録は入れない(0から数える・ユーザー選択)。
const RHYTHM_CLEAR_TOTAL_KEY = 'mh_rhythm_clear_total_v1';
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
  // ★srcSmall は小さく出す所(マルチの部屋の上の並び28px・チャット32px)用に、前もって縮めた絵(2026-10-19 社長「小さい所用にフレームを出す」)。
  //   大きい絵をその場で縮めると、細かい飾りが点の散ったように潰れた。細かい点を均してから、28〜32px×画素密度3に合う大きさへ縮めてある。
  //   穴の比(hole)は大きい絵と同じなので、位置合わせは profileFrameImageStyle をそのまま使う。絵を差し替えたら small も作り直す
  //
  // 【released と unlock の役割はまったく別】(2026-09-16)
  //   released … **描いてよいか**。false のものは選択画面にも出ないし、
  //               ランキングで他人の記録に入っていても描かれない
  //   unlock   … **自分が選べるか**。書いてあるものは条件を満たすまで選べない
  //               (描くのは自由。持っている人の枠は、他人の画面でもちゃんと出る)
  //   ★ここを一緒にすると「解放した人の枠が他人の画面で消える」ので、必ず分けること。
  // モンスターの3枚は助手とは無関係。条件を達成すると、ブリーダーP交換所かビートP交換所で買える
  // (2026-10-03・ユーザー指示。値段は ブリーダーP 1 / ビートP 100)。
  //   unlock.shops     … どの交換所で何Pか(両方に並ぶ)。下の「売るフレーム」の節を見る
  //   unlock.condition … 買えるようになる条件。達成するまでは交換所で鍵つき(買えない)
  // ★条件は「買えるか」だけを決める。買ったあとに条件を割っても枠は残る(mh_profile_frame_owned_v1)。
  { id:'frame_mocchi', name:'モッチー', kind:'image', released:true, hole:0.656,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'speciesRebirth', lineage:'mocchi', count:1, text:'モッチー種(モッチー・ミタラシ・剣士モッチー)を1回以上限界突破する' } },
    src:'images/profile-frames/mocchi.png?v=7c842f6ed7bf', srcSmall:'images/profile-frames/small/mocchi.png?v=2d23bd4ec6b9',
    desc:'桜の花びらと桜もちをあしらった、モッチーの和風フレーム。' },
  { id:'frame_moo', name:'ムー', kind:'image', released:true, hole:0.682,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'difficultyCleared', difficulty:'Master', text:'バトルの難易度マスター以上をクリアする' } },
    src:'images/profile-frames/moo.png?v=fc64f9da9806', srcSmall:'images/profile-frames/small/moo.png?v=2c1f217a83e6',
    desc:'紫の宝玉と金の角をいただく、ラスボス「ムー」のフレーム。' },
  { id:'frame_suezo_beat', name:'スエゾービート', kind:'image', released:true, hole:0.724,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'rhythmClears', count:10, text:'モンヒロビートを10回以上クリアする' } },
    src:'images/profile-frames/suezo-beat.png?v=0b43f621dd89', srcSmall:'images/profile-frames/small/suezo-beat.png?v=ed7ff5b7d2b4',
    desc:'スエゾーと音符が跳ねる、モンヒロビートのフレーム。' },
  // ==================== モンスターの枠7枚(2026-10-03) ====================
  // ユーザーから受け取った透過PNG(1254px → 384pxへ軽くした。ASSETS.md)。
  // 7枚。スエゾー・ゴーレム・ライガー・ハム・ピクシー・ミーアはそのモンスターを1回「転生」すると、ブリーダーP交換所で買える(ビートP交換所は条件なし)。
  // ラグナロクはバトルの難易度ラグナロクをクリアすると、ブリーダーP交換所で買える(ビートP交換所は条件なし・10000P)。
  // ★条件に shops:['breederPoint'] と書いたぶん、ビートP交換所では条件なしで買える。
  { id:'frame_suezo', name:'スエゾー', kind:'image', released:true, hole:0.573,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Suezo', count:1, shops:['breederPoint'], text:'スエゾーを1回転生する' } },
    src:'images/profile-frames/suezo.png?v=6f617e7aa00a', srcSmall:'images/profile-frames/small/suezo.png?v=af78e8da3297',
    desc:'黄金の輪に、スエゾーがぺろりと顔を出す、きらめくフレーム。' },
  { id:'frame_golem', name:'ゴーレム', kind:'image', released:true, hole:0.755,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Golem', count:1, shops:['breederPoint'], text:'ゴーレムを1回転生する' } },
    src:'images/profile-frames/golem.png?v=84bc05c75f8d', srcSmall:'images/profile-frames/small/golem.png?v=b7677178c19c',
    desc:'ごつごつした白い岩が、ぐるりと連なる、ゴーレムの輪。' },
  { id:'frame_tiger', name:'ライガー', kind:'image', released:true, hole:0.703,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Tiger', count:1, shops:['breederPoint'], text:'ライガーを1回転生する' } },
    src:'images/profile-frames/tiger.png?v=3ced385df138', srcSmall:'images/profile-frames/small/tiger.png?v=2a743d53deb4',
    desc:'蒼い結晶と金の飾りをまとった、ライガーの輪。' },
  { id:'frame_ham', name:'ハム', kind:'image', released:true, hole:0.792,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Ham', count:1, shops:['breederPoint'], text:'ハムを1回転生する' } },
    src:'images/profile-frames/ham.png?v=0d4103bbbab8', srcSmall:'images/profile-frames/small/ham.png?v=88da9ab250ff',
    desc:'ふわふわの毛並みと肉球、桃色の耳をあしらった、ハムの輪。' },
  { id:'frame_pixie', name:'ピクシー', kind:'image', released:true, hole:0.750,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Pixie', count:1, shops:['breederPoint'], text:'ピクシーを1回転生する' } },
    src:'images/profile-frames/pixie.png?v=a9a36e085925', srcSmall:'images/profile-frames/small/pixie.png?v=fb6479bd1636',
    desc:'ハートの宝石とこうもりの羽が並ぶ、ピクシーの輪。' },
  { id:'frame_mia', name:'ミーア', kind:'image', released:true, hole:0.734,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'monsterReincarnate', monsterId:'Mia', count:1, shops:['breederPoint'], text:'ミーアを1回転生する' } },
    src:'images/profile-frames/mia.png?v=fc46dfb38806', srcSmall:'images/profile-frames/small/mia.png?v=25df0abdb3a3',
    desc:'白い羽と色とりどりのリボンで飾った、ミーアの輪。' },
  { id:'frame_ragnarok', name:'ラグナロク', kind:'image', released:true, hole:0.672,
    unlock:{ shops:PROFILE_FRAME_RAGNAROK_SHOPS, condition:{ kind:'difficultyCleared', difficulty:'RAGNAROK', shops:['breederPoint'], text:'バトルの難易度ラグナロクをクリアする' } },
    src:'images/profile-frames/ragnarok.png?v=b6e9fe525ece', srcSmall:'images/profile-frames/small/ragnarok.png?v=145848170f50',
    desc:'燃えさかる炎をまとう黒い竜が、ぐるりと取り巻く輪。' },
  // ==================== ハロウィンとモンヒロビート用の4枚(2026-10-05 取り込み・2026-10-20 公開) ====================
  // ユーザーから受け取ったJPEG(透過なし・黒背景)を、枠の外と穴の中の黒を透明にして取り込んだ(384px)。
  // 2026-10-20 社長の決定で公開。名前も社長が決めた(id は取り込んだときのまま。変えると選んだ人・ランキングの記録が外れる)。
  //   ハロウィン・恐 … マーケットで売る(値段はモンスターの枠と同じ)。レイドの大王ジャックがみんなで倒されるか、イベントが終わると、全員が買えるようになる(condition.kind:'raidJackBossDown')
  //   ハロウィン・妖 … レイド「カボチャの大王ジャック」の大王まで倒せたときの終章を見た参加者へ、ギフトで1回だけ届ける(unlock.gift)
  //   ウンディーネ3姉妹・ザン・エイキ … 対象のマスモンのビートLvを、それぞれ50以上にするとマーケットで買える(condition.kind:'buddyBeatLevel')
  { id:'frame_halloween_night', name:'ハロウィン・恐', kind:'image', released:true, hole:0.521,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'raidJackBossDown', text:'カボチャの大王ジャックが倒されるか、ハロウィン・ナイトが終わると買えるようになります' } },
    src:'images/profile-frames/halloween-night.png?v=647f32308d31', srcSmall:'images/profile-frames/small/halloween-night.png?v=5c47af1a0742',
    desc:'青い炎と骨、音符の輪に、ハロウィンの夜のモンスターたちが集まる、ちょっとこわいフレーム。' },
  { id:'frame_halloween_pumpkin', name:'ハロウィン・妖', kind:'image', released:true, hole:0.583,
    unlock:{ gift:'raidJackEnding' },
    src:'images/profile-frames/halloween-pumpkin.png?v=f68b833002c2', srcSmall:'images/profile-frames/small/halloween-pumpkin.png?v=f4aac89375ec',
    desc:'大きなパンプキンと魔女の女の子、包帯のうさぎ、ゴーストが並ぶ、にぎやかなハロウィンのフレーム。' },
  { id:'frame_eiki_zan', name:'ザン・エイキ', kind:'image', released:true, hole:0.656,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'buddyBeatLevel', monsterIds:['Zan', 'Eiki'], level:50, text:'ザンとエイキのマスモンを、それぞれビートLv50以上にする' } },
    src:'images/profile-frames/eiki-zan.png?v=535efca30954', srcSmall:'images/profile-frames/small/eiki-zan.png?v=3ca4fedaece2',
    desc:'桜と夜空のステージで、エイキとザンがギターを奏でる、モンヒロビートのフレーム。' },
  { id:'frame_undine_beat', name:'ウンディーネ3姉妹', kind:'image', released:true, hole:0.604,
    unlock:{ shops:PROFILE_FRAME_MONSTER_SHOPS, condition:{ kind:'buddyBeatLevel', monsterIds:['Undine', 'Yaobikuni', 'Snegurochka'], level:50, text:'ウンディーネ・ヤオビクニ・スネグーラチカのマスモンを、それぞれビートLv50以上にする' } },
    src:'images/profile-frames/undine-beat.png?v=71fc5b699b36', srcSmall:'images/profile-frames/small/undine-beat.png?v=9d34ec0bd2fd',
    desc:'水と泡のステージで、ウンディーネの3姉妹が歌う、モンヒロビートのフレーム。' },
  // ==================== 助手の仲良し度でもらえる枠(2026-09-16) ====================
  // 助手1人につき3枚。その助手との仲良し度が Lv2 / Lv5 / Lv7 になると自動でもらえる。
  // ★unlock を書いた枠は「もらうまで選べない」だけで、描くのは自由(released:true)。
  // ★並びは助手の登場順(みゅあ → きき → ももすけ)。Lvの小さい順に3枚ずつ。
  //
  // みゅあの3枚。呼び分けはアシストカードの3段階
  // (BREEDER_EVO_NAMES.mua の 愛 → 深愛 → 慈愛)にそろえてある。
  { id:'frame_mua_1', name:'みゅあ・愛', kind:'image', released:true, hole:0.669,
    unlock:{ assistantId:'mua', bondLevel:2 },
    src:'images/profile-frames/mua-1.png?v=cf21c351ff0a', srcSmall:'images/profile-frames/small/mua-1.png?v=cff43ee9669e',
    desc:'桜色のリボンと星をあしらった、みゅあの細いリース。' },
  { id:'frame_mua_2', name:'みゅあ・深愛', kind:'image', released:true, hole:0.745,
    unlock:{ assistantId:'mua', bondLevel:5 },
    src:'images/profile-frames/mua-2.png?v=ec2adae9b6f6', srcSmall:'images/profile-frames/small/mua-2.png?v=0d8f01b1ce71',
    desc:'金の飾りと真珠、虹のリボンで華やかにした、みゅあのリース。' },
  { id:'frame_mua_3', name:'みゅあ・慈愛', kind:'image', released:true, hole:0.719,
    unlock:{ assistantId:'mua', bondLevel:7 },
    src:'images/profile-frames/mua-3.png?v=d18cf1740410', srcSmall:'images/profile-frames/small/mua-3.png?v=3c302cc16d8e',
    desc:'みゅあ本人が寄り添って眠る、いちばん特別なリース。' },
  // ききの3枚。同じ意匠を段階的に豪華にしたもので、呼び分けは教えカードの3段階
  // (BREEDER_EVO_NAMES.kiki の 応援 → 本気 → 全力全開)にそろえてある。
  { id:'frame_kiki_ouen', name:'きき・応援', kind:'image', released:true, hole:0.755,
    unlock:{ assistantId:'kiki', bondLevel:2 },
    src:'images/profile-frames/kiki-ouen.png?v=09b871ec464c', srcSmall:'images/profile-frames/small/kiki-ouen.png?v=765c2b84055f',
    desc:'紅いリボンと白いくつ下をあしらった、ききのフレーム。' },
  { id:'frame_kiki_honki', name:'きき・本気', kind:'image', released:true, hole:0.698,
    unlock:{ assistantId:'kiki', bondLevel:5 },
    src:'images/profile-frames/kiki-honki.png?v=fb89e34bd92b', srcSmall:'images/profile-frames/small/kiki-honki.png?v=9383373c0f24',
    desc:'金の縁飾りと桜、幾重ものリボンで華やかにした、ききのフレーム。' },
  { id:'frame_kiki_zenryoku', name:'きき・全力全開', kind:'image', released:true, hole:0.677,
    unlock:{ assistantId:'kiki', bondLevel:7 },
    src:'images/profile-frames/kiki-zenryoku.png?v=88238cde0306', srcSmall:'images/profile-frames/small/kiki-zenryoku.png?v=393ad230d39d',
    desc:'髪とリボンが渦を巻き、星とハートが輝く、ききのいちばん豪華なフレーム。' },
  // ももすけの3枚。ももすけにはまだアシストカードが無いので、呼び分けを先に決めてある
  // (2026-09-16・ユーザーが選択)。おねだり → だだこね → 独り占め。
  // カードを実装するときも、この3段階をそのまま使う
  // (BREEDER_EVO_NAMES へ momosuke:['ももすけのおねだり','ももすけのだだこね','ももすけの独り占め'])。
  { id:'frame_momosuke_1', name:'ももすけ・おねだり', kind:'image', released:true, hole:0.737,
    unlock:{ assistantId:'momosuke', bondLevel:2 },
    src:'images/profile-frames/momosuke-1.png?v=85af4bc2f2e2', srcSmall:'images/profile-frames/small/momosuke-1.png?v=618769cbac66',
    desc:'黒とピンクのリボンに、うさぎと三日月をあしらった細い輪。' },
  { id:'frame_momosuke_2', name:'ももすけ・だだこね', kind:'image', released:true, hole:0.714,
    unlock:{ assistantId:'momosuke', bondLevel:5 },
    src:'images/profile-frames/momosuke-2.png?v=9c1adfb2e8b6', srcSmall:'images/profile-frames/small/momosuke-2.png?v=4503f619c3a6',
    desc:'大きな三日月と魔法陣、こうもりの羽で飾った、ももすけの輪。' },
  { id:'frame_momosuke_3', name:'ももすけ・独り占め', kind:'image', released:true, hole:0.714,
    unlock:{ assistantId:'momosuke', bondLevel:7 },
    src:'images/profile-frames/momosuke-3.png?v=15ed59e8cf51', srcSmall:'images/profile-frames/small/momosuke-3.png?v=5ca7a59b24ff',
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
// 贈り物で届く枠(2026-10-20)。売らない・仲良し度でもない。決まった出来事で、ギフトボックスへ1回だけ届く。
//   gift:'raidJackEnding' … レイド「カボチャの大王ジャック」で大王まで倒せたときの終章(raid_jack_ending_cleared)を見た参加者へ
// ★届くまでは選択画面にも出さない(手に入れ方を先に見せない)。届いたら mh_profile_frame_owned_v1 に入る(ほかの枠と同じ入れ物)
const PROFILE_FRAME_GIFT_KINDS = Object.freeze(['raidJackEnding']);
// プレゼントで届く枠の、マーケットの札に出す手に入れ方(買えない枠を条件だけ並べる)
const PROFILE_FRAME_GIFT_LABELS = Object.freeze({ raidJackEnding: 'ジャック大王を倒すと届く' });
const profileFrameGift = (frame) => {
  const gift = frame && frame.unlock && frame.unlock.gift;
  return (typeof gift === 'string' && PROFILE_FRAME_GIFT_KINDS.includes(gift)) ? gift : null;
};
// いま選べるか。条件の無い枠は常に true、条件つきは「もらった記録」にあるときだけ true
const profileFrameOwned = (id, owned) => {
  const frame = profileFrameById(id);
  if (!frame || frame.released !== true) return false;
  // もらう条件(仲良し度)か売り値が付いている枠は、手に入れた記録がなければ選べない。どちらも無い枠は最初から選べる
  if (!profileFrameUnlock(frame) && !profileFrameSale(frame) && !profileFrameGift(frame)) return true;
  return normalizeOwnedProfileFrames(owned).includes(frame.id);
};
// ==== 売るフレーム(2026-10-03 ユーザー指示「フレームも販売実装を予定してるから、ブリーダーポイントとビートポイントのとこに実装できる準備をしといて」) ====
// ★まだ売り物は無い。ここは「枠に売り値を書けば、交換所に並んで買える」ための土台だけ。
// 売る枠は `unlock:{ shop:'breederPoint'|'beatPoint', cost:1500 }` を書く。
//   shop … どの交換所で売るか(PROFILE_FRAME_SHOPS)。breederPoint=ブリーダーP交換所 / beatPoint=ビートP交換所
//   cost … 値段(その交換所の通貨で)。1以上の整数
// ★助手の仲良し度でもらう枠(unlock:{assistantId,bondLevel})とは別の種類。同じ枠に両方は書かない。
// ★「unlock が無い枠は最初から全員が選べる」という決まりは変えない。だから売る枠を unlock なしにして
//   released:true にすると全員に無料で出てしまう。売る枠は必ず shop と cost を書く(検査が見張る)。
// ★買うと mh_profile_frame_owned_v1 にidが入る(助手の仲良し度でもらったときと同じ入れ物。新しい保存キーは作らない)。
const PROFILE_FRAME_SHOPS = Object.freeze({
  breederPoint: Object.freeze({ label:'ブリーダーP交換所', currency:'breederPoint' }),
  beatPoint:    Object.freeze({ label:'ビートP交換所',     currency:'beatPoint' }),
});
// その枠の売り値の一覧。`unlock:{shop,cost}`(1か所だけ) と `unlock:{shops:[{shop,cost},…]}`(複数の交換所) のどちらも読める。
// 値段が正しくないものは入れない
const profileFrameSales = (frame) => {
  const unlock = frame && frame.unlock;
  if (!unlock || typeof unlock !== 'object') return [];
  const list = Array.isArray(unlock.shops) ? unlock.shops : (unlock.shop !== undefined ? [unlock] : []);
  const seen = new Set();
  return list.map(entry => {
    const shop = entry && PROFILE_FRAME_SHOPS[entry.shop] ? entry.shop : '';
    const cost = Math.floor(Number(entry && entry.cost));
    return (shop && Number.isFinite(cost) && cost >= 1) ? { shop, cost, currency: PROFILE_FRAME_SHOPS[shop].currency } : null;
  }).filter(sale => sale && !seen.has(sale.shop) && seen.add(sale.shop));
};
// その枠の売り値(最初の1つ)。売り物でなければ null
const profileFrameSale = (frame) => profileFrameSales(frame)[0] || null;
// 指定の交換所での売り値。そこで売っていなければ null
const profileFrameSaleIn = (frame, shop) => profileFrameSales(frame).find(sale => sale.shop === shop) || null;
// 指定の交換所で売っている枠(公開済みだけ。並びは PROFILE_FRAMES のとおり)
const profileFramesForSale = (shop) => releasedProfileFrames().filter(frame => !!profileFrameSaleIn(frame, shop));
// 買える条件(2026-10-03)。条件が無ければ null(いつでも買える)。形は { kind, text, … }
//   kind:'speciesRebirth'  … lineage の種(主血統)のモンスターを count 回以上限界突破
//   kind:'monsterReincarnate' … monsterId のモンスター(マスモン)を count 回以上「転生」(reincarnateCount。限界突破とは別の仕組み)
//   kind:'difficultyCleared' … difficulty 以上の難易度をクリア
//   kind:'rhythmClears'    … モンヒロビートを count 回以上クリア(通算。RHYTHM_CLEAR_TOTAL_KEY)
//   kind:'buddyBeatLevel'  … monsterIds の種ごとに、自分のマスモンのビートLv(RHYTHM_BUDDY_KEY の経験値)が level 以上(2026-10-20)。
//                            同じ種のマスモンが何体かいるときは、いちばん高い子で見る。全部の種がそろって達成
//   kind:'raidJackBossDown' … レイド「カボチャの大王ジャック」の大王が、みんなで倒されたあと(共有の合計・raidJackBossDown。2026-10-20)か、
//                            倒されなくてもレイドの期間が終わったあと(raidJackWindowAt が 'after'・社長「終わったら解放」)。
//                            自分が参加したかは問わない。text はそのまま鍵の文になる(ネタバレにならない書き方で)
const PROFILE_FRAME_CONDITION_KINDS = Object.freeze(['speciesRebirth', 'monsterReincarnate', 'difficultyCleared', 'rhythmClears', 'buddyBeatLevel', 'raidJackBossDown']);
const profileFrameCondition = (frame) => {
  const condition = frame && frame.unlock && frame.unlock.condition;
  return (condition && PROFILE_FRAME_CONDITION_KINDS.includes(condition.kind)) ? condition : null;
};
// その交換所で買うときに必要な条件。条件に `shops:['breederPoint']` と書いてあれば、その交換所だけ条件つき
// (書いていなければどの交換所でも条件つき)。条件が無い・その交換所には条件が無いときは null(いつでも買える)
const profileFrameConditionFor = (frame, shop) => {
  const condition = profileFrameCondition(frame);
  if (!condition) return null;
  return (Array.isArray(condition.shops) && !condition.shops.includes(shop)) ? null : condition;
};
// 鍵つきの札に出す、条件の短い文(2026-10-20 社長の決定・改善部の指摘 L3)。2行に収めるので、折ってよい区切りごとの配列で返す。
// ★文は unlock.condition の中身(種類・モンスター・難易度・回数・Lv.)から作る。condition.text を書き写さない。
//   読めない条件は null(呼ぶ側が「条件を達成すると買えます」に戻す)。shop を渡すと、その交換所にかかる条件だけを見る
const profileFrameConditionShort = (frame, shop = null) => {
  const c = shop ? profileFrameConditionFor(frame, shop) : profileFrameCondition(frame);
  if (!c) return null;
  const monName = (id) => (typeof ALL_PLAYER_MONSTERS !== 'undefined' && ALL_PLAYER_MONSTERS[id] && ALL_PLAYER_MONSTERS[id].name) || id;
  const count = Math.max(1, Math.floor(Number(c.count) || 1));
  if (c.kind === 'monsterReincarnate') return [`${monName(c.monsterId)}を`, count > 1 ? `${count}回転生` : '転生'];
  if (c.kind === 'speciesRebirth') {
    const lineage = typeof MONSTER_LINEAGES !== 'undefined' ? MONSTER_LINEAGES[c.lineage] : null;
    return [`${(lineage && lineage.name) || c.lineage}種を`, count > 1 ? `${count}回限界突破` : '限界突破'];
  }
  if (c.kind === 'difficultyCleared') {
    const d = c.difficulty === 'RAGNAROK' && typeof RAGNAROK_SETTING !== 'undefined' ? RAGNAROK_SETTING
      : (typeof DIFFICULTY_SETTINGS !== 'undefined' ? DIFFICULTY_SETTINGS[c.difficulty] : null);
    return [`${(d && (d.japanese || d.label)) || c.difficulty}を`, 'クリア'];
  }
  if (c.kind === 'rhythmClears') return ['モンヒロビートを', `${count}回クリア`];
  if (c.kind === 'buddyBeatLevel') {
    const ids = Array.isArray(c.monsterIds) ? c.monsterIds : [];
    const level = Math.max(1, Math.floor(Number(c.level) || 1));
    // 2体までは名前を並べる(ザン・エイキ)。3体以上は枠の名前(ウンディーネ3姉妹)
    return [ids.length <= 2 ? ids.map(monName).join('・') : (frame && frame.name) || '', `ビートLv${level}`];
  }
  if (c.kind === 'raidJackBossDown') return ['ジャックを倒すか', 'イベント終了で'];
  return null;
};
// 売る枠として書かれているのに、売り値が正しくない(shop だけ・cost が0など)枠のid。検査用
const profileFramesWithBrokenSale = () => PROFILE_FRAMES
  .filter(frame => frame.unlock && (frame.unlock.shop !== undefined || frame.unlock.shops !== undefined)
    && (profileFrameSales(frame).length === 0
      || (Array.isArray(frame.unlock.shops) && profileFrameSales(frame).length !== frame.unlock.shops.length)
      || (frame.unlock.condition !== undefined && !profileFrameCondition(frame))))
  .map(frame => frame.id);
// ブリーダーP交換所で売る枠は、PROFILE_FRAMES の売り値(unlock.shop / unlock.shops の breederPoint)から商品を**自動で**作る
// (2026-10-03・手で書き写さない。枠に売り値を書けば並ぶ)。type:'frame' はプロフィールのフレーム。
// 買う処理(buyMarketItem)・所持の判定(isMarketItemOwned)・見た目(MarketProductCard)がこの type を扱う。
// ★ビートP交換所で売る枠(beatPoint)は data/rhythm-event.js が RHYTHM_EVENT_POINT_SHOP_FRAME_OFFERS を作る。
// ★profileFrameSales を使うので、その定義より後ろに置く(const は宣言より前に呼べない)。
PROFILE_FRAMES
  .filter(frame => frame.released === true && profileFrameSaleIn(frame, 'breederPoint'))
  .forEach(frame => {
    const sale = profileFrameSaleIn(frame, 'breederPoint');
    BREEDER_MARKET_ITEMS.push({ id:frame.id, name:`${frame.name}のフレーム`, type:'frame', cost:sale.cost, desc:frame.desc || '' });
  });
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

// ==================== 助手の着替え(2026-10-03 ユーザー指示「助手の着替え機能を作りたい。着替え自体はマーケットに販売する予定」) ====================
//
// 助手ごとに「着替え」を持てる。プロフィールの「着替え」から、持っている服へ着替える。
// 着替えると、その助手の吹き出しの顔・立ち絵が服の絵に変わる(絵の出し口は data/assistants.js の
// assistantFaceImage / assistantFullImage の1か所だけ)。
//
// ★まだ売り物は無い(絵が用意できていない)。ここは「ASSISTANT_COSTUMES に1件足せば、マーケットに並んで
//   買えて、プロフィールで着替えられる」ための土台だけ。画面側のコードは1行も触らなくてよい。
// ★足し方(1件):
//     { id:'mua_summer_v1', assistantId:'mua', name:'夏のワンピース', desc:'…', released:true,
//       icon:'<服のフォルダ>/face/<imagePrefix>_happy.PNG',   // 商品カードの小さな絵(顔アイコン)
//       imageDir:'<服の絵を置くフォルダ>',   // 立ち絵 <imagePrefix>_<表情>.PNG と face/<imagePrefix>_<表情>.PNG を置く(置き場は images/assistant/ の下に作る)
//       price:{ diamond:3000, beatPoint:1500 } }             // 売る交換所と値段。書いた交換所にだけ並ぶ(どちらか片方でもよい)
//   絵は assistants.js の表情8種(normal/happy/wink/surprise/troubled/angry/crying/excited)をそろえる。
//   足りない表情は、その服の normal ではなく**元の服の絵**へ落ちる(絵切れを起こさない)。
// ★released:true にして price を書かないと、全員が無料で着られてしまう。price は必ず書く(検査が見張る)。
// ★保存は新しいキー2つだけ。既存の mh_* は読みも書きも変えない(CLAUDE.md ⑦)。
//     mh_assistant_costume_owned_v1 … 買った服のid(配列)。一度買ったら外さない
//     mh_assistant_costume_worn_v1  … 助手ごとに今着ている服 { 助手id: 服id }。無い助手は元の服
const ASSISTANT_COSTUME_OWNED_KEY = 'mh_assistant_costume_owned_v1';
const ASSISTANT_COSTUME_WORN_KEY = 'mh_assistant_costume_worn_v1';
// 公開フラグ。false のあいだは、売る服が1着も無ければ プロフィールの「着替え」もマーケットの「着替え」タブも出さない
// (空の画面を見せない)。服を1着でも released:true にすると、フラグに関係なく出る。
const ASSISTANT_COSTUME_PUBLIC_RELEASE = false;
// ★期間で売り方が変わる服は price の代わりに saleWindows を書く:
//     saleWindows:[{ shop:'beatPoint', cost:1000, from:開始, until:終了 }, { shop:'diamond', cost:100000, from:開始 }]
//   from(その時刻から)・until(その時刻の前まで)はどちらも省いてよい。いま有効な窓だけが売り物になる
//   (見るたびに数え直す。CLAUDE.md ⑥-4)。このとき released は getter にして、公開前は false を返す
// ハロウィン・ナイトの衣装(2026-10-03・ユーザー指示「みゅあ、きき、ももはハロウィンコスプレ衣装で登場」「助手の着替え機能実装。
// マーケットに販売。1000ビートポイント。ハロウィンイベント後解放、100000ダイヤ」)。
//   イベント中(10/4 8:00〜11/1 3:59)はビートP交換所で1000P、終わったあとはダイヤショップで100000ダイヤ。
//   絵は images/assistant/halloween/(立ち絵 <接頭辞>_<表情>.PNG と face/ の顔アイコン)
// ★期間は data/rhythm-event.js の HALLOWEEN_NIGHT_START_AT / END_AT と同じ(あちらは breeder.js より後に読み込まれるので、ここに写して持つ。
//   食い違わないことは tools/mode/halloween-night-check.js が見張る)
const ASSISTANT_COSTUME_HALLOWEEN_START_AT = '2026-10-04T08:00:00+09:00';
const ASSISTANT_COSTUME_HALLOWEEN_END_AT = '2026-11-01T04:00:00+09:00';
const halloweenCostume = (assistantId, imagePrefix, name, desc) => ({
  id: `${assistantId}_halloween_2026`, assistantId, name, desc,
  get released() { return Date.now() >= Date.parse(ASSISTANT_COSTUME_HALLOWEEN_START_AT); },
  icon: `images/assistant/halloween/face/${imagePrefix}_happy.PNG`,
  imageDir: 'images/assistant/halloween',
  saleWindows: Object.freeze([
    Object.freeze({ shop:'beatPoint', cost:1000, from:ASSISTANT_COSTUME_HALLOWEEN_START_AT, until:ASSISTANT_COSTUME_HALLOWEEN_END_AT }),
    Object.freeze({ shop:'diamond', cost:100000, from:ASSISTANT_COSTUME_HALLOWEEN_END_AT }),
  ]),
});
// みゅあの新しい衣装(2026-10-27 社長「みゅあの新衣装解放。バトルカードでみゅあのマスターに勝つと解放。他の衣装の同じように売られる。新衣装は準備中」)。
//   名前「デュエルマスター」・売り場はダイヤショップ 100,000 だけ(社長)。絵を入れて公開(10/27 社長「公開まで進めてかまわない」)。
// ★解放の条件は unlock に書く: MFバトルカードの助手と対戦で、相手 cardFoe の難易度 cardLevel に1回でも勝つ。
//   勝つ前はマーケットに出さない(「近日追加」の札も出さない)。解放の覚え方は下の ASSISTANT_COSTUME_UNLOCKED_KEY
const ASSISTANT_COSTUME_MUA_MASTER_RELEASE = true;
const muaCardMasterCostume = Object.freeze({
  id: 'mua_card_master_v1', assistantId: 'mua',
  name: 'デュエルマスター', desc: 'MFバトルカードの決闘者ふうの衣装。黒い服に白と青のマント、赤い指なし手袋と金の三角のペンダントです。',
  get released() { return ASSISTANT_COSTUME_MUA_MASTER_RELEASE === true; },
  // 絵は社長が用意(10/27)。元の絵は tools/art-sources/assistants/mua-card-master/。立ち絵は 768×1024、顔は make-assistant-faces.js で作った
  // (当て方: 1ほほえむ=normal/2手を差し出して笑う=happy/3ウインク=wink/4驚く=surprise/5照れ=troubled/6怒る=angry/7もじもじ=crying/8指さして笑う=excited)
  icon: 'images/assistant/card-master/face/myua_happy.PNG?v=e08db4e730ee',
  imageDir: 'images/assistant/card-master',
  price: Object.freeze({ diamond: 100000 }),
  unlock: Object.freeze({ cardFoe: 'mua', cardLevel: 'master' }),
  // 解放する前に、プロフィールの着替えで押したとき出す案内(遊ぶ人向けの文)
  unlockHow: 'MFバトルカードの「助手と対戦」で、みゅあの MASTER に勝つと、マーケットのダイヤショップに並びます',
});
const ASSISTANT_COSTUMES = Object.freeze([
  halloweenCostume('mua', 'myua', 'ハロウィンの魔女', 'ハロウィン・ナイトの衣装。大きな魔女帽子とカボチャのステッキのコスプレです。'),
  halloweenCostume('kiki', 'kiki', 'ハロウィンのうさ耳フード', 'ハロウィン・ナイトの衣装。オレンジと黒のうさ耳リボンとパーカーのコスプレです。'),
  halloweenCostume('momosuke', 'momosuke', 'ハロウィンの小悪魔', 'ハロウィン・ナイトの衣装。ふわふわの耳と小さな翼の小悪魔コスプレです。'),
  muaCardMasterCostume,
]);
// ---- 解放が要る服(unlock を持つ服)の覚え方(2026-10-27) ----
// 新しいキー mh_assistant_costume_unlocked_v1 … 解放された服のidの配列。足すだけで消さない(CLAUDE.md ⑦)。
// 解放しているとみなすのは、次のどちらか:
//   ① 新しいキーに id が入っている
//   ② MFバトルカードの記録 mh_card_record_detail_v1 の foes[相手].levels[難易度] が1以上(前から勝っている人のため。このキーは読むだけ)
//   ③ もとの記録 mh_card_record_v1 の最近の30戦(recent)に { who:相手, level:難易度, outcome:'win' } がある
//      (②は 10/27 の #4034 からのキーで、それより前の勝ちは最近の30戦から起こした分しか無い。カード部リプレイくんの指摘。読むだけ)
// 勝った瞬間に覚えるのはカード部の精算(84 の助手と対戦の記録を足す所)。そこで assistantCostumeUnlockEntry を呼んで
// 保存の1件({ key, before, next })を足し、保存できたら setAssistantCostumeUnlockedNow で今の画面へも伝える。
const ASSISTANT_COSTUME_UNLOCKED_KEY = 'mh_assistant_costume_unlocked_v1';
// 壊れた値でも必ず文字列の配列へ落とす(持っている服と同じ直し方)
const normalizeUnlockedAssistantCostumes = (value) => normalizeOwnedAssistantCostumes(value);
// その服をカードの記録(mh_card_record_detail_v1 の生の値)だけで解放しているか
const assistantCostumeUnlockedByCardRecord = (costume, cardRecordDetail) => {
  const rule = costume && costume.unlock;
  if (!rule || typeof rule.cardFoe !== 'string' || typeof rule.cardLevel !== 'string') return false;
  const detail = (cardRecordDetail && typeof cardRecordDetail === 'object' && !Array.isArray(cardRecordDetail)) ? cardRecordDetail : {};
  const foes = (detail.foes && typeof detail.foes === 'object' && !Array.isArray(detail.foes)) ? detail.foes : {};
  const foe = foes[rule.cardFoe];
  const levels = (foe && typeof foe === 'object' && foe.levels && typeof foe.levels === 'object') ? foe.levels : {};
  const wins = Number(levels[rule.cardLevel]);
  return Number.isFinite(wins) && wins >= 1;
};
// その服を、もとの記録(mh_card_record_v1 の生の値)の最近の30戦だけで解放しているか
const assistantCostumeUnlockedByCardRecent = (costume, cardRecord) => {
  const rule = costume && costume.unlock;
  if (!rule || typeof rule.cardFoe !== 'string' || typeof rule.cardLevel !== 'string') return false;
  const recent = (cardRecord && typeof cardRecord === 'object' && Array.isArray(cardRecord.recent)) ? cardRecord.recent : [];
  return recent.some(x => x && typeof x === 'object' && x.who === rule.cardFoe && x.level === rule.cardLevel && x.outcome === 'win');
};
// 解放されている服のidの一覧(新しいキーの値と、カードの記録2つから起こしたものを合わせる)
const resolveUnlockedAssistantCostumes = (storedUnlocked, cardRecordDetail, cardRecord) => {
  const list = normalizeUnlockedAssistantCostumes(storedUnlocked);
  ASSISTANT_COSTUMES.forEach(costume => {
    if (costume && costume.unlock && !list.includes(costume.id)
      && (assistantCostumeUnlockedByCardRecord(costume, cardRecordDetail) || assistantCostumeUnlockedByCardRecent(costume, cardRecord))) list.push(costume.id);
  });
  return list;
};
// 助手と対戦で1試合が終わったとき、新しく解放される服のid(勝ち以外・当てはまらない相手や難易度は空)
const assistantCostumesUnlockedByCardWin = ({ who, level, outcome } = {}) => (outcome === 'win'
  ? ASSISTANT_COSTUMES.filter(costume => costume && costume.unlock && costume.unlock.cardFoe === who && costume.unlock.cardLevel === level).map(costume => costume.id)
  : []);
// カード部が呼ぶ口: 保存の1件 { key, before, next }。足すものが無ければ null(保存しない)。
//   storedRaw … 新しいキーの今の値(storeGet で読んだまま)。next は足すだけ(前の id は消さない)
const assistantCostumeUnlockEntry = (storedRaw, { who, level, outcome } = {}) => {
  const add = assistantCostumesUnlockedByCardWin({ who, level, outcome });
  const before = normalizeUnlockedAssistantCostumes(storedRaw);
  const next = normalizeUnlockedAssistantCostumes([...before, ...add]);
  return next.length === before.length ? null : { key: ASSISTANT_COSTUME_UNLOCKED_KEY, before: storedRaw, next };
};
// 画面が描く瞬間に見る「解放した服」。アプリが読み込みで入れ、カードの精算が勝ったあとに入れ直す
let ASSISTANT_COSTUME_UNLOCKED_NOW = [];
const setAssistantCostumeUnlockedNow = (list) => { ASSISTANT_COSTUME_UNLOCKED_NOW = normalizeUnlockedAssistantCostumes(list); };
const addAssistantCostumeUnlockedNow = (ids) => setAssistantCostumeUnlockedNow([...ASSISTANT_COSTUME_UNLOCKED_NOW, ...(Array.isArray(ids) ? ids : [])]);
// その服を売ってよいか(解放の条件が無い服はいつでも。条件がある服は解放してから)
const assistantCostumeUnlockedNow = (costume) => !!costume && (!costume.unlock || ASSISTANT_COSTUME_UNLOCKED_NOW.includes(costume.id));
const ASSISTANT_COSTUME_SHOPS = Object.freeze({
  diamond:   Object.freeze({ label:'ダイヤショップ', currency:'diamond' }),
  beatPoint: Object.freeze({ label:'ビートP交換所', currency:'beatPoint' }),
});
// 壊れた値・古い形が入っていても必ず文字列の配列へ落とす
const normalizeOwnedAssistantCostumes = (value) => {
  const list = Array.isArray(value) ? value : [];
  return [...new Set(list.filter(id => typeof id === 'string' && id.trim()).map(id => id.trim()))];
};
const releasedAssistantCostumes = () => ASSISTANT_COSTUMES.filter(costume => costume && costume.released === true);
const assistantCostumeById = (id) => releasedAssistantCostumes().find(costume => costume.id === id) || null;
// その助手の服(並びは ASSISTANT_COSTUMES のとおり)
const assistantCostumesFor = (assistantId) => releasedAssistantCostumes().filter(costume => costume.assistantId === assistantId);
// 着替えの入口を出すか(上のコメントのとおり)
const assistantCostumeFeatureOn = () => ASSISTANT_COSTUME_PUBLIC_RELEASE === true || releasedAssistantCostumes().length > 0;
// その服の売り値の一覧 [{ shop, cost, currency }]。値段が正しくないものは入れない
const assistantCostumeSales = (costume, nowMs = Date.now()) => {
  // 期間で売り方が変わる服(saleWindows)は、いま有効な窓だけを売り物にする
  if (costume && Array.isArray(costume.saleWindows)) {
    return costume.saleWindows.map(window => {
      const shop = window && window.shop;
      const cost = Math.floor(Number(window && window.cost));
      const fromMs = window && window.from ? Date.parse(window.from) : -Infinity;
      const untilMs = window && window.until ? Date.parse(window.until) : Infinity;
      const live = nowMs >= fromMs && nowMs < untilMs;
      return (ASSISTANT_COSTUME_SHOPS[shop] && Number.isFinite(cost) && cost >= 1 && live) ? { shop, cost, currency: ASSISTANT_COSTUME_SHOPS[shop].currency } : null;
    }).filter(Boolean);
  }
  const price = costume && costume.price;
  if (!price || typeof price !== 'object') return [];
  return Object.keys(ASSISTANT_COSTUME_SHOPS).map(shop => {
    const cost = Math.floor(Number(price[shop]));
    return (Number.isFinite(cost) && cost >= 1) ? { shop, cost, currency: ASSISTANT_COSTUME_SHOPS[shop].currency } : null;
  }).filter(Boolean);
};
const assistantCostumeSaleIn = (costume, shop) => assistantCostumeSales(costume).find(sale => sale.shop === shop) || null;
// 期間に関係なく、その交換所で売ることがある服か。読み込み時に商品の枠を作るために使う
// (枠を残しておき、売れるかどうかは見るたびに assistantCostumeSaleIn で数え直す)
const assistantCostumeEverSellsIn = (costume, shop) => {
  if (costume && Array.isArray(costume.saleWindows)) return costume.saleWindows.some(window => window && window.shop === shop);
  return !!costume && !!assistantCostumeSaleIn(costume, shop);
};
const assistantCostumeSaleEverCost = (costume, shop) => {
  const list = costume && Array.isArray(costume.saleWindows) ? costume.saleWindows : [];
  const window = list.find(w => w && w.shop === shop);
  return window ? Math.floor(Number(window.cost)) : (assistantCostumeSaleIn(costume, shop) || {}).cost;
};
// 売る服として書かれているのに値段が1つも読めない服のid。検査用
const assistantCostumesWithBrokenSale = () => releasedAssistantCostumes()
  .filter(costume => (Array.isArray(costume.saleWindows) ? costume.saleWindows.length === 0 : assistantCostumeSales(costume).length === 0)
    || Object.keys(costume.price || {}).some(shop => !ASSISTANT_COSTUME_SHOPS[shop])
    || (Array.isArray(costume.saleWindows) && costume.saleWindows.some(window => !window || !ASSISTANT_COSTUME_SHOPS[window.shop] || !(Math.floor(Number(window.cost)) >= 1))))
  .map(costume => costume.id);
// 持っているか(持っている服のidの配列に入っているか)
const assistantCostumeOwned = (id, owned) => normalizeOwnedAssistantCostumes(owned).includes(id) && !!assistantCostumeById(id);
// 保存してある「今着ている服」を { 助手id: 服id } に直す。
// 持っていない服・その助手の服ではないもの・消えた服は捨てて、元の服へ戻す(壊れた値でも落ちない)
const normalizeWornAssistantCostumes = (value, owned) => {
  const source = (value && typeof value === 'object' && !Array.isArray(value)) ? value : {};
  const have = new Set(normalizeOwnedAssistantCostumes(owned));
  const result = {};
  Object.keys(source).forEach(assistantId => {
    const costume = assistantCostumeById(source[assistantId]);
    if (costume && costume.assistantId === assistantId && have.has(costume.id)) result[assistantId] = costume.id;
  });
  return result;
};
// 画面が描く瞬間に見る「いま着ている服」。アプリが読み込み・着替え・購入のたびに入れ直す
// (assistants.js の画像の出し口が参照する。読み込み前は空 = どの助手も元の服)
let ASSISTANT_COSTUME_WORN_NOW = {};
const setAssistantCostumeWornNow = (worn) => { ASSISTANT_COSTUME_WORN_NOW = (worn && typeof worn === 'object') ? worn : {}; };
// イベントの会話(EVENT_REPLAYS の costumes)が、会話のあいだだけ着せる服 { 助手id: 服id }。持っていなくても着る(会話の絵はその回の演出なので)。
// 会話を閉じたら空へ戻る。アプリが描くたびに入れ直す(2026-10-04・ユーザー指摘「コスプレ版になってない」)
let ASSISTANT_COSTUME_STORY_NOW = {};
const setAssistantCostumeStoryNow = (map) => { ASSISTANT_COSTUME_STORY_NOW = (map && typeof map === 'object') ? map : {}; };
const assistantCostumeWornFor = (assistantId) => assistantCostumeById(ASSISTANT_COSTUME_STORY_NOW[assistantId] || ASSISTANT_COSTUME_WORN_NOW[assistantId]);
// 服の絵のパス。kind は 'face'(吹き出しの丸い顔)か 'full'(立ち絵)。服の絵が決まらないときは null(呼ぶ側が元の服へ落とす)
const assistantCostumeImage = (who, expression, kind) => {
  const costume = who && assistantCostumeWornFor(who.id);
  if (!costume || !costume.imageDir || !who.imagePrefix) return null;
  const list = Array.isArray(who.expressions) ? who.expressions : [];
  if (!list.includes(expression)) return null;
  return `${costume.imageDir}/${kind === 'face' ? 'face/' : ''}${who.imagePrefix}_${expression}.PNG`;
};
// ダイヤショップに並べる服は、ASSISTANT_COSTUMES の売り値(price.diamond)から**自動で**作る(手で書き写さない)。
// type:'costume' が着替えの商品。買う処理(buyMarketItem)・所持の判定(isMarketItemOwned)・見た目はこの type を扱う。
// ★ビートP交換所の分は data/rhythm-event.js が RHYTHM_EVENT_POINT_SHOP_COSTUME_OFFERS を作る。
ASSISTANT_COSTUMES
  .filter(costume => assistantCostumeEverSellsIn(costume, 'diamond'))
  .forEach(costume => {
    // 2026-10-04 ユーザー指示「ダイヤの方にも着替えタブ作って、販売予定のものを入れといてほしい」。
    // shop・available は見るたびに数え直す。服が公開されていれば、ダイヤで売る前でも「着替え」タブに並べる。
    // ダイヤで売るのはまだ先(いまの窓に無い)あいだは available:false で「近日追加」の札になり、買えない
    // (買う処理は available:false を断る)。窓が開いた(ハロウィン・ナイト終了)瞬間から、そのまま買える
    BREEDER_MARKET_ITEMS.push({ id:costume.id, name:costume.name, type:'costume', currency:'diamond', cost:assistantCostumeSaleEverCost(costume, 'diamond'), desc:costume.desc || '', assistantId:costume.assistantId, emoji:'👗', icon:costume.icon,
      // 解放が要る服(unlock)は、解放するまで並べない(「近日追加」の札も出さない。2026-10-27 社長)
      get shop() { return costume.released === true && assistantCostumeUnlockedNow(costume) ? undefined : false; },
      get available() { return assistantCostumeSaleIn(costume, 'diamond') && assistantCostumeUnlockedNow(costume) ? undefined : false; } });
  });

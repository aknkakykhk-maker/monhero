// MFバトルカードのカードのデータ(monster-hero/data/card-battle-cards.js)を、元のカードの書き写し(cards.json)から作る。
//
// 【なぜ道具にするか】(設計: docs/spec/CARD_BATTLE.md 2-1・2-3)
// カードは社長から届いた順に増える(いま392枚)。手で配信用のデータへ書き写すと、数字の写し間違いと
// 「文の効果を作り忘れたカードがパックに出る」が起きる。書き写しは cards.json の1か所だけにして、
// ここで機械的に作り直す。ゲームはカードの画像から読み取らない。動きは全部この表の数字と効果から決まる。
//
// 効果(effects)は、カードの文を決まった部品に当てたもの。部品の意味は 82-card-battle-core.jsx の上に書いてある。
//   ・文が無いカード(ただの攻撃・防御)はそのまま使える
//   ・文があるカードは、下の EFFECTS に部品を書いたものだけ使える(ready:true)
//   ・部品を書いていないカードは ready:false(準備中)。パック・デッキ・コンピューターに出さない
// 使い方: node tools/card/card-data-build.js        データを書き出す
//         node tools/card/card-data-build.js --check  書き出さずに、いまのデータと食い違いがないかだけ見る
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'tools', 'art-sources', 'card-battle');
const OUT = path.join(ROOT, 'monster-hero', 'data', 'card-battle-cards.js');

// フォルダ → 種族の id。id はゲームの中の呼び名(画面には name を出す)
const SPECIES = [
  ['tiger', 'tiger', 'ライガー'], ['gali', 'gali', 'ガリ'], ['golem', 'golem', 'ゴーレム'], ['suezo', 'suezo', 'スエゾー'],
  ['pixie', 'pixie', 'ピクシー'], ['dino', 'dino', 'ディノ'], ['naga', 'naga', 'ナーガ'], ['hare', 'hare', 'ハム'],
  ['mocchi', 'mocchi', 'モッチー'], ['phoenix', 'phoenix', 'ヒノトリ'], ['jell', 'jell', 'ゲル'], ['monol', 'monol', 'モノリス'],
  ['henger', 'henger', 'ヘンガー'], ['mew', 'mew', 'ニャー'], ['plant', 'plant', 'プラント'], ['worm', 'worm', 'ワーム'],
  ['dragon', 'dragon', 'ドラゴン'], ['zilla', 'zilla', 'グジラ'], ['metalner', 'metalner', 'メタルナー'], ['joker', 'joker', 'ジョーカー'],
  ['arrowhead', 'arrowhead', 'アローヘッド'], ['centaur', 'centaur', 'ケンタロウス'], ['colorpandora', 'colorpandora', 'コロペンドラ'],
  ['durahan', 'durahan', 'デュラハン'],
  // ゴースト(2026-10-27 社長「ゴーストのカードが盛れてたから実装よろしく」。第4弾にヘンガーと並べる・台帳 #204)
  ['ghost', 'ghost', 'ゴースト'],
];
const SPECIES_BY_NAME = Object.fromEntries(SPECIES.map(([, id, name]) => [name, id]));
// 弾(台帳 #3413)。番号の離れた技(357〜)は第4弾。全モンスター・ブリーダーは番号で分ける(推定)
const WAVE_OF_SPECIES = {
  tiger: 1, gali: 1, golem: 1, suezo: 1, pixie: 1, dino: 1, naga: 1, hare: 1, mocchi: 1,
  monol: 2, henger: 2, plant: 2, dragon: 2, phoenix: 2, ghost: 2,

  jell: 3, mew: 3, worm: 3, zilla: 3,
  // デュラハン(2026-10-24 #3421 で届いた)。legendcup の抜粋で第3弾と分かっていた(設計書 4-2)
  durahan: 3,
  metalner: 4, joker: 4, arrowhead: 4, centaur: 4, colorpandora: 4,
};
const waveOfNo = (no) => (no <= 128 ? 1 : no <= 260 ? 2 : no <= 280 ? 3 : 4);
const KIND = { 'ちから': 'pow', 'かしこさ': 'int', '特殊': 'spe', '回避': 'dge', '防御': 'blk', '全体': 'fld' };
const TYPE = { '地上': 'ground', '空中': 'air', '水中': 'water' };

// ---- 文 → 効果の部品 ----
// 1文ずつ当てる。全部の文が当たったカードだけ使える(1文でも当たらなければ準備中)。
// 部品の名前と中身は 82-card-battle-core.jsx の CARD_EFFECT_DOC と同じ
const both = ['pow', 'int'];
const SENTENCE_RULES = [
  [/^この技は回避されても、半分のダメージを与える。$/, () => ({ t: 'halfOnEvade' })],
  [/^この技は回避されない。$/, () => ({ t: 'noEvade' })],
  [/^この技でダメージを受けたモンスターは次のターン攻撃できない。$/, () => ({ t: 'stunOnHit' })],
  [/^この技を受けたモンスターは、次のターン攻撃できない。$/, () => ({ t: 'stunOnHit' })],
  [/^この技が回避されなかった場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamageIfHit', n: +m[1] })],
  [/^その技が回避されなかった場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamageIfHit', n: +m[1] })],
  [/^この技が回避された場合、自分は(\d+)ダメージを受ける。$/, (m) => ({ t: 'selfDamageIfEvaded', n: +m[1] })],
  [/^この技を使用した場合、自分は(\d+)ダメージ受ける。$/, (m) => ({ t: 'selfDamage', n: +m[1] })],
  [/^この技でダメージを与えた場合、相手ブリーダーはガッツを(\d+)減らす。$/, (m) => ({ t: 'gutsLossOnHit', n: +m[1] })],
  [/^この技でダメージを与えた場合、相手ブリーダーはガッツを全て失う。$/, () => ({ t: 'gutsLossOnHit', n: 'all' })],
  [/^この技は防御によってダメージをマイナスされない。$/, () => ({ t: 'noBlockReduce' })],
  [/^この技は全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies' })],
  [/^この技は空中にいる全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies', only: 'air' })],
  [/^この技は地上にいる全ての相手モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'enemies', only: 'ground' })],
  [/^この技は自分以外の全ての地上にいるモンスターにダメージを与える。$/, () => ({ t: 'area', who: 'others', only: 'ground' })],
  [/^この技は自分以外の全ての(?:地上にいる)?モンスターにダメージを与える。$/, () => ({ t: 'area', who: 'others' })],
  [/^この技は空中にいるモンスターには、?ダメージを与えられない。$/, () => ({ t: 'cannotHit', type: 'air' })],
  [/^この技は地上にいるモンスターにしかダメージを与えられない。$/, () => ({ t: 'onlyHit', type: 'ground' })],
  [/^この技は空中にいるモンスターには(\d+)倍のダメージを与える。$/, (m) => ({ t: 'multVs', type: 'air', n: +m[1] })],
  [/^この技は地上にいるモンスターには(\d+)倍のダメージを与える。$/, (m) => ({ t: 'multVs', type: 'ground', n: +m[1] })],
  [/^この技で与えたダメージ分、自分のライフを回復する。$/, () => ({ t: 'drain' })],
  [/^「(.+?)」(?:「(.+?)」)?は同一ターンに連続して使用できる。$/, (m) => ({ t: 'chain', names: [m[1], m[2]].filter(Boolean) })],
  [/^(\d+)以上のガッツを消費する、ちから技かかしこさ技を回避する。$/, (m) => ({ t: 'evade', kinds: both, minGuts: +m[1] })],
  [/^ちから技か、かしこさ技を回避する。$/, () => ({ t: 'evade', kinds: both })],
  [/^ちから技を回避する。$/, () => ({ t: 'evade', kinds: ['pow'] })],
  [/^かしこさ技を回避する。$/, () => ({ t: 'evade', kinds: ['int'] })],
  [/^ちから技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: ['pow'], n: +m[1] })],
  [/^かしこさ技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: ['int'], n: +m[1] })],
  [/^この技は自分のライフが(\d+)以下の時に使用できる。$/, (m) => ({ t: 'useWhen', lifeMax: +m[1] })],
  [/^ちから技か、かしこさ技で与えられるダメージを[−-](\d+)する。$/, (m) => ({ t: 'reduce', kinds: both, n: +m[1] })],
  [/^ちから技で受けるダメージの半分\(切り捨て\)をマイナスする。$/, () => ({ t: 'reduceHalf', kinds: ['pow'] })],
  [/^ちから技で与えられるダメージを0にする。$/, () => ({ t: 'reduceAll', kinds: ['pow'] })],
  [/^ちから技か、かしこさ技で与えられるダメージを0にする。$/, () => ({ t: 'reduceAll', kinds: both })], // 帽子に隠れる(ゴースト)
  [/^自分の山札からカードを(\d+)枚引く。$/, (m) => ({ t: 'draw', n: +m[1] })],
  [/^相手の手札の内容を見る。$/, () => ({ t: 'peekHand' })],
  [/^相手の手札を(\d+)枚捨てさせる。$/, (m) => ({ t: 'discardOpp', n: +m[1] })],
  [/^(\d+)体の味方モンスターのライフを(\d+)回復する。$/, (m) => ({ t: 'heal', n: +m[2] })],
  [/^このターン、相手モンスターは回避技を使用できない。$/, () => ({ t: 'forbidThisTurn', kinds: ['dge'] })],
  [/^このターン、相手モンスターは防御技を使用できない。$/, () => ({ t: 'forbidThisTurn', kinds: ['blk'] })],
  [/^かしこさ技によって与えられるダメージを使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['int'], frac: 1 })],
  [/^ちから技によって与えられるダメージを使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['pow'], frac: 1 })],
  [/^ちから技で受けるダメージの半分\(切り捨て\)を技を使用したモンスターに反射する。$/, () => ({ t: 'reflect', kinds: ['pow'], frac: 0.5, keep: true })],
  [/^特別な効果は(?:全て無視する|反射しない)。$/, () => null],
  [/^味方モンスターへの1回分のダメージを、自分のダメージにする。$/, () => ({ t: 'cover' })],
  [/^この技でモンスターのライフを0にしてはならない。$/, () => ({ t: 'nonLethal' })],
  // 準備中の83枚(台帳 #141)・区切り1
  [/^次の自分の(ちから|かしこさ)技1回のダメージを(\d+)倍する。$/, (m) => ({ t: 'charge', kinds: [KIND[m[1]]], n: +m[2] })],
  [/^この効果はダメージを受けると終了する。$/, () => null],
  [/^自分のガッツを全て失う。$/, () => ({ t: 'selfGutsAll' })],
];
// 1文に分けられない・言い回しが1枚だけのカードは、番号で部品を書く(文の全体をここで引き受ける)
const BY_NO = {
  // ライガーの右爪・左爪・ツノ: 同時に使う種類の数でダメージが変わる
  1: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  2: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  3: [{ t: 'combo', names: ['右爪', '左爪', 'ツノ'], table: { 2: 3, 3: 7 } }],
  // ライガーのジャンプ: ちから技を回避。次の自分のターンのちから技2倍・それまで空中
  12: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: ['pow'], n: 2 }, { t: 'becomeAir' }],
  // 底力: ライフ2以下の子の技に付ける(技を使う前に)。その技のダメージ2倍
  110: [{ t: 'attach', when: { lifeMax: 2 } }, { t: 'attachMult', n: 2 }],
  // デュラハンの精神集中: 次のターン(相手の番)が終わるまで、相手にガッツを減らされない
  245: [{ t: 'gutsGuard' }],
  // デュラハンの静の構え: 次の自分のかしこさ技1回を2倍。ダメージを受けたら消える
  246: [{ t: 'charge', kinds: ['int'], n: 2 }],
  // ピクシーの舞い上がる: ジャンプと同じ(ちから技を回避。次の自分のターンのちから技2倍・それまで空中)
  60: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: ['pow'], n: 2 }, { t: 'becomeAir' }],
  // ドラゴンの飛び上がる: ちから技を回避。次の自分のターンのちから技・かしこさ技2倍・それまで空中
  236: [{ t: 'evade', kinds: ['pow'] }, { t: 'nextTurnMult', kinds: both, n: 2 }, { t: 'becomeAir' }],
  // ---- 区切り2: 技と同時に使う札(attach。when は付けられる技の条件。部品の意味は 82 の上) ----
  121: [{ t: 'attach', when: { kinds: both } }, { t: 'attachAdd', n: 2 }], // クリティカル
  124: [{ t: 'attach', when: { kinds: both, deckEmpty: true } }, { t: 'attachMult', n: 3 }], // 劇的な幕切れ
  330: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachMult', n: 2 }, { t: 'attachSelfIfHit', n: 2 }], // 捨て身
  345: [{ t: 'attach', when: { kinds: both, lifeMax: 2 } }, { t: 'attachAdd', n: 2 }], // 必死
  343: [{ t: 'attach', when: { kinds: both } }, { t: 'attachCost', n: 1 }], // 団結
  347: [{ t: 'attach', when: { area: true } }, { t: 'attachCostHalf' }], // 急襲
  274: [{ t: 'attach', when: { kinds: both } }, { t: 'attachNoZeroGuard' }], // 集中
  349: [{ t: 'attach', when: { kinds: both } }, { t: 'attachNoGuardIfGuarded' }], // 挟み撃ち
  366: [{ t: 'attach', when: { kinds: both } }, { t: 'attachBind' }], // 影縛り(ブリーダー)
  362: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoBlockReduce' }], // 渾身
  363: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoGuard' }], // 瞬殺
  346: [{ t: 'attach', when: { kinds: both, pure: true } }, { t: 'attachNoEvadeHybrid' }], // 純血のスピード
  276: [{ t: 'attach', when: { breederMaxGuts: 3 } }, { t: 'attachFree' }], // ジョイのサポート(ブリーダーのカードに付ける)
  342: [{ t: 'freeSpeThisTurn' }], // 友情の証(付けずに出す特殊技)
  9: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoEvade' }], // 電光石火
  70: [{ t: 'attach', when: { kinds: ['pow'] } }, { t: 'attachNoEvade' }], // 跳躍
  209: [{ t: 'attach', when: { kinds: both } }, { t: 'attachCost', n: 2 }], // 光合成
  // ---- 区切り3: もう1回攻撃・攻撃できない・狙いの縛り(部品の意味は 82 の上) ----
  250: [{ t: 'useWhenAllies', n: 1 }, { t: 'extraAttack', n: 1 }], // 孤軍奮闘
  254: [{ t: 'extraAttackTarget', n: 1 }], // オイリーオイル(もう攻撃した味方に)
  351: [{ t: 'unstunTarget' }], // 夏美草(攻撃できない印のある味方に)
  234: [{ t: 'liftTarget' }, { t: 'extraAttack', n: 1 }], // ほうり上げる
  294: [{ t: 'unlimitedAttacks' }], // タイムディレイ
  175: [{ t: 'unlimitedAttacks' }], // ゴーストラッシュ(死亡遊戯と同じ文)
  83: [{ t: 'unlimitedAttacks' }], // 死亡遊戯
  197: [{ t: 'breederUnlimited' }], // うたうニャ
  46: [{ t: 'taunt', mode: 'only' }], // 挑発
  365: [{ t: 'taunt', mode: 'only' }], // レロレロ
  57: [{ t: 'taunt', mode: 'not' }], // 魅了
  269: [{ t: 'taunt', mode: 'only', noArea: true }], // たちはだかる
  10: [{ t: 'stunAllEnemies' }], // 吠え
  273: [{ t: 'stunTarget' }], // 吹き飛ばし
  47: [{ t: 'skipTurn' }], // 歌う
  251: [{ t: 'rage' }], // 怒り
  // ---- 区切り4: 山札・手札・捨て札・ガッツを動かす(choose は選ぶ段。src … discard/hand、then … 選んだ札の行き先) ----
  114: [{ t: 'rush', n: 5 }], // 突進(そのターンの最初のカード。ほかのカードを出せなくなる)
  122: [{ t: 'choose', src: 'hand', then: 'toDeckShuffleDraw' }], // 最後の切札
  125: [{ t: 'lastWish' }], // 後は頼んだ
  126: [{ t: 'gutsZeroBoth' }], // 戦意喪失
  127: [{ t: 'useWhenAllies', n: 1 }, { t: 'deckToGuts' }], // 最後のきらめき
  137: [{ t: 'choose', src: 'discard', then: 'toDeckBottom' }], // 伝説のちから
  149: [{ t: 'oppHandToDeckBottom' }, { t: 'oppDraw', n: 4 }], // ハテナマーク
  186: [{ t: 'choose', src: 'discard', filter: { kind: 'dge', usable: true }, then: 'toHand' }], // 回避プログラム
  252: [{ t: 'gutsToDeckShuffle' }], // 時間稼ぎ
  253: [{ t: 'selfHurt', n: 1 }, { t: 'draw', n: 1 }], // 冬虫散(味方1体)
  278: [{ t: 'oppGutsLoss', n: 1 }], // 泣き真似
  279: [{ t: 'refresh' }], // リフレッシュ
  303: [{ t: 'choose', src: 'discard', filter: { attack: true, usable: true }, then: 'toHand' }], // 悪夢
  304: [{ t: 'peekPick' }], // 死神の力(相手が手札を見せる → こちらが選んで捨てさせる)
  306: [{ t: 'millOpp', n: 3 }], // 大鎌
  364: [{ t: 'discardBothHands' }], // 超大声
  22: [{ t: 'choose', src: 'discard', then: 'toHand' }], // 作戦の指示
  94: [{ t: 'choose', src: 'hand', then: 'discardDraw2' }], // 素早い計算
  169: [{ t: 'tossBonus' }], // カード投げ(使うときに手札を好きな枚数捨て、その枚数をダメージに足す。act.toss … 捨てる手札の番号)
  // ---- 区切り5: 守りの新しい形・持ちょうを変える ----
  107: [{ t: 'redirect' }], // 隠れる(目標を自分から他の味方へ。守る人が選ぶ)
  111: [{ t: 'endure', kinds: both }], // 根性(残りのライフ以上のダメージでも、ライフ1で残る)
  123: [{ t: 'evadeAll' }], // みんな下がれ(全員に当たる技を全員が回避)
  163: [{ t: 'shield' }], // 盾になる(1回の攻撃で味方が受けるダメージを全部この子が)
  275: [{ t: 'noGutsLoss' }], // 我慢
  270: [{ t: 'liftAllies' }], // 吹き上げる(狙われていなくても出せる。自分以外の味方を、次のターン終了まで空中に)
  318: [{ t: 'waterAll' }], // ひきずりこむ(狙われていなくても出せる。このターン、味方を全員水中に)
  198: [{ t: 'safe' }], // ぬいぐるみ(次の自分の番まで、どこからのダメージも0)
  249: [{ t: 'takeMult', kinds: ['pow'], n: 2 }, { t: 'nextTurnMult', kinds: ['pow'], n: 3 }], // 肉を切らせて
  185: [{ t: 'form' }, { t: 'draw', n: 1 }], // 変形(空中か地上かを選ぶ)
  293: [{ t: 'form' }, { t: 'draw', n: 1 }], // トランスフォーム
  // ---- 区切り6: 同時に2枚・ダメージの数え方が変わる技 ----
  178: [{ t: 'pair', dmg: 10 }], // キック(2枚同時なら10)
  214: [{ t: 'pair', dmg: 12 }], // しっぽキック(2枚同時なら12)
  285: [{ t: 'combo', names: ['右掌', '左掌'], table: { 2: 4 } }], // 右掌
  286: [{ t: 'combo', names: ['右掌', '左掌'], table: { 2: 4 } }], // 左掌
  227: [{ t: 'requires', names: ['しっぽアタック', 'かみつき'] }, { t: 'area', who: 'enemies' }], // コンビネーション(2枚のガッツ・ダメージは無視)
  288: [{ t: 'returnOnHit' }], // ポン拳
  340: [{ t: 'split' }], // ショットガン(割り振り)
  54: [{ t: 'split' }], // ショットガン
  358: [{ t: 'noEvade' }, { t: 'bonusDiscard', user: 'gali' }], // 魔神ファイナル
  361: [{ t: 'noEvade' }, { t: 'bonusLost' }], // ビッグバン
  150: [{ t: 'attach', when: { kinds: ['pow'], mimic: true } }, { t: 'mimic' }], // ものまね(どの種族のちから技でも、この子が出せる)
  // ---- 区切り7: モンスターが入れ替わる(おいのり 280 は、全体カードを入れる日まで準備中のまま。台帳: 社長 案A) ----
  128: [{ t: 'revive', species: 'phoenix', life: 4 }], // ヒノトリの復活(その子はそのターン攻撃できない)
  174: [{ t: 'possess' }], // のりうつる(KOされた味方1体を、この子の今のライフで戻し、この子はKO。戻った子はそのターン攻撃できない)
  221: [{ t: 'cocoon' }], // まゆ化(羽化のほかの札を出せない)
  222: [{ t: 'emerge', to: 'C-062' }], // 羽化(まゆ化した子を、ムラサキチュウ(C-062)と取りかえて最大まで回復。社長 2026-10-25)
  352: [{ t: 'fuse' }], // 合体(act.fuse … { a: メインを出す子, b: サブを出す子, no: 出る混血 })
  348: [{ t: 'attach', when: { kinds: ['spe'], subSpe: true } }, { t: 'ancient' }], // 太古の記憶(混血の子が、サブの種族の特殊技を出せる)
  // ---- 全体カード(2026-10-25。場に1枚だけ残り、両方のブリーダーに効く。部品の中身は 82 の cardFieldEff・CARD_EFFECT_DOC) ----
  // おいのり: 相手が全体カードを出した瞬間に出せる。その全体カードは効かずに捨て札へ(前から場にあった全体カードはそのまま)
  280: [{ t: 'pray' }],
  F115: [{ t: 'fieldDrawOnPlay', n: 1 }],                       // 冷静な判断: 出した時に1枚引く(場に残るあいだは何もしない)
  F116: [{ t: 'fieldDmg', kinds: ['pow', 'int'], n: 1 }],        // 壮絶な戦い
  F117: [{ t: 'fieldDmg', kinds: ['int'], n: -2 }],              // 興奮のるつぼ
  F118: [{ t: 'fieldCost', n: -1 }],                             // ホリィの声援(0より下にはならない)
  F119: [{ t: 'fieldBanDmg', kinds: ['pow', 'int'], max: 3 }],   // 必殺技の応酬(最終的なダメージが3以下は出せない)
  F120: [{ t: 'fieldMill', n: 2 }],                              // 大混乱(ドローの前に、その番の人の山札の上から2枚を捨てる)
  F255: [{ t: 'fieldPurePride' }],                               // 純血のプライド(純血の子の攻撃に、派生の子は回避を出せない)
  F256: [{ t: 'fieldCost', n: 1 }],                              // 師匠のまなざし
  F257: [{ t: 'fieldBanKind', kinds: ['spe'] }],                 // がんじがらめ
  F258: [{ t: 'fieldBanDmg', kinds: ['pow', 'int'], min: 4 }],   // 必殺技の封印(最終的なダメージが4以上は出せない)
  F259: [{ t: 'fieldType', type: 'ground' }],                    // 悪天候(場から無くなったら元に戻る)
  F260: [{ t: 'fieldBurn', n: 1 }],                              // 灼熱の地(攻撃を終えたとき、攻撃した側の全員に1)
  F261: [{ t: 'fieldDmg', kinds: ['int'], n: 1 }],               // 飛び散る火花
  F262: [{ t: 'fieldType', type: 'air' }],                       // 空間のひずみ(場から無くなったら元に戻る)
  F263: [{ t: 'fieldGutsMax', n: 2 }],                           // 長期戦の予感(ガッツの段で2枚まで)
};

// カードの詳しい画面に足す一言。文の読み方を決めた札だけ(2026-10-25 社長「推奨どおり」。一覧: docs/progress/card-battle/pending-83/README.md)
const NOTE_BY_NO = {
  9: '技に付けて一緒に出します(攻撃の1回には数えません)',
  70: '技に付けて一緒に出します(攻撃の1回には数えません)',
  209: '技に付けて一緒に出します(攻撃の1回には数えません)',
  342: '出した子の攻撃1回に数えます。そのターン、ほかの味方の特殊技は0ガッツで出せます',
  363: '回避も防御も出せません',
  366: '回避・防御のカードを名前で名指しします。同じ名前のカードは全部使えません',
  46: '相手は次の番、この子を狙う技しか出せません(全員に当たる技は出せます)',
  365: '相手は次の番、この子を狙う技しか出せません(全員に当たる技は出せます)',
  57: '相手は次の番、この子に当たる技を出せません(全員に当たる技も出せません)',
  269: '相手は次の番、この子を狙う技しか出せません(全員に当たる技も出せません)',
  10: '技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます',
  273: '技(ちから・かしこさ・特殊)が出せなくなります。守りとブリーダーのカードは出せます',
  47: '相手の次の番は、引く・攻撃・ガッツ置きが全部なくなります',
  83: 'その子は、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)',
  294: 'その子は、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)',
  175: 'その子は、そのターン攻撃の技を何枚でも出せます(ガッツはふつうに払います)',
  169: '使うときに、捨てる手札を選びます(0枚でもよい)。捨てた枚数がダメージになります',
  174: '戻る子のライフは、この子の今のライフです(戻る子のもとのライフより多くはなりません)。戻った子は、そのターン攻撃できません',
  351: '「攻撃できない」を消します。もう攻撃した子には使えません',
  251: '次の番のちから技・かしこさ技が2倍になります',
  114: 'そのターンは、ほかの技・ブリーダーのカードを出せません(ガッツ置きはできます)',
  125: '捨て札の新しいほうから、残りライフの枚数をガッツにします',
  253: 'ライフ1の子にも使えて、その子はKOになります',
  126: '精神集中をしている相手のガッツは減りません。自分のガッツは必ず0になります',
  107: '目標を移す先は、守る人が倒れていない味方から選びます。移した先の子は、もう守れません',
  111: '残りのライフ以上のダメージでも、ライフ1で残ります',
  163: '全員に当たる技なら、味方のぶんを全部この子が受けます。1体を狙う技なら、かばいます',
  198: '相手の技・はね返し・全員に当たる技・自分の技の反動も0にします',
  185: '空中か地上かを選びます。次に変わるまで、ずっとそのままです',
  293: '空中か地上かを選びます。次に変わるまで、ずっとそのままです',
  150: '手札のちから技なら、どの種族の技でもこの子が出せます(一緒に出します)',
  227: '「しっぽアタック」「かみつき」が手札に1枚ずつあるときだけ出せます。3枚を一緒に出し、払うガッツは4だけです',
  340: 'ダメージを1点ずつ、相手のモンスターに割り振ります(1体に全部でもよい)。守りは割り振られた子ごとに出せます',
  54: 'ダメージを1点ずつ、相手のモンスターに割り振ります(1体に全部でもよい)。守りは割り振られた子ごとに出せます',
  358: '捨て札にある、ガリ専用の攻撃の技(ちから・かしこさ・特殊)の枚数を足します',
  222: '取りかえる先はムラサキチュウです。ライフは、ムラサキチュウの最大まで回復します',
  352: 'メインとサブが合う混血だけ出せます。ライフは最大で、メインを出した子の場所に出ます。出た子だけ、そのターン攻撃できません',
  348: '混血の子の特殊技に付けると、サブの種族の特殊技も出せます(一緒に出します)',
  // 全体カード(2026-10-25)
  280: '相手が全体カードを出した瞬間に出せます(相手の番でも出せます)。その全体カードは効かずに捨て札へ行き、前から場にあった全体カードはそのまま残ります',
  F115: '出した時に1枚引きます。場に残っているあいだは、ほかに何もしません',
  F119: '最終的なダメージは、技に付けた札と全体カードの分まで足した数です',
  F258: '最終的なダメージは、技に付けた札と全体カードの分まで足した数です',
  F120: 'それぞれの番のドローの前に、その番の人の山札の上から2枚を捨て札にします',
  F260: '攻撃を終えて「攻撃おわり」にしたとき、攻撃した側のモンスター全員に1ダメージです',
  F263: 'ガッツの段でガッツにできるのは2枚までです(手札が5枚のときに山札の上がガッツになるのは数えません)',
};
const splitSentences = (text) => (text || '').split(/(?<=。)/).map((s) => s.trim()).filter(Boolean);
const effectsOf = (no, text) => {
  if (BY_NO[no]) return { ready: true, effects: BY_NO[no] };
  const sents = splitSentences(text);
  const effects = [];
  for (const s of sents) {
    const rule = SENTENCE_RULES.find(([re]) => re.test(s));
    if (!rule) return { ready: false, effects: [], missing: s };
    const e = rule[1](s.match(rule[0]));
    if (e) effects.push(e);
  }
  return { ready: true, effects };
};

const readJson = (dir) => JSON.parse(fs.readFileSync(path.join(SRC, dir, 'cards.json'), 'utf8'));

const build = () => {
  const cards = {};
  const monsters = {};
  const notReady = [];
  const add = (card) => {
    if (cards[card.no]) throw new Error(`番号がだぶっている: ${card.no}`);
    cards[card.no] = card;
  };
  for (const [dir, id, name] of SPECIES) {
    const j = readJson(dir);
    for (const m of j.monster) {
      monsters[m.no] = { no: m.no, species: id, name, type: TYPE[m.type], life: m.life, variant: m.variant || null, wave: (m.no === 'C-031R' || m.no === 'C-031RS') ? 4 : WAVE_OF_SPECIES[id], img: m.img.replace(/\.jpg$/, '') };
    }
    for (const s of j.skills) {
      const no = Number(s.no);
      const eff = effectsOf(no, s.text);
      if (!eff.ready) notReady.push(`${s.no} ${s.name}: ${eff.missing}`);
      add({ no: s.no, name: s.name, kind: KIND[s.kind], damage: Number.isFinite(s.damage) ? s.damage : null, guts: s.guts,
        text: s.text || '', user: id, wave: no >= 357 ? 4 : WAVE_OF_SPECIES[id], ready: eff.ready, effects: eff.effects, img: s.no, ...(NOTE_BY_NO[no] ? { note: NOTE_BY_NO[no] } : {}) });
    }
  }
  // 全体カード(breeder-field)は番号に F が付く(技カードの番号と重ならないように)。弾は F のあとの数で決める(115〜120 は第1弾・255〜263 は第3弾)
  for (const [dir, cat] of [['any-monster', 'any'], ['breeder', 'breeder'], ['breeder-field', 'breeder']]) {
    const j = readJson(dir);
    for (const s of j.skills) {
      const field = /^F\d+$/.test(s.no);
      const no = field ? s.no : Number(s.no);
      const eff = effectsOf(no, s.text);
      if (!eff.ready) notReady.push(`${s.no} ${s.name}: ${eff.missing}`);
      add({ no: s.no, name: s.name, kind: KIND[s.kind], damage: Number.isFinite(s.damage) ? s.damage : null, guts: s.guts,
        text: s.text || '', user: cat, wave: waveOfNo(field ? Number(s.no.slice(1)) : no), ready: eff.ready, effects: eff.effects, img: s.no, ...(NOTE_BY_NO[no] ? { note: NOTE_BY_NO[no] } : {}) });
    }
  }
  const hy = readJson('hybrid');
  for (const m of hy.monster) {
    if (m.excluded) continue;
    // キラ・別絵キラがある子(剣士モッチー C-066S・C-066V。2026-10-26)は、元の番号(base)の種族を共有する(デッキに同じ子を2体入れられないように)
    monsters[m.no] = { no: m.no, species: `hybrid:${m.base || m.no}`, name: m.name, type: TYPE[m.type], life: m.life, variant: m.variant || null,
      // 副が ??? の子は sub: 'unknown'(どの種族とも一致しない。このゲームでは ??? がレアの印。社長 2026-10-25)
      main: SPECIES_BY_NAME[m.main] || m.main, sub: m.sub === '？？？' ? 'unknown' : SPECIES_BY_NAME[m.sub] || m.sub, wave: 'hybrid', img: m.img.replace(/\.jpg$/, ''),
      // メインの種族の技が届いていない子は準備中(設計書 4-2。デュラハンは 2026-10-24 に届いた)
      ready: !!SPECIES_BY_NAME[m.main],
      // 立ち絵が無い子は、パックにもコンピューターのデッキにも入れず、図鑑にだけ並べる(社長 2026-10-25。cards.json の dex_only)
      ...(m.dex_only ? { dexOnly: true } : {}) };
  }
  // スターター(元の表どおり。頭突き → 頭つき はカードの文字に合わせる)
  const dl = JSON.parse(fs.readFileSync(path.join(SRC, 'starter-decklists', 'decklists.json'), 'utf8'));
  const byName = (user, name) => Object.values(cards).find((c) => c.user === user && c.name === name);
  const starters = {};
  for (const [kitId, kit] of Object.entries(dl)) {
    if (kitId === 'note') continue;
    const list = [];
    for (const [grp, entries] of Object.entries(kit.cards)) {
      const user = grp === '全モンスター' ? 'any' : grp === 'ブリーダー' ? 'breeder' : SPECIES_BY_NAME[grp];
      for (const [nm, count] of Object.entries(entries)) {
        const c = byName(user, nm === '頭突き' ? '頭つき' : nm);
        if (!c) throw new Error(`スターターのカードが見つからない: ${kitId} ${grp} ${nm}`);
        for (let i = 0; i < count; i++) list.push(c.no);
      }
    }
    const mons = kit.monsters.map((nm) => Object.values(monsters).find((m) => m.name === nm && !m.variant).no);
    // 箱の名前(台帳: 黄色のキットは「一発逆転ミラクルチーム」・2026-10-24 社長が一発必殺を取り消し)
    const name = kitId === 'miracle' ? '一発逆転ミラクルチーム' : kit.name;
    starters[kitId] = { id: kitId, name, monsters: mons, cards: list };
  }
  for (const [id, kit] of Object.entries(starters)) {
    if (kit.cards.length !== 50) throw new Error(`スターター ${id} が50枚でない: ${kit.cards.length}`);
    const nr = kit.cards.filter((no) => !cards[no].ready);
    if (nr.length) throw new Error(`スターター ${id} に準備中のカードがある: ${[...new Set(nr)].join(' ')}`);
  }
  return { cards, monsters, starters, notReady };
};

const render = ({ cards, monsters, starters }) => {
  const body = { version: 1, cards, monsters, starters };
  return `// MFバトルカードのカードのデータ。tools/card/card-data-build.js が tools/art-sources/card-battle/*/cards.json から作る。
// ★手で書き換えない(書き写しの元は cards.json。効果の部品は card-data-build.js)。設計: docs/spec/CARD_BATTLE.md
const CARD_BATTLE_DATA = ${JSON.stringify(body)};
`;
};

if (require.main === module) {
  const built = build();
  const text = render(built);
  const readyCount = Object.values(built.cards).filter((c) => c.ready).length;
  if (process.argv.includes('--check')) {
    const now = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (now !== text) { console.log('NG: card-battle-cards.js が cards.json から作り直したものと違う(node tools/card/card-data-build.js で作り直す)'); process.exit(1); }
    console.log(`OK: card-battle-cards.js は最新(技 ${Object.keys(built.cards).length} 枚のうち使える ${readyCount} 枚・モンスター ${Object.keys(built.monsters).length} 枚)`);
  } else {
    fs.writeFileSync(OUT, text);
    console.log(`書き出し: ${path.relative(ROOT, OUT)}(${(text.length / 1024).toFixed(0)}KB。技 ${Object.keys(built.cards).length} 枚のうち使える ${readyCount} 枚・モンスター ${Object.keys(built.monsters).length} 枚・スターター ${Object.keys(built.starters).length} つ)`);
    if (process.argv.includes('--list-missing')) for (const l of built.notReady) console.log(`  準備中: ${l}`);
  }
}

module.exports = { build, effectsOf, SENTENCE_RULES };
